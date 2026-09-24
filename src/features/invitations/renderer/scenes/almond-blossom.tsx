import { Layer, Piece, cm, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Almond Blossom — the first bloom against a pale winter sky: dark bark branches reaching in from the
 * top-left and the bottom-right, five-petal blossoms with blush hearts and stamens, buds, petals
 * drifting down, and a thin moon circle around the names. The blush follows the accent.
 */
const BARK = '#5A4036';
const BARK_DEEP = '#3E2B24';
const BLUSH = 'var(--inv-accent, #D9849B)';
const PETAL = '#FFFFFF';
const BLUSH_DEEP = 'color-mix(in srgb, var(--inv-accent, #D9849B) 70%, #5A2030)';

type Url = (name: string) => string;

/** A five-petal almond blossom. */
function Blossom({ x, y, r, turn = 0, u }: { x: number; y: number; r: number; turn?: number; u: Url }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => {
        const deg = a + turn;
        const [cx, cy] = polar(x, y, r * 0.52, deg);
        return (
          <ellipse
            key={a}
            cx={cx}
            cy={cy}
            rx={r1(r * 0.5)}
            ry={r1(r * 0.42)}
            transform={`rotate(${deg} ${cx} ${cy})`}
            fill={u('petal')}
          />
        );
      })}
      <circle cx={x} cy={y} r={r1(r * 0.3)} style={{ fill: BLUSH }} opacity=".75" />
      {Array.from({ length: 9 }, (_, i) => {
        const [sx, sy] = polar(x, y, r * 0.42, i * 40 + turn);
        return (
          <g key={i}>
            <path d={`M${x} ${y}L${sx} ${sy}`} style={{ stroke: BLUSH_DEEP }} strokeWidth={r1(r * 0.03)} />
            <circle cx={sx} cy={sy} r={r1(r * 0.05)} fill="#E8B04A" />
          </g>
        );
      })}
      <circle cx={x} cy={y} r={r1(r * 0.1)} style={{ fill: BLUSH_DEEP }} />
    </g>
  );
}

function Bud({ x, y, r, deg }: { x: number; y: number; r: number; deg: number }) {
  return (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <path d={`M${x} ${y + r}C${x - r} ${y} ${x - r * 0.6} ${y - r * 1.2} ${x} ${y - r * 1.4}C${x + r * 0.6} ${y - r * 1.2} ${x + r} ${y} ${x} ${y + r}Z`} style={{ fill: BLUSH }} />
      <path d={`M${x} ${y - r * 1.3}C${x + r * 0.4} ${y - r * 0.8} ${x + r * 0.4} ${y} ${x} ${y + r * 0.8}`} stroke="#fff" strokeWidth={r1(r * 0.25)} opacity=".5" fill="none" />
      <path d={`M${x - r * 0.6} ${y + r * 0.9}Q${x} ${y + r * 0.4} ${x + r * 0.6} ${y + r * 0.9}`} stroke={BARK} strokeWidth={r1(r * 0.4)} fill="none" />
    </g>
  );
}

/** A gnarled branch with blossoms (viewBox 0 0 400 300), growing from the top-left corner. */
function Branch({ u, seed }: { u: Url; seed: number }) {
  const rand = rng(seed);
  const flowers: [number, number, number, number][] = [
    [120, 64, 22, 10],
    [168, 96, 17, -20],
    [214, 118, 24, 34],
    [262, 132, 15, 5],
    [300, 160, 20, -8],
    [84, 116, 18, 22],
    [58, 170, 14, 0],
    [190, 58, 13, 40],
    [340, 188, 12, 14],
  ];
  return (
    <g>
      <path d="M-20 20C40 34 90 60 150 88S260 140 360 196" stroke={BARK_DEEP} strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M-20 20C40 34 90 60 150 88S260 140 360 196" stroke={BARK} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M100 70C90 100 76 130 50 180" stroke={BARK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M180 104c10-20 12-36 8-54" stroke={BARK} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M268 146c20-2 40 6 60 20" stroke={BARK} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {flowers.map(([x, y, r, t], i) => (
        <Blossom key={i} x={x} y={y} r={r} turn={t + rand() * 20} u={u} />
      ))}
      <Bud x={236} y={90} r={7} deg={-30} />
      <Bud x={70} y={146} r={6} deg={-160} />
      <Bud x={318} y={152} r={6} deg={-50} />
      <Bud x={372} y={206} r={5} deg={60} />
    </g>
  );
}

export default function AlmondBlossom({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const rand = rng(17);
  const petals = Array.from({ length: 9 }, () => [r1(rand() * 100), r1(rand() * 100), r1(rand() * 360), r1(0.8 + rand() * 0.8)] as const);
  const moon = card ? '52cqmin' : 'min(84cqmin, 62cqh)';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('petal')} cx=".2" cy=".5" r=".9">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--inv-accent, #D9849B) 40%, #fff)' }} />
            <stop offset=".45" stopColor={PETAL} />
            <stop offset="1" stopColor="#F7F1EE" />
          </radialGradient>
          <filter id={ref('soft')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#3E2F2A" floodOpacity=".18" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'radial-gradient(70cqw 40cqh at 50% 0%, rgba(255,255,255,.45), transparent 70%),' +
            'radial-gradient(90cqw 50cqh at 50% 100%, rgba(217,132,155,.12), transparent 70%)',
        }}
      />
      {/* the moon circle */}
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          top: '50%',
          width: moon,
          aspectRatio: '1',
          translate: '-50% -52%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,.55) 0 60%, rgba(255,255,255,.2) 70%, transparent 71%)',
          boxShadow: '0 0 0 1px rgba(255,255,255,.9), 0 0 0 1.4cqmin rgba(255,255,255,.18), 0 0 8cqmin rgba(255,255,255,.35)',
        }}
      />
      <Piece vb={[0, 0, 400, 300]} anim="sway" style={{ left: cm(-6), top: cm(-4), width: cm(card ? 58 : 92) }}>
        <g filter={url('soft')}>
          <Branch u={url} seed={2} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 400, 300]} style={{ right: cm(-8), bottom: cm(-6), width: cm(card ? 44 : 70), scale: '-1 -1' }}>
        <g filter={url('soft')}>
          <Branch u={url} seed={6} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 100, 100]} anim="drift" fit="xMidYMid slice" style={{ inset: 0, width: '100%', height: '100%' }}>
        {petals.map(([x, y, a, s], i) => (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={r1(1.4 * s)}
            ry={s}
            transform={`rotate(${a} ${x} ${y})`}
            style={{ fill: i % 3 ? '#fff' : 'color-mix(in srgb, var(--inv-accent, #D9849B) 45%, #fff)' }}
            opacity=".9"
          />
        ))}
      </Piece>
    </>
  );
}
