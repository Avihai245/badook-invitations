import type { MediaKind } from './config';
import type { ItemStatus, Reason } from './moderation';

/** What the gallery's pages and API exchange (isomorphic). */

/**
 * Where the gallery stands for guests: open for uploads, paused by the host, not open yet, closed
 * (the upload window ended — the feed stays), or off (the host turned it off, the invitation was
 * archived, or the plan no longer includes it).
 */
export type GalleryState = 'open' | 'paused' | 'scheduled' | 'ended' | 'off';

/** A photo or video in the feed, as guests and the screen get it: signed URLs, no paths, no scores. */
export interface FeedItem {
  id: string;
  kind: MediaKind;
  thumb: string | null;
  display: string | null;
  /** a video's file */
  video: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  takenAt: string | null;
  /** when it entered the feed */
  at: string;
  name: string | null;
}

/** One of this device's own uploads and where it stands. */
export interface MineItem {
  id: string;
  kind: MediaKind;
  status: ItemStatus;
  reason: Reason | null;
  thumb: string | null;
  createdAt: string;
}

/** Realtime hints: where to listen (the channel is only given to pages that may see the gallery). */
export interface RealtimeInfo {
  url: string;
  key: string;
  channel: string;
}

export interface EventInfo {
  /** the names ("Noa & Itay") in the page's language */
  title: string;
  eventType: string;
  date: string | null;
  locales: ('he' | 'en')[];
  defaultLocale: 'he' | 'en';
  /** the design's accent and the text on it, for the page's buttons */
  accent: string;
  accentInk: string;
}

export interface FeedResponse {
  ok: true;
  state: GalleryState;
  mode: 'instant' | 'approval';
  opensAt: string | null;
  closesAt: string | null;
  /** the database's clock: the next refresh asks for what changed since */
  now: string;
  items: FeedItem[];
  removed: string[];
  /** the cursor of the next (older) page, null at the end */
  next: { at: string; id: string } | null;
  mine?: MineItem[];
  realtime: RealtimeInfo | null;
  /** the signed URLs in this answer last until then */
  expiresAt: number;
}

export interface PartTicket {
  bucket: string;
  path: string;
  token: string;
  url: string;
  /** large files: resumable (TUS) upload with the token */
  resumable: { endpoint: string; apiKey: string } | null;
}

export interface ReservedItem {
  key: string;
  id: string;
  parts: Partial<Record<'thumb' | 'display' | 'original', PartTicket>>;
}

/** The host's view of an item: everything, scores and reasons included. */
export interface HostItem extends FeedItem {
  status: ItemStatus;
  reason: Reason | null;
  createdAt: string;
  originalDone: boolean;
  originalSize: number;
  originalType: string;
  sharpness: number | null;
  brightness: number | null;
  aiNsfw: number | null;
  aiQuality: number | null;
  enhanced: boolean;
  guestName: string | null;
}
