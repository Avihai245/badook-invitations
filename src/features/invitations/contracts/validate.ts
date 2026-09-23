/**
 * Business rules of an invitation document (§3 "Validation rules") — everything the Zod schemas can't
 * check alone because it needs the template or the whole document: translations complete, length caps,
 * section order, template references, RSVP deadline… Shared by the editor (live warnings, the publish
 * dialog's issue list) and the publish route (blocking errors). Isomorphic: no server-only imports.
 *
 * Issues carry the document path of the offending value (the editor jumps there) and a `field` key the
 * editor turns into a human label ("missing English translation in 'Location line'").
 */
import { contrastRatio } from '../lib/contrast';
import { cappedLength } from '../lib/l10n';
import { visibleGlyphCount } from '../lib/text';
import { isHttpsUrl } from '../lib/urls';
import { parseVideoLink } from '../lib/video-links';
import { InvitationDocumentSchema } from './schemas';
import type { AssetRef, InvitationDocument, L10n, Locale, Palette, Section, TemplateManifest } from './types';

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'invalid' // structural (Zod) — params.message
  | 'missing_translation' // params.locale
  | 'too_long' // params.max, params.length, params.locale
  | 'monogram_too_long' // params.max, params.locale
  | 'required'
  | 'too_many' // params.max
  | 'invalid_url'
  | 'section_order' // params.expected: 'hero_first' | 'footer_last'
  | 'duplicate_id'
  | 'rsvp_multiple'
  | 'rsvp_deadline_required'
  | 'palette_key'
  | 'seal_color'
  | 'hero_media'
  | 'font_pair'
  | 'asset_missing'
  | 'event_type'
  | 'locale_unsupported' // params.locale
  | 'default_locale'
  | 'duplicate_locale'
  | 'event_past' // params.date
  | 'deadline_past' // params.deadline
  | 'deadline_after_event' // params.deadline, params.date
  | 'venue_date_differs' // params.venueDate, params.date
  | 'contrast_low' // params.ratio, params.min
  | 'empty_section';

/** Stable keys the editor maps to field labels. */
export type FieldKey =
  | 'hosts.primary'
  | 'hosts.secondary'
  | 'hosts.joiner'
  | 'hosts.parents'
  | 'event.date'
  | 'event.rsvpDeadline'
  | 'locales'
  | 'defaultLocale'
  | 'eventType'
  | 'theme.palette'
  | 'theme.fontPairId'
  | 'cover.monogram'
  | 'cover.sealColor'
  | 'cover.hint'
  | 'music.customUrl'
  | 'share.ogTitle'
  | 'share.ogDescription'
  | 'share.ogImage'
  | 'share.slug'
  | 'sections'
  | 'section.title'
  | 'section.subtitle'
  | 'hero.eyebrow'
  | 'hero.title'
  | 'hero.locationLine'
  | 'hero.media'
  | 'countdown.afterEvent'
  | 'text.body'
  | 'text.illustration'
  | 'text.ctaLabel'
  | 'text.ctaUrl'
  | 'venues.items'
  | 'venue.label'
  | 'venue.name'
  | 'venue.address'
  | 'venue.date'
  | 'timeline.items'
  | 'timeline.label'
  | 'faq.items'
  | 'faq.q'
  | 'faq.a'
  | 'gallery.alt'
  | 'gallery.image'
  | 'gifts.body'
  | 'gifts.links'
  | 'gifts.label'
  | 'gifts.url'
  | 'gifts.details'
  | 'reveal.prompt'
  | 'rsvp.dietaryNote'
  | 'rsvp.questionLabel'
  | 'rsvp.optionLabel'
  | 'rsvp.messageLabel'
  | 'rsvp.successMessage'
  | 'rsvp.declineMessage'
  | 'rsvp.closedMessage'
  | 'footer.closingLine';

export interface Issue {
  /** dotted document path, e.g. 'sections.3.data.items.1.label' */
  path: string;
  code: IssueCode;
  severity: IssueSeverity;
  field?: FieldKey;
  /** id of the section the path is in (the editor selects it) */
  sectionId?: string;
  params?: Record<string, string | number>;
}

export interface ValidationResult {
  issues: Issue[];
  errors: Issue[];
  warnings: Issue[];
}

/** §3 length caps (measured after interpolation, 12 characters per live token). */
export const CAPS = {
  hostName: 20,
  eyebrow: 40,
  locationLine: 40,
  heroTitle: 40,
  title: 32,
  subtitle: 60,
  body: 600,
  timelineLabel: 22,
} as const;

export const MAX_VENUES = 4;

/** Texts with an automatic fallback per language (see `pageTitle` / `pageDescription`). */
const OPTIONAL_TEXTS = new Set<FieldKey>(['share.ogTitle', 'share.ogDescription']);
const MIN_TEXT_CONTRAST = 4.5;

interface L10nField {
  path: string;
  value: L10n | null;
  field: FieldKey;
  cap?: number;
  section?: Section;
  /** switched off — its section is hidden, or the option it belongs to is (the text never shows) */
  unused?: boolean;
}

/** Every user-authored L10n of the document with its path, label key and length cap. */
export function* l10nFields(doc: InvitationDocument): Generator<L10nField> {
  const cover = !doc.cover.enabled;
  // the parents' line only appears in a footer that shows it
  const parents = !doc.sections.some((s) => s.type === 'footer' && s.enabled && s.data.showParents);
  yield { path: 'hosts.primary', value: doc.hosts.primary, field: 'hosts.primary', cap: CAPS.hostName };
  yield { path: 'hosts.secondary', value: doc.hosts.secondary, field: 'hosts.secondary', cap: CAPS.hostName };
  yield { path: 'hosts.joiner', value: doc.hosts.joiner, field: 'hosts.joiner' };
  yield { path: 'hosts.parents', value: doc.hosts.parents, field: 'hosts.parents', unused: parents };
  yield { path: 'cover.monogram', value: doc.cover.monogram, field: 'cover.monogram', unused: cover };
  yield { path: 'cover.hint', value: doc.cover.hint, field: 'cover.hint', unused: cover };
  yield { path: 'share.ogTitle', value: doc.share.ogTitle, field: 'share.ogTitle' };
  yield { path: 'share.ogDescription', value: doc.share.ogDescription, field: 'share.ogDescription' };

  for (const [i, section] of doc.sections.entries()) {
    const base = `sections.${i}.data`;
    const f = (
      key: string,
      value: L10n | null,
      field: FieldKey,
      cap?: number,
      optionOff = false,
    ): L10nField => ({
      path: `${base}.${key}`,
      value,
      field,
      cap,
      section,
      unused: !section.enabled || optionOff,
    });
    switch (section.type) {
      case 'hero': {
        const d = section.data;
        yield f('eyebrow', d.eyebrow, 'hero.eyebrow', CAPS.eyebrow);
        if (d.title.mode === 'custom') yield f('title.text', d.title.text, 'hero.title', CAPS.heroTitle);
        yield f('locationLine', d.locationLine, 'hero.locationLine', CAPS.locationLine);
        break;
      }
      case 'countdown': {
        const d = section.data;
        yield f('title', d.title, 'section.title', CAPS.title);
        yield f('subtitle', d.subtitle, 'section.subtitle', CAPS.subtitle);
        yield f('afterEvent', d.afterEvent, 'countdown.afterEvent', CAPS.subtitle);
        break;
      }
      case 'text': {
        const d = section.data;
        yield f('title', d.title, 'section.title', CAPS.title);
        yield f('subtitle', d.subtitle, 'section.subtitle', CAPS.subtitle);
        yield f('body', d.body, 'text.body', CAPS.body);
        if (d.cta) yield f('cta.label', d.cta.label, 'text.ctaLabel');
        break;
      }
      case 'venues':
        for (const [k, v] of section.data.items.entries()) {
          yield f(`items.${k}.label`, v.label, 'venue.label', CAPS.title);
          yield f(`items.${k}.name`, v.name, 'venue.name');
          yield f(`items.${k}.address`, v.address, 'venue.address');
        }
        break;
      case 'timeline':
        yield f('title', section.data.title, 'section.title', CAPS.title);
        for (const [k, item] of section.data.items.entries())
          yield f(`items.${k}.label`, item.label, 'timeline.label', CAPS.timelineLabel);
        break;
      case 'faq':
        yield f('title', section.data.title, 'section.title', CAPS.title);
        for (const [k, item] of section.data.items.entries()) {
          yield f(`items.${k}.q`, item.q, 'faq.q');
          yield f(`items.${k}.a`, item.a, 'faq.a');
        }
        break;
      case 'gallery':
        yield f('title', section.data.title, 'section.title', CAPS.title);
        for (const [k, img] of section.data.images.entries())
          yield f(`images.${k}.alt`, img.alt, 'gallery.alt');
        break;
      case 'gifts':
        yield f('title', section.data.title, 'section.title', CAPS.title);
        yield f('body', section.data.body, 'gifts.body', CAPS.body);
        for (const [k, link] of section.data.links.entries()) {
          yield f(`links.${k}.label`, link.label, 'gifts.label');
          yield f(`links.${k}.details`, link.details, 'gifts.details');
        }
        break;
      case 'reveal':
        yield f('title', section.data.title, 'section.title', CAPS.title);
        yield f('prompt', section.data.prompt, 'reveal.prompt');
        break;
      case 'rsvp': {
        const d = section.data;
        yield f('title', d.title, 'section.title', CAPS.title);
        yield f('subtitle', d.subtitle, 'section.subtitle', CAPS.subtitle);
        yield f('dietary.note', d.dietary.note, 'rsvp.dietaryNote', undefined, !d.dietary.enabled);
        for (const [k, q] of d.customQuestions.entries()) {
          yield f(`customQuestions.${k}.label`, q.label, 'rsvp.questionLabel');
          for (const [o, opt] of (q.options ?? []).entries())
            yield f(`customQuestions.${k}.options.${o}.label`, opt.label, 'rsvp.optionLabel');
        }
        yield f('messageLabel', d.messageLabel, 'rsvp.messageLabel', undefined, !d.askMessage);
        yield f('successMessage', d.successMessage, 'rsvp.successMessage');
        yield f('declineMessage', d.declineMessage, 'rsvp.declineMessage');
        yield f('closedMessage', d.closedMessage, 'rsvp.closedMessage');
        break;
      }
      case 'footer':
        yield f('closingLine', section.data.closingLine, 'footer.closingLine');
        break;
    }
  }
}

/** Every AssetRef in the document with its path (`unused`: switched off — never loaded). */
function* assetRefs(doc: InvitationDocument): Generator<{
  path: string;
  ref: AssetRef;
  field: FieldKey;
  section?: Section;
  unused?: boolean;
}> {
  // the track plays unless the music is off, or the hero video's own sound replaces it
  const heroVideo = doc.sections.some((s) => s.type === 'hero' && s.enabled && s.data.media.kind === 'video');
  const trackOff = !doc.music.enabled || (doc.music.videoSound && heroVideo);
  if (doc.music.customUrl)
    yield { path: 'music.customUrl', ref: doc.music.customUrl, field: 'music.customUrl', unused: trackOff };
  if (doc.share.ogImage) yield { path: 'share.ogImage', ref: doc.share.ogImage, field: 'share.ogImage' };
  for (const [i, section] of doc.sections.entries()) {
    const base = `sections.${i}.data`;
    const unused = !section.enabled;
    if (section.type === 'hero') {
      const { media } = section.data;
      yield { path: `${base}.media.src`, ref: media.src, field: 'hero.media', section, unused };
      if (media.poster)
        yield { path: `${base}.media.poster`, ref: media.poster, field: 'hero.media', section, unused };
    } else if (section.type === 'text' && section.data.illustration) {
      yield {
        path: `${base}.illustration`,
        ref: section.data.illustration,
        field: 'text.illustration',
        section,
        unused,
      };
    } else if (section.type === 'gallery') {
      for (const [k, img] of section.data.images.entries())
        yield { path: `${base}.images.${k}.src`, ref: img.src, field: 'gallery.image', section, unused };
    }
  }
}

/** Today's date (YYYY-MM-DD) in the document's time zone. */
function todayIn(timezone: string, now: number): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export interface ValidateOptions {
  /**
   * 'publish': every content rule blocks; 'edit': translations/caps are warnings. Either way, what is
   * switched off (a hidden section, the cover, the music, an RSVP option…) is never checked — it
   * doesn't show, so it can stay half-filled.
   */
  mode: 'edit' | 'publish';
  /** ms epoch for the date warnings (tests) */
  now?: number;
}

export function validateDocument(
  input: unknown,
  template: TemplateManifest,
  { mode, now = Date.now() }: ValidateOptions,
): ValidationResult {
  const issues: Issue[] = [];
  const parsed = InvitationDocumentSchema.safeParse(input);
  if (!parsed.success) {
    for (const zi of parsed.error.issues)
      issues.push({
        path: zi.path.map(String).join('.'),
        code: 'invalid',
        severity: 'error',
        params: { message: zi.message },
      });
    return split(issues);
  }
  const doc = parsed.data as InvitationDocument;
  const add = (issue: Issue) => issues.push(issue);
  const contentSeverity: IssueSeverity = mode === 'publish' ? 'error' : 'warning';

  // ── languages ──
  const seen = new Set<Locale>();
  for (const [i, l] of doc.locales.entries()) {
    if (seen.has(l))
      add({ path: `locales.${i}`, code: 'duplicate_locale', severity: 'error', field: 'locales' });
    seen.add(l);
    if (!template.supportsLocales.includes(l))
      add({
        path: `locales.${i}`,
        code: 'locale_unsupported',
        severity: 'error',
        field: 'locales',
        params: { locale: l },
      });
  }
  if (!doc.locales.includes(doc.defaultLocale))
    add({ path: 'defaultLocale', code: 'default_locale', severity: 'error', field: 'defaultLocale' });
  if (!template.categories.includes(doc.eventType))
    add({ path: 'eventType', code: 'event_type', severity: 'error', field: 'eventType' });

  // ── translations & length caps ──
  for (const f of l10nFields(doc)) {
    if (!f.value || f.unused) continue;
    const value = f.value;
    // The link-preview title / description are optional overrides: a language without one gets the
    // automatic text (pageTitle / pageDescription), so a missing translation only warns.
    const optional = OPTIONAL_TEXTS.has(f.field);
    if (optional && doc.locales.every((l) => !(value[l] ?? '').trim())) continue;
    const severity = optional ? 'warning' : contentSeverity;
    // Empty in every language → the text itself is missing ("required"), pointing at the default
    // language; otherwise each missing language is a missing translation.
    if (doc.locales.every((l) => !(value[l] ?? '').trim())) {
      add({
        path: `${f.path}.${doc.locales.includes(doc.defaultLocale) ? doc.defaultLocale : doc.locales[0]}`,
        code: 'required',
        severity,
        field: f.field,
        sectionId: f.section?.id,
      });
      continue;
    }
    for (const locale of doc.locales) {
      const text = (value[locale] ?? '').trim();
      if (!text) {
        add({
          path: `${f.path}.${locale}`,
          code: 'missing_translation',
          severity,
          field: f.field,
          sectionId: f.section?.id,
          params: { locale },
        });
        continue;
      }
      if (f.field === 'cover.monogram') {
        const max = template.cover.overlay.text.maxGlyphs;
        if (template.cover.overlay.kind !== 'none' && visibleGlyphCount(text, locale) > max)
          add({
            path: `${f.path}.${locale}`,
            code: 'monogram_too_long',
            severity: 'error',
            field: f.field,
            params: { max, locale },
          });
      } else if (f.cap !== undefined) {
        const length = cappedLength(text);
        if (length > f.cap)
          add({
            path: `${f.path}.${locale}`,
            code: 'too_long',
            severity,
            field: f.field,
            sectionId: f.section?.id,
            params: { max: f.cap, length, locale },
          });
      }
    }
  }

  // ── sections ──
  const ids = new Set<string>();
  for (const [i, s] of doc.sections.entries()) {
    if (ids.has(s.id))
      add({
        path: `sections.${i}.id`,
        code: 'duplicate_id',
        severity: 'error',
        field: 'sections',
        sectionId: s.id,
      });
    ids.add(s.id);
  }
  if (doc.sections[0]?.type !== 'hero')
    add({
      path: 'sections',
      code: 'section_order',
      severity: 'error',
      field: 'sections',
      params: { expected: 'hero_first' },
    });
  if (doc.sections.at(-1)?.type !== 'footer')
    add({
      path: 'sections',
      code: 'section_order',
      severity: 'error',
      field: 'sections',
      params: { expected: 'footer_last' },
    });
  const rsvps = doc.sections.filter((s) => s.type === 'rsvp');
  if (rsvps.length > 1)
    add({ path: 'sections', code: 'rsvp_multiple', severity: 'error', field: 'sections' });
  if (rsvps.some((s) => s.enabled) && !doc.event.rsvpDeadline)
    add({
      path: 'event.rsvpDeadline',
      code: 'rsvp_deadline_required',
      severity: 'error',
      field: 'event.rsvpDeadline',
    });

  for (const [i, s] of doc.sections.entries()) {
    // a hidden section is simply unused: whatever is half-filled in it waits until it's switched on
    if (!s.enabled) continue;
    const base = `sections.${i}.data`;
    const severity = contentSeverity;
    // An empty section isn't shown on the page, so it never blocks publishing — the host is told.
    const emptyList = (key: string, field: FieldKey) =>
      add({ path: `${base}.${key}`, code: 'empty_section', severity: 'warning', field, sectionId: s.id });
    switch (s.type) {
      case 'hero': {
        const m = s.data.media;
        const isUpload = m.src.startsWith('upload:');
        // a YouTube / Vimeo link (HeroEmbed)
        const isLink = m.kind === 'video' && parseVideoLink(m.src) !== null;
        const option = template.hero.options.some((o) =>
          m.kind === 'video' ? o.media.src === m.src : o.media.poster === m.src || o.media.src === m.src,
        );
        if (!isUpload && !isLink && !option)
          add({
            path: `${base}.media.src`,
            code: 'hero_media',
            severity: 'error',
            field: 'hero.media',
            sectionId: s.id,
          });
        break;
      }
      case 'text':
        if (s.data.cta && !isHttpsUrl(s.data.cta.url))
          add({
            path: `${base}.cta.url`,
            code: 'invalid_url',
            severity,
            field: 'text.ctaUrl',
            sectionId: s.id,
          });
        break;
      case 'venues':
        if (!s.data.items.length) emptyList('items', 'venues.items');
        if (s.data.items.length > MAX_VENUES)
          add({
            path: `${base}.items`,
            code: 'too_many',
            severity,
            field: 'venues.items',
            sectionId: s.id,
            params: { max: MAX_VENUES },
          });
        break;
      case 'timeline':
        if (!s.data.items.length) emptyList('items', 'timeline.items');
        break;
      case 'faq':
        if (!s.data.items.length) emptyList('items', 'faq.items');
        break;
      case 'gifts':
        if (!s.data.links.length) emptyList('links', 'gifts.links');
        for (const [k, link] of s.data.links.entries()) {
          if (link.kind === 'bank_transfer') {
            if (!link.details)
              add({
                path: `${base}.links.${k}.details`,
                code: 'required',
                severity,
                field: 'gifts.details',
                sectionId: s.id,
              });
          } else if (!link.url) {
            add({
              path: `${base}.links.${k}.url`,
              code: 'required',
              severity,
              field: 'gifts.url',
              sectionId: s.id,
            });
          } else if (!isHttpsUrl(link.url)) {
            add({
              path: `${base}.links.${k}.url`,
              code: 'invalid_url',
              severity,
              field: 'gifts.url',
              sectionId: s.id,
            });
          }
        }
        break;
      default:
        break;
    }
  }

  // ── template references ──
  const editable = new Set<string>(template.tokens.editablePaletteKeys);
  for (const key of Object.keys(doc.theme.palette ?? {}))
    if (!editable.has(key))
      add({ path: `theme.palette.${key}`, code: 'palette_key', severity: 'error', field: 'theme.palette' });
  if (!template.fontPairs.some((p) => p.id === doc.theme.fontPairId))
    add({ path: 'theme.fontPairId', code: 'font_pair', severity: 'error', field: 'theme.fontPairId' });
  // (no cover → no seal to color)
  const seal = doc.cover.enabled ? doc.cover.sealColor : null;
  if (template.cover.overlay.recolor) {
    if (seal && !template.cover.sealColors.map((c) => c.toLowerCase()).includes(seal.toLowerCase()))
      add({ path: 'cover.sealColor', code: 'seal_color', severity: 'error', field: 'cover.sealColor' });
  } else if (seal) {
    add({ path: 'cover.sealColor', code: 'seal_color', severity: 'error', field: 'cover.sealColor' });
  }
  for (const a of assetRefs(doc)) {
    if (a.unused) continue;
    if (a.ref.startsWith('template:') && !(a.ref.slice(9) in template.assets))
      add({
        path: a.path,
        code: 'asset_missing',
        severity: 'error',
        field: a.field,
        sectionId: a.section?.id,
      });
  }

  // ── warnings ── (dates travel as params, so the message can say which ones clash)
  const today = todayIn(doc.timezone, now);
  const date = doc.event.date;
  if (date < today)
    add({
      path: 'event.date',
      code: 'event_past',
      severity: 'warning',
      field: 'event.date',
      params: { date },
    });
  const deadline = doc.event.rsvpDeadline;
  if (deadline && rsvps.some((s) => s.enabled)) {
    if (deadline > date)
      add({
        path: 'event.rsvpDeadline',
        code: 'deadline_after_event',
        severity: 'warning',
        field: 'event.rsvpDeadline',
        params: { deadline, date },
      });
    else if (deadline < today)
      add({
        path: 'event.rsvpDeadline',
        code: 'deadline_past',
        severity: 'warning',
        field: 'event.rsvpDeadline',
        params: { deadline },
      });
  }
  // Venues on other days are a multi-day event; but when none of them is on the event's date, one of
  // the two is most likely a mistake — the top of the invitation and the countdown show the event date.
  for (const [i, s] of doc.sections.entries()) {
    if (s.type !== 'venues' || !s.enabled) continue;
    const items = s.data.items;
    const k = items.findIndex((v) => v.date && v.date !== date);
    if (k >= 0 && items.every((v) => v.date && v.date !== date))
      add({
        path: `sections.${i}.data.items.${k}.date`,
        code: 'venue_date_differs',
        severity: 'warning',
        field: 'venue.date',
        sectionId: s.id,
        params: { venueDate: items[k]!.date!, date },
      });
  }
  const overrides = doc.theme.palette ?? {};
  if (Object.keys(overrides).length) {
    const palette: Palette = { ...template.tokens.palette, ...overrides };
    const pairs: [keyof Palette, keyof Palette][] = [
      ['ink', 'bg'],
      ['inkMuted', 'bg'],
      ['accentInk', 'accent'],
    ];
    for (const [fg, bg] of pairs) {
      if (!(fg in overrides) && !(bg in overrides)) continue;
      const ratio = contrastRatio(palette[fg], palette[bg]);
      if (ratio < MIN_TEXT_CONTRAST)
        add({
          path: `theme.palette.${fg in overrides ? fg : bg}`,
          code: 'contrast_low',
          severity: 'warning',
          field: 'theme.palette',
          params: { ratio: Math.round(ratio * 100) / 100, min: MIN_TEXT_CONTRAST },
        });
    }
  }

  return split(issues);
}

function split(issues: Issue[]): ValidationResult {
  return {
    issues,
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
  };
}
