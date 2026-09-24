import 'server-only';
import { reportOverdue } from '@/features/billing/server/billing';
import { sendDigests } from '@/features/invitations/server/notify';
import { syncSeedOnce } from '@/features/invitations/server/seed-sync';
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

/** The daily run: the hosts' RSVP summaries, the purge, the billing checks and the templates sync. */
export async function runDaily(now: Date) {
  const digests = await sendDigests(now);
  // what the privacy policy promises about keeping data
  const { data: purged, error } = await serviceDb().rpc('purge_expired');
  if (error) console.error('purge_expired failed', error.message);
  // purchases whose notice never came; paid plans whose monthly renewal never arrived
  const overdue = await reportOverdue().catch((err) => (console.error('billing_overdue failed', err), null));
  // the templates and demos match this deployment (a no-op when they do)
  const seed = await syncSeedOnce('daily');
  return { ...digests, purged: (purged as number | null) ?? null, overdue, seed };
}

/** What is still queued for WhatsApp (a host closed the page mid-send, a retry that is due). */
export async function runWhatsAppQueue(budgetMs: number) {
  const total = { sent: 0, failed: 0, retried: 0 };
  const until = Date.now() + budgetMs;
  for (let round = 0; round < 4 && Date.now() < until; round++) {
    const r = await processQueue(null, 50);
    total.sent += r.sent;
    total.failed += r.failed;
    total.retried += r.retried;
    if (r.sent + r.failed + r.retried === 0) break;
  }
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
      await runJob('daily', dailyDue(new Date(now)), 15 * 60, () => runDaily(new Date(now)));
    } catch (err) {
      console.error('[jobs] tick failed', err);
    }
  })().finally(() => {
    ticking = null;
  });
  return ticking;
}
