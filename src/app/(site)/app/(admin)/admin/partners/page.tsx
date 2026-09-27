import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminPartnersPage() {
  await requireStaff('partners.view', '/app/admin/partners');
  return <AdminAreaStub area="partners" />;
}
