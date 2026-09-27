import { requireStaff } from '@/features/admin/server/gate';
import { AdminAreaStub } from '@/features/admin/ui/AdminAreaStub.client';

export default async function AdminMessagesPage() {
  await requireStaff('messages.view', '/app/admin/messages');
  return <AdminAreaStub area="messages" />;
}
