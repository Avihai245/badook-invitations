import { Layer, Piece, ch, cm, polar, r1, useIds, type SceneProps } from './kit';

/**
 * Grandma's Garden — an English cottage garden in soft morning light: beams from the top corner,
 * climbing roses hanging from above, a white picket fence with a robin on it and a teacup steaming on
 * a post, lavender and hollyhocks swaying, cabbage roses and daisies in the corners, a watering can on
 * the lawn and butterflies fluttering. The watering can and the teacup's band follow the accent (rose,
 * lavender and sage presets).
 */
const ACCENT = 'var(--inv-accent, #B04A68)';
const ACCENT_LIGHT = 'color-mix(in srgb, var(--inv-accent, #B04A68) 55%, #FFFFFF)';
const ACCENT_DEEP = 'color-mix(in srgb, var(--inv-accent, #B04A68) 72%, #1E0E14)';
const LEAF = '#6F9460';
const LEAF_DARK = '#557A4A';
const STEM = '#6E8A5E';

/** An almond leaf with a midrib, from (x, y) toward `deg`. */
function Leaf({
  x,
  y,
  deg,
  len,
  fill = LEAF,
}: {
  x: number;
  y: number;
  deg: number;
  len: number;
  fill?: string;
}) {
  const wid = len * 0.34;
  const [tx, ty] = polar(x, y, len, deg);
  const off = (Math.atan2(wid, len * 0.5) * 180) / Math.PI;
  const mid = Math.hypot(wid, len * 0.5);
  const [ax, ay] = polar(x, y, mid, deg - off);
  const [bx, by] = polar(x, y, mid, deg + off);
  return (
    <g>
      <path d={`M${x} ${y}Q${ax} ${ay} ${tx} ${ty}Q${bx} ${by} ${x} ${y}Z`} fill={fill} />
      <path d={`M${x} ${y}L${tx} ${ty}`} stroke="#EAF2DC" strokeWidth={r1(len * 0.03)} opacity=".5" />
    </g>
  );
}

const ROSES = {
  pink: ['#F8C9D2', '#EE9DB0', '#D36A86', '#B84868'],
  peach: ['#FBDCC6', '#F5B994', '#E68F6A', '#C86D4C'],
  cream: ['#FFF6E4', '#F6E2BE', '#E8C893', '#C9A266'],
} as const;

/** A cabbage rose seen from above: two rings of rounded petals and a swirled heart. */
function Rose({
  x,
  y,
  r,
  tone = 'pink',
  turn = 0,
}: {
  x: number;
  y: number;
  r: number;
  tone?: keyof typeof ROSES;
  turn?: number;
}) {
  const [light, mid, deep, dark] = ROSES[tone];
  const P = (rad: number, deg: number) => polar(x, y, r * rad, deg).join(' ');
  const ring = (n: number, rad: number, spread: number, fill: string, t: number) =>
    Array.from({ length: n }, (_, k) => {
      const a = t + (k * 360) / n;
      return (
        <path
          key={`${rad}${k}`}
          d={`M${P(rad * 0.2, a - spread)}Q${P(rad * 1.1, a - spread * 1.1)} ${P(rad, a)}Q${P(rad * 1.1, a + spread * 1.1)} ${P(rad * 0.2, a + spread)}Z`}
          fill={fill}
          stroke={dark}
          strokeOpacity=".22"
          strokeWidth={r1(r * 0.025)}
        />
      );
    });
  return (
    <g>
      {ring(5, 1, 44, light, turn)}
      {ring(5, 0.74, 42, mid, turn + 36)}
      <circle cx={x} cy={y} r={r1(r * 0.44)} fill={deep} />
      {[0.34, 0.24, 0.14].map((k, i) => (
        <path
          key={k}
          d={`M${P(k, turn + i * 70)}A${r1(r * k)} ${r1(r * k)} 0 1 1 ${P(k * 0.9, turn + i * 70 + 250)}`}
          fill="none"
          stroke={i % 2 ? mid : light}
          strokeWidth={r1(r * 0.07)}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/** A clump of lavender from (x, y): stems fanning out, spikes of tiny purple buds. */
function Lavender({ x, y, h, n = 7 }: { x: number; y: number; h: number; n?: number }) {
  const stems = [];
  for (let i = 0; i < n; i++) {
    const deg = -90 + (i - (n - 1) / 2) * (48 / n);
    const len = h * (0.78 + ((i * 37) % 5) * 0.055);
    const [tx, ty] = polar(x, y, len, deg);
    const buds = [];
    for (let k = 0; k < 9; k++) {
      const t = 0.62 + k * 0.045;
      const [bx, by] = polar(x, y, len * t, deg);
      for (const side of [-1, 1]) {
        const [px, py] = polar(bx, by, h * 0.022, deg + side * 90);
        buds.push(
          <ellipse
            key={`${k}${side}`}
            cx={px}
            cy={py}
            rx={r1(h * 0.02)}
            ry={r1(h * 0.03)}
            transform={`rotate(${r1(deg + 90 + side * 22)} ${px} ${py})`}
            fill={k % 3 ? '#8E7CC3' : k % 2 ? '#A898DA' : '#6F5BAE'}
          />,
        );
      }
    }
    stems.push(
      <g key={i}>
        <path d={`M${x} ${y}L${tx} ${ty}`} stroke={STEM} strokeWidth={r1(h * 0.012)} />
        {buds}
      </g>,
    );
  }
  return <g>{stems}</g>;
}

/** A daisy face-on. */
function Daisy({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      {Array.from({ length: 12 }, (_, k) => {
        const a = k * 30;
        const [cx, cy] = polar(x, y, r * 0.55, a);
        return (
          <ellipse
            key={k}
            cx={cx}
            cy={cy}
            rx={r1(r * 0.48)}
            ry={r1(r * 0.15)}
            transform={`rotate(${a} ${cx} ${cy})`}
            fill="#FFFFFF"
            stroke="#E4DCCB"
            strokeWidth={r1(r * 0.03)}
          />
        );
      })}
      <circle cx={x} cy={y} r={r1(r * 0.24)} fill="#F2C14E" />
      <circle cx={x - r * 0.06} cy={y - r * 0.06} r={r1(r * 0.1)} fill="#FBE08A" />
    </g>
  );
}

/** A hollyhock spike (viewBox 0 0 60 300), its foot on the bottom edge. */
function Hollyhock({ tone }: { tone: 'pink' | 'cream' }) {
  const [light, mid, deep] = ROSES[tone === 'pink' ? 'pink' : 'cream'];
  const blooms = [
    [30, 230, 17],
    [24, 196, 16],
    [36, 164, 15],
    [26, 134, 13],
    [34, 106, 11],
    [28, 82, 9],
  ];
  return (
    <g>
      <path d="M30 300C28 220 32 140 30 40" stroke={STEM} strokeWidth="3" fill="none" />
      <Leaf x={30} y={280} deg={-150} len={30} fill={LEAF_DARK} />
      <Leaf x={30} y={270} deg={-30} len={28} />
      {blooms.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={i % 2 ? mid : light} stroke={deep} strokeOpacity=".25" />
          <circle cx={x} cy={y} r={r! * 0.4} fill={deep} opacity=".55" />
          <circle cx={x} cy={y} r={r! * 0.14} fill="#FFF3C4" />
        </g>
      ))}
      {[
        [31, 60, 5],
        [29, 46, 4],
        [30, 36, 3],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r! * 1.3} fill="#8DAA6E" />
      ))}
    </g>
  );
}

/** A white picket fence across a wide band (viewBox 0 0 1600 200), its foot on the bottom edge. */
function Fence() {
  const pickets = [];
  for (let i = 0; i < 29; i++) {
    const x = 10 + i * 56;
    const post = i % 5 === 0;
    const w = post ? 44 : 36;
    const top = post ? 40 : 52 + (i % 2) * 6;
    pickets.push(
      <g key={i}>
        <path d={`M${x} 200V${top + 18}L${x + w / 2} ${top}L${x + w} ${top + 18}V200Z`} fill="#FCFBF8" />
        <path d={`M${x + w * 0.66} 200V${top + 12}L${x + w} ${top + 18}V200Z`} fill="#E8E3DA" />
        {post ? <circle cx={x + w / 2} cy={top - 6} r="10" fill="#FCFBF8" stroke="#E4DED3" /> : null}
      </g>,
    );
  }
  return (
    <g>
      <path d="M0 96H1600V112H0ZM0 160H1600V176H0Z" fill="#EEEAE2" />
      {pickets}
      <path d="M0 200H1600" stroke="#D9D2C4" strokeWidth="2" />
    </g>
  );
}

/** A butterfly (viewBox 0 0 60 50). */
function Butterfly({ colors }: { colors: [string, string, string] }) {
  const [wing, edge, spot] = colors;
  return (
    <g>
      <path d="M30 24C20 6 4 2 3 12S12 30 30 26Z" fill={wing} stroke={edge} strokeWidth="1.6" />
      <path d="M30 24C40 6 56 2 57 12S48 30 30 26Z" fill={wing} stroke={edge} strokeWidth="1.6" />
      <path d="M30 27C22 30 12 40 16 45S28 38 30 28Z" fill={wing} stroke={edge} strokeWidth="1.4" />
      <path d="M30 27C38 30 48 40 44 45S32 38 30 28Z" fill={wing} stroke={edge} strokeWidth="1.4" />
      <circle cx="14" cy="13" r="2.6" fill={spot} />
      <circle cx="46" cy="13" r="2.6" fill={spot} />
      <ellipse cx="30" cy="27" rx="1.8" ry="9" fill="#4A3B35" />
      <path d="M29 18C27 12 24 9 21 8M31 18C33 12 36 9 39 8" stroke="#4A3B35" strokeWidth="1.1" fill="none" />
    </g>
  );
}

/** A teacup on its saucer (viewBox 0 0 100 60). */
function Teacup() {
  return (
    <g>
      <ellipse cx="50" cy="52" rx="42" ry="6.5" fill="#FFFFFF" stroke="#DDD5C8" strokeWidth="1.2" />
      <ellipse cx="50" cy="51" rx="22" ry="3" fill="#EFE8DC" />
      <path d="M22 16H78C78 38 66 50 50 50S22 38 22 16Z" fill="#FFFFFF" stroke="#DDD5C8" strokeWidth="1.2" />
      <path
        d="M78 22C92 20 94 36 76 38"
        stroke="#E4DDD1"
        strokeWidth="4.4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="50" cy="16" rx="28" ry="4.4" fill="#C98E5A" stroke="#D9B26B" strokeWidth="1.4" />
      <path d="M25 26H75" style={{ stroke: ACCENT }} strokeWidth="3.4" />
      {[33, 50, 67].map((x) => (
        <circle key={x} cx={x} cy="35" r="3.2" style={{ fill: ACCENT_LIGHT }} />
      ))}
    </g>
  );
}

/** A watering can (viewBox 0 0 140 100), standing on the bottom edge. */
function WateringCan() {
  return (
    <g>
      <ellipse cx="62" cy="96" rx="44" ry="4" fill="#3A4A2E" opacity=".2" />
      <path d="M92 58L128 24" style={{ stroke: ACCENT_DEEP }} strokeWidth="8" strokeLinecap="round" />
      <path d="M122 16L138 30L132 36L116 22Z" style={{ fill: ACCENT_DEEP }} />
      <path d="M26 34H98L94 94H30Z" style={{ fill: ACCENT }} />
      <path d="M30 34H44L41 94H33Z" fill="#FFFFFF" opacity=".25" />
      <path d="M22 34H102" style={{ stroke: ACCENT_DEEP }} strokeWidth="5" strokeLinecap="round" />
      <path d="M40 34C40 10 84 10 84 34" fill="none" style={{ stroke: ACCENT_DEEP }} strokeWidth="6" />
      <path d="M26 60C12 58 10 80 28 80" fill="none" style={{ stroke: ACCENT_DEEP }} strokeWidth="5" />
    </g>
  );
}

/** A robin perched, facing left (viewBox 0 0 60 50). */
function Robin() {
  return (
    <g>
      <path d="M44 30L58 36L46 38Z" fill="#6B5040" />
      <ellipse cx="32" cy="28" rx="17" ry="13" fill="#8A6A52" />
      <path d="M17 26C18 36 26 41 34 40C28 34 26 28 28 20C22 19 18 22 17 26Z" fill="#E07A45" />
      <circle cx="20" cy="17" r="9" fill="#8A6A52" />
      <path d="M13 17C14 23 19 26 24 25C21 22 21 18 23 14C19 12 14 13 13 17Z" fill="#E07A45" />
      <path d="M11 16L5 18L11 19Z" fill="#3A2A20" />
      <circle cx="17" cy="14" r="1.5" fill="#1E1612" />
      <path d="M30 41V47M36 41V47" stroke="#6B5040" strokeWidth="1.4" />
    </g>
  );
}

/** Climbing roses hanging into the top-left corner (viewBox 0 0 260 200). */
function Climber({ rich }: { rich: boolean }) {
  return (
    <g>
      <path
        d="M-10 6C40 30 60 24 100 40S150 90 160 150M60 26C80 60 70 100 84 140"
        stroke="#6E6A44"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <Leaf x={40} y={22} deg={100} len={26} fill={LEAF_DARK} />
      <Leaf x={96} y={40} deg={60} len={24} />
      <Leaf x={70} y={70} deg={160} len={22} fill={LEAF_DARK} />
      <Leaf x={140} y={96} deg={20} len={22} />
      <Leaf x={80} y={118} deg={140} len={20} />
      <Leaf x={156} y={138} deg={60} len={18} fill={LEAF_DARK} />
      <Rose x={34} y={34} r={26} tone="pink" turn={10} />
      <Rose x={110} y={62} r={20} tone="cream" turn={-20} />
      {rich ? <Rose x={78} y={104} r={16} tone="pink" turn={40} /> : null}
      <Rose x={154} y={122} r={12} tone="peach" turn={5} />
      <ellipse cx="86" cy="146" rx="5" ry="7" fill="#D36A86" />
      <ellipse cx="162" cy="156" rx="4" ry="6" fill="#E68F6A" />
    </g>
  );
}

/** A corner bed: roses, leaves, daisies and lavender (viewBox 0 0 260 240), rising from the bottom. */
function Bed({ rich }: { rich: boolean }) {
  return (
    <g>
      <g data-anim="sway">
        <Lavender x={196} y={250} h={170} n={8} />
      </g>
      <Leaf x={60} y={200} deg={-120} len={46} fill={LEAF_DARK} />
      <Leaf x={100} y={210} deg={-60} len={44} />
      <Leaf x={140} y={200} deg={-20} len={40} fill={LEAF_DARK} />
      <Leaf x={40} y={170} deg={-150} len={36} />
      <Leaf x={130} y={150} deg={-40} len={34} fill={LEAF_DARK} />
      <Rose x={70} y={170} r={38} tone="pink" turn={15} />
      <Rose x={138} y={196} r={30} tone={rich ? 'peach' : 'pink'} turn={-25} />
      {rich ? <Rose x={28} y={214} r={24} tone="cream" turn={40} /> : null}
      <Daisy x={170} y={150} r={14} />
      <Daisy x={112} y={120} r={11} />
      {rich ? <Daisy x={24} y={140} r={10} /> : null}
    </g>
  );
}

export default function GrandmaGarden({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const size = (n: number, h: number) => `min(${n}cqmin, ${h}cqh)`;
  // the fence's foot is 6% up; its top ~22% above the foot on a phone
  const fenceH = card ? 26 : 20;
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('lawn')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#A4C08A" />
            <stop offset="1" stopColor="#7A9E66" />
          </linearGradient>
          <filter id={ref('soft')} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#5A4A3A" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      {/* soft morning sky, the sun just above the top-left corner */}
      <Layer
        style={{
          background:
            'radial-gradient(70cqmin 60cqmin at 10% 0%, rgba(255,247,218,.95), rgba(255,247,218,0) 70%),' +
            'linear-gradient(180deg, #E6EFF6 0%, #F1F1F1 36%, #FAF2E9 60%, #FCEDE0 76%)',
        }}
      />
      <Piece
        vb={[0, 0, 200, 200]}
        anim="sweep"
        style={{ left: cm(-6), top: cm(-6), width: size(card ? 80 : 120, 110), transformOrigin: '0 0' }}
      >
        {[18, 30, 42, 56, 70].map((a, i) => {
          const [x1, y1] = polar(0, 0, 220, a - 2.6);
          const [x2, y2] = polar(0, 0, 220, a + 2.6);
          return (
            <path key={a} d={`M0 0L${x1} ${y1}L${x2} ${y2}Z`} fill="#FFFBEA" opacity={0.28 - i * 0.03} />
          );
        })}
      </Piece>
      {/* the hedge behind the fence */}
      <Piece
        vb={[0, 0, 1200, 120]}
        fit="xMidYMax slice"
        style={{
          left: 0,
          bottom: ch(card ? 18 : 16),
          width: '100%',
          height: ch(card ? 20 : 14),
          aspectRatio: 'auto',
          overflow: 'hidden',
        }}
      >
        <path
          d="M0 70C40 30 90 40 120 56C150 20 220 24 250 52C290 18 350 26 380 60C420 30 480 34 510 58C550 22 620 26 650 54C690 26 750 30 780 60C820 24 890 28 920 56C960 30 1020 34 1050 60C1090 26 1160 30 1200 56V120H0Z"
          fill="#C3D3B0"
        />
        <path
          d="M0 92C50 66 100 70 140 84C190 58 250 62 290 86C340 60 400 64 440 88C490 60 560 66 600 88C650 62 710 66 750 88C800 62 860 66 900 88C950 62 1010 68 1050 88C1100 64 1160 68 1200 86V120H0Z"
          fill="#AFC49B"
        />
      </Piece>
      {/* the lawn and the fence */}
      <Layer
        style={{
          top: 'auto',
          height: ch(card ? 20 : 17),
          background: `linear-gradient(180deg, #A4C08A, #7A9E66)`,
        }}
      />
      <Piece
        vb={[0, 0, 1600, 200]}
        fit="xMidYMax slice"
        style={{
          left: 0,
          bottom: ch(card ? 12 : 9),
          width: '100%',
          height: ch(fenceH),
          aspectRatio: 'auto',
          overflow: 'hidden',
        }}
      >
        <Fence />
      </Piece>
      {/* hollyhocks against the fence at both sides */}
      {(['left', 'right'] as const).map((edge, i) => (
        <Piece
          key={edge}
          vb={[0, 0, 60, 300]}
          anim="sway"
          style={{
            [edge]: card ? '6%' : 'max(3cqmin, calc(50% - 46cqmin))',
            bottom: ch(card ? 12 : 9),
            height: ch(card ? 60 : poster ? 42 : 46),
            aspectRatio: '60 / 300',
            animationDelay: i ? '-2.2s' : '0s',
          }}
        >
          <Hollyhock tone={i ? 'cream' : 'pink'} />
        </Piece>
      ))}
      {/* a robin on the fence, a teacup steaming on a post */}
      <Piece
        vb={[0, 0, 60, 50]}
        anim="wiggle"
        style={{
          left: card ? '64%' : 'calc(50% + 12cqmin)',
          bottom: `calc(${ch(card ? 12 : 9)} + ${ch(fenceH * 0.72)})`,
          width: size(card ? 7 : 10, 9),
        }}
      >
        <Robin />
      </Piece>
      <Piece
        vb={[0, 0, 100, 60]}
        style={{
          left: card ? '24%' : 'calc(50% - 30cqmin)',
          bottom: `calc(${ch(card ? 12 : 9)} + ${ch(fenceH * 0.78)})`,
          width: size(card ? 11 : 15, 13),
        }}
      >
        <Teacup />
      </Piece>
      {card
        ? null
        : [0, 1].map((k) => (
            <Piece
              key={k}
              vb={[0, 0, 20, 40]}
              anim="rise"
              style={{
                left: `calc(50% - 30cqmin + ${size(15, 13)} * ${0.36 + k * 0.2})`,
                bottom: `calc(${ch(9)} + ${ch(fenceH * 0.78)} + ${size(9, 8)})`,
                width: size(3, 2.6),
                animationDelay: `${-k * 4.5}s`,
              }}
            >
              <path
                d="M10 38C4 30 16 24 10 16S12 6 10 2"
                stroke="#FFFFFF"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
                opacity=".9"
              />
            </Piece>
          ))}
      {/* the corner beds and the watering can */}
      <Piece vb={[0, 0, 260, 240]} style={{ left: cm(-8), bottom: cm(-6), width: size(card ? 34 : 56, 44) }}>
        <g filter={url('soft')}>
          <Bed rich />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 140, 100]}
        style={{
          right: card ? '18%' : 'max(12cqmin, calc(50% - 30cqmin))',
          bottom: ch(card ? 3 : 2.5),
          width: size(card ? 16 : 24, 20),
        }}
      >
        <WateringCan />
      </Piece>
      <Piece
        vb={[0, 0, 260, 240]}
        style={{ right: cm(-10), bottom: cm(-7), width: size(card ? 30 : 50, 40) }}
      >
        <g filter={url('soft')} transform="translate(260 0) scale(-1 1)">
          <Bed rich={false} />
        </g>
      </Piece>
      {/* climbing roses from the top corners */}
      <Piece
        vb={[0, 0, 260, 200]}
        anim="sway"
        style={{
          left: cm(-4),
          top: cm(-3),
          width: size(card ? 36 : poster ? 50 : 58, 42),
          transformOrigin: '0 0',
        }}
      >
        <g filter={url('soft')}>
          <Climber rich />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 260, 200]}
        anim="sway"
        style={{
          right: cm(-5),
          top: cm(-4),
          width: size(card ? 30 : poster ? 42 : 48, 36),
          transformOrigin: '100% 0',
          animationDelay: '-3s',
        }}
      >
        <g filter={url('soft')} transform="translate(260 0) scale(-1 1)">
          <Climber rich={false} />
        </g>
      </Piece>
      {/* butterflies */}
      {(
        [
          ['orbit', '74%', '19%', ['#F6DC74', '#C79A2E', '#FFF6D0'], '0s'],
          ['float', '16%', '72%', ['#A9C8EC', '#5F86B8', '#FFFFFF'], '-2s'],
          ['drift', '82%', '66%', ['#F7C1A2', '#D67C55', '#FFF1E6'], '-6s'],
        ] as const
      ).map(([anim, left, top, colors, delay], i) => (
        <Piece
          key={i}
          vb={[0, 0, 60, 50]}
          anim={anim}
          style={{
            left,
            top: card ? `calc(${top} - 6%)` : top,
            width: size(card ? 6 : i ? 8 : 9, 7),
            rotate: `${[-12, 10, -6][i]}deg`,
            animationDelay: delay,
          }}
        >
          <Butterfly colors={colors as unknown as [string, string, string]} />
        </Piece>
      ))}
    </>
  );
}
