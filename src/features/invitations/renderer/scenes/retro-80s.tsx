import type { ReactNode } from 'react';
import { Layer, Piece, cm, cmh, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Retro 80s — a synthwave sunset: a striped sun sinking behind pink-rimmed wireframe mountains, a
 * glowing grid running to the horizon with the sun's reflection on it, two palms swaying in
 * silhouette, a cassette whose reels turn, chrome sparkles and a sky full of twinkling stars. The
 * grid, the mountains' rims and the cassette's stripe follow the accent.
 */
const PINK = 'var(--inv-accent, #FF4FA3)';
const ORANGE = '#FF9A3C';
const YELLOW = '#FFE45C';
const NIGHT = '#0B0320';

type Url = (name: string) => string;

/** The sun's upper half (viewBox -100 -100 200 100), cut by stripes that widen toward the horizon. */
function Sun({ u }: { u: Url }) {
  return <circle cx="0" cy="0" r="100" fill={u('sun')} mask={u('stripes')} />;
}

/** Wireframe mountains either side of the sun (viewBox 0 0 2400 120), the middle left open. */
function Mountains({ u }: { u: Url }) {
  const ranges = [
    [
      0, 120, 90, 78, 180, 96, 260, 58, 350, 88, 430, 70, 520, 98, 610, 44, 700, 84, 790, 60, 880, 100, 960,
      76, 1040, 120,
    ],
    [
      1360, 120, 1440, 80, 1530, 104, 1610, 62, 1700, 92, 1790, 40, 1880, 86, 1960, 66, 2050, 98, 2140, 56,
      2230, 90, 2320, 74, 2400, 120,
    ],
  ];
  return (
    <g>
      {ranges.map((pts, i) => {
        const xy = Array.from({ length: pts.length / 2 }, (_, k) => [pts[2 * k]!, pts[2 * k + 1]!] as const);
        const ridge = xy.map(([x, y]) => `${x} ${y}`).join('L');
        const wires: string[] = [];
        xy.forEach(([x, y], k) => {
          if (k === 0 || k === xy.length - 1 || y > 90) return;
          wires.push(`M${x} ${y}L${x - 30} 120M${x} ${y}L${x + 26} 120`);
        });
        return (
          <g key={i}>
            <path d={`M${ridge}Z`} fill={u('mountain')} />
            <path d={wires.join('')} fill="none" style={{ stroke: PINK }} strokeWidth="1" opacity=".35" />
            <path d={`M${ridge}`} fill="none" style={{ stroke: PINK }} strokeWidth="2.4" filter={u('glow')} />
          </g>
        );
      })}
    </g>
  );
}

/** The grid (viewBox 0 0 1600 240), horizon at the top, with the sun's reflection. */
function Grid({ u }: { u: Url }) {
  const vp = -70;
  const lines: ReactNode[] = [];
  for (let j = -34; j <= 34; j++)
    lines.push(<path key={`v${j}`} d={`M${r1(800 + (j * 90 * -vp) / (240 - vp))} 0L${800 + j * 90} 240`} />);
  for (let k = 1; k <= 8; k++) {
    const y = r1(vp + (240 - vp) / (1 + (k - 1) * 0.5));
    if (y > 0) lines.push(<path key={`h${k}`} d={`M0 ${y}H1600`} strokeWidth={r1(1 + y / 90)} />);
  }
  return (
    <g>
      <rect width="1600" height="240" fill={u('floor')} />
      <ellipse cx="800" cy="0" rx="300" ry="230" fill={u('reflect')} />
      <g fill="none" style={{ stroke: PINK }} strokeWidth="1.6" filter={u('glow')}>
        {lines}
      </g>
      <rect width="1600" height="240" fill={u('haze')} />
    </g>
  );
}

/** A palm in silhouette (viewBox 0 0 220 440), trunk from the bottom left, crown at 124,118. */
function Palm() {
  const crown: [number, number] = [124, 118];
  const fronds = [
    [196, 118, 30],
    [214, 104, 26],
    [242, 92, 18],
    [272, 86, 8],
    [304, 96, -14],
    [330, 108, -26],
    [356, 116, -34],
  ] as const;
  const frond = (deg: number, len: number, droop: number) => {
    const a = (deg * Math.PI) / 180;
    const [cx, cy] = crown;
    const ex = cx + Math.cos(a) * len;
    const ey = cy + Math.sin(a) * len + Math.abs(droop) * 1.6;
    const mx = cx + Math.cos(a) * len * 0.5;
    const my = cy + Math.sin(a) * len * 0.5 - Math.abs(droop) * 0.6;
    // the spine, then leaflets hanging from it
    const pt = (t: number) => [
      (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex,
      (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey,
    ];
    let d = `M${r1(cx)} ${r1(cy)}Q${r1(mx)} ${r1(my)} ${r1(ex)} ${r1(ey)}`;
    for (let t = 0.12; t < 0.98; t += 0.09) {
      const [px, py] = pt(t) as [number, number];
      const [qx, qy] = pt(t + 0.07) as [number, number];
      const leaf = (1 - t) * 26 + 6;
      d += `M${r1(px)} ${r1(py)}L${r1(qx + Math.cos(a + 1.9) * leaf * 0.3)} ${r1(qy + leaf)}L${r1(qx)} ${r1(qy)}Z`;
    }
    return d;
  };
  return (
    <g fill={NIGHT} stroke={NIGHT} strokeLinejoin="round">
      <path d="M58 440C64 360 84 250 116 126L130 128C104 250 86 360 82 440Z" stroke="none" />
      {[400, 360, 320, 282, 246, 212, 180, 150].map((y, i) => (
        <path key={y} d={`M${r1(60 + i * 7.2)} ${y}l${r1(22 - i * 0.6)} -4`} strokeWidth="2.6" opacity=".7" />
      ))}
      {fronds.map(([deg, len, droop]) => (
        <path key={deg} d={frond(deg, len, droop)} strokeWidth="3" />
      ))}
      <circle cx={crown[0]} cy={crown[1] + 4} r="9" stroke="none" />
    </g>
  );
}

/** A cassette (viewBox 0 0 200 128): a striped label, a window whose reels turn. */
function Cassette({ u }: { u: Url }) {
  const reel = (x: number, tape: number) => (
    <g>
      <circle cx={x} cy="51" r={tape} fill="#4A2E24" clipPath={u('window')} />
      <g data-anim="turn">
        <circle cx={x} cy="51" r="10" fill="#EEEAF6" />
        <circle cx={x} cy="51" r="5.4" fill="#1B1628" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect
            key={a}
            x={x - 1.2}
            y="41.6"
            width="2.4"
            height="4"
            fill="#1B1628"
            transform={`rotate(${a} ${x} 51)`}
          />
        ))}
      </g>
    </g>
  );
  return (
    <g filter={u('drop')}>
      <rect x="0" y="0" width="200" height="128" rx="9" fill={u('shell')} />
      <rect x="12" y="10" width="176" height="70" rx="5" fill="#F4F0FB" />
      <rect x="12" y="18" width="176" height="7" style={{ fill: PINK }} />
      <rect x="12" y="25" width="176" height="6" fill={ORANGE} />
      <rect x="12" y="31" width="176" height="5" fill={YELLOW} />
      <path d="M24 70H90M110 70H176" stroke="#8C84A8" strokeWidth="1.2" />
      <rect x="52" y="37" width="96" height="28" rx="13" fill="#140F22" />
      {reel(78, 19)}
      {reel(122, 13)}
      <rect x="52" y="37" width="96" height="28" rx="13" fill="none" stroke={u('chrome')} strokeWidth="2" />
      <path d="M40 128L52 98H148L160 128Z" fill="#2E2645" />
      {[68, 88, 112, 132].map((x) => (
        <circle key={x} cx={x} cy="114" r="3.4" fill="#0F0B1A" />
      ))}
      {[
        [8, 8],
        [192, 8],
        [8, 120],
        [192, 120],
        [100, 92],
      ].map(([x, y]) => (
        <circle key={`${x}.${y}`} cx={x} cy={y} r="3" fill={u('chrome')} />
      ))}
    </g>
  );
}

const sparkle = (s: number) => `M0 ${-s}Q0 0 ${s} 0Q0 0 0 ${s}Q0 0 ${-s} 0Q0 0 0 ${-s}Z`;

export default function Retro80s({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const hero = place === 'hero';
  const floorH = card ? '30cqh' : '21cqh';
  // the sun's top stays below the names: at most a fifth of the height across on a landscape
  const sunW = card ? cm(40) : 'min(46cqmin, 20cqh)';
  const palmW = card ? cm(22) : 'min(40cqmin, 34cqh)';
  const rand = rng(8);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('sun')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={YELLOW} />
            <stop offset=".45" stopColor={ORANGE} />
            <stop offset="1" style={{ stopColor: PINK }} />
          </linearGradient>
          <mask id={ref('stripes')} maskContentUnits="userSpaceOnUse">
            <rect x="-100" y="-100" width="200" height="100" fill="#fff" />
            {[
              [-50, 3],
              [-38, 4.5],
              [-26, 6],
              [-14, 8],
            ].map(([y, h]) => (
              <rect key={y} x="-100" y={y} width="200" height={h} fill="#000" />
            ))}
          </mask>
          <linearGradient id={ref('mountain')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3A1060" />
            <stop offset="1" stopColor="#16062C" />
          </linearGradient>
          <linearGradient id={ref('floor')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2A0848" />
            <stop offset="1" stopColor="#12042A" />
          </linearGradient>
          <radialGradient id={ref('reflect')}>
            <stop offset="0" stopColor={ORANGE} stopOpacity=".5" />
            <stop offset=".45" style={{ stopColor: PINK }} stopOpacity=".2" />
            <stop offset="1" style={{ stopColor: PINK }} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ref('haze')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2A0848" stopOpacity=".85" />
            <stop offset=".35" stopColor="#2A0848" stopOpacity=".15" />
            <stop offset="1" stopColor="#12042A" stopOpacity=".1" />
          </linearGradient>
          <linearGradient id={ref('shell')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3A3052" />
            <stop offset="1" stopColor="#1C1630" />
          </linearGradient>
          <linearGradient id={ref('chrome')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".5" stopColor="#B9C3E6" />
            <stop offset=".52" stopColor="#6B5A9E" />
            <stop offset="1" stopColor="#E8D8FF" />
          </linearGradient>
          <clipPath id={ref('window')}>
            <rect x="52" y="37" width="96" height="28" rx="13" />
          </clipPath>
          <filter id={ref('glow')} x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ref('drop')} x="-10%" y="-10%" width="120%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#05010F" floodOpacity=".5" />
          </filter>
        </defs>
      </svg>
      {/* the sky: indigo night down to a hot horizon */}
      <Layer
        style={{
          background:
            `radial-gradient(70cqw 22cqh at 50% calc(100% - ${floorH}), color-mix(in srgb, var(--inv-accent, #FF4FA3) 55%, transparent), transparent 70%),` +
            'linear-gradient(180deg, #0D0526 0%, #1C0840 34%, #33104F 58%, #5E1466 70%, #A8246E 76%, #E24A6A 79%, #2A0848 79.2%)',
        }}
      />
      {/* stars */}
      {Array.from({ length: card ? 22 : 40 }, (_, i) => {
        const x = r1(rand() * 100);
        const y = r1(rand() * 62);
        const s = r1(0.35 + rand() * 0.55);
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
              background: i % 5 ? '#FFFFFF' : '#FFB8E0',
              opacity: 0.4 + rand() * 0.5,
              animationDelay: `${r1(rand() * 2.8)}s`,
            }}
          />
        );
      })}
      {/* the sun and its glow, on the horizon */}
      <Layer
        anim="pulse"
        style={{
          inset: 'auto',
          left: '50%',
          bottom: floorH,
          width: `calc(${sunW} * 1.8)`,
          aspectRatio: '2',
          translate: '-50% 0',
          background: `radial-gradient(50% 100% at 50% 100%, color-mix(in srgb, ${ORANGE} 50%, transparent), transparent 70%)`,
        }}
      />
      <Piece
        vb={[-100, -100, 200, 100]}
        style={{ left: '50%', bottom: floorH, width: sunW, translate: '-50% 0' }}
      >
        <Sun u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 2400, 120]}
        fit="xMidYMax slice"
        style={{
          left: 0,
          bottom: `calc(${floorH} - 1px)`,
          width: '100%',
          height: card ? cm(12) : cmh(15),
          aspectRatio: 'auto',
        }}
      >
        <Mountains u={url} />
      </Piece>
      {/* the grid, running to the horizon */}
      <Piece
        vb={[0, 0, 1600, 240]}
        fit="xMidYMin slice"
        style={{ left: 0, bottom: 0, width: '100%', height: floorH, aspectRatio: 'auto' }}
      >
        <Grid u={url} />
      </Piece>
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          width: '100%',
          bottom: `calc(${floorH} - 0.2cqh)`,
          height: '0.4cqh',
          background: `linear-gradient(90deg, transparent, ${ORANGE} 30%, ${YELLOW} 50%, ${ORANGE} 70%, transparent)`,
          boxShadow: `0 0 2cqmin 0.4cqmin color-mix(in srgb, var(--inv-accent, #FF4FA3) 70%, transparent)`,
        }}
      />
      {/* palms in silhouette */}
      <Piece
        vb={[0, 0, 220, 440]}
        anim="sway"
        style={{ left: card ? '-2cqw' : '-5cqw', bottom: 0, width: palmW }}
      >
        <Palm />
      </Piece>
      <Piece
        vb={[0, 0, 220, 440]}
        anim="sway"
        flip
        style={{
          right: card ? '-2cqw' : '-6cqw',
          bottom: 0,
          width: `calc(${palmW} * .82)`,
          animationDirection: 'alternate-reverse',
        }}
      >
        <Palm />
      </Piece>
      {/* the cassette, floating */}
      <Piece
        vb={[0, 0, 200, 128]}
        anim="float"
        style={{
          right: card ? '6cqw' : '7cqw',
          top: card ? '8cqh' : hero ? 'max(10cqh, 76px)' : '8cqh',
          width: card ? cm(22) : cmh(30),
          rotate: '10deg',
        }}
      >
        <Cassette u={url} />
      </Piece>
      {/* chrome sparkles and a shooting star */}
      <Piece
        vb={[0, 0, 200, 60]}
        anim="twinkle"
        style={{
          left: '6cqw',
          top: card ? '10cqh' : hero ? 'max(12cqh, 96px)' : '10cqh',
          width: cm(card ? 18 : 30),
          rotate: '-18deg',
        }}
      >
        <path d="M6 30L170 30" stroke={url('streak')} strokeWidth="3.2" strokeLinecap="round" />
        <g transform="translate(174 30)">
          <path d={sparkle(14)} fill="#fff" />
        </g>
        <defs>
          {/* user space: a horizontal line has no height for a bounding-box gradient */}
          <linearGradient id={ref('streak')} gradientUnits="userSpaceOnUse" x1="6" x2="170" y1="30" y2="30">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
        </defs>
      </Piece>
      {(
        [
          [30, 24, 3.6, 0.4],
          [70, 34, 2.8, 1.5],
          [18, 56, 2.4, 2.2],
          [84, 60, 3, 0.9],
        ] as const
      ).map(([x, y, s, delay]) => (
        <Piece
          key={x}
          vb={[-10, -10, 20, 20]}
          anim="twinkle"
          style={{ left: `${x}%`, top: `${y}%`, width: cm(card ? s * 0.6 : s), animationDelay: `${delay}s` }}
        >
          <path d={sparkle(10)} fill={url('chrome')} />
        </Piece>
      ))}
    </>
  );
}
