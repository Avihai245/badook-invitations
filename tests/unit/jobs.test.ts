import { beforeEach, describe, expect, it, vi } from 'vitest';

// The app's recurring jobs (features/jobs): when the daily run is due, the database deciding who runs
// a job, and the app's own clock on its traffic.

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({ rpc }) }));
const env = { INVITES_JOBS_FALLBACK: true };
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
const sendDigests = vi.fn(async () => ({ sent: 2, failed: 0 }));
vi.mock('@/features/invitations/server/notify', () => ({ sendDigests }));
const reportOverdue = vi.fn(async () => 0);
vi.mock('@/features/billing/server/billing', () => ({ reportOverdue }));
const syncSeedOnce = vi.fn(async () => 'current');
vi.mock('@/features/invitations/server/seed-sync', () => ({ syncSeedOnce }));
let configured = true;
vi.mock('@/features/whatsapp/cloud-api', () => ({ cloudApiConfigured: () => configured }));
const processQueue = vi.fn(async () => ({ sent: 0, failed: 0, retried: 0 }));
vi.mock('@/features/whatsapp/sender', () => ({ processQueue }));
// the table numbers' messages and the arrivals' keeping time (features/event-day)
const processNoticeQueue = vi.fn(async () => ({ sent: 0, failed: 0, retried: 0 }));
vi.mock('@/features/event-day/server/notify', () => ({ processNoticeQueue }));
const eventDayHousekeeping = vi.fn(async () => ({ checkins: 0, undone: 0 }));
vi.mock('@/features/event-day/server/housekeeping', () => ({ eventDayHousekeeping }));

const { dailyDue } = await import('@/features/jobs/schedule');
const { runJob, runWhatsAppQueue, tick } = await import('@/features/jobs/jobs');

/** rpc answers: app_job_claim → `claims` (in order), purge_expired → a count, the rest → null. */
function database(claims: boolean[]) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'app_job_claim') return { data: claims.shift() ?? false, error: null };
    if (fn === 'purge_expired') return { data: { rsvpRate: 0 }, error: null };
    return { data: null, error: null };
  });
}
const called = (fn: string) => rpc.mock.calls.filter(([name]) => name === fn);

beforeEach(() => {
  rpc.mockReset();
  processQueue.mockClear();
  sendDigests.mockClear();
  env.INVITES_JOBS_FALLBACK = true;
  configured = true;
});

describe('the daily run’s turn', () => {
  it('is today at 06:00 UTC once that has come, else yesterday’s', () => {
    expect(dailyDue(new Date('2026-09-24T05:59:59Z')).toISOString()).toBe('2026-09-23T06:00:00.000Z');
    expect(dailyDue(new Date('2026-09-24T06:00:00Z')).toISOString()).toBe('2026-09-24T06:00:00.000Z');
    expect(dailyDue(new Date('2026-09-24T23:30:00Z')).toISOString()).toBe('2026-09-24T06:00:00.000Z');
    // across a month and a year
    expect(dailyDue(new Date('2027-01-01T01:00:00Z')).toISOString()).toBe('2026-12-31T06:00:00.000Z');
  });
});

describe('runJob', () => {
  it('runs only when the database gives it the job, then records it as done', async () => {
    database([false, true]);
    const job = vi.fn(async () => 'result');
    const due = new Date('2026-09-24T06:00:00Z');
    expect(await runJob('daily', due, 900, job)).toEqual({ ran: false });
    expect(job).not.toHaveBeenCalled();
    expect(await runJob('daily', due, 900, job)).toEqual({ ran: true, result: 'result' });
    expect(called('app_job_claim').at(-1)?.[1]).toEqual({
      p_name: 'daily',
      p_due: '2026-09-24T06:00:00.000Z',
      p_lease_seconds: 900,
    });
    expect(called('app_job_done')).toEqual([['app_job_done', { p_name: 'daily' }]]);
  });

  it('a job that fails stays due; a claim the database refuses runs nothing', async () => {
    database([true]);
    await expect(
      runJob('daily', new Date(), 900, async () => {
        throw new Error('mail server down');
      }),
    ).rejects.toThrow('mail server down');
    expect(called('app_job_done')).toEqual([]);
    rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    const job = vi.fn();
    expect(await runJob('whatsapp', new Date(), 120, job)).toEqual({ ran: false });
    expect(job).not.toHaveBeenCalled();
  });
});

describe('the WhatsApp queue', () => {
  it('sends in rounds until the queue is empty', async () => {
    processQueue
      .mockResolvedValueOnce({ sent: 50, failed: 0, retried: 0 })
      .mockResolvedValueOnce({ sent: 3, failed: 1, retried: 1 })
      .mockResolvedValueOnce({ sent: 0, failed: 0, retried: 0 });
    expect(await runWhatsAppQueue(60_000)).toEqual({ sent: 53, failed: 1, retried: 1 });
    expect(processQueue).toHaveBeenCalledTimes(3);
    expect(processQueue).toHaveBeenCalledWith(null, 50);
  });

  it('sends the table numbers’ messages in the same rounds', async () => {
    processQueue.mockClear();
    processNoticeQueue.mockClear();
    processNoticeQueue
      .mockResolvedValueOnce({ sent: 4, failed: 0, retried: 1 })
      .mockResolvedValueOnce({ sent: 0, failed: 0, retried: 0 });
    expect(await runWhatsAppQueue(60_000)).toEqual({ sent: 4, failed: 0, retried: 1 });
    expect(processNoticeQueue).toHaveBeenCalledTimes(2);
    expect(processNoticeQueue).toHaveBeenCalledWith(null, 50);
  });
});

describe('the app’s own clock (tick)', () => {
  // each test moves the clock well past the once-a-minute limit of the one before
  let now = Date.parse('2026-09-24T08:00:00Z');
  const later = () => (now += 10 * 60_000);

  it('runs the WhatsApp queue and the daily run when they are due', async () => {
    database([true, true]);
    await tick(later());
    expect(called('app_job_claim').map(([, a]) => (a as { p_name: string }).p_name)).toEqual([
      'whatsapp',
      'daily',
    ]);
    expect(processQueue).toHaveBeenCalled();
    expect(sendDigests).toHaveBeenCalled();
    // the daily run keeps the privacy policy's promise about arrivals too
    expect(eventDayHousekeeping).toHaveBeenCalled();
    expect(called('app_job_done')).toHaveLength(2);
  });

  it('looks at most once a minute per server', async () => {
    database([false, false]);
    const t = later();
    await tick(t);
    await tick(t + 30_000);
    expect(called('app_job_claim')).toHaveLength(2);
    await tick(t + 61_000);
    expect(called('app_job_claim')).toHaveLength(2 + 2);
  });

  it('without WhatsApp set up: only the daily run; switched off: nothing', async () => {
    configured = false;
    database([false]);
    await tick(later());
    expect(called('app_job_claim').map(([, a]) => (a as { p_name: string }).p_name)).toEqual(['daily']);
    rpc.mockReset();
    env.INVITES_JOBS_FALLBACK = false;
    await tick(later());
    expect(rpc).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    rpc.mockRejectedValue(new Error('network'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(tick(later())).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
