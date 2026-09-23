import type {
  EventDefaults,
  EventType,
  HHmm,
  ISODate,
  InvitationDocument,
  L10n,
  Locale,
  Section,
  TemplateDefaults,
  TemplateManifest,
} from '../contracts/types';
import { firstGrapheme, suggestSlug } from '../lib/text';
import { COUPLE_EVENTS, SEED_COPY } from './seed-copy';

export interface WizardInput {
  eventType: EventType;
  locales: Locale[];
  defaultLocale: Locale;
  hosts: { primary: L10n; secondary?: L10n | null; parents?: L10n | null };
  date: ISODate;
  startTime: HHmm;
  endTime?: HHmm | null;
  timezone: string;
  slug?: string;
}

/** Closest event type whose seed copy a template can borrow (§3 seedDocument comment). */
const FALLBACKS: Partial<Record<EventType, EventType[]>> = {
  wedding: ['engagement', 'save_the_date'],
  engagement: ['wedding', 'save_the_date'],
  save_the_date: ['wedding', 'engagement'],
  henna: ['wedding', 'engagement'],
  bar_mitzvah: ['bat_mitzvah'],
  bat_mitzvah: ['bar_mitzvah'],
  brit: ['baby_shower'],
  baby_shower: ['brit'],
};

export interface ResolvedDefaults {
  eventType: EventType;
  defaults: EventDefaults;
  /** false when the copy was borrowed from another event type → the editor shows "review texts". */
  exact: boolean;
}

export function resolveEventDefaults(defaults: TemplateDefaults, eventType: EventType): ResolvedDefaults {
  const direct = defaults.defaults[eventType];
  if (direct) return { eventType, defaults: direct, exact: true };
  for (const alt of FALLBACKS[eventType] ?? []) {
    const d = defaults.defaults[alt];
    if (d) return { eventType: alt, defaults: d, exact: false };
  }
  const first = Object.entries(defaults.defaults).find(([, d]) => d);
  if (!first || !first[1]) throw new Error(`Template "${defaults.templateId}" has no default copy`);
  return { eventType: first[0] as EventType, defaults: first[1], exact: false };
}

/** Keep only the host-selected locales of a template string. */
const pick = (value: L10n, locales: readonly Locale[]): L10n => {
  const out: L10n = {};
  for (const l of locales) if (value[l] !== undefined) out[l] = value[l];
  return out;
};
const pickOrNull = (value: L10n | null | undefined, locales: readonly Locale[]) =>
  value ? pick(value, locales) : null;

const addDays = (iso: ISODate, days: number): ISODate => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Seals (≤ 5 glyphs) get initials — "נ&א" / "J"; wider overlays (tickets) get the name — "DANA". */
function monogram(hosts: WizardInput['hosts'], locales: readonly Locale[], maxGlyphs: number): L10n {
  const out: L10n = {};
  for (const l of locales) {
    const a = firstGrapheme(hosts.primary[l] ?? '');
    const b = hosts.secondary ? firstGrapheme(hosts.secondary[l] ?? '') : '';
    const name = (hosts.primary[l] ?? '').trim().toLocaleUpperCase(l);
    const text = a && b ? `${a}&${b}` : maxGlyphs >= 6 ? name : a.toLocaleUpperCase(l);
    out[l] = [...new Intl.Segmenter(l, { granularity: 'grapheme' }).segment(text)]
      .map((s) => s.segment)
      .slice(0, Math.max(1, maxGlyphs))
      .join('')
      .trim();
  }
  return out;
}

/**
 * seedDocument(template, defaults, wizardInput) → InvitationDocument (§3 / §7.2).
 * The host starts from a complete invitation in the template's order and copy, in the chosen locales only.
 */
export function seedDocument(
  template: TemplateManifest,
  templateDefaults: TemplateDefaults,
  input: WizardInput,
): InvitationDocument {
  const { locales } = input;
  const { defaults: d } = resolveEventDefaults(templateDefaults, input.eventType);
  const variants = template.sectionDefaults.variants;
  const withVariant = <S extends Section>(s: S): S => {
    const v = variants[s.type];
    return v ? { ...s, variant: v } : s;
  };
  const couple = COUPLE_EVENTS.includes(input.eventType) && !!input.hosts.secondary;
  const endTime = input.endTime ?? null;
  const heroOption = template.hero.options[0]!;

  const story: Section[] = d.story
    ? [
        {
          id: 'story',
          type: 'text',
          enabled: true,
          data: {
            kind: 'story',
            title: pick(d.story.title, locales),
            subtitle: null,
            body: pick(d.story.body, locales),
            illustration: null,
            cta: null,
          },
        },
      ]
    : [];
  const extras: Section[] = d.extraSections.map((x, i) => ({
    id: `${x.kind.replace(/_/g, '-')}${d.extraSections.findIndex((y) => y.kind === x.kind) === i ? '' : `-${i + 1}`}`,
    type: 'text',
    enabled: true,
    data: {
      kind: x.kind,
      title: pick(x.title, locales),
      subtitle: pickOrNull(x.subtitle, locales),
      body: pick(x.body, locales),
      illustration: x.illustration,
      cta: null,
    },
  }));

  const timelineVariant = variants.timeline;
  const bySlot: Partial<Record<Section['type'], Section[]>> = {
    hero: [
      {
        id: 'hero',
        type: 'hero',
        enabled: true,
        data: {
          eyebrow: pick(d.eyebrow, locales),
          title:
            d.heroTitle.mode === 'hosts'
              ? { mode: 'hosts' }
              : { mode: 'custom', text: pick(d.heroTitle.text, locales) },
          showDate: true,
          locationLine: null,
          media: heroOption.media,
          overlayOpacity: template.hero.defaultOverlay,
        },
      },
      ...(input.eventType === 'save_the_date'
        ? ([
            {
              id: 'reveal',
              type: 'reveal',
              enabled: true,
              data: {
                title: pick(SEED_COPY.revealTitle, locales),
                mechanic: 'scratch',
                prompt: pick(SEED_COPY.revealPrompt.scratch, locales),
                showCalendarButton: true,
              },
            },
          ] satisfies Section[])
        : []),
    ],
    countdown: [
      {
        id: 'countdown',
        type: 'countdown',
        enabled: input.eventType !== 'save_the_date',
        data: {
          title: pick(d.countdown.title, locales),
          subtitle: pickOrNull(d.countdown.subtitle, locales),
          target: 'event',
          afterEvent: pick(d.countdown.afterEvent, locales),
        },
      },
    ],
    text: story,
    venues: [
      {
        id: 'venues',
        type: 'venues',
        enabled: true,
        data: {
          items: d.venueLabels.map((label, i) => ({
            id: `venue-${i + 1}`,
            label: pick(label, locales),
            name: {},
            address: {},
            geo: null,
            mapsQuery: null,
            date: null,
            startTime: input.startTime,
            endTime,
            showMap: true,
            buttons: { maps: true, waze: locales.includes('he'), calendar: true },
          })),
        },
      },
    ],
    timeline: [
      {
        id: 'timeline',
        type: 'timeline',
        enabled: d.timeline.length > 0,
        data: {
          title: pick(SEED_COPY.timelineTitle(input.eventType), locales),
          showDate: true,
          revealMode: timelineVariant === 'flip-cards' ? 'flip' : 'none',
          items: d.timeline.map((t, i) => ({
            id: `t${i + 1}`,
            time: t.time,
            label: pick(t.label, locales),
            icon: t.icon,
          })),
        },
      },
      ...extras,
    ],
    gallery: [
      {
        id: 'gallery',
        type: 'gallery',
        enabled: false,
        data: { title: pick(SEED_COPY.galleryTitle, locales), layout: 'carousel', images: [] },
      },
    ],
    faq: [
      {
        id: 'faq',
        type: 'faq',
        enabled: false,
        data: { title: pick(SEED_COPY.faqTitle, locales), items: [] },
      },
    ],
    gifts: [
      {
        id: 'gifts',
        type: 'gifts',
        enabled: false,
        data: {
          title: pick(SEED_COPY.giftsTitle, locales),
          body: pick(SEED_COPY.giftsBody, locales),
          links: [],
        },
      },
    ],
    rsvp: [
      {
        id: 'rsvp',
        type: 'rsvp',
        enabled: true,
        data: {
          title: pick(d.rsvp.title, locales),
          subtitle: pickOrNull(d.rsvp.subtitle, locales),
          askChildren: true,
          maxAdults: 4,
          maxChildren: 4,
          requirePhone: true,
          requireEmail: false,
          perAttendeeDetails: true,
          dietary: {
            enabled: d.rsvp.dietaryOptions.length > 0,
            options: d.rsvp.dietaryOptions,
            note: pickOrNull(d.rsvp.dietaryNote, locales),
          },
          customQuestions: [],
          messageLabel: pick(d.rsvp.messageLabel, locales),
          successMessage: pick(d.rsvp.successMessage, locales),
          declineMessage: pick(d.rsvp.declineMessage, locales),
          closedMessage: pick(d.rsvp.closedMessage, locales),
        },
      },
    ],
    footer: [
      {
        id: 'footer',
        type: 'footer',
        enabled: true,
        data: {
          showHosts: true,
          showDate: true,
          showParents: !!input.hosts.parents,
          closingLine: pick(d.closingLine, locales),
          showCredit: true,
        },
      },
    ],
  };

  const sections: Section[] = [];
  for (const type of template.sectionDefaults.order) sections.push(...(bySlot[type] ?? []).map(withVariant));
  // Section types that exist in the seed but not in the template order are appended before the footer.
  for (const [type, list] of Object.entries(bySlot)) {
    if (!template.sectionDefaults.order.includes(type as Section['type'])) {
      sections.splice(sections.length - 1, 0, ...(list ?? []).map(withVariant));
    }
  }

  const names = [
    input.hosts.primary.en ?? input.hosts.primary.he ?? '',
    input.hosts.secondary?.en ?? input.hosts.secondary?.he ?? '',
  ];
  return {
    schemaVersion: 1,
    templateId: template.id,
    eventType: input.eventType,
    locales,
    defaultLocale: input.defaultLocale,
    timezone: input.timezone,
    hosts: {
      primary: pick(input.hosts.primary, locales),
      secondary: couple ? pick(input.hosts.secondary!, locales) : null,
      joiner: couple ? pick(SEED_COPY.joiner, locales) : null,
      parents: pickOrNull(input.hosts.parents, locales),
    },
    event: {
      date: input.date,
      startTime: input.startTime,
      endTime,
      hebrewDate: locales.includes('he') ? 'day' : 'off',
      timeFormat: null,
      rsvpDeadline: addDays(input.date, -14),
    },
    theme: { fontPairId: template.fontPairs[0]!.id, palette: null },
    cover: {
      enabled: true,
      monogram: monogram(
        couple ? input.hosts : { primary: input.hosts.primary },
        locales,
        template.cover.overlay.text.maxGlyphs,
      ),
      sealColor: template.cover.overlay.recolor ? (template.cover.sealColors[0] ?? null) : null,
      hint: pick(d.coverHint, locales),
    },
    music: {
      enabled: template.music.defaultTrackId !== null,
      trackId: template.music.defaultTrackId,
      customUrl: null,
      volume: 0.6,
      startAtSec: 0,
    },
    share: {
      slug: input.slug ?? suggestSlug(names.filter(Boolean)),
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      noindex: true,
    },
    sections,
  };
}
