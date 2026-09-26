import { Fragment } from 'react';
import { Layer, Piece, ch, cm, leafPath, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Tropical Tiki — a tiki-bar sunset: a big sun sinking into the sea under a sky running from indigo
 * (a few stars) through plum and raspberry to gold, a palm island and a sailboat on the horizon, birds
 * gliding home; palm fronds hang from the top corners, two bamboo tiki torches flicker at the sides
 * with embers rising, and monstera leaves, hibiscus and a pineapple fill the foreground. The hibiscus
 * follow the accent (the coral and orchid presets recolor them).
 */
const HIBISCUS = 'var(--inv-accent, #C92E62)';
const HIB_DEEP = 'color-mix(in srgb, var(--inv-accent, #C92E62) 55%, #2A0212)';
const HIB_LIGHT = 'color-mix(in srgb, var(--inv-accent, #C92E62) 70%, #FFE0D2)';
const FROND = '#1F6E45';
const FROND_DARK = '#0F4A30';
const FROND_LIGHT = '#3C9258';
const FROND_LIT = '#5A9446';
const RIB = '#28552C';
const DUSK = '#2A1236';

type Url = (name: string) => string;
type Pt = readonly [number, number];

/** Point and tangent angle (deg) of a quadratic curve at t. */
function onCurve([x0, y0]: Pt, [cx, cy]: Pt, [x1, y1]: Pt, t: number): [number, number, number] {
  const u = 1 - t;
  const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
  const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
  const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
  const dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
  return [r1(x), r1(y), (Math.atan2(dy, dx) * 180) / Math.PI];
}

/** Turns an angle part of the way toward straight down (90°) — leaflets hang. */
const droop = (deg: number, k: number) => {
  const d = ((((90 - deg) % 360) + 540) % 360) - 180;
  return deg + d * k;
};

/** A palm frond: an arching rib with long leaflets hanging from both sides, more toward its tip. */
function Frond({
  from,
  ctrl,
  to,
  len,
  n = 26,
  tone = FROND,
}: {
  from: Pt;
  ctrl: Pt;
  to: Pt;
  len: number;
  n?: number;
  tone?: string;
}) {
  const blades = [];
  for (let i = 0; i < n; i++) {
    const t = 0.08 + (0.9 * i) / (n - 1);
    const [x, y, deg] = onCurve(from, ctrl, to, t);
    const l = len * (0.5 + 0.5 * Math.sin(Math.PI * (0.15 + 0.75 * t)));
    for (const side of [-1, 1]) {
      const a = droop(deg + side * 48, 0.28 + 0.38 * t);
      blades.push(
        <path
          key={`${i}${side}`}
          d={leafPath(x, y, a, l, l * 0.16, side * 10)}
          fill={side < 0 ? FROND_DARK : i % 3 ? tone : FROND_LIT}
        />,
      );
    }
  }
  return (
    <g>
      {blades}
      <path
        d={`M${from[0]} ${from[1]}Q${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}`}
        stroke={RIB}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Fronds hanging into the top-left corner from a crown just outside it (viewBox 0 0 300 240). */
function Canopy({ lush }: { lush: boolean }) {
  return (
    <g>
      <Frond from={[-8, -10]} ctrl={[44, 80]} to={[46, 236]} len={44} tone={FROND_DARK} />
      {lush ? <Frond from={[-8, -10]} ctrl={[120, -40]} to={[262, -8]} len={38} n={18} /> : null}
      <Frond from={[-8, -10]} ctrl={[150, 4]} to={[296, 104]} len={52} n={28} />
      <Frond from={[-8, -10]} ctrl={[112, 64]} to={[176, 212]} len={50} tone={FROND_LIGHT} />
      {lush ? (
        <Frond from={[-8, -10]} ctrl={[80, 30]} to={[118, 150]} len={34} n={16} tone={FROND_DARK} />
      ) : null}
      <circle cx="8" cy="8" r="12" fill="#4E3119" />
      <circle cx="26" cy="2" r="11" fill="#6A4222" />
      <circle cx="18" cy="18" r="10" fill="#5B391D" />
      <circle cx="22" cy="14" r="3" fill="#8A5A2E" opacity=".6" />
    </g>
  );
}

/**
 * A monstera leaf (local frame: stem at the origin, tip up at y = -108, half-width 58), split into
 * lobes by slits that run from the edge to the midrib, with holes near the rib.
 */
function Monstera({ x, y, s, deg, u }: { x: number; y: number; s: number; deg: number; u: Url }) {
  const C = -52;
  const RX = 58;
  const RY = 56;
  const edge = (phi: number, side: number) => {
    const a = (phi * Math.PI) / 180;
    return [r1(side * RX * Math.cos(a)), r1(C + RY * Math.sin(a))] as const;
  };
  const rib = (phi: number) => r1(C + RY * Math.sin((phi * Math.PI) / 180) * 0.58);
  const cuts = [-86, -60, -36, -12, 12, 36, 60, 82];
  const lobes = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k]! + 2.2;
      const b = cuts[k + 1]! - 2.2;
      const [ex1, ey1] = edge(a, side);
      const [ex2, ey2] = edge(b, side);
      const m1 = rib(a);
      const m2 = rib(b);
      const sweep = side > 0 ? 1 : 0;
      const hx = r1((ex1 + ex2) * 0.2);
      const hy = r1((m1 + m2) / 2 + (ey1 + ey2 - m1 - m2) * 0.2);
      const hole =
        k > 1 && k < 5 ? `M${hx - 3.2} ${hy}a3.2 5 ${side * 30} 1 0 6.4 0a3.2 5 ${side * 30} 1 0-6.4 0Z` : '';
      lobes.push(
        <path
          key={`${side}${k}`}
          d={`M${side * 1.6} ${m1}L${ex1} ${ey1}A${RX} ${RY} 0 0 ${sweep} ${ex2} ${ey2}L${side * 1.6} ${m2}Z${hole}`}
          fill={u('monstera')}
          fillRule="evenodd"
        />,
      );
    }
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg}) scale(${s})`}>
      <path d="M0 0V70" stroke="#1D5A36" strokeWidth="4.5" strokeLinecap="round" />
      {lobes}
      <path d="M0 2V-104" stroke="#76B67A" strokeWidth="1.8" opacity=".7" />
    </g>
  );
}

/** A hibiscus face-on: five fan petals with ruffled rims, a dark eye and the long stamen column. */
function Hibiscus({ x, y, r, turn = 0 }: { x: number; y: number; r: number; turn?: number }) {
  const P = (rad: number, deg: number) => polar(x, y, r * rad, deg).join(' ');
  const petals = [0, 1, 2, 3, 4].map((k) => {
    const a = turn + k * 72;
    return (
      <g key={k}>
        <path
          d={`M${x} ${y}Q${P(0.55, a - 44)} ${P(0.96, a - 28)}Q${P(1.12, a - 17)} ${P(1.01, a - 8)}Q${P(0.97, a)} ${P(1.02, a + 7)}Q${P(1.13, a + 17)} ${P(0.96, a + 28)}Q${P(0.55, a + 44)} ${x} ${y}Z`}
          style={{ fill: k % 2 ? HIBISCUS : HIB_LIGHT, stroke: HIB_DEEP }}
          strokeWidth={r1(r * 0.02)}
          strokeOpacity=".45"
        />
        {[-14, 0, 14].map((d) => (
          <path
            key={d}
            d={`M${P(0.2, a + d * 0.3)}Q${P(0.55, a + d * 0.8)} ${P(0.86, a + d)}`}
            fill="none"
            style={{ stroke: HIB_DEEP }}
            strokeWidth={r1(r * 0.016)}
            opacity=".3"
          />
        ))}
      </g>
    );
  });
  const col = turn + 36 - 90;
  const [tx, ty] = polar(x, y, r * 0.95, col);
  const [mx, my] = polar(x, y, r * 0.5, col - 8);
  return (
    <g>
      {petals}
      <circle cx={x} cy={y} r={r1(r * 0.36)} style={{ fill: HIB_DEEP }} opacity=".85" />
      <circle cx={x} cy={y} r={r1(r * 0.2)} fill="#3A0415" opacity=".7" />
      <path
        d={`M${x} ${y}Q${mx} ${my} ${tx} ${ty}`}
        stroke="#FBE7C2"
        strokeWidth={r1(r * 0.07)}
        fill="none"
        strokeLinecap="round"
      />
      {[0.55, 0.64, 0.72, 0.8, 0.86].map((f, i) => {
        const [px, py] = polar(x, y, r * f, col - 8 + (i % 2 ? 9 : -5));
        return <circle key={i} cx={px} cy={py} r={r1(r * 0.05)} fill="#FFD24A" />;
      })}
      {[-30, -15, 0, 15, 30].map((d) => {
        const [px, py] = polar(tx, ty, r * 0.08, col + d);
        return <circle key={d} cx={px} cy={py} r={r1(r * 0.04)} fill="#B3122F" />;
      })}
    </g>
  );
}

/** A pineapple (viewBox 0 0 100 170), standing on the bottom edge. */
function Pineapple({ u }: { u: Url }) {
  const eyes = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 7; col++) {
      const px = 20 + col * 10 + (row % 2) * 5;
      const py = 76 + row * 9.5;
      if (((px - 50) / 30) ** 2 + ((py - 114) / 40) ** 2 > 0.8) continue;
      eyes.push(
        <g key={`${row}${col}`}>
          <path
            d={`M${px} ${py - 5}L${px + 5} ${py}L${px} ${py + 5}L${px - 5} ${py}Z`}
            fill="none"
            stroke="#8A4A12"
            strokeWidth="1.1"
            opacity=".7"
          />
          <circle cx={px} cy={py + 1} r="1.1" fill="#6A3608" />
        </g>,
      );
    }
  }
  const crown = [
    [-90, 58, 8, '#2E7A3E'],
    [-112, 46, 7, '#3F8F4E'],
    [-68, 46, 7, '#3F8F4E'],
    [-132, 36, 6, '#2E6E3A'],
    [-48, 36, 6, '#2E6E3A'],
    [-100, 40, 6, '#5DAA5E'],
    [-80, 40, 6, '#5DAA5E'],
  ] as const;
  return (
    <g>
      <ellipse cx="50" cy="162" rx="36" ry="7" fill="#3A1E10" opacity=".35" />
      {crown.map(([deg, len, wid, fill], i) => (
        <path key={i} d={leafPath(50, 78, deg, len, wid, deg < -90 ? -6 : 6)} fill={fill} />
      ))}
      <ellipse cx="50" cy="118" rx="31" ry="42" fill={u('pineapple')} />
      {eyes}
      <ellipse cx="38" cy="104" rx="7" ry="16" fill="#FFE6A0" opacity=".25" />
    </g>
  );
}

/** A bamboo tiki torch (viewBox 0 0 60 300): the flame sways and flickers. */
function Torch({ u, delay }: { u: Url; delay: string }) {
  return (
    <g>
      <rect x="25.5" y="70" width="9" height="232" fill={u('bamboo')} />
      {[120, 172, 226, 278].map((y) => (
        <rect key={y} x="24.5" y={y} width="11" height="3" rx="1.5" fill="#5A3A1C" opacity=".75" />
      ))}
      <path
        d="M25 76l10 6M25 82l10 6M25 88l10 6M35 76l-10 6M35 82l-10 6M35 88l-10 6"
        stroke="#E8C98A"
        strokeWidth="1.2"
      />
      <path d="M16 50h28l-6 22H22z" fill="#4A2E17" />
      <path d="M16 50h28" stroke="#7A5430" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M22 54l2 17M30 54v17M38 54l-2 17" stroke="#6E4A28" strokeWidth="1.2" />
      <g data-anim="sway" style={{ animationDelay: delay }}>
        <g data-anim="flicker" style={{ animationDelay: delay }}>
          <path d="M30 0C46 18 49 36 30 52 11 36 14 18 30 0Z" fill="#FF6A2B" />
          <path d="M31 14C41 27 42 39 30 50 19 40 21 28 31 14Z" fill="#FFA93E" />
          <path d="M30 27C37 35 37 43 30 49 23 43 24 35 30 27Z" fill="#FFE39A" />
        </g>
      </g>
    </g>
  );
}

/** A low palm island (viewBox 0 0 200 60), its base on the bottom edge. */
function Island() {
  const crowns: [number, number, number[]][] = [
    [106, 6, [-160, -120, -60, -20, 20, 160]],
    [112, 14, [-170, -130, -50, -10, 30, 150]],
  ];
  return (
    <g fill={DUSK}>
      <path d="M0 60C30 46 70 40 110 44S180 54 200 60Z" />
      <path d="M92 46C94 30 98 18 106 6" stroke={DUSK} strokeWidth="3" fill="none" />
      <path d="M122 50C122 36 118 24 112 14" stroke={DUSK} strokeWidth="2.6" fill="none" />
      {crowns.map(([x, y, degs], i) =>
        degs.map((d) => <path key={`${i}${d}`} d={leafPath(x, y, d, 18, 3.4, d > -90 ? 12 : -12)} />),
      )}
    </g>
  );
}

export default function TropicalTiki({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const rand = rng(29);
  const stars = Array.from(
    { length: 34 },
    () => [r1(rand() * 200), r1(rand() * 60), r1(0.25 + rand() * 0.55)] as const,
  );
  const shimmer = (seed: number) => {
    const rr = rng(seed);
    return Array.from({ length: 16 }, (_, i) => {
      const y = 2 + i * 6;
      const w = 16 + y * 0.9;
      const x = 100 - w / 2 + (rr() - 0.5) * 10;
      return [r1(x), y, r1(w * (0.3 + rr() * 0.5)), r1(0.95 - i * 0.05)] as const;
    });
  };
  // the horizon is 79% down everywhere; sizes cap by the height on a landscape hero
  const horizon = '79%';
  const size = (n: number, h: number) => `min(${n}cqmin, ${h}cqh)`;
  const side = card ? 'max(2cqw, calc(50% - 40cqmin))' : 'max(1.5cqw, calc(50% - 50cqmin))';
  const torchH = card ? 58 : 33;
  const glowW = card ? 14 : 24;
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('sun')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFF6D0" />
            <stop offset=".5" stopColor="#FFD77E" />
            <stop offset="1" stopColor="#FF9446" />
          </radialGradient>
          <radialGradient id={ref('sun-glow')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFC273" stopOpacity=".8" />
            <stop offset=".35" stopColor="#FF9360" stopOpacity=".36" />
            <stop offset="1" stopColor="#FF7A55" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ref('torch-glow')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFC56B" stopOpacity=".7" />
            <stop offset=".45" stopColor="#FF8A3D" stopOpacity=".22" />
            <stop offset="1" stopColor="#FF7A2D" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ref('bamboo')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#D8AE6C" />
            <stop offset=".55" stopColor="#A87840" />
            <stop offset="1" stopColor="#6E4A25" />
          </linearGradient>
          <linearGradient id={ref('monstera')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#35945A" />
            <stop offset="1" stopColor="#12492F" />
          </linearGradient>
          <linearGradient id={ref('pineapple')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#F6C04A" />
            <stop offset=".6" stopColor="#DA8C2A" />
            <stop offset="1" stopColor="#A65B18" />
          </linearGradient>
          <linearGradient id={ref('sand')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#E3A874" />
            <stop offset="1" stopColor="#9E6242" />
          </linearGradient>
          <filter id={ref('soft')} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#12061C" floodOpacity=".45" />
          </filter>
        </defs>
      </svg>
      {/* the sky, indigo to gold at the horizon */}
      <Layer
        style={{
          background:
            'linear-gradient(180deg, #1B1340 0%, #2C1755 17%, #4B1C62 34%, #772463 50%, #A12D61 62%, #C83C5B 70.5%, #E7594F 75.5%, #FA8C4F 78%, #FFBE6A 79%)',
        }}
      />
      <Piece
        vb={[0, 0, 200, 60]}
        anim="twinkle"
        fit="xMidYMin slice"
        style={{ left: 0, top: 0, width: '100%', height: ch(28), aspectRatio: 'auto', overflow: 'hidden' }}
      >
        {stars.map(([x, y, s], i) => (
          <circle key={i} cx={x} cy={y} r={s} fill="#FFF3DA" opacity={0.35 + (i % 4) * 0.15} />
        ))}
      </Piece>
      {/* the sun sinking, its glow breathing */}
      <Piece
        vb={[0, 0, 200, 200]}
        anim="pulse"
        style={{ left: '50%', top: horizon, width: size(card ? 80 : 120, 68), translate: '-50% -50%' }}
      >
        <circle cx="100" cy="100" r="100" fill={url('sun-glow')} />
      </Piece>
      <Piece
        vb={[0, 0, 100, 100]}
        style={{ left: '50%', top: horizon, width: size(card ? 22 : 34, 30), translate: '-50% -42%' }}
      >
        <circle cx="50" cy="50" r="50" fill={url('sun')} />
      </Piece>
      {/* birds gliding home */}
      <Piece
        vb={[0, 0, 120, 50]}
        anim="drift"
        style={{ right: cm(card ? 14 : 12), top: card ? ch(16) : ch(17), width: size(card ? 16 : 26, 16) }}
      >
        {[
          [20, 30, 1],
          [48, 18, 1.3],
          [70, 34, 0.85],
          [96, 12, 0.7],
        ].map(([x, y, s], i) => (
          <path
            key={i}
            d={`M${x! - 8 * s!} ${y}Q${x! - 4 * s!} ${y! - 5 * s!} ${x} ${y}Q${x! + 4 * s!} ${y! - 5 * s!} ${x! + 8 * s!} ${y}`}
            stroke="#FFDDBE"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            opacity=".85"
          />
        ))}
      </Piece>
      <Piece
        vb={[0, 0, 200, 60]}
        style={{ left: card ? '64%' : '63%', bottom: '21%', width: size(card ? 20 : 30, 22) }}
      >
        <Island />
      </Piece>
      <Piece
        vb={[0, 0, 40, 40]}
        anim="drift"
        style={{ left: card ? '24%' : '22%', bottom: '20.6%', width: size(card ? 5 : 7, 6) }}
      >
        <path d="M20 4V31" stroke={DUSK} strokeWidth="1.4" />
        <path d="M21 5C30 14 33 22 34 29H21Z" fill={DUSK} />
        <path d="M19 9C13 16 10 23 9 29H19Z" fill={DUSK} opacity=".85" />
        <path d="M6 32H35L31 38H11Z" fill={DUSK} />
      </Piece>
      {/* the sea, lit near the horizon */}
      <Layer
        style={{
          top: horizon,
          background:
            'linear-gradient(180deg, #FFC47A 0%, #F08A5E 3%, #B24A66 12%, #6A2F6A 30%, #2E2B63 55%, #16264A 80%, #0F1E3A 100%)',
        }}
      />
      <Layer style={{ top: horizon, height: '1px', background: 'rgba(255,226,170,.9)' }} />
      {[0, 1].map((k) => (
        <Piece
          key={k}
          vb={[0, 0, 200, 100]}
          anim="twinkle"
          style={{
            left: '50%',
            top: horizon,
            width: size(card ? 28 : 40, 34),
            translate: '-50% 0',
            animationDelay: k ? '-1.4s' : '0s',
          }}
        >
          {shimmer(7 + k).map(([x, y, w, o], i) => (
            <path
              key={i}
              d={`M${x} ${y + k * 3}h${w}`}
              stroke="#FFD89A"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity={o * 0.8}
            />
          ))}
        </Piece>
      ))}
      <Piece
        vb={[0, 0, 400, 60]}
        anim="drift"
        fit="none"
        style={{
          left: '-5%',
          width: '110%',
          top: `calc(${horizon} + 4%)`,
          height: ch(11),
          aspectRatio: 'auto',
        }}
      >
        {[8, 22, 38, 52].map((y, i) => (
          <path
            key={y}
            d={`M${10 + i * 30} ${y}q30 -4 60 0t60 0M${220 - i * 20} ${y + 4}q24 -3 48 0t48 0`}
            stroke="#FFC9B0"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            fill="none"
            opacity={0.34 - i * 0.05}
          />
        ))}
      </Piece>
      {/* the beach */}
      <Piece
        vb={[0, 0, 400, 40]}
        fit="none"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? ch(12) : ch(9), aspectRatio: 'auto' }}
      >
        <path d="M0 12C90 2 200 10 300 5S380 4 400 6V40H0Z" fill={url('sand')} />
        <path
          d="M0 12C90 2 200 10 300 5S380 4 400 6"
          stroke="#FFF1E0"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          fill="none"
          opacity=".55"
          strokeDasharray="14 6"
        />
      </Piece>
      {/* torches at both sides: the glow breathes, embers rise */}
      {(['left', 'right'] as const).map((edge, i) => (
        <Fragment key={edge}>
          <Piece
            vb={[0, 0, 100, 100]}
            anim="pulse"
            style={{
              [edge]: `calc(${side} + ${torchH * 0.1}cqh - ${cm(glowW / 2)})`,
              bottom: `calc(${ch(1 + torchH * 0.88)} - ${cm(glowW / 2)})`,
              width: cm(glowW),
              animationDelay: i ? '-1.6s' : '0s',
            }}
          >
            <circle cx="50" cy="50" r="50" fill={url('torch-glow')} />
          </Piece>
          <Piece
            vb={[0, 0, 60, 300]}
            style={{ [edge]: side, bottom: ch(1), height: ch(torchH), aspectRatio: '60 / 300' }}
          >
            <Torch u={url} delay={i ? '-3.1s' : '0s'} />
          </Piece>
          {card
            ? null
            : [0, 1, 2].map((k) => (
                <Piece
                  key={k}
                  vb={[0, 0, 10, 10]}
                  anim="rise"
                  style={{
                    [edge]: `calc(${side} + ${torchH * 0.1}cqh + ${cm([-1.6, 0.9, -0.4][k]!)})`,
                    bottom: `calc(${ch(1 + torchH * 0.98)} + ${cm(2 + k * 3)})`,
                    width: cm(1.1 - k * 0.2),
                    animationDelay: `${-(i * 1.3 + k * 3.1)}s`,
                  }}
                >
                  <circle cx="5" cy="5" r="5" fill="#FFB347" />
                </Piece>
              ))}
        </Fragment>
      ))}
      {/* foreground: leaves, flowers and a pineapple in the corners */}
      <Piece vb={[0, 0, 240, 220]} style={{ left: cm(-9), bottom: cm(-7), width: size(card ? 34 : 62, 46) }}>
        <g filter={url('soft')}>
          <Monstera x={58} y={214} s={1.15} deg={-30} u={url} />
          <Monstera x={150} y={232} s={0.95} deg={16} u={url} />
          <Hibiscus x={124} y={138} r={34} turn={8} />
          <Hibiscus x={200} y={182} r={23} turn={-20} />
          <Hibiscus x={40} y={176} r={18} turn={40} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 240, 220]}
        style={{ right: cm(-10), bottom: cm(-8), width: size(card ? 30 : 54, 42) }}
      >
        <g filter={url('soft')} transform="translate(240 0) scale(-1 1)">
          <Monstera x={86} y={228} s={1.1} deg={-14} u={url} />
          <Hibiscus x={150} y={156} r={30} turn={30} />
          <Hibiscus x={70} y={150} r={20} turn={-6} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 100, 170]}
        anim="wiggle"
        style={{
          right: `calc(${side} + ${cm(card ? 3 : 4)})`,
          bottom: ch(card ? 2 : 2.5),
          width: size(card ? 9 : 15, 12),
        }}
      >
        <Pineapple u={url} />
      </Piece>
      {/* palm fronds hanging from the top corners */}
      <Piece
        vb={[0, 0, 300, 240]}
        anim="sway"
        style={{
          left: cm(-6),
          top: cm(-6),
          width: size(card ? 44 : poster ? 58 : 72, 54),
          transformOrigin: '0 0',
        }}
      >
        <g filter={url('soft')}>
          <Canopy lush />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 300, 240]}
        anim="sway"
        style={{
          right: cm(-7),
          top: cm(-8),
          width: size(card ? 36 : poster ? 48 : 58, 44),
          transformOrigin: '100% 0',
          animationDelay: '-2.5s',
        }}
      >
        <g filter={url('soft')} transform="translate(300 0) scale(-1 1)">
          <Canopy lush={false} />
        </g>
      </Piece>
    </>
  );
}
