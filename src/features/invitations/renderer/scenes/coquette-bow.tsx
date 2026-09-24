import { Layer, Piece, cm, r1, useIds, type SceneProps } from './kit';

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
      <path d="M58 40c10-10 34-8 58 6" stroke="#fff" strokeWidth="4" opacity=".55" fill="none" strokeLinecap="round" />
      <path d="M242 40c-10-10-34-8-58 6" stroke="#fff" strokeWidth="4" opacity=".55" fill="none" strokeLinecap="round" />
      <ellipse cx="150" cy="82" rx="18" ry="20" fill={u('satin')} />
      <path d="M140 72c6-4 14-4 20 0" stroke="#fff" strokeWidth="3" opacity=".6" fill="none" />
      {[-1, 0, 1].map((i) => (
        <circle key={i} cx={150 + i * 9} cy={100} r="4.6" fill={u('pearl')} />
      ))}
    </g>
  );
}

/** Pearls along a quadratic curve. */
function Strand({ d, n, r, u }: { d: [number, number, number, number, number, number]; n: number; r: number; u: Url }) {
  const [x0, y0, cx, cy, x1, y1] = d;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
        const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1;
        return <circle key={i} cx={r1(x)} cy={r1(y)} r={r} fill={u('pearl')} />;
      })}
    </g>
  );
}

/** Scalloped eyelet lace (viewBox 0 0 400 60), scallops hanging down. */
function Lace() {
  const scallops = Array.from({ length: 10 }, (_, i) => i * 40);
  return (
    <g>
      <path d={`M0 0H400V24${scallops.map((x) => `A20 20 0 0 1 ${400 - x - 40} 24`).join('')}Z`} fill={LACE} />
      {scallops.map((x) => (
        <g key={x} fill="none" stroke="#F3C6D0" strokeWidth="1.4">
          <circle cx={x + 20} cy="28" r="6" />
          <circle cx={x + 20} cy="28" r="2" fill="#F3C6D0" stroke="none" />
          {[-1, 1].map((s) => (
            <circle key={s} cx={x + 20 + s * 11} cy="16" r="2.4" />
          ))}
          <path d={`M${x + 4} 8h32`} strokeDasharray="2 3" />
        </g>
      ))}
    </g>
  );
}

function Cherries({ u }: { u: Url }) {
  return (
    <g>
      <path d="M60 12C54 40 40 60 30 76M60 12c4 30 14 50 30 60" stroke="#5E7A3A" strokeWidth="3" fill="none" strokeLinecap="round" />
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
  const lace = card ? '5.5cqh' : '5cqh';
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
      <Piece vb={[0, 0, 400, 60]} fit="xMidYMin slice" style={{ left: 0, top: 0, width: '100%', height: lace }}>
        <g filter={url('soft')}>
          <Lace />
        </g>
      </Piece>
      <Piece vb={[0, 0, 400, 60]} fit="xMidYMin slice" style={{ left: 0, bottom: 0, width: '100%', height: lace, scale: '1 -1' }}>
        <g filter={url('soft')}>
          <Lace />
        </g>
      </Piece>
      {/* pearls draped from the bow's knot to the corners */}
      <Piece vb={[0, 0, 400, 200]} fit="none" style={{ left: 0, top: lace, width: '100%', height: card ? '28cqh' : '22cqh' }}>
        <g filter={url('soft')}>
          <Strand d={[-10, 10, 100, 150, 200, 30]} n={26} r={4.2} u={url} />
          <Strand d={[200, 30, 300, 150, 410, 10]} n={26} r={4.2} u={url} />
          <Strand d={[-10, 50, 90, 190, 200, 44]} n={22} r={3} u={url} />
          <Strand d={[200, 44, 310, 190, 410, 50]} n={22} r={3} u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 300, 220]} anim="sway" style={{ left: '50%', top: `calc(${lace} - 2cqmin)`, width: cm(card ? 30 : 46), translate: '-50% 0' }}>
        <g filter={url('soft')}>
          <Bow u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 120, 110]} style={{ left: cm(card ? 5 : 6), bottom: `calc(${lace} + 1cqmin)`, width: cm(card ? 12 : 18), rotate: '-8deg' }}>
        <g filter={url('soft')}>
          <Cherries u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 300, 220]} style={{ right: cm(card ? 5 : 6), bottom: `calc(${lace} + 2cqmin)`, width: cm(card ? 14 : 20), rotate: '10deg' }}>
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

