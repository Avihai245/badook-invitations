import type {
  InvitationDocument,
  OpeningConfig,
  OpeningPreset,
  Palette,
  TemplateManifest,
} from '../../contracts/types';
import { mixHex, relativeLuminance } from '../../lib/contrast';

/**
 * The cinematic opening to play (renderer/cover/Openings.client.tsx), or null for the template's own
 * cover — its envelope, ticket, pouch… or its opening video (CoverOverlay). The host's choice
 * (`doc.cover.opening`) wins over the template's (`manifest.cover.opening`); without the `cinematic`
 * feature, or for `envelope`, it is always the template's own cover.
 */
export interface Opening {
  preset: Exclude<OpeningPreset, 'envelope'>;
  /** scrolling or swiping opens it too, with a "scroll to enter" cue */
  scroll: boolean;
  motion: 'swing' | 'slide' | 'part' | 'rise' | null;
  /** the doors / curtain / sky, and the lighter and deeper tones drawn from it */
  color: string;
  light: string;
  deep: string;
  /** the metal of the medallion, the fringe and the dust */
  gold: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * A default color per opening, from the palette: lacquered doors, velvet, a night sky, a dark veil —
 * all in the design's dark tone (its ink on a light design, its background on a dark one).
 */
function colorFor(preset: Opening['preset'], palette: Palette): string {
  const dark = relativeLuminance(palette.ink) <= relativeLuminance(palette.bg) ? palette.ink : palette.bg;
  const deep =
    relativeLuminance(palette.accent) < 0.2 ? palette.accent : mixHex(palette.accent, '#000000', 0.35);
  switch (preset) {
    case 'gate':
      return mixHex(dark, deep, 0.5);
    case 'curtain':
      return deep;
    case 'fireworks':
      return mixHex(dark, '#0B0D1C', 0.72);
    case 'gold_dust':
      return mixHex(dark, '#120C08', 0.6);
  }
}

export function resolveOpening(
  template: Pick<TemplateManifest, 'cover'>,
  doc: Pick<InvitationDocument, 'cover'>,
  palette: Palette,
  cinematic: boolean,
): Opening | null {
  if (!cinematic) return null;
  const own: OpeningConfig | null = template.cover.opening;
  const preset = doc.cover.opening ?? own?.preset ?? null;
  if (!preset || preset === 'envelope') return null;
  // the template's settings apply when it is the template's own opening
  const config: Partial<OpeningConfig> = own?.preset === preset ? own : {};
  const color = config.color && HEX.test(config.color) ? config.color : colorFor(preset, palette);
  const motionOk =
    (preset === 'gate' && (config.motion === 'swing' || config.motion === 'slide')) ||
    (preset === 'curtain' && (config.motion === 'part' || config.motion === 'rise'));
  return {
    preset,
    scroll: (config.trigger ?? (preset === 'gate' || preset === 'curtain' ? 'scroll' : 'tap')) === 'scroll',
    motion: motionOk ? config.motion! : preset === 'gate' ? 'swing' : preset === 'curtain' ? 'part' : null,
    color,
    light: mixHex(color, '#FFFFFF', 0.22),
    deep: mixHex(color, '#000000', 0.42),
    gold: mixHex('#D4AF63', palette.accent, 0.12),
  };
}
