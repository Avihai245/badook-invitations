import { Layer, Piece, cm, polar, r1, useIds, type SceneProps } from './kit';

/**
 * Marrakech Henna — a riad at night: emerald zellige, a horseshoe (keyhole) arch drawn in gold with a
 * dotted border and a lantern glow inside, an eight-point zellige star at its crown, pierced brass
 * lanterns hanging at the sides, pomegranates at the foot and a dotted hamsa below the names. The gold
 * follows the accent (saffron / ruby presets).
 */
const GOLD = 'var(--inv-accent, #D4A640)';
const GOLD_LIGHT = 'color-mix(in srgb, var(--inv-accent, #D4A640) 55%, #FFF4D2)';
const GOLD_DEEP = 'color-mix(in srgb, var(--inv-accent, #D4A640) 65%, #3A2408)';
const EMERALD = '#0F3B34';
const EMERALD_LIGHT = '#1F6F5C';
const RED = '#C8283C';
const SAFFRON = '#F0A21E';
const INSIDE = '#12463D';

type Url = (name: string) => string;

/** Eight-point star (two squares) path around (x, y). */
function star8(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const [px, py] = polar(x, y, i % 2 ? r * 0.72 : r, i * 22.5 - 90);
    pts.push(`${px} ${py}`);
  }
  return `M${pts.join('L')}Z`;
}

/**
 * The keyhole arch is drawn in two parts so it fits any screen: the horseshoe crown (an SVG, viewBox
 * 0 0 300 220, its arc ending at x 38 / 262) and the straight jambs below it (CSS borders). Strokes on
 * both use container units, so they meet exactly.
 */
const CROWN_R = 132;
const CROWN_END = { l: 38.1, r: 261.9, y: 219.9 };
const JAMB = {
  x: CROWN_END.l / 300,
  w: (CROWN_END.r - CROWN_END.l) / 300,
  y: CROWN_END.y / 300,
  // the dotted line runs 11 units inside the crown's arc: 11·cos 32° across on the jambs
  dots: (11 * Math.cos((32 * Math.PI) / 180)) / 300,
};
const LINE = '1.3cqmin';
const DOTS = '0.62cqmin';

function crown(inset: number): string {
  const r = CROWN_R - inset;
  const a = (32 * Math.PI) / 180;
  return `M${r1(150 - r * Math.cos(a))} ${r1(150 + r * Math.sin(a))}A${r} ${r} 0 1 1 ${r1(150 + r * Math.cos(a))} ${r1(150 + r * Math.sin(a))}`;
}

function Crown({ u }: { u: Url }) {
  const stroke = (w: string, color: string, extra: object = {}) => ({
    fill: 'none',
    vectorEffect: 'non-scaling-stroke' as const,
    style: { stroke: color, strokeWidth: w, ...extra },
  });
  return (
    <g>
      <path d={`${crown(0)}L${CROWN_END.r} 222H${CROWN_END.l}Z`} fill={INSIDE} />
      <path d={crown(0)} {...stroke(LINE, GOLD)} />
      <path d={crown(0)} {...stroke(`calc(${LINE} / 3)`, INSIDE)} />
      <path d={crown(11)} {...stroke(DOTS, GOLD, { strokeDasharray: `0 calc(${DOTS} * 2.4)`, strokeLinecap: 'round' })} />
      <g transform="translate(150 62)">
        <path d={star8(0, 0, 26)} fill={u('gold')} />
        <path d={star8(0, 0, 19)} fill={EMERALD} />
        <path d={star8(0, 0, 12.5)} fill={RED} />
        <circle r="4.6" fill={SAFFRON} />
      </g>
    </g>
  );
}

/** A pierced brass lantern on its chain (viewBox 0 0 60 200; the chain comes from the top). */
function Lantern({ u }: { u: Url }) {
  return (
    <g>
      <path d="M30 0V70" stroke={GOLD_DEEP} strokeWidth="1.4" strokeDasharray="3 2" />
      <circle cx="30" cy="140" r="34" fill={u('glow')} />
      <path d="M30 70c-6 0-8 6-10 10h20c-2-4-4-10-10-10z" fill={u('gold')} />
      <path d="M16 82h28l4 10H12z" fill={u('gold')} />
      <path d="M12 92h36c2 14 2 44-4 62H16c-6-18-6-48-4-62z" fill={GOLD_DEEP} />
      <path d="M12 92h36c2 14 2 44-4 62H16c-6-18-6-48-4-62z" fill={u('gold')} opacity=".85" />
      {[
        [22, 104],
        [30, 100],
        [38, 104],
        [22, 118],
        [30, 114],
        [38, 118],
        [22, 132],
        [30, 128],
        [38, 132],
        [26, 144],
        [34, 144],
      ].map(([x, y], i) => (
        <path key={i} d={star8(x!, y!, 3.2)} fill="#FFF1C2" opacity=".95" />
      ))}
      <path d="M16 154h28l-4 8H20z" fill={u('gold')} />
      <path d="M26 162h8l-4 10z" fill={GOLD_DEEP} />
    </g>
  );
}

/** A pomegranate with its crown and a leaf (viewBox 0 0 80 80). */
function Pomegranate({ x, y, s, deg = 0, u }: { x: number; y: number; s: number; deg?: number; u: Url }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg}) scale(${s})`}>
      <path d="M-18-26c-10-6-22 2-24 12" stroke="#2E5E3A" strokeWidth="3" fill="none" />
      <path d="M-24-30c-14-2-24 6-26 18 12 2 22-6 26-18z" fill="#2E6B45" />
      <circle cx="0" cy="0" r="30" fill={u('pom')} />
      <path d="M-8-28l-4-10 7 4 5-8 5 8 7-4-4 10z" fill="#9E1F30" />
      <ellipse cx="-10" cy="-10" rx="8" ry="5" fill="#fff" opacity=".25" transform="rotate(-30)" />
    </g>
  );
}

/** The hamsa with dotted paisley (viewBox 0 0 100 110). */
function Hamsa({ u }: { u: Url }) {
  return (
    <g>
      <path
        d="M50 106c-19 0-32-12-32-29v-9c-5-2-9-6-9-12 0-3 3-5 6-3l8 5V26a5 5 0 0 1 10 0v24V18a5 5 0 0 1 10 0v32V14a5 5 0 0 1 10 0v36V18a5 5 0 0 1 10 0v32V26a5 5 0 0 1 10 0v26l8-5c3-2 6 0 6 3 0 6-4 10-9 12v9c0 17-13 29-32 29z"
        fill={u('gold')}
      />
      <path d="M34 78c8-10 24-10 32 0-8 10-24 10-32 0z" fill={EMERALD} />
      <circle cx="50" cy="78" r="5" fill={RED} />
      <circle cx="50" cy="78" r="2" fill="#FFF1C2" />
      {[
        [34, 62],
        [42, 58],
        [50, 56],
        [58, 58],
        [66, 62],
        [30, 92],
        [38, 97],
        [50, 99],
        [62, 97],
        [70, 92],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.7" fill={EMERALD} />
      ))}
      <path d="M50 40c-5 4-5 10 0 12 5-2 5-8 0-12z" fill={RED} opacity=".9" />
    </g>
  );
}

export default function Marrakech({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const W = card ? 'min(56cqw, 60cqh)' : 'min(88cqw, 60cqh)';
  const top = card ? '8cqh' : '6cqh';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('gold')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: GOLD_LIGHT }} />
            <stop offset=".5" style={{ stopColor: GOLD }} />
            <stop offset="1" style={{ stopColor: GOLD_DEEP }} />
          </linearGradient>
          <radialGradient id={ref('inside')} cx=".5" cy=".3" r=".75">
            <stop offset="0" stopColor="#1B5A4E" />
            <stop offset=".7" stopColor="#12463D" />
            <stop offset="1" stopColor="#0C342E" />
          </radialGradient>
          <radialGradient id={ref('glow')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFD27A" stopOpacity=".55" />
            <stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ref('pom')} cx=".36" cy=".34" r=".75">
            <stop offset="0" stopColor="#F05A6A" />
            <stop offset=".6" stopColor={RED} />
            <stop offset="1" stopColor="#7E1222" />
          </radialGradient>
          <pattern id={ref('zellige')} width="60" height="60" patternUnits="userSpaceOnUse">
            <path d={star8(30, 30, 16)} fill="none" stroke={EMERALD_LIGHT} strokeWidth="1.4" opacity=".55" />
            <path d="M0 30H14M46 30H60M30 0V14M30 46V60" stroke={EMERALD_LIGHT} strokeWidth="1.4" opacity=".45" />
            <circle cx="0" cy="0" r="5" fill={EMERALD_LIGHT} opacity=".35" />
            <circle cx="60" cy="0" r="5" fill={EMERALD_LIGHT} opacity=".35" />
            <circle cx="0" cy="60" r="5" fill={EMERALD_LIGHT} opacity=".35" />
            <circle cx="60" cy="60" r="5" fill={EMERALD_LIGHT} opacity=".35" />
          </pattern>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity=".4" />
          </filter>
        </defs>
      </svg>
      <Piece vb={[0, 0, 600, 600]} fit="xMidYMid slice" style={{ inset: 0, width: '100%', height: '100%' }}>
        <rect width="600" height="600" fill={url('zellige')} />
      </Piece>
      <Layer
        style={{
          background:
            'radial-gradient(70cqw 55cqh at 50% 45%, rgba(15,59,52,.1), rgba(5,25,22,.75) 100%)',
        }}
      />
      {/* the arch: crown (SVG) + jambs (CSS), lit from inside */}
      <Piece vb={[0, 0, 300, 220]} style={{ left: '50%', top, width: W, translate: '-50% 0' }}>
        <g filter={url('soft')}>
          <Crown u={url} />
        </g>
      </Piece>
      <Layer
        style={{
          inset: 'auto',
          left: `calc(50% - ${W} / 2 + ${W} * ${JAMB.x} - ${LINE} / 2)`,
          top: `calc(${top} + ${W} * ${JAMB.y})`,
          bottom: 0,
          width: `calc(${W} * ${JAMB.w} + ${LINE})`,
          boxSizing: 'border-box',
          background: INSIDE,
          borderInline: `${LINE} double ${GOLD}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: `0 calc(${W} * ${JAMB.dots} - ${DOTS} / 2 - ${LINE} / 2)`,
            borderInline: `${DOTS} dotted ${GOLD}`,
          }}
        />
      </Layer>
      <Layer
        style={{
          background: `radial-gradient(calc(${W} * .7) 38cqh at 50% 36%, rgba(255,200,110,.16), transparent 70%)`,
        }}
      />
      <Piece vb={[0, 0, 60, 200]} anim="sway" style={{ left: cm(card ? 2 : 3), top: 0, height: card ? '46cqh' : '30cqh', width: 'auto' }}>
        <Lantern u={url} />
      </Piece>
      <Piece vb={[0, 0, 60, 200]} anim="sway" style={{ right: cm(card ? 2 : 3), top: 0, height: card ? '38cqh' : '22cqh', width: 'auto' }}>
        <Lantern u={url} />
      </Piece>
      <Piece vb={[0, 0, 100, 110]} style={{ left: '50%', bottom: card ? '6cqh' : '5cqh', width: cm(card ? 9 : 12), translate: '-50% 0' }}>
        <Hamsa u={url} />
      </Piece>
      <Piece vb={[0, 0, 160, 100]} style={{ left: cm(-3), bottom: cm(-2), width: cm(card ? 22 : 34) }}>
        <g filter={url('soft')}>
          <Pomegranate x={50} y={62} s={1} deg={-12} u={url} />
          <Pomegranate x={112} y={70} s={0.8} deg={18} u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 160, 100]} style={{ right: cm(-3), bottom: cm(-2), width: cm(card ? 18 : 28), scale: '-1 1' }}>
        <g filter={url('soft')}>
          <Pomegranate x={60} y={64} s={0.95} deg={-8} u={url} />
        </g>
      </Piece>
    </>
  );
}
