import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase } from './harness';

// The clock's database side (supabase/migrations/*_scheduled_sends.sql, *_cron_schedule.sql): a date
// and a time on the clock in the host's time zone become the right moment (New York's 15:00 is 19:00
// UTC in summer, 20:00 in winter; Israel's is 12:00 / 13:00); a send scheduled, moved, taken back,
// claimed once it is due and only then, finished; the RSVP summary at each host's own morning; owner
// checks; the scheduler's call does nothing without its secrets (a local database: no pg_cron); and
// nothing for anyone but the service role.

const OWNER = '77777777-7777-4777-8777-777777777771';
const OTHER = '77777777-7777-4777-8777-777777777772';

let db: { url: string; drop: () => Promise<void> };
let c: Client;
let inv: string;

async function commit<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await c.query(`select public.${fn}(${params}) as r`, args)).rows[0].r;
}
const iso = (v: unknown) => new Date(v as string).toISOString();

beforeAll(async () => {
  db = await createTestDatabase();
  c = new Client({ connectionString: db.url });
  await c.connect();
  await c.query(
    `insert into auth.users (id, email) values ($1, 'clock-owner@example.com'), ($2, 'clock-other@example.com')`,
    [OWNER, OTHER],
  );
  const doc = (await c.query(`select draft from invitations where slug = 'noa-and-itay'`)).rows[0].draft;
  inv = (
    await commit<{ id: string }>('create_invitation', [OWNER, 'sahar-bordeaux', 'wedding', 'clock-test', doc])
  ).id;
});

afterAll(async () => {
  await c?.end();
  await db?.drop();
});

describe('a date and a time in a time zone', () => {
  it('is the moment it means there — daylight saving included; an unknown zone is nothing', async () => {
    const at = (date: string, time: string, tz: string) => commit('local_moment', [date, time, tz]);
    expect(iso(await at('2027-06-17', '15:00', 'America/New_York'))).toBe('2027-06-17T19:00:00.000Z');
    expect(iso(await at('2027-01-10', '15:00', 'America/New_York'))).toBe('2027-01-10T20:00:00.000Z');
    expect(iso(await at('2027-06-17', '15:00', 'Asia/Jerusalem'))).toBe('2027-06-17T12:00:00.000Z');
    expect(iso(await at('2027-01-10', '15:00', 'Asia/Jerusalem'))).toBe('2027-01-10T13:00:00.000Z');
    expect(iso(await at('2027-06-17', '15:00', 'America/Los_Angeles'))).toBe('2027-06-17T22:00:00.000Z');
    expect(await at('2027-06-17', '15:00', 'Mars/Olympus')).toBeNull();
    expect(await commit('time_zone_ok', ['Europe/Paris'])).toBe(true);
    expect(await commit('time_zone_ok', ['Not/AZone'])).toBe(false);
  });
});

describe('a scheduled send', () => {
  const nextYear = new Date().getUTCFullYear() + 1;
  const set = (
    date: string,
    time: string,
    tz: string,
    kind = 'album_thanks',
    owner = OWNER,
    audience = 'unsent',
  ) =>
    commit<{ ok: boolean; code?: string; send?: Record<string, unknown> } | null>('scheduled_send_set', [
      inv,
      owner,
      kind,
      date,
      time,
      tz,
      audience,
    ]);

  it('keeps what the host picked and the moment it means; moved, not doubled; only the owner’s', async () => {
    const first = await set(`${nextYear}-06-17`, '15:00', 'America/New_York');
    expect(first).toMatchObject({
      ok: true,
      send: {
        kind: 'album_thanks',
        date: `${nextYear}-06-17`,
        time: '15:00',
        timeZone: 'America/New_York',
        status: 'scheduled',
        audience: 'unsent',
      },
    });
    expect(iso(first!.send!.runAt)).toBe(`${nextYear}-06-17T19:00:00.000Z`);
    // set again: the same send moves (one waiting per kind)
    const moved = await set(`${nextYear}-06-18`, '09:30', 'Asia/Jerusalem');
    expect(moved!.send!.id).toBe(first!.send!.id);
    expect(iso(moved!.send!.runAt)).toBe(`${nextYear}-06-18T06:30:00.000Z`);
    // another kind is another send
    expect((await set(`${nextYear}-06-18`, '10:00', 'Asia/Jerusalem', 'gallery_link'))!.ok).toBe(true);
    const list = await commit<{ timeZone: string; sends: { kind: string }[] }>('scheduled_send_list', [
      inv,
      OWNER,
    ]);
    expect(list.timeZone).toBe('Asia/Jerusalem');
    expect(list.sends.map((s) => s.kind).sort()).toEqual(['album_thanks', 'gallery_link']);
    expect(await set(`${nextYear}-06-18`, '10:00', 'Asia/Jerusalem', 'gallery_link', OTHER)).toBeNull();
    expect(await commit('scheduled_send_list', [inv, OTHER])).toBeNull();
  });

  it('refuses the past, more than 400 days ahead and a zone Postgres doesn’t know', async () => {
    expect(await set('2020-01-01', '10:00', 'Asia/Jerusalem')).toEqual({ ok: false, code: 'past' });
    expect(await set(`${nextYear + 2}-01-01`, '10:00', 'Asia/Jerusalem')).toEqual({
      ok: false,
      code: 'too_far',
    });
    expect(await set(`${nextYear}-01-01`, '10:00', 'Atlantis/Capital')).toEqual({
      ok: false,
      code: 'time_zone',
    });
  });

  it('claimed once due — not before, and not twice — then finished; taken back before it runs', async () => {
    // nothing due yet
    expect(await commit('scheduled_send_claim', [10, 300])).toEqual([]);
    // the album's send comes due
    await c.query(
      `update scheduled_sends set run_at = now() - interval '1 second' where invitation_id = $1 and kind = 'album_thanks'`,
      [inv],
    );
    const claimed = await commit<{ id: string; kind: string; ownerId: string; attempts: number }[]>(
      'scheduled_send_claim',
      [10, 300],
    );
    expect(claimed.map((s) => [s.kind, s.ownerId, s.attempts])).toEqual([['album_thanks', OWNER, 1]]);
    expect(await commit('scheduled_send_claim', [10, 300])).toEqual([]);
    // while it runs it can't be moved
    expect(await set(`${nextYear}-07-01`, '10:00', 'Asia/Jerusalem')).toEqual({ ok: false, code: 'running' });
    expect(await commit('scheduled_send_finish', [claimed[0]!.id, 'done', { queued: 3 }, null])).toBe(true);
    expect(await commit('scheduled_send_finish', [claimed[0]!.id, 'done', {}, null])).toBe(false);
    // a run that died: taken again after the stale time, at most three times, then failed
    await set(`${nextYear}-07-01`, '10:00', 'Asia/Jerusalem');
    await c.query(
      `update scheduled_sends set status = 'running', attempts = 3, claimed_at = now() - interval '1 hour'
        where invitation_id = $1 and kind = 'album_thanks' and status = 'scheduled'`,
      [inv],
    );
    expect(await commit('scheduled_send_claim', [10, 300])).toEqual([]);
    const timedOut = await c.query(
      `select status, error from scheduled_sends where invitation_id = $1 and kind = 'album_thanks' order by created_at desc limit 1`,
      [inv],
    );
    expect(timedOut.rows[0]).toEqual({ status: 'failed', error: 'timeout' });
    // the gallery link's: taken back
    expect(await commit('scheduled_send_cancel', [inv, OWNER, 'gallery_link'])).toBe(true);
    expect(await commit('scheduled_send_cancel', [inv, OWNER, 'gallery_link'])).toBe(false);
    expect(await commit('scheduled_send_cancel', [inv, OTHER, 'gallery_link'])).toBeNull();
  });
});

describe('the host told when a send didn’t go out', () => {
  it('the failed ones — a run that died too — with the owner’s address, once each', async () => {
    const failures = () =>
      commit<{ id: string; error: string; ownerEmail: string; slug: string; document: unknown }[]>(
        'scheduled_send_failures',
        [20],
      );
    // the album's send that timed out (above)
    const before = await failures();
    expect(before.map((f) => [f.error, f.ownerEmail, f.slug])).toEqual([
      ['timeout', 'clock-owner@example.com', 'clock-test'],
    ]);
    expect(before[0]!.document).toBeTruthy();
    expect(await commit('scheduled_send_failure_mailed', [before[0]!.id])).toBe(true);
    expect(await commit('scheduled_send_failure_mailed', [before[0]!.id])).toBe(false);
    expect(await failures()).toEqual([]);
    // a done send is never one of them
    const done = await c.query(`select id from scheduled_sends where status = 'done' limit 1`);
    expect(await commit('scheduled_send_failure_mailed', [done.rows[0].id])).toBe(false);
  });
});

describe('the host’s WhatsApp alert when a send didn’t go out', () => {
  it('the failed ones with the account’s phone and whether WhatsApp may reach it; once each', async () => {
    const alerts = () =>
      commit<{ id: string; ownerPhone: string | null; reach: string; document: unknown }[]>(
        'scheduled_send_failure_alerts',
        [20],
      );
    // no phone on the account yet
    await commit('account_get', [OWNER]);
    const first = await alerts();
    expect(first.map((a) => [a.ownerPhone, a.reach])).toEqual([[null, 'none']]);
    expect(first[0]!.document).toBeTruthy();
    await c.query(`update accounts set phone = '+972501234567' where user_id = $1`, [OWNER]);
    expect((await alerts()).map((a) => [a.ownerPhone, a.reach])).toEqual([['+972501234567', 'ok']]);
    await c.query(`insert into whatsapp_opt_outs (phone, source) values ('+972501234567', 'reply')`);
    expect((await alerts())[0]!.reach).toBe('opted_out');
    await c.query(`delete from whatsapp_opt_outs where phone = '+972501234567'`);
    // recorded once; an outcome that isn't one is refused
    expect(await commit('scheduled_send_failure_alerted', [first[0]!.id, 'maybe'])).toBe(false);
    expect(await commit('scheduled_send_failure_alerted', [first[0]!.id, 'sent'])).toBe(true);
    expect(await commit('scheduled_send_failure_alerted', [first[0]!.id, 'sent'])).toBe(false);
    expect(await alerts()).toEqual([]);
  });
});

describe('the RSVP summary at the host’s morning', () => {
  it('due once 08:00 has come in the invitation’s own time zone, and not again that day', async () => {
    await c.query(`insert into invitation_notifications (invitation_id, mode) values ($1, 'digest')`, [inv]);
    await c.query(
      `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, edit_token_hash, created_at, updated_at)
       values ($1, true, 'he', 'דנה', 2, 'x', '2027-06-17T02:00:00Z', '2027-06-17T02:00:00Z')`,
      [inv],
    );
    const due = (now: string) =>
      commit<{ id: string }[]>('rsvp_digest_due_local', [now, 8]).then((r) => r.map((x) => x.id));
    // an event in New York: 08:00 there is 12:00 UTC (summer)
    await c.query(
      `update invitations set draft = jsonb_set(draft, '{timezone}', '"America/New_York"') where id = $1`,
      [inv],
    );
    expect(await due('2027-06-17T06:00:00Z')).toEqual([]); // 02:00 in New York
    expect(await due('2027-06-17T11:59:00Z')).toEqual([]);
    expect(await due('2027-06-17T12:00:00Z')).toEqual([inv]);
    // sent at 12:05 UTC: not again until tomorrow's 08:00 there
    await c.query(
      `update invitation_notifications set digest_sent_at = '2027-06-17T12:05:00Z' where invitation_id = $1`,
      [inv],
    );
    // a reply after it (the table's own trigger keeps updated_at on updates: a new reply)
    await c.query(
      `insert into rsvp_responses (invitation_id, attending, locale, primary_name, adults_count, edit_token_hash, created_at, updated_at)
       values ($1, true, 'he', 'יואב', 1, 'y', '2027-06-17T14:00:00Z', '2027-06-17T14:00:00Z')`,
      [inv],
    );
    expect(await due('2027-06-17T20:00:00Z')).toEqual([]);
    expect(await due('2027-06-18T12:00:00Z')).toEqual([inv]);
    // the same invitation in Israel: 08:00 is 05:00 UTC
    await c.query(
      `update invitations set draft = jsonb_set(draft, '{timezone}', '"Asia/Jerusalem"') where id = $1`,
      [inv],
    );
    expect(await due('2027-06-18T04:59:00Z')).toEqual([]);
    expect(await due('2027-06-18T05:00:00Z')).toEqual([inv]);
  });
});

describe('the scheduler', () => {
  it('its call does nothing without pg_net and the secrets; the secret is nothing without the Vault', async () => {
    expect(await commit('app_cron_call', ['/api/cron/tick'])).toBeNull();
    expect(await commit('cron_secret', [])).toBeNull();
  });

  it('nothing for anyone but the service role', async () => {
    for (const role of ['anon', 'authenticated'] as const)
      for (const sql of [
        `select public.scheduled_send_list($1, $2)`,
        `select public.scheduled_send_failures(1) where $1::uuid is not null and $2::uuid is not null`,
        `select public.scheduled_send_failure_alerts(1) where $1::uuid is not null and $2::uuid is not null`,
        `select public.scheduled_send_claim(1, $1::int + 0 * length($2::text))`,
        `select public.cron_secret() where $1::uuid is not null and $2::uuid is not null`,
        `select public.app_cron_call('/x') where $1::uuid is not null and $2::uuid is not null`,
        `select count(*) from public.scheduled_sends where invitation_id = $1 and $2::uuid is not null`,
      ])
        await as(c, role, role === 'authenticated' ? OWNER : null, async () => {
          const args = sql.includes('$1::int') ? [300, OWNER] : [inv, OWNER];
          await expect(c.query(sql, args)).rejects.toThrow(/permission denied/);
        });
    await as(c, 'service_role', null, async () => {
      expect(
        (await c.query(`select public.scheduled_send_list($1, $2) as r`, [inv, OWNER])).rows[0].r,
      ).toBeTruthy();
    });
  });
});
