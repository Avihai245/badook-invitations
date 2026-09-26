/**
 * Invitation contracts — implemented exactly as MASTER_PROMPT §3.
 * Matching Zod schemas live in ./schemas.ts (kept in sync by compile-time checks there).
 * Do not change a shape here without updating the contract section of the master prompt first.
 */

// ---------- i18n ----------
export type Locale = 'he' | 'en'; // extensible later: 'ar' | 'ru' | 'fr' ...
export const LOCALES = ['he', 'en'] as const satisfies readonly Locale[];
export const RTL_LOCALES: readonly Locale[] = ['he'];
export const dirOf = (l: Locale) => (RTL_LOCALES.includes(l) ? 'rtl' : 'ltr');
/** User-authored text. Must contain every locale listed in document.locales (validated on publish). */
export type L10n = Partial<Record<Locale, string>>;

export type EventType =
  | 'wedding'
  | 'engagement'
  | 'henna'
  | 'bar_mitzvah'
  | 'bat_mitzvah'
  | 'brit'
  | 'baby_shower'
  | 'birthday'
  | 'save_the_date'
  | 'corporate'
  | 'other';
export const EVENT_TYPES = [
  'wedding',
  'engagement',
  'henna',
  'bar_mitzvah',
  'bat_mitzvah',
  'brit',
  'baby_shower',
  'birthday',
  'save_the_date',
  'corporate',
  'other',
] as const satisfies readonly EventType[];

export type HHmm = string; // /^([01]\d|2[0-3]):[0-5]\d$/
export type ISODate = string; // 'YYYY-MM-DD' in document.timezone
export type AssetRef = string; // 'template:<key>' | 'upload:<storage path>' | absolute https URL

// ---------- document ----------
export interface InvitationDocument {
  /** 2 since the cinematic presentation (v1 documents are migrated on read and on save: migrate.ts) */
  schemaVersion: 2;
  templateId: string;
  eventType: EventType;
  locales: Locale[]; // order = switcher order
  defaultLocale: Locale; // must be in locales
  timezone: string; // IANA, e.g. 'Asia/Jerusalem'
  hosts: {
    primary: L10n;
    secondary: L10n | null;
    joiner: L10n | null; // '&'
    parents: L10n | null; // shown in footer when footer.showParents
  };
  event: {
    date: ISODate;
    startTime: HHmm;
    endTime: HHmm | null; // if < startTime → next day
    hebrewDate: 'off' | 'day' | 'eve'; // 'eve' → "אור ל…" (Hebrew date after sunset)
    timeFormat: '24h' | '12h' | null; // null → locale default (he 24h, en 12h)
    rsvpDeadline: ISODate | null;
  };
  theme: { fontPairId: string; palette: Partial<Palette> | null }; // only template.editablePaletteKeys
  cover: {
    // the cover design itself comes from the template
    enabled: boolean;
    monogram: L10n | null; // overlay text; ≤ template.cover.overlay.text.maxGlyphs visible glyphs (e.g. 'N&I', 'נ&א', 'DANA 30')
    sealColor: string | null; // must be in template.cover.sealColors when overlay.recolor
    hint: L10n | null;
    /** v2 (cinematic): the host's choice of opening; absent / null → the template's (cover.opening) */
    opening?: OpeningPreset | null;
  };
  music: {
    enabled: boolean;
    trackId: string | null;
    customUrl: AssetRef | null;
    volume: number;
    startAtSec: number;
    videoSound: boolean; // the hero video's own sound instead of the track (when the hero is a video)
  };
  share: {
    slug: string;
    ogTitle: L10n | null;
    ogDescription: L10n | null;
    ogImage: AssetRef | null;
    noindex: boolean;
  };
  sections: Section[]; // render order; hero first, footer last, ≤1 rsvp
}

export interface Media {
  kind: 'image' | 'video';
  src: AssetRef;
  poster: AssetRef | null;
  focalPoint: { x: number; y: number };
}

// ---------- v2: cinematic presentation (feature `cinematic`) ----------
/**
 * How a section is laid out: `stack` is the classic single column (a section's media shows as a
 * framed picture at its top); `full_bleed` puts the media behind the text, edge to edge;
 * `split_start` / `split_end` put it beside the text on wide screens — start = the reading side (right
 * in Hebrew) — and above / below it on a phone; `parallax` is full-bleed with the media moving slower
 * than the page; `video_bg` is full-bleed with a looping muted video (its poster until it may play).
 * A layout that needs media renders as `stack` while the section has none.
 */
export type SectionLayout = 'stack' | 'full_bleed' | 'split_start' | 'split_end' | 'parallax' | 'video_bg';
export const SECTION_LAYOUTS = [
  'stack',
  'full_bleed',
  'split_start',
  'split_end',
  'parallax',
  'video_bg',
] as const satisfies readonly SectionLayout[];

/** A section's own picture or video: an upload (or a template asset), never a YouTube / Vimeo link. */
export interface SectionMedia extends Media {
  /** what a content picture shows (stack / split); background media is decorative. null → none */
  alt?: L10n | null;
  /** the scrim over media that text sits on, 0..0.85; null → the template's (tokens.overlay) */
  overlay?: number | null;
}

/**
 * How a section's blocks come in: `auto` is the template's own reveal (§9A.6); the others are
 * transform/opacity presets — `slide_start` comes from the reading side, `tilt` lifts in tipped back.
 */
export type EnterPreset =
  'auto' | 'none' | 'fade' | 'rise' | 'sink' | 'zoom' | 'zoom_out' | 'slide_start' | 'slide_end' | 'tilt';
export const ENTER_PRESETS = [
  'auto',
  'none',
  'fade',
  'rise',
  'sink',
  'zoom',
  'zoom_out',
  'slide_start',
  'slide_end',
  'tilt',
] as const satisfies readonly EnterPreset[];
/** What the media does while the section scrolls by: drifts slower than the page, or slowly zooms. */
export type ScrollEffect = 'none' | 'parallax' | 'ken_burns';
export const SCROLL_EFFECTS = ['none', 'parallax', 'ken_burns'] as const satisfies readonly ScrollEffect[];
/** Titles, subtitles, texts and quotes appearing letter by letter, word by word or line by line. */
export type TextReveal = 'none' | 'letters' | 'words' | 'lines';
export const TEXT_REVEALS = ['none', 'letters', 'words', 'lines'] as const satisfies readonly TextReveal[];
export type MotionEasing = 'smooth' | 'spring' | 'gentle' | 'linear';
export const MOTION_EASINGS = [
  'smooth',
  'spring',
  'gentle',
  'linear',
] as const satisfies readonly MotionEasing[];

/**
 * A section's motion, declaratively (renderer/motion/engine.ts reads it). Where the browser has
 * scroll-driven animations the enter preset is tied to the scroll (`duration` / `delay` / `stagger`
 * become scroll distances: 0.3px per ms); elsewhere it plays once as the section comes into view.
 * Only transform and opacity move; nothing moves with reduced motion.
 */
export interface SectionAnimation {
  enter: {
    preset: EnterPreset;
    /** ms, 150..4000 */
    duration: number;
    /** ms, 0..3000 */
    delay: number;
    /** px of travel (rise, sink, slides, tilt), 0..240 — × intensity */
    distance: number;
    easing: MotionEasing;
  };
  scroll: ScrollEffect;
  text: TextReveal;
  /** ms between the section's blocks (and a text reveal's letters / words / lines), 0..600 */
  stagger: number;
  /** × the template's motion.intensity (travel, parallax depth, zoom), 0..2 */
  intensity: number;
}

/** The type roles of the design (§9A.2): names and titles, subtitles and labels, texts, small print. */
export type TypeRole = 'display' | 'heading' | 'body' | 'caption';
export const TYPE_ROLES = ['display', 'heading', 'body', 'caption'] as const satisfies readonly TypeRole[];
/** One role of the type scale, relative to the design's own (§9A.2) so every template keeps its look. */
export interface TypeRoleTokens {
  /** × the role's base sizes, 0.5..2 */
  size: number;
  /** × the role's base line heights, 0.7..1.6 */
  lineHeight: number;
  /** em added to the role's letter spacing in Latin text (Hebrew is never letter-spaced), -0.05..0.3 */
  letterSpacing: number;
}
export type TypographyTokens = Record<TypeRole, TypeRoleTokens>;
/** × the design's spacing: section padding (56 / 80px), the side gutter (24px), the gaps in a section. */
export interface SpacingTokens {
  section: number;
  gutter: number;
  block: number;
}
/** The neutral values — the design as it is (what a manifest without tokens v2 gets). */
export const DEFAULT_TYPE_ROLE: Readonly<TypeRoleTokens> = Object.freeze({
  size: 1,
  lineHeight: 1,
  letterSpacing: 0,
});
export const DEFAULT_SPACING: Readonly<SpacingTokens> = Object.freeze({ section: 1, gutter: 1, block: 1 });
/** What a section's `animation` starts from (the editor's defaults; the schema fills missing fields). */
export const DEFAULT_SECTION_ANIMATION: Readonly<SectionAnimation> = Object.freeze({
  enter: Object.freeze({
    preset: 'auto' as const,
    duration: 900,
    delay: 0,
    distance: 40,
    easing: 'smooth' as const,
  }),
  scroll: 'none' as const,
  text: 'none' as const,
  stagger: 80,
  intensity: 1,
});

/** A section's own tokens (v2): only what it changes. */
export interface ThemeOverrides {
  palette?: Partial<Palette>;
  radius?: { card?: number; button?: number; media?: number };
  typography?: Partial<Record<TypeRole, Partial<TypeRoleTokens>>>;
  spacing?: Partial<SpacingTokens>;
}

/**
 * v2 presentation any section may carry — all optional: without them a section renders exactly as in
 * v1. They show only while the event has the `cinematic` feature (else the plain rendering). The
 * hero's media is `data.media` and it always fills the screen: its `media` is null and its `layout`
 * `full_bleed` when set.
 */
export interface SectionPresentation {
  media?: SectionMedia | null;
  layout?: SectionLayout;
  animation?: SectionAnimation | null;
  themeOverrides?: ThemeOverrides | null;
}

/**
 * The cinematic openings (renderer/cover): `envelope` is the template's own cover (envelope, ticket,
 * pouch… or its opening video); `gate` two doors swing open; `curtain` a theatre curtain parts or
 * rises; `fireworks` a night sky bursts into fireworks; `gold_dust` a veil of gold dust blows away.
 */
export type OpeningPreset = 'envelope' | 'gate' | 'curtain' | 'fireworks' | 'gold_dust';
export const OPENING_PRESETS = [
  'envelope',
  'gate',
  'curtain',
  'fireworks',
  'gold_dust',
] as const satisfies readonly OpeningPreset[];
/** The template's opening (manifest cover.opening, v2). */
export interface OpeningConfig {
  preset: OpeningPreset;
  /**
   * `scroll`: scrolling or swiping opens it too, with a "scroll to enter" cue (default for the gate
   * and the curtain); `tap`: a tap only (default for the others)
   */
  trigger?: 'tap' | 'scroll';
  /** gate: the doors swing or slide apart · curtain: it parts to the sides or rises */
  motion?: 'swing' | 'slide' | 'part' | 'rise';
  /** the doors' / curtain's / sky's color; null → from the palette */
  color?: string | null;
}

interface Base<T extends string, D, M extends SectionMedia | null = SectionMedia | null, L = SectionLayout> {
  id: string;
  type: T;
  enabled: boolean;
  variant?: string;
  data: D;
  // v2 presentation (SectionPresentation)
  media?: M;
  layout?: L;
  animation?: SectionAnimation | null;
  themeOverrides?: ThemeOverrides | null;
}

export type Section =
  | Base<
      'hero',
      {
        eyebrow: L10n | null;
        title: { mode: 'hosts' } | { mode: 'custom'; text: L10n };
        showDate: boolean;
        locationLine: L10n | null;
        media: Media;
        overlayOpacity: number; // 0..0.7
        /** a YouTube / Vimeo background's own subtitles (burned-in text can't be hidden) */
        captions: boolean;
        /** greets the guest by name on their personal link — `{guest}` = the name; null = none */
        greeting: L10n | null;
      },
      null,
      'full_bleed'
    >
  | Base<
      'countdown',
      {
        title: L10n;
        subtitle: L10n | null;
        target: 'event' | { date: ISODate; time: HHmm };
        afterEvent: L10n;
      }
    >
  | Base<
      'text',
      {
        kind: 'story' | 'transport' | 'accommodation' | 'dress_code' | 'menu' | 'activities' | 'custom';
        title: L10n | null;
        subtitle: L10n | null;
        body: L10n; // '\n' = line break
        illustration: AssetRef | null;
        cta: { label: L10n; url: string } | null;
      }
    >
  | Base<'venues', { items: Venue[] }>
  | Base<
      'timeline',
      {
        title: L10n;
        showDate: boolean;
        revealMode: 'none' | 'flip';
        items: { id: string; time: HHmm; label: L10n; icon: TimelineIcon }[];
      }
    >
  | Base<'faq', { title: L10n; items: { id: string; q: L10n; a: L10n }[] }>
  | Base<
      'gallery',
      { title: L10n | null; layout: 'carousel' | 'grid'; images: { id: string; src: AssetRef; alt: L10n }[] }
    >
  | Base<
      'gifts',
      {
        title: L10n;
        body: L10n;
        links: {
          id: string;
          kind: 'registry' | 'bit' | 'paybox' | 'paypal' | 'bank_transfer' | 'link';
          label: L10n;
          url: string | null;
          details: L10n | null;
        }[];
      }
    >
  | Base<
      'reveal',
      { title: L10n; mechanic: 'scratch' | 'tap' | 'spin'; prompt: L10n; showCalendarButton: boolean }
    >
  | Base<'rsvp', RsvpConfig>
  | Base<
      'footer',
      {
        showHosts: boolean;
        showDate: boolean;
        showParents: boolean;
        closingLine: L10n | null;
        showCredit: boolean;
      }
    >
  // ── v2 section types ──
  | Base<
      'parents',
      {
        title: L10n | null;
        /** "The bride's parents" · "Rachel & Moshe Cohen"; none → `hosts.parents` as one line */
        items: { id: string; label: L10n; names: L10n }[];
        /** e.g. "together with the grandparents …" */
        note: L10n | null;
      }
    >
  | Base<
      'when',
      {
        title: L10n | null;
        showWeekday: boolean;
        /** the Hebrew date line (as `event.hebrewDate` formats it; nothing while that is off) */
        showHebrewDate: boolean;
        showTime: boolean;
        /** a small countdown to the event under the date */
        countdown: boolean;
        /** the "Add to calendar" menu */
        showCalendar: boolean;
        note: L10n | null;
      }
    >
  | Base<
      'where',
      {
        /** one place, told big: its label is the section title; map and buttons as in venues */
        venue: Venue;
        /** directions, parking… */
        note: L10n | null;
      }
    >
  | Base<'quote', { text: L10n; attribution: L10n | null }>
  | Base<
      'custom',
      {
        title: L10n | null;
        subtitle: L10n | null;
        body: L10n; // '\n' = line break
        cta: { label: L10n; url: string } | null;
      }
    >;

export interface Venue {
  id: string;
  label: L10n;
  name: L10n;
  address: L10n;
  geo: { lat: number; lng: number } | null;
  mapsQuery: string | null; // used when geo is null
  date: ISODate | null; // null → event.date
  startTime: HHmm;
  endTime: HHmm | null;
  showMap: boolean;
  buttons: { maps: boolean; waze: boolean; calendar: boolean };
}

export type TimelineIcon =
  | 'glass'
  | 'chuppah'
  | 'rings'
  | 'heart'
  | 'walk'
  | 'dinner'
  | 'music'
  | 'party'
  | 'cake'
  | 'camera'
  | 'bus'
  | 'toast'
  | 'star'
  | 'gift'
  | 'baby'
  | 'torah';

export type DietaryKey =
  | 'none'
  | 'kosher'
  | 'kosher_mehadrin'
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'dairy_free'
  | 'pescatarian'
  | 'nut_allergy'
  | 'other_allergy'
  | 'kids_meal';

export interface RsvpConfig {
  title: L10n;
  subtitle: L10n | null;
  askChildren: boolean;
  maxAdults: number;
  maxChildren: number; // 1..10 / 0..10
  requirePhone: boolean;
  requireEmail: boolean; // only when askEmail
  askEmail: boolean; // false → no email field at all
  nameFormat: 'split' | 'full'; // first + last name, or one full-name field
  askMessage: boolean; // the free-text message (messageLabel) — false → not asked
  perAttendeeDetails: boolean; // false → only counts + primary contact
  dietary: { enabled: boolean; options: DietaryKey[]; note: L10n | null };
  customQuestions: {
    id: string;
    type: 'text' | 'select' | 'boolean';
    required: boolean;
    label: L10n;
    options?: { value: string; label: L10n }[];
  }[];
  messageLabel: L10n | null;
  successMessage: L10n;
  declineMessage: L10n;
  closedMessage: L10n;
}

// ---------- template ----------
export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentInk: string;
  line: string;
  heroText: string;
}
export interface FontPair {
  id: string;
  display: { latin: string; hebrew: string }; // script/decorative (names, headings)
  heading: { latin: string; hebrew: string };
  body: { latin: string; hebrew: string };
  ui: { latin: string; hebrew: string }; // forms/buttons
}
export type CoverStyle = 'envelope_seal' | 'ribbon' | 'gatefold' | 'pouch' | 'swaddle' | 'ticket' | 'none';
/** A design's tier — the gallery badges premium designs ('standard' when a manifest leaves it out). */
export type TemplateTier = 'standard' | 'premium';
export const TEMPLATE_TIERS = ['standard', 'premium'] as const satisfies readonly TemplateTier[];
/**
 * The hero's ambient particles (renderer/fx): drifting petals or leaves, falling confetti, twinkling
 * sparkles or stars, rising bubbles / balloons / hearts / music notes / embers, glowing fireflies,
 * 8-bit pixels — or `none`. The cover's opening and the RSVP "thank you" burst in the same theme.
 */
export type AmbientKind =
  | 'none'
  | 'petals'
  | 'leaves'
  | 'confetti'
  | 'sparkles'
  | 'stars'
  | 'bubbles'
  | 'balloons'
  | 'hearts'
  | 'fireflies'
  | 'embers'
  | 'notes'
  | 'pixels';
export const AMBIENT_KINDS = [
  'none',
  'petals',
  'leaves',
  'confetti',
  'sparkles',
  'stars',
  'bubbles',
  'balloons',
  'hearts',
  'fireflies',
  'embers',
  'notes',
  'pixels',
] as const satisfies readonly AmbientKind[];

export interface TemplateManifest {
  id: string;
  version: number;
  name: L10n;
  description: L10n;
  tier: TemplateTier;
  categories: EventType[];
  supportsLocales: Locale[];
  previewImage: string;
  previewVideo: string | null;
  tokens: {
    palette: Palette;
    editablePaletteKeys: (keyof Palette)[];
    /** px; `media` (v2): a section's framed picture — absent → `card` */
    radius: { card: number; button: number; media?: number };
    divider: 'gradient_line' | 'none';
    // v2 — each defaults to the design's own values, so a manifest without them keeps its look
    typography: TypographyTokens;
    spacing: SpacingTokens;
    /** the scrim over section media under text; null → the hero's overlayColor / 0.42 */
    overlay: { color: string | null; opacity: number | null };
  };
  palettePresets: { id: string; name: L10n; palette: Partial<Palette> }[]; // keys ⊆ editablePaletteKeys; shown as swatches
  fontPairs: FontPair[]; // [0] is default
  cover: {
    style: CoverStyle;
    renderer: 'video' | 'css3d'; // 'video' is the default for all pack templates
    poster: string;
    posterDesktop: string | null; // closed state, NO text baked in
    openVideo: string | null;
    openVideoDesktop: string | null; // first frame == poster; first holdMs are static
    holdMs: number; // overlay exit plays inside this window
    overlay: {
      kind: 'wax_seal' | 'medallion' | 'tag' | 'ticket_text' | 'none';
      image: string | null; // blank transparent PNG (no letters); null for ticket_text
      recolor: boolean; // tint with document.cover.sealColor (mask + multiply)
      size: number; // fraction of the viewport's shorter side
      offset: { x: number; y: number }; // from viewport center, fraction of the shorter side
      exit: 'crack' | 'lift' | 'fade' | 'none';
      text: { color: string; effect: 'emboss' | 'deboss' | 'foil' | 'print'; maxGlyphs: number };
    };
    sealColors: string[];
    monogramFont: { latin: string; hebrew: string };
    /** v2: a cinematic opening instead of the style's own; null → the style's (feature `cinematic`) */
    opening: OpeningConfig | null;
  };
  hero: {
    options: { id: string; name: L10n; media: Media; mediaDesktop: Media | null }[]; // [0] default; offered in the editor
    textColor: string;
    overlayColor: string;
    defaultOverlay: number;
  };
  music: {
    defaultTrackId: string | null;
    tracks: { id: string; title: string; url: string; license: string }[];
  };
  motion: {
    preset: 'soft' | 'none';
    revealDistance: number;
    revealBlur: boolean;
    stagger: number;
    /** optional: the hero's particles; without it renderer/fx/theme.ts picks one by template id */
    ambient?: AmbientKind;
    /** v2: × every travel of the motion engine (reveal distance, parallax depth, zoom), 0..2; default 1 */
    intensity: number;
  };
  assets: Record<string, string>; // referenced as 'template:<key>'
  decorations: Partial<
    Record<'afterHero' | 'betweenVenues' | 'afterTimeline' | 'beforeRsvp' | 'footer', AssetRef | null>
  >;
  sectionDefaults: { order: Section['type'][]; variants: Partial<Record<Section['type'], string>> };
}

// ---------- template seed copy (invitation-templates-pack/<id>/defaults.json) ----------
export interface EventDefaults {
  coverHint: L10n;
  eyebrow: L10n;
  heroTitle: { mode: 'hosts' } | { mode: 'custom'; text: L10n };
  countdown: { title: L10n; subtitle: L10n | null; afterEvent: L10n };
  story: { title: L10n; body: L10n } | null;
  venueLabels: L10n[]; // one venue item is seeded per label
  timeline: { time: HHmm; label: L10n; icon: TimelineIcon }[];
  extraSections: {
    kind: 'transport' | 'accommodation' | 'dress_code' | 'menu' | 'activities' | 'custom';
    title: L10n;
    subtitle: L10n | null;
    body: L10n;
    illustration: AssetRef | null;
  }[];
  rsvp: {
    title: L10n;
    subtitle: L10n | null;
    messageLabel: L10n;
    successMessage: L10n;
    declineMessage: L10n;
    closedMessage: L10n;
    dietaryOptions: DietaryKey[];
    dietaryNote: L10n | null;
  };
  closingLine: L10n;
}
export interface TemplateDefaults {
  templateId: string;
  defaults: Partial<Record<EventType, EventDefaults>>;
}
// seedDocument(template, defaults, wizardInput) → InvitationDocument. If the chosen eventType has no defaults
// in this template, fall back to the closest one (wedding↔engagement, bar↔bat mitzvah, brit↔baby_shower) and flag
// "review texts" in the editor. Seed only the locales the host selected.

// ---------- live text tokens ----------
// Any user L10n string may contain {primary} {secondary} {date} {hebrewDate} {deadline}.
// They are interpolated at render time in the active locale (so changing the date updates every text).
// Unknown tokens render verbatim. Length caps are measured after interpolation with a 12-char budget per token.

// ---------- RSVP payload (guest → server) ----------
export type RsvpSubmission = {
  invitationSlug: string;
  locale: Locale;
  hp: string; // honeypot, must be ''
  renderedAt: number; // ms epoch when form mounted; reject if submit < 3s later
  answers: Record<string, string | boolean>;
  message: string | null; // ≤ 500 chars
  editToken?: string; // present when updating an existing response
  guestToken?: string; // from a guest's personal link: the reply is linked to that guest
} & (
  | {
      attending: true;
      adults: {
        firstName: string;
        lastName: string;
        fullName?: string; // instead of first + last when rsvp.nameFormat is 'full'
        phone: string | null;
        email: string | null;
        dietary: DietaryKey[];
        dietaryNotes: string | null;
      }[]; // [0] = primary contact
      children: { fullName: string; age: number; dietary: DietaryKey[]; dietaryNotes: string | null }[];
    }
  | { attending: false; contact: { fullName: string; phone: string | null; email: string | null } }
);
export type RsvpResult =
  | { ok: true; responseId: string; editToken: string }
  | {
      ok: false;
      code: 'closed' | 'invalid' | 'rate_limited' | 'not_found';
      fieldErrors?: Record<string, string>;
    };

// ---------- helpers (not part of §3, derived from it) ----------
export type SectionType = Section['type'];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;
export type SectionData<T extends SectionType> = SectionOf<T>['data'];
export const SECTION_TYPES = [
  'hero',
  'countdown',
  'text',
  'venues',
  'timeline',
  'faq',
  'gallery',
  'gifts',
  'reveal',
  'rsvp',
  'footer',
  'parents',
  'when',
  'where',
  'quote',
  'custom',
] as const satisfies readonly SectionType[];
/** The section types schema v2 added. */
export const V2_SECTION_TYPES = [
  'parents',
  'when',
  'where',
  'quote',
  'custom',
] as const satisfies readonly SectionType[];
export const TIMELINE_ICONS = [
  'glass',
  'chuppah',
  'rings',
  'heart',
  'walk',
  'dinner',
  'music',
  'party',
  'cake',
  'camera',
  'bus',
  'toast',
  'star',
  'gift',
  'baby',
  'torah',
] as const satisfies readonly TimelineIcon[];
export const DIETARY_KEYS = [
  'none',
  'kosher',
  'kosher_mehadrin',
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'pescatarian',
  'nut_allergy',
  'other_allergy',
  'kids_meal',
] as const satisfies readonly DietaryKey[];
export const PALETTE_KEYS = [
  'bg',
  'surface',
  'ink',
  'inkMuted',
  'accent',
  'accentInk',
  'line',
  'heroText',
] as const satisfies readonly (keyof Palette)[];
export type DecorationSlot = keyof TemplateManifest['decorations'];
export const DECORATION_SLOTS = [
  'afterHero',
  'betweenVenues',
  'afterTimeline',
  'beforeRsvp',
  'footer',
] as const satisfies readonly DecorationSlot[];
