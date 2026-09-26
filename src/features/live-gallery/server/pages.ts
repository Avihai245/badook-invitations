import 'server-only';
import type { Palette } from '@/features/invitations/contracts/types';
import { hostsLine } from '@/features/invitations/lib/text';
import { resolvePalette } from '@/features/invitations/renderer/theme';
import { getTemplate } from '@/features/invitations/templates/registry';
import { serverEnv } from '@/lib/env';
import { GALLERY } from '../config';
import type { EventInfo, FeedResponse, FeedItem, GalleryState, HostItem, RealtimeInfo } from '../types';
import { galleryDb, type TokenLookup } from './db';
import { guestDeps, hostGalleryDeps } from './deps';
import { guestFeed, projectorFeed, resolve } from './guest-api';
import { hostView, listItems, type HostGalleryView } from './host-api';

/** What the gallery's pages need on their first render (the pages fetch the rest themselves). */

type UiLocale = 'he' | 'en';
const isUiLocale = (v: unknown): v is UiLocale => v === 'he' || v === 'en';

function eventInfo(
  inv: TokenLookup['invitation'],
): EventInfo & { titles: Partial<Record<UiLocale, string>> } {
  const locales = (inv.locales ?? []).filter(isUiLocale);
  const defaultLocale = isUiLocale(inv.defaultLocale) ? inv.defaultLocale : (locales[0] ?? 'he');
  const titles: Partial<Record<UiLocale, string>> = {};
  if (inv.hosts)
    for (const l of locales.length ? locales : [defaultLocale]) titles[l] = hostsLine(inv.hosts, l) || '';
  let palette: Palette | null = null;
  const template = getTemplate(inv.templateId)?.manifest;
  if (template)
    palette = resolvePalette(template, {
      theme: { fontPairId: '', palette: (inv.palette as Partial<Palette> | null) ?? null },
    });
  return {
    title: titles[defaultLocale] ?? '',
    titles,
    eventType: inv.eventType,
    date: inv.date,
    locales: locales.length ? locales : [defaultLocale],
    defaultLocale,
    accent: palette?.accent ?? '#1C1917',
    accentInk: palette?.accentInk ?? '#FFFFFF',
  };
}

export interface GuestPageData {
  slug: string;
  event: EventInfo & { titles: Partial<Record<UiLocale, string>> };
  state: GalleryState;
  mode: 'instant' | 'approval';
  opensAt: string | null;
  closesAt: string | null;
  needsCode: boolean;
  /** the feed's first page, when no code stands in the way */
  initial: FeedResponse | null;
  brand: string;
  limits: { imageBytes: number; videoBytes: number; videoMinutes: number };
}

/** /e/<slug>/upload?t= — null for a link that opens nothing. */
export async function guestPage(token: string): Promise<GuestPageData | null> {
  const deps = guestDeps();
  const r = await resolve(token, 'upload', deps);
  if (!r) return null;
  const g = r.lookup.gallery;
  const needsCode = !!g.accessCodeHash;
  let initial: FeedResponse | null = null;
  if (!needsCode && r.state !== 'off') {
    const res = await guestFeed({ t: token }, null, deps);
    if (res.status === 200) initial = res.body as unknown as FeedResponse;
  }
  return {
    slug: r.lookup.invitation.slug,
    event: eventInfo(r.lookup.invitation),
    state: r.state,
    mode: g.mode,
    opensAt: g.opensAt,
    closesAt: g.closesAt,
    needsCode,
    initial,
    brand: serverEnv().INVITES_BRAND_NAME,
    limits: {
      imageBytes: GALLERY.limits.imageBytes,
      videoBytes: GALLERY.limits.videoBytes,
      videoMinutes: Math.round(GALLERY.limits.videoMs / 60_000),
    },
  };
}

export interface ProjectorPageData {
  slug: string;
  event: EventInfo & { titles: Partial<Record<UiLocale, string>> };
  state: GalleryState;
  items: FeedItem[];
  now: string;
  realtime: RealtimeInfo | null;
  expiresAt: number;
}

/** /e/<slug>/projector?t= — null for a link that opens nothing. */
export async function projectorPage(token: string): Promise<ProjectorPageData | null> {
  const deps = guestDeps();
  const r = await resolve(token, 'projector', deps);
  if (!r) return null;
  const res = await projectorFeed({ p: token }, deps);
  const body = res.body as {
    state: GalleryState;
    items: FeedItem[];
    now: string;
    realtime: RealtimeInfo | null;
    expiresAt: number;
  };
  return {
    slug: r.lookup.invitation.slug,
    event: eventInfo(r.lookup.invitation),
    state: body.state ?? r.state,
    items: body.items ?? [],
    now: body.now ?? new Date().toISOString(),
    realtime: body.realtime ?? null,
    expiresAt: body.expiresAt ?? 0,
  };
}

/** The languages of the invitation behind a slug (the gallery pages' <html lang dir>). */
export async function slugLocale(slug: string): Promise<UiLocale> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return 'he';
  try {
    const found = await galleryDb.slugLocale(slug);
    return isUiLocale(found?.defaultLocale) ? found.defaultLocale : 'he';
  } catch {
    return 'he';
  }
}

export interface HostPageData {
  view: HostGalleryView;
  /** the review queue and the first page of everything */
  pending: HostItem[];
  items: HostItem[];
  next: { at: string; id: string } | null;
  expiresAt: number;
}

/** The "Gallery" tab of an invitation (null when it isn't the host's). */
export async function hostPage(userId: string, id: string, base: string): Promise<HostPageData | null> {
  const deps = hostGalleryDeps();
  const view = await hostView(userId, id, base, deps);
  if (!view) return null;
  if (!view.gallery) return { view, pending: [], items: [], next: null, expiresAt: 0 };
  const [pending, all] = await Promise.all([
    listItems(userId, id, { status: 'pending' }, deps),
    listItems(userId, id, { status: 'all' }, deps),
  ]);
  const p = pending.body as { items?: HostItem[] };
  const a = all.body as { items?: HostItem[]; next?: { at: string; id: string } | null; expiresAt?: number };
  return {
    view,
    pending: p.items ?? [],
    items: a.items ?? [],
    next: a.next ?? null,
    expiresAt: a.expiresAt ?? 0,
  };
}
