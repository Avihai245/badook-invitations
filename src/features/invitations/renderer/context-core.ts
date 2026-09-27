import {
  dirOf,
  type AssetRef,
  type HHmm,
  type InvitationDocument,
  type L10n,
  type Locale,
  type Section,
  type TemplateManifest,
} from '../contracts/types';
import { t as translate, type DictKey } from '../i18n/dictionary';
import { DAY_MONTH_YEAR, formatDate, formatEventDate, formatTime } from '../lib/dates';
import { interpolate, localize, type TokenValues } from '../lib/l10n';
import { resolveAsset, type AssetBases } from './assets';
import { coverMedia, musicUrl, type CoverMedia } from './cover/media';
import { placeholderArt, type PlaceholderArt } from './placeholders';
import { sceneModel, sceneOn, type SceneModel } from './scene/model';

export type RenderMode = 'live' | 'preview' | 'editor';

/**
 * Everything a section view needs, computed once per render: localized + interpolated texts,
 * formatted dates, resolved assets. Built on the server for server-rendered pages (server ICU only →
 * no hydration mismatch); the public page's live language switch builds the other locale's in the
 * browser, where nothing is hydrated. Client components receive plain strings from it, never the
 * context itself.
 */
export interface RenderContext {
  doc: InvitationDocument;
  template: TemplateManifest;
  locale: Locale;
  dir: 'rtl' | 'ltr';
  mode: RenderMode;
  brand: string;
  /** ms epoch used for time-dependent states (countdown phase, RSVP deadline); overridable for QA */
  now: number;
  art: PlaceholderArt;
  bases: AssetBases;
  /** public origin for share links / ICS UIDs (INVITES_PUBLIC_BASE_URL) */
  publicBaseUrl: string;
  /** true when served from /i/[slug] (the .ics route exists); otherwise a data: URL is used */
  icsViaRoute: boolean;
  tokens: TokenValues;
  /** localized + token-interpolated user text ('' when missing) */
  text(value: L10n | null | undefined): string;
  /**
   * The same in another of the document's languages (the cover carries its texts in each of them —
   * cover/localized.tsx). The Hebrew date token is only known in the context's own language.
   */
  textIn(value: L10n | null | undefined, locale: Locale): string;
  t(key: DictKey, vars?: Record<string, string | number>): string;
  eventDateLong: string;
  hebrewDate: string | null;
  time(hhmm: HHmm): string;
  asset(ref: AssetRef | null | undefined): string | null;
  /** index of a section in doc.sections — used for data-edit-path */
  indexOf(section: Section): number;
  /** the cover's media files (null = not produced: CSS fallback) */
  coverMedia: CoverMedia;
  /** the music track to play after the cover opens (null = none) */
  musicUrl: string | null;
  /** a save-the-date's published full invitation — in this locale when it has it */
  followUp: { href: string; lang: Locale | null } | null;
  /**
   * The event has the `cinematic` feature (features/flags): the v2 presentation shows — sections'
   * media, layouts, motion and colors, the cinematic openings. Off: the plain rendering (v1 look; the
   * v2 section types as plain sections).
   */
  cinematic: boolean;
  /**
   * The draft on the family's review link (features/review): its sections carry their paths (the
   * comment pins find them), the RSVP form sends nothing, and nobody is identified or counted.
   */
  review: boolean;
  /**
   * The event's live gallery (feature `live_gallery`, turned on): the guests' upload page the
   * invitation's gallery section links to. null: the section shows nothing to guests.
   */
  liveGallery: { url: string } | null;
  /** The event measures how guests use the invitation (feature `analytics`): the live page's beacon. */
  insights: boolean;
  /**
   * The invitation as one scroll scene (renderer/scene: the host's choice or the design's, with the
   * `cinematic` feature) — its pictures, particles and tones; null: a page.
   */
  scene: SceneModel | null;
}

export interface RenderOptions {
  mode?: RenderMode;
  brand: string;
  now?: number;
  bases: AssetBases;
  publicBaseUrl: string;
  icsViaRoute?: boolean;
  /** QA/dev only: cover media and music instead of the template's (fixtures) */
  coverMedia?: CoverMedia;
  musicUrl?: string | null;
  /** a save-the-date's full invitation, once published: the page links to it */
  followUp?: { slug: string; locales: Locale[] } | null;
  /** the event has the `cinematic` feature (default true: the public page asks features/flags) */
  cinematic?: boolean;
  /** the draft on the family's review link (see RenderContext.review) */
  review?: boolean;
  /** the live gallery's upload page (the public page asks the gallery; default none) */
  liveGallery?: { url: string } | null;
  /** the event has the `analytics` feature (the public page asks features/flags; default off) */
  insights?: boolean;
}

/**
 * The context without the Hebrew calendar (hebcal is large — it stays on the server): the caller
 * passes the Hebrew date already formatted for `locale` (null when off).
 */
export function createRenderContext(
  doc: InvitationDocument,
  template: TemplateManifest,
  locale: Locale,
  options: RenderOptions & { hebrewDate: string | null },
): RenderContext {
  const { hebrewDate } = options;
  const tokensIn = (l: Locale): TokenValues => ({
    primary: localize(doc.hosts.primary, l),
    secondary: localize(doc.hosts.secondary, l),
    date: formatDate(doc.event.date, l, DAY_MONTH_YEAR),
    hebrewDate: l === locale ? (hebrewDate ?? undefined) : undefined,
    deadline: doc.event.rsvpDeadline
      ? formatDate(doc.event.rsvpDeadline, l, { day: 'numeric', month: 'long' })
      : undefined,
  });
  const tokens = tokensIn(locale);
  const indexById = new Map(doc.sections.map((s, i) => [s.id, i]));
  return {
    doc,
    template,
    locale,
    dir: dirOf(locale),
    mode: options.mode ?? 'live',
    brand: options.brand,
    now: options.now ?? Date.now(),
    art: placeholderArt(template.id),
    bases: options.bases,
    publicBaseUrl: options.publicBaseUrl.replace(/\/+$/, ''),
    icsViaRoute: options.icsViaRoute ?? false,
    tokens,
    text: (value) => interpolate(localize(value, locale), tokens),
    textIn: (value, l) =>
      l === locale
        ? interpolate(localize(value, locale), tokens)
        : interpolate(localize(value, l), tokensIn(l)),
    t: (key, vars) => translate(locale, key, vars),
    eventDateLong: formatEventDate(doc, locale),
    hebrewDate,
    time: (hhmm) => formatTime(hhmm, locale, doc.event.timeFormat),
    asset: (ref) => resolveAsset(ref, template, options.bases),
    indexOf: (section) => indexById.get(section.id) ?? -1,
    coverMedia: options.coverMedia ?? coverMedia(template, options.bases),
    musicUrl: options.musicUrl !== undefined ? options.musicUrl : musicUrl(doc, template, options.bases),
    followUp: options.followUp
      ? {
          href: options.followUp.locales.includes(locale)
            ? `/i/${options.followUp.slug}?lang=${locale}`
            : `/i/${options.followUp.slug}`,
          lang: options.followUp.locales.includes(locale) ? locale : null,
        }
      : null,
    cinematic: options.cinematic ?? true,
    review: options.review ?? false,
    liveGallery: options.liveGallery ?? null,
    insights: options.insights ?? false,
    scene: sceneOn(doc, template, options.cinematic ?? true)
      ? sceneModel({ doc, template, bases: options.bases })
      : null,
  };
}
