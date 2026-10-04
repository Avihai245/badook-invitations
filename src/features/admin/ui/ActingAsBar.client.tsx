'use client';

import { LogOut, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useUi } from '@/lib/i18n/client';

const WORDS = {
  he: {
    acting: 'תמיכה מרחוק: אתם בחשבון של',
    exit: 'חזרה לממשק הניהול',
  },
  en: {
    acting: 'Remote support: you are in the account of',
    exit: 'Back to the console',
  },
};

/**
 * On every screen of the app while a staff member is acting as a customer: whose account this is, and
 * the way back (which records the end). Fixed at the top, above everything, so it's never missed.
 */
export function ActingAsBar({ who }: { who: string }) {
  const { locale } = useUi();
  const w = locale === 'he' ? WORDS.he : WORDS.en;
  const [busy, setBusy] = useState(false);
  const exit = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/act-as/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = (await res.json().catch(() => null)) as { redirect?: string } | null;
      window.location.assign(body?.redirect ?? '/app/admin/users');
    } catch {
      setBusy(false);
    }
  };
  return (
    <div
      role="status"
      data-testid="acting-as-bar"
      className="fixed inset-x-0 top-0 z-[90] flex justify-center px-2 pt-[env(safe-area-inset-top)] print:hidden"
    >
      <div className="flex max-w-full items-center gap-2 rounded-b-xl bg-[#b4231a] py-1.5 ps-3 pe-1.5 text-[12.5px] text-white shadow-lg">
        <ShieldAlert aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 truncate">
          {w.acting} <bdi className="font-bold">{who}</bdi>
        </span>
        <button
          type="button"
          onClick={() => void exit()}
          disabled={busy}
          data-testid="acting-as-exit"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2 py-1 font-semibold hover:bg-white/25 disabled:opacity-60"
        >
          <LogOut aria-hidden className="icon-dir size-3.5" />
          {w.exit}
        </button>
      </div>
    </div>
  );
}
