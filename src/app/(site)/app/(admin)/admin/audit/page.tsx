import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminAuditPage() {
  await requireStaff('audit.view', '/app/admin/audit');
  return <AdminAreaStub area="audit" />;
}
