import 'server-only';
import { featureInput, featuresFor } from '@/features/flags/server';
import { eventInfo } from '@/features/live-gallery/server/pages';
import type { EventInfo } from '@/features/live-gallery/types';
import type { Point } from '@/features/seating/geometry';
import { planBaseUrl } from '@/features/seating/server';
import { realtimeInfo } from '@/lib/live/broadcast';
import type { RealtimeInfo } from '@/lib/live/types';
import { qrPayload } from '../codes';
import { readHall, readTable, type Hall, type RecentCheckin, type Told, type Totals } from '../model';
import { findRoute } from '../route';
import { eventDayDb } from './db';
import { featureStates, type DayFeatures } from './host-api';
import { tableTemplateReady } from './notify';
import { checkinCode, rateKey, sha256Hex, STATION_TOKEN_RE } from './tokens';
import { qrSvg } from './deps';

/** What the event day's pages need on their first render (the pages fetch the rest themselves). */

export type DayEvent = EventInfo & { titles: Partial<Record<'he' | 'en', string>> };

// ─── the guest's table guide ────────────────────────────────────────────────────────────────────

export interface GuidePageData {
  slug: string;
  event: DayEvent;
  /** the event's start (the guide says when the doors open) */
  startTime: string | null;
  guestName: string;
  /** seated: at a table; waiting: coming, no table yet; declined: said they can't come */
  state: 'seated' | 'waiting' | 'declined';
  /** the people their family was given seats for */
  seats: number;
  /** how many of them were checked in at the entrance */
  arrived: number;
  table: { id: string; number: number; label: string | null } | null;
  /** the hall: the plan (a public image), landmarks and every table's place and number */
  hall: Hall & { planUrl: string | null };
  /** the walk from the entrance to the table (null: no entrance drawn, or no table) */
  route: { points: Point[]; length: number } | null;
  /** their entrance code and its QR (when the event checks guests in at the door) */
  checkin: { code: string; qr: string } | null;
  /** back to their invitation (their personal link) */
  inviteUrl: string;
}

export const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const SLUG_RE = /^[a-z0-9-]{3,60}$/;

/**
 * /e/<slug>/table?g=<their personal link's token> — a guest's own table and the map to it. Needs the
 * event's `seating_guide`; `checkin` adds their entrance QR.
 */
export async function guidePage(
  slug: string,
  token: string,
  ip: string | null,
): Promise<{ ok: true; data: GuidePageData } | { ok: false; code: 'not_found' | 'rate' }> {
  if (!SLUG_RE.test(slug) || !GUEST_TOKEN_RE.test(token)) return { ok: false, code: 'not_found' };
  const row = await eventDayDb.guide(slug, sha256Hex(token), rateKey('guide', ip ?? 'unknown'));
  if (!row) return { ok: false, code: 'not_found' };
  if (!row.ok) return { ok: false, code: 'rate' };
  const features = await featuresFor(row.invitation.id);
  if (!features.has('seating_guide')) return { ok: false, code: 'not_found' };
  const hall = readHall(row.layout, row.tables);
  const table = row.table ? readTable(row.table) : null;
  const route = table ? findRoute(hall, table.id) : null;
  const base = planBaseUrl();
  const code = features.has('checkin') ? checkinCode(token) : null;
  const status = row.unit?.status ?? 'pending';
  return {
    ok: true,
    data: {
      slug: row.invitation.slug,
      event: eventInfo(row.invitation),
      startTime: row.invitation.startTime,
      guestName: row.guest.name,
      state: status === 'declined' ? 'declined' : table ? 'seated' : 'waiting',
      seats: row.unit?.seats ?? 0,
      arrived: row.arrived,
      table: table ? { id: table.id, number: table.number, label: table.label ?? null } : null,
      hall: { ...hall, planUrl: hall.background && base ? `${base}/${hall.background.path}` : null },
      route: route ? { points: route.points, length: route.length } : null,
      checkin: code ? { code, qr: await qrSvg(qrPayload(code)) } : null,
      inviteUrl: `/i/${row.invitation.slug}?g=${token}`,
    },
  };
}

// ─── the entrance station ───────────────────────────────────────────────────────────────────────

export interface StationPageData {
  slug: string;
  event: DayEvent;
  /** the event's time zone (the arrivals' times are the venue's) */
  timezone: string | null;
  totals: Totals;
  recent: RecentCheckin[];
  realtime: RealtimeInfo | null;
}

/** /e/<slug>/station?t=<the station link's token> — null for a link that opens nothing. */
export async function stationPage(
  token: string,
  ip: string | null,
): Promise<StationPageData | 'rate' | null> {
  if (!STATION_TOKEN_RE.test(token)) return null;
  const hash = sha256Hex(token);
  const link = await eventDayDb.stationLink(hash);
  if (!link || !(await featuresFor(link.invitationId)).has('checkin')) return null;
  const open = await eventDayDb.stationOpen(hash, rateKey('station', ip ?? 'unknown'));
  if (!open) return null;
  if (!open.ok) return 'rate';
  return {
    slug: open.invitation.slug,
    event: eventInfo(open.invitation),
    timezone: open.invitation.timezone,
    totals: open.totals,
    recent: open.recent,
    realtime: realtimeInfo(open.channel),
  };
}

/** The main language of the invitation behind a slug (the pages' <html lang dir>; they switch in place). */
export async function slugLanguage(slug: string): Promise<'he' | 'en'> {
  if (!SLUG_RE.test(slug)) return 'he';
  try {
    return (await eventDayDb.slugLocale(slug)) === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

// ─── the seating screen ─────────────────────────────────────────────────────────────────────────

export interface SeatingDayInfo {
  features: DayFeatures;
  /** what each family was told (the freeze) */
  told: Record<string, Told>;
  /** the system's number can send table numbers */
  notifyReady: boolean;
}

/** What the seating screen needs of the event day (null: not the host's event). */
export async function seatingDayInfo(userId: string, id: string): Promise<SeatingDayInfo | null> {
  const [input, state] = await Promise.all([featureInput(id), eventDayDb.notices(id, userId)]);
  if (!input || input.ownerId !== userId || !state) return null;
  const told: Record<string, Told> = {};
  for (const r of state.rows) if (r.told) told[r.unitId] = r.told;
  return { features: featureStates(input), told, notifyReady: tableTemplateReady() };
}
