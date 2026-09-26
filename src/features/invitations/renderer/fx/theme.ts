import type {
  AmbientKind,
  EventType,
  InvitationDocument,
  Palette,
  TemplateManifest,
} from '../../contracts/types';
import { hexToRgb, mixHex, relativeLuminance } from '../../lib/contrast';

/**
 * The invitation's particle theme (renderer/fx): the hero's ambient layer, the burst that plays when
 * the cover opens and the one that celebrates an RSVP. Pure data — the same on the server and in the
 * browser (colors are resolved here, from the palette, so every render is identical).
 */

/** What bursts: every ambient kind but `none`. */
export type BurstKind = Exclude<AmbientKind, 'none'>;

/**
 * The fallback table — every template's particles when its manifest has no `motion.ambient`:
 * `[ambient, burst]` (the burst defaults to the ambient kind). It lists the pack's templates and the
 * ones being added, so each gets a fitting effect without touching its manifest; an id missing here
 * falls back by event type (`CATEGORY_FALLBACK`).
 */
export const FX_BY_TEMPLATE: Readonly<Record<string, AmbientKind | readonly [AmbientKind, BurstKind]>> = {
  // ── the 8 originals ──
  'sahar-bordeaux': 'petals', // watercolour sunset over vineyards — rose petals
  'papercut-gold': 'sparkles', // gold papercut — gold glints
  'caesarea-shore': ['sparkles', 'petals'], // sun glints on the sea; white petals for the beach wedding
  'ramon-dusk': ['stars', 'sparkles'], // desert dusk — the first stars
  atara: ['sparkles', 'confetti'], // bar/bat mitzvah crown — silver-gold, confetti to celebrate
  nitzan: 'bubbles', // brit / baby shower — soft bubbles
  'rooftop-dusk': ['fireflies', 'confetti'], // rooftop party — string-light bokeh, then confetti
  'honey-meadow': 'petals', // sunny meadow — wildflower petals
  // ── the drawn-scene templates ──
  'midnight-bloom': 'fireflies', // dark still-life florals — golden motes
  klaf: ['sparkles', 'confetti'], // parchment and quill — gold dust
  'cocoa-teddy': ['bubbles', 'balloons'], // nursery teddy — bubbles; balloons fly off the cover
  'neon-night': 'confetti', // neon party — neon confetti
  'cloud-arch': 'petals', // quiet luxury — pale petals
  marrakech: ['fireflies', 'sparkles'], // henna night — lantern glow
  'dino-hatch': ['balloons', 'confetti'], // kids' party — balloons
  'jasper-cameo': ['sparkles', 'petals'], // Wedgwood cameo — white-gold glints
  'match-day': 'confetti', // stadium confetti
  'almond-blossom': 'petals', // almond bloom — pink and white petals
  'deco-gatsby': ['sparkles', 'confetti'], // art deco gala — gold glints, gold confetti
  'coquette-bow': 'hearts', // bows and pearls — hearts
  kalanit: 'petals', // red anemones — red petals
  'jet-set': ['sparkles', 'confetti'], // destination wedding — sun glints
  'scribble-love': 'hearts', // marker doodles — hearts
  'jerusalem-stone': 'sparkles', // golden Jerusalem light
  bukhara: 'petals', // suzani colours — petals
  'martini-olive': ['bubbles', 'confetti'], // cocktail party — champagne fizz
  majolica: 'petals', // Amalfi summer — citrus blossom
  'white-city': 'confetti', // Bauhaus — primary-colour geometric confetti
  // ── the templates being added (their ids exist after the merge) ──
  'safari-pals': ['balloons', 'confetti'], // safari animals — kids' party
  'dig-it': 'confetti', // construction trucks
  'ocean-friends': 'bubbles', // underwater
  'rocket-launch': 'stars', // space
  'unicorn-dream': ['sparkles', 'stars'], // unicorn and rainbow — magic sparkles
  'hoop-stars': 'confetti', // basketball
  'superhero-pow': ['confetti', 'stars'], // comic heroes — POW stars
  'circus-top': ['confetti', 'balloons'], // circus
  'grand-prix': 'confetti', // motor racing — podium confetti
  'skate-graffiti': 'confetti', // skate / graffiti — spray-paint colours
  'pixel-quest': 'pixels', // 8-bit gaming
  'disco-ball': ['sparkles', 'confetti'], // disco — mirror-ball glints
  'ballet-rose': 'petals', // ballet — rose petals
  'vinyl-groove': 'notes', // vinyl records — music notes
  'retro-80s': ['stars', 'confetti'], // synthwave night
  'tropical-tiki': ['petals', 'confetti'], // tropical — hibiscus petals
  'vineyard-harvest': 'leaves', // vineyard — vine leaves
  'campfire-night': 'embers', // campfire in the forest — rising embers
  'golden-years': ['sparkles', 'confetti'], // golden 80th birthday — gold
  'grandma-garden': 'petals', // English cottage garden — petals
};

/** A template the table doesn't know yet: by its first event type. */
const CATEGORY_FALLBACK: Record<EventType, AmbientKind> = {
  wedding: 'petals',
  engagement: 'petals',
  henna: 'fireflies',
  save_the_date: 'petals',
  bar_mitzvah: 'confetti',
  bat_mitzvah: 'confetti',
  birthday: 'confetti',
  corporate: 'sparkles',
  brit: 'bubbles',
  baby_shower: 'bubbles',
  other: 'sparkles',
};

type Template = Pick<TemplateManifest, 'id' | 'categories' | 'motion' | 'tokens' | 'hero' | 'cover'>;

/** The template's ambient particles: its manifest's `motion.ambient`, the table, else by event type. */
export function ambientFor(template: Pick<TemplateManifest, 'id' | 'categories' | 'motion'>): AmbientKind {
  if (template.motion.preset === 'none') return 'none';
  if (template.motion.ambient) return template.motion.ambient;
  const entry = FX_BY_TEMPLATE[template.id];
  if (entry) return typeof entry === 'string' ? entry : entry[0];
  const first = template.categories[0];
  return first ? CATEGORY_FALLBACK[first] : 'sparkles';
}

/**
 * What bursts when the cover opens (and for a "yes" RSVP): the table's burst when the template's
 * ambient is the table's, else the ambient kind itself (a calm `none` still gets a light sparkle).
 */
export function burstFor(template: Pick<TemplateManifest, 'id' | 'categories' | 'motion'>): BurstKind | null {
  if (template.motion.preset === 'none') return null;
  const ambient = ambientFor(template);
  const entry = FX_BY_TEMPLATE[template.id];
  if (entry && typeof entry !== 'string' && entry[0] === ambient) return entry[1];
  return ambient === 'none' ? 'sparkles' : ambient;
}

// ─── colors ──────────────────────────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;
const tint = (hex: string, t: number) => mixHex(hex, '#FFFFFF', t);
const shade = (hex: string, t: number) => mixHex(hex, '#000000', t);
/** chroma 0..255: how colorful (not grey) a color is */
const chroma = (hex: string) => {
  const c = hexToRgb(hex);
  return Math.max(...c) - Math.min(...c);
};
const unique = (list: string[]) => [...new Set(list.map((c) => c.toUpperCase()))];

/** The template palette with the host's overrides (like renderer/theme.ts, without its font imports). */
function paletteOf(template: Template, doc: Pick<InvitationDocument, 'theme'>): Palette {
  const palette = { ...template.tokens.palette };
  const editable = new Set(template.tokens.editablePaletteKeys);
  for (const [key, value] of Object.entries(doc.theme.palette ?? {})) {
    if (value && HEX.test(value) && editable.has(key as keyof Palette)) palette[key as keyof Palette] = value;
  }
  return palette;
}

/**
 * Particle colors of one kind, from the palette: for the hero's ambient layer, luminous tints over a
 * dark hero (its text is light) and the accent's own tones over a light one; for a burst — which
 * crosses the cover, the hero and the page — deep and light tones together, so it reads on any of
 * them. The seal colors bring a template's other hues (confetti, balloons). Always 2–6 opaque hex
 * colors.
 */
export function fxColors(
  kind: BurstKind,
  palette: Pick<Palette, 'accent' | 'heroText'>,
  seals: readonly string[],
  use: 'ambient' | 'burst' = 'ambient',
): string[] {
  const a = HEX.test(palette.accent) ? palette.accent : '#B08D57';
  if (use === 'burst') return burstColors(kind, a, seals);
  const dark = HEX.test(palette.heroText) ? relativeLuminance(palette.heroText) > 0.45 : true;
  const hues = unique([a, ...seals.filter((c) => HEX.test(c))]);
  // festive mixes: the colorful ones first; a gold when the palette has few hues
  const festive = () => {
    const vivid = hues.filter((c) => chroma(c) > 40);
    const list = unique([...(vivid.length ? vivid : [a]), '#F2C14E', tint(a, 0.45)]);
    return (dark ? unique([...list.slice(0, 5), '#FFFFFF']) : list).slice(0, 6);
  };
  switch (kind) {
    case 'petals':
      return dark
        ? [tint(a, 0.42), tint(a, 0.6), tint(a, 0.78), '#FFF6F2']
        : [a, tint(a, 0.22), tint(a, 0.45), shade(a, 0.12)];
    case 'leaves': {
      const greens = hues.filter((c) => {
        const [r, g, b] = hexToRgb(c);
        return g >= r * 0.9 && g >= b; // green, olive, lime
      });
      const base = greens.length ? greens : ['#7E9A3E'];
      const list = unique([...base, '#A3B55A', '#C9A13B', a]).slice(0, 4);
      return dark ? list.map((c) => tint(c, 0.25)) : list;
    }
    case 'confetti':
    case 'balloons':
    case 'pixels':
      return festive();
    case 'sparkles':
      return dark ? ['#FFF6DA', '#F7D98B', tint(a, 0.62)] : ['#C9962E', '#E1B24C', shade(a, 0.05)];
    case 'stars':
      return dark ? ['#FFFFFF', '#FFF1C9', tint(a, 0.6)] : ['#D9A63A', a, tint(a, 0.3)];
    case 'bubbles':
      return dark ? ['#FFFFFF', tint(a, 0.62)] : [a, shade(a, 0.15), tint(a, 0.3)];
    case 'hearts':
      return dark
        ? [tint(a, 0.35), tint(a, 0.58), '#FFE3EA']
        : unique([a, tint(a, 0.3), tint(a, 0.55), ...hues.slice(1, 2)]);
    case 'fireflies':
      return ['#FFE9A6', '#FFD36E', tint(a, 0.55)];
    case 'embers':
      return ['#FFB04A', '#FF7A2F', '#FFD58A'];
    case 'notes':
      return dark ? ['#FFFFFF', tint(a, 0.5), '#FFE6A8'] : [a, shade(a, 0.25), tint(a, 0.25)];
  }
}

/** A mix of the palette's deep and light tones (a burst crosses light and dark backgrounds). */
function burstColors(kind: BurstKind, a: string, seals: readonly string[]): string[] {
  const hues = unique([a, ...seals.filter((c) => HEX.test(c))]);
  const vivid = hues.filter((c) => chroma(c) > 40);
  const festive = unique([...(vivid.length ? vivid : [a]), '#F2C14E', tint(a, 0.5), '#FFFFFF']).slice(0, 6);
  switch (kind) {
    case 'petals':
    case 'hearts':
      return [a, tint(a, 0.28), tint(a, 0.55), '#FFF4F0', shade(a, 0.18)];
    case 'leaves': {
      const greens = hues.filter((c) => {
        const [r, g, b] = hexToRgb(c);
        return g >= r * 0.9 && g >= b;
      });
      return unique([...(greens.length ? greens : ['#6F8F3A']), '#9DB35A', '#D9A93E', a]).slice(0, 5);
    }
    case 'confetti':
    case 'balloons':
    case 'pixels':
      return festive;
    case 'sparkles':
    case 'fireflies':
      return ['#FFF4D2', '#F6CF6E', '#E7A93A', tint(a, 0.45)];
    case 'stars':
      return ['#FFFFFF', '#F6CF6E', tint(a, 0.4), a];
    case 'bubbles':
      return ['#FFFFFF', tint(a, 0.45), a];
    case 'embers':
      return ['#FFB04A', '#FF7A2F', '#FFD58A'];
    case 'notes':
      return [a, shade(a, 0.2), tint(a, 0.4), '#F2C14E'];
  }
}

export interface FxTheme {
  /** the hero's ambient particles ('none': no layer) */
  ambient: AmbientKind;
  ambientColors: string[];
  /** the cover's opening burst and the RSVP celebration (null: none) */
  burst: BurstKind | null;
  burstColors: string[];
  /**
   * The gold-foil glint over the hero's names (NameShine): a deep gold over light names (it must show
   * on white), a bright warm light over dark ones.
   */
  shine: string;
}

/** The glint's color for names in `heroText`, warmed by the accent. */
export function shineColor(heroText: string, accent: string): string {
  const light = HEX.test(heroText) ? relativeLuminance(heroText) > 0.45 : true;
  const a = HEX.test(accent) ? accent : '#B08D57';
  return light ? mixHex('#E4AE3F', a, 0.12) : mixHex('#FFF0C2', a, 0.08);
}

/** Everything the renderer's particles need for this template and document. */
export function fxTheme(template: Template, doc: Pick<InvitationDocument, 'theme' | 'cover'>): FxTheme {
  const palette = paletteOf(template, doc);
  const seal = doc.cover.sealColor ?? template.cover.sealColors[0];
  const seals = unique([...(seal ? [seal] : []), ...template.cover.sealColors]);
  const ambient = ambientFor(template);
  const burst = burstFor(template);
  return {
    ambient,
    ambientColors: ambient === 'none' ? [] : fxColors(ambient, palette, seals),
    burst,
    burstColors: burst ? fxColors(burst, palette, seals, 'burst') : [],
    shine: shineColor(palette.heroText, palette.accent),
  };
}
