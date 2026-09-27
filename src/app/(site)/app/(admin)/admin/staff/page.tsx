import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminStaffPage() {
  await requireStaff('staff.view', '/app/admin/staff');
  return <AdminAreaStub area="staff" />;
}
