/**
 * Zod schemas matching the §3 contracts in ./types.ts (structural validation).
 * Business rules that need the template or the whole document (translations complete,
 * length caps, section order, palette keys…) live in ./validate.ts.
 */
import { z } from 'zod';
import {
  DECORATION_SLOTS,
  DIETARY_KEYS,
  EVENT_TYPES,
  LOCALES,
  PALETTE_KEYS,
  SECTION_TYPES,
  TIMELINE_ICONS,
  type EventDefaults,
  type InvitationDocument,
  type Media,
  type RsvpConfig,
  type RsvpResult,
  type RsvpSubmission,
  type Section,
  type TemplateDefaults,
  type TemplateManifest,
  type Venue,
} from './types';

// ---------- primitives ----------
export const LocaleSchema = z.enum(LOCALES);
export const EventTypeSchema = z.enum(EVENT_TYPES);
export const SectionTypeSchema = z.enum(SECTION_TYPES);
export const TimelineIconSchema = z.enum(TIMELINE_ICONS);
export const DietaryKeySchema = z.enum(DIETARY_KEYS);
export const PaletteKeySchema = z.enum(PALETTE_KEYS);

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SLUG_RE = /^[a-z0-9-]{3,60}$/;
export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const HHmmSchema = z.string().regex(HHMM_RE, 'Expected HH:mm (24h)');
export const ISODateSchema = z.iso.date();
export const HexColorSchema = z.string().regex(HEX_COLOR_RE, 'Expected #RRGGBB');
export const SlugSchema = z.string().regex(SLUG_RE, 'Expected 3–60 chars: a-z, 0-9, -');

/** 'template:<key>' | 'upload:<storage path>' | absolute https URL */
export const AssetRefSchema = z
  .string()
  .refine(
    (s) => /^template:[A-Za-z0-9._-]+$/.test(s) || /^upload:\S+$/.test(s) || /^https:\/\/\S+$/.test(s),
    {
      message: "Expected 'template:<key>', 'upload:<path>' or an https URL",
    },
  );

/** Path of a file inside the template folder, as written in the manifests ('/templates/<id>/<file>'). */
export const TemplatePathSchema = z.string().regex(/^\/templates\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/, {
  message: "Expected '/templates/<id>/<file>'",
});

export const TimezoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Unknown IANA time zone' },
);

/** User-authored text; completeness per document.locales is checked in validate.ts. */
export const L10nSchema = z.partialRecord(LocaleSchema, z.string());

const unit = z.number().min(0).max(1);

// ---------- document ----------
export const MediaSchema = z.strictObject({
  kind: z.enum(['image', 'video']),
  src: AssetRefSchema,
  poster: AssetRefSchema.nullable(),
  focalPoint: z.strictObject({ x: unit, y: unit }),
});

export const VenueSchema = z.strictObject({
  id: z.string().min(1),
  label: L10nSchema,
  name: L10nSchema,
  address: L10nSchema,
  geo: z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
  mapsQuery: z.string().nullable(),
  date: ISODateSchema.nullable(),
  startTime: HHmmSchema,
  endTime: HHmmSchema.nullable(),
  showMap: z.boolean(),
  buttons: z.strictObject({ maps: z.boolean(), waze: z.boolean(), calendar: z.boolean() }),
});

export const RsvpConfigSchema = z.strictObject({
  title: L10nSchema,
  subtitle: L10nSchema.nullable(),
  askChildren: z.boolean(),
  maxAdults: z.number().int().min(1).max(10),
  maxChildren: z.number().int().min(0).max(10),
  requirePhone: z.boolean(),
  requireEmail: z.boolean(),
  perAttendeeDetails: z.boolean(),
  dietary: z.strictObject({
    enabled: z.boolean(),
    options: z.array(DietaryKeySchema),
    note: L10nSchema.nullable(),
  }),
  customQuestions: z.array(
    z
      .strictObject({
        id: z.string().min(1),
        type: z.enum(['text', 'select', 'boolean']),
        required: z.boolean(),
        label: L10nSchema,
        options: z.array(z.strictObject({ value: z.string().min(1), label: L10nSchema })).optional(),
      })
      .refine((q) => q.type !== 'select' || (q.options?.length ?? 0) > 0, {
        message: 'A select question needs options',
        path: ['options'],
      }),
  ),
  messageLabel: L10nSchema.nullable(),
  successMessage: L10nSchema,
  declineMessage: L10nSchema,
  closedMessage: L10nSchema,
});

const section = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.strictObject({
    id: z.string().min(1),
    type: z.literal(type),
    enabled: z.boolean(),
    variant: z.string().min(1).optional(),
    data,
  });

export const HeroSectionSchema = section(
  'hero',
  z.strictObject({
    eyebrow: L10nSchema.nullable(),
    title: z.discriminatedUnion('mode', [
      z.strictObject({ mode: z.literal('hosts') }),
      z.strictObject({ mode: z.literal('custom'), text: L10nSchema }),
    ]),
    showDate: z.boolean(),
    locationLine: L10nSchema.nullable(),
    media: MediaSchema,
    overlayOpacity: z.number().min(0).max(0.7),
  }),
);

export const CountdownSectionSchema = section(
  'countdown',
  z.strictObject({
    title: L10nSchema,
    subtitle: L10nSchema.nullable(),
    target: z.union([z.literal('event'), z.strictObject({ date: ISODateSchema, time: HHmmSchema })]),
    afterEvent: L10nSchema,
  }),
);

export const TextSectionSchema = section(
  'text',
  z.strictObject({
    kind: z.enum(['story', 'transport', 'accommodation', 'dress_code', 'menu', 'activities', 'custom']),
    title: L10nSchema.nullable(),
    subtitle: L10nSchema.nullable(),
    body: L10nSchema,
    illustration: AssetRefSchema.nullable(),
    cta: z.strictObject({ label: L10nSchema, url: z.string().min(1) }).nullable(),
  }),
);

export const VenuesSectionSchema = section('venues', z.strictObject({ items: z.array(VenueSchema) }));

export const TimelineSectionSchema = section(
  'timeline',
  z.strictObject({
    title: L10nSchema,
    showDate: z.boolean(),
    revealMode: z.enum(['none', 'flip']),
    items: z.array(
      z.strictObject({
        id: z.string().min(1),
        time: HHmmSchema,
        label: L10nSchema,
        icon: TimelineIconSchema,
      }),
    ),
  }),
);

export const FaqSectionSchema = section(
  'faq',
  z.strictObject({
    title: L10nSchema,
    items: z.array(z.strictObject({ id: z.string().min(1), q: L10nSchema, a: L10nSchema })),
  }),
);

export const GallerySectionSchema = section(
  'gallery',
  z.strictObject({
    title: L10nSchema.nullable(),
    layout: z.enum(['carousel', 'grid']),
    images: z.array(z.strictObject({ id: z.string().min(1), src: AssetRefSchema, alt: L10nSchema })),
  }),
);

export const GiftsSectionSchema = section(
  'gifts',
  z.strictObject({
    title: L10nSchema,
    body: L10nSchema,
    links: z.array(
      z.strictObject({
        id: z.string().min(1),
        kind: z.enum(['registry', 'bit', 'paybox', 'paypal', 'bank_transfer', 'link']),
        label: L10nSchema,
        url: z.string().nullable(),
        details: L10nSchema.nullable(),
      }),
    ),
  }),
);

export const RevealSectionSchema = section(
  'reveal',
  z.strictObject({
    title: L10nSchema,
    mechanic: z.enum(['scratch', 'tap', 'spin']),
    prompt: L10nSchema,
    showCalendarButton: z.boolean(),
  }),
);

export const RsvpSectionSchema = section('rsvp', RsvpConfigSchema);

export const FooterSectionSchema = section(
  'footer',
  z.strictObject({
    showHosts: z.boolean(),
    showDate: z.boolean(),
    showParents: z.boolean(),
    closingLine: L10nSchema.nullable(),
    showCredit: z.boolean(),
  }),
);

export const SectionSchema = z.discriminatedUnion('type', [
  HeroSectionSchema,
  CountdownSectionSchema,
  TextSectionSchema,
  VenuesSectionSchema,
  TimelineSectionSchema,
  FaqSectionSchema,
  GallerySectionSchema,
  GiftsSectionSchema,
  RevealSectionSchema,
  RsvpSectionSchema,
  FooterSectionSchema,
]);

const PaletteShape = {
  bg: HexColorSchema,
  surface: HexColorSchema,
  ink: HexColorSchema,
  inkMuted: HexColorSchema,
  accent: HexColorSchema,
  accentInk: HexColorSchema,
  line: HexColorSchema,
  heroText: HexColorSchema,
};
export const PaletteSchema = z.strictObject(PaletteShape);
export const PartialPaletteSchema = PaletteSchema.partial();

export const InvitationDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  templateId: z.string().min(1),
  eventType: EventTypeSchema,
  locales: z.array(LocaleSchema).min(1),
  defaultLocale: LocaleSchema,
  timezone: TimezoneSchema,
  hosts: z.strictObject({
    primary: L10nSchema,
    secondary: L10nSchema.nullable(),
    joiner: L10nSchema.nullable(),
    parents: L10nSchema.nullable(),
  }),
  event: z.strictObject({
    date: ISODateSchema,
    startTime: HHmmSchema,
    endTime: HHmmSchema.nullable(),
    hebrewDate: z.enum(['off', 'day', 'eve']),
    timeFormat: z.enum(['24h', '12h']).nullable(),
    rsvpDeadline: ISODateSchema.nullable(),
  }),
  theme: z.strictObject({ fontPairId: z.string().min(1), palette: PartialPaletteSchema.nullable() }),
  cover: z.strictObject({
    enabled: z.boolean(),
    monogram: L10nSchema.nullable(),
    sealColor: HexColorSchema.nullable(),
    hint: L10nSchema.nullable(),
  }),
  music: z.strictObject({
    enabled: z.boolean(),
    trackId: z.string().min(1).nullable(),
    customUrl: AssetRefSchema.nullable(),
    volume: unit,
    startAtSec: z.number().min(0),
    // added after v1: filled in when a stored document doesn't have it (see migrate.ts)
    videoSound: z.boolean().default(false),
  }),
  share: z.strictObject({
    slug: SlugSchema,
    ogTitle: L10nSchema.nullable(),
    ogDescription: L10nSchema.nullable(),
    ogImage: AssetRefSchema.nullable(),
    noindex: z.boolean(),
  }),
  sections: z.array(SectionSchema),
});

// ---------- template ----------
export const FontPairSchema = z.strictObject({
  id: z.string().min(1),
  display: z.strictObject({ latin: z.string().min(1), hebrew: z.string().min(1) }),
  heading: z.strictObject({ latin: z.string().min(1), hebrew: z.string().min(1) }),
  body: z.strictObject({ latin: z.string().min(1), hebrew: z.string().min(1) }),
  ui: z.strictObject({ latin: z.string().min(1), hebrew: z.string().min(1) }),
});

export const TemplateManifestSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().min(1),
  name: L10nSchema,
  description: L10nSchema,
  categories: z.array(EventTypeSchema).min(1),
  supportsLocales: z.array(LocaleSchema).min(1),
  previewImage: TemplatePathSchema,
  previewVideo: TemplatePathSchema.nullable(),
  tokens: z.strictObject({
    palette: PaletteSchema,
    editablePaletteKeys: z.array(PaletteKeySchema),
    radius: z.strictObject({ card: z.number().min(0), button: z.number().min(0) }),
    divider: z.enum(['gradient_line', 'none']),
  }),
  palettePresets: z.array(
    z.strictObject({ id: z.string().min(1), name: L10nSchema, palette: PartialPaletteSchema }),
  ),
  fontPairs: z.array(FontPairSchema).min(1),
  cover: z.strictObject({
    style: z.enum(['envelope_seal', 'ribbon', 'gatefold', 'pouch', 'swaddle', 'ticket', 'none']),
    renderer: z.enum(['video', 'css3d']),
    poster: TemplatePathSchema,
    posterDesktop: TemplatePathSchema.nullable(),
    openVideo: TemplatePathSchema.nullable(),
    openVideoDesktop: TemplatePathSchema.nullable(),
    holdMs: z.number().int().min(0),
    overlay: z.strictObject({
      kind: z.enum(['wax_seal', 'medallion', 'tag', 'ticket_text', 'none']),
      image: TemplatePathSchema.nullable(),
      recolor: z.boolean(),
      size: z.number().gt(0).max(1),
      offset: z.strictObject({ x: z.number(), y: z.number() }),
      exit: z.enum(['crack', 'lift', 'fade', 'none']),
      text: z.strictObject({
        color: HexColorSchema,
        effect: z.enum(['emboss', 'deboss', 'foil', 'print']),
        maxGlyphs: z.number().int().min(1),
      }),
    }),
    sealColors: z.array(HexColorSchema),
    monogramFont: z.strictObject({ latin: z.string().min(1), hebrew: z.string().min(1) }),
  }),
  hero: z.strictObject({
    options: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          name: L10nSchema,
          media: MediaSchema,
          mediaDesktop: MediaSchema.nullable(),
        }),
      )
      .min(1),
    textColor: HexColorSchema,
    overlayColor: HexColorSchema,
    defaultOverlay: z.number().min(0).max(0.7),
  }),
  music: z.strictObject({
    defaultTrackId: z.string().min(1).nullable(),
    tracks: z.array(
      z.strictObject({
        id: z.string().min(1),
        title: z.string().min(1),
        url: TemplatePathSchema,
        license: z.string(),
      }),
    ),
  }),
  motion: z.strictObject({
    preset: z.enum(['soft', 'none']),
    revealDistance: z.number().min(0),
    revealBlur: z.boolean(),
    stagger: z.number().min(0),
  }),
  assets: z.record(z.string().regex(/^[A-Za-z0-9._-]+$/), TemplatePathSchema),
  decorations: z.partialRecord(z.enum(DECORATION_SLOTS), AssetRefSchema.nullable()),
  sectionDefaults: z.strictObject({
    order: z.array(SectionTypeSchema),
    variants: z.partialRecord(SectionTypeSchema, z.string().min(1)),
  }),
});

const extraSectionKind = z.enum(['transport', 'accommodation', 'dress_code', 'menu', 'activities', 'custom']);

export const EventDefaultsSchema = z.strictObject({
  coverHint: L10nSchema,
  eyebrow: L10nSchema,
  heroTitle: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('hosts') }),
    z.strictObject({ mode: z.literal('custom'), text: L10nSchema }),
  ]),
  countdown: z.strictObject({ title: L10nSchema, subtitle: L10nSchema.nullable(), afterEvent: L10nSchema }),
  story: z.strictObject({ title: L10nSchema, body: L10nSchema }).nullable(),
  venueLabels: z.array(L10nSchema),
  timeline: z.array(z.strictObject({ time: HHmmSchema, label: L10nSchema, icon: TimelineIconSchema })),
  extraSections: z.array(
    z.strictObject({
      kind: extraSectionKind,
      title: L10nSchema,
      subtitle: L10nSchema.nullable(),
      body: L10nSchema,
      illustration: AssetRefSchema.nullable(),
    }),
  ),
  rsvp: z.strictObject({
    title: L10nSchema,
    subtitle: L10nSchema.nullable(),
    messageLabel: L10nSchema,
    successMessage: L10nSchema,
    declineMessage: L10nSchema,
    closedMessage: L10nSchema,
    dietaryOptions: z.array(DietaryKeySchema),
    dietaryNote: L10nSchema.nullable(),
  }),
  closingLine: L10nSchema,
});

export const TemplateDefaultsSchema = z.strictObject({
  templateId: z.string().min(1),
  defaults: z.partialRecord(EventTypeSchema, EventDefaultsSchema),
});

// ---------- RSVP ----------
const trimmed = (max: number) => z.string().trim().max(max);
const RsvpBaseShape = {
  invitationSlug: SlugSchema,
  locale: LocaleSchema,
  hp: z.string(),
  renderedAt: z.number().int().nonnegative(),
  answers: z.record(z.string(), z.union([z.string().max(500), z.boolean()])),
  message: z.string().max(500).nullable(),
  editToken: z.string().min(16).max(200).optional(),
};

export const RsvpSubmissionSchema = z.discriminatedUnion('attending', [
  z.strictObject({
    ...RsvpBaseShape,
    attending: z.literal(true),
    adults: z
      .array(
        z.strictObject({
          firstName: trimmed(40),
          lastName: trimmed(40),
          phone: z.string().max(40).nullable(),
          email: z.string().max(254).nullable(),
          dietary: z.array(DietaryKeySchema),
          dietaryNotes: z.string().max(300).nullable(),
        }),
      )
      .min(1)
      .max(10),
    children: z
      .array(
        z.strictObject({
          fullName: trimmed(80),
          age: z.number().int().min(0).max(17),
          dietary: z.array(DietaryKeySchema),
          dietaryNotes: z.string().max(300).nullable(),
        }),
      )
      .max(10),
  }),
  z.strictObject({
    ...RsvpBaseShape,
    attending: z.literal(false),
    contact: z.strictObject({
      fullName: trimmed(80),
      phone: z.string().max(40).nullable(),
      email: z.string().max(254).nullable(),
    }),
  }),
]);

export const RsvpResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), responseId: z.string(), editToken: z.string() }),
  z.strictObject({
    ok: z.literal(false),
    code: z.enum(['closed', 'invalid', 'rate_limited', 'not_found']),
    fieldErrors: z.record(z.string(), z.string()).optional(),
  }),
]);

// ---------- compile-time contract checks: schemas ⇄ §3 types ----------
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type _ContractChecks = [
  Assert<MutuallyAssignable<z.infer<typeof MediaSchema>, Media>>,
  Assert<MutuallyAssignable<z.infer<typeof VenueSchema>, Venue>>,
  Assert<MutuallyAssignable<z.infer<typeof RsvpConfigSchema>, RsvpConfig>>,
  Assert<MutuallyAssignable<z.infer<typeof SectionSchema>, Section>>,
  Assert<MutuallyAssignable<z.infer<typeof InvitationDocumentSchema>, InvitationDocument>>,
  Assert<MutuallyAssignable<z.infer<typeof TemplateManifestSchema>, TemplateManifest>>,
  Assert<MutuallyAssignable<z.infer<typeof EventDefaultsSchema>, EventDefaults>>,
  Assert<MutuallyAssignable<z.infer<typeof TemplateDefaultsSchema>, TemplateDefaults>>,
  Assert<MutuallyAssignable<z.infer<typeof RsvpSubmissionSchema>, RsvpSubmission>>,
  Assert<MutuallyAssignable<z.infer<typeof RsvpResultSchema>, RsvpResult>>,
];
