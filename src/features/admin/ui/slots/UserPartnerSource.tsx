import type { Staff } from '@/features/admin/server/gate';

/**
 * On a user's page in the console: where the account came from when Badook Events opened it — the
 * Badook Events user who opened it, when, and the venue (features/partner). Nothing for other accounts.
 */
export async function UserPartnerSource({ staff, userId }: { staff: Staff; userId: string }) {
  void staff;
  void userId;
  return null;
}
