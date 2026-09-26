import type { IconName } from '../ui/Icon';
import type { SceneId } from './scenes/ids';

/** Line-art drawn for a missing panorama decoration (afterHero / betweenVenues). */
export type PanoramaKind =
  | 'vineyard'
  | 'hills'
  | 'arches'
  | 'garden'
  | 'swags'
  | 'waves'
  | 'doodle'
  | 'stars'
  | 'pitch'
  | 'flight'
  | 'deco'
  | 'skyline';

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
   * Checked by `qa-screens --only legibility`. null = none.
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
    /** the ticket cover's paper and edge (TicketArt), when not the vintage cream */
    ticket?: { paper: string; edge: string };
  };
  /** Line-art drawn for a missing panorama decoration (betweenVenues). */
  panorama: PanoramaKind;
  /** Stands in for missing section illustrations and the footer decoration. */
  ornament: IconName;
  /**
   * A drawn scene (renderer/scenes) instead of the sky + clouds + hills: the hero, the posters and the
   * cover's card draw it over `sky`. The 8 original templates have none.
   */
  scene?: SceneId;
}

const DARK_HINT = 'rgba(255,255,255,.8)';
const LIGHT_HINT = '#7C6A60';

const PLACEHOLDERS: Record<string, PlaceholderArt> = {
  'sahar-bordeaux': {
    sky:
      'radial-gradient(38% 20% at 70% 60%,rgba(255,240,210,.95),rgba(255,226,190,0) 70%),' +
      'radial-gradient(90% 50% at 50% 100%,rgba(90,40,55,.55),transparent 70%),' +
      'linear-gradient(180deg,#F8DCC4 0%,#F5C4A6 26%,#EFA995 46%,#D28A8C 62%,#9A5C6B 79%,#5E2F40 100%)',
    // the reference's pale sunset, deepened in its own rose under the text so it reads (WCAG AA)
    shade: '#A87070',
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
  // ── scene templates: a drawn scene over a base gradient ──
  'cloud-arch': drawn('cloud-arch', ['#F5F3EF', '#EFECE6', '#E6E1D8'], {
    bg: ['#F2F0EB', '#E9E5DE', '#DCD5CB'],
    paper: ['#FBFAF7', '#F3F0EA', '#E6E0D6'],
    hint: '#6F675E',
    panorama: 'arches',
    ornament: 'arch',
  }),
  'jasper-cameo': drawn('jasper-cameo', ['#BCD0E4', '#AFC6DE', '#9CB6D2'], {
    bg: ['#B4CAE0', '#A6BFD9', '#8FAACB'],
    paper: ['#F9F6F0', '#EFEAE1', '#E1D9CC'],
    hint: '#23324A',
    panorama: 'swags',
    ornament: 'cameo',
  }),
  'midnight-bloom': drawn('midnight-bloom', ['#1D1C20', '#141519', '#0D0E11'], {
    bg: ['#1F2025', '#17181C', '#0F1013'],
    paper: ['#2B2A2E', '#222226', '#1A1A1E'],
    hint: 'rgba(244,237,227,.82)',
    panorama: 'garden',
    ornament: 'peony',
  }),
  kalanit: drawn('kalanit', ['#FBF5E9', '#F6EFE1', '#EFE5CF'], {
    bg: ['#F6F1E7', '#EDE5D5', '#E0D5BF'],
    paper: ['#FFFDF8', '#F5EFE3', '#E9E0CE'],
    hint: '#6A635A',
    panorama: 'garden',
    ornament: 'anemone',
  }),
  majolica: drawn('majolica', ['#FFFDF8', '#FBF8F1', '#F3EDDD'], {
    bg: ['#E6EEFB', '#D6E2F6', '#C2D2EE'],
    paper: ['#FFFFFF', '#F6F3EC', '#EAE5D9'],
    hint: '#1D2F6F',
    panorama: 'waves',
    ornament: 'citrus',
  }),
  'jerusalem-stone': drawn('jerusalem-stone', ['#98BCD7', '#BCD4E5', '#E8EEF0'], {
    bg: ['#EADFC9', '#DECDAE', '#CFBA93'],
    paper: ['#F6EEDF', '#EBDFC9', '#DCCBAE'],
    hint: '#5A4B38',
    panorama: 'arches',
    ornament: 'olive-branch',
  }),
  marrakech: drawn('marrakech', ['#14493F', '#0F3B34', '#0A2A25'], {
    bg: ['#134539', '#0F3B34', '#0A2A25'],
    paper: ['#F6EBD6', '#EBDDC2', '#DDCBA9'],
    hint: 'rgba(251,243,228,.86)',
    panorama: 'arches',
    ornament: 'hamsa',
  }),
  bukhara: drawn('bukhara', ['#F8EDDA', '#F4E6CF', '#EAD6B6'], {
    bg: ['#F4E6CF', '#EAD6B6', '#DCC39B'],
    paper: ['#FFF8EE', '#F5EAD8', '#E8D8BD'],
    hint: '#4B4870',
    panorama: 'garden',
    ornament: 'rosette',
  }),
  'scribble-love': drawn('scribble-love', ['#FDFCF9', '#FBFAF6', '#F4F2EB'], {
    bg: ['#FBFAF6', '#F1EFE8', '#E6E3DA'],
    paper: ['#FFFFFF', '#F6F4EF', '#EAE7DF'],
    hint: '#5B5B57',
    panorama: 'doodle',
    ornament: 'scribble-heart',
  }),
  'martini-olive': drawn('martini-olive', ['#5B6829', '#4F5B24', '#3E481B'], {
    bg: ['#56632A', '#4F5B24', '#3E481B'],
    paper: ['#F7F0E1', '#EDE3CE', '#DFD2B7'],
    hint: 'rgba(247,240,225,.88)',
    panorama: 'stars',
    ornament: 'martini',
  }),
  klaf: drawn('klaf', ['#F5ECD7', '#EFE3C8', '#E2D0AA'], {
    bg: ['#EFE3C8', '#E3D2B0', '#D4BF97'],
    paper: ['#F9F3E4', '#EFE5CF', '#E1D3B6'],
    hint: '#5E4B38',
    panorama: 'hills',
    ornament: 'torah',
  }),
  'neon-night': drawn('neon-night', ['#16122B', '#0B0A12', '#07060C'], {
    bg: ['#171431', '#0E0C1C', '#07060C'],
    paper: ['#221E40', '#1A1733', '#131028'],
    hint: 'rgba(255,255,255,.82)',
    panorama: 'stars',
    ornament: 'zap',
    ticket: { paper: '#1D1938', edge: 'var(--inv-accent)' },
  }),
  'match-day': drawn('match-day', ['#0E3D1F', '#1B6F37', '#1E7A3C'], {
    bg: ['#1E7A3C', '#176331', '#0E4722'],
    paper: ['#FFFFFF', '#F1F1EC', '#E2E3DB'],
    hint: 'rgba(255,255,255,.88)',
    panorama: 'pitch',
    ornament: 'ball',
  }),
  'jet-set': drawn('jet-set', ['#C3E0F2', '#D6EAF5', '#EBF5FA'], {
    bg: ['#D6EAF5', '#C4E0F1', '#ADD2EA'],
    paper: ['#FFFDF7', '#F4F1E8', '#E6E1D4'],
    hint: '#3D475C',
    panorama: 'flight',
    ornament: 'plane',
    ticket: { paper: '#FFFDF7', edge: 'rgba(31,42,68,.22)' },
  }),
  'coquette-bow': drawn('coquette-bow', ['#FCE9ED', '#F9DFE4', '#F3CDD6'], {
    bg: ['#F9DFE4', '#F3CED6', '#EABAC6'],
    paper: ['#FFF8F6', '#FBEDEE', '#F1DADF'],
    hint: '#6A4650',
    panorama: 'swags',
    ornament: 'bow',
  }),
  'almond-blossom': drawn('almond-blossom', ['#C6DAE6', '#DCE6EB', '#F4EEE8'], {
    bg: ['#EEF1F2', '#E2E9EC', '#D3DFE6'],
    paper: ['#FFFDFB', '#F6F0EB', '#EAE1DA'],
    hint: '#5E504A',
    panorama: 'garden',
    ornament: 'blossom',
  }),
  'cocoa-teddy': drawn('cocoa-teddy', ['#DCEAF6', '#EEE6DA', '#F1E6D6'], {
    bg: ['#F1E6D6', '#E7D8C3', '#DAC6AB'],
    paper: ['#FFFDF8', '#F6EEE2', '#E9DDCB'],
    hint: '#5E4838',
    panorama: 'hills',
    ornament: 'teddy',
  }),
  'dino-hatch': drawn('dino-hatch', ['#DDF1F3', '#E6F4DA', '#EAF6CF'], {
    bg: ['#EAF6CF', '#DCEDB5', '#C9E09A'],
    paper: ['#FFFFFF', '#F4F8EA', '#E4ECD2'],
    hint: '#4A5641',
    panorama: 'hills',
    ornament: 'dino',
  }),
  'deco-gatsby': drawn('deco-gatsby', ['#18181B', '#0E0E10', '#08080A'], {
    bg: ['#18181C', '#0F0F11', '#08080A'],
    paper: ['#232326', '#1B1B1E', '#141416'],
    hint: 'rgba(241,232,212,.82)',
    panorama: 'deco',
    ornament: 'deco-fan',
  }),
  'white-city': drawn('white-city', ['#F8F7F2', '#F3F1EA', '#EAE7DD'], {
    bg: ['#F3F1EA', '#E8E5DB', '#DCD8CB'],
    paper: ['#FFFFFF', '#F4F2EC', '#E6E3DA'],
    hint: '#55554F',
    panorama: 'skyline',
    ornament: 'bauhaus',
  }),
  // T3: teens & music
  'pixel-quest': drawn('pixel-quest', ['#1B3698', '#2A54C6', '#5E93F4'], {
    bg: ['#3A6FE0', '#2A54C6', '#1B3698'],
    paper: ['#FFFFFF', '#EAF2FF', '#C8D7F5'],
    hint: 'rgba(255,255,255,.9)',
    panorama: 'hills',
    ornament: 'pixel-heart',
    ticket: { paper: '#FFD447', edge: 'rgba(21,32,75,.45)' },
  }),
  'disco-ball': drawn('disco-ball', ['#2A0E45', '#1C0A30', '#12071F'], {
    bg: ['#231038', '#170A28', '#0D0618'],
    paper: ['#5A2F86', '#46236C', '#321852'],
    hint: 'rgba(255,244,251,.85)',
    panorama: 'stars',
    ornament: 'mirror-ball',
  }),
  'ballet-rose': drawn('ballet-rose', ['#EFC3CD', '#F8DCE2', '#EDBFC9'], {
    bg: ['#9A2A4C', '#7E1C3C', '#5C102B'],
    paper: ['#FFF8F8', '#FBEAEE', '#F1D3DA'],
    hint: 'rgba(255,240,244,.9)',
    panorama: 'swags',
    ornament: 'ballet-slippers',
  }),
  'vinyl-groove': drawn('vinyl-groove', ['#1C1410', '#261A14', '#1A120E'], {
    bg: ['#2E221B', '#221914', '#16100C'],
    paper: ['#E9D3B0', '#DCC29A', '#C9AA7E'],
    hint: 'rgba(246,234,219,.85)',
    panorama: 'doodle',
    ornament: 'vinyl',
  }),
  'retro-80s': drawn('retro-80s', ['#0D0526', '#33104F', '#2A0848'], {
    bg: ['#2A1052', '#1C0B3A', '#110626'],
    paper: ['#FFB38A', '#FF6F91', '#C2458F'],
    hint: 'rgba(255,243,255,.88)',
    panorama: 'stars',
    ornament: 'cassette',
  }),
};

/**
 * A scene template's art: the scene draws over `sky` (a plain gradient — also the backdrop of its
 * link-preview image); the CSS cover's envelope is `paper` [light, mid, shade] on `bg`, and its card
 * shows the scene.
 */
function drawn(
  scene: SceneId,
  sky: [string, string, string],
  o: {
    bg: [string, string, string];
    paper: [string, string, string];
    hint: string;
    panorama: PanoramaKind;
    ornament: IconName;
    ticket?: { paper: string; edge: string };
  },
): PlaceholderArt {
  const [light, mid, shade] = o.paper;
  return {
    sky: `linear-gradient(180deg,${sky[0]} 0%,${sky[1]} 55%,${sky[2]} 100%)`,
    shade: null,
    cloud: 'rgba(255,255,255,.4)',
    hills: [sky[2], sky[2], sky[2], sky[2]],
    cover: {
      bg: o.bg,
      envelope: [light, mid],
      pocket: [light, mid],
      flap: [mid, shade],
      card: `linear-gradient(180deg,${sky[0]},${sky[2]})`,
      hint: o.hint,
      ...(o.ticket ? { ticket: o.ticket } : null),
    },
    panorama: o.panorama,
    ornament: o.ornament,
    scene,
  };
}

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
