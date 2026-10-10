import { runClock } from '@/features/jobs/jobs';
import { cronAuthorized } from '@/features/scheduler/server/cron-auth';
import { invitationsEnabled } from '@/lib/feature';

const NO_STORE = { 'cache-control': 'no-store' };

// the daily run can take a while (Amplify still ends a request at its own limit; what didn't finish is
// due again on the next minute)
export const maxDuration = 300;

/**
 * POST /api/cron/tick with `Authorization: Bearer <INVITES_CRON_SECRET>` — one turn of the app's clock
 * (features/jobs runClock), called every minute by Supabase's pg_cron
 * (supabase/migrations/*_cron_schedule.sql): what hosts scheduled for now (their date and time, in
 * their time zone), the WhatsApp queue, what happens at each event's local time, the daily run. Every
 * part is safe to run twice. Off (404) without a secret.
 */
export async function POST(request: Request) {
  if (!invitationsEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const authorized = await cronAuthorized(request.headers.get('authorization'));
  if (authorized === null) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!authorized) return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  try {
    const result = await runClock();
    return Response.json(result, { headers: NO_STORE });
  } catch (err) {
    console.error('The clock failed', err);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
}
