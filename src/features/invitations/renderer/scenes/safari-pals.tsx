import { Layer, Piece, cm, cmh, leafPath, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Safari Pals — a warm morning on the savanna for the littlest ones: a big smiling sun with turning
 * rays between palm fronds hanging in from one corner and a giraffe peeking in from the other; below
 * the names, a lion cub in a bow tie and a baby elephant holding a balloon in the tall grass, a far
 * acacia and butterflies. The bow tie, the balloon and the butterflies follow the accent.
 */
const ACCENT = 'var(--inv-accent, #E2762C)';
const INK = '#3A2817';
const FUR = '#F4B75A';
const FUR_LIGHT = '#FDDFA4';
const MANE = '#D8812F';
const MANE_DEEP = '#B9652A';
const GRAY = '#A9B7C9';
const GRAY_DEEP = '#8B9BB0';
const PINK = '#F3B3BD';
const GIRAFFE = '#F7C75E';
const SPOT = '#D98A3A';
const BLUSH = '#F0857A';

type Url = (name: string) => string;

/** A sitting lion cub, facing us (viewBox 0 0 200 214). */
function LionCub({ u }: { u: Url }) {
  const mane = Array.from({ length: 14 }, (_, i) => polar(100, 84, 47, i * (360 / 14) - 90));
  return (
    <g>
      {/* tail with its tuft */}
      <path
        d="M140 198c28 4 44-12 40-40"
        stroke={MANE_DEEP}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M180 166c-9-5-11-17-3-25 9 4 11 17 3 25z" fill={MANE} />
      {/* body, haunches, front legs and paws */}
      <path d="M56 208c-8-46 14-86 44-86s52 40 44 86z" fill={u('fur')} />
      <ellipse cx="58" cy="192" rx="22" ry="18" fill={FUR} />
      <ellipse cx="142" cy="192" rx="22" ry="18" fill={FUR} />
      <ellipse cx="100" cy="170" rx="20" ry="24" fill={FUR_LIGHT} />
      <rect x="72" y="150" width="22" height="58" rx="11" fill={FUR} />
      <rect x="106" y="150" width="22" height="58" rx="11" fill={FUR} />
      <path
        d="M78 208v-6M84 208v-6M90 208v-6M110 208v-6M116 208v-6M122 208v-6"
        stroke={MANE_DEEP}
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".5"
      />
      {/* mane: a ring of tufts */}
      {mane.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="17" fill={i % 2 ? MANE : MANE_DEEP} />
      ))}
      <circle cx="100" cy="84" r="50" fill={MANE} />
      {/* ears */}
      <circle cx="68" cy="50" r="13" fill={FUR} />
      <circle cx="132" cy="50" r="13" fill={FUR} />
      <circle cx="68" cy="51" r="6.5" fill="#F2A77A" />
      <circle cx="132" cy="51" r="6.5" fill="#F2A77A" />
      {/* face */}
      <circle cx="100" cy="88" r="40" fill={u('fur')} />
      <ellipse cx="90" cy="106" rx="14" ry="11" fill="#FFF1D6" />
      <ellipse cx="110" cy="106" rx="14" ry="11" fill="#FFF1D6" />
      <path d="M91 95h18c0 7-5 11-9 11s-9-4-9-11z" fill="#6B3A1F" />
      <path
        d="M100 106v5M92 112c4 4 12 4 16 0"
        stroke="#6B3A1F"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="84" cy="81" r="5.6" fill={INK} />
      <circle cx="116" cy="81" r="5.6" fill={INK} />
      <circle cx="86" cy="79" r="1.9" fill="#fff" />
      <circle cx="118" cy="79" r="1.9" fill="#fff" />
      <ellipse cx="71" cy="99" rx="7" ry="4.5" fill={BLUSH} opacity=".45" />
      <ellipse cx="129" cy="99" rx="7" ry="4.5" fill={BLUSH} opacity=".45" />
      {/* bow tie on the chest */}
      <g stroke="#6B3A1F" strokeWidth="1.4" strokeLinejoin="round" strokeOpacity=".35">
        <path d="M100 142l-23-12v24zM100 142l23-12v24z" style={{ fill: ACCENT }} />
        <circle cx="100" cy="142" r="6.5" style={{ fill: ACCENT }} />
      </g>
      <path d="M82 135v14M118 135v14" stroke="#fff" strokeWidth="2" opacity=".35" strokeLinecap="round" />
    </g>
  );
}

/** A baby elephant facing left, trunk up with a balloon on a string (viewBox 0 0 240 300). */
function BabyElephant({ u }: { u: Url }) {
  return (
    <g>
      {/* the balloon sways on its string, tied to the trunk */}
      <g data-anim="sway">
        <path d="M44 150C38 120 52 96 46 70" stroke="#8C7A66" strokeWidth="1.6" fill="none" />
        <path d="M46 70c-20 0-32-18-32-36S28 0 46 0s32 16 32 34-12 36-32 36z" style={{ fill: ACCENT }} />
        <path d="M42 70h8l-4 6z" style={{ fill: ACCENT }} />
        <ellipse cx="36" cy="22" rx="7" ry="11" fill="#fff" opacity=".35" transform="rotate(-24 36 22)" />
      </g>
      {/* back legs and tail */}
      <rect x="160" y="238" width="26" height="54" rx="12" fill={GRAY_DEEP} />
      <rect x="196" y="236" width="24" height="54" rx="12" fill={GRAY_DEEP} />
      <path
        d="M226 206c10 2 14 12 10 20"
        stroke={GRAY_DEEP}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* body */}
      <path
        d="M82 236c0-50 38-82 86-82s70 30 70 70c0 26-14 40-36 40H108c-16 0-26-10-26-28z"
        fill={u('hide')}
      />
      {/* front legs with toenails */}
      <rect x="92" y="236" width="28" height="60" rx="13" fill={GRAY} />
      <rect x="128" y="238" width="26" height="58" rx="12" fill={GRAY} />
      {[98, 106, 114, 134, 141, 148].map((x) => (
        <ellipse key={x} cx={x} cy="292" rx="3.4" ry="2.6" fill="#F4F0E6" />
      ))}
      {/* head with a tuft, ear, trunk */}
      <circle cx="92" cy="180" r="50" fill={u('hide')} />
      <path
        d="M84 131c-2-8 2-14 6-16M92 131c0-8 4-13 9-14"
        stroke={GRAY_DEEP}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M112 138c34-14 66 6 64 42-2 32-28 50-56 42-14-4-18-18-16-36z" fill={GRAY_DEEP} />
      <path d="M118 150c24-8 46 6 44 32-2 22-20 34-40 28-8-3-10-12-9-24z" fill={PINK} />
      <path
        d="M58 200C36 206 28 190 34 170S44 150 44 150"
        stroke={GRAY}
        strokeWidth="19"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M36 168c-4 0-8 3-8 7M34 184c-4 1-7 4-7 7"
        stroke={GRAY_DEEP}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="80" cy="170" r="6" fill={INK} />
      <circle cx="82" cy="168" r="2" fill="#fff" />
      <path d="M71 162l-4-4M76 159l-2-5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="94" cy="194" rx="9" ry="5.5" fill={BLUSH} opacity=".4" />
      <path d="M68 214c4 4 10 4 14 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Irregular giraffe patches. */
const PATCHES: [number, number, number][] = [
  [150, 112, 11],
  [178, 128, 12],
  [206, 146, 13],
  [232, 168, 12],
  [160, 146, 8],
  [192, 172, 10],
  [222, 204, 11],
  [236, 132, 7],
];

/** A giraffe leaning in from the right edge, its long neck off-frame (viewBox 0 0 240 240). */
function Giraffe({ u }: { u: Url }) {
  return (
    <g>
      {/* neck, its mane along the top and patches */}
      <path d="M252 240C220 196 176 150 124 128l-18-50c54 10 110 52 146 100z" fill={u('giraffe')} />
      <path
        d="M252 170C220 128 176 94 120 80"
        stroke="#B8692A"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M252 176C220 134 176 100 120 86"
        stroke="#C9772F"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="1 5"
      />
      {PATCHES.map(([x, y, s], i) => (
        <path
          key={i}
          d={`M${x - s} ${y - s * 0.2}Q${x - s * 0.7} ${y - s} ${x + s * 0.1} ${y - s * 0.9}Q${x + s} ${y - s * 0.6} ${x + s * 0.9} ${y + s * 0.2}Q${x + s * 0.6} ${y + s} ${x - s * 0.2} ${y + s * 0.8}Q${x - s} ${y + s * 0.6} ${x - s} ${y - s * 0.2}Z`}
          fill={SPOT}
          opacity=".9"
        />
      ))}
      {/* ossicones and ears */}
      <path d="M70 42l-8-26M96 38l4-26" stroke="#B8753A" strokeWidth="6" strokeLinecap="round" />
      <circle cx="61" cy="14" r="6.5" fill="#8E5427" />
      <circle cx="101" cy="10" r="6.5" fill="#8E5427" />
      <path d="M46 58c-20-8-32 0-34 6 10 6 24 6 36 0z" fill={GIRAFFE} />
      <path d="M118 52c18-10 32-4 36 2-8 8-24 10-36 6z" fill={GIRAFFE} />
      <path
        d="M44 60c-10-2-18 0-24 4M120 56c10-4 18-4 26-1"
        stroke={SPOT}
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".6"
      />
      {/* head: forehead and long, soft muzzle */}
      <path
        d="M50 52c12-18 52-20 66-2 8 12 6 32 2 48l-4 22c-4 16-18 26-32 26s-30-10-32-26l-4-28c-2-16-2-30 4-40z"
        fill={u('giraffe')}
      />
      <path d="M52 116c0-16 14-24 32-24s32 8 32 24-14 32-32 32-32-16-32-32z" fill="#FBE3B0" />
      <circle cx="74" cy="118" r="3.6" fill="#8E5427" />
      <circle cx="94" cy="118" r="3.6" fill="#8E5427" />
      <path d="M72 132c7 7 18 7 24 0" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="68" cy="74" r="7.4" fill={INK} />
      <circle cx="102" cy="74" r="7.4" fill={INK} />
      <circle cx="70.5" cy="71" r="2.5" fill="#fff" />
      <circle cx="104.5" cy="71" r="2.5" fill="#fff" />
      <path
        d="M59 66l-5-4M63 61l-3-5M111 66l5-4M107 61l3-5"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="85" cy="50" r="7" fill={SPOT} opacity=".8" />
      <ellipse cx="56" cy="96" rx="7" ry="4.5" fill={BLUSH} opacity=".4" />
      <ellipse cx="114" cy="96" rx="7" ry="4.5" fill={BLUSH} opacity=".4" />
    </g>
  );
}

/** One palm frond from (0, 0): an arching rib with narrow drooping leaflets. */
function Frond({ deg, len, tone, rib }: { deg: number; len: number; tone: string; rib: string }) {
  const [cx, cy] = polar(0, 0, len * 0.55, deg - 6);
  const [ex, ey] = polar(0, 0, len, deg + 26);
  const leaves: string[] = [];
  const n = 15;
  for (let i = 2; i <= n; i++) {
    const t = i / (n + 1);
    const x = 2 * (1 - t) * t * cx + t * t * ex;
    const y = 2 * (1 - t) * t * cy + t * t * ey;
    const a =
      (Math.atan2(2 * (1 - t) * cy + 2 * t * (ey - cy), 2 * (1 - t) * cx + 2 * t * (ex - cx)) * 180) /
      Math.PI;
    const l = 10 + 44 * Math.sin(Math.PI * (0.12 + 0.8 * t));
    leaves.push(leafPath(r1(x), r1(y), a + 48, l, 4.6, 14), leafPath(r1(x), r1(y), a - 40, l * 0.9, 4.6, 10));
  }
  return (
    <g>
      <path d={leaves.join('')} fill={tone} />
      <path
        d={`M0 0Q${cx} ${cy} ${ex} ${ey}`}
        stroke={rib}
        strokeWidth="3.6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Palm fronds hanging in from the top-left corner (viewBox 0 0 260 230). */
function Fronds() {
  return (
    <g transform="translate(-8 -8)">
      <Frond deg={2} len={250} tone="#3E8A3F" rib="#2F6E33" />
      <Frond deg={70} len={210} tone="#3E8A3F" rib="#2F6E33" />
      <Frond deg={24} len={250} tone="#5BA64C" rib="#3E8A3F" />
      <Frond deg={48} len={236} tone="#72B957" rib="#4E9A47" />
      <circle r="20" fill="#8A5A2E" />
      <circle cx="12" cy="16" r="7" fill="#6B4322" />
      <circle cx="20" cy="4" r="6" fill="#6B4322" />
    </g>
  );
}

/** A clump of savanna grass rising from y=100, 7 blades around x. */
function Clump({ x, seed, tone, h }: { x: number; seed: number; tone: string; h: number }) {
  const rand = rng(seed);
  const blades = Array.from({ length: 7 }, (_, i) => {
    const bx = x + i * 11 - 33 + rand() * 6;
    const bh = h * (0.6 + rand() * 0.4);
    const lean = (i - 3) * 5 + (rand() - 0.5) * 10;
    return `M${r1(bx - 5)} 100Q${r1(bx - 2)} ${r1(100 - bh * 0.6)} ${r1(bx + lean)} ${r1(100 - bh)}Q${r1(bx + 2)} ${r1(100 - bh * 0.5)} ${r1(bx + 5)} 100Z`;
  });
  return <path d={blades.join('')} fill={tone} />;
}

/** A far acacia, flat-topped (drawn around x, standing on y). */
function Acacia({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#B59A58">
      <path d="M-3 0c1-14 0-26-6-38l4-1c5 9 7 17 7 25 2-10 7-18 14-24l3 3c-8 8-12 18-13 35z" />
      <path d="M-62-38c6-12 26-18 44-16 10-8 30-8 40 0 18-2 34 4 40 16-10 6-30 8-44 6-12 4-30 4-42 0-16 2-32 0-38-6z" />
    </g>
  );
}

function Butterfly({ delay }: { delay: string }) {
  return (
    <g data-anim="orbit" style={{ animationDelay: delay }}>
      <path d="M20 20C10 4 0 8 2 18s12 8 18 2zM20 20c10-16 20-12 18-2s-12 8-18 2z" style={{ fill: ACCENT }} />
      <path
        d="M20 20c-6 4-10 14-4 16s6-10 4-16zM20 20c6 4 10 14 4 16s-6-10-4-16z"
        style={{ fill: ACCENT }}
        opacity=".75"
      />
      <path d="M20 14v14M20 14l-4-6M20 14l4-6" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

export default function SafariPals({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const ground = card ? '30cqh' : '21cqh';
  // the sun, centred high in the sky (the poster writes its text higher: a tighter sky there)
  const sun = card ? cm(20) : poster ? cm(22) : cmh(25);
  const sunY = card ? cm(17) : poster ? cm(16) : cmh(23);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('fur')} cx=".42" cy=".32" r=".8">
            <stop offset="0" stopColor="#FFD58A" />
            <stop offset=".7" stopColor={FUR} />
            <stop offset="1" stopColor="#E29E45" />
          </radialGradient>
          <radialGradient id={ref('hide')} cx=".38" cy=".3" r=".85">
            <stop offset="0" stopColor="#C3CFDC" />
            <stop offset=".7" stopColor={GRAY} />
            <stop offset="1" stopColor={GRAY_DEEP} />
          </radialGradient>
          <linearGradient id={ref('giraffe')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#FFD77A" />
            <stop offset="1" stopColor={GIRAFFE} />
          </linearGradient>
          <radialGradient id={ref('sun')} cx=".5" cy=".42" r=".6">
            <stop offset="0" stopColor="#FFEBAA" />
            <stop offset=".75" stopColor="#FFCD5E" />
            <stop offset="1" stopColor="#FFB547" />
          </radialGradient>
          <filter id={ref('soft')} x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#7A4A1E" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      {/* warm light: around the sun, and low over the grass */}
      <Layer
        style={{
          background:
            `radial-gradient(calc(${sun} * 2.4) calc(${sun} * 2) at 50% ${sunY}, rgba(255,222,140,.8), rgba(255,222,140,0) 70%),` +
            'radial-gradient(90cqw 30cqh at 50% 100%, rgba(255,205,120,.55), rgba(255,205,120,0) 70%)',
        }}
      />
      {/* the sun: rays turn slowly around its smiling face */}
      <Piece
        vb={[-100, -100, 200, 200]}
        anim="spin"
        style={{ left: '50%', top: sunY, width: `calc(${sun} * 1.7)`, translate: '-50% -50%' }}
      >
        {Array.from({ length: 16 }, (_, i) => {
          const [x1, y1] = polar(0, 0, 66, i * 22.5);
          const [x2, y2] = polar(0, 0, i % 2 ? 84 : 94, i * 22.5);
          return (
            <path
              key={i}
              d={`M${x1} ${y1}L${x2} ${y2}`}
              stroke="#FFC857"
              strokeWidth={i % 2 ? 7 : 10}
              strokeLinecap="round"
              opacity=".85"
            />
          );
        })}
      </Piece>
      <Piece vb={[-60, -60, 120, 120]} style={{ left: '50%', top: sunY, width: sun, translate: '-50% -50%' }}>
        <circle r="56" fill={url('sun')} />
        <path
          d="M-26-6q8-9 16 0M10-6q8-9 16 0M-12 12q12 12 24 0"
          stroke="#B8651E"
          strokeWidth="3.6"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="-32" cy="10" rx="8" ry="5" fill="#F79A5C" opacity=".5" />
        <ellipse cx="32" cy="10" rx="8" ry="5" fill="#F79A5C" opacity=".5" />
      </Piece>
      {/* a cloud drifting past the sun, a pair of birds */}
      <Piece
        vb={[0, 0, 300, 100]}
        anim="drift"
        style={{
          left: '50%',
          top: `calc(${sunY} + ${sun} * 0.12)`,
          width: `calc(${sun} * 2.4)`,
          translate: '-50% 0',
        }}
      >
        <path
          d="M40 86c-20 0-24-26-4-30 2-20 28-26 40-12 8-16 36-14 38 6 18-2 24 22 6 36z"
          fill="#fff"
          opacity=".92"
        />
        <path
          d="M204 70c-12 0-15-16-3-19 1-12 18-16 25-7 6-10 22-8 23 4 11-1 15 14 4 22z"
          fill="#fff"
          opacity=".85"
        />
        <path
          d="M232 20q6-6 12 0q6-6 12 0M262 8q4-4 8 0q4-4 8 0"
          stroke="#8C6A48"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      </Piece>
      {/* savanna hills with a far acacia */}
      <Piece
        vb={[0, 0, 1200, 300]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? '40cqh' : '28cqh' }}
      >
        <path d="M0 150C160 110 330 128 470 142S760 112 900 124 1110 150 1200 132V300H0Z" fill="#F2CD86" />
        <Acacia x={520} y={146} s={0.9} />
        <Acacia x={960} y={132} s={0.6} />
        <path d="M0 196C200 164 420 180 620 188S1000 160 1200 178V300H0Z" fill="#E8BD6E" />
      </Piece>
      {/* the grass: clumps swaying on their own */}
      <Piece
        vb={[0, 0, 1200, 110]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: ground }}
      >
        {Array.from({ length: 14 }, (_, i) => (
          <g key={i} data-anim="sway" style={{ animationDelay: `${-i * 0.9}s` }}>
            <Clump x={40 + i * 86} seed={i + 1} tone={['#C8B75A', '#A9BE55', '#D6B45C'][i % 3]!} h={80} />
          </g>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <Clump key={i} x={80 + i * 96} seed={i + 40} tone={i % 2 ? '#8DB64B' : '#7DA844'} h={48} />
        ))}
        <path d="M0 98C300 92 600 95 900 93S1100 95 1200 96V110H0Z" fill="#7DA844" />
      </Piece>
      {/* palm fronds hanging in from the corner (they sweep on their corner) */}
      <Piece
        vb={[0, 0, 260, 230]}
        anim="sweep"
        style={{ left: 0, top: 0, width: cm(card ? 30 : 46), transformOrigin: '0 0' }}
      >
        <g filter={url('soft')}>
          <Fronds />
        </g>
      </Piece>
      {/* the giraffe peeks in from the other side */}
      <Piece
        vb={[0, 0, 240, 240]}
        anim="wiggle"
        style={{
          right: cm(-3),
          top: card ? cm(10) : poster ? cm(5) : cm(11),
          width: cm(card ? 24 : poster ? 36 : 40),
          transformOrigin: '100% 100%',
        }}
      >
        <g filter={url('soft')}>
          <Giraffe u={url} />
        </g>
      </Piece>
      {/* the pals */}
      <Piece
        vb={[0, 0, 200, 214]}
        style={{ left: cm(card ? 4 : 3), bottom: card ? '4cqh' : '3cqh', width: cm(card ? 22 : 36) }}
      >
        <g filter={url('soft')}>
          <LionCub u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 240, 300]}
        style={{ right: cm(card ? 3 : 1), bottom: card ? '3cqh' : '2cqh', width: cm(card ? 24 : 40) }}
      >
        <g filter={url('soft')}>
          <BabyElephant u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 40, 40]}
        style={{ left: cm(card ? 30 : 40), bottom: `calc(${ground} + ${cm(2)})`, width: cm(card ? 5 : 7) }}
      >
        <Butterfly delay="-1.5s" />
      </Piece>
      <Piece
        vb={[0, 0, 40, 40]}
        style={{
          left: cm(card ? 36 : 50),
          bottom: `calc(${ground} + ${cm(9)})`,
          width: cm(card ? 4 : 5),
          rotate: '14deg',
        }}
      >
        <Butterfly delay="-4s" />
      </Piece>
    </>
  );
}
