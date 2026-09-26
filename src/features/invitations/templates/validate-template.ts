import { InvitationDocumentSchema } from '../contracts/schemas';
import {
  EVENT_TYPES,
  type EventType,
  type L10n,
  type Locale,
  type TemplateManifest,
} from '../contracts/types';
import { LIBRARY_PAIR_PREFIX } from '../fonts/library';
import { parseVideoLink } from '../lib/video-links';
import type { TemplateEntry } from './registry';
import { seedDocument } from './seed-document';

const templateKey = (ref: string | null | undefined) =>
  ref && ref.startsWith('template:') ? ref.slice('template:'.length) : null;

/**
 * Cross-field rules for a template that the structural schema cannot express.
 * Returns human-readable problems; an empty list means the template is usable.
 */
export function validateTemplate({ manifest, defaults }: TemplateEntry): string[] {
  const problems: string[] = [];
  const at = (msg: string) => problems.push(`${manifest.id}: ${msg}`);
  const assetKeys = new Set(Object.keys(manifest.assets));
  const checkRef = (ref: string | null | undefined, where: string) => {
    const key = templateKey(ref);
    if (key && !assetKeys.has(key)) at(`${where} references missing asset "template:${key}"`);
  };
  const checkL10n = (value: L10n | null | undefined, where: string, locales: readonly Locale[]) => {
    if (value == null) return;
    for (const l of locales) if (!value[l]?.trim()) at(`${where} is missing "${l}"`);
  };
  const locales = manifest.supportsLocales;

  // tokens & presets
  const editable = new Set(manifest.tokens.editablePaletteKeys);
  for (const preset of manifest.palettePresets) {
    for (const key of Object.keys(preset.palette)) {
      if (!editable.has(key as keyof TemplateManifest['tokens']['palette'])) {
        at(`palette preset "${preset.id}" sets non-editable key "${key}"`);
      }
    }
  }
  if (new Set(manifest.fontPairs.map((p) => p.id)).size !== manifest.fontPairs.length)
    at('duplicate font pair ids');
  for (const pair of manifest.fontPairs)
    if (pair.id.startsWith(LIBRARY_PAIR_PREFIX))
      at(`font pair id "${pair.id}" uses the font library's "${LIBRARY_PAIR_PREFIX}" prefix`);

  // cover
  const { overlay } = manifest.cover;
  if (overlay.recolor && manifest.cover.sealColors.length === 0) at('overlay.recolor requires sealColors');
  if (overlay.kind === 'ticket_text' && overlay.image !== null)
    at('ticket_text overlays must not have an image');
  if (overlay.kind !== 'ticket_text' && overlay.kind !== 'none' && overlay.image === null) {
    at(`overlay "${overlay.kind}" needs a blank image`);
  }

  // hero options & decorations reference existing assets
  manifest.hero.options.forEach((o, i) => {
    checkRef(o.media.src, `hero.options[${i}].media.src`);
    checkRef(o.media.poster, `hero.options[${i}].media.poster`);
    checkRef(o.mediaDesktop?.src, `hero.options[${i}].mediaDesktop.src`);
    checkRef(o.mediaDesktop?.poster, `hero.options[${i}].mediaDesktop.poster`);
    checkL10n(o.name, `hero.options[${i}].name`, locales);
  });
  for (const [slot, ref] of Object.entries(manifest.decorations)) checkRef(ref, `decorations.${slot}`);

  // music
  const trackIds = manifest.music.tracks.map((t) => t.id);
  if (manifest.music.defaultTrackId && !trackIds.includes(manifest.music.defaultTrackId)) {
    at(`music.defaultTrackId "${manifest.music.defaultTrackId}" is not in tracks`);
  }

  // sections
  const order = manifest.sectionDefaults.order;
  if (order[0] !== 'hero') at('sectionDefaults.order must start with hero');
  if (order[order.length - 1] !== 'footer') at('sectionDefaults.order must end with footer');
  for (const type of new Set(order))
    if (type !== 'custom' && order.filter((t) => t === type).length > 1)
      at(`sectionDefaults.order lists "${type}" twice (only "custom" may repeat)`);

  // v2: the seeded sections' presentation — its pictures exist, a section video is a file, the hero's
  // picture is its hero option (its presentation is motion and colors only)
  for (const [id, p] of Object.entries(manifest.sectionDefaults.presentation ?? {})) {
    const where = `sectionDefaults.presentation.${id}`;
    checkRef(p.media?.src, `${where}.media.src`);
    checkRef(p.media?.poster, `${where}.media.poster`);
    if (p.media?.kind === 'video' && parseVideoLink(p.media.src))
      at(`${where}.media.src must be a file, not a link`);
    if (id === 'hero' && (p.media || (p.layout && p.layout !== 'full_bleed')))
      at(`${where}: the hero's picture is its hero option (motion and colors only here)`);
  }

  // localized template texts
  checkL10n(manifest.name, 'name', locales);
  checkL10n(manifest.description, 'description', locales);
  manifest.palettePresets.forEach((p) => checkL10n(p.name, `palettePresets.${p.id}.name`, locales));

  // defaults: event types must be template categories, HE+EN complete, refs valid
  for (const [eventType, d] of Object.entries(defaults.defaults)) {
    if (!d) continue;
    if (!(EVENT_TYPES as readonly string[]).includes(eventType))
      at(`defaults for unknown event type "${eventType}"`);
    if (!manifest.categories.includes(eventType as TemplateManifest['categories'][number])) {
      at(`defaults.${eventType} is not one of the template categories`);
    }
    const w = (p: string) => `defaults.${eventType}.${p}`;
    checkL10n(d.coverHint, w('coverHint'), locales);
    checkL10n(d.eyebrow, w('eyebrow'), locales);
    if (d.heroTitle.mode === 'custom') checkL10n(d.heroTitle.text, w('heroTitle.text'), locales);
    checkL10n(d.countdown.title, w('countdown.title'), locales);
    checkL10n(d.countdown.subtitle, w('countdown.subtitle'), locales);
    checkL10n(d.countdown.afterEvent, w('countdown.afterEvent'), locales);
    if (d.story) {
      checkL10n(d.story.title, w('story.title'), locales);
      checkL10n(d.story.body, w('story.body'), locales);
    }
    d.venueLabels.forEach((l, i) => checkL10n(l, w(`venueLabels[${i}]`), locales));
    d.timeline.forEach((t, i) => checkL10n(t.label, w(`timeline[${i}].label`), locales));
    d.extraSections.forEach((s, i) => {
      checkL10n(s.title, w(`extraSections[${i}].title`), locales);
      checkL10n(s.subtitle, w(`extraSections[${i}].subtitle`), locales);
      checkL10n(s.body, w(`extraSections[${i}].body`), locales);
      checkRef(s.illustration, w(`extraSections[${i}].illustration`));
    });
    for (const key of [
      'title',
      'subtitle',
      'messageLabel',
      'successMessage',
      'declineMessage',
      'closedMessage',
    ] as const) {
      checkL10n(d.rsvp[key], w(`rsvp.${key}`), locales);
    }
    checkL10n(d.rsvp.dietaryNote, w('rsvp.dietaryNote'), locales);
    checkL10n(d.closingLine, w('closingLine'), locales);
    // v2 sections' copy
    if (d.quote) {
      checkL10n(d.quote.text, w('quote.text'), locales);
      checkL10n(d.quote.attribution, w('quote.attribution'), locales);
    }
    for (const key of ['when', 'parents'] as const) {
      checkL10n(d[key]?.title, w(`${key}.title`), locales);
      checkL10n(d[key]?.note, w(`${key}.note`), locales);
    }
    d.custom?.forEach((c, i) => {
      checkL10n(c.title, w(`custom[${i}].title`), locales);
      checkL10n(c.subtitle, w(`custom[${i}].subtitle`), locales);
      // an empty text is a picture band
      if (Object.values(c.body).some((v) => v?.trim())) checkL10n(c.body, w(`custom[${i}].body`), locales);
    });
  }
  if (Object.keys(defaults.defaults).length === 0) at('defaults.json has no event types');

  // what a host gets: every event type's seed is a valid document, and the presentation names
  // sections the seed makes
  const seeded = new Set<string>();
  for (const eventType of manifest.categories) {
    try {
      const doc = seedDocument(manifest, defaults, {
        eventType: eventType as EventType,
        locales: [...locales],
        defaultLocale: locales[0]!,
        hosts: { primary: { he: 'א', en: 'A' }, secondary: { he: 'ב', en: 'B' }, parents: null },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
        slug: 'validate',
      });
      const parsed = InvitationDocumentSchema.safeParse(doc);
      if (!parsed.success)
        at(
          `the ${eventType} seed is invalid: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`,
        );
      for (const s of doc.sections) seeded.add(s.id);
    } catch (err) {
      at(`the ${eventType} seed failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const id of Object.keys(manifest.sectionDefaults.presentation ?? {}))
    if (!seeded.has(id)) at(`sectionDefaults.presentation.${id} names no seeded section`);
  return problems;
}
