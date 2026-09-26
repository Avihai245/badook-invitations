import type { ReactNode } from 'react';
import { Frame, Layer, Piece, cm, cmh, cw, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Superhero POW — a comic-book page at night: bold black panel borders on white gutters, a halftone
 * sky with a full moon, a caped hero flying across it trailing speed lines, a searchlight sweeping
 * over an outlined city skyline with lit windows, and two inset panels whose bursts pop — "POW!"
 * in the top corner, "BOOM!" in the bottom one. The hero's cape follows the accent.
 */
const INK = '#0B0B14';
const PAPER = '#FFF7E4';
const YELLOW = '#FFE14A';
const RED = '#E8262E';
const CAPE = 'var(--inv-accent, #E4252C)';
const WINDOW = '#FFD34D';

type Url = (name: string) => string;

// ── comic lettering: chunky letters drawn as paths (each in its own box, 26 units tall) ──
const LETTERS: Record<string, { w: number; d: string }> = {
  P: {
    w: 21,
    d: 'M0 0H13C18.5 0 21 3.2 21 7.6S18.5 15.4 13 15.4H7.4V26H0ZM7.4 5.4V10H11.8C13.2 10 13.9 9.1 13.9 7.7S13.2 5.4 11.8 5.4Z',
  },
  O: {
    w: 22,
    d: 'M11 0C18 0 22 5 22 13S18 26 11 26 0 21 0 13 4 0 11 0ZM11 6.2C8.8 6.2 7.6 8.6 7.6 13S8.8 19.8 11 19.8 14.4 17.4 14.4 13 13.2 6.2 11 6.2Z',
  },
  W: { w: 30, d: 'M0 0H7.2L9.4 14.5 12.4 0H17.6L20.6 14.5 22.8 0H30L24.8 26H18.2L15 12.6 11.8 26H5.2Z' },
  B: {
    w: 21,
    d: 'M0 0H12.6C17.8 0 20.2 2.6 20.2 6.6 20.2 9.4 18.8 11.3 16.6 12.2 19.4 13 21 15.2 21 18.4 21 23.2 17.8 26 12.2 26H0ZM7.2 5.2V10.4H11.2C12.6 10.4 13.3 9.4 13.3 7.8S12.6 5.2 11.2 5.2ZM7.2 15.2V20.8H11.8C13.3 20.8 14.1 19.8 14.1 18S13.3 15.2 11.8 15.2Z',
  },
  M: { w: 27, d: 'M0 26V0H8.2L13.5 13.4 18.8 0H27V26H20.4V12.4L15.9 23H11.1L6.6 12.4V26Z' },
  '!': { w: 8, d: 'M0.4 0H7.6L6.4 17.4H1.6ZM1 20H7V26H1Z' },
};

/** A comic sound word: letters tilting in turn, a heavy outline and a drop shadow. */
function Word({
  text,
  fill,
  x,
  y,
  s,
  spin = 4,
}: {
  text: string;
  fill: string;
  x: number;
  y: number;
  s: number;
  spin?: number;
}) {
  let cursor = 0;
  const glyphs = [...text].map((ch, i) => {
    const g = LETTERS[ch]!;
    const gx = cursor;
    cursor += g.w + 1.5;
    const tilt = (i % 2 ? 1 : -1) * spin;
    const lift = i % 2 ? 1.5 : -1.5;
    return { d: g.d, t: `translate(${gx} ${lift}) rotate(${tilt} ${g.w / 2} 13)` };
  });
  const width = cursor - 1.5;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(${-width / 2} -13)`} strokeLinejoin="round">
      <g transform="translate(2.6 2.8)" fill={INK}>
        {glyphs.map((g, i) => (
          <path key={i} d={g.d} transform={g.t} fillRule="evenodd" stroke={INK} strokeWidth="4" />
        ))}
      </g>
      {glyphs.map((g, i) => (
        <path
          key={i}
          d={g.d}
          transform={g.t}
          fillRule="evenodd"
          fill={fill}
          stroke={INK}
          strokeWidth="2.6"
          paintOrder="stroke"
        />
      ))}
    </g>
  );
}

/** A jagged explosion outline around (cx, cy). */
function burst(cx: number, cy: number, rOut: number, rIn: number, n: number, seed: number): string {
  const rand = rng(seed);
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn * (0.92 + rand() * 0.12) : rOut * (0.82 + rand() * 0.26);
    const [x, y] = polar(cx, cy, r, -90 + (i * 180) / n + (rand() - 0.5) * 8);
    pts.push(`${x} ${y}`);
  }
  return `M${pts.join('L')}Z`;
}

/** A puffy explosion cloud (scallops) around (cx, cy). */
function puff(cx: number, cy: number, rx: number, ry: number, n: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n;
    const a1 = ((i + 1) * 360) / n;
    const p = (a: number, k: number) => {
      const t = (a * Math.PI) / 180;
      return `${r1(cx + Math.cos(t) * rx * k)} ${r1(cy + Math.sin(t) * ry * k)}`;
    };
    d += `${i ? '' : `M${p(a0, 1)}`}Q${p((a0 + a1) / 2, 1.28)} ${p(a1, 1)}`;
  }
  return `${d}Z`;
}

/**
 * The inset panel of the top corner (viewBox 0 0 200 130): yellow halftone behind a slanted gutter —
 * white paper between two black borders. Its burst is a piece of its own (it pops).
 */
function PowPanel({ u }: { u: Url }) {
  const edge = 'M-40 -40H200V96L150 132H-40Z';
  return (
    <g>
      <path d={edge} fill={YELLOW} />
      <path d={edge} fill={u('dotsRed')} opacity=".5" />
      <path d="M200 96 150 132H-40" fill="none" stroke={PAPER} strokeWidth="11" strokeLinejoin="round" />
      <path
        d="M204 91.5 151.7 128.5H-40M200 100.8 152 135.5H-40"
        fill="none"
        stroke={INK}
        strokeWidth="3.2"
      />
    </g>
  );
}

/** "POW!" in a red burst (the top panel's viewBox). */
function PowBurst({ u }: { u: Url }) {
  return (
    <g filter={u('pop')}>
      <path
        d={burst(112, 86, 60, 39, 13, 3)}
        fill={RED}
        stroke={INK}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path d={burst(112, 86, 42, 29, 13, 9)} fill="#FF8A2A" />
      <Word text="POW!" fill={YELLOW} x={112} y={87} s={1.02} />
    </g>
  );
}

/** The inset panel of the bottom corner (viewBox 0 0 210 140): red halftone behind a slanted gutter. */
function BoomPanel({ u }: { u: Url }) {
  const edge = 'M60 0H250V180H0V44Z';
  return (
    <g>
      <path d={edge} fill={RED} />
      <path d={edge} fill={u('dotsYellow')} opacity=".45" />
      <path d="M0 44 60 0H250" fill="none" stroke={PAPER} strokeWidth="11" strokeLinejoin="round" />
      <path d="M-4 39.6 58.5-4.6H250M4 48.4 61.5 4.6H250" fill="none" stroke={INK} strokeWidth="3.2" />
    </g>
  );
}

/** "BOOM!" in a yellow cloud (the bottom panel's viewBox). */
function BoomBurst({ u }: { u: Url }) {
  return (
    <g filter={u('pop')}>
      <path
        d={puff(124, 82, 70, 42, 11)}
        fill={YELLOW}
        stroke={INK}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <Word text="BOOM!" fill={RED} x={124} y={83} s={0.92} spin={5} />
    </g>
  );
}

/** A caped hero in flight, fist first, up and to the left (viewBox 0 0 230 140). */
function Hero({ u }: { u: Url }) {
  return (
    <g strokeLinejoin="round">
      {/* the cape, from the shoulders, billowing back past the boots */}
      <path
        d="M90 56C106 40 134 32 160 29 182 26 204 18 224 8 216 20 218 30 228 38 214 40 206 48 212 58 196 57 182 63 172 72 154 66 134 70 118 76 104 72 94 64 90 56Z"
        style={{ fill: CAPE }}
        stroke={INK}
        strokeWidth="3.2"
      />
      <path
        d="M122 44C150 38 180 34 214 22M132 62C158 54 184 50 210 50"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
        opacity=".4"
      />
      {/* legs: one straight, one bent, boots */}
      <path d="M134 74 188 88C196 90 204 90 210 92 214 94 214 100 208 101L184 101 128 88Z" fill={INK} />
      <path d="M130 82 164 104C170 108 174 116 184 118 188 120 188 125 182 126L160 124 122 92Z" fill={INK} />
      {/* torso: broad chest, narrow waist */}
      <path
        d="M86 58C98 48 124 52 140 66 148 73 146 84 136 86 118 90 98 82 88 72 83 67 82 62 86 58Z"
        fill={INK}
      />
      {/* the arm forward (under the head), the fist, the head */}
      <path d="M98 60 54 44C48 42 42 44 41 49 40 54 44 57 49 57L92 74Z" fill={INK} />
      <circle cx="44" cy="50" r="8.4" fill={INK} />
      <path d="M86 58C84 54 86 50 90 48" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <circle cx="84" cy="40" r="12.5" fill={INK} />
      {/* moonlight along the top edges */}
      <path
        d="M74 33C78 28 86 27 92 30"
        fill="none"
        stroke={u('rim')}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M52 42 94 57M104 52C116 52 128 56 138 64"
        fill="none"
        stroke={u('rim')}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* the emblem on the chest */}
      <path
        d="M110 64 113.4 58.4 116 64.4 122 65.4 117.6 69.4 118.8 75.4 113.2 72.6 107.8 75.4 109 69.4 104.4 65.4Z"
        fill={YELLOW}
      />
    </g>
  );
}

/** Speed lines trailing the hero, down to the right (viewBox 0 0 160 90). */
function SpeedLines() {
  return (
    <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
      {[
        [0, 10, 70, 1],
        [10, 26, 100, 0.8],
        [4, 44, 84, 0.9],
        [20, 60, 120, 0.6],
        [12, 76, 72, 0.5],
      ].map(([x, y, len, o]) => (
        <path key={y} d={`M${x} ${y}l${len} ${r1(len! * 0.36)}`} strokeWidth="2.4" opacity={o} />
      ))}
    </g>
  );
}

/** The moon with a halftone shade (viewBox -60 -60 120 120). */
function Moon({ u }: { u: Url }) {
  return (
    <g>
      <circle r="70" fill={u('moonglow')} />
      <circle r="46" fill={YELLOW} stroke={INK} strokeWidth="3" />
      <circle r="44.5" fill={u('dotsOrange')} clipPath={u('moonshade')} opacity=".85" />
      <circle cx="-14" cy="-12" r="7" fill="#F5C930" />
      <circle cx="12" cy="10" r="5" fill="#F5C930" />
      <circle cx="-4" cy="20" r="3.4" fill="#F5C930" />
    </g>
  );
}

type Roof = 'flat' | 'spire' | 'tank' | 'step';
/**
 * The city's front blocks across a 1600-wide strip: [x, width, height, roof]. A phone sees about
 * x 580–1020 (the middle stays low, under the names); a wide screen sees it all.
 */
const BLOCKS: [number, number, number, Roof][] = [
  [-8, 66, 150, 'tank'],
  [60, 54, 196, 'step'],
  [116, 80, 118, 'flat'],
  [198, 48, 214, 'spire'],
  [248, 74, 132, 'flat'],
  [324, 58, 96, 'tank'],
  [384, 88, 158, 'step'],
  [474, 56, 120, 'flat'],
  [532, 66, 118, 'tank'],
  [600, 52, 168, 'spire'],
  [654, 74, 134, 'flat'],
  [730, 62, 112, 'tank'],
  [794, 70, 150, 'step'],
  [866, 56, 116, 'flat'],
  [924, 50, 160, 'spire'],
  [976, 78, 124, 'flat'],
  [1056, 60, 128, 'tank'],
  [1118, 84, 164, 'step'],
  [1204, 54, 108, 'flat'],
  [1260, 50, 206, 'spire'],
  [1312, 76, 136, 'flat'],
  [1390, 62, 104, 'tank'],
  [1454, 80, 170, 'step'],
  [1536, 72, 124, 'flat'],
];
/** The tips of the spires (their antenna lights). */
const SPIRE_TIPS = BLOCKS.filter(([, , , roof]) => roof === 'spire').map(
  ([x, w, h]) => [x + w / 2, 260 - h - 64] as const,
);

/** The city: a far skyline, outlined blocks, windows, water towers, spires (viewBox 0 0 1600 260). */
function Skyline() {
  const rand = rng(12);
  let back = '';
  for (let x = -10; x < 1610;) {
    const w = 36 + rand() * 44;
    back += `M${r1(x)} 262V${r1(150 - rand() * 80)}h${r1(w)}V262Z`;
    x += w - 6;
  }
  const shapes: ReactNode[] = [];
  const windows: string[] = [];
  const lit: string[] = [];
  BLOCKS.forEach(([bx, bw, bh, roof], i) => {
    const y = 260 - bh;
    let d = `M${bx} 264V${y}H${bx + bw}V264Z`;
    if (roof === 'spire')
      d += `M${bx + 8} ${y}V${y - 18}H${bx + bw - 8}V${y}ZM${bx + 15} ${y - 18}L${bx + bw / 2} ${y - 62}L${bx + bw - 15} ${y - 18}Z`;
    if (roof === 'step') d += `M${bx + 10} ${y}V${y - 16}H${bx + bw - 10}V${y}Z`;
    shapes.push(
      <path
        key={i}
        d={d}
        fill={['#1E2E77', '#27398C', '#18245F'][i % 3]}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />,
    );
    if (roof === 'tank')
      shapes.push(
        <g key={`t${i}`} stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
          <path d={`M${bx + 18} ${y}V${y - 10}M${bx + 36} ${y}V${y - 10}`} />
          <path
            d={`M${bx + 13} ${y - 10}V${y - 30}Q${bx + 27} ${y - 40} ${bx + 41} ${y - 30}V${y - 10}Z`}
            fill="#8B5A3C"
          />
        </g>,
      );
    for (let wy = y + 12; wy < 250; wy += 16) {
      for (let wx = bx + 8; wx < bx + bw - 12; wx += 13) {
        (rand() < 0.42 ? lit : windows).push(`M${wx} ${wy}h6v8h-6Z`);
      }
    }
  });
  return (
    <g>
      <path d={back} fill="#2A3F9A" opacity=".55" />
      {shapes}
      <path d={windows.join('')} fill="#0E1747" />
      <path d={lit.join('')} fill={WINDOW} />
    </g>
  );
}

export default function SuperheroPow({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const small = card || poster;
  const unit = (n: number) => (small ? cm(n) : cmh(n));
  // the moon and the hero grow into the free corner of a wide screen, a little less on a short one
  // (a landscape phone), where they would reach the opening line
  const big = (n: number) => (small ? cm(n) : `min(${cm(n)}, ${r1(n * 0.78)}cqh)`);
  const gutter = card ? 1.6 : 2.2;
  const cityH = card ? '34cqh' : '27cqh';
  const dots = (id: string, color: string, size: number) => (
    <pattern
      id={ref(id)}
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <circle cx={size / 2} cy={size / 2} r={size * 0.28} fill={color} />
    </pattern>
  );
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          {dots('dotsRed', RED, 9)}
          {dots('dotsYellow', YELLOW, 10)}
          {dots('dotsOrange', '#F29A1D', 7)}
          <clipPath id={ref('moonshade')}>
            <path
              d="M-46 -46H46V46H-46ZM-2 -46C-40 -38-40 38 30 40 50 20 50-20 30-40Z"
              clipRule="evenodd"
              fillRule="evenodd"
            />
          </clipPath>
          <radialGradient id={ref('moonglow')}>
            <stop offset=".6" stopColor="#FFE9A0" stopOpacity=".35" />
            <stop offset="1" stopColor="#FFE9A0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ref('rim')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#FFF3B0" />
            <stop offset="1" stopColor="#FFF3B0" stopOpacity=".2" />
          </linearGradient>
          <linearGradient id={ref('search')} x1="0" x2="0" y1="1" y2="0">
            <stop offset="0" stopColor="#FFF6C8" stopOpacity=".55" />
            <stop offset="1" stopColor="#FFF6C8" stopOpacity="0" />
          </linearGradient>
          <filter id={ref('pop')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="3" dy="3.5" stdDeviation="0" floodColor={INK} floodOpacity=".9" />
          </filter>
          <filter id={ref('soft')} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
      </svg>
      {/* night sky: deep blue, halftone dots at the top and the bottom, a calm middle for the names */}
      <Layer
        style={{
          background:
            'radial-gradient(70cqmin 50cqmin at 70% 14%, rgba(80,120,255,.35), transparent 70%),' +
            'linear-gradient(180deg, #0C1848 0%, #14277A 38%, #112163 64%, #0A143F 100%)',
        }}
      />
      <Layer
        style={{
          background:
            'radial-gradient(circle, rgba(110,150,255,.4) 0 30%, transparent 33%) 0 0 / 2.6cqmin 2.6cqmin',
          maskImage:
            'linear-gradient(180deg, #000 0%, rgba(0,0,0,.4) 22%, transparent 34%, transparent 62%, rgba(0,0,0,.7) 78%, #000 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, #000 0%, rgba(0,0,0,.4) 22%, transparent 34%, transparent 62%, rgba(0,0,0,.7) 78%, #000 100%)',
        }}
      />
      {/* a searchlight sweeping up from the rooftops */}
      <Piece
        vb={[0, 0, 200, 600]}
        anim="sweep"
        style={{
          left: card ? cw(8) : cw(12),
          bottom: card ? '14cqh' : '11cqh',
          width: unit(card ? 18 : 26),
          transformOrigin: '50% 100%',
          rotate: '16deg',
        }}
      >
        <path d="M100 600 24 0H176Z" fill={url('search')} filter={url('soft')} />
      </Piece>
      {/* the moon and the hero flying across it, speed lines behind */}
      <Piece
        vb={[-60, -60, 120, 120]}
        style={{ right: cm(small ? 6 : 4), top: big(small ? 8 : 12), width: big(small ? 26 : 34) }}
      >
        <Moon u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 160, 90]}
        style={{ right: cm(small ? -4 : -7), top: big(small ? 22 : 30), width: big(small ? 22 : 30) }}
      >
        <SpeedLines />
      </Piece>
      <Piece
        vb={[0, 0, 230, 140]}
        anim="float"
        style={{ right: cm(small ? 4 : 3), top: big(small ? 12 : 15), width: big(small ? 36 : 46) }}
      >
        <Hero u={url} />
      </Piece>
      {/* the city */}
      <Piece
        vb={[0, 0, 1600, 260]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: cityH }}
      >
        <Skyline />
      </Piece>
      {/* antenna lights blinking on the spires */}
      <Piece
        vb={[0, 0, 1600, 260]}
        fit="xMidYMax slice"
        anim="flicker"
        style={{ left: 0, bottom: 0, width: '100%', height: cityH }}
      >
        <g fill="#FF3B3B" stroke={INK} strokeWidth="1.6">
          {SPIRE_TIPS.map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="4.6" />
          ))}
        </g>
      </Piece>
      {/* the inset panels: POW! at the top corner, BOOM! at the bottom one — their bursts pop */}
      <Piece vb={[0, 0, 200, 130]} style={{ left: 0, top: 0, width: unit(small ? 44 : 50) }}>
        <PowPanel u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 200, 130]}
        anim="pop"
        style={{ left: 0, top: 0, width: unit(small ? 44 : 50), transformOrigin: '56% 66%' }}
      >
        <PowBurst u={url} />
      </Piece>
      <Piece vb={[0, 0, 210, 140]} style={{ right: 0, bottom: 0, width: unit(small ? 46 : 52) }}>
        <BoomPanel u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 210, 140]}
        anim="pop"
        style={{
          right: 0,
          bottom: 0,
          width: unit(small ? 46 : 52),
          transformOrigin: '59% 59%',
          animationDelay: '-1.2s',
        }}
      >
        <BoomBurst u={url} />
      </Piece>
      {/* the page: white gutters and the black border of the big panel */}
      <Layer style={{ border: `${cm(gutter)} solid ${PAPER}` }} />
      <Frame inset={cm(gutter)}>
        <rect width="100%" height="100%" fill="none" stroke={INK} style={{ strokeWidth: cm(0.9) }} />
      </Frame>
    </>
  );
}
