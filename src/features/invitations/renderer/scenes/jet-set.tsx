import { Layer, Piece, cm, dayMonth, polar, rng, useIds, type SceneProps } from './kit';

/**
 * Jet-Set Passport — retro air travel: an airmail chevron border around a pale sky with soft clouds,
 * a dashed flight path arcing to a little plane, ink visa stamps (one dated with the day), a barcode
 * stub and a leather luggage tag. The runway orange follows the accent.
 */
const RED = '#D93A3A';
const BLUE = '#2E4B8F';
const SKY = '#3AA0D8';
const NAVY = '#1F2A44';
const ORANGE = 'var(--inv-accent, #F26B38)';
const PAPER = '#FFFDF7';

type Url = (name: string) => string;

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff">
      <ellipse cx="0" cy="10" rx="46" ry="16" />
      <circle cx="-18" cy="0" r="18" />
      <circle cx="8" cy="-8" r="24" />
      <circle cx="30" cy="4" r="16" />
    </g>
  );
}

/** Round ink stamp (viewBox -60 -60 120 120). */
function RoundStamp({ color, label }: { color: string; label?: [string, string] | null }) {
  const stars = Array.from({ length: 12 }, (_, i) => polar(0, 0, 40, i * 30));
  return (
    <g style={{ stroke: color, fill: 'none' }} strokeWidth="2.6">
      <circle r="54" />
      <circle r="46" strokeWidth="1.4" />
      <circle r="28" strokeWidth="1.4" />
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" style={{ fill: color }} stroke="none" />
      ))}
      {label ? (
        <text
          x="0"
          y="9"
          textAnchor="middle"
          style={{ fill: color, font: '700 26px "Space Mono", "Cousine", monospace' }}
          stroke="none"
        >
          {label[0]}.{label[1]}
        </text>
      ) : (
        <path d="M-16 4l22-8 14-4-8 8-22 12z" style={{ fill: color }} stroke="none" />
      )}
      <path d="M-40-22c20-10 60-10 80 0" strokeWidth="1.2" />
      <path d="M-40 26c20 10 60 10 80 0" strokeWidth="1.2" />
    </g>
  );
}

/** Rectangular visa stamp (viewBox 0 0 150 90). */
function RectStamp({ color }: { color: string }) {
  return (
    <g style={{ stroke: color, fill: 'none' }} strokeWidth="2.6">
      <rect x="4" y="4" width="142" height="82" rx="10" />
      <rect x="12" y="12" width="126" height="66" rx="6" strokeWidth="1.2" />
      <path d="M30 60l40-26 18-10 10 2-8 10-40 30z" style={{ fill: color }} stroke="none" />
      <path d="M96 34h28M96 46h28M96 58h20" strokeWidth="2" />
    </g>
  );
}

/** Luggage tag on a string (viewBox 0 0 110 170). */
function Tag({ u }: { u: Url }) {
  return (
    <g>
      <path d="M55 30C40 10 70 -4 80 12" stroke="#7A5A3A" strokeWidth="2.4" fill="none" />
      <path d="M22 30h66l14 18v112a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8V48z" fill={u('leather')} />
      <path d="M26 58h58v48H26z" fill={PAPER} />
      <path d="M32 68h40M32 80h46M32 92h30" stroke={NAVY} strokeWidth="2.4" opacity=".55" />
      <circle cx="55" cy="40" r="6" fill={PAPER} stroke="#7A5A3A" strokeWidth="2" />
      <path d="M18 122h74M18 134h74" stroke="#fff" strokeWidth="1.4" strokeDasharray="3 4" opacity=".6" />
    </g>
  );
}

/** Barcode stub (viewBox 0 0 120 60). */
function Barcode() {
  const rand = rng(8);
  const bars: [number, number][] = [];
  for (let x = 12; x < 108;) {
    const w = 1 + Math.floor(rand() * 3.4);
    bars.push([x, w]);
    x += w + 1 + Math.floor(rand() * 2.5);
  }
  return (
    <g>
      <rect x="0" y="0" width="120" height="60" rx="4" fill={PAPER} />
      <path d="M0 8H120" stroke={ORANGE} strokeWidth="6" style={{ stroke: ORANGE }} />
      {bars.map(([x, w]) => (
        <rect key={x} x={x} y="16" width={w} height="32" fill={NAVY} />
      ))}
      <path d="M12 54H108" stroke={NAVY} strokeWidth="1" strokeDasharray="2 3" opacity=".5" />
    </g>
  );
}

export default function JetSet({ place, date }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const border = card ? '3.2cqmin' : '4.2cqmin';
  const chevron = card ? '2.6cqmin' : '3.4cqmin';
  const dm = dayMonth(date);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('leather')} x1="0" x2="1" y1="0" y2="1">
            <stop
              offset="0"
              style={{ stopColor: 'color-mix(in srgb, var(--inv-accent, #F26B38) 70%, #FFE2C9)' }}
            />
            <stop
              offset="1"
              style={{ stopColor: 'color-mix(in srgb, var(--inv-accent, #F26B38) 75%, #4A1E0C)' }}
            />
          </linearGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1.5" dy="4" stdDeviation="3" floodColor="#1F2A44" floodOpacity=".25" />
          </filter>
          <filter id={ref('cloud')} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id={ref('ink')}>
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="3" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.25" />
            <feComposite in="SourceGraphic" operator="in" />
          </filter>
        </defs>
      </svg>
      {/* the airmail border: chevrons all round, the sky inside */}
      <Layer
        style={{
          background: `repeating-linear-gradient(-45deg, ${RED} 0 ${chevron}, ${PAPER} ${chevron} calc(2 * ${chevron}), ${BLUE} calc(2 * ${chevron}) calc(3 * ${chevron}), ${PAPER} calc(3 * ${chevron}) calc(4 * ${chevron}))`,
        }}
      />
      <Layer
        style={{
          inset: border,
          background: 'linear-gradient(180deg, #C3E0F2 0%, #D6EAF5 50%, #EBF5FA 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(31,42,68,.12)',
        }}
      />
      <Piece
        vb={[0, 0, 400, 700]}
        fit="xMidYMid slice"
        style={{ inset: border, width: `calc(100% - 2 * ${border})`, height: `calc(100% - 2 * ${border})` }}
      >
        <g filter={url('cloud')} opacity=".85">
          <Cloud x={70} y={120} s={1.1} />
          <Cloud x={330} y={250} s={0.8} />
          <Cloud x={60} y={520} s={0.9} />
          <Cloud x={320} y={600} s={1.2} />
        </g>
      </Piece>
      {/* the flight path */}
      <Piece
        vb={[0, 0, 400, 700]}
        fit="none"
        style={{ inset: border, width: `calc(100% - 2 * ${border})`, height: `calc(100% - 2 * ${border})` }}
      >
        <path
          d="M-10 660C60 520 40 380 110 300S330 170 352 70"
          fill="none"
          stroke={NAVY}
          strokeWidth="2.4"
          strokeDasharray="8 10"
          opacity=".45"
          vectorEffect="non-scaling-stroke"
        />
      </Piece>
      <Piece
        vb={[0, 0, 100, 100]}
        anim="float"
        style={{
          right: cm(card ? 9 : 10),
          top: cm(card ? 8 : 10),
          width: cm(card ? 9 : 14),
          rotate: '-32deg',
        }}
      >
        <g filter={url('soft')}>
          <path
            d="M50 6c4 0 6 6 6 14v22l36 20v10L56 60v20l12 10v6l-18-5-18 5v-6l12-10V60L8 72V62l36-20V20c0-8 2-14 6-14z"
            fill="#fff"
            stroke={NAVY}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M44 44h12" stroke={ORANGE} strokeWidth="4" style={{ stroke: ORANGE }} />
        </g>
      </Piece>
      <Piece
        vb={[-60, -60, 120, 120]}
        style={{
          left: cm(card ? 6 : 8),
          top: cm(card ? 6 : 9),
          width: cm(card ? 15 : 24),
          rotate: '-14deg',
          opacity: 0.75,
        }}
      >
        <g filter={url('ink')}>
          <RoundStamp color={RED} label={dm} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 150, 90]}
        style={{
          right: cm(card ? 6 : 7),
          bottom: cm(card ? 18 : 30),
          width: cm(card ? 15 : 24),
          rotate: '9deg',
          opacity: 0.7,
        }}
      >
        <g filter={url('ink')}>
          <RectStamp color={BLUE} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 110, 170]}
        anim="sway"
        style={{
          right: cm(card ? 5 : 7),
          bottom: cm(card ? 5 : 7),
          width: cm(card ? 11 : 17),
          rotate: '12deg',
        }}
      >
        <g filter={url('soft')}>
          <Tag u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 120, 60]}
        style={{
          left: cm(card ? 6 : 8),
          bottom: cm(card ? 6 : 9),
          width: cm(card ? 16 : 24),
          rotate: '-6deg',
        }}
      >
        <g filter={url('soft')}>
          <Barcode />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 60, 20]}
        style={{ left: '50%', bottom: cm(card ? 5 : 8), width: cm(card ? 8 : 11), translate: '-50% 0' }}
      >
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={10 + i * 20} cy="10" r="3" fill={i === 1 ? SKY : NAVY} opacity=".5" />
        ))}
      </Piece>
    </>
  );
}
