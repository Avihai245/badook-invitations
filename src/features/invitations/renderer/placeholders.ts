import type { IconName } from '../ui/Icon';

/**
 * CSS/SVG placeholder art used while a template's media files don't exist yet (§5 "missing media
 * must never break an invitation"). sahar-bordeaux reproduces the design reference exactly;
 * the other templates get art in their own palette/mood. Real media always wins over these.
 */
export interface PlaceholderArt {
  /** CSS background of .hero-media */
  sky: string;
  /**
   * Pale skies only: a color multiplied over the sky, clouds and hills below the light at the top
   * (see placeholderScrim), deepening them in their own hue so white hero text stays legible.
   * Checked by `qa-screens --only legibility`. null = none (sahar-bordeaux = the reference as is).
   */
  shade: string | null;
  cloud: string;
  /** SVG fills: back hill (drawn at .75 opacity), mid hill, row strokes, front hill */
  hills: [string, string, string, string];
  cover: {
    bg: [string, string, string];
    envelope: [string, string];
    pocket: [string, string];
    flap: [string, string];
    card: string;
    hint: string;
  };
  /** Line-art drawn for a missing panorama decoration (betweenVenues). */
  panorama: 'vineyard' | 'hills';
  /** Stands in for missing section illustrations and the footer decoration. */
  ornament: IconName;
}

const DARK_HINT = 'rgba(255,255,255,.8)';
const LIGHT_HINT = '#7C6A60';

const PLACEHOLDERS: Record<string, PlaceholderArt> = {
  'sahar-bordeaux': {
    sky:
      'radial-gradient(38% 20% at 70% 60%,rgba(255,240,210,.95),rgba(255,226,190,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(90,40,55,.55),transparent 70%),' +
      'linear-gradient(180deg,#F8DCC4 0%,#F5C4A6 26%,#EFA995 46%,#D28A8C 62%,#9A5C6B 79%,#5E2F40 100%)',
    shade: null,
    cloud: 'rgba(255,246,238,.45)',
    hills: ['#8E5563', '#6E3A48', '#5A2C3A', '#4E2332'],
    cover: {
      bg: ['#F3EDE4', '#E6DDD1', '#DCD1C3'],
      envelope: ['#F6F1E8', '#EFE8DC'],
      pocket: ['#F8F3EA', '#EEE6D9'],
      flap: ['#EDE5D8', '#E3D9CA'],
      card: 'linear-gradient(180deg,#F6C9A8 0%,#E8A08E 45%,#9C5A66 80%,#5E2B38 100%)',
      hint: LIGHT_HINT,
    },
    panorama: 'vineyard',
    ornament: 'rings',
  },
  'papercut-gold': {
    sky:
      'radial-gradient(44% 18% at 50% 10%,rgba(255,248,225,.95),rgba(255,240,200,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(70,50,20,.5),transparent 70%),' +
      'linear-gradient(180deg,#F6EBD3 0%,#EFDDB6 30%,#E2C48B 55%,#BF9A5A 75%,#7A5E2E 100%)',
    shade: '#C08652',
    cloud: 'rgba(255,250,236,.45)',
    hills: ['#B89A62', '#8C7446', '#6F5C45', '#5A4526'],
    cover: {
      bg: ['#F3EAD6', '#E8DBBD', '#D9C7A0'],
      envelope: ['#F8F1E1', '#EFE3C8'],
      pocket: ['#FAF4E6', '#F0E5CC'],
      flap: ['#EFE3C8', '#E4D3AE'],
      card: 'linear-gradient(180deg,#F6EBD3 0%,#E2C48B 55%,#8C6A1F 100%)',
      hint: '#7C6A50',
    },
    panorama: 'hills',
    ornament: 'chuppah',
  },
  'caesarea-shore': {
    sky:
      'radial-gradient(36% 18% at 30% 58%,rgba(255,236,200,.95),rgba(255,226,190,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(15,50,60,.55),transparent 70%),' +
      'linear-gradient(180deg,#F7E6C8 0%,#F1CFA0 28%,#E4B07E 48%,#9FB5AE 64%,#2F6470 82%,#173F4A 100%)',
    shade: '#B69185',
    cloud: 'rgba(255,248,238,.45)',
    hills: ['#C9A77D', '#9D8360', '#1E5A67', '#173F4A'],
    cover: {
      bg: ['#F1E6D3', '#E4D5BD', '#D8C6A8'],
      envelope: ['#F4ECDD', '#EADFCB'],
      pocket: ['#F6EFE2', '#ECE2CF'],
      flap: ['#EADFCB', '#DFD1B9'],
      card: 'linear-gradient(180deg,#F7E6C8 0%,#E4B07E 45%,#2F6470 85%,#173F4A 100%)',
      hint: '#6F6554',
    },
    panorama: 'hills',
    ornament: 'rings',
  },
  'ramon-dusk': {
    sky:
      'radial-gradient(34% 18% at 64% 62%,rgba(255,226,190,.9),rgba(255,210,170,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(60,30,20,.55),transparent 70%),' +
      'linear-gradient(180deg,#F4D3B0 0%,#EDB891 26%,#E09A6E 46%,#C9724A 64%,#7A4A3A 82%,#3D291F 100%)',
    shade: '#CB8D77',
    cloud: 'rgba(255,240,226,.4)',
    hills: ['#B7764F', '#8E5438', '#6E3B28', '#3D291F'],
    cover: {
      bg: ['#D9B99A', '#CCA985', '#B98E6A'],
      envelope: ['#D6B08A', '#C79E75'],
      pocket: ['#DBB690', '#CBA37B'],
      flap: ['#C9A07A', '#BC9168'],
      card: 'linear-gradient(180deg,#F4D3B0 0%,#E09A6E 45%,#7A4A3A 85%,#3D291F 100%)',
      hint: '#5E4636',
    },
    panorama: 'hills',
    ornament: 'rings',
  },
  atara: {
    sky:
      'radial-gradient(34% 20% at 50% 10%,rgba(255,250,235,.85),rgba(255,245,220,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(10,20,40,.6),transparent 70%),' +
      'linear-gradient(180deg,#E8EDF4 0%,#BFCBDD 24%,#8FA3C2 44%,#4E6A99 64%,#1F3A68 82%,#14233F 100%)',
    shade: '#A3B8E0',
    cloud: 'rgba(255,255,255,.35)',
    hills: ['#3B5580', '#2A416B', '#1F3A68', '#14233F'],
    cover: {
      bg: ['#22345A', '#1B2B4B', '#14233F'],
      envelope: ['#2B4170', '#22345A'],
      pocket: ['#2E4574', '#243A63'],
      flap: ['#33497A', '#2B4170'],
      card: 'linear-gradient(180deg,#E8EDF4 0%,#BFCBDD 50%,#A7B0BC 100%)',
      hint: DARK_HINT,
    },
    panorama: 'hills',
    ornament: 'star',
  },
  nitzan: {
    sky:
      'radial-gradient(40% 18% at 70% 10%,rgba(255,255,240,.95),rgba(255,255,230,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(30,40,25,.45),transparent 70%),' +
      'linear-gradient(180deg,#F7F8F3 0%,#E9EDDF 28%,#D3DCC2 50%,#A9B894 70%,#6F8563 88%,#4A5C42 100%)',
    shade: '#7D9577',
    cloud: 'rgba(255,255,250,.5)',
    hills: ['#A9B894', '#86987A', '#5F7555', '#2E382C'],
    cover: {
      bg: ['#F4F1E8', '#ECE9DE', '#E3E4D6'],
      envelope: ['#F5F2EA', '#ECE8DD'],
      pocket: ['#F7F4EC', '#EEEADF'],
      flap: ['#ECE8DD', '#E2DDD0'],
      card: 'linear-gradient(180deg,#F7F8F3 0%,#D3DCC2 50%,#5F7555 100%)',
      hint: '#6A6A5C',
    },
    panorama: 'hills',
    ornament: 'baby',
  },
  'rooftop-dusk': {
    sky:
      'radial-gradient(36% 18% at 50% 62%,rgba(255,190,140,.85),rgba(255,160,110,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(14,12,26,.7),transparent 70%),' +
      'linear-gradient(180deg,#FFB38A 0%,#FF8A5B 22%,#B85A7A 44%,#4B3A6B 66%,#262340 84%,#1C1A2E 100%)',
    shade: '#EDE3EC',
    cloud: 'rgba(255,220,200,.3)',
    hills: ['#3B3758', '#2E2A4A', '#FF8A5B', '#1C1A2E'],
    cover: {
      bg: ['#2B2745', '#24213C', '#1C1A2E'],
      envelope: ['#2E2A4A', '#262340'],
      pocket: ['#322E50', '#29264A'],
      flap: ['#3B3758', '#322E50'],
      card: 'linear-gradient(180deg,#FFB38A 0%,#B85A7A 50%,#262340 100%)',
      hint: DARK_HINT,
    },
    panorama: 'hills',
    ornament: 'party-popper',
  },
  'honey-meadow': {
    sky:
      'radial-gradient(40% 18% at 28% 10%,rgba(255,250,220,.95),rgba(255,244,200,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(60,50,20,.45),transparent 70%),' +
      'linear-gradient(180deg,#FFF8DC 0%,#FBEAB0 26%,#F2CF6E 48%,#D9A441 66%,#9C8A3E 84%,#5C5122 100%)',
    shade: '#BE7741',
    cloud: 'rgba(255,255,245,.55)',
    hills: ['#C9B458', '#A08F3E', '#7E6F2E', '#5C5122'],
    cover: {
      bg: ['#D8B98E', '#CEAD80', '#C29C6A'],
      envelope: ['#DDBF93', '#CFAE80'],
      pocket: ['#E0C398', '#D2B384'],
      flap: ['#CFAE80', '#C4A171'],
      card: 'linear-gradient(180deg,#FFF8DC 0%,#F2CF6E 50%,#D9A441 100%)',
      hint: '#5E4A2E',
    },
    panorama: 'hills',
    ornament: 'heart',
  },
};

const FALLBACK = PLACEHOLDERS['sahar-bordeaux']!;

export function hasPlaceholderArt(templateId: string): boolean {
  return templateId in PLACEHOLDERS;
}

export function placeholderArt(templateId: string): PlaceholderArt {
  return PLACEHOLDERS[templateId] ?? FALLBACK;
}

/**
 * `--hero-scrim` (mix-blend-mode: multiply): white — i.e. untouched — at the top, then the template's
 * shade from ≈ 24% of the height down, so the hero text stays legible wherever it wraps to (≈ 20–80%).
 * Only rendered over placeholder art, never over real media.
 */
export function placeholderScrim(art: PlaceholderArt): string {
  return art.shade ? `linear-gradient(180deg,#FFFFFF 4%,${art.shade} 24%,${art.shade} 100%)` : 'none';
}
