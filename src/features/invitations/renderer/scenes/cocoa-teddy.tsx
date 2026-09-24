import { Frame, Layer, Piece, cm, cmh, useIds, type SceneProps } from './kit';

/**
 * Cocoa Teddy — a nursery: a powder-blue sky with puffy clouds and a little crescent moon, a
 * running-stitch border, a gingham blanket along the bottom, and a chocolate teddy sitting on it with
 * a bow at the neck. The powder blue follows the accent (blush / sage presets).
 */
const COCOA = '#A0673F';
const COCOA_DEEP = '#6E4226';
const TAN = '#D8B89A';
const BLUE = 'var(--inv-accent, #7FAAD4)';
const BLUE_SOFT = 'color-mix(in srgb, var(--inv-accent, #7FAAD4) 45%, transparent)';
const INK = '#3B2618';

type Url = (name: string) => string;

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-50 20c-16 0-22-22-6-28 0-16 20-22 30-12 6-18 34-18 40 0 12-8 30 0 28 14 16 2 16 26 0 26z"
        fill="#fff"
      />
      <path d="M-44 18h86c6 0 10-4 10-8" stroke="#CFE2F3" strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** The teddy, sitting (viewBox 0 0 200 220). */
function Teddy({ u }: { u: Url }) {
  return (
    <g>
      {/* ears */}
      <circle cx="54" cy="40" r="22" fill={COCOA} />
      <circle cx="146" cy="40" r="22" fill={COCOA} />
      <circle cx="54" cy="40" r="11" fill={TAN} />
      <circle cx="146" cy="40" r="11" fill={TAN} />
      {/* body + arms + legs */}
      <ellipse cx="100" cy="160" rx="62" ry="56" fill={u('fur')} />
      <ellipse cx="100" cy="168" rx="34" ry="32" fill={TAN} opacity=".85" />
      <ellipse cx="42" cy="148" rx="18" ry="30" fill={COCOA} transform="rotate(24 42 148)" />
      <ellipse cx="158" cy="148" rx="18" ry="30" fill={COCOA} transform="rotate(-24 158 148)" />
      <ellipse cx="58" cy="206" rx="30" ry="18" fill={COCOA} />
      <ellipse cx="142" cy="206" rx="30" ry="18" fill={COCOA} />
      <ellipse cx="52" cy="208" rx="13" ry="10" fill={TAN} />
      <ellipse cx="148" cy="208" rx="13" ry="10" fill={TAN} />
      {/* head */}
      <circle cx="100" cy="76" r="54" fill={u('fur')} />
      <ellipse cx="100" cy="96" rx="26" ry="20" fill={TAN} />
      <ellipse cx="100" cy="86" rx="9" ry="6.5" fill={INK} />
      <path
        d="M100 92v8M92 104c4 4 12 4 16 0"
        stroke={INK}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="80" cy="68" r="5.6" fill={INK} />
      <circle cx="120" cy="68" r="5.6" fill={INK} />
      <circle cx="82" cy="66" r="1.8" fill="#fff" />
      <circle cx="122" cy="66" r="1.8" fill="#fff" />
      <ellipse cx="70" cy="90" rx="8" ry="5" fill="#E9A3A3" opacity=".45" />
      <ellipse cx="130" cy="90" rx="8" ry="5" fill="#E9A3A3" opacity=".45" />
      {/* stitch on the tummy */}
      <path d="M100 140v50" stroke={COCOA_DEEP} strokeWidth="2" strokeDasharray="4 5" opacity=".6" />
      {/* bow */}
      <path d="M100 128c-12-14-36-16-38-4s22 14 38 4z" style={{ fill: BLUE }} />
      <path d="M100 128c12-14 36-16 38-4s-22 14-38 4z" style={{ fill: BLUE }} />
      <path d="M96 132l-10 20 8-2 4 8 6-24zM104 132l10 20-8-2-4 8-6-24z" style={{ fill: BLUE }} />
      <circle cx="100" cy="129" r="7" style={{ fill: BLUE }} />
      <path d="M94 124c3-2 9-2 12 0" stroke="#fff" strokeWidth="2" opacity=".6" fill="none" />
    </g>
  );
}

export default function CocoaTeddy({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const check = card ? '3.2cqmin' : '4cqmin';
  const blanket = card ? '22cqh' : '15cqh';
  const teddy = card ? cm(26) : cmh(36);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('fur')} cx=".4" cy=".35" r=".75">
            <stop offset="0" stopColor="#B47A50" />
            <stop offset=".7" stopColor={COCOA} />
            <stop offset="1" stopColor={COCOA_DEEP} />
          </radialGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#6E4226" floodOpacity=".25" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background: 'radial-gradient(80cqw 50cqh at 50% 50%, rgba(255,253,248,.7), transparent 75%)',
        }}
      />
      <Piece
        vb={[0, 0, 400, 300]}
        anim="float"
        fit="xMidYMin meet"
        style={{ left: 0, top: 0, width: '100%', height: card ? '40cqh' : '26cqh' }}
      >
        <g filter={url('soft')}>
          <Cloud x={80} y={70} s={1.1} />
          <Cloud x={320} y={120} s={0.85} />
          <Cloud x={200} y={40} s={0.55} />
        </g>
        <path d="M300 40a26 26 0 1 0 22 40 22 22 0 1 1-22-40z" fill="#FFF3C9" />
        {[
          [150, 110],
          [250, 30],
          [360, 60],
          [40, 150],
        ].map(([x, y], i) => (
          <path key={i} d={`M${x} ${y! - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} fill="#FFF3C9" />
        ))}
      </Piece>
      <Frame inset={card ? '3.5cqmin' : '4cqmin'}>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="18"
          fill="none"
          style={{
            stroke: COCOA,
            strokeWidth: '0.55cqmin',
            strokeDasharray: '1.4cqmin 1.1cqmin',
            strokeLinecap: 'round',
            opacity: 0.7,
          }}
        />
      </Frame>
      {/* gingham blanket */}
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          bottom: 0,
          width: '100%',
          height: blanket,
          background:
            `linear-gradient(90deg, ${BLUE_SOFT} 50%, transparent 50%) 0 0 / calc(2 * ${check}) calc(2 * ${check}),` +
            `linear-gradient(0deg, ${BLUE_SOFT} 50%, transparent 50%) 0 0 / calc(2 * ${check}) calc(2 * ${check}),` +
            '#FFFDF8',
          borderTop: `0.5cqmin dashed ${COCOA}`,
          boxShadow: '0 -1.2cqmin 2cqmin -1cqmin rgba(110,66,38,.18)',
          borderRadius: '40% 60% 0 0 / 6cqmin 6cqmin 0 0',
        }}
      />
      <Piece
        vb={[0, 0, 200, 220]}
        style={{ left: '50%', bottom: `calc(${blanket} - ${teddy} / 3)`, width: teddy, translate: '-50% 0' }}
      >
        <g filter={url('soft')}>
          <Teddy u={url} />
        </g>
      </Piece>
    </>
  );
}
