import { Layer, Piece, cm, cmh, dayMonth, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Hoop Stars — game night in the arena: the hoop head-on under the rafters (its game clock showing
 * the day and month, a buzzer light around the glass, a net that swings), spotlights sweeping from
 * the corners, the stands as twinkling crowd bokeh over a glowing courtside ribbon, a polished maple
 * court in perspective (the painted key, the free-throw circle, the three-point arc, a star at
 * centre) with a ball bouncing on it, and a jersey with the number 10 hanging from the rafters
 * beside a championship banner. The key, the ribbon and the jersey follow the accent.
 */
const ACCENT = 'var(--inv-accent, #FF7A1A)';
const NAVY = '#0D1433';
const STEEL = '#39426A';
const CHALK = '#FFF7EA';
const AMBER = '#FFB23F';
const RED = '#FF3B3B';
const GOLD = '#F2C14E';
const BALL_SEAM = '#2B1509';

type Url = (name: string) => string;
type Ids = ReturnType<typeof useIds>;

// ── the court: feet (x across, y from the baseline toward us) seen from the stands → viewBox 1600×300 ──
const FOCAL = 660;
const EYE = 9400; // eye height × focal length
const Z0 = 62; // eye → baseline, in feet
const HORIZON = 18 - EYE / Z0; // the baseline lands at y = 18

function at(x: number, y: number): string {
  const z = Z0 - y;
  return `${r1(800 + (x * FOCAL) / z)} ${r1(HORIZON + EYE / z)}`;
}
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => at(x, y)).join('L')}Z`;
/** A painted line from (x1, y1) to (x2, y2), `w` feet wide — thinner as it goes away. */
function stripe(x1: number, y1: number, x2: number, y2: number, w = 0.34): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  return poly([
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ]);
}
/** A painted arc around (cx, cy), from `a0` to `a1` degrees (0° = +x, 90° = toward us). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, w = 0.34): string {
  const n = Math.max(8, Math.round(Math.abs(a1 - a0) / 4));
  const ring = (rr: number) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as [number, number];
    });
  return poly([...ring(r + w / 2), ...ring(r - w / 2).reverse()]);
}
/** A five-pointed star painted on the floor, centred on (cx, cy). */
function floorStar(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.42 : r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as [number, number];
  });
  return poly(pts);
}

function Court({ u }: { u: Url }) {
  const rand = rng(23);
  const planks: string[] = [];
  const joints: string[] = [];
  const light: string[] = [];
  const dark: string[] = [];
  for (let x = -25; x < 25; x += 0.8) {
    planks.push(`M${at(x, 0)}L${at(x, 42)}`);
    for (let k = 0; k < 2; k++) {
      const y = rand() * 42;
      joints.push(`M${at(x, y)}L${at(x + 0.8, y)}`);
    }
    // boards of a slightly different tone, as in real maple
    const tone = rand();
    const board = poly([
      [x, 0],
      [x + 0.8, 0],
      [x + 0.8, 42],
      [x, 42],
    ]);
    if (tone < 0.22) light.push(board);
    else if (tone > 0.8) dark.push(board);
  }
  const lines = [
    stripe(-25, 0, 25, 0),
    stripe(-25, 0, -25, 42),
    stripe(25, 0, 25, 42),
    stripe(-8, 0, -8, 19),
    stripe(8, 0, 8, 19),
    stripe(-8, 19, 8, 19),
    stripe(-22, 0, -22, 14.2),
    stripe(22, 0, 22, 14.2),
    arc(0, 5.25, 23.75, 22.1, 157.9),
    arc(0, 19, 6, 0, 180),
    arc(0, 5.25, 4, 0, 180, 0.26),
  ];
  // the dashed half of the free-throw circle, inside the key
  const dashes = Array.from({ length: 6 }, (_, i) => arc(0, 19, 6, 186 + i * 30, 200 + i * 30, 0.3));
  // lane space marks and the blocks
  const marks = [7, 11, 14, 17].flatMap((y) => [stripe(-8, y, -8.9, y, 0.3), stripe(8, y, 8.9, y, 0.3)]);
  const blocks = [
    poly([
      [-8, 7.6],
      [-8.9, 7.6],
      [-8.9, 8.6],
      [-8, 8.6],
    ]),
    poly([
      [8, 7.6],
      [8.9, 7.6],
      [8.9, 8.6],
      [8, 8.6],
    ]),
  ];
  return (
    <g>
      {/* the apron outside the lines, then the maple */}
      <path
        d={poly([
          [-80, -8],
          [80, -8],
          [80, 42],
          [-80, 42],
        ])}
        fill="#141C45"
      />
      <path
        d={poly([
          [-25, -8],
          [25, -8],
          [25, 42],
          [-25, 42],
        ])}
        fill={u('maple')}
      />
      <path d={light.join('')} fill="#FFF1D8" opacity=".09" />
      <path d={dark.join('')} fill="#5A300C" opacity=".1" />
      <path d={planks.join('')} stroke="#6B3E17" strokeWidth=".9" opacity=".2" />
      <path d={joints.join('')} stroke="#6B3E17" strokeWidth=".9" opacity=".22" />
      {/* the painted key and the star at centre */}
      <path
        d={poly([
          [-8, 0],
          [8, 0],
          [8, 19],
          [-8, 19],
        ])}
        style={{ fill: ACCENT }}
        opacity=".9"
      />
      <path d={floorStar(0, 34.5, 3.4)} style={{ fill: ACCENT }} opacity=".85" />
      <path d={arc(0, 34.5, 4.6, 0, 360, 0.3)} fill={CHALK} opacity=".8" />
      <path d={lines.join('')} fill={CHALK} opacity=".92" />
      <path d={[...dashes, ...marks, ...blocks].join('')} fill={CHALK} opacity=".85" />
      {/* the lights on the lacquer: a pool at centre, glossy streaks, dark sides */}
      <rect x="0" y="0" width="1600" height="300" fill={u('pool')} />
      <g filter={u('blur6')} opacity=".5">
        <rect x="560" y="8" width="34" height="292" fill={u('streak')} />
        <rect x="1004" y="8" width="34" height="292" fill={u('streak')} />
        <rect x="770" y="8" width="60" height="120" fill={u('streak')} opacity=".6" />
      </g>
      <rect x="0" y="0" width="1600" height="300" fill={u('vignette')} />
      {/* the ribbon board's glow on the floor */}
      <rect x="0" y="0" width="1600" height="26" fill={u('ribbonglow')} />
    </g>
  );
}

/**
 * The stands behind the baseline (viewBox 1600×140): three rows of a crowd in silhouette — one
 * 400-wide stretch drawn once and repeated — against tiers fading up into the dark.
 */
function Stands({ ids }: { ids: Ids }) {
  const rand = rng(7);
  const rows = [0, 1, 2].map((row) => {
    const y = 66 + row * 27;
    const s = 0.78 + row * 0.2;
    let d = '';
    for (let x = 6; x < 400; x += (17 + rand() * 9) * s) {
      const hr = r1(5.4 * s);
      const hy = r1(y - 12 * s - rand() * 3);
      const w = 10.5 * s;
      d +=
        `M${r1(x - w)} ${y + 14}Q${r1(x - w)} ${r1(y - 4 * s)} ${r1(x)} ${r1(y - 4 * s)}` +
        `Q${r1(x + w)} ${r1(y - 4 * s)} ${r1(x + w)} ${y + 14}Z` +
        `M${r1(x - hr)} ${hy}a${hr} ${hr} 0 1 0 ${r1(hr * 2)} 0a${hr} ${hr} 0 1 0 ${r1(-hr * 2)} 0Z`;
    }
    return d;
  });
  const crowd = ids.ref('crowd');
  return (
    <g>
      <defs>
        <g id={crowd}>
          <path d={rows[0]} fill="#172056" />
          <path d={rows[1]} fill="#0E1540" />
          <path d={rows[2]} fill="#070B22" />
        </g>
      </defs>
      <rect x="0" y="0" width="1600" height="140" fill={ids.url('tiers')} />
      {[0, 400, 800, 1200].map((x) => (
        <use key={x} href={`#${crowd}`} x={x} />
      ))}
    </g>
  );
}

/** Crowd bokeh and camera flashes, one of three groups that twinkle out of step (viewBox 1600×140). */
function Bokeh({ seed, u }: { seed: number; u: Url }) {
  const rand = rng(seed);
  const colors = ['#FFE3B8', '#FF9E57', '#7FB2FF', '#FF7DB8', '#FFFFFF', '#FFD166'];
  return (
    <g filter={u('blur2')}>
      {Array.from({ length: 22 }, (_, i) => {
        const r = 2.4 + rand() * 6;
        return (
          <circle
            key={i}
            cx={r1(rand() * 1600)}
            cy={r1(52 + rand() * 80)}
            r={r1(r)}
            fill={colors[Math.floor(rand() * colors.length)]}
            opacity={r1(0.3 + rand() * 0.45)}
          />
        );
      })}
    </g>
  );
}

/** A spotlight in the top corner and its beams (viewBox 0 0 500 520); `right` draws it mirrored. */
function Beams({ right, u }: { right: boolean; u: Url }) {
  const x0 = right ? 500 : 0;
  const cone = (deg: number, spread: number, len: number) => {
    const a = (d: number) => ((right ? 180 - d : d) * Math.PI) / 180;
    const p = (d: number) => `${r1(x0 + Math.cos(a(d)) * len)} ${r1(Math.sin(a(d)) * len)}`;
    return `M${x0} 0L${p(deg - spread)}L${p(deg + spread)}Z`;
  };
  return (
    <g filter={u('blur6')}>
      <path d={cone(58, 7, 620)} fill={u('beam')} />
      <path d={cone(44, 4, 600)} fill={u('beamwarm')} opacity=".8" />
      <circle cx={x0} cy="0" r="46" fill={u('lamp')} />
    </g>
  );
}

/** Seven-segment LED digits of the game clock (cell 12×22). */
const SEGMENTS: Record<string, string> = {
  a: 'M2.2 1.2 3.4 0h5.2l1.2 1.2-1.2 1.2H3.4z',
  b: 'M10.8 2.2 12 3.4v5.2l-1.2 1.2-1.2-1.2V3.4z',
  c: 'M10.8 12.2 12 13.4v5.2l-1.2 1.2-1.2-1.2v-5.2z',
  d: 'M2.2 20.8 3.4 19.6h5.2l1.2 1.2-1.2 1.2H3.4z',
  e: 'M1.2 12.2 2.4 13.4v5.2l-1.2 1.2L0 18.6v-5.2z',
  f: 'M1.2 2.2 2.4 3.4v5.2l-1.2 1.2L0 8.6V3.4z',
  g: 'M2.2 11 3.4 9.8h5.2l1.2 1.2-1.2 1.2H3.4z',
};
const LIT: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};
function LedDigits({ text, x, y, s }: { text: string; x: number; y: number; s: number }) {
  let cursor = 0;
  const cells = [...text].map((ch, i) => {
    const dx = cursor;
    if (ch === ':') {
      cursor += 7;
      return (
        <g key={i} fill={AMBER}>
          <rect x={dx + 1.5} y="6" width="2.6" height="2.6" rx=".6" />
          <rect x={dx + 1.5} y="13.6" width="2.6" height="2.6" rx=".6" />
        </g>
      );
    }
    cursor += 15;
    const lit = LIT[ch] ?? '';
    return (
      <g key={i} transform={`translate(${dx} 0)`}>
        {Object.entries(SEGMENTS).map(([k, d]) => (
          <path key={k} d={d} fill={AMBER} opacity={lit.includes(k) ? 1 : 0.1} />
        ))}
      </g>
    );
  });
  return <g transform={`translate(${x} ${y}) scale(${s}) skewX(-5)`}>{cells}</g>;
}

/**
 * The hoop head-on (viewBox 0 0 240 260): a truss up into the rafters, the game clock on top of the
 * backboard, the glass with its shooter's square, the bracket and the back of the rim.
 */
function HoopBack({ dd, mm, u }: { dd: string; mm: string; u: Url }) {
  return (
    <g>
      {/* truss */}
      <g stroke={STEEL} strokeWidth="4.5" fill="none">
        <path d="M66 -260V70M174 -260V70" />
        <path d="M66 -200 174 -140 66 -80 174 -20 66 30" strokeWidth="2.4" opacity=".8" />
      </g>
      <path d="M66 -260V70" stroke="#5D6897" strokeWidth="1.2" opacity=".7" />
      {/* game clock: the day and month */}
      <g filter={u('drop')}>
        <rect x="54" y="16" width="132" height="48" rx="6" fill="#0A0C13" stroke="#2B3143" strokeWidth="2" />
        <rect x="59" y="21" width="122" height="38" rx="3" fill="#040509" />
      </g>
      <g filter={u('led')}>
        <LedDigits text={`${dd}:${mm}`} x={80} y={25.5} s={1.3} />
        <path d="M64 40l6-4.6v9.2zM176 40l-6-4.6v9.2z" fill={RED} />
      </g>
      {/* backboard */}
      <rect x="18" y="68" width="204" height="120" rx="8" fill={u('glass')} />
      <g clipPath={u('glassclip')} opacity=".16">
        <path d="M30 60 92 200M58 60l62 140M160 60l54 124" stroke="#fff" strokeWidth="9" />
      </g>
      <rect x="18" y="68" width="204" height="120" rx="8" fill="none" stroke={CHALK} strokeWidth="5" />
      <rect x="86" y="124" width="68" height="48" fill="none" stroke={CHALK} strokeWidth="4.2" />
      <rect x="15" y="184" width="210" height="11" rx="5" fill="#101639" />
      {/* bracket and the back of the rim */}
      <path d="M108 182h24l-5 13h-14z" fill="#B84E14" />
      <path d="M84 199a36 7.5 0 0 1 72 0" fill="none" stroke="#C4501A" strokeWidth="4.4" />
    </g>
  );
}

/** The buzzer light around the glass (same viewBox as HoopBack) — it breathes in the hero. */
function BuzzerLight({ u }: { u: Url }) {
  return (
    <g filter={u('led')}>
      <rect
        x="23.5"
        y="73.5"
        width="193"
        height="109"
        rx="5"
        fill="none"
        stroke={RED}
        strokeWidth="2"
        opacity=".85"
      />
    </g>
  );
}

/** The front of the rim (same viewBox as HoopBack), over the net. */
function RimFront() {
  return (
    <g fill="none" strokeLinecap="round">
      <path d="M84 199a36 7.5 0 0 0 72 0" stroke="#F26A1B" strokeWidth="4.8" />
      <path d="M92 204.2a36 7.5 0 0 0 30 2" stroke="#FFB27A" strokeWidth="1.4" opacity=".8" />
    </g>
  );
}

/** The net (viewBox 0 0 80 74): strands from the rim (x 4–76 at y 5) tapering to a mouth 34 wide. */
function Net() {
  const hooks = 12;
  const levels = 6;
  const pt = (i: number, k: number): [number, number] => {
    const t = k / levels;
    const rx = 36 - 17 * t + 3 * t * t;
    const ry = 7.5 * (1 - 0.45 * t);
    const phi = (i / hooks) * Math.PI * 2;
    return [r1(40 + rx * Math.cos(phi)), r1(5 + 62 * t + ry * Math.sin(phi))];
  };
  const front: string[] = [];
  const back: string[] = [];
  for (let i = 0; i < hooks; i++) {
    for (let k = 0; k < levels; k++) {
      const [x0, y0] = pt(i + (k % 2) * 0.5, k);
      const [x1, y1] = pt(i + 0.5 + (k % 2) * 0.5, k + 1);
      const [x2, y2] = pt(i - 0.5 + (k % 2) * 0.5, k + 1);
      const seg = `M${x1} ${y1}L${x0} ${y0}L${x2} ${y2}`;
      const phi = ((i + (k % 2) * 0.5) / hooks) * Math.PI * 2;
      (Math.sin(phi) >= -0.05 ? front : back).push(seg);
    }
  }
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={back.join('')} stroke="#C9D3F5" strokeWidth="1.3" opacity=".45" />
      <path d={front.join('')} stroke="#FFFFFF" strokeWidth="1.6" opacity=".95" />
    </g>
  );
}

/** A basketball (viewBox -50 -50 100 100). */
function Ball({ u }: { u: Url }) {
  const rand = rng(5);
  return (
    <g>
      <circle r="46" fill={u('ball')} />
      <g clipPath={u('ballclip')}>
        {Array.from({ length: 90 }, (_, i) => {
          const a = rand() * Math.PI * 2;
          const d = Math.sqrt(rand()) * 44;
          return (
            <circle
              key={i}
              cx={r1(Math.cos(a) * d)}
              cy={r1(Math.sin(a) * d)}
              r=".8"
              fill="#6E2A08"
              opacity=".28"
            />
          );
        })}
        <g fill="none" stroke={BALL_SEAM} strokeWidth="3" strokeLinecap="round">
          <path d="M-47 -6C-22 6 22 6 47 -6" />
          <path d="M-4 -47C8 -20 8 20 -4 47" />
          <path d="M-33 -34C-15 -14-15 14-33 34" />
          <path d="M31 -36C13 -15 13 15 31 36" />
        </g>
      </g>
      <circle r="46" fill={u('ballshade')} />
      <ellipse cx="-17" cy="-21" rx="13" ry="7" fill="#fff" opacity=".28" transform="rotate(-32 -17 -21)" />
    </g>
  );
}

/** Varsity digits for the jersey (viewBox per digit 0 0 30 50). */
const JERSEY_DIGITS: Record<string, string> = {
  '1': 'M10 2h11v38h6v9H3v-9h7V15l-6 3V8z',
  '0': 'M9 2h12a7 7 0 0 1 7 7v32a7 7 0 0 1-7 7H9a7 7 0 0 1-7-7V9a7 7 0 0 1 7-7zm4 10v26h4V12z',
};

/** A tank-top jersey on a hanger, number 10 (viewBox 0 0 120 160). */
function Jersey({ u }: { u: Url }) {
  const body = 'M38 30C42 43 78 43 82 30L95 32C97 50 103 58 115 62V152H5V62C17 58 23 50 25 32Z';
  return (
    <g>
      <path d="M60 -120V14" stroke="#556096" strokeWidth="1.4" />
      <path d="M60 14l-24 16h48z" fill="none" stroke="#8C95BD" strokeWidth="2.4" strokeLinejoin="round" />
      <path d={body} style={{ fill: ACCENT }} />
      <path d="M38 30C42 43 78 43 82 30" fill="none" stroke={NAVY} strokeWidth="5" />
      <path d="M25 32C23 50 17 58 5 62M95 32C97 50 103 58 115 62" fill="none" stroke={NAVY} strokeWidth="5" />
      <path d="M5 140H115" stroke={NAVY} strokeWidth="4" opacity=".6" />
      <path d="M60 50l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill={CHALK} />
      <g
        transform="translate(29 76) scale(.95)"
        fill={CHALK}
        stroke={NAVY}
        strokeWidth="3"
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        <path d={JERSEY_DIGITS['1']} fillRule="evenodd" />
        <path d={JERSEY_DIGITS['0']} transform="translate(34 0)" fillRule="evenodd" />
      </g>
      <path d={body} fill={u('fold')} />
    </g>
  );
}

/** A championship banner: a trophy and three stars (viewBox 0 0 100 170). */
function Banner() {
  return (
    <g>
      <path d="M22 -120V8M78 -120V8" stroke="#556096" strokeWidth="1.4" />
      <path d="M12 8H88" stroke="#8C95BD" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 8H84V150L50 132 16 150Z" fill="#17215A" />
      <path d="M22 14H78V140L50 125 22 140Z" fill="none" stroke={GOLD} strokeWidth="2" />
      <g fill={GOLD}>
        <path d="M36 44h28v6c0 12-6 20-14 22-8-2-14-10-14-22z" />
        <path d="M36 48h-6c0 8 4 12 9 13M64 48h6c0 8-4 12-9 13" fill="none" stroke={GOLD} strokeWidth="2.6" />
        <path d="M47 71h6v10h-6z" />
        <path d="M40 81h20v6H40z" />
      </g>
      {[34, 50, 66].map((x) => (
        <path
          key={x}
          d={`M${x} 98l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z`}
          fill={CHALK}
        />
      ))}
    </g>
  );
}

export default function HoopStars({ place, date }: SceneProps) {
  const ids = useIds();
  const { ref, url } = ids;
  const card = place === 'card';
  const poster = place === 'poster';
  const [dd, mm] = dayMonth(date) ?? ['17', '06'];
  const unit = (n: number) => (card || poster ? cm(n) : cmh(n));
  // the hoop's width (its viewBox is 240 wide); on a short landscape screen it stays in the room the
  // names leave above them (≈ 330px of text in the middle); the net and the rim follow it
  const hoopWidth = card || poster ? cm(34) : `min(${cmh(50)}, calc(48cqh - 158px))`;
  const ofHoop = (units: number) => `calc(${hoopWidth} * ${r1((units / 240) * 1000) / 1000})`;
  const floorH = '30cqh';
  const hoopBox = { left: '50%', top: 0, width: hoopWidth, translate: '-50% 0' };
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('maple')} x1="0" x2="0" y1="0" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#A9692F" />
            <stop offset=".45" stopColor="#CD8D4B" />
            <stop offset="1" stopColor="#E6AC6A" />
          </linearGradient>
          <radialGradient
            id={ref('pool')}
            cx="800"
            cy="150"
            r="560"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(0 150) scale(1 .5) translate(0 -150)"
          >
            <stop offset="0" stopColor="#FFF4DE" stopOpacity=".42" />
            <stop offset=".55" stopColor="#FFF4DE" stopOpacity=".08" />
            <stop offset="1" stopColor="#FFF4DE" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id={ref('vignette')}
            cx="800"
            cy="170"
            r="900"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(0 170) scale(1 .45) translate(0 -170)"
          >
            <stop offset=".45" stopColor="#070A1C" stopOpacity="0" />
            <stop offset="1" stopColor="#070A1C" stopOpacity=".7" />
          </radialGradient>
          <linearGradient id={ref('tiers')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1A2358" stopOpacity="0" />
            <stop offset=".38" stopColor="#1A2358" stopOpacity=".85" />
            <stop offset="1" stopColor="#141C4B" />
          </linearGradient>
          <linearGradient id={ref('streak')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity=".7" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ref('ribbonglow')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--inv-accent, #FF7A1A)' }} stopOpacity=".45" />
            <stop offset="1" style={{ stopColor: 'var(--inv-accent, #FF7A1A)' }} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ref('beam')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#E4ECFF" stopOpacity=".55" />
            <stop offset="1" stopColor="#E4ECFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ref('beamwarm')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#FFE2B3" stopOpacity=".5" />
            <stop offset="1" stopColor="#FFE2B3" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={ref('lamp')}>
            <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" />
            <stop offset=".3" stopColor="#FFF1D6" stopOpacity=".6" />
            <stop offset="1" stopColor="#FFF1D6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ref('glass')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#C9D8FF" stopOpacity=".34" />
            <stop offset="1" stopColor="#8FA6E6" stopOpacity=".16" />
          </linearGradient>
          <linearGradient id={ref('fold')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity=".28" />
            <stop offset=".3" stopColor="#000" stopOpacity="0" />
            <stop offset=".7" stopColor="#fff" stopOpacity=".08" />
            <stop offset="1" stopColor="#000" stopOpacity=".3" />
          </linearGradient>
          <clipPath id={ref('glassclip')}>
            <rect x="18" y="68" width="204" height="120" rx="8" />
          </clipPath>
          <radialGradient id={ref('ball')} cx=".36" cy=".3" r=".75">
            <stop offset="0" stopColor="#FFA15A" />
            <stop offset=".5" stopColor="#EC7329" />
            <stop offset="1" stopColor="#B24A12" />
          </radialGradient>
          <radialGradient id={ref('ballshade')} cx=".38" cy=".32" r=".78">
            <stop offset=".6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".38" />
          </radialGradient>
          <clipPath id={ref('ballclip')}>
            <circle r="45" />
          </clipPath>
          <filter id={ref('blur2')} x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id={ref('blur6')} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={ref('led')} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ref('drop')} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity=".5" />
          </filter>
        </defs>
      </svg>
      {/* the arena in the dark: a haze of light over the hoop, the stands lit warm above the court */}
      <Layer
        style={{
          background:
            'radial-gradient(55cqmin 38cqmin at 50% 6%, rgba(126,156,255,.26), transparent 70%),' +
            'radial-gradient(90cqw 26cqh at 50% 66%, rgba(255,164,92,.16), transparent 72%),' +
            'linear-gradient(180deg, #04060F 0%, #0A1030 34%, #111A45 60%, #0B1233 100%)',
        }}
      />
      <Piece
        vb={[0, 0, 1600, 140]}
        fit="xMidYMax slice"
        style={{
          left: 0,
          width: '100%',
          bottom: `calc(${floorH} - 0.4cqh)`,
          height: card ? '16cqh' : '13cqh',
        }}
      >
        <Stands ids={ids} />
      </Piece>
      {[3, 11, 19].map((seed, i) => (
        <Piece
          key={seed}
          vb={[0, 0, 1600, 140]}
          fit="xMidYMax slice"
          anim="twinkle"
          style={{
            left: 0,
            width: '100%',
            bottom: `calc(${floorH} - 0.4cqh)`,
            height: card ? '16cqh' : '13cqh',
            animationDelay: `${-i * 0.9}s`,
            animationDuration: `${2.2 + i * 0.7}s`,
          }}
        >
          <Bokeh seed={seed} u={url} />
        </Piece>
      ))}
      {/* spotlights sweeping from the corners (invitation.css pivots them on their corner) */}
      <Piece
        vb={[0, 0, 500, 520]}
        anim="sweep"
        style={{ left: cm(-4), top: cm(-4), width: cm(card ? 46 : 78), transformOrigin: '0 0' }}
      >
        <Beams right={false} u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 500, 520]}
        anim="sweep"
        style={{
          right: cm(-4),
          top: cm(-4),
          width: cm(card ? 46 : 78),
          transformOrigin: '100% 0',
          animationDirection: 'alternate-reverse',
        }}
      >
        <Beams right u={url} />
      </Piece>
      {/* the court */}
      <Piece
        vb={[0, 0, 1600, 300]}
        fit="xMidYMin slice"
        style={{ left: 0, width: '100%', bottom: 0, height: floorH }}
      >
        <Court u={url} />
      </Piece>
      {/* the courtside ribbon board */}
      <Layer
        anim="pulse"
        style={{
          inset: 'auto',
          left: 0,
          width: '100%',
          bottom: floorH,
          height: '0.9cqh',
          background: `linear-gradient(90deg, transparent, ${ACCENT} 18%, #FFD9A8 50%, ${ACCENT} 82%, transparent)`,
          boxShadow: `0 0 2.4cqmin 0.3cqmin color-mix(in srgb, ${ACCENT} 70%, transparent)`,
        }}
      />
      {/* the jersey and the banner hang from the rafters */}
      <Piece
        vb={[0, 0, 120, 160]}
        anim="swing"
        style={{
          left: card ? cm(4) : cm(4),
          top: card ? cm(3) : poster ? cm(5) : unit(15),
          width: card ? cm(13) : poster ? cm(16) : unit(20),
          rotate: '-3deg',
        }}
      >
        <g filter={url('drop')}>
          <Jersey u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 100, 170]}
        anim="swing"
        style={{
          right: card ? cm(5) : cm(5),
          top: card ? cm(3) : poster ? cm(5) : unit(15),
          width: card ? cm(10) : poster ? cm(12) : unit(15),
          animationDelay: '-1.4s',
        }}
      >
        <g filter={url('drop')}>
          <Banner />
        </g>
      </Piece>
      {/* the hoop: back, buzzer light, the net (swings from the rim), the front of the rim */}
      <Piece vb={[0, 0, 240, 260]} style={hoopBox}>
        <HoopBack dd={dd} mm={mm} u={url} />
      </Piece>
      <Piece vb={[0, 0, 240, 260]} anim="pulse" style={hoopBox}>
        <BuzzerLight u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 80, 74]}
        anim="swing"
        style={{ left: '50%', top: ofHoop(194), width: ofHoop(80), translate: '-50% 0' }}
      >
        <Net />
      </Piece>
      <Piece vb={[0, 0, 240, 260]} style={hoopBox}>
        <RimFront />
      </Piece>
      {/* the ball bouncing on the star, its shadow on the lacquer */}
      <Piece
        vb={[-50, -12, 100, 24]}
        style={{
          left: '50%',
          bottom: card ? '4.6cqh' : '5.2cqh',
          width: card ? cm(11) : unit(16),
          translate: '-50% 50%',
        }}
      >
        <ellipse rx="44" ry="9" fill="#1A0C04" opacity=".55" filter={url('blur2')} />
      </Piece>
      <Piece
        vb={[-50, -50, 100, 100]}
        anim="bounce"
        style={{
          left: '50%',
          bottom: card ? '4.6cqh' : '5.2cqh',
          width: card ? cm(10) : unit(15),
          translate: '-50% 0',
        }}
      >
        <Ball u={url} />
      </Piece>
    </>
  );
}
