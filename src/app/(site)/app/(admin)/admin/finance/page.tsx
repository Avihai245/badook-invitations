import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminFinancePage() {
  await requireStaff('finance.view', '/app/admin/finance');
  return <AdminAreaStub area="finance" />;
}
