import { createHash, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type Feature, type FeatureInput } from '@/features/flags/features';
import type { PlanId } from '@/features/billing/plans';
import type { ClaimedNotice, OwnerDayRow, ReseatRow } from '@/features/event-day/server/db';
import type { DayHostDeps } from '@/features/event-day/server/host-api';
import type { StationDeps } from '@/features/event-day/server/station-api';
import type { Party, SeatingChange } from '@/features/event-day/model';

/**
 * The event day's API over fake dependencies: the entrance stations (the link, the feature, rate
 * limits, codes, arrivals and undo, the live hint), the host's live screen (set up on first open, the
 * station link and a new one), re-seating with notifications to the moved families only, undo, telling
 * guests their table (the system's number or the host's own), the table-number message and its queue,
 * the guest's guide page, and the secrets. The database functions themselves: tests/db/event-day.test.ts.
 */

vi.mock('server-only', () => ({}));
const env = {
  INVITES_GALLERY_SECRET: 'unit-link-secret',
  SUPABASE_SECRET_KEY: 'unit-service-key',
  INVITES_IP_HASH_SALT: 'unit-salt',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.test/',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'unit-anon-key',
  INVITES_WHATSAPP_TOKEN: 'wa-token',
  INVITES_WHATSAPP_PHONE_NUMBER_ID: '100',
  INVITES_WHATSAPP_TABLE_TEMPLATE: 'badook_table',
  INVITES_WHATSAPP_TEMPLATE_LANG: 'he',
  INVITES_WHATSAPP_API_BASE: 'https://graph.test',
  INVITES_WHATSAPP_API_VERSION: 'v26.0',
};
vi.mock('@/lib/env', () => ({ serverEnv: () => env }));
vi.mock('@/lib/supabase/server', () => ({ serviceDb: () => ({}) }));
// the guide page reads these directly
const guideRow = vi.fn();
vi.mock('@/features/event-day/server/db', () => ({
  eventDayDb: { guide: (...a: unknown[]) => guideRow(...a) },
}));
const featuresFor = vi.fn(async (): Promise<Set<Feature>> => new Set(FEATURES));
vi.mock('@/features/flags/server', () => ({ featuresFor: () => featuresFor(), featureInput: vi.fn() }));
vi.mock('@/features/seating/server', () => ({
  planBaseUrl: () => 'https://db.test/storage/v1/object/public/venue-plans',
}));

const tokens = await import('@/features/event-day/server/tokens');
const station = await import('@/features/event-day/server/station-api');
const host = await import('@/features/event-day/server/host-api');
const notify = await import('@/features/event-day/server/notify');
const { guidePage } = await import('@/features/event-day/server/pages');
const { FIXTURES } = await import('@/features/invitations/templates/demo');
const DOC = Object.values(FIXTURES)[0]!;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const UNIT = '1e1e1e1e-1111-4111-8111-111111111111';
const TABLE = '2e2e2e2e-2222-4222-8222-222222222222';
const IP = '203.0.113.9';
const ALL = new Set<Feature>(FEATURES);

function party(over: Partial<Party> = {}): Party {
  return {
    unitId: UNIT,
    guestId: null,
    name: 'משפחת כהן',
    status: 'confirmed',
    seats: 4,
    people: [],
    phoneTail: '1111',
    table: { id: TABLE, number: 12, label: null },
    arrived: 0,
    checkins: [],
    ...over,
  };
}
const totals = { expected: 10, parties: 3, arrived: 4, arrivedParties: 1 };

// ─── the stations ───────────────────────────────────────────────────────────────────────────────

function stationWorld(features: Set<Feature> = ALL) {
  const link = tokens.newStationLink(INV);
  const calls: { fn: string; args: unknown[] }[] = [];
  const broadcasts: [string, string][] = [];
  const answers: Record<string, unknown> = {};
  const rec =
    (fn: string, fallback: unknown) =>
    async (...args: unknown[]) => {
      calls.push({ fn, args });
      return fn in answers ? answers[fn] : fallback;
    };
  const deps: StationDeps = {
    db: {
      stationLink: async (hash: string) =>
        hash === link.hash ? { invitationId: INV, channel: 'chan-station-0123' } : null,
      stationOpen: rec('open', {
        ok: true,
        invitation: { slug: 'x' },
        channel: 'chan-station-0123',
        totals,
        recent: [],
      }),
      stationFind: rec('find', { ok: true, party: party() }),
      stationSearch: rec('search', { ok: true, parties: [party()] }),
      stationArrive: rec('arrive', { ok: true, checkinId: 'c1', party: party({ arrived: 4 }), totals }),
      stationUndo: rec('undo', { ok: true, party: party(), totals }),
    } as unknown as StationDeps['db'],
    features: async () => features,
    broadcast: async (channel, kind) => {
      broadcasts.push([channel, kind]);
    },
    realtime: (channel) => ({ url: 'https://db.test', key: 'k', channel }),
  };
  return { link, deps, calls, broadcasts, answers };
}

describe('the entrance station', () => {
  it('opens only with its link, for an event that checks guests in', async () => {
    const w = stationWorld();
    const open = await station.stationState({ t: w.link.token }, IP, w.deps);
    expect(open).toMatchObject({
      status: 200,
      body: { ok: true, totals, realtime: { channel: 'chan-station-0123' } },
    });
    // the database gets the link's hash and a salted hash of the address — never either as such
    const [hash, key] = w.calls[0]!.args as [string, string];
    expect(hash).toBe(w.link.hash);
    expect(key).toBe(tokens.rateKey('station', IP));
    expect(key).not.toContain(IP);
    expect((await station.stationState({ t: 'x'.repeat(24) }, IP, w.deps)).status).toBe(404);
    expect((await station.stationState({ t: 'short' }, IP, w.deps)).status).toBe(404);
    expect((await station.stationState({ t: w.link.token, extra: 1 }, IP, w.deps)).status).toBe(404);
    const off = stationWorld(new Set<Feature>(FEATURES.filter((f) => f !== 'checkin')));
    expect((await station.stationState({ t: off.link.token }, IP, off.deps)).status).toBe(404);
    expect(off.calls).toEqual([]);
  });

  it('finds a family by a code; anything that isn’t a code never reaches the database', async () => {
    const w = stationWorld();
    const code = tokens.checkinCode('guest-personal-token-1');
    expect(await station.findByCode({ t: w.link.token, code }, IP, w.deps)).toMatchObject({
      status: 200,
      body: { party: { unitId: UNIT } },
    });
    expect(await station.findByCode({ t: w.link.token, code: 'not a code' }, IP, w.deps)).toMatchObject({
      status: 404,
      body: { code: 'unknown_code' },
    });
    w.answers.find = { ok: false, code: 'unknown_code' };
    expect((await station.findByCode({ t: w.link.token, code }, IP, w.deps)).body).toMatchObject({
      code: 'unknown_code',
    });
    w.answers.find = { ok: false, code: 'rate' };
    expect((await station.findByCode({ t: w.link.token, code }, IP, w.deps)).status).toBe(429);
    expect(w.calls.filter((c) => c.fn === 'find')).toHaveLength(3);
  });

  it('searches from two characters', async () => {
    const w = stationWorld();
    expect(await station.search({ t: w.link.token, q: ' כ ' }, IP, w.deps)).toMatchObject({
      body: { parties: [] },
    });
    expect(w.calls).toEqual([]);
    expect(await station.search({ t: w.link.token, q: 'כהן' }, IP, w.deps)).toMatchObject({
      body: { parties: [{ name: 'משפחת כהן' }] },
    });
  });

  it('checks a family in and tells the other pages; bad counts are refused; undo too', async () => {
    const w = stationWorld();
    const id = randomUUID();
    const done = await station.arrive(
      { t: w.link.token, id, unitId: UNIT, count: 4, station: '  כניסה ראשית ' },
      IP,
      w.deps,
    );
    expect(done).toMatchObject({ status: 200, body: { checkinId: 'c1', party: { arrived: 4 }, totals } });
    expect(w.calls.at(-1)!.args.slice(1, 5)).toEqual([id, UNIT, 4, 'כניסה ראשית']);
    expect(w.broadcasts).toEqual([['chan-station-0123', 'checkin']]);
    for (const count of [0, 100, 1.5])
      expect((await station.arrive({ t: w.link.token, id, unitId: UNIT, count }, IP, w.deps)).status).toBe(
        400,
      );
    expect(
      (await station.arrive({ t: w.link.token, id: 'x', unitId: UNIT, count: 1 }, IP, w.deps)).status,
    ).toBe(400);
    w.answers.arrive = { ok: false, code: 'not_found' };
    expect(
      (await station.arrive({ t: w.link.token, id, unitId: UNIT, count: 1 }, IP, w.deps)).body,
    ).toMatchObject({
      code: 'unknown_party',
    });
    expect(await station.undo({ t: w.link.token, id }, IP, w.deps)).toMatchObject({ status: 200 });
    expect(w.broadcasts).toHaveLength(2);
    w.answers.undo = { ok: false, code: 'not_found' };
    expect((await station.undo({ t: w.link.token, id }, IP, w.deps)).status).toBe(404);
  });
});

// ─── the host ───────────────────────────────────────────────────────────────────────────────────

function input(plan: PlanId = 'business', off: Feature[] = []): FeatureInput & { ownerId: string } {
  return { plan, admin: false, overrides: { ...NO_OVERRIDES, off }, available: ALL, ownerId: OWNER };
}

function change(over: Partial<SeatingChange> = {}): SeatingChange {
  return {
    id: randomUUID(),
    kind: 'move',
    source: 'live',
    reason: null,
    at: '2027-06-17T17:30:00Z',
    actorId: OWNER,
    undoOf: null,
    undoneAt: null,
    units: [
      {
        id: UNIT,
        name: 'משפחת כהן',
        seats: 4,
        from: { id: TABLE, number: 12 },
        to: { id: 'other', number: 7 },
      },
    ],
    tables: [],
    ...over,
  };
}

function hostWorld(
  opts: { input?: FeatureInput & { ownerId: string }; day?: boolean; ready?: boolean } = {},
) {
  const link = tokens.newStationLink(INV);
  let day: OwnerDayRow['day'] =
    opts.day === false
      ? null
      : {
          stationTokenHash: link.hash,
          stationTokenNonce: link.nonce,
          channel: 'chan-day-0123456',
          createdAt: '',
          updatedAt: '',
        };
  const invitation = {
    id: INV,
    slug: 'noa-and-itay',
    status: 'published' as const,
    eventType: 'wedding',
    templateId: 'sahar-bordeaux',
    hosts: null,
    date: '2027-06-17',
    startTime: '19:30',
    timezone: 'Asia/Jerusalem',
    locales: ['he'],
    defaultLocale: 'he',
    palette: null,
  };
  const calls: { fn: string; args: unknown[] }[] = [];
  const broadcasts: [string, string][] = [];
  const answers: Record<string, unknown> = {};
  const rec =
    (fn: string, fallback: () => unknown) =>
    async (...args: unknown[]) => {
      calls.push({ fn, args });
      return fn in answers ? answers[fn] : fallback();
    };
  const sent: [string, number][] = [];
  let credits = 10;
  const deps: DayHostDeps = {
    db: {
      ownerGet: rec('ownerGet', () => ({ invitation, day })),
      ownerSetup: rec('ownerSetup', () => {
        day = {
          stationTokenHash: 'h',
          stationTokenNonce: 'n',
          channel: 'chan-new-01234567',
          createdAt: '',
          updatedAt: '',
        };
        return { invitation, day };
      }),
      ownerRotate: rec('ownerRotate', () => ({ invitation, day })),
      live: rec('live', () => ({
        invitation,
        layout: { version: 3, background: null, metersPerPixel: null, landmarks: [] },
        tables: [
          {
            id: TABLE,
            number: 12,
            label: 'משפחה',
            shape: 'round',
            capacity: 10,
            x: 3,
            y: 3,
            w: 1.8,
            h: 1.8,
            rotation: 0,
          },
        ],
        parties: [party()],
        totals,
        changes: [],
        told: {},
      })),
      ownerArrive: rec('ownerArrive', () => ({ ok: true, checkinId: 'c1', party: party(), totals })),
      ownerUndo: rec('ownerUndo', () => ({ ok: true, party: party(), totals })),
      move: rec('move', () => ({ ok: true, change: change() }) satisfies ReseatRow),
      merge: rec('merge', () => ({ ok: true, change: change({ kind: 'merge' }) }) satisfies ReseatRow),
      undoChange: rec(
        'undoChange',
        () => ({ ok: true, change: change({ undoOf: 'x' }) }) satisfies ReseatRow,
      ),
      changes: rec('changes', () => [change()]),
      notices: rec('notices', () => ({ rows: [] })),
      queueNotices: rec('queueNotices', () => ({ ok: true, queued: 1, balance: 9 })),
      markNotices: rec('markNotices', () => 2),
      noticesPending: rec('noticesPending', () => 0),
    },
    featureInput: async () => opts.input ?? input(),
    broadcast: async (channel, kind) => {
      broadcasts.push([channel, kind]);
    },
    realtime: (channel) => ({ url: 'https://db.test', key: 'k', channel }),
    qr: async (url) => ({ svg: `<svg data-url="${url}"/>`, png: 'data:image/png;base64,' }),
    notify: {
      ready: () => opts.ready ?? true,
      priceUsd: 0.0353,
      send: async (id, limit) => {
        sent.push([id, limit]);
        return { sent: 1, failed: 0, retried: 0 };
      },
      account: async () => ({ credits, admin: false }),
      addCredits: async (_u, n) => {
        credits += n;
      },
    },
    now: () => Date.parse('2027-06-17T17:30:00Z'),
  };
  return { deps, calls, broadcasts, answers, sent, link, invitation };
}

describe('the host’s live screen', () => {
  it('is the owner’s, with `checkin`; the plan without it gets the package that has it', async () => {
    const w = hostWorld();
    expect((await host.getDay('someone-else', INV, 'https://site', w.deps)).status).toBe(404);
    expect((await host.getDay(OWNER, 'not-a-uuid', 'https://site', w.deps)).status).toBe(404);
    const pro = hostWorld({ input: input('pro') });
    expect(await host.getDay(OWNER, INV, 'https://site', pro.deps)).toMatchObject({
      status: 403,
      body: { code: 'feature_off', feature: 'checkin', reason: 'plan', package: 'vip' },
    });
  });

  it('has the station link (from the key, never stored), its QR, the hall and whether the grace time passed', async () => {
    const w = hostWorld();
    const res = await host.getDay(OWNER, INV, 'https://site', w.deps);
    const view = (res.body as { view: Record<string, unknown> }).view;
    expect(view).toMatchObject({
      station: { url: `https://site/e/noa-and-itay/station?t=${w.link.token}` },
      realtime: { channel: 'chan-day-0123456' },
      version: 3,
      totals,
      notifyReady: true,
      // 19:30 in Israel is 16:30Z; it is 17:30Z: the 45 minutes have passed
      startMs: Date.parse('2027-06-17T16:30:00Z'),
      released: true,
    });
    expect((view.hall as { tables: { label: string }[] }).tables[0]!.label).toBe('משפחה');
    expect((view.station as { qr: { svg: string } }).qr.svg).toContain(w.link.token);
    expect(w.calls.map((c) => c.fn)).not.toContain('ownerSetup');
  });

  it('is set up the first time the host opens it', async () => {
    const w = hostWorld({ day: false });
    const res = await host.getDay(OWNER, INV, 'https://site', w.deps);
    expect(res.status).toBe(200);
    const setup = w.calls.find((c) => c.fn === 'ownerSetup')!;
    const [id, owner, hash, nonce, channel] = setup.args as string[];
    expect([id, owner]).toEqual([INV, OWNER]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(channel).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it('a new station link: the stations on the old one hear about it', async () => {
    const w = hostWorld();
    expect((await host.rotateStation(OWNER, INV, {}, 'https://site', w.deps)).status).toBe(400);
    expect((await host.rotateStation(OWNER, INV, { rotate: true }, 'https://site', w.deps)).status).toBe(200);
    const [, , hash, nonce] = w.calls.find((c) => c.fn === 'ownerRotate')!.args as string[];
    expect(hash).not.toBe(w.link.hash);
    expect(tokens.stationToken(INV, nonce!, hash!)).toMatch(tokens.STATION_TOKEN_RE);
    expect(w.broadcasts).toEqual([['chan-day-0123456', 'settings']]);
  });

  it('the host checks a family in and undoes it', async () => {
    const w = hostWorld();
    const id = randomUUID();
    expect((await host.hostArrive(OWNER, INV, { id, unitId: UNIT, count: 3 }, w.deps)).status).toBe(200);
    expect(w.calls.find((c) => c.fn === 'ownerArrive')!.args).toEqual([INV, OWNER, id, UNIT, 3]);
    expect((await host.hostUndo(OWNER, INV, { id }, w.deps)).status).toBe(200);
    expect(w.broadcasts).toEqual([
      ['chan-day-0123456', 'checkin'],
      ['chan-day-0123456', 'checkin'],
    ]);
    expect((await host.hostArrive(OWNER, INV, { id, unitId: UNIT, count: 0 }, w.deps)).status).toBe(400);
  });
});

describe('re-seating live', () => {
  it('moves a family, tells the other pages, and notifies only the moved family', async () => {
    const w = hostWorld();
    const res = await host.reseat(
      OWNER,
      INV,
      { action: 'move', unitId: UNIT, tableId: TABLE, reason: 'קרוב לבמה', notify: true },
      w.deps,
    );
    expect(res).toMatchObject({
      status: 200,
      body: { change: { kind: 'move' }, notified: { via: 'whatsapp', queued: 1, sent: 1 } },
    });
    // released (45 minutes after the start): passed on to the database
    expect(w.calls.find((c) => c.fn === 'move')!.args).toEqual([
      INV,
      OWNER,
      UNIT,
      TABLE,
      'קרוב לבמה',
      true,
      false,
    ]);
    expect(w.calls.find((c) => c.fn === 'queueNotices')!.args).toEqual([INV, OWNER, [UNIT], 0.0353]);
    expect(w.broadcasts).toEqual([['chan-day-0123456', 'seating']]);
  });

  it('without the approved template (or seating_guide) the moved families come back for the host’s own WhatsApp', async () => {
    const manual = hostWorld({ ready: false });
    expect(
      (await host.reseat(OWNER, INV, { action: 'merge', from: TABLE, into: UNIT, notify: true }, manual.deps))
        .body,
    ).toMatchObject({ notified: { via: 'manual', unitIds: [UNIT] } });
    expect(manual.calls.map((c) => c.fn)).not.toContain('queueNotices');
    const noGuide = hostWorld({ input: input('business', ['seating_guide']) });
    expect(
      (
        await host.reseat(
          OWNER,
          INV,
          { action: 'move', unitId: UNIT, tableId: TABLE, notify: true },
          noGuide.deps,
        )
      ).body,
    ).toMatchObject({ notified: { via: 'manual' } });
    // no notify: nothing
    const quiet = hostWorld();
    expect(
      (await host.reseat(OWNER, INV, { action: 'move', unitId: UNIT, tableId: TABLE }, quiet.deps)).body,
    ).toMatchObject({
      notified: null,
    });
  });

  it('a table that can’t take them: 409 with the numbers; the refusals', async () => {
    const w = hostWorld();
    w.answers.move = { ok: false, code: 'full', table: 7, capacity: 10, load: 8, need: 4 };
    expect(
      await host.reseat(OWNER, INV, { action: 'move', unitId: UNIT, tableId: TABLE }, w.deps),
    ).toMatchObject({
      status: 409,
      body: { code: 'full', table: 7, capacity: 10, load: 8, need: 4 },
    });
    w.answers.move = { ok: false, code: 'same_table' };
    expect(
      (await host.reseat(OWNER, INV, { action: 'move', unitId: UNIT, tableId: TABLE }, w.deps)).body,
    ).toMatchObject({
      code: 'same_table',
    });
    expect((await host.reseat(OWNER, INV, { action: 'swap' }, w.deps)).status).toBe(400);
    const vipless = hostWorld({ input: input('pro') });
    expect(
      (await host.reseat(OWNER, INV, { action: 'move', unitId: UNIT, tableId: TABLE }, vipless.deps)).status,
    ).toBe(403);
  });

  it('undo, and the history (seating is enough)', async () => {
    const w = hostWorld({ input: input('free') });
    const id = randomUUID();
    expect((await host.undoChange(OWNER, INV, { changeId: id }, w.deps)).status).toBe(200);
    expect(w.calls.find((c) => c.fn === 'undoChange')!.args).toEqual([INV, OWNER, id, true, false]);
    w.answers.undoChange = { ok: false, code: 'stale' };
    expect(await host.undoChange(OWNER, INV, { changeId: id }, w.deps)).toMatchObject({
      status: 409,
      body: { code: 'stale' },
    });
    expect(await host.listChanges(OWNER, INV, w.deps)).toMatchObject({
      status: 200,
      body: { changes: [{ kind: 'move' }] },
    });
  });
});

describe('telling guests their table', () => {
  it('needs seating_guide; sends from the system’s number, or records what the host told themselves', async () => {
    const pro = hostWorld({ input: input('free') });
    expect(await host.noticesState(OWNER, INV, pro.deps)).toMatchObject({
      status: 403,
      body: { feature: 'seating_guide' },
    });
    const w = hostWorld();
    expect(await host.noticesState(OWNER, INV, w.deps)).toMatchObject({
      body: { rows: [], ready: true, credits: 10 },
    });
    expect(await host.sendNotices(OWNER, INV, { action: 'send', unitIds: [UNIT] }, w.deps)).toMatchObject({
      status: 200,
      body: { queued: 1, sent: 1, pending: 0 },
    });
    expect(await host.sendNotices(OWNER, INV, { action: 'mark', unitIds: [UNIT] }, w.deps)).toMatchObject({
      body: { marked: 2 },
    });
    w.answers.queueNotices = { ok: false, code: 'credits', needed: 5, balance: 1 };
    expect(await host.sendNotices(OWNER, INV, { action: 'send', unitIds: [UNIT] }, w.deps)).toMatchObject({
      status: 402,
      body: { code: 'credits', needed: 5, balance: 1 },
    });
    w.answers.queueNotices = {
      ok: false,
      code: 'nobody',
      skipped: { noPhone: 1, landline: 0, optedOut: 0, noTable: 0, queued: 0 },
    };
    expect(await host.sendNotices(OWNER, INV, { action: 'send', unitIds: [UNIT] }, w.deps)).toMatchObject({
      status: 422,
      body: { code: 'nobody', skipped: { noPhone: 1 } },
    });
    const notReady = hostWorld({ ready: false });
    expect((await notReady.deps.notify.ready()) || null).toBeNull();
    expect(
      await host.sendNotices(OWNER, INV, { action: 'send', unitIds: [UNIT] }, notReady.deps),
    ).toMatchObject({
      status: 503,
      body: { code: 'not_configured' },
    });
  });
});

describe('the table number’s message', () => {
  const claimed = (over: Partial<ClaimedNotice> = {}): ClaimedNotice => ({
    id: 'n1',
    invitationId: INV,
    toPhone: '+972521111111',
    attempts: 1,
    guestName: 'דנה',
    guestToken: 'guest-personal-token-1',
    slug: 'noa-and-itay',
    tableNumber: 12,
    tableLabel: null,
    document: DOC,
    ...over,
  });

  it('says the guest, the hosts and the table, and its button opens the guest’s map', () => {
    const doc = {
      hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' }, joiner: null },
      locales: ['he'],
      defaultLocale: 'he',
    };
    const m = notify.noticeMessage(claimed({ tableLabel: 'המשפחה' }), doc as never);
    expect(notify.noticeMessage(claimed(), DOC).body[1]!.length).toBeGreaterThan(0);
    expect(m).toMatchObject({
      to: '+972521111111',
      template: 'badook_table',
      lang: 'he',
      button: 'noa-and-itay/table?g=guest-personal-token-1',
      ref: 'n1',
    });
    expect(m.body[0]).toBe('דנה');
    expect(m.body[1]).toContain('נועה');
    expect(m.body[2]).toBe('12 · המשפחה');
    expect(notify.tableText(7, null)).toBe('7');
  });

  it('the queue: sent, a retry later, a failure; a guest gone from the list fails at once', async () => {
    const results: [string, string | null, string | null][] = [];
    const requeued: [string, string, number][] = [];
    const db = {
      claimNotices: async () => [
        claimed({ id: 'ok' }),
        claimed({ id: 'slow', toPhone: '+972529999999', attempts: 2 }),
        claimed({ id: 'bad', toPhone: '+972520000000' }),
        claimed({ id: 'gone', guestToken: null }),
      ],
      noticeResult: async (id: string, wa: string | null, error: string | null) => {
        results.push([id, wa, error]);
        return null;
      },
      noticeRequeue: async (id: string, error: string, wait: number) => {
        requeued.push([id, error, wait]);
        return true;
      },
    };
    const send = vi.fn(async (m: { to: string }) =>
      m.to.endsWith('9999')
        ? ({ ok: false, error: '130429 · rate', retryable: true } as const)
        : m.to.endsWith('0000')
          ? ({ ok: false, error: '131026 · not on WhatsApp', retryable: false } as const)
          : ({ ok: true, id: 'wamid.1' } as const),
    );
    expect(await notify.processNoticeQueue(INV, 25, send, db as never)).toEqual({
      sent: 1,
      failed: 2,
      retried: 1,
    });
    expect(results.sort()).toEqual(
      [
        ['ok', 'wamid.1', null],
        ['bad', null, '131026 · not on WhatsApp'],
        ['gone', null, 'no_guest'],
      ].sort(),
    );
    // the second try waits five minutes
    expect(requeued).toEqual([['slow', '130429 · rate', 300]]);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('nothing is sent until the template is approved', async () => {
    const saved = env.INVITES_WHATSAPP_TABLE_TEMPLATE;
    env.INVITES_WHATSAPP_TABLE_TEMPLATE = '';
    const db = { claimNotices: vi.fn(), noticeResult: vi.fn(), noticeRequeue: vi.fn() };
    expect(notify.tableTemplateReady()).toBe(false);
    expect(await notify.processNoticeQueue(null, 25, vi.fn(), db as never)).toEqual({
      sent: 0,
      failed: 0,
      retried: 0,
    });
    expect(db.claimNotices).not.toHaveBeenCalled();
    env.INVITES_WHATSAPP_TABLE_TEMPLATE = saved;
  });
});

describe('the guest’s guide page', () => {
  const TOKEN = 'guest-personal-token-1';
  const row = {
    ok: true,
    invitation: {
      id: INV,
      slug: 'noa-and-itay',
      status: 'published',
      eventType: 'wedding',
      templateId: 'sahar-bordeaux',
      hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' }, joiner: null },
      date: '2027-06-17',
      startTime: '19:30',
      timezone: 'Asia/Jerusalem',
      locales: ['he'],
      defaultLocale: 'he',
      palette: null,
    },
    guest: { id: 'g1', name: 'משפחת כהן' },
    unit: { id: UNIT, status: 'confirmed', seats: 4 },
    table: {
      id: TABLE,
      number: 12,
      label: null,
      shape: 'round',
      capacity: 10,
      x: '10',
      y: '5',
      w: '1.8',
      h: '1.8',
      rotation: 0,
    },
    arrived: 0,
    layout: {
      background: { path: 'o/i/plan.png', type: 'image/png', width: 1200, height: 800 },
      metersPerPixel: '0.025',
      landmarks: [{ id: 'in', kind: 'entrance', x: 0, y: 5, w: 2, h: 0.5, rotation: 0, label: null }],
    },
    tables: [
      { id: TABLE, number: 12, shape: 'round', capacity: 10, x: 10, y: 5, w: 1.8, h: 1.8, rotation: 0 },
    ],
  };
  beforeEach(() => {
    guideRow.mockReset();
    featuresFor.mockReset();
    featuresFor.mockResolvedValue(new Set(FEATURES));
  });

  it('the guest’s table, the hall, the way there and their entrance QR', async () => {
    guideRow.mockResolvedValue(row);
    const page = await guidePage('noa-and-itay', TOKEN, IP);
    expect(page.ok).toBe(true);
    const data = (page as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      state: 'seated',
      table: { number: 12 },
      guestName: 'משפחת כהן',
      inviteUrl: `/i/noa-and-itay?g=${TOKEN}`,
      hall: {
        planUrl: 'https://db.test/storage/v1/object/public/venue-plans/o/i/plan.png',
        metersPerPixel: 0.025,
      },
      checkin: { code: tokens.checkinCode(TOKEN) },
    });
    const route = data.route as { points: { x: number; y: number }[] };
    expect(route.points[0]).toEqual({ x: 0, y: 5 });
    expect((data.checkin as { qr: string }).qr).toContain('<svg');
    // the database got the token's hash only
    const [slug, hash, key] = guideRow.mock.calls[0]!;
    expect([slug, hash]).toEqual(['noa-and-itay', sha(TOKEN)]);
    expect(key).toBe(tokens.rateKey('guide', IP));
  });

  it('no table yet, no QR without checkin, nothing without seating_guide, rate-limited', async () => {
    guideRow.mockResolvedValue({ ...row, table: null });
    featuresFor.mockResolvedValue(new Set(FEATURES.filter((f) => f !== 'checkin')));
    expect(await guidePage('noa-and-itay', TOKEN, IP)).toMatchObject({
      ok: true,
      data: { state: 'waiting', table: null, route: null, checkin: null },
    });
    featuresFor.mockResolvedValue(new Set(FEATURES.filter((f) => f !== 'seating_guide')));
    expect(await guidePage('noa-and-itay', TOKEN, IP)).toEqual({ ok: false, code: 'not_found' });
    guideRow.mockResolvedValue({ ok: false, code: 'rate' });
    expect(await guidePage('noa-and-itay', TOKEN, IP)).toEqual({ ok: false, code: 'rate' });
    guideRow.mockResolvedValue(null);
    expect(await guidePage('noa-and-itay', TOKEN, IP)).toEqual({ ok: false, code: 'not_found' });
    expect(await guidePage('Bad Slug', TOKEN, IP)).toEqual({ ok: false, code: 'not_found' });
    expect(await guidePage('noa-and-itay', 'short', IP)).toEqual({ ok: false, code: 'not_found' });
  });
});

describe('secrets', () => {
  it('station links: derived from the nonce with the server’s key; a different key reads them as gone', () => {
    const a = tokens.newStationLink(INV);
    expect(a.token).toMatch(tokens.STATION_TOKEN_RE);
    expect(a.hash).toBe(sha(a.token));
    expect(tokens.stationToken(INV, a.nonce, a.hash)).toBe(a.token);
    expect(tokens.stationToken(OWNER, a.nonce, a.hash)).toBeNull();
    const saved = env.INVITES_GALLERY_SECRET;
    env.INVITES_GALLERY_SECRET = 'another-key';
    expect(tokens.stationToken(INV, a.nonce, a.hash)).toBeNull();
    env.INVITES_GALLERY_SECRET = saved;
  });

  it('the entrance code is one-way and matches the database’s (checkin_code)', () => {
    expect(tokens.checkinCode('AbCdEfGhIjKlMnOp')).toBe('_gxAk-hIQQdMFIZAXcOxi7');
    expect(tokens.checkinCode('AbCdEfGhIjKlMnOp')).not.toContain('AbCd');
  });
});
