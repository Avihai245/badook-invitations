import { coreDb, type AuditQuery } from '@/features/admin/server/core-db';
import { requireStaff } from '@/features/admin/server/gate';
import { AuditScreen } from '@/features/admin/ui/audit/AuditScreen.client';
import { one, oneOf, uuidOf, type SearchParams } from '@/features/admin/ui/core/params';

const TARGETS = ['user', 'invitation', 'ticket', 'staff', 'payment', 'partner', 'system'] as const;
const PAGE = 50;

/** The record of actions: newest first, a page at a time by id; who, what and about what in the address. */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff('audit.view', '/app/admin/audit');
  const sp = await searchParams;
  const action = one(sp.action);
  const targetId = one(sp.targetId)?.trim();
  const before = Number(one(sp.before));
  const query: AuditQuery = {
    actor: uuidOf(sp.actor),
    action: action && /^[a-z_]+(\.[a-z_]+)*$/.test(action) && action.length <= 64 ? action : undefined,
    targetType: oneOf(sp.targetType, TARGETS),
    targetId: targetId && targetId.length <= 254 ? targetId : undefined,
    before: Number.isSafeInteger(before) && before > 0 ? before : undefined,
    limit: PAGE,
  };
  const data = await coreDb.audit(staff.userId, query);
  const aboutName = query.targetId
    ? (data.rows.find((r) => r.targetId === query.targetId)?.targetName ?? null)
    : null;
  return <AuditScreen data={data} query={query} aboutName={aboutName} />;
}
