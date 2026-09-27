'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { fmt, intlLocale, plural, uiDir, type PluralEntry, type UiLocale } from '@/lib/i18n/app';
import { useLiveRefresh, type LiveStatus } from '@/lib/live/client';
import type { RealtimeInfo } from '@/lib/live/types';
import { adminDict, type AdminDict } from '../i18n';
import type { Permission, StaffRole } from '../permissions';

/**
 * The admin console's client side: its strings in the UI language, number, money and date formats,
 * the signed-in staff member (what the screens may offer — the server checks every action again), and
 * the live connection that refreshes the page when something changes.
 */

export interface AdminStaffView {
  email: string;
  role: StaffRole;
  permissions: Permission[];
}

interface AdminUiValue {
  locale: UiLocale;
  dir: 'rtl' | 'ltr';
  t: AdminDict;
  fmt: typeof fmt;
  plural(entry: PluralEntry, n: number, vars?: Record<string, string | number>): string;
  number(n: number, options?: Intl.NumberFormatOptions): string;
  /** shekels unless said otherwise, without agorot above 1,000 */
  money(n: number, currency?: string): string;
  date(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string;
  dateTime(value: Date | string | number): string;
  /** "5 minutes ago" */
  relative(value: Date | string | number, now?: number): string;
  staff: AdminStaffView;
  can(perm: Permission): boolean;
  live: LiveStatus;
}

const AdminUiContext = createContext<AdminUiValue | null>(null);

/** The console refreshes at most this often, however busy the system is (each refresh asks again). */
export const ADMIN_REFRESH_MIN_MS = 4_000;
/** While the live connection is down: a check every minute. */
export const ADMIN_POLL_MS = 60_000;

export function AdminUiProvider({
  locale,
  staff,
  realtime,
  children,
}: {
  locale: UiLocale;
  staff: AdminStaffView;
  realtime: RealtimeInfo | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => {
    if (timer.current) return;
    const wait = Math.max(0, last.current + ADMIN_REFRESH_MIN_MS - Date.now());
    timer.current = setTimeout(() => {
      timer.current = null;
      last.current = Date.now();
      router.refresh();
    }, wait);
  }, [router]);
  const live = useLiveRefresh(realtime, refresh, ADMIN_POLL_MS);

  const value = useMemo<AdminUiValue>(() => {
    const intl = intlLocale(locale);
    const numbers = new Intl.NumberFormat(intl);
    const rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
    const toDate = (value: Date | string | number) =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00Z`)
        : new Date(value);
    return {
      locale,
      dir: uiDir(locale),
      t: adminDict(locale),
      fmt,
      plural: (entry, n, vars) => plural(locale, entry, n, vars),
      number: (n, options) => (options ? new Intl.NumberFormat(intl, options).format(n) : numbers.format(n)),
      money: (n, currency = 'ILS') =>
        new Intl.NumberFormat(intl, {
          style: 'currency',
          currency,
          maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
          minimumFractionDigits: 0,
        }).format(n),
      date: (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
        new Intl.DateTimeFormat(intl, { timeZone: 'Asia/Jerusalem', ...options }).format(toDate(value)),
      dateTime: (value) =>
        new Intl.DateTimeFormat(intl, {
          timeZone: 'Asia/Jerusalem',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(toDate(value)),
      relative: (value, now = Date.now()) => {
        const s = Math.round((toDate(value).getTime() - now) / 1000);
        const abs = Math.abs(s);
        if (abs < 60) return rtf.format(s, 'second');
        if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
        if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
        return new Intl.DateTimeFormat(intl, {
          timeZone: 'Asia/Jerusalem',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(toDate(value));
      },
      staff,
      can: (perm) => staff.permissions.includes(perm),
      live,
    };
  }, [locale, staff, live]);
  return <AdminUiContext.Provider value={value}>{children}</AdminUiContext.Provider>;
}

export function useAdminUi(): AdminUiValue {
  const value = useContext(AdminUiContext);
  if (!value) throw new Error('useAdminUi() outside <AdminUiProvider>');
  return value;
}
