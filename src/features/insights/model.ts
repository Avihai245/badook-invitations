import { INSIGHTS, type Milestone } from './config';

/**
 * The invitation's insights as plain data and math (isomorphic, tested in tests/unit/insights.test.ts):
 * what one page load reports, where it came from and on what kind of device, and — from the daily
 * numbers the server keeps — the funnel, the median time on the page, and the breakdowns the host sees.
 */

export const DEVICES = ['phone', 'tablet', 'desktop'] as const;
export type Device = (typeof DEVICES)[number];
export const SOURCES = ['personal', 'shared', 'qr', 'other'] as const;
export type Source = (typeof SOURCES)[number];

/** What a page load reports: always its whole state so far (a lost beacon loses nothing). */
export interface BeaconState {
  /** the invitation's slug */
  slug: string;
  /** the page load's random id (in the page's memory only) */
  visit: string;
  lang: string;
  device: Device;
  source: Source;
  opened: boolean;
  depth: 0 | Milestone;
  visibleMs: number;
  rsvpStarted: boolean;
  rsvpSent: boolean;
  calendar: boolean;
  map: boolean;
  gallery: boolean;
  langSwitch: boolean;
}

/** The events the page reports as they happen (data-insight attributes, the RSVP form's success). */
export const INSIGHT_EVENTS = ['calendar', 'map', 'gallery', 'lang', 'rsvp_start', 'rsvp_sent'] as const;
export type InsightEvent = (typeof INSIGHT_EVENTS)[number];

/** The state after an event. */
export function withEvent(state: BeaconState, event: InsightEvent): BeaconState {
  switch (event) {
    case 'calendar':
      return { ...state, calendar: true };
    case 'map':
      return { ...state, map: true };
    case 'gallery':
      return { ...state, gallery: true };
    case 'lang':
      return { ...state, langSwitch: true };
    case 'rsvp_start':
      return { ...state, rsvpStarted: true };
    case 'rsvp_sent':
      return { ...state, rsvpStarted: true, rsvpSent: true };
  }
}

/** The deepest milestone a scroll position reached (the page's bottom counts as 100). */
export function milestoneOf(scrolledTo: number, pageHeight: number): 0 | Milestone {
  if (!(pageHeight > 0)) return 0;
  const fraction = Math.min(1, Math.max(0, scrolledTo / pageHeight));
  // the last few pixels of a page are often out of reach (a floating bar, rounding): 97% is the end
  if (fraction >= 0.97) return 100;
  let reached: 0 | Milestone = 0;
  for (const m of INSIGHTS.milestones) if (fraction * 100 >= m) reached = m;
  return reached;
}

const GUEST_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
/** Messaging and social apps: a link opened from them was shared with the guest. */
const SHARED_HOSTS =
  /(^|\.)(whatsapp\.com|wa\.me|t\.me|telegram\.org|facebook\.com|messenger\.com|fb\.me|instagram\.com|linkedin\.com|lnkd\.in|mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com)$/i;

/**
 * Where a page load came from: a guest's personal link (?g=), a QR code the app made (?src=qr), a link
 * shared in a message (no referrer — chat and mail apps send none — or a messaging or social site), or
 * another website.
 */
export function sourceOf(search: string, referrer: string, ownHost: string): Source {
  const q = new URLSearchParams(search);
  const g = q.get('g');
  if (g && GUEST_TOKEN.test(g)) return 'personal';
  if (q.get('src') === 'qr') return 'qr';
  if (!referrer) return 'shared';
  let host: string;
  try {
    host = new URL(referrer).hostname;
  } catch {
    return 'shared';
  }
  if (host === ownHost) return 'other';
  return SHARED_HOSTS.test(host) ? 'shared' : 'other';
}

/** A phone, a tablet or a computer, from what the browser says about itself. */
export function deviceOf(input: { ua: string; mobile?: boolean | null; touchPoints?: number }): Device {
  const { ua, mobile, touchPoints = 0 } = input;
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  // iPadOS asks for the desktop site: a "Macintosh" with a touch screen
  if (/Macintosh/i.test(ua) && touchPoints > 1) return 'tablet';
  if (mobile === true || /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'phone';
  return 'desktop';
}

/** Crawlers, link previews and headless browsers: never counted. */
export const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headlesschrome|phantomjs|lighthouse|pagespeed|curl|wget|python-requests|go-http-client|node-fetch|axios/i;

// ─── the daily numbers and what the host sees ───────────────────────────────────────────────────

export interface Tally {
  visits: number;
  sent: number;
}

/** One day as the server keeps it. */
export interface DayRow {
  day: string;
  visits: number;
  opened: number;
  readEnd: number;
  rsvpStarted: number;
  rsvpSent: number;
  calendar: number;
  map: number;
  gallery: number;
  langSwitch: number;
  depth: Partial<Record<string, number>>;
  byLang: Record<string, Partial<Tally>>;
  bySource: Record<string, Partial<Tally>>;
  byDevice: Record<string, Partial<Tally>>;
  timeHist: Partial<Record<string, number>>;
}

export interface Totals {
  visits: number;
  opened: number;
  readEnd: number;
  rsvpStarted: number;
  rsvpSent: number;
  calendar: number;
  map: number;
  gallery: number;
  langSwitch: number;
  depth: Record<Milestone, number>;
  byLang: Record<string, Tally>;
  bySource: Record<string, Tally>;
  byDevice: Record<string, Tally>;
  timeHist: Record<string, number>;
}

const COUNTERS = [
  'visits',
  'opened',
  'readEnd',
  'rsvpStarted',
  'rsvpSent',
  'calendar',
  'map',
  'gallery',
  'langSwitch',
] as const;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function addTally(into: Record<string, Tally>, from: Record<string, Partial<Tally>> | undefined) {
  for (const [key, t] of Object.entries(from ?? {})) {
    const cur = (into[key] ??= { visits: 0, sent: 0 });
    cur.visits += num(t?.visits);
    cur.sent += num(t?.sent);
  }
}

/** Every day added up. */
export function totalsOf(days: readonly DayRow[]): Totals {
  const out: Totals = {
    visits: 0,
    opened: 0,
    readEnd: 0,
    rsvpStarted: 0,
    rsvpSent: 0,
    calendar: 0,
    map: 0,
    gallery: 0,
    langSwitch: 0,
    depth: { 25: 0, 50: 0, 75: 0, 100: 0 },
    byLang: {},
    bySource: {},
    byDevice: {},
    timeHist: {},
  };
  for (const d of days) {
    for (const c of COUNTERS) out[c] += num(d[c]);
    for (const m of INSIGHTS.milestones) out.depth[m] += num(d.depth?.[String(m)]);
    addTally(out.byLang, d.byLang);
    addTally(out.bySource, d.bySource);
    addTally(out.byDevice, d.byDevice);
    for (const [bucket, n] of Object.entries(d.timeHist ?? {}))
      out.timeHist[bucket] = (out.timeHist[bucket] ?? 0) + num(n);
  }
  return out;
}

export interface FunnelStep {
  key: 'opened' | 'readEnd' | 'rsvpStarted' | 'rsvpSent';
  count: number;
  /** of the page loads (0..1) */
  ofVisits: number;
  /** of the step before (0..1; the first step: of the page loads) */
  ofPrevious: number;
}

const share = (n: number, of: number) => (of > 0 ? Math.min(1, n / of) : 0);

/** Opened the invitation → read to the end → started the RSVP → replied, each against the one before. */
export function funnelOf(t: Pick<Totals, 'visits' | 'opened' | 'readEnd' | 'rsvpStarted' | 'rsvpSent'>) {
  const keys = ['opened', 'readEnd', 'rsvpStarted', 'rsvpSent'] as const;
  const steps: FunnelStep[] = [];
  let previous = t.visits;
  for (const key of keys) {
    const count = t[key];
    steps.push({ key, count, ofVisits: share(count, t.visits), ofPrevious: share(count, previous) });
    previous = count;
  }
  return steps;
}

/**
 * The median of the visible time (seconds), from page loads counted per bucket: the bucket that holds
 * the middle page load, interpolated inside it. null without page loads.
 */
export function medianSeconds(hist: Readonly<Record<string, number>>): number | null {
  const bounds = INSIGHTS.buckets;
  const counts = bounds.map((b) => Math.max(0, num(hist[String(b)])));
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const half = total / 2;
  let seen = 0;
  for (let i = 0; i < bounds.length; i++) {
    const n = counts[i]!;
    if (seen + n >= half && n > 0) {
      const lower = bounds[i]!;
      // the last bucket (30 minutes, the cap) has no width
      const upper = bounds[i + 1] ?? lower;
      return Math.round(lower + ((half - seen) / n) * (upper - lower));
    }
    seen += n;
  }
  return bounds[bounds.length - 1]!;
}

export interface Breakdown {
  key: string;
  visits: number;
  sent: number;
  /** of all page loads */
  share: number;
}

/** A dimension's rows, largest first (the listed keys first, in their order, when given). */
export function breakdownOf(tallies: Record<string, Tally>, order?: readonly string[]): Breakdown[] {
  const total = Object.values(tallies).reduce((a, t) => a + t.visits, 0);
  const keys = Object.keys(tallies);
  keys.sort((a, b) => {
    if (order) {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    return tallies[b]!.visits - tallies[a]!.visits || a.localeCompare(b);
  });
  return keys
    .filter((k) => tallies[k]!.visits > 0 || tallies[k]!.sent > 0)
    .map((k) => ({
      key: k,
      visits: tallies[k]!.visits,
      sent: tallies[k]!.sent,
      share: share(tallies[k]!.visits, total),
    }));
}

/** 'YYYY-MM-DD' of `ms` in a time zone (UTC when it isn't one). */
export function dayIn(ms: number, timeZone: string): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  try {
    return format(timeZone);
  } catch {
    return format('UTC');
  }
}

/** The days from `from` to `to` (inclusive, 'YYYY-MM-DD'), at most `max`. */
export function daysBetween(from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return out;
  for (let t = start; t <= end && out.length < max; t += 86_400_000)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export interface SeriesPoint {
  day: string;
  visits: number;
  replies: number;
  /** personal links opened for the first time that day */
  personal: number;
}

/** One point per day of the range (days without page loads are zero). */
export function seriesOf(
  days: readonly DayRow[],
  firstOpens: readonly { day: string; n: number }[],
  from: string,
  to: string,
): SeriesPoint[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const opens = new Map(firstOpens.map((o) => [o.day, o.n]));
  return daysBetween(from, to).map((day) => ({
    day,
    visits: num(byDay.get(day)?.visits),
    replies: num(byDay.get(day)?.rsvpSent),
    personal: num(opens.get(day)),
  }));
}

/** 'YYYY-MM-DD' minus n days. */
export function minusDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}
