import { notFound } from 'next/navigation';
import { requireStaff } from '@/features/admin/server/gate';
import { legalStatus } from '@/features/legal/status';
import { isUuid, LEGAL_REQUESTS } from '@/features/legal-requests/config';
import { LegalConsole } from '@/features/legal-requests/admin/LegalConsole.client';
import { legalDb } from '@/features/legal-requests/server/db';
import { getUi } from '@/lib/i18n/server';

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * /app/admin/legal — reports about content and privacy requests (support.view to read; the actions need
 * support.reply, and removing an item for good an owner or an admin — the database checks every one).
 * Not found until version 2 of the legal documents is in force.
 */
export default async function AdminLegalPage({ searchParams }: { searchParams: Search }) {
  if (!legalStatus().active) notFound();
  const staff = await requireStaff('support.view', '/app/admin/legal');
  const q = await searchParams;
  const tab = one(q.tab) === 'requests' ? 'requests' : 'reports';
  const show = one(q.show) === 'all' ? 'all' : 'open';
  const id = one(q.id);
  const limit = LEGAL_REQUESTS.listLimit;
  const [reports, requests, { t }] = await Promise.all([
    legalDb.reports(staff.userId, show, limit),
    legalDb.requests(staff.userId, show, limit),
    getUi(),
  ]);
  const selected = id && isUuid(id) ? id : null;
  const [report, request] = await Promise.all([
    selected && tab === 'reports' ? legalDb.report(staff.userId, selected) : null,
    selected && tab === 'requests' ? legalDb.request(staff.userId, selected) : null,
  ]);
  return (
    <LegalConsole
      s={t.legalRequests.admin}
      tab={tab}
      show={show}
      selected={selected}
      reports={reports}
      requests={requests}
      report={report}
      request={request}
    />
  );
}
