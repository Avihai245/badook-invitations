import { requireStaff } from '@/features/admin/server/gate';
import { parseInboxQuery } from '@/features/support/tickets/admin/query';
import { SupportInbox } from '@/features/support/tickets/admin/SupportInbox.client';
import { adminSupportDb } from '@/features/support/tickets/server/db';

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * /app/admin/support — the support inbox (support.view): the numbers, the tabs with their counts, the
 * filters and the tickets. The console's live channel refreshes it (a new ticket, a customer's answer).
 */
export default async function AdminSupportPage({ searchParams }: { searchParams: Search }) {
  const staff = await requireStaff('support.view', '/app/admin/support');
  const query = parseInboxQuery(await searchParams);
  const numbers = (err: unknown) => (console.error('[admin] support numbers', err), null);
  const [list, summary, replyTime] = await Promise.all([
    adminSupportDb.list(staff.userId, query),
    adminSupportDb.summary(staff.userId).catch(numbers),
    adminSupportDb.replyTime(staff.userId, 30).catch(numbers),
  ]);
  return <SupportInbox query={query} list={list} summary={summary} replyTime={replyTime} />;
}
