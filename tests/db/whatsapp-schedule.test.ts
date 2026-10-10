import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The scheduled WhatsApp messages (supabase/migrations/*_whatsapp_schedule.sql): the audiences as the
// RSVP has them at the moment, saving a sequence (stages that ran stay as they were), a stage run once
// through the queue of its template (the invitation's, the album's, the notices'), credits charged
// only for what is queued and nothing when they don't suffice, the album's fallback, a late stage
// missed, a follow-up skipped (and refunded) when its guest answered before it went out, the notices'
// webhook statuses; owner checks everywhere, and nothing for anyone but the service role.

const OWNER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';
const PRICE = 0.0353;
const APPROVED = ['invitation', 'reminder', 'event_reminder', 'thanks', 'album'];

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;
const guest: Record<string, string> = {};

async function call<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const credits = async () =>
  (await c.query(`select message_credits from accounts where user_id = $1`, [OWNER])).rows[0]
    .message_credits as number;
const setCredits = (n: number) =>
  c.query(`update accounts set message_credits = $2 where user_id = $1`, [OWNER, n]);

async function answer(name: string, attending: boolean) {
  await c.query(
    `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, edit_token_hash, guest_id)
     values ($1, $2, 'he', $3, 1, md5(random()::text), $4)`,
    [inv, attending, name, guest[name]],
  );
}

const stage = (key: string, kind: string, message: string, audience: string, sendAt: string, extra = {}) => ({
  key,
  kind,
  message,
  audience,
  sendAt,
  enabled: true,
  ...extra,
});
const past = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'wa-owner@example.com'), ($2, 'wa-other@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await call<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'wa-sched', doc])
  ).id;
  await c.query(
    `update invitations set status = 'published', published_at = now(), published = draft where id = $1`,
    [inv],
  );
  await call('account_get', [OWNER]);
  const rows = [
    { name: 'דנה', phone: '+972501111111', token: 'tokenDanaDanaDana01' },
    { name: 'יוסי', phone: '+972502222222', token: 'tokenYosiYosiYosi01' },
    { name: 'רותי', phone: '+972503333333', token: 'tokenRutiRutiRuti01' },
    { name: 'קווי', phone: '+97231234567', token: 'tokenLandLandLand01' },
    { name: 'בלי', phone: null, token: 'tokenNoneNoneNone01' },
  ].map((r) => ({ ...r, email: null, partySize: 2, group: null }));
  await call('import_guests', [inv, OWNER, JSON.stringify(rows), 100]);
  for (const g of (await c.query(`select id, name from invitation_guests where invitation_id = $1`, [inv]))
    .rows)
    guest[g.name] = g.id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

beforeEach(async () => {
  await c.query(`delete from whatsapp_schedules where invitation_id = $1`, [inv]);
  await c.query(`delete from whatsapp_notices where invitation_id = $1`, [inv]);
  await c.query(`delete from whatsapp_messages where invitation_id = $1`, [inv]);
  await c.query(`delete from rsvp_responses where invitation_id = $1`, [inv]);
  await c.query(
    `update invitation_guests set send_status = 'none', send_channel = null, sent_at = null, opened_at = null where invitation_id = $1`,
    [inv],
  );
  await setCredits(100);
});

describe('audiences', () => {
  it('follow the RSVP as it is now', async () => {
    const of = async (a: string) =>
      ((await call<string[]>('whatsapp_audience', [inv, a])) ?? []).map((id) =>
        Object.keys(guest).find((n) => guest[n] === id),
      );
    expect(await of('not_received')).toHaveLength(5);
    expect(await of('unanswered')).toEqual([]);
    await c.query(`update invitation_guests set send_status = 'delivered' where id = any($1)`, [
      [guest['דנה'], guest['יוסי'], guest['רותי']],
    ]);
    await answer('יוסי', true);
    await answer('רותי', false);
    expect(await of('unanswered')).toEqual(['דנה']);
    expect(await of('attending')).toEqual(['יוסי']);
    expect(await of('declined')).toEqual(['רותי']);
    expect((await of('not_received')).sort()).toEqual(['בלי', 'קווי'].sort());
    expect(await of('arrived')).toEqual([]);
    expect(await of('all')).toHaveLength(5);
  });
});

describe('saving a sequence', () => {
  it('is the owner’s only, and keeps stages that already ran', async () => {
    const stages = [
      stage('invitation', 'invitation', 'invitation', 'not_received', future(1)),
      stage('event_reminder', 'event_reminder', 'event_reminder', 'attending', future(10)),
    ];
    expect(
      await call('whatsapp_schedule_save', [inv, OTHER, 'basic', 'draft', JSON.stringify(stages), false]),
    ).toBeNull();
    const saved = await call<{ schedule: { preset: string; status: string }; stages: { key: string }[] }>(
      'whatsapp_schedule_save',
      [inv, OWNER, 'basic', 'draft', JSON.stringify(stages), false],
    );
    expect(saved.schedule).toMatchObject({ preset: 'basic', status: 'draft' });
    expect(saved.stages.map((s) => s.key)).toEqual(['invitation', 'event_reminder']);
    // the invitation stage ran
    await c.query(
      `update whatsapp_stages set status = 'done', send_at = now() - interval '1 hour' where key = 'invitation'`,
    );
    const again = await call<{
      stages: { key: string; status: string; sendAt: string }[];
      schedule: { status: string; consentAt: string | null };
    }>('whatsapp_schedule_save', [
      inv,
      OWNER,
      'advanced',
      'active',
      JSON.stringify([
        stage('invitation', 'invitation', 'invitation', 'not_received', future(5)),
        stage('followup1', 'followup', 'reminder', 'unanswered', future(3)),
      ]),
      true,
    ]);
    expect(again.schedule.status).toBe('active');
    expect(again.schedule.consentAt).not.toBeNull();
    // the stage that ran kept its time; the one missing from the sequence (never ran) went
    const byKey = Object.fromEntries(again.stages.map((s) => [s.key, s]));
    expect(byKey.invitation!.status).toBe('done');
    expect(Date.parse(byKey.invitation!.sendAt)).toBeLessThan(Date.now());
    expect(byKey.event_reminder).toBeUndefined();
    expect(byKey.followup1!.status).toBe('scheduled');
  });

  it('a canceled sequence cancels what is left of it', async () => {
    await call('whatsapp_schedule_save', [
      inv,
      OWNER,
      'basic',
      'active',
      JSON.stringify([stage('invitation', 'invitation', 'invitation', 'not_received', future(1))]),
      true,
    ]);
    const s = await call<{ stages: { status: string }[] }>('whatsapp_schedule_save', [
      inv,
      OWNER,
      'basic',
      'canceled',
      null,
      false,
    ]);
    expect(s.stages[0]!.status).toBe('canceled');
  });
});

async function activeWith(...stages: ReturnType<typeof stage>[]) {
  const s = await call<{ stages: { id: string; key: string }[] }>('whatsapp_schedule_save', [
    inv,
    OWNER,
    'smart',
    'active',
    JSON.stringify(stages),
    true,
  ]);
  return Object.fromEntries(s.stages.map((x) => [x.key, x.id]));
}
const run = (id: string, approved = APPROVED, album = true, unlimited = false, planOk = true) =>
  call<{ status: string; outcome: Record<string, unknown> } | null>('whatsapp_stage_run', [
    id,
    approved,
    album,
    PRICE,
    unlimited,
    planOk,
  ]);

describe('running a stage', () => {
  it('queues the invitation once, through its own queue, and only when due and active', async () => {
    const ids = await activeWith(stage('invitation', 'invitation', 'invitation', 'not_received', past(1)));
    const due = await call<{ id: string; audienceSize: number }[]>('whatsapp_stages_due', [10]);
    expect(due.map((d) => d.id)).toContain(ids.invitation);
    const r = await run(ids.invitation!);
    // three mobiles; the landline and the guest without a phone are never charged
    expect(r).toMatchObject({ status: 'done', outcome: { ok: true, queued: 3 } });
    expect(await credits()).toBe(97);
    const tagged = await c.query(`select count(*)::int as n from whatsapp_messages where stage_id = $1`, [
      ids.invitation,
    ]);
    expect(tagged.rows[0].n).toBe(3);
    // once
    expect(await run(ids.invitation!)).toBeNull();
    expect(await credits()).toBe(97);
  });

  it('never runs a stage of a paused sequence, or one that is not due', async () => {
    const ids = await activeWith(
      stage('invitation', 'invitation', 'invitation', 'not_received', past(1)),
      stage('followup1', 'followup', 'reminder', 'unanswered', future(2)),
    );
    expect(await run(ids.followup1!)).toBeNull();
    await call('whatsapp_schedule_save', [inv, OWNER, 'smart', 'paused', null, false]);
    expect(await run(ids.invitation!)).toBeNull();
    expect(await call<unknown[]>('whatsapp_stages_due', [10])).toEqual([]);
  });

  it('charges nothing when the credits don’t suffice, and says so', async () => {
    await setCredits(1);
    const ids = await activeWith(stage('invitation', 'invitation', 'invitation', 'not_received', past(1)));
    expect(await run(ids.invitation!)).toMatchObject({
      status: 'failed',
      outcome: { ok: false, code: 'credits', needed: 3, balance: 1 },
    });
    expect(await credits()).toBe(1);
  });

  it('tops up an admin’s credits', async () => {
    await setCredits(0);
    const ids = await activeWith(stage('invitation', 'invitation', 'invitation', 'not_received', past(1)));
    expect(await run(ids.invitation!, APPROVED, true, true)).toMatchObject({ status: 'done' });
  });

  it('is missed when more than 12 hours late, and fails without an approved template or the plan', async () => {
    const ids = await activeWith(
      stage('invitation', 'invitation', 'invitation', 'not_received', past(13 * 60)),
      stage('followup1', 'followup', 'reminder', 'unanswered', past(2)),
      stage('custom1', 'custom', 'event_reminder', 'all', past(2)),
    );
    expect(await run(ids.invitation!)).toMatchObject({ status: 'missed', outcome: { code: 'late' } });
    expect(await run(ids.followup1!, ['invitation'])).toMatchObject({
      status: 'failed',
      outcome: { code: 'template' },
    });
    expect(await run(ids.custom1!, APPROVED, true, false, false)).toMatchObject({
      status: 'failed',
      outcome: { code: 'plan' },
    });
    expect(await credits()).toBe(100);
  });

  it('sends a follow-up only to who hasn’t answered — checked again right before it goes out', async () => {
    await c.query(`update invitation_guests set send_status = 'delivered' where id = any($1)`, [
      [guest['דנה'], guest['יוסי'], guest['רותי']],
    ]);
    await answer('רותי', false);
    const ids = await activeWith(stage('followup1', 'followup', 'reminder', 'unanswered', past(1)));
    expect(await run(ids.followup1!)).toMatchObject({ status: 'done', outcome: { queued: 2 } });
    expect(await credits()).toBe(98);
    // יוסי answers before the queue gets to him
    await answer('יוסי', true);
    const claimed = await call<{ guestName: string; template: string }[]>('whatsapp_notice_claim', [inv, 10]);
    expect(claimed.map((m) => m.guestName)).toEqual(['דנה']);
    expect(claimed[0]!.template).toBe('reminder');
    expect(await credits()).toBe(99);
    const skipped = await c.query(`select status from whatsapp_notices where guest_id = $1`, [guest['יוסי']]);
    expect(skipped.rows[0].status).toBe('skipped');
  });

  it('falls back from the album to the plain thank-you, or fails when there is none', async () => {
    await answer('דנה', true);
    const ids = await activeWith(stage('thanks', 'thanks', 'album', 'attending', past(1)));
    expect(await run(ids.thanks!, APPROVED, false)).toMatchObject({
      status: 'done',
      outcome: { ok: true, queued: 1, fallback: 'thanks' },
    });
    const n = await c.query(`select template from whatsapp_notices where stage_id = $1`, [ids.thanks]);
    expect(n.rows[0].template).toBe('thanks');
    const again = await activeWith(stage('thanks2', 'custom', 'album', 'attending', past(1)));
    expect(await run(again.thanks2!, ['invitation', 'album'], false)).toMatchObject({
      status: 'failed',
      outcome: { code: 'no_album' },
    });
  });

  it('is done with nobody to send to', async () => {
    const ids = await activeWith(
      stage('event_reminder', 'event_reminder', 'event_reminder', 'attending', past(1)),
    );
    expect(await run(ids.event_reminder!)).toMatchObject({ status: 'done', outcome: { code: 'nobody' } });
  });
});

describe('the notices’ queue', () => {
  it('refunds a failure once, follows the webhook, and counts what is pending', async () => {
    await answer('דנה', true);
    const q = await call<{ ok: boolean; queued: number }>('whatsapp_notice_queue', [
      inv,
      OWNER,
      [guest['דנה'], guest['קווי'], guest['בלי']],
      PRICE,
      'event_reminder',
      'attending',
      null,
    ]);
    expect(q).toMatchObject({ ok: true, queued: 1, skipped: { landline: 1, noPhone: 1 } });
    expect(await call('whatsapp_notice_pending', [inv])).toBe(1);
    // the same again while it waits: already queued
    expect(
      await call('whatsapp_notice_queue', [inv, OWNER, [guest['דנה']], PRICE, 'event_reminder', null, null]),
    ).toMatchObject({ ok: false, code: 'nobody', skipped: { queued: 1 } });
    const [m] = await call<{ id: string }[]>('whatsapp_notice_claim', [inv, 5]);
    await call('whatsapp_notice_result', [m!.id, 'wamid.notice1', null]);
    expect(await call('whatsapp_notice_status', ['wamid.notice1', 'delivered', null])).toBe(true);
    expect(await call('whatsapp_notice_status', ['wamid.notice1', 'sent', null])).toBe(false);
    // delivered, then failed: Meta charged it — no refund
    const before = await credits();
    expect(await call('whatsapp_notice_status', ['wamid.notice1', 'failed', '131000 · x'])).toBe(true);
    expect(await credits()).toBe(before);
    expect(await call('whatsapp_notice_status', ['wamid.unknown', 'read', null])).toBe(false);
  });

  it('refuses another owner, and an unknown template', async () => {
    expect(
      await call('whatsapp_notice_queue', [inv, OTHER, [guest['דנה']], PRICE, 'thanks', null, null]),
    ).toBeNull();
    await expect(
      call('whatsapp_notice_queue', [inv, OWNER, [guest['דנה']], PRICE, 'gallery', null, null]),
    ).rejects.toThrow();
  });
});

describe('the section’s state', () => {
  it('lists every kind of message, the stages’ numbers — the owner’s only', async () => {
    const ids = await activeWith(stage('invitation', 'invitation', 'invitation', 'not_received', past(1)));
    await run(ids.invitation!);
    expect(await call('whatsapp_hub_state', [inv, OTHER, 50])).toBeNull();
    const s = await call<{
      stages: { stats: Record<string, number> }[];
      history: { kind: string; name: string }[];
      album: boolean;
    }>('whatsapp_hub_state', [inv, OWNER, 50]);
    expect(s.stages[0]!.stats).toEqual({ queued: 3 });
    expect(s.history).toHaveLength(3);
    expect(s.history[0]!.kind).toBe('invitation');
    expect(s.album).toBe(false);
  });
});

describe('privileges', () => {
  it('nothing for anon or authenticated', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(
        as(c, role, OWNER, () => c.query(`select public.whatsapp_hub_state($1, $2, 10)`, [inv, OWNER])),
      ).rejects.toThrow(/permission denied/);
      await expect(as(c, role, OWNER, () => c.query(`select * from public.whatsapp_stages`))).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        as(c, role, OWNER, () => c.query(`select * from public.whatsapp_notices`)),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
