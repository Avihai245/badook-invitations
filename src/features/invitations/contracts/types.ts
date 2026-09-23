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
  schemaVersion: 1;
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

interface Base<T extends string, D> {
  id: string;
  type: T;
  enabled: boolean;
  variant?: string;
  data: D;
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
      }
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

export interface TemplateManifest {
  id: string;
  version: number;
  name: L10n;
  description: L10n;
  categories: EventType[];
  supportsLocales: Locale[];
  previewImage: string;
  previewVideo: string | null;
  tokens: {
    palette: Palette;
    editablePaletteKeys: (keyof Palette)[];
    radius: { card: number; button: number };
    divider: 'gradient_line' | 'none';
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
  motion: { preset: 'soft' | 'none'; revealDistance: number; revealBlur: boolean; stagger: number };
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
