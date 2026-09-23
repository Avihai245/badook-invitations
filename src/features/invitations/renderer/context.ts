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
import { formatHebrewDate } from '../lib/hebrew-date';
import { interpolate, localize, type TokenValues } from '../lib/l10n';
import { resolveAsset, type AssetBases } from './assets';
import { placeholderArt, type PlaceholderArt } from './placeholders';

export type RenderMode = 'live' | 'preview' | 'editor';

/**
 * Everything a section view needs, computed on the server once per render: localized + interpolated
 * texts, formatted dates (server ICU only → no hydration mismatch), resolved assets.
 * Client components receive plain strings from it, never the context itself.
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
  t(key: DictKey, vars?: Record<string, string | number>): string;
  eventDateLong: string;
  hebrewDate: string | null;
  time(hhmm: HHmm): string;
  asset(ref: AssetRef | null | undefined): string | null;
  /** index of a section in doc.sections — used for data-edit-path */
  indexOf(section: Section): number;
}

export interface RenderOptions {
  mode?: RenderMode;
  brand: string;
  now?: number;
  bases: AssetBases;
  publicBaseUrl: string;
  icsViaRoute?: boolean;
}

export function buildRenderContext(
  doc: InvitationDocument,
  template: TemplateManifest,
  locale: Locale,
  options: RenderOptions,
): RenderContext {
  const hebrewDate =
    doc.event.hebrewDate === 'off' ? null : formatHebrewDate(doc.event.date, doc.event.hebrewDate, locale);
  const tokens: TokenValues = {
    primary: localize(doc.hosts.primary, locale),
    secondary: localize(doc.hosts.secondary, locale),
    date: formatDate(doc.event.date, locale, DAY_MONTH_YEAR),
    hebrewDate: hebrewDate ?? undefined,
    deadline: doc.event.rsvpDeadline
      ? formatDate(doc.event.rsvpDeadline, locale, { day: 'numeric', month: 'long' })
      : undefined,
  };
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
    t: (key, vars) => translate(locale, key, vars),
    eventDateLong: formatEventDate(doc, locale),
    hebrewDate,
    time: (hhmm) => formatTime(hhmm, locale, doc.event.timeFormat),
    asset: (ref) => resolveAsset(ref, template, options.bases),
    indexOf: (section) => indexById.get(section.id) ?? -1,
  };
}
