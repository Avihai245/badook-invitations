import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FEATURES, NO_OVERRIDES, type FeatureInput } from '@/features/flags/features';
import { INSIGHTS } from '@/features/insights/config';
import {
  BOT_UA,
  BeaconSchema,
  breakdownOf,
  dayIn,
  daysBetween,
  deviceOf,
  funnelOf,
  medianSeconds,
  milestoneOf,
  minusDays,
  seriesOf,
  sourceOf,
  totalsOf,
  withEvent,
  type BeaconState,
  type DayRow,
} from '@/features/insights/model';
import type { BeaconDeps, ReportDeps } from '@/features/insights/server/api';
import type { RawReport } from '@/features/insights/server/db';
import {
  galleryHref,
  galleryPhase,
  GALLERY_PHASES,
} from '@/features/invitations/sections/live-gallery/phase';

/**
 * The invitation's insights without a browser or a database: what a page load reports and how its
 * source and device are read, the beacon's validation and every reason it is refused or quietly left
 * out (privacy signals, crawlers, the flag, the rate limit), the daily numbers added up into the
 * funnel, the median time and the breakdowns — and the gallery section's phases (before / during /
 * after the event). The SQL: tests/db/insights.test.ts.
 */

vi.mock('server-only', () => ({}));
const { beacon, insightsView, isResult, memo } = await import('@/features/insights/server/api');

const INV = '0b6f1a4e-6c1e-4d0e-9a3a-2f1d8c7b6a50';
const OWNER = '6a1f0c3e-0d7b-4e44-9c55-1f2e3d4c5b6a';
const PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const state = (over: Partial<BeaconState> = {}): BeaconState => ({
  slug: 'noa-itay',
  visit: randomUUID(),
  lang: 'he',
  device: 'phone',
  source: 'personal',
  opened: true,
  depth: 50,
  visibleMs: 42_000,
  rsvpStarted: false,
  rsvpSent: false,
  calendar: false,
  map: false,
  gallery: false,
  langSwitch: false,
  ...over,
});

// ─── what a page load reports ───────────────────────────────────────────────────────────────────

describe('what a page load reports', () => {
  it('records events as they happen (a reply is also a started RSVP)', () => {
    const s = state();
    expect(withEvent(s, 'calendar').calendar).toBe(true);
    expect(withEvent(s, 'map').map).toBe(true);
    expect(withEvent(s, 'gallery').gallery).toBe(true);
    expect(withEvent(s, 'lang').langSwitch).toBe(true);
    expect(withEvent(s, 'rsvp_start')).toMatchObject({ rsvpStarted: true, rsvpSent: false });
    expect(withEvent(s, 'rsvp_sent')).toMatchObject({ rsvpStarted: true, rsvpSent: true });
    // the state it came from is untouched
    expect(s.calendar).toBe(false);
  });

  it('reads scroll milestones (the last few pixels count as the end)', () => {
    expect(milestoneOf(0, 4000)).toBe(0);
    expect(milestoneOf(1000, 4000)).toBe(25);
    expect(milestoneOf(2100, 4000)).toBe(50);
    expect(milestoneOf(3100, 4000)).toBe(75);
    expect(milestoneOf(3900, 4000)).toBe(100);
    expect(milestoneOf(10, 0)).toBe(0);
  });

  it('tells a personal link, a QR code, a shared link and another site apart', () => {
    const own = 'invitations.badooks.com';
    expect(sourceOf('?g=AbCdEfGhIjKlMnOpQr', '', own)).toBe('personal');
    expect(sourceOf('?g=short', '', own)).toBe('shared');
    expect(sourceOf('?src=qr', '', own)).toBe('qr');
    expect(sourceOf('', '', own)).toBe('shared');
    expect(sourceOf('', 'https://web.whatsapp.com/', own)).toBe('shared');
    expect(sourceOf('', 'https://l.facebook.com/l.php', own)).toBe('shared');
    expect(sourceOf('', 'https://www.google.com/', own)).toBe('other');
    expect(sourceOf('', `https://${own}/app`, own)).toBe('other');
    expect(sourceOf('', 'not a url', own)).toBe('shared');
  });

  it('tells a phone, a tablet and a computer apart, and spots crawlers', () => {
    expect(deviceOf({ ua: PHONE_UA })).toBe('phone');
    expect(deviceOf({ ua: DESKTOP_UA })).toBe('desktop');
    expect(deviceOf({ ua: DESKTOP_UA, mobile: true })).toBe('phone');
    expect(deviceOf({ ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)' })).toBe('tablet');
    expect(deviceOf({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPoints: 5 })).toBe(
      'tablet',
    );
    expect(deviceOf({ ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36' })).toBe('tablet');
    expect(deviceOf({ ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36' })).toBe('phone');
    for (const bot of [
      'Googlebot/2.1',
      'WhatsApp/2.23.20',
      'facebookexternalhit/1.1',
      'HeadlessChrome/141',
      'curl/8.5',
    ])
      expect(BOT_UA.test(bot)).toBe(true);
    expect(BOT_UA.test(PHONE_UA)).toBe(false);
  });

  it('the beacon’s payload: exactly the fields, within their ranges', () => {
    const ok = state();
    expect(BeaconSchema.safeParse(ok).success).toBe(true);
    expect(BeaconSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(BeaconSchema.safeParse({ ...ok, visit: 'not-a-uuid' }).success).toBe(false);
    expect(BeaconSchema.safeParse({ ...ok, depth: 60 }).success).toBe(false);
    expect(BeaconSchema.safeParse({ ...ok, visibleMs: INSIGHTS.beacon.maxVisibleMs + 1 }).success).toBe(
      false,
    );
    expect(BeaconSchema.safeParse({ ...ok, slug: 'Noa Itay' }).success).toBe(false);
    expect(BeaconSchema.safeParse({ ...ok, source: 'ads' }).success).toBe(false);
    expect(BeaconSchema.safeParse({ ...ok, lang: 'heb' }).success).toBe(false);
    // what a page sends always fits the size cap
    expect(JSON.stringify(ok).length).toBeLessThan(INSIGHTS.beacon.maxBytes);
  });
});

// ─── the beacon's API ───────────────────────────────────────────────────────────────────────────

function beaconWorld(opts: { analytics?: boolean; rate?: boolean; slug?: boolean } = {}) {
  const hits: unknown[][] = [];
  const deps: BeaconDeps = {
    db: {
      invitation: vi.fn(async () => (opts.slug === false ? null : { id: INV, timezone: 'Asia/Jerusalem' })),
      hit: vi.fn(async (...args: unknown[]) => {
        hits.push(args);
        return opts.rate === false ? { ok: false, code: 'rate' } : { ok: true };
      }),
    },
    analytics: vi.fn(async () => opts.analytics ?? true),
    rateKey: (ip) => `hashed:${ip === null ? 'none' : ip.length}`,
    // 23:30 in UTC is already the next day in Israel
    now: () => Date.parse('2026-09-26T23:30:00Z'),
  };
  return { deps, hits };
}
const req = (over: Partial<Parameters<typeof beacon>[1]> = {}) => ({
  ip: '203.0.113.9',
  userAgent: PHONE_UA,
  gpc: false,
  dnt: false,
  ...over,
});

describe('the beacon', () => {
  it('counts a page load on the event’s day, keeping neither the address nor the browser', async () => {
    const w = beaconWorld();
    const s = state();
    expect(await beacon(s, req(), w.deps)).toEqual({ status: 204, body: {} });
    expect(w.hits).toHaveLength(1);
    const [id, visit, day, kept, key] = w.hits[0]!;
    expect([id, visit, day]).toEqual([INV, s.visit, '2026-09-27']);
    expect(kept).not.toHaveProperty('slug');
    expect(kept).not.toHaveProperty('visit');
    expect(JSON.stringify(w.hits)).not.toContain('203.0.113.9');
    expect(JSON.stringify(w.hits)).not.toContain('iPhone');
    expect(key).toBe('hashed:11');
  });

  it('records nothing under GPC or Do Not Track, or for crawlers — and answers the same', async () => {
    for (const r of [
      req({ gpc: true }),
      req({ dnt: true }),
      req({ userAgent: 'Googlebot/2.1' }),
      req({ userAgent: '' }),
    ]) {
      const w = beaconWorld();
      expect(await beacon(state(), r, w.deps)).toEqual({ status: 204, body: {} });
      expect(w.deps.db.invitation).not.toHaveBeenCalled();
      expect(w.hits).toHaveLength(0);
    }
  });

  it('refuses a bad payload, an unknown invitation, the flag off, and past the rate limit', async () => {
    const w = beaconWorld();
    expect((await beacon({ ...state(), depth: 33 }, req(), w.deps)).status).toBe(400);
    // a page the insights don't count (the site's samples): quietly taken, nothing recorded
    const sample = beaconWorld({ slug: false });
    expect((await beacon(state(), req(), sample.deps)).status).toBe(204);
    expect(sample.hits).toHaveLength(0);
    const off = beaconWorld({ analytics: false });
    expect(await beacon(state(), req(), off.deps)).toMatchObject({
      status: 403,
      body: { code: 'feature_off' },
    });
    expect(off.hits).toHaveLength(0);
    expect((await beacon(state(), req(), beaconWorld({ rate: false }).deps)).status).toBe(429);
  });

  it('memo keeps an answer for a while, then asks again', async () => {
    const load = vi.fn(async (k: string) => `${k}!`);
    const get = memo(1000, load);
    expect(await get('a', 0)).toBe('a!');
    expect(await get('a', 500)).toBe('a!');
    expect(load).toHaveBeenCalledTimes(1);
    expect(await get('a', 1500)).toBe('a!');
    expect(load).toHaveBeenCalledTimes(2);
  });
});

// ─── the numbers the host sees ──────────────────────────────────────────────────────────────────

const day = (d: string, over: Partial<DayRow> = {}): DayRow => ({
  day: d,
  visits: 0,
  opened: 0,
  readEnd: 0,
  rsvpStarted: 0,
  rsvpSent: 0,
  calendar: 0,
  map: 0,
  gallery: 0,
  langSwitch: 0,
  depth: {},
  byLang: {},
  bySource: {},
  byDevice: {},
  timeHist: {},
  ...over,
});

describe('the numbers the host sees', () => {
  const days = [
    day('2026-09-20', {
      visits: 10,
      opened: 9,
      readEnd: 6,
      rsvpStarted: 4,
      rsvpSent: 3,
      calendar: 2,
      depth: { '25': 9, '50': 8, '75': 7, '100': 6 },
      byLang: { he: { visits: 8, sent: 3 }, en: { visits: 2 } },
      bySource: { personal: { visits: 6, sent: 3 }, qr: { visits: 1 }, shared: { visits: 3 } },
      byDevice: { phone: { visits: 9, sent: 3 }, desktop: { visits: 1 } },
      timeHist: { '0': 2, '30': 5, '60': 3 },
    }),
    day('2026-09-22', {
      visits: 5,
      opened: 5,
      readEnd: 4,
      rsvpStarted: 3,
      rsvpSent: 2,
      depth: { '25': 5, '50': 5, '75': 4, '100': 4 },
      byLang: { he: { visits: 5, sent: 2 } },
      bySource: { personal: { visits: 5, sent: 2 } },
      byDevice: { phone: { visits: 5, sent: 2 } },
      timeHist: { '60': 5 },
    }),
  ];

  it('adds the days up', () => {
    const t = totalsOf(days);
    expect(t).toMatchObject({
      visits: 15,
      opened: 14,
      readEnd: 10,
      rsvpStarted: 7,
      rsvpSent: 5,
      calendar: 2,
    });
    expect(t.depth).toEqual({ 25: 14, 50: 13, 75: 11, 100: 10 });
    expect(t.byLang).toEqual({ he: { visits: 13, sent: 5 }, en: { visits: 2, sent: 0 } });
    expect(t.timeHist).toEqual({ '0': 2, '30': 5, '60': 8 });
    expect(totalsOf([]).visits).toBe(0);
  });

  it('the funnel: each step of the visits and of the step before', () => {
    const f = funnelOf(totalsOf(days));
    expect(f.map((s) => s.key)).toEqual(['opened', 'readEnd', 'rsvpStarted', 'rsvpSent']);
    expect(f.map((s) => s.count)).toEqual([14, 10, 7, 5]);
    expect(f[0]!.ofVisits).toBeCloseTo(14 / 15, 6);
    expect(f[1]!.ofPrevious).toBeCloseTo(10 / 14, 6);
    expect(f[3]!.ofVisits).toBeCloseTo(5 / 15, 6);
    expect(f[3]!.ofPrevious).toBeCloseTo(5 / 7, 6);
    // no visits: all zero, never a division by zero
    expect(
      funnelOf({ visits: 0, opened: 0, readEnd: 0, rsvpStarted: 0, rsvpSent: 0 }).every(
        (s) => s.ofVisits === 0,
      ),
    ).toBe(true);
  });

  it('the median time: inside the bucket that holds the middle page load', () => {
    // 15 loads: 2 in 0–5 s, 5 in 30–45 s, 8 in 60–90 s → the 7.5th is half a load into 60–90
    expect(medianSeconds({ '0': 2, '30': 5, '60': 8 })).toBe(Math.round(60 + ((7.5 - 7) / 8) * 30));
    expect(medianSeconds({ '0': 2, '30': 5, '60': 1 })).toBe(Math.round(30 + ((4 - 2) / 5) * 15));
    expect(medianSeconds({})).toBeNull();
    // everyone at the cap
    expect(medianSeconds({ '1800': 3 })).toBe(1800);
  });

  it('breakdowns: largest first (or in the given order), with shares', () => {
    const t = totalsOf(days);
    const langs = breakdownOf(t.byLang);
    expect(langs.map((b) => b.key)).toEqual(['he', 'en']);
    expect(langs[0]!.share).toBeCloseTo(13 / 15, 6);
    const sources = breakdownOf(t.bySource, ['personal', 'shared', 'qr', 'other']);
    expect(sources.map((b) => b.key)).toEqual(['personal', 'shared', 'qr']);
  });

  it('days in the event’s zone, and every day of a range in the series', () => {
    expect(dayIn(Date.parse('2026-09-26T21:30:00Z'), 'Asia/Jerusalem')).toBe('2026-09-27');
    expect(dayIn(Date.parse('2026-09-26T21:30:00Z'), 'Not/AZone')).toBe('2026-09-26');
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(daysBetween('2026-10-02', '2026-09-29')).toEqual([]);
    expect(minusDays('2026-10-01', 2)).toBe('2026-09-29');
    const series = seriesOf(days, [{ day: '2026-09-21', n: 4 }], '2026-09-20', '2026-09-22');
    expect(series).toEqual([
      { day: '2026-09-20', visits: 10, replies: 3, personal: 0 },
      { day: '2026-09-21', visits: 0, replies: 0, personal: 4 },
      { day: '2026-09-22', visits: 5, replies: 2, personal: 0 },
    ]);
  });
});

describe('the host’s report', () => {
  const raw: RawReport = {
    status: 'published',
    timezone: 'Asia/Jerusalem',
    from: '2026-09-20',
    to: '2026-09-22',
    eventDate: '2026-10-15',
    publishedAt: '2026-09-19T10:00:00Z',
    days: [
      day('2026-09-20', {
        visits: 4,
        opened: 4,
        readEnd: 2,
        rsvpStarted: 1,
        rsvpSent: 1,
        timeHist: { '30': 4 },
      }),
    ],
    personal: { guests: 20, sent: 18, opened: 9, opens: 12, firstOpens: [{ day: '2026-09-20', n: 3 }] },
    responses: { total: 5, attending: 4 },
    gallery: null,
  };
  const deps = (over: Partial<FeatureInput> = {}): ReportDeps => ({
    db: { report: vi.fn(async () => raw) },
    featureInput: vi.fn(async () => ({
      ownerId: OWNER,
      plan: 'free' as const,
      admin: false,
      overrides: NO_OVERRIDES,
      available: new Set(FEATURES),
      ...over,
    })),
  });

  it('is the owner’s only, for the ranges offered, and only while the feature is on', async () => {
    const view = await insightsView(OWNER, INV, { range: '30' }, deps());
    expect(view && !isResult(view)).toBe(true);
    if (!view || isResult(view)) return;
    expect(view.funnel.map((s) => s.count)).toEqual([4, 2, 1, 1]);
    expect(view.medianSeconds).toBe(38);
    expect(view.series).toHaveLength(3);
    expect(view.series[0]!.personal).toBe(3);
    expect(await insightsView(randomUUID(), INV, {}, deps())).toBeNull();
    expect(await insightsView(OWNER, 'nope', {}, deps())).toBeNull();
    expect(await insightsView(OWNER, INV, { range: '12' }, deps())).toMatchObject({ status: 400 });
    expect(
      await insightsView(OWNER, INV, {}, deps({ overrides: { off: ['analytics'], grant: [] } })),
    ).toMatchObject({
      status: 403,
      body: { code: 'feature_off', reason: 'switched_off' },
    });
  });
});

// ─── the gallery section's phases ───────────────────────────────────────────────────────────────

describe('the gallery section on the invitation', () => {
  const start = Date.parse('2026-10-15T16:30:00Z');
  const end = Date.parse('2026-10-15T22:00:00Z');
  const H = 3_600_000;

  it('invites before, asks for photos around the event, and leads to the album after', () => {
    expect(galleryPhase(start - 24 * H, start, end)).toBe('before');
    expect(galleryPhase(start - GALLERY_PHASES.duringFrom - 1, start, end)).toBe('before');
    expect(galleryPhase(start - GALLERY_PHASES.duringFrom, start, end)).toBe('during');
    expect(galleryPhase(end + 5 * H, start, end)).toBe('during');
    expect(galleryPhase(end + GALLERY_PHASES.albumAfter, start, end)).toBe('after');
    // an end before the start (past midnight, not resolved): measured from the start
    expect(galleryPhase(start + 2 * H, start, start - H)).toBe('during');
  });

  it('keeps the guest’s personal link on the gallery’s address', () => {
    const url = 'https://invitations.badooks.com/e/noa-itay/upload?t=AbCdEfGhIjKlMnOpQrStUvWx';
    expect(galleryHref(url, 'GuestToken_0123456789')).toBe(`${url}&g=GuestToken_0123456789`);
    expect(galleryHref(url, null)).toBe(url);
    expect(galleryHref(url, 'bad token!')).toBe(url);
  });
});
