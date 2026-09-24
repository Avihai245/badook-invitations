import { Layer, Piece, cm, dayMonth, useIds, type SceneProps } from './kit';

/**
 * White City — Tel Aviv Bauhaus: the event's day as an oversized outlined numeral behind the names, a
 * primary red circle, a blue square and a yellow triangle composed around the edges with fine black
 * rules, and a white building along the foot — rounded ribbon balconies with shadow lines, a
 * thermometer stair window and pilotis. The red follows the accent.
 */
const RED = 'var(--inv-accent, #CC3A27)';
const BLUE = '#2B59C3';
const YELLOW = '#F2B705';
const CONCRETE = '#D8D3C7';
const BLACK = '#1E1E1E';

type Url = (name: string) => string;

/** The building (viewBox 0 0 1000 260): two wings, ribbon balconies, a stair tower, pilotis. */
function Building({ u }: { u: Url }) {
  const balconies = (x: number, w: number, ys: number[], round: 'l' | 'r' | 'both') =>
    ys.map((y) => {
      const r = 14;
      const left = round === 'l' || round === 'both';
      const right = round === 'r' || round === 'both';
      const d = `M${x + (left ? r : 0)} ${y}H${x + w - (right ? r : 0)}${right ? `A${r} ${r} 0 0 1 ${x + w - r} ${y + 2 * r}` : `V${y + 2 * r}`}H${x + (left ? r : 0)}${left ? `A${r} ${r} 0 0 1 ${x + r} ${y}` : `V${y}`}Z`;
      return (
        <g key={y}>
          <path d={d} fill="#FFFFFF" />
          <path
            d={`M${x + 6} ${y + 2 * r + 4}H${x + w - 6}`}
            stroke={CONCRETE}
            strokeWidth="6"
            opacity=".9"
          />
          <path
            d={`M${x + 10} ${y + 2 * r + 9}H${x + w - 10}`}
            stroke={BLACK}
            strokeWidth="1.2"
            opacity=".18"
          />
        </g>
      );
    });
  return (
    <g filter={u('soft')}>
      {/* left wing */}
      <path d="M40 60H440V210H40Z" fill="#FBFAF6" />
      {[80, 150, 220, 290, 360].map((x) => (
        <path key={x} d={`M${x} 74h40v22h-40z`} fill="#3A4150" opacity=".75" />
      ))}
      {balconies(20, 440, [100, 150], 'both')}
      {/* stair tower with the thermometer window */}
      <path d="M470 20H560V210H470Z" fill="#F4F2EC" />
      <path d="M500 34H530V196H500Z" fill="#9DB3CC" />
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`M500 ${48 + i * 14}H530`} stroke="#FBFAF6" strokeWidth="3" />
      ))}
      {/* right wing, rounded at its end */}
      <path d="M560 70H930a40 40 0 0 1 40 40V210H560Z" fill="#FBFAF6" />
      {[600, 670, 740, 810].map((x) => (
        <path key={x} d={`M${x} 84h44v22h-44z`} fill="#3A4150" opacity=".75" />
      ))}
      {balconies(560, 420, [112, 160], 'r')}
      {/* pilotis and the shaded ground floor */}
      <path d="M40 210H970V250H40Z" fill="#E6E1D6" />
      {[70, 170, 270, 370, 600, 700, 800, 900].map((x) => (
        <g key={x}>
          <path d={`M${x} 210h14v40h-14z`} fill="#FFFFFF" />
          <path d={`M${x + 14} 210h8v40h-8z`} fill={CONCRETE} />
        </g>
      ))}
      <path d="M0 250H1000V260H0Z" fill={CONCRETE} />
      <circle cx="480" cy="226" r="7" style={{ fill: RED }} />
    </g>
  );
}

export default function WhiteCity({ place, date }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const [day] = dayMonth(date) ?? ['17'];
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={ref('soft')} x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="6" dy="6" stdDeviation="5" floodColor="#1E1E1E" floodOpacity=".16" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background: 'radial-gradient(90cqw 60cqh at 70% 20%, rgba(255,255,255,.8), transparent 70%)',
        }}
      />
      {/* the oversized numeral */}
      <Piece
        vb={[0, 0, 200, 200]}
        style={{
          left: '50%',
          top: '50%',
          width: card ? '50cqmin' : 'min(118cqmin, 86cqh)',
          translate: '-50% -54%',
        }}
      >
        <text
          x="100"
          y="100"
          dy=".35em"
          textAnchor="middle"
          fill="none"
          stroke={BLACK}
          strokeWidth=".6"
          opacity=".16"
          style={{ font: '500 176px Jost, "Alef", "Heebo", sans-serif', letterSpacing: '-6px' }}
        >
          {day}
        </text>
      </Piece>
      {/* primary shapes and rules */}
      <Piece vb={[0, 0, 100, 100]} style={{ right: cm(-14), top: cm(-12), width: cm(card ? 34 : 56) }}>
        <circle cx="50" cy="50" r="46" style={{ fill: RED }} />
      </Piece>
      <Layer
        style={{
          inset: 'auto',
          left: cm(7),
          top: cm(card ? 6 : 9),
          width: cm(card ? 10 : 16),
          aspectRatio: '1',
          background: BLUE,
          rotate: '-8deg',
        }}
      />
      <Piece vb={[0, 0, 100, 90]} style={{ left: cm(-4), top: '46%', width: cm(card ? 12 : 18) }}>
        <path d="M0 90L50 0L100 90Z" fill={YELLOW} />
      </Piece>
      <Layer
        style={{
          inset: 'auto',
          left: cm(4),
          right: '38%',
          top: cm(card ? 20 : 30),
          height: '1.5px',
          background: BLACK,
        }}
      />
      <Layer
        style={{
          inset: 'auto',
          right: cm(18),
          top: cm(card ? 16 : 24),
          bottom: card ? '30cqh' : '28cqh',
          width: '1.5px',
          background: BLACK,
          opacity: 0.8,
        }}
      />
      <Piece vb={[0, 0, 40, 40]} style={{ right: cm(10), top: cm(card ? 24 : 40), width: cm(card ? 4 : 5) }}>
        <circle cx="20" cy="20" r="18" fill={BLACK} />
      </Piece>
      {/* the building along the foot */}
      <Piece
        vb={[0, 0, 1000, 260]}
        fit="xMidYMax meet"
        style={{ left: '50%', bottom: 0, width: card ? '96cqw' : 'min(150cqw, 110cqh)', translate: '-50% 0' }}
      >
        <Building u={url} />
      </Piece>
    </>
  );
}
