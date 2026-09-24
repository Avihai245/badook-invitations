import { guestsDb } from '@/features/invitations/server/guests';
import { notifyReply } from '@/features/invitations/server/notify';
import { getPublishedInvitation } from '@/features/invitations/server/published';
import { MAX_BODY_BYTES, RATE_LIMIT, handleRsvp, type RsvpDeps } from '@/features/invitations/server/rsvp';
import { clientIp } from '@/lib/client-ip';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { serviceDb } from '@/lib/supabase/server';

const NO_STORE = { 'cache-control': 'no-store' };
/** The longest a guest waits for the host's notification email to be handed to the provider. */
const NOTIFY_WAIT_MS = 2500;

const deps = (): RsvpDeps => ({
  loadInvitation: getPublishedInvitation,
  rateHit: async (invitationId, ipHash) => {
    const { data, error } = await serviceDb().rpc('rsvp_rate_hit', {
      p_invitation_id: invitationId,
      p_ip_hash: ipHash,
      p_limit: RATE_LIMIT.count,
      p_window_seconds: RATE_LIMIT.windowSeconds,
    });
    if (error) throw new Error(`rsvp_rate_hit failed: ${error.message}`);
    return data === true;
  },
  submit: async ({ invitationId, response, attendees, existingTokenHash, newTokenHash }) => {
    const { data, error } = await serviceDb().rpc('submit_rsvp', {
      p_invitation_id: invitationId,
      p_response: response,
      p_attendees: attendees,
      p_existing_token_hash: existingTokenHash,
      p_new_token_hash: newTokenHash,
    });
    if (error || !data) throw new Error(`submit_rsvp failed: ${error?.message ?? 'no result'}`);
    return data as { id: string; replaced: boolean };
  },
  now: Date.now,
  ipHashSalt: serverEnv().INVITES_IP_HASH_SALT,
  guestId: (invitationId, token) => guestsDb.byToken(invitationId, token),
});

/** Guest RSVP (§4): validated with the shared schema + the invitation's rules; written in one transaction. */
export async function POST(request: Request) {
  if (!invitationsEnabled())
    return Response.json({ ok: false, code: 'not_found' }, { status: 404, headers: NO_STORE });
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES)
    return Response.json({ ok: false, code: 'invalid' }, { status: 413, headers: NO_STORE });
  try {
    const { status, body, saved } = await handleRsvp(await request.text(), clientIp(request), deps());
    // the host's email goes out before we answer (a serverless function may freeze right after the
    // response), but a slow or failing mail provider never holds the guest up or fails the reply
    if (saved) {
      await Promise.race([
        notifyReply(saved).catch((err: unknown) => console.error('RSVP notification failed', err)),
        new Promise((resolve) => setTimeout(resolve, NOTIFY_WAIT_MS)),
      ]);
    }
    return Response.json(body, { status, headers: NO_STORE });
  } catch (err) {
    console.error('RSVP failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}
