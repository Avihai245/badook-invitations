import type { CSSProperties } from 'react';
import { Layer, Piece, cm, cmh, useIds, type SceneProps } from './kit';

/**
 * Coquette Bow — powder pink satin: scalloped eyelet lace along the top and bottom, a big satin bow at
 * the crown with strands of pearls draped from its knot, cherries and a small bow at the foot, tiny
 * hearts. The satin follows the accent (cherry / lilac presets).
 */
const SATIN = 'color-mix(in srgb, var(--inv-accent, #B83D61) 45%, #F7C6D2)';
const SATIN_LIGHT = 'color-mix(in srgb, var(--inv-accent, #B83D61) 18%, #FFF1F4)';
const SATIN_DEEP = 'color-mix(in srgb, var(--inv-accent, #B83D61) 80%, #5A1426)';
const PEARL = '#FFFDF9';
const CHERRY = '#B83A4B';
const LACE = '#FFFFFF';

type Url = (name: string) => string;

/** The satin bow (viewBox 0 0 300 220), knot at (150, 80). */
function Bow({ u }: { u: Url }) {
  return (
    <g>
      <path d="M138 92C120 130 96 168 70 206l30-4 12 18c14-40 26-78 38-118z" fill={u('satin-tail')} />
      <path d="M162 92c18 38 42 76 68 114l-30-4-12 18c-14-40-26-78-38-118z" fill={u('satin-tail')} />
      <path d="M150 80C120 34 52 10 40 44c-10 30 40 58 110 44z" fill={u('satin')} />
      <path d="M150 80c30-46 98-70 110-36 10 30-40 58-110 44z" fill={u('satin')} />
      <path d="M150 80C124 48 74 32 62 50c26-2 56 10 88 30z" fill={SATIN_DEEP} opacity=".35" />
      <path d="M150 80c26-32 76-48 88-30-26-2-56 10-88 30z" fill={SATIN_DEEP} opacity=".35" />
      <path
        d="M58 40c10-10 34-8 58 6"
        stroke="#fff"
        strokeWidth="4"
        opacity=".55"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M242 40c-10-10-34-8-58 6"
        stroke="#fff"
        strokeWidth="4"
        opacity=".55"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="150" cy="82" rx="18" ry="20" fill={u('satin')} />
      <path d="M140 72c6-4 14-4 20 0" stroke="#fff" strokeWidth="3" opacity=".6" fill="none" />
      {[-1, 0, 1].map((i) => (
        <circle key={i} cx={150 + i * 9} cy={100} r="4.6" fill={u('pearl')} />
      ))}
    </g>
  );
}

/**
 * Pearls along a quadratic curve, drawn as round dashes of a non-scaling stroke: the strands stretch
 * with the screen, the pearls stay round and keep their size (`size`, `gap`: CSS lengths).
 */
function Strand({
  d,
  size,
  gap,
}: {
  d: [number, number, number, number, number, number];
  size: string;
  gap: string;
}) {
  const [x0, y0, cx, cy, x1, y1] = d;
  const path = `M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`;
  const dots = (width: string, color: string) => {
    const style: CSSProperties = {
      stroke: color,
      strokeWidth: width,
      strokeDasharray: `0 ${gap}`,
      strokeLinecap: 'round',
    };
    return <path d={path} fill="none" vectorEffect="non-scaling-stroke" style={style} />;
  };
  return (
    <g>
      {dots(size, '#E3D2CC')}
      {dots(`calc(${size} * .7)`, PEARL)}
    </g>
  );
}

/** One scallop of eyelet lace (hanging down), repeated along the top and the bottom. */
const LACE_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 46'>" +
    `<path d='M0 0H40V24A20 20 0 0 1 0 24Z' fill='${LACE}'/>` +
    "<g fill='none' stroke='#F3C6D0' stroke-width='1.4'><circle cx='20' cy='28' r='6'/>" +
    "<circle cx='9' cy='16' r='2.4'/><circle cx='31' cy='16' r='2.4'/>" +
    "<path d='M4 8h32' stroke-dasharray='2 3'/></g><circle cx='20' cy='28' r='2' fill='#F3C6D0'/></svg>",
)}")`;

function Cherries({ u }: { u: Url }) {
  return (
    <g>
      <path
        d="M60 12C54 40 40 60 30 76M60 12c4 30 14 50 30 60"
        stroke="#5E7A3A"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M60 12c14-10 30-8 38 2-14 8-28 8-38-2z" fill="#6E9A42" />
      <circle cx="30" cy="86" r="16" fill={u('cherry')} />
      <circle cx="90" cy="82" r="16" fill={u('cherry')} />
      <ellipse cx="24" cy="80" rx="4" ry="6" fill="#fff" opacity=".5" transform="rotate(-30 24 80)" />
      <ellipse cx="84" cy="76" rx="4" ry="6" fill="#fff" opacity=".5" transform="rotate(-30 84 76)" />
    </g>
  );
}

function Heart({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 8C-6 3-10 0-10-4a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-4 7-10 12z"
      style={{ fill: color }}
    />
  );
}

export default function CoquetteBow({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const lace = card ? 'min(12cqmin, 5.5cqh)' : 'min(10.5cqmin, 5.2cqh)';
  const pearl = card ? '1.7cqmin' : 'min(2.2cqmin, 1.25cqh)';
  const laceBand: CSSProperties = {
    inset: 'auto',
    left: 0,
    width: '100%',
    height: lace,
    background: `${LACE_TILE} 0 0 / auto 100% repeat-x`,
    filter: 'drop-shadow(0 0.8cqmin 0.8cqmin rgba(122,46,68,.22))',
  };
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('satin')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: SATIN_LIGHT }} />
            <stop offset=".45" style={{ stopColor: SATIN }} />
            <stop offset="1" style={{ stopColor: SATIN_DEEP }} />
          </linearGradient>
          <linearGradient id={ref('satin-tail')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: SATIN_DEEP }} />
            <stop offset=".5" style={{ stopColor: SATIN }} />
            <stop offset="1" style={{ stopColor: SATIN_DEEP }} />
          </linearGradient>
          <radialGradient id={ref('pearl')} cx=".35" cy=".3" r=".75">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".6" stopColor={PEARL} />
            <stop offset="1" stopColor="#E3D6D0" />
          </radialGradient>
          <radialGradient id={ref('cherry')} cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#E86A7A" />
            <stop offset=".6" stopColor={CHERRY} />
            <stop offset="1" stopColor="#6E1422" />
          </radialGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#7A2E44" floodOpacity=".25" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 3cqmin, rgba(255,255,255,0) 3cqmin 7cqmin),' +
            'radial-gradient(80cqw 60cqh at 50% 42%, rgba(255,246,248,.6), transparent 75%)',
        }}
      />
      <Layer style={{ ...laceBand, top: 0 }} />
      <Layer style={{ ...laceBand, bottom: 0, scale: '1 -1' }} />
      {/* pearls draped from the bow's knot to the corners */}
      <Piece
        vb={[0, 0, 400, 200]}
        fit="none"
        style={{ left: 0, top: lace, width: '100%', height: card ? '28cqh' : '22cqh' }}
      >
        <g filter={url('soft')}>
          <Strand d={[-10, 10, 100, 150, 200, 30]} size={pearl} gap={`calc(${pearl} * 1.45)`} />
          <Strand d={[200, 30, 300, 150, 410, 10]} size={pearl} gap={`calc(${pearl} * 1.45)`} />
          <Strand
            d={[-10, 50, 90, 190, 200, 44]}
            size={`calc(${pearl} * .72)`}
            gap={`calc(${pearl} * 1.1)`}
          />
          <Strand
            d={[200, 44, 310, 190, 410, 50]}
            size={`calc(${pearl} * .72)`}
            gap={`calc(${pearl} * 1.1)`}
          />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 300, 220]}
        anim="sway"
        style={{
          left: '50%',
          top: `calc(${lace} - 2cqmin)`,
          width: card ? cm(30) : cmh(46),
          translate: '-50% 0',
        }}
      >
        <g filter={url('soft')}>
          <Bow u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 120, 110]}
        style={{
          left: cm(card ? 5 : 6),
          bottom: `calc(${lace} + 1cqmin)`,
          width: cm(card ? 12 : 18),
          rotate: '-8deg',
        }}
      >
        <g filter={url('soft')}>
          <Cherries u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 300, 220]}
        style={{
          right: cm(card ? 5 : 6),
          bottom: `calc(${lace} + 2cqmin)`,
          width: cm(card ? 14 : 20),
          rotate: '10deg',
        }}
      >
        <g filter={url('soft')}>
          <Bow u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 100, 300]} style={{ left: cm(4), top: '38%', width: cm(card ? 4 : 6) }}>
        {[
          [30, 20, 1.2],
          [66, 90, 0.8],
          [34, 170, 1],
          [60, 260, 0.7],
        ].map(([x, y, s], i) => (
          <Heart key={i} x={x!} y={y!} s={s!} color={i % 2 ? '#fff' : SATIN} />
        ))}
      </Piece>
      <Piece vb={[0, 0, 100, 300]} style={{ right: cm(4), top: '36%', width: cm(card ? 4 : 6) }}>
        {[
          [60, 30, 0.9],
          [30, 120, 1.2],
          [64, 210, 0.8],
        ].map(([x, y, s], i) => (
          <Heart key={i} x={x!} y={y!} s={s!} color={i % 2 ? SATIN : '#fff'} />
        ))}
      </Piece>
    </>
  );
}
