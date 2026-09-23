import type {
  EventType,
  InvitationDocument,
  SectionOf,
  TemplateDefaults,
  TemplateManifest,
} from '../contracts/types';
import { seedDocument } from './seed-document';

/** A save-the-date's slug ends with this, leaving the plain one to the invitation that follows it. */
export const SAVE_THE_DATE_SUFFIX = '-save-the-date';

/** "noa-and-itay" → "noa-and-itay-save-the-date" (within the 60-character slug limit). */
export const saveTheDateSlug = (base: string): string =>
  base.endsWith(SAVE_THE_DATE_SUFFIX)
    ? base
    : `${base.slice(0, 60 - SAVE_THE_DATE_SUFFIX.length).replace(/-+$/, '')}${SAVE_THE_DATE_SUFFIX}`;

/** "noa-and-itay-save-the-date" → "noa-and-itay"; null when the save-the-date's slug has no suffix. */
export const followUpSlug = (saveTheDate: string): string | null =>
  saveTheDate.endsWith(SAVE_THE_DATE_SUFFIX) && saveTheDate.length > SAVE_THE_DATE_SUFFIX.length
    ? saveTheDate.slice(0, -SAVE_THE_DATE_SUFFIX.length)
    : null;

const sectionOf = <T extends 'hero' | 'gallery'>(doc: InvitationDocument, type: T) =>
  doc.sections.find((s): s is SectionOf<T> => s.type === type);

/**
 * The full invitation that follows a save-the-date (§11 P4): seeded for `eventType` from the same
 * template like a new invitation, keeping what the guests already saw — names, date and times,
 * languages, design, cover, music, the hero's photo and a gallery with photos. The texts are the
 * template's for the event type.
 */
export function followUpDocument(
  template: TemplateManifest,
  defaults: TemplateDefaults,
  source: InvitationDocument,
  eventType: EventType,
): InvitationDocument {
  const seeded = seedDocument(template, defaults, {
    eventType,
    locales: source.locales,
    defaultLocale: source.defaultLocale,
    hosts: {
      primary: source.hosts.primary,
      secondary: source.hosts.secondary,
      parents: source.hosts.parents,
    },
    date: source.event.date,
    startTime: source.event.startTime,
    endTime: source.event.endTime,
    timezone: source.timezone,
  });
  const hero = sectionOf(source, 'hero');
  const gallery = sectionOf(source, 'gallery');
  const sections = seeded.sections.map((s) => {
    if (s.type === 'hero' && hero)
      return { ...s, data: { ...s.data, media: hero.data.media, overlayOpacity: hero.data.overlayOpacity } };
    if (s.type === 'gallery' && gallery?.data.images.length)
      return { ...s, enabled: gallery.enabled, data: structuredClone(gallery.data) };
    return s;
  });
  return {
    ...seeded,
    hosts: {
      ...seeded.hosts,
      joiner: seeded.hosts.secondary ? (source.hosts.joiner ?? seeded.hosts.joiner) : null,
    },
    event: { ...seeded.event, hebrewDate: source.event.hebrewDate, timeFormat: source.event.timeFormat },
    theme: structuredClone(source.theme),
    cover: structuredClone(source.cover),
    music: structuredClone(source.music),
    share: { ...seeded.share, noindex: source.share.noindex },
    sections,
  };
}
