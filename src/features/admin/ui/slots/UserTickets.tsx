import type { Staff } from '@/features/admin/server/gate';

/** On a user's page in the console: their support tickets (for roles with support.view). */
export async function UserTickets({ staff, userId }: { staff: Staff; userId: string }) {
  void staff;
  void userId;
  return null;
}
