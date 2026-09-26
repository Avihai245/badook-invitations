import type { ReactNode } from 'react';
import { Layer, Piece, cm, cmh, r1, rng, useIds, type SceneAnim, type SceneProps } from './kit';

/**
 * Disco Ball — a mirror ball swinging on its chain over a glowing dance floor: hundreds of mirror
 * tiles catching pink, violet, gold and cyan light, rays thrown out into the room, glints twinkling on
 * the ball, two moving-head spotlights sweeping up from the floor, flecks of light on the walls, and
 * a floor of lit tiles in perspective that pulse. Confetti everywhere. The pink follows the accent.
 */
const PINK = 'var(--inv-accent, #FF4FB8)';
const VIOLET = '#9B6BFF';
const GOLD = '#FFC94D';
const CYAN = '#3FE0FF';
const PEARL = '#FFE3F4';
const LILAC = '#CDB6FF';

type Url = (name: string) => string;

// ── the mirror ball (viewBox 0 0 200 300: the chain from the top, the ball centred at 100,170) ──

const BALL = { cx: 100, cy: 170, r: 88 };
const SHADES = ['#2E2B44', '#4A4768', '#6E6B90', '#9A98B8', '#C8C7DE', '#EEEDFA'];
const TINTS = [PINK, VIOLET, GOLD, CYAN];

/** Mirror tiles in latitude bands, lit from the upper left; grouped by colour (one path each). */
const TILES = (() => {
  const rand = rng(11);
  const light = [-0.52, 0.6, 0.61];
  const paths = new Map<string, string>();
  const glints: [number, number][] = [];
  const bands = 16;
  for (let b = 0; b < bands; b++) {
    const p0 = -90 + (b * 180) / bands;
    const p1 = p0 + 180 / bands;
    const pm = ((p0 + p1) / 2) * (Math.PI / 180);
    const n = Math.max(6, Math.round(34 * Math.cos(pm)));
    const step = 360 / n;
    const shift = b % 2 ? step / 2 : 0;
    for (let j = -Math.ceil(n / 4) - 1; j <= Math.ceil(n / 4); j++) {
      const t0 = Math.max(-90, j * step + shift);
      const t1 = Math.min(90, (j + 1) * step + shift);
      if (t1 <= t0 + 0.5) continue;
      const pt = (p: number, t: number): [number, number] => {
        const pr = (p * Math.PI) / 180;
        const tr = (t * Math.PI) / 180;
        return [BALL.cx + BALL.r * Math.cos(pr) * Math.sin(tr), BALL.cy - BALL.r * Math.sin(pr)];
      };
      const quad = [pt(p0, t0), pt(p0, t1), pt(p1, t1), pt(p1, t0)];
      const mx = quad.reduce((s, [x]) => s + x, 0) / 4;
      const my = quad.reduce((s, [, y]) => s + y, 0) / 4;
      const inset = quad.map(([x, y]) => [r1(mx + (x - mx) * 0.84), r1(my + (y - my) * 0.84)] as const);
      const tm = (((t0 + t1) / 2) * Math.PI) / 180;
      const normal = [Math.cos(pm) * Math.sin(tm), Math.sin(pm), Math.cos(pm) * Math.cos(tm)];
      const lit = Math.max(0, normal[0]! * light[0]! + normal[1]! * light[1]! + normal[2]! * light[2]!);
      const v = Math.min(1, Math.max(0, 0.15 + 0.8 * lit + (rand() - 0.5) * 0.36));
      const roll = rand();
      let color = SHADES[Math.min(SHADES.length - 1, Math.floor(v * SHADES.length))]!;
      if (v > 0.93 && roll < 0.5) {
        color = '#FFFFFF';
        glints.push([r1(mx), r1(my)]);
      } else if (roll < 0.2) color = TINTS[Math.floor(rand() * TINTS.length)]!;
      paths.set(color, `${paths.get(color) ?? ''}M${inset.map(([x, y]) => `${x} ${y}`).join('L')}Z`);
    }
  }
  return { paths: [...paths], glints: glints.slice(0, 6) };
})();

const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

function MirrorBall({ u }: { u: Url }) {
  const { cx, cy, r } = BALL;
  return (
    <g>
      <path d={`M${cx} 0V${cy - r - 6}`} stroke="#B9B6CF" strokeWidth="2.4" />
      <path d={`M${cx} 0V${cy - r - 6}`} stroke="#fff" strokeWidth=".8" opacity=".5" />
      <rect x={cx - 9} y={cy - r - 12} width="18" height="12" rx="2" fill={u('cap')} />
      <circle cx={cx} cy={cy} r={r} fill="#1D1A2E" />
      {TILES.paths.map(([color, d]) => (
        <path key={color} d={d} style={{ fill: color }} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={u('shade')} />
      <ellipse cx={cx - 34} cy={cy - 38} rx="30" ry="20" fill={u('shine')} />
      {TILES.glints.map(([x, y], i) => (
        <path
          key={i}
          d={sparkle(x, y, i % 2 ? 11 : 16)}
          fill="#fff"
          data-anim="twinkle"
          style={{ animationDelay: `${(i * 0.47) % 2.8}s` }}
        />
      ))}
    </g>
  );
}

/** Rays thrown by the ball (viewBox -100 -100 200 200, the ball at the origin), fading outward. */
function Rays({ u, seed }: { u: Url; seed: number }) {
  const rand = rng(seed);
  const colors = [PINK, CYAN, GOLD, VIOLET, PEARL];
  return (
    <g mask={u('rays')}>
      {Array.from({ length: 16 }, (_, i) => {
        const a = ((i / 16) * 360 + rand() * 14) * (Math.PI / 180);
        const w = 0.012 + rand() * 0.02;
        const len = 100;
        const p = (da: number) => `${r1(Math.cos(a + da) * len)} ${r1(Math.sin(a + da) * len)}`;
        return (
          <path
            key={i}
            d={`M0 0L${p(-w)}L${p(w)}Z`}
            style={{ fill: colors[i % colors.length] }}
            opacity={0.35 + rand() * 0.3}
          />
        );
      })}
    </g>
  );
}

/**
 * The dance floor (viewBox 0 0 1600 240) in perspective: rows get shallower toward the far edge, the
 * lit tiles pulse in three groups.
 */
function Floor({ u }: { u: Url }) {
  const horizon = -120; // the vanishing line, above the floor's far edge
  const y = (z: number) => r1(horizon + (240 - horizon) / z);
  const x = (X: number, z: number) => 800 + X / z;
  const rows = 6;
  const far = (240 - horizon) / -horizon;
  const zs = Array.from({ length: rows + 1 }, (_, k) => 1 + (k * (far - 1)) / rows);
  const colors = [PINK, VIOLET, GOLD, CYAN, LILAC];
  const groups: ReactNode[][] = [[], [], []];
  for (let k = 0; k < rows; k++) {
    for (let j = -9; j < 9; j++) {
      const [za, zb] = [zs[k]!, zs[k + 1]!];
      const quad = [
        [x(j * 110, za), y(za)],
        [x((j + 1) * 110, za), y(za)],
        [x((j + 1) * 110, zb), y(zb)],
        [x(j * 110, zb), y(zb)],
      ];
      const mx = quad.reduce((s, [qx]) => s + qx!, 0) / 4;
      const my = quad.reduce((s, [, qy]) => s + qy!, 0) / 4;
      const d = `M${quad.map(([qx, qy]) => `${r1(mx + (qx! - mx) * 0.9)} ${r1(my + (qy! - my) * 0.86)}`).join('L')}Z`;
      const g = (((j + k) % 3) + 3) % 3;
      groups[g]!.push(
        <path
          key={`${j}.${k}`}
          d={d}
          style={{ fill: colors[(((j * 2 + k * 3) % 5) + 5) % 5] }}
          opacity={r1(0.84 - k * 0.1)}
        />,
      );
    }
  }
  return (
    <g>
      <rect width="1600" height="240" fill={u('floor')} />
      {groups.map((tiles, g) => (
        <g key={g} data-anim="pulse" style={{ animationDelay: `${-g * 1.07}s` }}>
          {tiles}
        </g>
      ))}
      <rect width="1600" height="240" fill={u('floorfade')} />
    </g>
  );
}

/** A moving head's cone from the lower left corner (viewBox 0 0 400 400), aimed up at the ball. */
function Cone({ u, color, id }: { u: Url; color: string; id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="260" y2="20">
          <stop offset="0" style={{ stopColor: color }} stopOpacity=".55" />
          <stop offset="1" style={{ stopColor: color }} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 400L214 -20L330 60Z" fill={`url(#${id})`} filter={u('soft')} />
    </g>
  );
}

const CONFETTI: readonly (readonly [number, number, number, number, SceneAnim | undefined])[] = [
  // x %, y %, colour index, rotation, loop
  [7, 8, 0, 24, 'float'],
  [17, 22, 2, -40, undefined],
  [26, 4, 3, 70, 'twinkle'],
  [36, 14, 1, -12, 'float'],
  [66, 12, 4, 38, undefined],
  [75, 5, 0, -62, 'twinkle'],
  [84, 20, 2, 15, 'float'],
  [93, 9, 1, -30, undefined],
  [5, 36, 3, 50, 'sway'],
  [95, 34, 0, -20, 'float'],
  [8, 52, 2, -48, 'twinkle'],
  [92, 55, 4, 60, undefined],
  [4, 66, 1, 10, 'float'],
  [96, 70, 3, -70, 'sway'],
  [22, 70, 0, 30, 'twinkle'],
  [78, 72, 2, -18, undefined],
];

export default function DiscoBall({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  // the ball's piece: 200 wide, 300 tall; its centre 170 down
  const ballW = card ? cm(26) : poster ? cmh(30) : cmh(40);
  // on the cover's card the envelope's opened flap hides the top middle: the ball hangs lower there
  const ballTop = card ? '36cqh' : '0px';
  const ballCy = `calc(${ballTop} + ${ballW} * 0.85)`;
  const floorH = card ? '32cqh' : '23cqh';
  const colors = [PINK, GOLD, CYAN, VIOLET, '#E9E6F5'];
  const rand = rng(3);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('cap')} x1="0" x2="1">
            <stop offset="0" stopColor="#6E6B90" />
            <stop offset=".45" stopColor="#F2F0FF" />
            <stop offset="1" stopColor="#4A4768" />
          </linearGradient>
          <radialGradient id={ref('shade')} cx=".42" cy=".38" r=".62">
            <stop offset=".55" stopColor="#140A22" stopOpacity="0" />
            <stop offset="1" stopColor="#140A22" stopOpacity=".72" />
          </radialGradient>
          <radialGradient id={ref('shine')}>
            <stop offset="0" stopColor="#fff" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ref('raysfade')}>
            <stop offset=".08" stopColor="#fff" stopOpacity="0" />
            <stop offset=".2" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={ref('rays')} maskContentUnits="userSpaceOnUse">
            <circle r="100" fill={url('raysfade')} />
          </mask>
          <linearGradient id={ref('floor')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#12071F" />
            <stop offset="1" stopColor="#2A0C3A" />
          </linearGradient>
          <linearGradient id={ref('floorfade')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#12071F" stopOpacity=".95" />
            <stop offset=".45" stopColor="#12071F" stopOpacity=".2" />
            <stop offset="1" stopColor="#12071F" stopOpacity="0" />
          </linearGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'radial-gradient(46cqmin 34cqmin at 50% 12%, rgba(255,214,160,.2), transparent 70%),' +
            'radial-gradient(70cqmin 60cqmin at 0% 58%, color-mix(in srgb, var(--inv-accent, #FF4FB8) 24%, transparent), transparent 70%),' +
            'radial-gradient(70cqmin 60cqmin at 100% 44%, rgba(155,107,255,.24), transparent 70%),' +
            'linear-gradient(180deg, #1E0B33 0%, #2A0E45 42%, #1C0A30 74%, #12071F 100%)',
        }}
      />
      {/* flecks of light thrown on the walls */}
      {Array.from({ length: card ? 18 : 34 }, (_, i) => {
        const rx = rand() * 100;
        const y = r1(rand() * 74);
        // the names' band keeps its flecks at the very edges
        const band = y > 28 && y < 70;
        const x = r1(band ? (rx < 50 ? rx / 12 : 96 + (rx - 50) / 14) : rx);
        const s = r1(0.7 + rand() * 0.9);
        return (
          <span
            key={i}
            data-anim={i % 3 ? 'twinkle' : undefined}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: cm(s),
              aspectRatio: '1',
              borderRadius: '50%',
              background: colors[i % colors.length],
              opacity: 0.85,
              boxShadow: `0 0 ${cm(s * 1.6)} ${colors[i % colors.length]}`,
              animationDelay: `${r1(rand() * 2.8)}s`,
            }}
          />
        );
      })}
      {/* moving heads from the floor's corners */}
      <Piece
        vb={[0, 0, 400, 400]}
        anim="sweep"
        style={{
          left: 0,
          bottom: `calc(${floorH} - 4cqh)`,
          width: cm(card ? 50 : 78),
          transformOrigin: '0 100%',
        }}
      >
        <Cone u={url} color={CYAN} id={ref('coneL')} />
      </Piece>
      <Piece
        vb={[0, 0, 400, 400]}
        anim="sweep"
        style={{
          right: 0,
          bottom: `calc(${floorH} - 4cqh)`,
          width: cm(card ? 50 : 78),
          transformOrigin: '100% 100%',
          animationDirection: 'alternate-reverse',
        }}
      >
        <g transform="matrix(-1 0 0 1 400 0)">
          <Cone u={url} color="var(--inv-accent, #FF4FB8)" id={ref('coneR')} />
        </g>
      </Piece>
      {/* the rays, turning with the ball */}
      <Piece
        vb={[-100, -100, 200, 200]}
        anim="sweep"
        style={{
          left: '50%',
          top: ballCy,
          width: cm(card ? 90 : 150),
          translate: '-50% -50%',
          transformOrigin: '50% 50%',
        }}
      >
        <Rays u={url} seed={5} />
      </Piece>
      {/* the dance floor */}
      <Piece
        vb={[0, 0, 1600, 240]}
        fit="xMidYMin slice"
        style={{ left: 0, bottom: 0, width: '100%', height: floorH, aspectRatio: 'auto' }}
      >
        <Floor u={url} />
      </Piece>
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          width: '100%',
          bottom: `calc(${floorH} - 1.2cqh)`,
          height: '2.4cqh',
          background: `radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--inv-accent, #FF4FB8) 55%, transparent), transparent)`,
          opacity: 0.8,
        }}
      />
      {/* confetti */}
      {CONFETTI.filter((_, i) => !card || i % 2 === 0).map(([x, y, c, rot, anim], i) => (
        <Piece
          key={i}
          vb={[0, 0, 20, 20]}
          anim={anim}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: cm(card ? 2.2 : 3),
            rotate: `${rot}deg`,
            animationDelay: `${(i * 0.37) % 2.8}s`,
          }}
        >
          {i % 3 === 2 ? (
            <circle cx="10" cy="10" r="5" style={{ fill: colors[c] }} />
          ) : (
            <rect x="2" y="7" width="16" height="6" rx="1" style={{ fill: colors[c] }} />
          )}
        </Piece>
      ))}
      {/* the mirror ball on its chain, swinging from the ceiling */}
      <Piece
        vb={[0, 0, 200, 300]}
        anim="swing"
        style={{ left: '50%', top: ballTop, width: ballW, translate: '-50% 0' }}
      >
        <MirrorBall u={url} />
      </Piece>
      {/* sparkles around the ball */}
      {(
        [
          [-0.62, 0.62, 5.5, 0],
          [0.66, 0.46, 4.2, 1.1],
          [0.52, 1.02, 3.2, 0.6],
          [-0.5, 1.06, 3.6, 1.8],
        ] as const
      ).map(([dx, dy, s, delay], i) => (
        <Piece
          key={i}
          vb={[-10, -10, 20, 20]}
          anim="twinkle"
          style={{
            left: `calc(50% + ${ballW} * ${dx})`,
            top: `calc(${ballTop} + ${ballW} * ${dy})`,
            width: cm(card ? s * 0.6 : s),
            translate: '-50% -50%',
            animationDelay: `${delay}s`,
          }}
        >
          <path d={sparkle(0, 0, 10)} fill="#fff" />
        </Piece>
      ))}
    </>
  );
}
