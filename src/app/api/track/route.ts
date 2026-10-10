import { recordHostEvent } from '@/features/analytics/model';
import { ownerInvitation } from '@/features/invitations/app/workspace/data';
import { invitationsEnabled } from '@/lib/feature';
import { getSessionUser } from '@/lib/supabase/session';
import { serviceDb } from '@/lib/supabase/server';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
const MAX_BYTES = 4 * 1024;

/**
 * POST /api/track — one step of a signed-in host's path through the app (features/analytics): JSON, a
 * few hundred bytes. 204 whether kept or quietly dropped (Global Privacy Control, Do Not Track, another
 * host's event), so the page never retries; a failure to keep it is logged, never the host's problem.
 */
export async function POST(request: Request) {
  if (!invitationsEnabled()) return new Response(null, { status: 404, headers: HEADERS });
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
    return new Response(null, { status: 415, headers: HEADERS });
  const text = await request.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413, headers: HEADERS });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400, headers: HEADERS });
  }
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401, headers: HEADERS });
  try {
    const result = await recordHostEvent(
      user.id,
      body,
      { gpc: request.headers.get('sec-gpc') === '1', dnt: request.headers.get('dnt') === '1' },
      {
        owns: async (userId, id) => !!(await ownerInvitation(userId, id).catch(() => null)),
        insert: async (row) => {
          const { error } = await serviceDb().rpc('host_event_add', {
            p_user: row.user_id,
            p_invitation: row.invitation_id,
            p_name: row.name,
            p_props: row.props,
          });
          if (error) throw new Error(`host_event_add: ${error.message}`);
        },
      },
    );
    return new Response(null, { status: result.status, headers: HEADERS });
  } catch (err) {
    console.error('[track]', err);
    return new Response(null, { status: 204, headers: HEADERS });
  }
}
