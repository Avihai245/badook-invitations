import { EVENT_TYPES, type L10n, type Locale, type TemplateManifest } from '../contracts/types';
import { LIBRARY_PAIR_PREFIX } from '../fonts/library';
import type { TemplateEntry } from './registry';

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
  }
  if (Object.keys(defaults.defaults).length === 0) at('defaults.json has no event types');
  return problems;
}
