import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminInvitationsPage() {
  await requireStaff('invitations.view', '/app/admin/invitations');
  return <AdminAreaStub area="invitations" />;
}
