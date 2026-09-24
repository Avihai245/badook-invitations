import { Layer, Piece, ch, cm, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Kalanit — red anemones on layered green hills (Darom Adom): six round petals with a white ring and a
 * black heart ringed by stamens, feathery leaves, buds; a warm glow in the sky. The petals follow the
 * accent (the purple preset turns them purple).
 */
const RED = 'var(--inv-accent, #D62839)';
const RED_DEEP = 'color-mix(in srgb, var(--inv-accent, #D62839) 70%, #2A0309)';
const RED_LIGHT = 'color-mix(in srgb, var(--inv-accent, #D62839) 80%, #FFD9CF)';
const LEAF = '#6F8F3A';
const LEAF_DARK = '#4C6827';
const LEAF_LIGHT = '#A9C07A';
const INK = '#1C1A24';

type Url = (name: string) => string;

/** A front-facing anemone: 3 back + 3 front petals, the white ring, the black heart, stamens. */
function Anemone({ x, y, r, turn = 0, u }: { x: number; y: number; r: number; turn?: number; u: Url }) {
  const layer = (offset: number, scale: number, fill: string) =>
    [0, 120, 240].map((a) => {
      const deg = a + offset + turn;
      const [cx, cy] = polar(x, y, r * 0.5 * scale, deg);
      return (
        <ellipse
          key={deg}
          cx={cx}
          cy={cy}
          rx={r1(r * 0.56 * scale)}
          ry={r1(r * 0.47 * scale)}
          transform={`rotate(${deg} ${cx} ${cy})`}
          fill={fill}
        />
      );
    });
  return (
    <g>
      {layer(60, 1.04, u('petal-back'))}
      {layer(0, 1, u('petal'))}
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const [x1, y1] = polar(x, y, r * 0.42, a + turn + 8);
        const [x2, y2] = polar(x, y, r * 0.86, a + turn + 12);
        return <path key={a} d={`M${x1} ${y1}L${x2} ${y2}`} stroke="#fff" strokeWidth={r1(r * 0.02)} opacity=".22" />;
      })}
      <circle cx={x} cy={y} r={r1(r * 0.36)} fill="#FBF3EC" />
      <circle cx={x} cy={y} r={r1(r * 0.36)} fill={RED_DEEP} opacity=".18" />
      {Array.from({ length: 16 }, (_, i) => {
        const [sx, sy] = polar(x, y, r * 0.35, i * 22.5 + turn);
        const [ex, ey] = polar(x, y, r * 0.2, i * 22.5 + turn);
        return (
          <g key={i}>
            <path d={`M${ex} ${ey}L${sx} ${sy}`} stroke={INK} strokeWidth={r1(r * 0.022)} />
            <circle cx={sx} cy={sy} r={r1(r * 0.045)} fill={INK} />
          </g>
        );
      })}
      <circle cx={x} cy={y} r={r1(r * 0.22)} fill={INK} />
      <circle cx={x} cy={y} r={r1(r * 0.13)} fill="#34304A" />
      <circle cx={r1(x - r * 0.07)} cy={r1(y - r * 0.08)} r={r1(r * 0.05)} fill="#fff" opacity=".45" />
    </g>
  );
}

/** A side-on anemone cup (turned away), tilted by `deg`. */
function Cup({ x, y, r, deg = 0 }: { x: number; y: number; r: number; deg?: number }) {
  return (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <path
        d={`M${x - r} ${y - r * 0.25}Q${x - r * 0.95} ${y + r * 0.95} ${x} ${y + r * 0.85}Q${x + r * 0.95} ${y + r * 0.95} ${x + r} ${y - r * 0.25}Q${x + r * 0.5} ${y + r * 0.18} ${x} ${y - r * 0.12}Q${x - r * 0.5} ${y + r * 0.18} ${x - r} ${y - r * 0.25}Z`}
        style={{ fill: RED }}
      />
      <path
        d={`M${x - r * 0.42} ${y - r * 0.02}Q${x} ${y + r * 0.98} ${x + r * 0.42} ${y - r * 0.02}Q${x} ${y + r * 0.25} ${x - r * 0.42} ${y - r * 0.02}Z`}
        style={{ fill: RED_DEEP }}
      />
      <ellipse cx={x} cy={r1(y - r * 0.08)} rx={r1(r * 0.55)} ry={r1(r * 0.14)} fill={INK} opacity=".85" />
    </g>
  );
}

/** A closed bud. */
function Bud({ x, y, r, deg = 0 }: { x: number; y: number; r: number; deg?: number }) {
  return (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <path
        d={`M${x} ${y - r * 1.6}Q${x + r * 1.05} ${y - r * 0.45} ${x} ${y + r * 0.35}Q${x - r * 1.05} ${y - r * 0.45} ${x} ${y - r * 1.6}Z`}
        style={{ fill: RED_DEEP }}
      />
      <path
        d={`M${x} ${y - r * 1.5}Q${x + r * 0.5} ${y - r * 0.5} ${x} ${y + r * 0.3}`}
        fill="none"
        style={{ stroke: RED }}
        strokeWidth={r1(r * 0.3)}
        opacity=".75"
      />
    </g>
  );
}

/** Finely cut anemone leaf: a midrib with forked leaflets. */
function Feather({ x, y, len, deg, tone = LEAF }: { x: number; y: number; len: number; deg: number; tone?: string }) {
  const [tx, ty] = polar(x, y, len, deg);
  const w = r1(Math.max(1.2, len * 0.03));
  return (
    <g stroke={tone} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x} ${y}L${tx} ${ty}`} strokeWidth={w} />
      {[0.28, 0.44, 0.6, 0.74, 0.86].map((t, i) => {
        const [bx, by] = polar(x, y, len * t, deg);
        const l = len * (0.36 - t * 0.22);
        return [-1, 1].map((side) => {
          const [lx, ly] = polar(bx, by, l, deg + side * 50);
          const [fx, fy] = polar(lx, ly, l * 0.45, deg + side * 20);
          const [gx, gy] = polar(bx, by, l * 0.55, deg + side * 50);
          const [hx, hy] = polar(gx, gy, l * 0.35, deg + side * 85);
          return <path key={`${i}${side}`} d={`M${bx} ${by}L${lx} ${ly}L${fx} ${fy}M${gx} ${gy}L${hx} ${hy}`} strokeWidth={w} />;
        });
      })}
    </g>
  );
}

function Stem({ x0, y0, x1, y1, bow = 0, w = 2.6 }: { x0: number; y0: number; x1: number; y1: number; bow?: number; w?: number }) {
  return (
    <path
      d={`M${x0} ${y0}Q${(x0 + x1) / 2 + bow} ${(y0 + y1) / 2} ${x1} ${y1}`}
      stroke={LEAF}
      strokeWidth={w}
      fill="none"
      strokeLinecap="round"
    />
  );
}

/** Collar of feathery leaflets under a flower head. */
function Collar({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <>
      <Feather x={x} y={y} len={s} deg={-165} />
      <Feather x={x} y={y} len={s * 0.9} deg={-15} />
      <Feather x={x} y={y} len={s * 0.7} deg={-95} tone={LEAF_DARK} />
    </>
  );
}

/** The bottom-left bouquet (viewBox 0 0 240 280): flowers rising from the bottom edge. */
function Bouquet({ u }: { u: Url }) {
  return (
    <>
      <Feather x={20} y={284} len={84} deg={-112} tone={LEAF_DARK} />
      <Feather x={58} y={284} len={96} deg={-78} />
      <Feather x={120} y={284} len={74} deg={-52} tone={LEAF_DARK} />
      <Feather x={170} y={284} len={60} deg={-34} />
      <Stem x0={70} y0={284} x1={82} y1={124} bow={-18} w={3.2} />
      <Stem x0={122} y0={284} x1={150} y1={176} bow={12} />
      <Stem x0={34} y0={284} x1={28} y1={196} bow={-8} />
      <Stem x0={186} y0={284} x1={206} y1={226} bow={4} w={2.2} />
      <Stem x0={100} y0={284} x1={112} y1={236} bow={-3} w={2.2} />
      <Collar x={80} y={160} s={30} />
      <Collar x={146} y={200} s={22} />
      <Anemone x={82} y={118} r={48} turn={8} u={u} />
      <Anemone x={152} y={170} r={30} turn={-14} u={u} />
      <Cup x={28} y={190} r={17} deg={-16} />
      <Bud x={206} y={224} r={9} deg={18} />
      <Bud x={112} y={234} r={7} deg={-8} />
    </>
  );
}

/** The top-right spray (viewBox 0 0 200 200): heads leaning in from the corner. */
function Spray({ u }: { u: Url }) {
  return (
    <>
      <Stem x0={214} y0={-14} x1={120} y1={96} bow={-10} w={2.8} />
      <Stem x0={214} y0={30} x1={150} y1={150} bow={8} w={2.4} />
      <Stem x0={190} y0={-14} x1={70} y1={40} bow={-14} w={2.2} />
      <Feather x={200} y={10} len={70} deg={160} tone={LEAF_DARK} />
      <Feather x={214} y={60} len={60} deg={130} />
      <Anemone x={116} y={100} r={38} turn={20} u={u} />
      <Anemone x={152} y={156} r={24} turn={-6} u={u} />
      <Bud x={68} y={42} r={8} deg={-62} />
    </>
  );
}

function Hills({ u }: { u: Url }) {
  // viewBox 0 0 1200 300 — a phone sees the middle third
  const rand = rng(7);
  const far = Array.from({ length: 90 }, () => {
    const x = rand() * 1200;
    return [r1(x), r1(140 + rand() * 60 + Math.sin(x / 95) * 10), r1(1.6 + rand() * 1.8)] as const;
  });
  const near = Array.from({ length: 40 }, () => {
    const x = rand() * 1200;
    return [r1(x), r1(212 + rand() * 30), r1(3 + rand() * 2.5)] as const;
  });
  return (
    <>
      <path d="M0 128C150 92 270 100 390 116S630 150 770 116 1050 80 1200 108V300H0Z" fill={LEAF_LIGHT} opacity=".5" />
      <path d="M0 162C160 134 300 144 420 156S700 182 860 152 1080 132 1200 150V300H0Z" fill={u('hill-mid')} filter={u('lift')} />
      {far.map(([x, y, s], i) => (
        <ellipse key={i} cx={x} cy={y} rx={s} ry={r1(s * 0.75)} style={{ fill: RED }} opacity={0.55 + (i % 3) * 0.15} />
      ))}
      <path d="M0 206C180 186 320 198 480 206S780 216 960 198 1120 192 1200 200V300H0Z" fill={u('hill-near')} filter={u('lift')} />
      {near.map(([x, y, s], i) => (
        <g key={i}>
          <path d={`M${x} ${y + s * 3}V${y}`} stroke={LEAF_DARK} strokeWidth="1.2" />
          <ellipse cx={x} cy={y} rx={s} ry={r1(s * 0.8)} style={{ fill: RED }} />
          <circle cx={x} cy={r1(y - s * 0.1)} r={r1(s * 0.3)} fill={INK} opacity=".8" />
        </g>
      ))}
      <path d="M0 252C240 236 420 246 600 248S960 240 1200 246V300H0Z" fill={LEAF_DARK} filter={u('lift')} />
    </>
  );
}

export default function Kalanit({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  return (
    <>
      <Layer
        style={{
          background:
            'radial-gradient(70cqmin 50cqmin at 88% 0%, rgba(255,232,190,.95), rgba(255,232,190,0) 70%),' +
            'radial-gradient(90cqw 26cqh at 50% 100%, rgba(169,192,122,.4), transparent 70%)',
        }}
      />
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('petal')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: RED_DEEP }} />
            <stop offset=".5" style={{ stopColor: RED }} />
            <stop offset="1" style={{ stopColor: RED_LIGHT }} />
          </linearGradient>
          <linearGradient id={ref('hill-mid')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#A9C272" />
            <stop offset=".5" stopColor="#8FAA55" />
          </linearGradient>
          <linearGradient id={ref('hill-near')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7E9E44" />
            <stop offset=".6" stopColor={LEAF} />
          </linearGradient>
          <filter id={ref('lift')} x="-5%" y="-30%" width="110%" height="160%">
            <feDropShadow dx="0" dy="-3" stdDeviation="4" floodColor="#2E3A12" floodOpacity=".22" />
          </filter>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#3A1A10" floodOpacity=".2" />
          </filter>
          <linearGradient id={ref('petal-back')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: '#2A0309' }} />
            <stop offset=".45" style={{ stopColor: RED_DEEP }} />
            <stop offset="1" style={{ stopColor: RED }} />
          </linearGradient>
        </defs>
      </svg>
      <Piece
        vb={[0, 0, 1200, 300]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? ch(40) : ch(22) }}
      >
        <Hills u={url} />
      </Piece>
      <Piece vb={[0, 0, 240, 280]} style={{ left: cm(-7), bottom: cm(-4), width: cm(card ? 36 : 60) }}>
        <g filter={url('soft')}>
          <Bouquet u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 240, 280]} flip style={{ right: cm(-12), bottom: cm(-8), width: cm(card ? 28 : 46) }}>
        <g filter={url('soft')}>
          <Bouquet u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 200, 200]} style={{ right: cm(-5), top: cm(-5), width: cm(card ? 30 : 44) }}>
        <g filter={url('soft')}>
          <Spray u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 120, 90]} anim="float" style={{ left: cm(12), top: cm(card ? 8 : 16), width: cm(12) }}>
        <ellipse cx="34" cy="60" rx="20" ry="15" transform="rotate(-30 34 60)" fill={url('petal')} />
        <ellipse cx="92" cy="24" rx="12" ry="9" transform="rotate(24 92 24)" fill={url('petal')} opacity=".85" />
      </Piece>
    </>
  );
}
