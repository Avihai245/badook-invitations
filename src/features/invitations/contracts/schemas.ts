/**
 * Zod schemas matching the §3 contracts in ./types.ts (structural validation).
 * Business rules that need the template or the whole document (translations complete,
 * length caps, section order, palette keys…) live in ./validate.ts.
 */
import { z } from 'zod';
import {
  AMBIENT_KINDS,
  DECORATION_SLOTS,
  DEFAULT_SECTION_ANIMATION,
  DIETARY_KEYS,
  ENTER_PRESETS,
  EVENT_TYPES,
  LOCALES,
  MOTION_EASINGS,
  OPENING_PRESETS,
  PALETTE_KEYS,
  SCROLL_EFFECTS,
  SECTION_LAYOUTS,
  SECTION_TYPES,
  TEMPLATE_TIERS,
  TEXT_REVEALS,
  THEME_TOKEN_RANGES,
  TIMELINE_ICONS,
  type EventDefaults,
  type InvitationDocument,
  type Media,
  type OpeningConfig,
  type RsvpConfig,
  type RsvpResult,
  type RsvpSubmission,
  type Section,
  type SectionAnimation,
  type SectionMedia,
  type SectionPresentation,
  type TemplateDefaults,
  type TemplateManifest,
  type ThemeOverrides,
  type ThemeTokens,
  type TypographyTokens,
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

// ---------- v2: cinematic presentation ----------
export const SectionLayoutSchema = z.enum(SECTION_LAYOUTS);
export const OpeningPresetSchema = z.enum(OPENING_PRESETS);

export const SectionMediaSchema = MediaSchema.extend({
  alt: L10nSchema.nullable().optional(),
  overlay: z.number().min(0).max(0.85).nullable().optional(),
});

const A = DEFAULT_SECTION_ANIMATION;
/** Missing fields take DEFAULT_SECTION_ANIMATION's values (`{ enter: { preset: 'zoom' } }` is enough). */
export const SectionAnimationSchema = z.strictObject({
  enter: z
    .strictObject({
      preset: z.enum(ENTER_PRESETS).default(A.enter.preset),
      duration: z.number().int().min(150).max(4000).default(A.enter.duration),
      delay: z.number().int().min(0).max(3000).default(A.enter.delay),
      distance: z.number().min(0).max(240).default(A.enter.distance),
      easing: z.enum(MOTION_EASINGS).default(A.enter.easing),
    })
    .prefault({}),
  scroll: z.enum(SCROLL_EFFECTS).default(A.scroll),
  text: z.enum(TEXT_REVEALS).default(A.text),
  stagger: z.number().int().min(0).max(600).default(A.stagger),
  intensity: z.number().min(0).max(2).default(A.intensity),
});

const TypeRoleOverrideSchema = z.strictObject({
  size: z.number().min(0.5).max(2).optional(),
  lineHeight: z.number().min(0.7).max(1.6).optional(),
  letterSpacing: z.number().min(-0.05).max(0.3).optional(),
});
const RadiusValue = z.number().min(0).max(64);
export const ThemeOverridesSchema = z.strictObject({
  palette: PartialPaletteSchema.optional(),
  radius: z
    .strictObject({
      card: RadiusValue.optional(),
      button: RadiusValue.optional(),
      media: RadiusValue.optional(),
    })
    .optional(),
  typography: z
    .strictObject({
      display: TypeRoleOverrideSchema.optional(),
      heading: TypeRoleOverrideSchema.optional(),
      body: TypeRoleOverrideSchema.optional(),
      caption: TypeRoleOverrideSchema.optional(),
    })
    .optional(),
  spacing: z
    .strictObject({
      section: z.number().min(0).max(3).optional(),
      gutter: z.number().min(0.5).max(2).optional(),
      block: z.number().min(0).max(3).optional(),
    })
    .optional(),
});

/** The host's scale of the design's tokens (v2): each × the template's; absent = as designed. */
const R = THEME_TOKEN_RANGES;
export const ThemeTokensSchema = z.strictObject({
  typeScale: z.number().min(R.typeScale.min).max(R.typeScale.max).optional(),
  spacing: z.number().min(R.spacing.min).max(R.spacing.max).optional(),
  motion: z.number().min(R.motion.min).max(R.motion.max).optional(),
});

/** The v2 presentation fields of a section (all optional — without them it renders as in v1). */
const PRESENTATION = {
  media: SectionMediaSchema.nullable().optional(),
  layout: SectionLayoutSchema.optional(),
  animation: SectionAnimationSchema.nullable().optional(),
  themeOverrides: ThemeOverridesSchema.nullable().optional(),
};
/** A section's v2 presentation on its own (a template's seeded sections: sectionDefaults.presentation). */
export const SectionPresentationSchema = z.strictObject(PRESENTATION);
/** The hero's media is data.media and it always fills the screen. */
const HERO_PRESENTATION = {
  ...PRESENTATION,
  media: z.null().optional(),
  layout: z.literal('full_bleed').optional(),
};

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
  // added after v1 — filled in when a stored document doesn't have them (see migrate.ts)
  askEmail: z.boolean().default(true),
  nameFormat: z.enum(['split', 'full']).default('split'),
  askMessage: z.boolean().default(true),
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

const section = <T extends string, D extends z.ZodType, P extends z.ZodRawShape = typeof PRESENTATION>(
  type: T,
  data: D,
  presentation: P = PRESENTATION as unknown as P,
) =>
  z.strictObject({
    id: z.string().min(1),
    type: z.literal(type),
    enabled: z.boolean(),
    variant: z.string().min(1).optional(),
    data,
    ...presentation,
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
    // added after v1 (see migrate.ts): a YouTube / Vimeo background's subtitles — hidden unless on
    captions: z.boolean().default(false),
    // added after v1: the line greeting a guest by name on their personal link ({guest}); null = none
    greeting: L10nSchema.nullable().default(null),
  }),
  HERO_PRESENTATION,
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

// ── v2 section types ──
export const ParentsSectionSchema = section(
  'parents',
  z.strictObject({
    title: L10nSchema.nullable(),
    items: z.array(z.strictObject({ id: z.string().min(1), label: L10nSchema, names: L10nSchema })),
    note: L10nSchema.nullable(),
  }),
);

export const WhenSectionSchema = section(
  'when',
  z.strictObject({
    title: L10nSchema.nullable(),
    showWeekday: z.boolean(),
    showHebrewDate: z.boolean(),
    showTime: z.boolean(),
    countdown: z.boolean(),
    showCalendar: z.boolean(),
    note: L10nSchema.nullable(),
  }),
);

export const WhereSectionSchema = section(
  'where',
  z.strictObject({ venue: VenueSchema, note: L10nSchema.nullable() }),
);

export const QuoteSectionSchema = section(
  'quote',
  z.strictObject({ text: L10nSchema, attribution: L10nSchema.nullable() }),
);

export const CustomSectionSchema = section(
  'custom',
  z.strictObject({
    title: L10nSchema.nullable(),
    subtitle: L10nSchema.nullable(),
    body: L10nSchema,
    cta: z.strictObject({ label: L10nSchema, url: z.string().min(1) }).nullable(),
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
  ParentsSectionSchema,
  WhenSectionSchema,
  WhereSectionSchema,
  QuoteSectionSchema,
  CustomSectionSchema,
]);

export const InvitationDocumentSchema = z.strictObject({
  schemaVersion: z.literal(2),
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
  theme: z.strictObject({
    fontPairId: z.string().min(1),
    palette: PartialPaletteSchema.nullable(),
    // v2: the host's type scale, spacing density and motion intensity (feature `cinematic`)
    tokens: ThemeTokensSchema.nullable().optional(),
  }),
  cover: z.strictObject({
    enabled: z.boolean(),
    monogram: L10nSchema.nullable(),
    sealColor: HexColorSchema.nullable(),
    hint: L10nSchema.nullable(),
    // v2: the host's opening (feature `cinematic`); absent / null → the template's
    opening: OpeningPresetSchema.nullable().optional(),
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

// ---------- template: tokens v2 & the opening (each defaults to the design's own values) ----------
const TypeRoleSchema = z.strictObject({
  size: z.number().min(0.5).max(2).default(1),
  lineHeight: z.number().min(0.7).max(1.6).default(1),
  letterSpacing: z.number().min(-0.05).max(0.3).default(0),
});
export const TypographySchema = z.strictObject({
  display: TypeRoleSchema.prefault({}),
  heading: TypeRoleSchema.prefault({}),
  body: TypeRoleSchema.prefault({}),
  caption: TypeRoleSchema.prefault({}),
});
export const SpacingSchema = z.strictObject({
  section: z.number().min(0).max(3).default(1),
  gutter: z.number().min(0.5).max(2).default(1),
  block: z.number().min(0).max(3).default(1),
});
export const OpeningConfigSchema = z.strictObject({
  preset: OpeningPresetSchema,
  trigger: z.enum(['tap', 'scroll']).optional(),
  motion: z.enum(['swing', 'slide', 'part', 'rise']).optional(),
  color: HexColorSchema.nullable().optional(),
  // a photo-led opening: the fireworks' sky / the gold dust's veil over the hero's picture
  backdrop: z.literal('hero').nullable().optional(),
});

export const TemplateManifestSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().min(1),
  name: L10nSchema,
  description: L10nSchema,
  // added after v2: a manifest without it is a standard design
  tier: z.enum(TEMPLATE_TIERS).default('standard'),
  // added with the flagship photographic design: false keeps a design out of the public gallery
  listed: z.boolean().default(true),
  categories: z.array(EventTypeSchema).min(1),
  supportsLocales: z.array(LocaleSchema).min(1),
  previewImage: TemplatePathSchema,
  previewVideo: TemplatePathSchema.nullable(),
  tokens: z.strictObject({
    palette: PaletteSchema,
    editablePaletteKeys: z.array(PaletteKeySchema),
    radius: z.strictObject({
      card: z.number().min(0),
      button: z.number().min(0),
      // added in v2: a section's framed picture (absent → card)
      media: z.number().min(0).optional(),
    }),
    divider: z.enum(['gradient_line', 'none']),
    // added in v2 (tokens v2): absent → the design's own scale, spacing and scrim
    typography: TypographySchema.prefault({}),
    spacing: SpacingSchema.prefault({}),
    overlay: z
      .strictObject({
        color: HexColorSchema.nullable().default(null),
        opacity: z.number().min(0).max(0.85).nullable().default(null),
      })
      .prefault({}),
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
    // added in v2: a cinematic opening instead of the style's own (feature `cinematic`)
    opening: OpeningConfigSchema.nullable().default(null),
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
    // added after v2: optional — without it the renderer picks the template's particles by id
    ambient: z.enum(AMBIENT_KINDS).optional(),
    // added in v2 (tokens v2): × every travel of the motion engine
    intensity: z.number().min(0).max(2).default(1),
  }),
  assets: z.record(z.string().regex(/^[A-Za-z0-9._-]+$/), TemplatePathSchema),
  decorations: z.partialRecord(z.enum(DECORATION_SLOTS), AssetRefSchema.nullable()),
  sectionDefaults: z.strictObject({
    order: z.array(SectionTypeSchema),
    variants: z.partialRecord(SectionTypeSchema, z.string().min(1)),
    // v2: the seeded sections' presentation by seeded id (a JSON-only template's photos and rhythm)
    presentation: z.record(z.string().min(1), SectionPresentationSchema).optional(),
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
  // v2: the copy of the schema-v2 sections the template's order seeds (absent → generic copy)
  quote: z.strictObject({ text: L10nSchema, attribution: L10nSchema.nullable() }).optional(),
  when: z.strictObject({ title: L10nSchema.nullable(), note: L10nSchema.nullable() }).optional(),
  parents: z.strictObject({ title: L10nSchema.nullable(), note: L10nSchema.nullable() }).optional(),
  custom: z
    .array(
      z.strictObject({ title: L10nSchema.nullable(), subtitle: L10nSchema.nullable(), body: L10nSchema }),
    )
    .optional(),
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
  // a personal link's token (/i/<slug>?g=…): the reply belongs to that guest
  guestToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,64}$/)
    .optional(),
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
          // one field instead of first + last (rsvp.nameFormat 'full')
          fullName: trimmed(80).optional(),
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
  Assert<MutuallyAssignable<z.infer<typeof SectionMediaSchema>, SectionMedia>>,
  Assert<MutuallyAssignable<z.infer<typeof SectionAnimationSchema>, SectionAnimation>>,
  Assert<MutuallyAssignable<z.infer<typeof ThemeOverridesSchema>, ThemeOverrides>>,
  Assert<MutuallyAssignable<z.infer<typeof ThemeTokensSchema>, ThemeTokens>>,
  Assert<MutuallyAssignable<z.infer<typeof SectionPresentationSchema>, SectionPresentation>>,
  Assert<MutuallyAssignable<z.infer<typeof TypographySchema>, TypographyTokens>>,
  Assert<MutuallyAssignable<z.infer<typeof OpeningConfigSchema>, OpeningConfig>>,
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
