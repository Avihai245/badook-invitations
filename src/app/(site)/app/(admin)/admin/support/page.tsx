import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminSupportPage() {
  await requireStaff('support.view', '/app/admin/support');
  return <AdminAreaStub area="support" />;
}
