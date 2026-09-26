import { Layer, Piece, ch, cm, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Vineyard Harvest — golden hour seen from under a pergola: a low sun and its rays over hazy hills,
 * a farmhouse and a line of cypresses, vine rows running in perspective down the near hill; vine leaves
 * (some already turning gold) and grape clusters hang from the beam, a gnarled vine climbs the corner,
 * two glasses clink on an oak barrel and fireflies drift in the warm air. The grapes and the wine follow
 * the accent (merlot, chardonnay and rosé presets).
 */
const WINE = 'var(--inv-accent, #7A2140)';
const WINE_DEEP = 'color-mix(in srgb, var(--inv-accent, #7A2140) 62%, #140610)';
const WINE_LIGHT = 'color-mix(in srgb, var(--inv-accent, #7A2140) 58%, #FFF1E6)';
const LEAF = '#6B8A3A';
const LEAF_DARK = '#4A6428';
const LEAF_GOLD = '#C99A36';
const LEAF_RUST = '#B8622F';
const OAK = '#7A4A26';
const HOOP = '#3B2C24';

type Url = (name: string) => string;

/** A five-lobed vine leaf, stem at (x, y), pointing toward `deg` (−90 = up), `s` ≈ its radius. */
function VineLeaf({
  x,
  y,
  s,
  deg = -90,
  fill = LEAF,
}: {
  x: number;
  y: number;
  s: number;
  deg?: number;
  fill?: string;
}) {
  const pts: string[] = [];
  for (let a = 0; a < 360; a += 4) {
    const th = (a * Math.PI) / 180;
    // five lobes (peaks at 0°, ±72°, ±144° from the tip), serrated, with a deep sinus at the stem
    let r = 0.74 + 0.26 * Math.cos(5 * th) + 0.05 * Math.cos(15 * th);
    const fromStem = Math.abs(a - 180);
    r *= 1 - 0.45 * Math.exp(-((fromStem / 20) ** 2));
    // the tip lobe points up in the leaf's frame: angle a is measured from the tip
    const px = Math.sin(th) * r * s;
    const py = -Math.cos(th) * r * s - s * 0.9;
    pts.push(`${r1(px)} ${r1(py)}`);
  }
  const veins = [0, 72, -72, 144, -144].map((a) => {
    const th = (a * Math.PI) / 180;
    const len = a === 0 ? 1.05 : Math.abs(a) === 72 ? 0.95 : 0.62;
    return `M0 ${r1(-s * 0.35)}L${r1(Math.sin(th) * s * len)} ${r1(-Math.cos(th) * s * len - s * 0.9)}`;
  });
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg + 90})`}>
      <path d={`M0 0L0 ${r1(-s * 0.72)}`} stroke="#5A4A22" strokeWidth={r1(s * 0.07)} strokeLinecap="round" />
      <path d={`M${pts.join('L')}Z`} fill={fill} />
      <path d={veins.join('')} stroke="#FFF3C8" strokeWidth={r1(s * 0.035)} opacity=".45" fill="none" />
    </g>
  );
}

/** A grape cluster hanging from (x, y): rows of berries tapering to a point, a curly tendril. */
function Grapes({ x, y, s, u }: { x: number; y: number; s: number; u: Url }) {
  const berries: [number, number][] = [];
  const rows = [4, 5, 4, 4, 3, 3, 2, 1];
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      berries.push([x + (i - (n - 1) / 2) * s * 1.7 + (row % 2) * s * 0.3, y + s * 1.2 + row * s * 1.45]);
    }
  });
  return (
    <g>
      <path
        d={`M${x} ${y - s * 1.6}Q${x + s * 0.4} ${y - s * 0.4} ${x} ${y + s}`}
        stroke="#6A5226"
        strokeWidth={r1(s * 0.35)}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${x} ${y - s * 0.6}c${s * 1.6} ${-s * 0.4} ${s * 2.4} ${s * 0.8} ${s * 1.6} ${s * 1.6}s${-s * 1.4} ${s * 0.2} ${-s * 0.8} ${-s * 0.6}`}
        stroke="#7A8A3A"
        strokeWidth={r1(s * 0.16)}
        fill="none"
        strokeLinecap="round"
      />
      {berries.map(([bx, by], i) => (
        <circle key={i} cx={r1(bx)} cy={r1(by)} r={r1(s * 0.98)} fill={u('grape')} />
      ))}
      {berries.map(([bx, by], i) =>
        i % 2 ? null : (
          <circle
            key={`h${i}`}
            cx={r1(bx - s * 0.32)}
            cy={r1(by - s * 0.34)}
            r={r1(s * 0.22)}
            fill="#fff"
            opacity=".45"
          />
        ),
      )}
    </g>
  );
}

/** Vines hanging from the top-left of the pergola (viewBox 0 0 240 200). */
function Hanging({ u, rich }: { u: Url; rich: boolean }) {
  return (
    <g>
      <path
        d="M-10 8C40 20 70 6 110 14S180 30 250 10"
        stroke="#6A5226"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <VineLeaf x={18} y={10} s={30} deg={112} fill={LEAF_DARK} />
      <VineLeaf x={62} y={14} s={36} deg={78} />
      <VineLeaf x={118} y={16} s={26} deg={100} fill={rich ? LEAF_GOLD : LEAF} />
      {rich ? <VineLeaf x={168} y={22} s={22} deg={62} fill={LEAF_RUST} /> : null}
      <VineLeaf x={206} y={16} s={18} deg={96} fill={LEAF_DARK} />
      <Grapes x={92} y={30} s={6.2} u={u} />
      {rich ? <Grapes x={148} y={34} s={4.8} u={u} /> : null}
    </g>
  );
}

/** A gnarled vine rising from the bottom-right corner with leaves and clusters (viewBox 0 0 220 300). */
function Vine({ u }: { u: Url }) {
  return (
    <g>
      <path
        d="M190 306C182 250 198 220 176 176S120 132 112 96"
        stroke="#5E4526"
        strokeWidth="11"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M176 178C150 170 120 176 96 196"
        stroke="#5E4526"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <VineLeaf x={112} y={100} s={34} deg={-120} />
      <VineLeaf x={150} y={150} s={30} deg={-40} fill={LEAF_GOLD} />
      <VineLeaf x={98} y={194} s={28} deg={-150} fill={LEAF_DARK} />
      <VineLeaf x={186} y={214} s={26} deg={-20} />
      <VineLeaf x={126} y={78} s={20} deg={-70} fill={LEAF_RUST} />
      <Grapes x={132} y={170} s={7.6} u={u} />
      <Grapes x={82} y={202} s={6} u={u} />
    </g>
  );
}

/** An oak barrel with two glasses clinking on its head (viewBox 0 0 200 240). */
function Barrel({ u }: { u: Url }) {
  const staves = [44, 62, 80, 100, 120, 138, 156];
  return (
    <g>
      <ellipse cx="100" cy="232" rx="84" ry="8" fill="#3A2210" opacity=".3" />
      <path d="M34 110C24 150 24 186 34 226H166C176 186 176 150 166 110Z" fill={u('oak')} />
      {staves.map((x) => (
        <path
          key={x}
          d={`M${x} 110C${x + (x - 100) * 0.16} 150 ${x + (x - 100) * 0.16} 186 ${x} 226`}
          stroke="#4E2E16"
          strokeWidth="1.2"
          opacity=".55"
          fill="none"
        />
      ))}
      {[124, 146, 190, 212].map((y) => {
        const bulge = y > 140 && y < 196 ? 6 : 3;
        return (
          <path
            key={y}
            d={`M${34 - bulge} ${y}H${166 + bulge}`}
            stroke={HOOP}
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
      })}
      <ellipse cx="100" cy="110" rx="66" ry="12" fill="#B07A48" />
      <ellipse cx="100" cy="110" rx="56" ry="9" fill="none" stroke="#7A4E28" strokeWidth="1.4" />
      {/* the glasses, tilted toward each other */}
      {[
        [74, 9],
        [126, -9],
      ].map(([x, tilt], i) => (
        <g key={i} transform={`rotate(${tilt} ${x} 108)`}>
          <ellipse cx={x} cy="108" rx="13" ry="3" fill="#F3EDE4" opacity=".8" />
          <path d={`M${x! - 1.2} 108V84h2.4V108Z`} fill="#F3EDE4" opacity=".9" />
          <path
            d={`M${x! - 16} 42C${x! - 17} 68 ${x! - 10} 84 ${x} 84S${x! + 17} 68 ${x! + 16} 42Z`}
            fill="#FFFFFF"
            opacity=".22"
            stroke="#FFFFFF"
            strokeOpacity=".7"
            strokeWidth="1.2"
          />
          <path
            d={`M${x! - 15.4} 60C${x! - 14} 74 ${x! - 8} 83 ${x} 83S${x! + 14} 74 ${x! + 15.4} 60Z`}
            style={{ fill: WINE }}
          />
          <ellipse cx={x} cy="60" rx="15.4" ry="2.6" style={{ fill: WINE_LIGHT }} />
          <path
            d={`M${x! - 10} 48C${x! - 11} 58 ${x! - 9} 68 ${x! - 5} 74`}
            stroke="#fff"
            strokeWidth="1.6"
            opacity=".6"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

/** A small burst where the glasses touch (viewBox 0 0 40 40). */
function Clink() {
  return (
    <g fill="#FFF6D8">
      <path d="M20 2Q21 19 38 20Q21 21 20 38Q19 21 2 20Q19 19 20 2Z" />
      <circle cx="31" cy="8" r="1.8" />
      <circle cx="8" cy="31" r="1.4" />
    </g>
  );
}

/** Hazy far hills, a farmhouse and cypresses, and the vine rows down the near hill (viewBox 0 0 1200 400). */
function Valley({ u }: { u: Url }) {
  const line = (f: (x: number) => number, from = -60, to = 1260, step = 20) => {
    const pts: string[] = [];
    for (let x = from; x <= to; x += step) pts.push(`${x} ${r1(f(x))}`);
    return pts;
  };
  const far = (x: number) => 46 + 14 * Math.sin(x / 190 + 2) + 6 * Math.sin(x / 70);
  const mid = (x: number) => 104 + 18 * Math.sin(x / 150 + 0.6);
  const near = (x: number) => 176 + 22 * Math.sin(x / 210 + 3.6);
  const hill = (f: (x: number) => number) => `M${line(f).join('L')}L1260 400L-60 400Z`;
  // rows of vines on the near hill: from the vanishing point toward the foot, bushes growing nearer
  const vp = [600, 20] as const;
  const rows = Array.from({ length: 19 }, (_, i) => -1700 + i * 250);
  const bushes: [number, number, number][] = [];
  for (const bx of rows) {
    for (let k = 0; k < 16; k++) {
      const t = 0.26 + (k / 15) ** 1.3 * 0.84;
      const x = vp[0] + (bx - vp[0]) * t;
      const y = vp[1] + (440 - vp[1]) * t;
      if (y < near(x) + 4 || y > 420) continue;
      bushes.push([r1(x), r1(y), r1(2 + 15 * t ** 1.6)]);
    }
  }
  const cypress = (x: number, h: number) => {
    const b = mid(x) + 4;
    return `M${x} ${r1(b)}Q${x - h * 0.13} ${r1(b - h * 0.5)} ${x} ${r1(b - h)}Q${x + h * 0.13} ${r1(b - h * 0.5)} ${x} ${r1(b)}Z`;
  };
  return (
    <g>
      <path d={hill((x) => far(x) - 16)} fill="#E6C9A6" opacity=".75" />
      <path d={hill(far)} fill="#D9BE98" />
      <path d={hill(mid)} fill={u('mid-hill')} />
      {[1, 2, 3, 4, 5, 6].map((k) => (
        <path
          key={k}
          d={`M${line((x) => mid(x) + k * 10 + k * k * 0.8).join('L')}`}
          stroke="#8C8A48"
          strokeWidth={1.6 + k * 0.5}
          strokeDasharray={`${1 + k * 0.4} ${5 + k * 1.4}`}
          strokeLinecap="round"
          fill="none"
          opacity=".7"
        />
      ))}
      {/* the farmhouse and its cypresses */}
      <g transform="translate(-128 0)">
        <path d="M506 104h58v-24h-58z" fill="#EAD5B2" />
        <path d="M500 82l35-18 35 18z" fill="#B7653E" />
        <path d="M562 104h24V88h-24z" fill="#E0C79F" />
        <path d="M558 90l16-9 16 9z" fill="#A85A36" />
        {[520, 540].map((x) => (
          <path key={x} d={`M${x} 88h7v8h-7z`} fill="#6B4A36" opacity=".8" />
        ))}
      </g>
      {[
        [250, 46],
        [352, 50],
        [366, 60],
        [792, 56],
        [806, 44],
        [930, 50],
        [946, 38],
      ].map(([x, h]) => (
        <path key={x} d={cypress(x!, h!)} fill="#56642F" />
      ))}
      <path d={hill(near)} fill={u('near-hill')} />
      <g clipPath={u('near-clip')}>
        {rows.map((bx) => (
          <path key={bx} d={`M${vp[0]} ${vp[1]}L${bx} 440`} stroke="#4E5A26" strokeWidth="2" opacity=".35" />
        ))}
        {bushes.map(([x, y, s], i) => (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={r1(s * 1.25)}
            ry={r1(s * 0.8)}
            fill={i % 3 ? '#556B2A' : '#6E8534'}
          />
        ))}
      </g>
    </g>
  );
}

export default function VineyardHarvest({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const size = (n: number, h: number) => `min(${n}cqmin, ${h}cqh)`;
  const rand = rng(41);
  const flies = Array.from(
    { length: 9 },
    () => [r1(rand() * 100), r1(rand() * 100), r1(0.6 + rand() * 0.9)] as const,
  );
  const nearHill = (x: number) => 176 + 22 * Math.sin(x / 210 + 3.6);
  const clip: string[] = [];
  for (let x = -60; x <= 1260; x += 20) clip.push(`${x} ${r1(nearHill(x))}`);
  // the valley band: its top edge is ~54% down; the sun sets behind the far hills at the right
  const band = card ? 44 : 38;
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('grape')} cx=".35" cy=".35" r=".7">
            <stop offset="0" style={{ stopColor: WINE_LIGHT }} />
            <stop offset=".55" style={{ stopColor: WINE }} />
            <stop offset="1" style={{ stopColor: WINE_DEEP }} />
          </radialGradient>
          <linearGradient id={ref('oak')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#5A3418" />
            <stop offset=".35" stopColor="#9A6436" />
            <stop offset=".7" stopColor={OAK} />
            <stop offset="1" stopColor="#4A2A14" />
          </linearGradient>
          <linearGradient id={ref('mid-hill')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#C9BE82" />
            <stop offset=".4" stopColor="#AFA866" />
          </linearGradient>
          <linearGradient id={ref('near-hill')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#A2A45A" />
            <stop offset=".5" stopColor="#7E8A40" />
            <stop offset="1" stopColor="#5E6A2E" />
          </linearGradient>
          <radialGradient id={ref('sun-glow')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFF4D6" stopOpacity=".95" />
            <stop offset=".3" stopColor="#FFD890" stopOpacity=".5" />
            <stop offset="1" stopColor="#FFC870" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ref('fly')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFFBE0" />
            <stop offset=".3" stopColor="#FFE58A" stopOpacity=".9" />
            <stop offset="1" stopColor="#FFD24A" stopOpacity="0" />
          </radialGradient>
          <clipPath id={ref('near-clip')}>
            <path d={`M${clip.join('L')}L1260 420L-60 420Z`} />
          </clipPath>
          <filter id={ref('soft')} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3A2410" floodOpacity=".3" />
          </filter>
        </defs>
      </svg>
      {/* golden-hour sky */}
      <Layer
        style={{
          background:
            'linear-gradient(180deg, #FAF0DA 0%, #F8E6C2 28%, #F4D6A2 46%, #EFC286 56%, #EBB57A 62%)',
        }}
      />
      {/* the sun behind the far hills, its rays sweeping */}
      <Piece
        vb={[0, 0, 200, 200]}
        anim="sweep"
        style={{
          left: card ? '72%' : 'calc(50% + 26cqmin)',
          top: card ? '58%' : '63%',
          width: size(card ? 70 : 110, 90),
          translate: '-50% -50%',
          transformOrigin: '50% 50%',
        }}
      >
        {Array.from({ length: 12 }, (_, i) => {
          const a = -166 + i * (152 / 11);
          const [x1, y1] = polar(100, 100, 100, a - 2.2);
          const [x2, y2] = polar(100, 100, 100, a + 2.2);
          return <path key={i} d={`M100 100L${x1} ${y1}L${x2} ${y2}Z`} fill="#FFF6DC" opacity=".22" />;
        })}
      </Piece>
      <Piece
        vb={[0, 0, 200, 200]}
        anim="pulse"
        style={{
          left: card ? '72%' : 'calc(50% + 26cqmin)',
          top: card ? '58%' : '63%',
          width: size(card ? 40 : 58, 46),
          translate: '-50% -50%',
        }}
      >
        <circle cx="100" cy="100" r="100" fill={url('sun-glow')} />
        <circle cx="100" cy="100" r="22" fill="#FFF8E4" />
      </Piece>
      {/* swallows heading home */}
      <Piece
        vb={[0, 0, 120, 50]}
        anim="drift"
        style={{
          left: card ? '18%' : 'calc(50% - 40cqmin)',
          top: card ? '30%' : '26%',
          width: size(card ? 12 : 18, 14),
        }}
      >
        {[
          [18, 32, 1],
          [52, 16, 1.25],
          [84, 28, 0.8],
        ].map(([x, y, k], i) => (
          <path
            key={i}
            d={`M${x! - 9 * k!} ${y! - 2 * k!}Q${x! - 4 * k!} ${y! - 4 * k!} ${x} ${y}Q${x! + 4 * k!} ${y! - 4 * k!} ${x! + 9 * k!} ${y! - 2 * k!}`}
            stroke="#6B4A3A"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            opacity=".55"
          />
        ))}
      </Piece>
      {/* the valley */}
      <Piece
        vb={[0, 0, 1200, 400]}
        fit="xMidYMin slice"
        style={{
          left: 0,
          bottom: 0,
          width: '100%',
          height: ch(band),
          aspectRatio: 'auto',
          overflow: 'hidden',
        }}
      >
        <Valley u={url} />
      </Piece>
      {/* fireflies drifting over the rows */}
      {flies.map(([x, y, s], i) => (
        <Piece
          key={i}
          vb={[0, 0, 10, 10]}
          anim={i % 3 ? 'twinkle' : 'orbit'}
          style={{
            left: `${6 + x * 0.88}%`,
            top: `${(card ? 62 : 68) + y * 0.26}%`,
            width: cm(s * (card ? 1.6 : 2.2)),
            animationDelay: `${-i * 0.9}s`,
          }}
        >
          <circle cx="5" cy="5" r="5" fill={url('fly')} />
        </Piece>
      ))}
      {/* the barrel with the two glasses, and the vine in the other corner */}
      <Piece
        vb={[0, 0, 200, 240]}
        style={{ left: cm(card ? 3 : 2), bottom: cm(-2), width: size(card ? 22 : 34, 30) }}
      >
        <g filter={url('soft')}>
          <Barrel u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 40, 40]}
        anim="pop"
        style={{
          left: `calc(${cm(card ? 3 : 2)} + ${size(card ? 22 : 34, 30)} * .5)`,
          bottom: `calc(${cm(-2)} + ${size(card ? 22 : 34, 30)} * .99)`,
          width: size(card ? 4 : 6, 5),
          translate: '-50% 50%',
        }}
      >
        <Clink />
      </Piece>
      <Piece
        vb={[0, 0, 220, 300]}
        anim="sway"
        style={{ right: cm(-6), bottom: cm(-4), width: size(card ? 26 : 42, 38) }}
      >
        <g filter={url('soft')}>
          <Vine u={url} />
        </g>
      </Piece>
      {/* the pergola beam with vines and grapes hanging from it */}
      <Layer
        style={{
          top: poster ? cm(2) : cm(3),
          bottom: 'auto',
          height: cm(card ? 2 : 2.8),
          background: 'linear-gradient(180deg, #9A6A40, #6A4424 70%, #54341B)',
          boxShadow: '0 0.6cqmin 1.2cqmin rgba(70,40,15,.28)',
        }}
      />
      <Piece
        vb={[0, 0, 240, 200]}
        anim="sway"
        style={{
          left: cm(-4),
          top: cm(poster ? 2 : 3),
          width: size(card ? 38 : poster ? 50 : 60, 44),
          transformOrigin: '0 0',
        }}
      >
        <g filter={url('soft')}>
          <Hanging u={url} rich />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 240, 200]}
        anim="sway"
        style={{
          right: cm(-4),
          top: cm(poster ? 2 : 3),
          width: size(card ? 32 : poster ? 42 : 50, 38),
          transformOrigin: '100% 0',
          animationDelay: '-3s',
        }}
      >
        <g filter={url('soft')} transform="translate(240 0) scale(-1 1)">
          <Hanging u={url} rich={false} />
        </g>
      </Piece>
    </>
  );
}
