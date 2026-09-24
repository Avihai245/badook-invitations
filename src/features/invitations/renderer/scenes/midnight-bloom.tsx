import { cm, Frame, Layer, Piece, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Midnight Bloom — a Dutch still life on near-black: peonies built of stacked petal arcs, tulips,
 * ranunculus spirals and curling leaves spill from two corners across a thin gilded frame; a night
 * moth rests at the top; dust motes drift in a warm beam. The gilt follows the accent.
 */
const PINK = '#E58FA6';
const PINK_DEEP = '#B4546F';
const PINK_DARK = '#7E2E48';
const BLUSH = '#F4D6C7';
const BLUSH_DEEP = '#E0AE98';
const GREEN = '#3E5A3C';
const GREEN_LIGHT = '#5E7D56';
const GREEN_DARK = '#243622';
const GOLD = 'var(--inv-accent, #E8A33D)';

type Url = (name: string) => string;

function ellipsePetals(x: number, y: number, r: number, n: number, at: number, rx: number, ry: number, turn: number, fill: string) {
  return Array.from({ length: n }, (_, i) => {
    const deg = turn + (i * 360) / n;
    const [cx, cy] = polar(x, y, r * at, deg);
    return (
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={r1(r * rx)}
        ry={r1(r * ry)}
        transform={`rotate(${r1(deg)} ${cx} ${cy})`}
        fill={fill}
      />
    );
  });
}

/** A peony from above: guard petals, cupped petals, a ruffled heart of arcs. */
function Peony({ x, y, r, tone = 'pink', turn = 0, u }: { x: number; y: number; r: number; tone?: 'pink' | 'blush'; turn?: number; u: Url }) {
  const [base, mid, deep, light] =
    tone === 'pink' ? [PINK, PINK_DEEP, PINK_DARK, '#F7C3D0'] : [BLUSH, BLUSH_DEEP, '#B97B66', '#FFF1EA'];
  const ruffles = Array.from({ length: 14 }, (_, i) => {
    const deg = turn + i * 51;
    const rr = r * (0.12 + (i % 5) * 0.075);
    const [ax, ay] = polar(x, y, rr, deg - 40);
    const [bx, by] = polar(x, y, rr, deg + 40);
    const [cx, cy] = polar(x, y, rr * 1.45, deg);
    return <path key={i} d={`M${ax} ${ay}Q${cx} ${cy} ${bx} ${by}`} fill="none" stroke={i % 3 ? light : mid} strokeWidth={r1(r * 0.07)} strokeLinecap="round" />;
  });
  return (
    <g>
      {ellipsePetals(x, y, r, 8, 0.52, 0.5, 0.4, turn + 10, deep)}
      {ellipsePetals(x, y, r, 7, 0.45, 0.46, 0.38, turn + 35, mid)}
      {ellipsePetals(x, y, r, 6, 0.3, 0.38, 0.32, turn, base)}
      <circle cx={x} cy={y} r={r1(r * 0.42)} fill={u(tone === 'pink' ? 'peony' : 'peony-blush')} />
      {ruffles}
      <circle cx={x} cy={y} r={r1(r * 0.08)} fill={deep} opacity=".6" />
    </g>
  );
}

/** A tulip cup, stem downward at `deg` (0 = upright). */
function Tulip({ x, y, s, deg = 0, color = '#C8455E', dark = '#8C2239' }: { x: number; y: number; s: number; deg?: number; color?: string; dark?: string }) {
  return (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <path d={`M${x} ${y + s * 1.9}Q${x + s * 0.1} ${y + s} ${x} ${y + s * 0.6}`} stroke={GREEN_LIGHT} strokeWidth={r1(s * 0.14)} fill="none" />
      <path d={`M${x - s * 0.62} ${y - s * 0.5}Q${x - s * 0.72} ${y + s * 0.62} ${x} ${y + s * 0.66}Q${x + s * 0.72} ${y + s * 0.62} ${x + s * 0.62} ${y - s * 0.5}L${x + s * 0.3} ${y - s * 0.1}L${x} ${y - s * 0.72}L${x - s * 0.3} ${y - s * 0.1}Z`} fill={dark} />
      <path d={`M${x - s * 0.66} ${y - s * 0.62}Q${x - s * 0.62} ${y + s * 0.6} ${x + s * 0.06} ${y + s * 0.64}Q${x + s * 0.22} ${y + s * 0.02} ${x - s * 0.02} ${y - s * 0.52}Q${x - s * 0.32} ${y - s * 0.36} ${x - s * 0.66} ${y - s * 0.62}Z`} fill={color} />
      <path d={`M${x + s * 0.66} ${y - s * 0.6}Q${x + s * 0.6} ${y + s * 0.6} ${x - s * 0.04} ${y + s * 0.64}Q${x - s * 0.16} ${y + s * 0.05} ${x + s * 0.08} ${y - s * 0.44}Q${x + s * 0.36} ${y - s * 0.32} ${x + s * 0.66} ${y - s * 0.6}Z`} fill={color} opacity=".86" />
      <path d={`M${x - s * 0.4} ${y - s * 0.3}Q${x - s * 0.38} ${y + s * 0.3} ${x - s * 0.1} ${y + s * 0.5}`} stroke="#fff" strokeWidth={r1(s * 0.05)} opacity=".25" fill="none" />
    </g>
  );
}

/** A ranunculus: a tight spiral of cupped petals. */
function Ranunculus({ x, y, r, u }: { x: number; y: number; r: number; u: Url }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={u('ranunculus')} />
      {Array.from({ length: 7 }, (_, k) => {
        const rr = r * (0.92 - k * 0.13);
        const [cx, cy] = polar(x, y, r * 0.04 * k, 200);
        return <circle key={k} cx={cx} cy={cy} r={r1(rr)} fill="none" stroke="#B9765A" strokeWidth={r1(r * 0.035)} opacity={0.35 + k * 0.06} />;
      })}
      <circle cx={x} cy={y} r={r1(r * 0.12)} fill="#8E4A33" opacity=".5" />
    </g>
  );
}

/** A long leaf blade from (x, y) at `deg`, curled by `bend`. */
function Blade({ x, y, len, deg, bend = 16, w = 0.22, tone = GREEN }: { x: number; y: number; len: number; deg: number; bend?: number; w?: number; tone?: string }) {
  const [tx, ty] = polar(x, y, len, deg + bend);
  const [a1x, a1y] = polar(x, y, len * 0.55, deg - (w * 100) / 2 + bend * 0.3);
  const [a2x, a2y] = polar(x, y, len * 0.55, deg + (w * 100) / 2 + bend * 0.3);
  const [mx, my] = polar(x, y, len * 0.5, deg + bend * 0.4);
  return (
    <g>
      <path d={`M${x} ${y}Q${a1x} ${a1y} ${tx} ${ty}Q${a2x} ${a2y} ${x} ${y}Z`} fill={tone} />
      <path d={`M${x} ${y}Q${mx} ${my} ${tx} ${ty}`} stroke={GREEN_LIGHT} strokeWidth={r1(len * 0.018)} fill="none" opacity=".7" />
    </g>
  );
}

/** The top-left arrangement (viewBox 0 0 300 300). */
function TopArrangement({ u }: { u: Url }) {
  return (
    <g filter={u('shadow')}>
      <Blade x={40} y={40} len={170} deg={52} bend={-22} w={0.3} tone={GREEN_DARK} />
      <Blade x={30} y={80} len={190} deg={22} bend={18} w={0.26} />
      <Blade x={80} y={30} len={150} deg={78} bend={24} w={0.24} tone={GREEN_LIGHT} />
      <Blade x={110} y={90} len={120} deg={8} bend={-26} w={0.22} tone={GREEN} />
      <Tulip x={218} y={120} s={34} deg={-58} />
      <Tulip x={150} y={214} s={30} deg={-150} color="#E9C46A" dark="#B98A2E" />
      <Ranunculus x={170} y={150} r={30} u={u} />
      <Peony x={92} y={96} r={86} turn={12} u={u} />
      <Peony x={36} y={196} r={44} tone="blush" turn={-20} u={u} />
      <Ranunculus x={140} y={36} r={22} u={u} />
    </g>
  );
}

/** The bottom-right arrangement (viewBox 0 0 300 300). */
function BottomArrangement({ u }: { u: Url }) {
  return (
    <g filter={u('shadow')}>
      <Blade x={260} y={280} len={180} deg={-138} bend={20} w={0.28} tone={GREEN_DARK} />
      <Blade x={280} y={240} len={170} deg={-160} bend={-18} w={0.24} />
      <Blade x={220} y={290} len={150} deg={-112} bend={-24} w={0.26} tone={GREEN_LIGHT} />
      <Tulip x={96} y={170} s={36} deg={-35} />
      <Tulip x={150} y={96} s={30} deg={-12} color="#D98AA0" dark="#9C4A62" />
      <Ranunculus x={122} y={222} r={32} u={u} />
      <Peony x={214} y={196} r={92} tone="blush" turn={-8} u={u} />
      <Peony x={262} y={86} r={48} turn={30} u={u} />
    </g>
  );
}

/** A night moth (viewBox 0 0 100 70). */
function Moth() {
  return (
    <g>
      <path d="M50 30C36 10 12 6 6 16c-6 11 10 22 44 18z" fill="#CDBB9B" />
      <path d="M50 30C64 10 88 6 94 16c6 11-10 22-44 18z" fill="#CDBB9B" />
      <path d="M50 34C38 40 24 56 30 62c6 6 16-6 20-24z" fill="#A89274" />
      <path d="M50 34C62 40 76 56 70 62c-6 6-16-6-20-24z" fill="#A89274" />
      <circle cx="24" cy="20" r="5" fill="#8A6F52" />
      <circle cx="24" cy="20" r="2" fill="#F4D6C7" />
      <circle cx="76" cy="20" r="5" fill="#8A6F52" />
      <circle cx="76" cy="20" r="2" fill="#F4D6C7" />
      <ellipse cx="50" cy="36" rx="4" ry="14" fill="#6E5A44" />
      <path d="M48 24c-4-8-10-12-16-14M52 24c4-8 10-12 16-14" stroke="#6E5A44" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  );
}


export default function MidnightBloom({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const rand = rng(11);
  const motes = Array.from({ length: 16 }, () => [r1(rand() * 100), r1(rand() * 60), r1(0.25 + rand() * 0.5)] as const);
  return (
    <>
      <Layer
        style={{
          background:
            'radial-gradient(80cqmin 70cqmin at 18% 14%, rgba(120,72,40,.32), rgba(120,72,40,0) 70%),' +
            'radial-gradient(70cqmin 60cqmin at 86% 92%, rgba(160,80,100,.16), rgba(160,80,100,0) 70%),' +
            'radial-gradient(120cqw 90cqh at 50% 50%, transparent 55%, rgba(0,0,0,.45))',
        }}
      />
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('peony')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#F9D0DA" />
            <stop offset=".7" stopColor={PINK} />
            <stop offset="1" stopColor={PINK_DEEP} />
          </radialGradient>
          <radialGradient id={ref('peony-blush')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFF4EE" />
            <stop offset=".7" stopColor={BLUSH} />
            <stop offset="1" stopColor={BLUSH_DEEP} />
          </radialGradient>
          <radialGradient id={ref('ranunculus')} cx=".42" cy=".4" r=".6">
            <stop offset="0" stopColor="#FFE3CF" />
            <stop offset=".6" stopColor="#F2B48F" />
            <stop offset="1" stopColor="#C87852" />
          </radialGradient>
          <linearGradient id={ref('foil')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--inv-accent, #E8A33D) 50%, #FFF3D6)' }} />
            <stop offset=".45" style={{ stopColor: GOLD }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--inv-accent, #E8A33D) 60%, #3A2408)' }} />
          </linearGradient>
          <filter id={ref('shadow')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity=".55" />
          </filter>
        </defs>
      </svg>
      <Frame inset={card ? '5cqmin' : '4.5cqmin'}>
        <rect x="0" y="0" width="100%" height="100%" fill="none" stroke={url('foil')} strokeWidth="1.6" />
      </Frame>
      <Frame inset={card ? '6.4cqmin' : '6cqmin'}>
        <rect x="0" y="0" width="100%" height="100%" fill="none" stroke={url('foil')} strokeWidth=".7" opacity=".7" />
      </Frame>
      <Piece vb={[0, 0, 300, 300]} style={{ left: cm(-12), top: cm(-12), width: cm(card ? 46 : 70) }}>
        <TopArrangement u={url} />
      </Piece>
      <Piece vb={[0, 0, 300, 300]} style={{ right: cm(-12), bottom: cm(-12), width: cm(card ? 44 : 66) }}>
        <BottomArrangement u={url} />
      </Piece>
      <Piece vb={[0, 0, 100, 70]} anim="sway" style={{ right: cm(12), top: cm(card ? 8 : 12), width: cm(card ? 10 : 14), rotate: '14deg' }}>
        <Moth />
      </Piece>
      <Piece vb={[0, 0, 100, 60]} anim="twinkle" style={{ left: 0, top: 0, width: '100%' }}>
        {motes.map(([x, y, rr], i) => (
          <circle key={i} cx={x} cy={y} r={rr} style={{ fill: GOLD }} opacity={0.25 + (i % 4) * 0.12} />
        ))}
      </Piece>
    </>
  );
}
