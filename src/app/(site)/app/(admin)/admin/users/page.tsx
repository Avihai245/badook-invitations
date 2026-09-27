import { coreDb, USER_SORTS, type UserQuery } from '@/features/admin/server/core-db';
import { requireStaff } from '@/features/admin/server/gate';
import { flagOf, oneOf, pageOf, textOf, type SearchParams } from '@/features/admin/ui/core/params';
import { UsersScreen } from '@/features/admin/ui/users/UsersScreen.client';

/** The console's users: search, filters, sort and pages in the address (the list reads on the server). */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff('users.view', '/app/admin/users');
  const sp = await searchParams;
  const query: UserQuery = {
    q: textOf(sp.q),
    source: oneOf(sp.source, ['signup', 'google', 'partner'] as const),
    plan: oneOf(sp.plan, ['free', 'pro', 'business'] as const),
    discount: flagOf(sp.discount) || undefined,
    staff: flagOf(sp.staff) || undefined,
    suspended: flagOf(sp.suspended) || undefined,
    sort: oneOf(sp.sort, USER_SORTS),
    page: pageOf(sp.page),
  };
  const data = await coreDb.users(staff.userId, query);
  return <UsersScreen data={data} query={query} />;
}
