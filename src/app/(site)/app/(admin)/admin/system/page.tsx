import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminSystemPage() {
  await requireStaff('system.view', '/app/admin/system');
  return <AdminAreaStub area="system" />;
}
