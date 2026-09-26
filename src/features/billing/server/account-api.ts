import 'server-only';
import type { User } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { normalizeGuestPhone } from '@/features/invitations/lib/guest-import';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { hostDb } from '@/features/invitations/server/host-db';
import { serviceDb } from '@/lib/supabase/server';
import { accountDb, loadAccount } from './account';
import { alertSupport } from './alert';
import { cancelRecurring } from './payplus';

const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

const ProfileSchema = z.strictObject({
  fullName: z.string().trim().max(120),
  phone: z.string().trim().max(40).optional().default(''),
});

/** PATCH /api/account — the name and phone on the account. */
export async function updateProfile(userId: string, raw: unknown): Promise<ApiResult> {
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const phone = parsed.data.phone ? normalizeGuestPhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return fail(400, 'invalid', { fields: ['phone'] });
  const account = await accountDb.update(userId, parsed.data.fullName, phone);
  return account
    ? ok({ ok: true, fullName: account.fullName, phone: account.phone })
    : fail(404, 'not_found');
}

/** The buckets a host uploads to, each under <user>/<invitation>/<file>: media and floor plans. */
const USER_BUCKETS = ['invitation-media', 'venue-plans'];

/** Every file under a folder of one of the host's buckets. */
async function removeFolder(bucketId: string, prefix: string, depth = 0): Promise<number> {
  const bucket = serviceDb().storage.from(bucketId);
  let removed = 0;
  for (;;) {
    const { data, error } = await bucket.list(prefix, { limit: 1000 });
    if (error || !data?.length) return removed;
    const files = data.filter((e) => e.id !== null).map((e) => `${prefix}/${e.name}`);
    const folders = data.filter((e) => e.id === null).map((e) => `${prefix}/${e.name}`);
    if (depth < 3) for (const folder of folders) removed += await removeFolder(bucketId, folder, depth + 1);
    if (!files.length) return removed;
    const { error: removeError } = await bucket.remove(files);
    if (removeError) throw new Error(`storage remove: ${removeError.message}`);
    removed += files.length;
    if (files.length < 1000) return removed;
  }
}

/**
 * POST /api/account/delete — { confirm: true }: closes the account for good. The monthly charge
 * stops, uploaded files are deleted, and deleting the user removes everything else it owns (the
 * database cascades: invitations, guests, replies, credits, payments' records keep no card data).
 * Published invitations stop answering at once. When PayPlus refuses to stop the monthly charge,
 * support is alerted to stop it by hand and the answer says so (`chargeStopped: false`) — the
 * account screen tells the host.
 */
export async function deleteAccount(user: Pick<User, 'id' | 'email'>, raw: unknown): Promise<ApiResult> {
  if (!z.strictObject({ confirm: z.literal(true) }).safeParse(raw).success) return fail(400, 'invalid');
  const account = await loadAccount(user);
  let chargeStopped = true;
  if (
    account.billingProvider === 'payplus' &&
    account.billingSubscriptionId &&
    account.planStatus !== 'canceled'
  ) {
    chargeStopped = await cancelRecurring(account.billingSubscriptionId);
    if (!chargeStopped)
      await alertSupport('Stop a monthly charge by hand (the account was deleted)', {
        userId: user.id,
        email: user.email,
        plan: account.plan,
        subscription: account.billingSubscriptionId,
      });
  }
  const invitations = (await hostDb.list(user.id)) ?? [];
  for (const bucketId of USER_BUCKETS) await removeFolder(bucketId, user.id);
  const { error } = await serviceDb().auth.admin.deleteUser(user.id);
  if (error) throw new Error(`delete user: ${error.message}`);
  for (const inv of invitations) {
    if (inv.status !== 'published') continue;
    revalidatePath(`/i/${inv.slug}`);
    for (const lang of ['he', 'en', 'default']) revalidatePath(`/i/${inv.slug}/${lang}`);
  }
  return ok({ ok: true, chargeStopped });
}
