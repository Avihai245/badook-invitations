'use client';

import { Card } from '@/components/app';
import type { AdminArea } from '../nav';
import { AdminPageHeader } from './AdminShell.client';
import { useAdminUi } from './AdminUi.client';

/** An area's page before its screens are in: its title and what it will hold. */
export function AdminAreaStub({ area, denied = false }: { area: AdminArea; denied?: boolean }) {
  const { t } = useAdminUi();
  const d = t[area];
  return (
    <>
      <AdminPageHeader title={d.title} intro={d.intro} />
      {denied ? (
        <p
          role="alert"
          data-testid="admin-denied"
          className="mb-4 rounded-[12px] border border-warning/40 bg-warning-bg px-4 py-3 text-[14px] text-ink"
        >
          {t.denied}
        </p>
      ) : null}
      <Card>
        <p className="text-[14px] text-muted">{t.common.empty}</p>
      </Card>
    </>
  );
}
