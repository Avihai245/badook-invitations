import { Layer, Piece, ch, cm, cmh, polar, r1, useIds, type SceneProps } from './kit';

/**
 * Majolica Summer — the Amalfi coast: a striped awning with a scalloped edge at the top, lemon
 * branches with glossy leaves, citrus slices, and two rows of hand-painted quatrefoil tiles at the
 * bottom. The cobalt follows the accent (terracotta / olive presets repaint awning and tiles).
 */
const COBALT = 'var(--inv-accent, #2F55B5)';
const COBALT_DEEP = 'color-mix(in srgb, var(--inv-accent, #2F55B5) 70%, #0B1640)';
const LEMON = '#F4C430';
const LEMON_DEEP = '#E0A21A';
const ORANGE = '#F28C28';
const LEAF = '#5E8C3A';
const LEAF_DEEP = '#3F6A26';
const CREAM = '#FFFDF7';

type Url = (name: string) => string;

function Lemon({ x, y, s, deg = 0, u }: { x: number; y: number; s: number; deg?: number; u: Url }) {
  // a lemon lying along x: full in the middle, drawn out to a nub at each end
  const P = (dx: number, dy: number) => `${r1(x + dx * s)} ${r1(y + dy * s)}`;
  const body =
    `M${P(-1.1, 0)}C${P(-0.98, -0.3)} ${P(-0.72, -0.8)} ${P(0, -0.8)}` +
    `C${P(0.72, -0.8)} ${P(0.98, -0.3)} ${P(1.1, 0)}` +
    `C${P(0.98, 0.3)} ${P(0.72, 0.8)} ${P(0, 0.8)}` +
    `C${P(-0.72, 0.8)} ${P(-0.98, 0.3)} ${P(-1.1, 0)}Z`;
  return (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <path d={body} fill={u('lemon')} />
      <ellipse cx={r1(x + s * 1.12)} cy={y} rx={r1(s * 0.12)} ry={r1(s * 0.09)} fill={LEMON_DEEP} />
      <ellipse
        cx={r1(x - s * 1.1)}
        cy={y}
        rx={r1(s * 0.08)}
        ry={r1(s * 0.07)}
        fill={LEMON_DEEP}
        opacity=".8"
      />
      <ellipse
        cx={r1(x - s * 0.28)}
        cy={r1(y - s * 0.4)}
        rx={r1(s * 0.36)}
        ry={r1(s * 0.13)}
        fill="#fff"
        opacity=".45"
        transform={`rotate(-8 ${x} ${y})`}
      />
      {/* pores */}
      {[
        [0.35, 0.3],
        [0.55, -0.1],
        [-0.1, 0.45],
        [0.15, 0.05],
      ].map(([dx, dy], i) => (
        <circle
          key={i}
          cx={r1(x + dx! * s)}
          cy={r1(y + dy! * s)}
          r={r1(s * 0.03)}
          fill={LEMON_DEEP}
          opacity=".35"
        />
      ))}
    </g>
  );
}

function Leaf({ x, y, len, deg }: { x: number; y: number; len: number; deg: number }) {
  const [tx, ty] = polar(x, y, len, deg);
  const [ax, ay] = polar(x, y, len * 0.5, deg - 22);
  const [bx, by] = polar(x, y, len * 0.5, deg + 22);
  return (
    <g>
      <path d={`M${x} ${y}Q${ax} ${ay} ${tx} ${ty}Q${bx} ${by} ${x} ${y}Z`} fill={LEAF} />
      <path
        d={`M${x} ${y}Q${ax} ${ay} ${tx} ${ty}Q${r1((x + tx) / 2)} ${r1((y + ty) / 2)} ${x} ${y}Z`}
        fill={LEAF_DEEP}
        opacity=".55"
      />
      <path d={`M${x} ${y}L${tx} ${ty}`} stroke="#9CC271" strokeWidth={r1(len * 0.02)} opacity=".6" />
    </g>
  );
}

/** A branch with lemons and leaves hanging from the top-left (viewBox 0 0 260 220). */
function Branch({ u }: { u: Url }) {
  return (
    <g filter={u('soft')}>
      <path
        d="M-10 20C60 30 110 60 150 110"
        stroke="#6B4E2E"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M70 38C90 60 100 80 104 112"
        stroke="#6B4E2E"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <Leaf x={20} y={24} len={62} deg={-30} />
      <Leaf x={48} y={30} len={70} deg={70} />
      <Leaf x={86} y={50} len={66} deg={-10} />
      <Leaf x={120} y={78} len={64} deg={110} />
      <Leaf x={140} y={98} len={58} deg={20} />
      <Leaf x={100} y={90} len={52} deg={160} />
      <Lemon x={110} y={138} s={30} deg={80} u={u} />
      <Lemon x={160} y={142} s={34} deg={100} u={u} />
      <Lemon x={62} y={96} s={24} deg={70} u={u} />
      <Leaf x={150} y={112} len={48} deg={-40} />
    </g>
  );
}

/** A citrus slice. */
function Slice({ x, y, r, color = LEMON }: { x: number; y: number; r: number; color?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={x} cy={y} r={r1(r * 0.86)} fill="#FFF6CF" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = i * 45;
        const [ax, ay] = polar(x, y, r * 0.78, a + 4);
        const [bx, by] = polar(x, y, r * 0.78, a + 41);
        return (
          <path
            key={i}
            d={`M${x} ${y}L${ax} ${ay}Q${polar(x, y, r * 0.86, a + 22.5).join(' ')} ${bx} ${by}Z`}
            fill={color}
            opacity=".85"
          />
        );
      })}
      <circle cx={x} cy={y} r={r1(r * 0.1)} fill="#FFF6CF" />
    </g>
  );
}

export default function Majolica({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const stripe = card ? '5cqmin' : '7cqmin';
  const awning = card ? '9cqh' : '8.5cqh';
  // two rows of tiles along the foot (capped on a landscape hero, where they would reach the text)
  const tiles = card ? cm(26) : cmh(28);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('lemon')} cx=".38" cy=".32" r=".75">
            <stop offset="0" stopColor="#FFE680" />
            <stop offset=".6" stopColor={LEMON} />
            <stop offset="1" stopColor={LEMON_DEEP} />
          </radialGradient>
          <filter id={ref('soft')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="#1D2F6F" floodOpacity=".2" />
          </filter>
          <pattern id={ref('tile')} width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill={CREAM} />
            <rect
              x="1.5"
              y="1.5"
              width="97"
              height="97"
              fill="none"
              style={{ stroke: COBALT }}
              strokeWidth="3"
            />
            {[0, 90, 180, 270].map((a) => {
              const [x, y] = polar(50, 50, 17, a);
              return <circle key={a} cx={x} cy={y} r="15" style={{ fill: COBALT }} />;
            })}
            <circle cx="50" cy="50" r="13" fill={LEMON} />
            <circle cx="50" cy="50" r="6" fill={ORANGE} />
            {[45, 135, 225, 315].map((a) => {
              const [x, y] = polar(50, 50, 33, a);
              return <path key={a} d={`M${x} ${y}m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0`} fill={LEMON} />;
            })}
            {[
              [0, 0],
              [100, 0],
              [0, 100],
              [100, 100],
            ].map(([x, y]) => (
              <g key={`${x}${y}`}>
                <circle cx={x} cy={y} r="17" style={{ fill: COBALT_DEEP }} />
                <circle cx={x} cy={y} r="8" fill={LEAF} />
              </g>
            ))}
          </pattern>
        </defs>
      </svg>
      {/* the awning: stripes, a scalloped edge and its shadow */}
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          top: 0,
          width: '100%',
          height: awning,
          background: `repeating-linear-gradient(90deg, ${COBALT} 0 ${stripe}, ${CREAM} ${stripe} calc(2 * ${stripe}))`,
          boxShadow: '0 1px 0 rgba(0,0,0,.08)',
        }}
      />
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          top: awning,
          width: '100%',
          height: `calc(${stripe} / 2 + 1px)`,
          marginTop: '-1px',
          background:
            `radial-gradient(circle calc(${stripe} / 2) at calc(${stripe} / 2) 0, ${COBALT} 96%, transparent 100%) 0 0 / calc(2 * ${stripe}) 100% repeat-x,` +
            `radial-gradient(circle calc(${stripe} / 2) at calc(${stripe} / 2) 0, ${CREAM} 96%, transparent 100%) ${stripe} 0 / calc(2 * ${stripe}) 100% repeat-x`,
          filter: 'drop-shadow(0 6px 5px rgba(29,47,111,.18))',
        }}
      />
      <Piece
        vb={[0, 0, 260, 220]}
        anim="sway"
        style={{ left: cm(-4), top: `calc(${awning} - ${cm(2)})`, width: cm(card ? 34 : 50) }}
      >
        <Branch u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 260, 220]}
        style={{
          right: cm(-6),
          bottom: `calc(${tiles} - 2cqmin)`,
          width: cm(card ? 30 : 44),
          scale: '-1 -1',
        }}
      >
        <Branch u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 200, 100]}
        style={{ left: cm(4), bottom: `calc(${tiles} + 2cqmin)`, width: cm(card ? 14 : 22) }}
      >
        <g filter={url('soft')}>
          <Slice x={50} y={56} r={34} />
          <Slice x={132} y={40} r={26} color={ORANGE} />
        </g>
      </Piece>
      {/* the tiles */}
      <Piece
        vb={[0, 0, 1400, 200]}
        fit="xMidYMin slice"
        style={{ left: 0, bottom: 0, width: '100%', height: tiles }}
      >
        <rect x="0" y="0" width="1400" height="200" fill={url('tile')} />
        <rect x="0" y="0" width="1400" height="6" style={{ fill: COBALT }} />
      </Piece>
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          bottom: tiles,
          width: '100%',
          height: ch(6),
          background: 'linear-gradient(0deg, rgba(29,47,111,.12), transparent)',
        }}
      />
    </>
  );
}
