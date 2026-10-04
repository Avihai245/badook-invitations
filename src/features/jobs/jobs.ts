import 'server-only';
import { reportOverdue } from '@/features/billing/server/billing';
import { consoleLogsHousekeeping } from '@/features/admin/messages/server';
import { adminDb } from '@/features/admin/server/db';
import { adminNudge } from '@/features/admin/server/live';
import { eventDayHousekeeping } from '@/features/event-day/server/housekeeping';
import { processNoticeQueue } from '@/features/event-day/server/notify';
import { facesHousekeeping } from '@/features/faces/server/deps';
import { insightsHousekeeping } from '@/features/insights/server/deps';
import { sendPlanReminders } from '@/features/planning/server/reminders';
import { sendDigests } from '@/features/invitations/server/notify';
import { syncSeedOnce } from '@/features/invitations/server/seed-sync';
import { translationHousekeeping } from '@/features/invitations/translate/deps';
import { processGalleryNoticeQueue } from '@/features/live-gallery/server/notify';
import { galleryHousekeeping } from '@/features/live-gallery/server/sweep';
import { studioHousekeeping } from '@/features/review/server/housekeeping';
import { supportHousekeeping } from '@/features/support/tickets/server/housekeeping';
import { voiceDeps } from '@/features/voice/server/deps';
import { processVoice } from '@/features/voice/server/voice';
import { cloudApiConfigured } from '@/features/whatsapp/cloud-api';
import { processQueue } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { dailyDue, WHATSAPP_EVERY_MS } from './schedule';

/**
 * The app's recurring jobs. A scheduler may call them (/api/cron/*, .github/workflows), and the app
 * runs them by itself too — on its own traffic (tick) — so nothing waits on a schedule that isn't set
 * up or doesn't fire. The database decides who runs a job (app_job_claim): each runs once per turn.
 */

export type JobName = 'daily' | 'whatsapp';

/**
 * The daily run: the hosts' RSVP summaries, the purge, the billing checks, the templates sync, the
 * live gallery's housekeeping, the event day's (arrivals past their keeping time), the machine
 * translation's (its run records) and the studio's (old saves of drafts, review comments past their
 * time, the review summaries).
 */
export async function runDaily(now: Date) {
  const digests = await sendDigests(now);
  // what the privacy policy promises about keeping data
  const { data: purged, error } = await serviceDb().rpc('purge_expired');
  if (error) console.error('purge_expired failed', error.message);
  // purchases whose notice never came; paid plans whose monthly renewal never arrived
  const overdue = await reportOverdue().catch((err) => (console.error('billing_overdue failed', err), null));
  // the templates and demos match this deployment (a no-op when they do)
  const seed = await syncSeedOnce('daily');
  // the live gallery's promises: deleted items' files leave storage, unfinished uploads and old rows go
  const gallery = await galleryHousekeeping().catch(
    (err) => (console.error('gallery housekeeping failed', err), null),
  );
  // the event day's: arrivals erased 30 days after the event
  const eventDay = await eventDayHousekeeping().catch(
    (err) => (console.error('event day housekeeping failed', err), null),
  );
  // the machine translation's: its run records (for the daily limit) erased after two days
  const translations = await translationHousekeeping().catch(
    (err) => (console.error('translation housekeeping failed', err), null),
  );
  // the studio's: the draft's old saves, review comments past their time, the review summaries
  const studio = await studioHousekeeping().catch(
    (err) => (console.error('studio housekeeping failed', err), null),
  );
  // the insights' page loads go after a week (the daily numbers stay with the invitation)
  const insights = await insightsHousekeeping().catch(
    (err) => (console.error('insights housekeeping failed', err), null),
  );
  // face search's promise: its data erased 30 days after the event, and wherever the feature is off
  const faces = await facesHousekeeping().catch(
    (err) => (console.error('face search housekeeping failed', err), null),
  );
  // the partner API's calls and the log of emails are kept 90 days
  const logs = await consoleLogsHousekeeping();
  // the admin console's record of actions is kept two years
  const admin = await adminDb
    .maintenance()
    .catch((err) => (console.error('admin console housekeeping failed', err), null));
  // support tickets: answered and left for 14 days close; closed ones go two years after closing
  const support = await supportHousekeeping().catch(
    (err) => (console.error('support tickets housekeeping failed', err), null),
  );
  // the weekly planning email: the week's tasks and payments (a no-op while planning is not offered)
  const planning = await sendPlanReminders(now).catch(
    (err) => (console.error('planning reminders failed', err), null),
  );
  return {
    ...digests,
    planning,
    purged: (purged as number | null) ?? null,
    overdue,
    seed,
    gallery,
    eventDay,
    translations,
    studio,
    insights,
    faces,
    logs,
    admin,
    support,
  };
}

/**
 * What is still queued for WhatsApp (a host closed the page mid-send, a retry that is due): the
 * invitations, the table numbers (features/event-day) and the gallery links (features/live-gallery).
 */
export async function runWhatsAppQueue(budgetMs: number) {
  const total = { sent: 0, failed: 0, retried: 0 };
  const until = Date.now() + budgetMs;
  for (let round = 0; round < 4 && Date.now() < until; round++) {
    const r = await processQueue(null, 50);
    const t = await processNoticeQueue(null, 50);
    const g = await processGalleryNoticeQueue(null, 50);
    total.sent += r.sent + t.sent + g.sent;
    total.failed += r.failed + t.failed + g.failed;
    total.retried += r.retried + t.retried + g.retried;
    if (r.sent + r.failed + r.retried + t.sent + t.failed + t.retried + g.sent + g.failed + g.retried === 0)
      break;
  }
  // messages left (or failed): the admin console's numbers and queues (it never throws)
  if (total.sent + total.failed > 0) await adminNudge('message');
  return total;
}

/** Records that `name` has just run (the app's own turn, or a scheduler's call): not due again until its next turn. */
export async function jobDone(name: JobName): Promise<void> {
  const { error } = await serviceDb().rpc('app_job_done', { p_name: name });
  if (error) console.error(`[jobs] ${name}: done failed`, error.message);
}

/**
 * Runs `job` when it is due — it last finished before `due` — and nobody else is running it (a run
 * that died is taken again after `leaseSeconds`). A job that throws stays due.
 */
export async function runJob<T>(
  name: JobName,
  due: Date,
  leaseSeconds: number,
  job: () => Promise<T>,
): Promise<{ ran: false } | { ran: true; result: T }> {
  const { data: mine, error } = await serviceDb().rpc('app_job_claim', {
    p_name: name,
    p_due: due.toISOString(),
    p_lease_seconds: leaseSeconds,
  });
  if (error) {
    console.error(`[jobs] ${name}: claim failed`, error.message);
    return { ran: false };
  }
  if (mine !== true) return { ran: false };
  const result = await job();
  await jobDone(name);
  return { ran: true, result };
}

/** How often one server looks for due jobs on its own traffic. */
const TICK_EVERY_MS = 60_000;
let lastTick = 0;
let ticking: Promise<void> | null = null;

/**
 * The app's own clock: called on its traffic (a host's page, a guest's reply, WhatsApp's status
 * notices), at most once a minute per server; runs the WhatsApp queue every couple of minutes and
 * the daily run once a day (06:00 UTC, like the workflow). Never throws. Off with
 * INVITES_JOBS_FALLBACK=off (the end-to-end tests, which drive the queue themselves).
 */
export function tick(now = Date.now()): Promise<void> {
  if (ticking || now - lastTick < TICK_EVERY_MS) return ticking ?? Promise.resolve();
  if (!serverEnv().INVITES_JOBS_FALLBACK) return Promise.resolve();
  lastTick = now;
  ticking = (async () => {
    try {
      if (cloudApiConfigured())
        await runJob('whatsapp', new Date(now - WHATSAPP_EVERY_MS), 120, () => runWhatsAppQueue(15_000));
      // the invitations read aloud: what publishes queued, and retries that are due (each language is
      // taken by one server: voice_claim)
      await processVoice(null, voiceDeps()).catch((err) => console.error('[jobs] voice failed', err));
      await runJob('daily', dailyDue(new Date(now)), 15 * 60, () => runDaily(new Date(now)));
    } catch (err) {
      console.error('[jobs] tick failed', err);
    }
  })().finally(() => {
    ticking = null;
  });
  return ticking;
}
