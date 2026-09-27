import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminUsersPage() {
  await requireStaff('users.view', '/app/admin/users');
  return <AdminAreaStub area="users" />;
}
