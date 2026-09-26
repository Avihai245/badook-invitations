import type { ReactNode } from 'react';
import { Layer, Piece, cm, cmh, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Grand Prix — race day in the sun: the start-light gantry across the top (its five reds glowing in
 * turn), checkered flags waving on both sides, clouds drifting, and below the names a curving track
 * with red-and-white kerbs, the chequered start line and the grandstands, a race car speeding along
 * it with turning wheels, and the podium with a trophy that shines. The car follows the accent.
 */
const CAR = 'var(--inv-accent, #E10600)';
const INK = '#141A26';
const ASPHALT = '#4A505C';
const KERB_RED = '#E5262D';
const GOLD = '#F4B63A';
const GRASS = '#7CC35A';

type Url = (name: string) => string;

/**
 * A checkered flag on its pole, the cloth rippling (viewBox 0 0 120 110): its squares are laid on the
 * wavy cloth by bilinear interpolation of a 6×4 grid.
 */
function CheckeredFlag() {
  const cols = 6;
  const rows = 4;
  // the cloth's corners (top at the pole, top far, bottom far, bottom at the pole) and its ripple
  const at = (u: number, v: number): [number, number] => {
    const x = 20 + (104 - 20) * u + 4 * v * u;
    const top = 8 + 10 * u;
    const bottom = 58 + 12 * u;
    const y = top + (bottom - top) * v + 7 * Math.sin(u * Math.PI * 1.7) * (0.6 + 0.4 * v);
    return [r1(x), r1(y)];
  };
  const squares: string[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i + j) % 2) continue;
      const p = [
        at(i / cols, j / rows),
        at((i + 1) / cols, j / rows),
        at((i + 1) / cols, (j + 1) / rows),
        at(i / cols, (j + 1) / rows),
      ];
      squares.push(`M${p.map((q) => q.join(' ')).join('L')}Z`);
    }
  }
  const outline: string[] = [];
  for (let k = 0; k <= 12; k++) outline.push(at(k / 12, 0).join(' '));
  for (let k = 12; k >= 0; k--) outline.push(at(k / 12, 1).join(' '));
  return (
    <g>
      <path d="M18 4 12 108" stroke="#5B6270" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M18 4 12 108" stroke="#C7CDD6" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d={`M${outline.join('L')}Z`}
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d={squares.join('')} fill={INK} />
      <circle cx="18" cy="4" r="3.4" fill={GOLD} />
    </g>
  );
}

/** A puffy cloud (viewBox 0 0 120 50). */
function Cloud() {
  return (
    <path
      d="M14 44C4 44 2 32 12 30 10 18 26 12 34 20 38 6 60 2 68 16 76 6 96 10 94 24 108 22 116 34 106 42 104 44 100 44 96 44Z"
      fill="#FFFFFF"
      opacity=".95"
    />
  );
}

/** The start-light gantry's box: five pods of two lamps (viewBox 0 0 300 76); `lit` draws the reds only. */
function StartLights({ lit, u }: { lit?: number; u: Url }) {
  if (lit !== undefined) {
    const x = 42 + lit * 54;
    return (
      <g filter={u('glow')}>
        <circle cx={x} cy="30" r="13" fill="#FF2B2B" />
        <circle cx={x - 4} cy="26" r="4" fill="#FFB3A8" opacity=".9" />
      </g>
    );
  }
  return (
    <g>
      <path d="M40 0V12M260 0V12" stroke="#2B303A" strokeWidth="5" />
      <rect x="6" y="8" width="288" height="66" rx="10" fill="#1B1F27" />
      <rect x="6" y="8" width="288" height="8" rx="4" fill="#3A404C" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={20 + i * 54} y="14" width="44" height="56" rx="8" fill="#0B0D12" />
          <circle cx={42 + i * 54} cy="30" r="13" fill="#3A1414" />
          <circle cx={42 + i * 54} cy="56" r="11" fill="#1E232C" />
        </g>
      ))}
    </g>
  );
}

/** Digits for the podium steps (viewBox per digit 0 0 16 24). */
const STEP_DIGITS: Record<string, string> = {
  '1': 'M6 0h6v24H6V7L2 9V4z',
  '2': 'M1 5C1 1 4 0 8 0s7 2 7 6c0 5-6 8-8 12h8v6H1v-5c2-6 8-8 8-12 0-2-1-2-2-2S7 3 7 6z',
  '3': 'M1 4C2 1 5 0 8 0c4 0 7 2 7 6 0 3-2 4-3 5 2 1 3 3 3 6 0 4-3 7-7 7-4 0-7-2-7-6h6c0 1 1 1 1 1 1 0 2-1 2-2s-1-2-2-2H7V9h1c1 0 2-1 2-2S9 5 8 5 7 6 7 6z',
};

/** The podium, 2 · 1 · 3 (viewBox 0 0 170 110). */
function Podium() {
  const step = (x: number, h: number, n: string, fill: string) => (
    <g key={n}>
      <path d={`M${x} 110V${110 - h}h52V110Z`} fill={fill} />
      <path d={`M${x} ${110 - h}h52v6H${x}Z`} fill="#fff" opacity=".5" />
      <g transform={`translate(${x + 18} ${118 - h}) scale(.75)`} fill={INK}>
        <path d={STEP_DIGITS[n]} />
      </g>
    </g>
  );
  return (
    <g>
      {step(4, 44, '2', '#DCE3EC')}
      {step(114, 30, '3', '#E8C9A8')}
      {step(59, 62, '1', '#FFFFFF')}
      <path d="M0 110H170" stroke={INK} strokeWidth="2" opacity=".25" />
    </g>
  );
}

/** A trophy (viewBox 0 0 60 76). */
function Trophy({ u }: { u: Url }) {
  return (
    <g>
      <path d="M14 8H46V20C46 34 38 42 30 44 22 42 14 34 14 20Z" fill={u('gold')} />
      <path
        d="M14 12H6C6 24 12 30 18 32M46 12H54C54 24 48 30 42 32"
        fill="none"
        stroke={GOLD}
        strokeWidth="4"
      />
      <path d="M26 44H34V56H26Z" fill="#D39A26" />
      <path d="M16 56H44V64H16ZM12 64H48V72H12Z" fill="#8A5A2B" />
      <path
        d="M20 12C20 24 24 32 28 36"
        fill="none"
        stroke="#FFF1C4"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".8"
      />
      <path d="M24 67h12" stroke={GOLD} strokeWidth="2" />
    </g>
  );
}

/** A wheel with five spokes (centred on 0, 0) — turns in the hero. */
function Wheel({ r }: { r: number }) {
  const spokes = [0, 72, 144, 216, 288].map((a) => {
    const t = (a * Math.PI) / 180;
    return `M0 0L${r1(Math.cos(t) * r * 0.58)} ${r1(Math.sin(t) * r * 0.58)}`;
  });
  return (
    <g>
      <circle r={r} fill="#15181E" />
      <circle r={r * 0.82} fill="none" stroke="#FFD23F" strokeWidth={r * 0.08} opacity=".9" />
      <circle r={r * 0.62} fill="#9AA3B1" />
      <path d={spokes.join('')} stroke="#4A5261" strokeWidth={r * 0.14} strokeLinecap="round" />
      <circle r={r * 0.16} fill="#E1E6ED" />
    </g>
  );
}

/** An open-wheel race car heading left (viewBox 0 0 270 100); its wheels turn in the hero. */
function RaceCar() {
  return (
    <g>
      <ellipse cx="136" cy="92" rx="130" ry="7" fill="#000" opacity=".22" />
      {/* rear wing, body, nose, front wing */}
      <path d="M226 20H262V30H232ZM238 30H250V62H238Z" fill={INK} />
      <path d="M226 20H262V24H226Z" style={{ fill: CAR }} />
      <path
        d="M8 70 22 60C54 54 84 50 100 46L118 38C130 32 146 30 158 32L206 40C218 42 230 50 234 62L236 76H8Z"
        style={{ fill: CAR }}
      />
      <path d="M8 70 22 60C54 54 84 50 100 46L110 44 104 58C80 62 44 66 12 72Z" fill="#fff" opacity=".22" />
      <path d="M150 58C170 56 196 58 214 64V74H150Z" fill="#000" opacity=".16" />
      <path d="M2 72H44V78H2Z" fill={INK} />
      {/* number roundel */}
      <circle cx="176" cy="58" r="11" fill="#fff" />
      <path d="M174.4 51h3.6v14h-3.6v-9.6l-2.4 1.2v-3z" fill={INK} />
      {/* cockpit, helmet and the halo */}
      <path d="M116 40C122 34 134 32 144 34L146 42H114Z" fill={INK} />
      <circle cx="128" cy="30" r="10" fill="#FFD23F" />
      <path d="M119 28H132C134 28 136 30 136 32H120Z" fill={INK} />
      <path
        d="M108 42C114 26 138 22 150 38"
        fill="none"
        stroke="#2B303A"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* the wheels */}
      <g transform="translate(62 72)">
        <g data-anim="turn">
          <Wheel r={22} />
        </g>
      </g>
      <g transform="translate(206 70)">
        <g data-anim="turn">
          <Wheel r={24} />
        </g>
      </g>
    </g>
  );
}

/** Speed streaks behind the car (viewBox 0 0 120 60). */
function Streaks() {
  return (
    <g stroke="#FFFFFF" strokeLinecap="round">
      <path d="M8 12H110" strokeWidth="3" opacity=".75" />
      <path d="M30 28H118" strokeWidth="2.4" opacity=".6" />
      <path d="M0 44H90" strokeWidth="2.6" opacity=".5" />
    </g>
  );
}

// the track's edges bow toward us in the middle — a long curve (viewBox y of the Circuit)
const bow = (x: number) => 1 - ((x - 800) / 820) ** 2;
const TRACK_TOP = (x: number) => 106 + 30 * bow(x);
const TRACK_BOTTOM = (x: number) => 260 + 24 * bow(x);
/** The pit wall's top in the Circuit's viewBox (the podium stands on it). */
const WALL_TOP = 70;

/**
 * The circuit from the infield (viewBox 0 0 1600 300): the grandstand along the whole straight — roof,
 * flags and a crowd in every colour — the pit wall's panels, the track bowing toward us with kerbs on
 * both edges, grid slots and the chequered line, the grass in front.
 */
function Circuit() {
  const rand = rng(31);
  const xs = Array.from({ length: 33 }, (_, i) => -10 + i * 50.625);
  const edge = (y: (x: number) => number, dy = 0) => xs.map((x) => `${r1(x)} ${r1(y(x) + dy)}`);
  const kerbs = (y: (x: number) => number, dy: number) => {
    const red: string[] = [];
    const white: string[] = [];
    for (let i = 0, x = -10; x < 1610; i++, x += 30) {
      const d = `M${r1(x)} ${r1(y(x) + dy)}L${r1(x + 30)} ${r1(y(x + 30) + dy)}V${r1(y(x + 30) + dy + 9)}L${r1(x)} ${r1(y(x) + dy + 9)}Z`;
      (i % 2 ? white : red).push(d);
    }
    return [red.join(''), white.join('')] as const;
  };
  const [topRed, topWhite] = kerbs(TRACK_TOP, -9);
  const [bottomRed, bottomWhite] = kerbs(TRACK_BOTTOM, 0);
  // the crowd: rows of dots in team colours, one path per colour
  const colors = ['#E5262D', '#FFD23F', '#2F7DE1', '#FFFFFF', '#FF8A3D', '#29B26B', '#FF6FA0'];
  const crowd: Record<string, string> = {};
  for (let row = 0; row < 5; row++) {
    for (let x = -6 + row * 3; x < 1606; x += 7 + rand() * 2.4) {
      const c = colors[Math.floor(rand() * colors.length)]!;
      const cy = r1(25 + row * 8.4 + rand() * 1.4);
      crowd[c] = `${crowd[c] ?? ''}M${r1(x)} ${cy}a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0Z`;
    }
  }
  const panels = ['#E5262D', '#FFFFFF', '#2F7DE1', '#FFD23F', '#141A26', '#29B26B', '#FF8A3D'];
  // the start line across the track, two squares wide
  const line: ReactNode[] = [];
  const lx = 692;
  const t0 = TRACK_TOP(lx);
  const h = (TRACK_BOTTOM(lx) - t0) / 10;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 2; col++) {
      if ((row + col) % 2) continue;
      line.push(
        <rect
          key={`${row}${col}`}
          x={lx + col * 12}
          y={r1(t0 + row * h)}
          width="12"
          height={r1(h)}
          fill={INK}
        />,
      );
    }
  }
  return (
    <g>
      {/* grandstand: tiers, the crowd, the roof and its flags */}
      <path d="M-10 12H1610V72H-10Z" fill="#CDD4DE" />
      {Object.entries(crowd).map(([c, d]) => (
        <path key={c} d={d} fill={c} />
      ))}
      <path
        d={xs
          .filter((_, i) => i % 4 === 0)
          .map((x) => `M${r1(x)} 12V72`)
          .join('')}
        stroke="#8D96A5"
        strokeWidth="3"
      />
      <path d="M-10 0H1610V13H-10Z" fill="#4B5261" />
      <path d="M-10 13H1610" stroke="#2B303A" strokeWidth="2" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = 40 + i * 100;
        // none over the middle, where the names' last lines come down
        if (Math.abs(x - 800) < 300) return null;
        return (
          <g key={x}>
            <path d={`M${x} 0V-22`} stroke="#4B5261" strokeWidth="2" />
            <path d={`M${x} -22l18 5-18 5z`} fill={colors[i % colors.length]} />
          </g>
        );
      })}
      {/* the pit wall and its panels */}
      <path d={`M-10 ${WALL_TOP}H1610V104H-10Z`} fill="#EEF1F5" />
      {Array.from({ length: 21 }, (_, i) => (
        <rect
          key={i}
          x={-4 + i * 80}
          y={WALL_TOP + 7}
          width="66"
          height="17"
          rx="3"
          fill={panels[i % panels.length]}
        />
      ))}
      <path d={`M-10 ${WALL_TOP}H1610`} stroke="#9AA3B1" strokeWidth="2" />
      {/* the grass, the track, its kerbs, lines, grid slots and the start line */}
      <path d="M-10 96H1610V300H-10Z" fill={GRASS} />
      <path d={`M${edge(TRACK_TOP).join('L')}L${edge(TRACK_BOTTOM).reverse().join('L')}Z`} fill={ASPHALT} />
      <path
        d={`M${edge(TRACK_TOP, 12).join('L')}L${edge(TRACK_BOTTOM, -12).reverse().join('L')}Z`}
        fill="#555C69"
      />
      <path d={topRed + bottomRed} fill={KERB_RED} />
      <path d={topWhite + bottomWhite} fill="#FFFFFF" />
      <path
        d={`M${edge(TRACK_TOP, 4).join('L')}M${edge(TRACK_BOTTOM, -4).join('L')}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
      />
      <path
        d={`M${edge((x) => (TRACK_TOP(x) + TRACK_BOTTOM(x)) / 2).join('L')}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeDasharray="22 26"
        opacity=".55"
      />
      <g stroke="#FFFFFF" strokeWidth="3" fill="none" opacity=".85">
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const x = 620 - k * 86;
          const lane = k % 2 ? 0.62 : 0.2;
          const y = TRACK_TOP(x) + (TRACK_BOTTOM(x) - TRACK_TOP(x)) * lane;
          return <path key={k} d={`M${x} ${r1(y)}v44M${x} ${r1(y)}h-22`} />;
        })}
      </g>
      {line}
    </g>
  );
}

export default function GrandPrix({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const small = card || poster;
  const unit = (n: number) => (small ? cm(n) : cmh(n));
  const trackH = card ? 40 : 33; // cqh
  const lightsW = card ? 40 : poster ? 50 : 56;
  // the podium stands on the pit wall (its top in the circuit's viewBox)
  const podiumW = small ? 26 : 28;
  const trophyW = small ? 7.8 : 8.4;
  const podiumBottom = `${r1((trackH * (300 - WALL_TOP)) / 300 - 0.2)}cqh`;
  const carW = small ? 40 : 48;
  const carBottom = card ? '5.4cqh' : '4.4cqh';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('gold')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#D8961E" />
            <stop offset=".45" stopColor="#FFD35C" />
            <stop offset="1" stopColor="#D8961E" />
          </linearGradient>
          <filter id={ref('glow')} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1B2A44" floodOpacity=".25" />
          </filter>
          <radialGradient id={ref('shine')}>
            <stop offset="0" stopColor="#FFF4C2" stopOpacity=".9" />
            <stop offset="1" stopColor="#FFF4C2" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      {/* a summer sky, bright over the circuit */}
      <Layer
        style={{
          background:
            'radial-gradient(60cqmin 40cqmin at 78% 8%, rgba(255,255,255,.7), transparent 70%),' +
            'linear-gradient(180deg, #8FCBFF 0%, #BFE2FF 38%, #DDF0FF 62%, #EAF7FF 100%)',
        }}
      />
      {/* clouds drifting */}
      {[
        [4, 17, 24, 0],
        [70, 25, 20, 1],
        [38, 9, 14, 2],
      ].map(([x, y, w, i]) => (
        <Piece
          key={i}
          vb={[0, 0, 120, 50]}
          anim="drift"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: unit(small ? w! * 0.8 : w!),
            opacity: 0.9,
            animationDelay: `${-i! * 5}s`,
            animationDuration: `${16 + i! * 5}s`,
          }}
        >
          <Cloud />
        </Piece>
      ))}
      {/* the start-light gantry across the top; each red glows in turn */}
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          width: '100%',
          top: unit(small ? 2.4 : 3),
          height: unit(small ? 1.8 : 2),
          background: 'linear-gradient(180deg, #5C6472, #2B303A)',
          boxShadow: '0 0.6cqmin 1.2cqmin rgba(20,26,38,.25)',
        }}
      />
      <Piece
        vb={[0, 0, 300, 76]}
        style={{ left: '50%', top: unit(small ? 2.4 : 3), width: unit(lightsW), translate: '-50% 0' }}
      >
        <g filter={url('soft')}>
          <StartLights u={url} />
        </g>
      </Piece>
      {[0, 1, 2, 3, 4].map((i) => (
        <Piece
          key={`l${i}`}
          vb={[0, 0, 300, 76]}
          anim="twinkle"
          style={{
            left: '50%',
            top: unit(small ? 2.4 : 3),
            width: unit(lightsW),
            translate: '-50% 0',
            animationDelay: `${r1(-2.8 + i * 0.56)}s`,
          }}
        >
          <StartLights lit={i} u={url} />
        </Piece>
      ))}
      {/* checkered flags waving on both sides */}
      <Piece
        vb={[0, 0, 120, 110]}
        anim="wiggle"
        style={{
          left: cm(small ? 3 : 2),
          top: small ? cm(16) : unit(22),
          width: unit(small ? 22 : 26),
          rotate: '-8deg',
        }}
      >
        <CheckeredFlag />
      </Piece>
      <Piece
        vb={[0, 0, 120, 110]}
        anim="wiggle"
        flip
        style={{
          right: cm(small ? 3 : 2),
          top: small ? cm(18) : unit(24),
          width: unit(small ? 22 : 26),
          rotate: '8deg',
          animationDelay: '-2.5s',
        }}
      >
        <CheckeredFlag />
      </Piece>
      {/* the circuit */}
      <Piece
        vb={[0, 0, 1600, 300]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: `${trackH}cqh` }}
      >
        <Circuit />
      </Piece>
      {/* the podium on the pit wall, its trophy shining */}
      <Piece vb={[0, 0, 170, 110]} style={{ right: cm(3), bottom: podiumBottom, width: unit(podiumW) }}>
        <g filter={url('soft')}>
          <Podium />
        </g>
      </Piece>
      <Piece
        vb={[-30, -30, 60, 60]}
        anim="pulse"
        style={{
          right: `calc(${cm(3)} + ${unit(r1(podiumW / 2 - trophyW * 0.7))})`,
          bottom: `calc(${podiumBottom} + ${unit(r1(podiumW * 0.365 + trophyW * 0.63 - trophyW * 0.7))})`,
          width: unit(r1(trophyW * 1.4)),
        }}
      >
        <circle r="30" fill={url('shine')} />
      </Piece>
      <Piece
        vb={[0, 0, 60, 76]}
        anim="float"
        style={{
          right: `calc(${cm(3)} + ${unit(r1(podiumW / 2 - trophyW / 2))})`,
          bottom: `calc(${podiumBottom} + ${unit(r1(podiumW * 0.365))})`,
          width: unit(trophyW),
        }}
      >
        <g filter={url('soft')}>
          <Trophy u={url} />
        </g>
      </Piece>
      {/* the race car crossing the line, streaks behind it */}
      <Piece
        vb={[0, 0, 120, 60]}
        style={{
          left: `calc(50% + ${unit(r1(carW * 0.4))})`,
          bottom: `calc(${carBottom} + ${unit(r1(carW * 0.1))})`,
          width: unit(r1(carW * 0.42)),
        }}
      >
        <Streaks />
      </Piece>
      <Piece
        vb={[0, 0, 270, 100]}
        anim="drift"
        style={{
          left: '50%',
          bottom: carBottom,
          width: unit(carW),
          translate: '-58% 0',
          animationDuration: '7s',
        }}
      >
        <RaceCar />
      </Piece>
    </>
  );
}
