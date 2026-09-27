import { loadMessages } from '@/features/admin/messages/server';
import { MessagesScreen } from '@/features/admin/messages/ui/MessagesScreen.client';
import { requireStaff } from '@/features/admin/server/gate';

/**
 * The console's messages area (messages.view): WhatsApp's three kinds and the emails over the last 30
 * days, the queues now and the failures. Rendered again when it refreshes.
 */
export default async function AdminMessagesPage() {
  const staff = await requireStaff('messages.view', '/app/admin/messages');
  return <MessagesScreen data={await loadMessages(staff)} />;
}
