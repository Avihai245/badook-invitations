import { Layer, Piece, cm, cmh, dayMonth, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Skate Park — the city at dusk: a violet-to-orange sky with the first stars, power lines with a pair
 * of sneakers hanging by their laces, a hazy skyline, and a concrete wall with a graffiti piece —
 * the day and month in bubble letters (thick strokes on drawn skeletons, not a font) with a 3D block,
 * a shine, drips and a crown — among tags; in front, a quarter-pipe with its coping, a skateboard
 * popping an ollie with turning wheels and a spray can that rattles. The piece follows the accent.
 */
const NEON = 'var(--inv-accent, #C8F53C)';
const INK = '#15101F';
const PINK = '#FF4FA3';
const CYAN = '#35D6FF';
const YELLOW = '#FFD23F';
const CONCRETE = '#A79FB8';

type Url = (name: string) => string;

/**
 * Skeletons of the bubble digits (a 20×30 cell): stroked very thick with round ends they become
 * bubble letters.
 */
const SKELETON: Record<string, string> = {
  '0': 'M10 3C15.5 3 17 9 17 15S15.5 27 10 27 3 21 3 15 4.5 3 10 3Z',
  '1': 'M5 8 11 3V27',
  '2': 'M4 9C4 3 16 2 16 9 16 15 4 20 4 27H17',
  '3': 'M4 4H16L9 12C15 12 17 15 17 20 17 28 6 28 3 24',
  '4': 'M13 27V3L3 19H18',
  '5': 'M16 3H6L5 12C9 10 17 11 17 19 17 27 7 28 3 24',
  '6': 'M15 3C8 4 3 11 3 19 3 24 6 27 10 27 14 27 17 24 17 20 17 15 14 13 10 13 6 13 3 16 3 20',
  '7': 'M3 3H17L8 27',
  '8': 'M10 14C6 14 4 11.5 4 8.5S6.5 3 10 3 16 5 16 8.5 14 14 10 14C5 14 3 17 3 20.5S6 27 10 27 17 24.5 17 20.5 15 14 10 14Z',
  '9': 'M17 10C17 6 14 3 10 3S3 6 3 10 6 17 10 17 17 14 17 10C17 18 14 25 6 27',
};

/** A four-pointed sparkle centred on (x, y). */
const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

/** A puffy cloud of `n` bumps around (cx, cy), their sizes varied (seeded). */
function cloud(cx: number, cy: number, rx: number, ry: number, n: number, seed: number): string {
  const rand = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i * 2 * Math.PI) / n;
    const a1 = ((i + 1) * 2 * Math.PI) / n;
    const k = 1.18 + rand() * 0.22;
    const p = (a: number, s: number) => `${r1(cx + Math.cos(a) * rx * s)} ${r1(cy + Math.sin(a) * ry * s)}`;
    d += `${i ? '' : `M${p(a0, 1)}`}Q${p((a0 + a1) / 2, k)} ${p(a1, 1)}`;
  }
  return `${d}Z`;
}

/**
 * The piece (viewBox 0 0 260 124): a cloud behind, the date "dd·mm" in fat bubble letters — a 3D
 * block, a black outline, a gradient fill, a shine — paint drips, a crown and sparkles.
 */
function GraffitiPiece({ dd, mm, u }: { dd: string; mm: string; u: Url }) {
  const W = 12.5; // the letters' stroke: fat enough that the skeletons read as bubbles
  const xs = [60, 93, 119, 145, 178];
  const place = [...dd, '·', ...mm].map((ch, i) => {
    const tilt = [-8, 6, 0, -6, 8][i] ?? 0;
    const lift = [5, -3, 2, 4, -3][i] ?? 0;
    return { ch, t: `translate(${xs[i]} ${36 + lift}) rotate(${tilt} 10 15) skewX(-8)` };
  });
  const layer = (stroke: string, width: number, dx = 0, dy = 0, opacity = 1) => (
    <g transform={`translate(${dx} ${dy})`} opacity={opacity}>
      {place.map(({ ch, t }, i) =>
        ch === '·' ? (
          <circle key={i} cx="10" cy="24" r={width / 2 + 0.6} transform={t} style={{ fill: stroke }} />
        ) : (
          <path
            key={i}
            d={SKELETON[ch] ?? ''}
            transform={t}
            fill="none"
            style={{ stroke }}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </g>
  );
  // paint running down from the letters: [x, top, length]
  const drips: [number, number, number][] = [
    [72, 74, 14],
    [98, 70, 24],
    [157, 74, 12],
    [188, 70, 20],
    [206, 66, 9],
  ];
  return (
    <g>
      <path
        d={cloud(128, 62, 104, 44, 13, 5)}
        fill={CYAN}
        stroke={INK}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path
        d="M40 70C36 58 46 48 58 50M196 34C208 30 222 38 222 50"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity=".75"
      />
      {/* 3D block, outline, fill, shine */}
      {layer('#3B1E5A', W + 7, 6, 7)}
      {layer(INK, W + 6)}
      {layer(u('fill'), W)}
      {layer('#FFFFFF', 2.6, -2.2, -2.8, 0.7)}
      {/* drips */}
      {drips.map(([x, y, h]) => (
        <g key={x}>
          <path d={`M${x} ${y}v${h}`} stroke={INK} strokeWidth="8.6" strokeLinecap="round" />
          <circle cx={x} cy={y + h + 1} r="5.6" fill={INK} />
          <path
            d={`M${x} ${y - 4}v${h + 4}`}
            style={{ stroke: NEON }}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx={x} cy={y + h + 1} r="3.8" style={{ fill: NEON }} />
        </g>
      ))}
      {/* a crown over the first letter, sparkles around */}
      <path
        d="M58 24 53 8 64 16 71 4 78 16 89 8 84 24Z"
        fill={YELLOW}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
        transform="rotate(-12 71 14)"
      />
      <path d={sparkle(236, 26, 8) + sparkle(20, 96, 6) + sparkle(226, 102, 5)} fill="#fff" />
    </g>
  );
}

/**
 * The concrete wall and the ground in front (viewBox 0 0 1600 240), with doodles sprayed on it away
 * from the middle (the piece goes there): a looping tag, a smiley, an arrow, a dripping heart, a star,
 * a row of crosses.
 */
function Wall() {
  const seams: string[] = [];
  for (let x = 90; x < 1600; x += 150) seams.push(`M${x} 24V200`);
  const line = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <g>
      <path d="M-10 18H1610V30H-10Z" fill="#CFC8DC" />
      <path d="M-10 30H1610V206H-10Z" fill={CONCRETE} />
      <path d={seams.join('')} stroke="#8E86A2" strokeWidth="2" />
      {/* a looping signature and its swoosh */}
      <path
        d="M96 128C104 96 124 92 122 118S100 142 112 112 150 86 150 118 162 96 176 104 182 132 166 126M88 146Q140 158 196 134"
        {...line}
        stroke={INK}
        strokeWidth="4.4"
      />
      {/* a smiley */}
      <g transform="translate(330 112)">
        <circle r="30" fill={YELLOW} stroke={INK} strokeWidth="4" />
        <path d="M-11-8v6M11-8v6M-15 8Q0 22 15 8" {...line} stroke={INK} strokeWidth="4" />
      </g>
      {/* an arrow */}
      <path
        d="M444 128H504V110L540 138 504 166V148H444Z"
        fill={CYAN}
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
        transform="rotate(-12 490 138)"
      />
      {/* a dripping heart */}
      <g transform="translate(1110 104)">
        <path
          d="M0 36C-26 18-34 4-30-8-26-20-8-22 0-8 8-22 26-20 30-8 34 4 26 18 0 36Z"
          fill={PINK}
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M-14 24v18M10 28v26" stroke={PINK} strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* a star */}
      <path
        d="M1290 84 1300 108 1326 110 1306 126 1313 152 1290 138 1267 152 1274 126 1254 110 1280 108Z"
        style={{ fill: NEON }}
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* crosses */}
      <path
        d="M1410 110l22 22m0-22-22 22M1450 104l22 22m0-22-22 22M1490 112l22 22m0-22-22 22"
        {...line}
        stroke="#FFFFFF"
        strokeWidth="5"
      />
      {/* ground */}
      <path d="M-10 204H1610V240H-10Z" fill="#5A536A" />
      <path d="M-10 204H1610" stroke="#2E2939" strokeWidth="3" />
    </g>
  );
}

/** The distant skyline at dusk, a low strip (viewBox 0 0 1600 80). */
function Skyline() {
  const rand = rng(8);
  let far = '';
  let near = '';
  const windows: string[] = [];
  for (let x = -10; x < 1610;) {
    const w = 30 + rand() * 50;
    far += `M${r1(x)} 82V${r1(34 - rand() * 30)}h${r1(w)}V82Z`;
    x += w - 8;
  }
  for (let x = -10; x < 1610;) {
    const w = 40 + rand() * 60;
    const h = 22 + rand() * 36;
    near += `M${r1(x)} 82V${r1(80 - h)}h${r1(w)}V82Z`;
    for (let wy = 88 - h; wy < 74; wy += 10) {
      for (let wx = x + 8; wx < x + w - 8; wx += 11)
        if (rand() < 0.18) windows.push(`M${r1(wx)} ${r1(wy)}h4v5h-4Z`);
    }
    x += w + rand() * 6;
  }
  return (
    <g>
      <path d={far} fill="#6B2F6E" opacity=".55" />
      <path d={near} fill="#3A1C4C" />
      <path d={windows.join('')} fill="#FFC56B" opacity=".8" />
    </g>
  );
}

/** A pair of high-tops hanging by their laces (viewBox 0 0 90 110). */
function Sneakers() {
  const shoe = (x: number, flip: boolean, color: string) => (
    <g transform={`translate(${x} 0)${flip ? ' scale(-1 1)' : ''}`}>
      <path d="M0 0C4 14 2 30 6 44" fill="none" stroke="#EDE7F5" strokeWidth="1.4" />
      <path d="M-6 44H14L16 70C22 74 34 78 34 88 34 94 30 96 24 96H-8C-12 96-14 92-12 86Z" fill={color} />
      <path d="M-13 86H34C34 92 31 96 24 96H-8C-12 96-14 92-13 86Z" fill="#FFFFFF" />
      <path d="M-6 44H14V52H-6Z" fill="#FFFFFF" />
      <circle cx="-2" cy="66" r="6" fill="#FFFFFF" opacity=".9" />
      <path d="M8 56 14 60M6 62 13 66M4 68 12 72" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
  return (
    <g>
      <path d="M40 0 34 6M50 0 56 6" stroke="#EDE7F5" strokeWidth="1.4" />
      {shoe(30, true, PINK)}
      {shoe(60, false, CYAN)}
    </g>
  );
}

/** A skateboard popping an ollie, wheels turning (viewBox 0 0 160 60). */
function Skateboard() {
  const wheel = (cx: number) => (
    <g transform={`translate(${cx} 44)`}>
      <g data-anim="turn">
        <circle r="8" fill="#F4EEDD" />
        <circle r="3" fill="#B7AE98" />
        <path d="M-6 0H6" stroke="#B7AE98" strokeWidth="1.4" />
      </g>
    </g>
  );
  return (
    <g>
      <path
        d="M8 22C12 30 18 32 26 32H134C142 32 148 30 152 22L150 26C146 34 140 36 132 36H28C20 36 14 34 10 26Z"
        fill={INK}
      />
      <path
        d="M8 20C12 28 18 30 26 30H134C142 30 148 28 152 20"
        fill="none"
        style={{ stroke: NEON }}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M36 36V40H52V36ZM108 36V40H124V36Z" fill="#8C8699" />
      {wheel(38)}
      {wheel(58)}
      {wheel(102)}
      {wheel(122)}
    </g>
  );
}

/** A spray can with a puff of paint (viewBox 0 0 70 110). */
function SprayCan() {
  return (
    <g>
      <circle cx="54" cy="14" r="10" style={{ fill: NEON }} opacity=".35" />
      <circle cx="62" cy="8" r="5" style={{ fill: NEON }} opacity=".25" />
      <path d="M20 26H44V108H20Z" fill={PINK} />
      <path d="M20 26C20 18 26 14 32 14S44 18 44 26Z" fill="#E8E3EF" />
      <path d="M28 8H36V16H28Z" fill="#E8E3EF" />
      <path d="M36 10H42" stroke="#E8E3EF" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 46H44V78H20Z" fill={INK} />
      <path
        d="M24 54 30 70 40 56"
        fill="none"
        style={{ stroke: NEON }}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 30V100" stroke="#FFFFFF" strokeWidth="3" opacity=".4" strokeLinecap="round" />
    </g>
  );
}

/** A quarter-pipe: the transition and its steel coping (viewBox 0 0 220 140). */
function QuarterPipe({ u }: { u: Url }) {
  return (
    <g>
      <path d="M0 140C88 140 150 110 176 30V24H220V140Z" fill={u('ramp')} />
      <path d="M176 24H220V140H200V36H176Z" fill="#6A6280" />
      <path d="M0 140C88 140 150 110 176 30" fill="none" stroke="#D9D2E6" strokeWidth="3" opacity=".7" />
      <path d="M170 24H222" stroke="#D5DAE3" strokeWidth="7" strokeLinecap="round" />
      <path d="M170 22.6H222" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".8" />
    </g>
  );
}

export default function SkateGraffiti({ place, date }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const small = card || poster;
  const unit = (n: number) => (small ? cm(n) : cmh(n));
  const [dd, mm] = dayMonth(date) ?? ['17', '06'];
  const wallH = card ? '38cqh' : '30cqh';
  // the power line sags across the top: its height at x (fractions of the box)
  const wire = (x: number) => 0.12 + 0.44 * x + 1.1 * x * (1 - x) * 0.6;
  const wireH = card ? 20 : 18; // cqh
  const shoesAt = 0.72;
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('fill')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--inv-accent, #C8F53C)' }} />
            <stop offset=".55" stopColor={YELLOW} />
            <stop offset="1" stopColor={PINK} />
          </linearGradient>
          <linearGradient id={ref('ramp')} x1="0" x2="1" y1="1" y2="0">
            <stop offset="0" stopColor="#8B82A0" />
            <stop offset=".7" stopColor="#B7AFC8" />
            <stop offset="1" stopColor="#D2CBE0" />
          </linearGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#140A20" floodOpacity=".45" />
          </filter>
          <filter id={ref('haze')} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
      </svg>
      {/* the dusk: violet above, pink and orange where the sun went down */}
      <Layer
        style={{
          background:
            'radial-gradient(90cqw 26cqh at 50% 72%, rgba(255,150,90,.75), rgba(255,110,120,.35) 45%, transparent 75%),' +
            'linear-gradient(180deg, #160E2E 0%, #2A1747 26%, #4A2163 46%, #7A2C6E 60%, #C24B6B 70%, #E9795C 76%, #B7566A 100%)',
        }}
      />
      {/* the first stars, twinkling out of step */}
      {[
        [8, 6, 1.6, 0],
        [23, 15, 1.1, 1],
        [38, 4, 1.3, 2],
        [57, 11, 1, 0],
        [84, 18, 1.4, 1],
        [93, 5, 1.1, 2],
        [48, 24, 0.9, 1],
        [14, 27, 1, 2],
      ].map(([x, y, s, g]) => (
        <Piece
          key={x}
          vb={[-10, -10, 20, 20]}
          anim="twinkle"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: unit(s! * 2.2),
            translate: '-50% -50%',
            animationDelay: `${-g! * 0.9}s`,
          }}
        >
          <path d={sparkle(0, 0, 9)} fill="#FFF6DE" />
        </Piece>
      ))}
      {/* the city far away, in the haze */}
      <Piece
        vb={[0, 0, 1600, 80]}
        fit="xMidYMax slice"
        style={{ left: 0, width: '100%', bottom: `calc(${wallH} - 1cqh)`, height: card ? '10cqh' : '8cqh' }}
      >
        <g filter={url('haze')}>
          <Skyline />
        </g>
      </Piece>
      {/* power lines across the sky, a pole at the edge */}
      <Piece
        vb={[0, 0, 100, 100]}
        fit="none"
        style={{ left: 0, top: 0, width: '100%', height: `${wireH}cqh` }}
      >
        <g fill="none" stroke="#0E0818" vectorEffect="non-scaling-stroke">
          {[0, 5].map((dy) => (
            <path
              key={dy}
              d={`M-2 ${12 + dy}Q50 ${r1(12 + dy + 44 + 66)} 102 ${56 + dy}`}
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 90, 110]}
        anim="swing"
        style={{
          left: `${shoesAt * 100}%`,
          top: `${r1(wire(shoesAt) * wireH + 1.1)}cqh`,
          width: unit(small ? 15 : 17),
          translate: '-50% 0',
        }}
      >
        <g filter={url('soft')}>
          <Sneakers />
        </g>
      </Piece>
      {/* the wall, its tags, the ground */}
      <Piece
        vb={[0, 0, 1600, 240]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: wallH }}
      >
        <Wall />
      </Piece>
      {/* the piece: the day and month in bubble letters */}
      <Piece
        vb={[0, 0, 260, 124]}
        style={{
          left: '50%',
          bottom: card ? '11cqh' : '8cqh',
          width: unit(small ? 62 : 70),
          translate: '-50% 0',
        }}
      >
        <GraffitiPiece dd={dd} mm={mm} u={url} />
      </Piece>
      {/* a quarter-pipe on the right (larger where the screen is wide), the board popping out of it */}
      <Piece vb={[0, 0, 220, 140]} style={{ right: cm(-2), bottom: 0, width: cm(small ? 30 : 32) }}>
        <g filter={url('soft')}>
          <QuarterPipe u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 160, 60]}
        anim="float"
        style={{
          right: cm(small ? 5 : 7),
          bottom: cm(small ? 20 : 22),
          width: cm(small ? 22 : 23),
          rotate: '-18deg',
        }}
      >
        <g filter={url('soft')}>
          <Skateboard />
        </g>
      </Piece>
      {/* the spray can rattling at the foot of the wall */}
      <Piece
        vb={[0, 0, 70, 110]}
        anim="wiggle"
        style={{
          left: cm(small ? 5 : 6),
          bottom: card ? '3cqh' : '2cqh',
          width: unit(small ? 9 : 10),
          rotate: '8deg',
        }}
      >
        <g filter={url('soft')}>
          <SprayCan />
        </g>
      </Piece>
    </>
  );
}
