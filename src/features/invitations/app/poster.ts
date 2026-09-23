import type { TemplateManifest } from '../contracts/types';
import { placeholderArt } from '../renderer/placeholders';

/** Poster background + default seal per template, exactly as in design-reference/app.html (POSTER). */
const REFERENCE: Record<string, [background: string, seal: string]> = {
  'sahar-bordeaux': ['linear-gradient(180deg,#F3EDE4,#DCD1C3)', '#731F2E'],
  'papercut-gold': ['radial-gradient(60% 40% at 50% 50%,#F3EAD6,#D9C7A0)', '#B08D57'],
  'caesarea-shore': ['linear-gradient(180deg,#F1E6D3,#D8C6A8)', '#1E5A67'],
  'ramon-dusk': ['linear-gradient(180deg,#D9B99A,#B98E6A)', '#EFE2CF'],
  atara: ['linear-gradient(180deg,#22345A,#14233F)', '#A7B0BC'],
  nitzan: ['linear-gradient(180deg,#F4F1E8,#E3E4D6)', '#D7C1A4'],
  'rooftop-dusk': ['linear-gradient(180deg,#2B2745,#1C1A2E)', '#F3E6CF'],
  'honey-meadow': ['linear-gradient(180deg,#D8B98E,#C29C6A)', '#E0A526'],
};

export interface PosterColors {
  background: string;
  seal: string;
}

/**
 * Colors of a template poster (gallery card, invitation card) while the real preview image doesn't
 * exist yet: the reference poster of the template, or its placeholder cover art; an invitation's own
 * seal color (recolorable overlays) replaces the default seal (§9B.3-B).
 */
export function posterColors(
  template: Pick<TemplateManifest, 'id' | 'cover'>,
  sealColor?: string | null,
): PosterColors {
  const [background, seal] = REFERENCE[template.id] ?? fallback(template);
  return { background, seal: (template.cover.overlay.recolor && sealColor) || seal };
}

function fallback(template: Pick<TemplateManifest, 'id' | 'cover'>): [string, string] {
  const bg = placeholderArt(template.id).cover.bg;
  return [`linear-gradient(180deg, ${bg[0]}, ${bg[2]})`, template.cover.sealColors[0] ?? bg[1]];
}
