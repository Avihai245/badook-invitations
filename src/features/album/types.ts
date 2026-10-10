import type { PlanId } from '@/features/billing/plans';
import type { Package } from '@/features/flags/features';
import type { EventType, Locale, Palette } from '@/features/invitations/contracts/types';
import type { AlbumChapter, AlbumState } from './model';

/** What the album's pages and API exchange (isomorphic). */

/** A photo or video of the album: signed URLs, no paths, no scores. */
export interface AlbumPhoto {
  id: string;
  kind: 'image' | 'video';
  thumb: string | null;
  display: string | null;
  /** a video's file */
  video: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  /** when it was taken, else when it entered the gallery */
  at: string;
  /** the name the guest gave with it */
  name: string | null;
  /** an AI photo a guest made with the people of honor (features/ai-photos) */
  ai?: boolean;
}

export interface AlbumLayout {
  cover: string | null;
  highlights: string[];
  chapters: AlbumChapter[];
}

/** The event as the album shows it: in each of the invitation's languages. */
export interface AlbumEvent {
  eventType: EventType;
  date: string;
  timezone: string;
  locales: Locale[];
  defaultLocale: Locale;
  /** the hosts' names per language ("נועה & איתי") */
  names: Partial<Record<Locale, string>>;
  /** where guests celebrated, per language ("בחתונה שלנו": album/phrases.ts) */
  phrase: Partial<Record<Locale, string>>;
  palette: Pick<Palette, 'bg' | 'surface' | 'ink' | 'inkMuted' | 'accent' | 'accentInk' | 'line'>;
  /** CSS font stacks per language: the names (display) and the titles (heading) */
  fonts: { display: Partial<Record<Locale, string>>; heading: Partial<Record<Locale, string>> };
}

export interface AlbumPageData {
  slug: string;
  state: AlbumState;
  /** when it opens (the morning after, or the hosts' choice) */
  opensAt: string | null;
  event: AlbumEvent;
  /** the hosts' own title and thank-you per language (empty: the defaults) */
  title: Partial<Record<Locale, string>>;
  message: Partial<Record<Locale, string>>;
  items: AlbumPhoto[];
  layout: AlbumLayout;
  /** the signed URLs last until then (ms) */
  expiresAt: number;
  brand: string;
  /** the @font-face rules of the design's fonts (the server page declares them; not sent to the client) */
  fontCss?: string;
}

export interface AlbumFeatureState {
  on: boolean;
  why: 'unavailable' | 'switched_off' | 'plan' | null;
  package: Package;
  plan: PlanId;
}

/** The host's view of the album (the gallery tab's card and the album's studio). */
export interface HostAlbumView {
  id: string;
  slug: string;
  feature: AlbumFeatureState;
  /** the gallery exists (the album is made from it) */
  gallery: boolean;
  album: {
    enabled: boolean;
    state: AlbumState;
    /** when it opens for guests */
    opensAt: string | null;
    /** the hosts chose when (else: the morning after) */
    custom: boolean;
    title: Partial<Record<Locale, string>>;
    message: Partial<Record<Locale, string>>;
    coverItemId: string | null;
    hiddenItems: string[];
    showVideos: boolean;
    chapters: boolean;
    /** null: the server's key changed since the link was made — offer a new one */
    url: string | null;
    qr: { svg: string; png: string } | null;
  } | null;
  counts: { images: number; videos: number };
  event: Pick<AlbumEvent, 'eventType' | 'date' | 'locales' | 'defaultLocale' | 'names' | 'phrase'>;
}

/** An item in the hosts' studio: the album's photo, whether it is left out, and its score. */
export interface StudioItem extends AlbumPhoto {
  hidden: boolean;
}
