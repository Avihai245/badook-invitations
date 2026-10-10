import 'server-only';
import { aiPhotosHousekeeping, aiWorkerDeps } from '@/features/ai-photos/server/deps';
import { processAiPhotos } from '@/features/ai-photos/server/worker';
import { readyDeps } from '@/features/album/server/deps';
import { processAlbumNoticeQueue } from '@/features/album/server/notify';
import { sendAlbumReadyEmails } from '@/features/album/server/ready';
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
import { scheduleRunDeps } from '@/features/scheduler/server/deps';
import { processScheduledSends } from '@/features/scheduler/server/run';
import { cloudApiConfigured } from '@/features/whatsapp/cloud-api';
import { runDueStages } from '@/features/whatsapp/hub';
import { processNotices } from '@/features/whatsapp/notices';
import { processQueue } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { dailyDue, LOCAL_EVERY_MS, WHATSAPP_EVERY_MS } from './schedule';

/**
 * The app's recurring jobs. Supabase's pg_cron calls the app's clock every minute (POST /api/cron/tick,
 * supabase/migrations/*_cron_schedule.sql), and the app runs it by itself too — on its own traffic
 * (tick) — so nothing waits on a schedule that doesn't fire. The database decides who runs a job
 * (app_job_claim): each runs once per turn.
 */

export type JobName = 'daily' | 'whatsapp' | 'local';

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
  // the AI photos' promise: erased 30 days after the event (features/ai-photos)
  const aiPhotos = await aiPhotosHousekeeping().catch(
    (err) => (console.error('ai photos housekeeping failed', err), null),
  );
  // the hosts' path through the app (features/analytics) is kept 400 days
  const { data: hostEvents, error: hostEventsError } = await serviceDb().rpc('host_events_purge');
  if (hostEventsError) console.error('host_events_purge failed', hostEventsError.message);
  return {
    ...digests,
    planning,
    aiPhotos,
    hostEvents: (hostEvents as number | null) ?? null,
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
 * The scheduled messages whose time has come (features/whatsapp/hub: each stage queues its messages
 * once), then what is still queued for WhatsApp (a host closed the page mid-send, a retry that is
 * due): the invitations, the table numbers (features/event-day), the gallery links
 * (features/live-gallery), the album's thank-yous (features/album) and the other scheduled messages
 * (features/whatsapp/notices).
 */
export async function runWhatsAppQueue(budgetMs: number) {
  const total = { sent: 0, failed: 0, retried: 0 };
  const until = Date.now() + budgetMs;
  const stages = await runDueStages().catch(
    (err) => (console.error('[jobs] whatsapp stages failed', err), null),
  );
  for (let round = 0; round < 4 && Date.now() < until; round++) {
    const r = await processQueue(null, 50);
    const t = await processNoticeQueue(null, 50);
    const g = await processGalleryNoticeQueue(null, 50);
    const a = await processAlbumNoticeQueue(null, 50);
    const n = await processNotices(null, 50);
    const results = [r, t, g, a, n];
    for (const x of results) {
      total.sent += x.sent;
      total.failed += x.failed;
      total.retried += x.retried;
    }
    if (results.every((x) => x.sent + x.failed + x.retried === 0)) break;
  }
  // messages left (or failed): the admin console's numbers and queues (it never throws)
  if (total.sent + total.failed > 0) await adminNudge('message');
  // the stages that ran this turn, when any did (the cron's answer says so)
  return stages?.ran ? { ...total, stages } : total;
}

/**
 * What happens at a local time — each event's own: the album's "it's ready" email once its morning
 * after has come there (08:00 in the event's time zone), and the RSVP summaries at 08:00 in each
 * invitation's. Looked at every few minutes, so a New York event's goes out at New York's 08:00.
 */
export async function runLocalTime(now: Date) {
  const album = await sendAlbumReadyEmails(now, readyDeps()).catch(
    (err) => (console.error('album ready emails failed', err), null),
  );
  const digests = await sendDigests(now).catch((err) => (console.error('rsvp digests failed', err), null));
  return { album, digests };
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

/**
 * One turn of the clock (pg_cron's call every minute, or the app's own on its traffic): first what
 * hosts scheduled for now — at the date and time they picked, in the time zone they picked — then the
 * WhatsApp queue every couple of minutes, the invitations read aloud, the AI photos, what happens at
 * each event's local time every few minutes, and the daily run once a day (06:00 UTC: the
 * housekeeping). Each part is guarded on its own; the turn never throws.
 */
export async function runClock(now = Date.now()) {
  const at = new Date(now);
  const scheduled = await processScheduledSends(scheduleRunDeps());
  let whatsapp: { ran: boolean } = { ran: false };
  if (cloudApiConfigured())
    whatsapp = await runJob('whatsapp', new Date(now - WHATSAPP_EVERY_MS), 120, () =>
      runWhatsAppQueue(15_000),
    ).catch((err) => (console.error('[jobs] whatsapp failed', err), { ran: false }));
  // the invitations read aloud: what publishes queued, and retries that are due (each language is
  // taken by one server: voice_claim)
  await processVoice(null, voiceDeps()).catch((err) => console.error('[jobs] voice failed', err));
  // the AI photos: those working in OpenAI's background are checked, one queued photo is started
  // (a guest's request starts its own at once; this picks up what a stopped server left)
  const env = serverEnv();
  if (env.INVITES_AI_IMAGE_API_KEY || env.OPENAI_API_KEY)
    await processAiPhotos(null, aiWorkerDeps(), { starts: 1 });
  const local = await runJob('local', new Date(now - LOCAL_EVERY_MS), 5 * 60, () => runLocalTime(at)).catch(
    (err) => (console.error('[jobs] local time failed', err), { ran: false as const }),
  );
  const daily = await runJob('daily', dailyDue(at), 15 * 60, () => runDaily(at)).catch(
    (err) => (console.error('[jobs] daily failed', err), { ran: false as const }),
  );
  return { scheduled, whatsapp: whatsapp.ran, local: local.ran, daily: daily.ran };
}

/** How often one server looks for due jobs on its own traffic. */
const TICK_EVERY_MS = 60_000;
let lastTick = 0;
let ticking: Promise<void> | null = null;

/**
 * The app's own clock, besides pg_cron's: called on its traffic (a host's page, a guest's reply,
 * WhatsApp's status notices), at most once a minute per server (runClock). Never throws. Off with
 * INVITES_JOBS_FALLBACK=off (the end-to-end tests, which drive the clock themselves).
 */
export function tick(now = Date.now()): Promise<void> {
  if (ticking || now - lastTick < TICK_EVERY_MS) return ticking ?? Promise.resolve();
  if (!serverEnv().INVITES_JOBS_FALLBACK) return Promise.resolve();
  lastTick = now;
  ticking = (async () => {
    try {
      await runClock(now);
    } catch (err) {
      console.error('[jobs] tick failed', err);
    }
  })().finally(() => {
    ticking = null;
  });
  return ticking;
}
