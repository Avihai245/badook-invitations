import { notFound } from 'next/navigation';
import { coreDb } from '@/features/admin/server/core-db';
import { requireStaff } from '@/features/admin/server/gate';
import { israelToday } from '@/features/admin/ui/core/dates';
import { uuidOf } from '@/features/admin/ui/core/params';
import { UserPartnerSource } from '@/features/admin/ui/slots/UserPartnerSource';
import { UserTickets } from '@/features/admin/ui/slots/UserTickets';
import { UserScreen } from '@/features/admin/ui/users/UserScreen.client';

type Params = Promise<{ id: string }>;

/**
 * One customer in the console: who they are, their plan, credits, invitations, messages, payments,
 * what the team did about them, and the actions the role allows. Where Badook Events opened the
 * account from and the support tickets come from their areas.
 */
export default async function AdminUserPage({ params }: { params: Params }) {
  const { id: raw } = await params;
  const staff = await requireStaff('users.view', `/app/admin/users/${encodeURIComponent(raw)}`);
  const id = uuidOf(raw);
  if (!id) notFound();
  const user = await coreDb.user(staff.userId, id);
  if (!user) notFound();
  return (
    <UserScreen
      user={user}
      self={staff.userId === id}
      today={israelToday()}
      partner={<UserPartnerSource staff={staff} userId={id} />}
      tickets={<UserTickets staff={staff} userId={id} />}
    />
  );
}
