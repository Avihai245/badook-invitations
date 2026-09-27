import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { adminNavBadges } from '@/features/admin/server/badges';
import { requireStaff } from '@/features/admin/server/gate';
import { adminRealtime } from '@/features/admin/server/live';
import { AdminShell } from '@/features/admin/ui/AdminShell.client';
import { AdminUiProvider } from '@/features/admin/ui/AdminUi.client';
import { getUiLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Badook admin',
  robots: { index: false, follow: false },
};

/**
 * The admin console (/app/admin): staff only — anyone else gets "not found" — with the menu of the
 * areas their role may open, and the live channel that refreshes the page when something changes.
 * Every page and every action checks its own permission again (features/admin/server/gate.ts).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff('dashboard.view');
  const [locale, realtime, badges] = await Promise.all([
    getUiLocale(),
    adminRealtime(staff).catch((err) => (console.error('[admin] live channel', err), null)),
    adminNavBadges(staff).catch((err) => (console.error('[admin] menu counts', err), {})),
  ]);
  return (
    <AdminUiProvider
      locale={locale}
      staff={{ email: staff.email, role: staff.role, permissions: staff.permissions }}
      realtime={realtime}
    >
      <AdminShell badges={badges}>{children}</AdminShell>
    </AdminUiProvider>
  );
}
