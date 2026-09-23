/**
 * "+ Add section" catalog (§9B.3-D) and the content a new section starts with: the template's own copy
 * for the invitation's event type when it has some (the section the wizard would have seeded), else
 * short generic copy. Host-specific details (venue names, FAQ answers, gift links…) start empty, so
 * validation asks for them before publishing.
 */
import type {
  InvitationDocument,
  L10n,
  Locale,
  Section,
  SectionType,
  TemplateDefaults,
  TemplateManifest,
} from '../contracts/types';
import { COUPLE_EVENTS, SEED_COPY } from '../templates/seed-copy';
import { seedDocument, type WizardInput } from '../templates/seed-document';
import { uniqueId } from './paths';

export type TextKind = Extract<Section, { type: 'text' }>['data']['kind'];

export interface CatalogEntry {
  /** catalog key — also the dictionary key of its name/description */
  key: CatalogKey;
  type: SectionType;
  kind?: TextKind;
}

export type CatalogKey =
  | 'countdown'
  | 'story'
  | 'venues'
  | 'timeline'
  | 'transport'
  | 'accommodation'
  | 'dress_code'
  | 'menu'
  | 'activities'
  | 'custom'
  | 'faq'
  | 'gallery'
  | 'gifts'
  | 'reveal'
  | 'rsvp';

export const CATALOG: readonly CatalogEntry[] = [
  { key: 'story', type: 'text', kind: 'story' },
  { key: 'countdown', type: 'countdown' },
  { key: 'venues', type: 'venues' },
  { key: 'timeline', type: 'timeline' },
  { key: 'transport', type: 'text', kind: 'transport' },
  { key: 'accommodation', type: 'text', kind: 'accommodation' },
  { key: 'dress_code', type: 'text', kind: 'dress_code' },
  { key: 'menu', type: 'text', kind: 'menu' },
  { key: 'activities', type: 'text', kind: 'activities' },
  { key: 'custom', type: 'text', kind: 'custom' },
  { key: 'faq', type: 'faq' },
  { key: 'gallery', type: 'gallery' },
  { key: 'gifts', type: 'gifts' },
  { key: 'reveal', type: 'reveal' },
  { key: 'rsvp', type: 'rsvp' },
];

/** Section types that exist exactly once and can't be added, removed or moved. */
export const LOCKED_TYPES: readonly SectionType[] = ['hero', 'footer'];

/** Entries the host can add now (≤ 1 RSVP). */
export const availableEntries = (doc: InvitationDocument) =>
  CATALOG.filter((e) => e.type !== 'rsvp' || !doc.sections.some((s) => s.type === 'rsvp'));

const pick = (value: L10n, locales: readonly Locale[]): L10n => {
  const out: L10n = {};
  for (const l of locales) if (value[l] !== undefined) out[l] = value[l];
  return out;
};

/** The wizard input that reproduces this document's seed (event type, hosts, date, languages). */
export function wizardInputOf(doc: InvitationDocument): WizardInput {
  return {
    eventType: doc.eventType,
    locales: doc.locales,
    defaultLocale: doc.defaultLocale,
    hosts: {
      primary: doc.hosts.primary,
      secondary: COUPLE_EVENTS.includes(doc.eventType)
        ? (doc.hosts.secondary ?? { ...doc.hosts.primary })
        : null,
      parents: doc.hosts.parents,
    },
    date: doc.event.date,
    startTime: doc.event.startTime,
    endTime: doc.event.endTime,
    timezone: doc.timezone,
    slug: doc.share.slug,
  };
}

/** A new section for `entry`, with an id unique in `doc`. */
export function newSection(
  entry: CatalogEntry,
  doc: InvitationDocument,
  template: TemplateManifest,
  defaults: TemplateDefaults,
): Section {
  const seeded = seedDocument(template, defaults, wizardInputOf(doc));
  const fromSeed = seeded.sections.find(
    (s) =>
      s.type === entry.type && (entry.type !== 'text' || (s.type === 'text' && s.data.kind === entry.kind)),
  );
  const locales = doc.locales;
  const variant = template.sectionDefaults.variants[entry.type];
  const base = { enabled: true, ...(variant ? { variant } : {}) };
  let section: Section;
  if (fromSeed) {
    section = { ...fromSeed, ...base } as Section;
    // Lists the template seeded empty get one item to fill in (an enabled empty list can't publish).
    if (
      (section.type === 'faq' || section.type === 'timeline' || section.type === 'venues') &&
      !section.data.items.length
    )
      section = {
        ...section,
        data: { ...section.data, items: (genericSection(entry, doc, locales) as typeof section).data.items },
      } as Section;
  } else {
    section = genericSection(entry, doc, locales);
    if (variant) section = { ...section, variant } as Section;
  }
  const idBase = entry.type === 'text' ? (entry.kind ?? 'text').replace(/_/g, '-') : entry.type;
  return {
    ...section,
    id: uniqueId(
      idBase,
      doc.sections.map((s) => s.id),
    ),
  } as Section;
}

function genericSection(entry: CatalogEntry, doc: InvitationDocument, locales: readonly Locale[]): Section {
  switch (entry.type) {
    case 'text': {
      const kind = entry.kind ?? 'custom';
      return {
        id: kind,
        type: 'text',
        enabled: true,
        data: {
          kind,
          title: pick(SEED_COPY.textTitles[kind], locales),
          subtitle: null,
          body: {},
          illustration: null,
          cta: null,
        },
      };
    }
    case 'venues':
      return {
        id: 'venues',
        type: 'venues',
        enabled: true,
        data: {
          items: [
            {
              id: 'venue-1',
              label: pick(SEED_COPY.venueLabel, locales),
              name: {},
              address: {},
              geo: null,
              mapsQuery: null,
              date: null,
              startTime: doc.event.startTime,
              endTime: doc.event.endTime,
              showMap: true,
              buttons: { maps: true, waze: locales.includes('he'), calendar: true },
            },
          ],
        },
      };
    case 'timeline':
      return {
        id: 'timeline',
        type: 'timeline',
        enabled: true,
        data: {
          title: pick(SEED_COPY.timelineTitle(doc.eventType), locales),
          showDate: true,
          revealMode: 'none',
          items: [
            {
              id: 't1',
              time: doc.event.startTime,
              label: pick(SEED_COPY.timelineSample.label, locales),
              icon: 'glass',
            },
          ],
        },
      };
    case 'reveal':
      return {
        id: 'reveal',
        type: 'reveal',
        enabled: true,
        data: {
          title: pick(SEED_COPY.revealTitle, locales),
          mechanic: 'scratch',
          prompt: pick(SEED_COPY.revealPrompt.scratch, locales),
          showCalendarButton: true,
        },
      };
    case 'faq':
      return {
        id: 'faq',
        type: 'faq',
        enabled: true,
        data: {
          title: pick(SEED_COPY.faqTitle, locales),
          items: [{ id: 'q1', q: pick(SEED_COPY.faqSample, locales), a: {} }],
        },
      };
    default:
      // countdown / gallery / gifts / rsvp always come from the seed; hero and footer are never added.
      throw new Error(`newSection: no generic content for "${entry.type}"`);
  }
}

/** Where a new section goes: after the selected one (never after the footer), else before the footer. */
export function insertionIndex(doc: InvitationDocument, selectedId: string | null): number {
  const footer = doc.sections.findIndex((s) => s.type === 'footer');
  const end = footer === -1 ? doc.sections.length : footer;
  const sel = selectedId ? doc.sections.findIndex((s) => s.id === selectedId) : -1;
  return sel >= 0 && sel < end ? sel + 1 : end;
}
