import 'server-only';
import { z } from 'zod';
import { accountDb, loadAccount } from '@/features/billing/server/account';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { hostDb, isUuid } from '@/features/invitations/server/host-db';
import { serverEnv } from '@/lib/env';
import { getSessionUser } from '@/lib/supabase/session';
import { cloudApiConfigured } from './cloud-api';
import { processQueue, whatsappDb } from './sender';

const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

const SendSchema = z.strictObject({
  guestIds: z.array(z.string().refine(isUuid)).min(1).max(5000),
  /** the host confirmed their guests expect this invitation (WhatsApp opt-in policy) */
  consent: z.literal(true),
});

/** Messages sent right away in the request; the page asks for the rest batch by batch. */
const FIRST_BATCH = 25;

/**
 * POST /api/invitations/:id/whatsapp — queue the invitation for the chosen guests (one credit each),
 * then send a first batch. The platform's admins never run out of credits (they pay Meta directly).
 */
export async function sendInvitations(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = SendSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  if (!cloudApiConfigured()) return fail(503, 'not_configured');
  const inv = await hostDb.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  if (inv.status !== 'published') return fail(409, 'not_published');
  const user = await getSessionUser();
  const account = await loadAccount({ id: userId, email: user?.id === userId ? user.email : undefined });
  const needed = parsed.data.guestIds.length;
  if (account.admin && account.credits < needed)
    await accountDb.creditsAdd(userId, needed - account.credits, 'admin', `whatsapp:${id}`);
  const queued = await whatsappDb.queue(
    id,
    userId,
    parsed.data.guestIds,
    serverEnv().INVITES_WHATSAPP_PRICE_USD,
  );
  if (!queued) return fail(409, 'not_published');
  if (!queued.ok)
    return queued.code === 'credits'
      ? fail(402, 'credits', { needed: queued.needed, balance: queued.balance })
      : fail(422, 'nobody');
  const first = await processQueue(id, FIRST_BATCH);
  return ok({
    ok: true,
    queued: queued.queued,
    balance: queued.balance,
    ...first,
    pending: await whatsappDb.pending(id),
  });
}

/** POST /api/invitations/:id/whatsapp/process — the next batch of this invitation's queue. */
export async function continueSending(userId: string, id: string): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const inv = await hostDb.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  if (!cloudApiConfigured()) return fail(503, 'not_configured');
  const result = await processQueue(id, FIRST_BATCH);
  return ok({ ok: true, ...result, pending: await whatsappDb.pending(id) });
}
