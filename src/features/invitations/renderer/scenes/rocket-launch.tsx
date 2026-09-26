import type { CSSProperties } from 'react';
import { Layer, Piece, cm, cmh, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Rocket Launch — a night in space: a twinkling starfield with violet and teal nebulae, a cratered
 * moon with a little planet circling it, a ringed planet floating, a comet, a waving astronaut, and
 * below the names a rocket lifting off a small purple world on a flickering flame, in clouds of
 * smoke. The rocket's nose, fins and stripe (and the astronaut's patch) follow the accent.
 */
const ACCENT = 'var(--inv-accent, #FF8A3D)';
const SUIT = '#F4F5FA';
const SUIT_SHADE = '#C9CCDD';
const VISOR = '#1E2A63';
const MOON = '#F6F0D8';
const CRATER = '#DDD4B2';

type Url = (name: string) => string;

/** A four-point sparkle centred on (x, y). */
const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

/** The starfield (viewBox 0 0 1000 1000, sliced): dots in three twinkling groups, a few sparkles. */
function Stars() {
  const rand = rng(11);
  const groups: string[][] = [[], [], []];
  for (let i = 0; i < 150; i++) {
    const x = r1(rand() * 1000);
    const y = r1(rand() * 1000);
    // quieter behind the names: fewer, smaller stars in the middle
    const middle = x > 280 && x < 720 && y > 320 && y < 690;
    if (middle && rand() < 0.6) continue;
    const r = r1((middle ? 0.8 : 1) + rand() * (middle ? 0.8 : 1.8));
    groups[i % 3]!.push(`M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`);
  }
  const sparkles: [number, number, number][] = [
    [120, 90, 9],
    [860, 560, 8],
    [90, 610, 7],
    [560, 110, 6],
    [930, 250, 7],
    [250, 900, 6],
    [700, 860, 7],
  ];
  return (
    <g fill="#fff">
      {groups.map((d, i) => (
        <path
          key={i}
          d={d.join('')}
          data-anim="twinkle"
          style={{ animationDelay: `${-i * 0.9}s` }}
          opacity={0.9 - i * 0.15}
        />
      ))}
      {sparkles.map(([x, y, s], i) => (
        <path
          key={i}
          d={sparkle(x, y, s)}
          fill="#FFF6C8"
          data-anim="twinkle"
          style={{ animationDelay: `${-i * 0.7}s` }}
        />
      ))}
    </g>
  );
}

/** The moon with its craters, and a little planet circling it (viewBox -140 -140 280 280). */
function Moon({ u }: { u: Url }) {
  return (
    <g>
      <circle r="112" fill={u('moonglow')} />
      <circle r="78" fill={u('moon')} />
      {[
        [-26, -30, 14],
        [22, -8, 20],
        [-30, 24, 10],
        [10, 38, 9],
        [40, -42, 7],
        [-4, 4, 6],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={CRATER} />
          <path
            d={`M${x! - r!} ${y}a${r} ${r} 0 0 0 ${r! * 2} 0`}
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            opacity=".55"
            transform={`rotate(200 ${x} ${y})`}
          />
        </g>
      ))}
      {/* the orbit and the planet riding it: the group turns on its box's centre — the moon's, as an
          unpainted circle as wide as the planet's path keeps the box centred */}
      <circle r="120" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="3 9" opacity=".35" />
      <g data-anim="spin" style={{ transformOrigin: 'center', animationDuration: '24s' }}>
        <circle r="131" fill="none" />
        <circle cx="120" r="11" fill="#4FD1C5" />
        <path d="M112 -4a11 11 0 0 0 16 12" stroke="#2BA89D" strokeWidth="4" fill="none" />
      </g>
    </g>
  );
}

/** A ringed planet (viewBox -100 -64 200 128): the ring's back half, the planet, the front half. */
function RingedPlanet({ u }: { u: Url }) {
  return (
    <g transform="rotate(-16)">
      <path d="M-86 0a86 20 0 0 1 172 0" fill="none" stroke="#FFE08A" strokeWidth="9" opacity=".75" />
      <circle r="42" fill={u('planet')} />
      <path
        d="M-40-12c20 6 60 6 80 0M-42 8c24 6 60 6 84 0"
        stroke="#F06A5C"
        strokeWidth="6"
        fill="none"
        opacity=".55"
      />
      <circle cx="-14" cy="-18" r="9" fill="#fff" opacity=".22" />
      <path d="M86 0a86 20 0 0 1-172 0" fill="none" stroke="#FFE08A" strokeWidth="9" />
      <path d="M78 6a78 15 0 0 1-156 0" fill="none" stroke="#FFF4C4" strokeWidth="2" opacity=".6" />
    </g>
  );
}

/** A waving astronaut (viewBox 0 0 150 170). */
function Astronaut({ u }: { u: Url }) {
  return (
    <g>
      {/* backpack */}
      <rect x="38" y="62" width="74" height="70" rx="16" fill={SUIT_SHADE} />
      {/* legs and boots */}
      <path
        d="M52 124h20v26c0 6-4 10-10 10s-10-4-10-10zM80 124h20v24c0 6-4 10-10 10s-10-4-10-10z"
        fill={SUIT}
      />
      <path
        d="M52 146h20v6c0 6-4 10-10 10s-10-4-10-10zM80 144h20v6c0 6-4 10-10 10s-10-4-10-10z"
        fill="#AEB3CB"
      />
      {/* body, arms (one waving), gloves */}
      <rect x="46" y="76" width="60" height="58" rx="22" fill={SUIT} />
      <path d="M50 88C34 80 26 62 28 44" stroke={SUIT} strokeWidth="16" fill="none" strokeLinecap="round" />
      <circle cx="28" cy="40" r="10" fill="#AEB3CB" />
      <path d="M102 90c14 8 20 22 18 36" stroke={SUIT} strokeWidth="16" fill="none" strokeLinecap="round" />
      <circle cx="120" cy="128" r="10" fill="#AEB3CB" />
      <rect x="62" y="96" width="28" height="18" rx="4" fill="#DDE0EC" />
      <circle cx="69" cy="105" r="3" fill="#FF6B6B" />
      <circle cx="78" cy="105" r="3" fill="#4FD1C5" />
      <circle cx="86" cy="104" r="2.4" style={{ fill: ACCENT }} />
      <circle cx="96" cy="84" r="6" style={{ fill: ACCENT }} />
      {/* helmet and visor */}
      <circle cx="76" cy="46" r="38" fill={SUIT} />
      <circle cx="76" cy="46" r="38" fill="none" stroke={SUIT_SHADE} strokeWidth="3" />
      <rect x="48" y="26" width="56" height="42" rx="21" fill={u('visor')} />
      <path
        d="M58 36c6-6 16-8 24-6"
        stroke="#fff"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity=".7"
      />
      <circle cx="92" cy="56" r="3" fill="#fff" opacity=".5" />
      <path d="M76 8V0" stroke={SUIT_SHADE} strokeWidth="3" strokeLinecap="round" />
      <circle cx="76" cy="0" r="4" style={{ fill: ACCENT }} />
    </g>
  );
}

/** The rocket, nose up, its flame flickering (viewBox 0 0 120 320). */
function Rocket({ u }: { u: Url }) {
  return (
    <g>
      {/* flame: three layers flickering at their own pace */}
      <g data-anim="twinkle" style={{ animationDuration: '.35s' }}>
        <path d="M36 212C30 250 46 282 60 316c14-34 30-66 24-104z" fill={u('flame')} />
      </g>
      <g data-anim="twinkle" style={{ animationDuration: '.5s', animationDelay: '-.2s' }}>
        <path d="M45 212c-3 30 6 50 15 76 9-26 18-46 15-76z" fill="#FFE066" />
      </g>
      <path d="M52 212c0 20 3 34 8 48 5-14 8-28 8-48z" fill="#FFFBEA" data-anim="flicker" />
      {/* fins */}
      <path d="M28 146L6 194l2 22 26-18z" style={{ fill: ACCENT }} />
      <path d="M92 146l22 48-2 22-26-18z" style={{ fill: ACCENT }} />
      <path d="M28 146L6 194l2 22 26-18z" fill="#000" opacity=".12" />
      {/* nozzle and body */}
      <path d="M40 196h40l-6 16H46z" fill="#8A8FB0" />
      <path d="M26 78h68v108c0 8-6 14-14 14H40c-8 0-14-6-14-14z" fill={u('hull')} />
      <path d="M26 92h68v8H26z" style={{ fill: ACCENT }} />
      <path d="M54 170h12v40H54z" style={{ fill: ACCENT }} />
      {/* nose cone */}
      <path d="M60 4c24 18 34 46 34 74H26c0-28 10-56 34-74z" style={{ fill: ACCENT }} />
      <path
        d="M60 4c-10 10-18 24-22 40"
        stroke="#fff"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity=".45"
      />
      {/* porthole */}
      <circle cx="60" cy="130" r="23" fill="#C9CFE8" />
      <circle cx="60" cy="130" r="17" fill={u('glass')} />
      <path
        d="M50 124c3-6 9-9 15-8"
        stroke="#fff"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
        opacity=".8"
      />
      {[104, 110, 116, 150, 156, 162].map((y, i) => (
        <circle key={i} cx={i < 3 ? 32 : 88} cy={y} r="1.8" fill="#AEB3CB" />
      ))}
      <path d="M36 80v104" stroke="#fff" strokeWidth="6" opacity=".6" strokeLinecap="round" />
    </g>
  );
}

/** Launch smoke: billowing puffs (viewBox 0 0 300 110). */
function Smoke() {
  const puffs: [number, number, number][] = [
    [40, 80, 30],
    [88, 70, 36],
    [140, 76, 40],
    [196, 72, 36],
    [248, 82, 30],
    [110, 96, 28],
    [176, 98, 30],
  ];
  return (
    <g>
      {puffs.map(([x, y, r], i) => (
        <g
          key={i}
          data-anim="float"
          style={{ animationDelay: `${-i * 0.8}s`, animationDuration: `${3 + (i % 3)}s` }}
        >
          <circle cx={x} cy={y} r={r} fill={i % 2 ? '#E9E5FA' : '#F6F4FF'} />
        </g>
      ))}
    </g>
  );
}

/** A small purple world under the rocket, with craters and the launch pad (viewBox 0 0 1200 260). */
function World() {
  return (
    <g>
      <path d="M-40 260C60 120 360 70 600 70s540 50 640 190z" fill="#4A3F95" />
      <path d="M-40 260C80 150 360 110 600 110s520 40 640 150z" fill="#3B3183" />
      {[
        [220, 170, 34, 10],
        [470, 130, 22, 7],
        [760, 150, 40, 12],
        [1000, 200, 26, 8],
        [340, 225, 18, 6],
      ].map(([x, y, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#2F2670" />
          <path
            d={`M${x! - rx!} ${y}a${rx} ${ry} 0 0 0 ${rx! * 2} 0`}
            fill="none"
            stroke="#6B5FC0"
            strokeWidth="3"
            opacity=".7"
          />
        </g>
      ))}
      <path
        d="M-40 260C60 120 360 70 600 70s540 50 640 190"
        fill="none"
        stroke="#8A7BE0"
        strokeWidth="4"
        opacity=".6"
      />
    </g>
  );
}

export default function RocketLaunch({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  /** on one side of the text column, `gap` from the centre: in view on wide heroes, off-screen on narrow ones */
  const beside = (side: 'left' | 'right', gap: number): CSSProperties =>
    side === 'left' ? { right: `calc(50cqw + ${cm(gap)})` } : { left: `calc(50cqw + ${cm(gap)})` };
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('moon')} cx=".38" cy=".34" r=".8">
            <stop offset="0" stopColor="#FFFCEE" />
            <stop offset=".7" stopColor={MOON} />
            <stop offset="1" stopColor="#E3DBBA" />
          </radialGradient>
          <radialGradient id={ref('moonglow')}>
            <stop offset=".6" stopColor="#FFF6D6" stopOpacity=".28" />
            <stop offset="1" stopColor="#FFF6D6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ref('planet')} cx=".36" cy=".3" r=".85">
            <stop offset="0" stopColor="#FFC08A" />
            <stop offset=".65" stopColor="#FF8F6B" />
            <stop offset="1" stopColor="#D9556A" />
          </radialGradient>
          <linearGradient id={ref('visor')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#3B4FA8" />
            <stop offset="1" stopColor={VISOR} />
          </linearGradient>
          <linearGradient id={ref('hull')} x1="0" x2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".7" stopColor="#EEF0F8" />
            <stop offset="1" stopColor="#CFD3E6" />
          </linearGradient>
          <radialGradient id={ref('glass')} cx=".35" cy=".3" r=".9">
            <stop offset="0" stopColor="#A8E4FF" />
            <stop offset="1" stopColor="#3F7FE0" />
          </radialGradient>
          <linearGradient id={ref('flame')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFB23E" />
            <stop offset=".6" stopColor="#FF6A3D" />
            <stop offset="1" stopColor="#FF6A3D" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ref('comet')} x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity=".9" />
          </linearGradient>
          <filter id={ref('glow')} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FFB86B" floodOpacity=".45" />
          </filter>
        </defs>
      </svg>
      {/* nebulae: a violet cloud at one corner, teal at the other, a glow over the world */}
      <Layer
        style={{
          background:
            'radial-gradient(60cqmin 50cqmin at 0% 30%, rgba(155,93,229,.35), rgba(155,93,229,0) 70%),' +
            'radial-gradient(70cqmin 50cqmin at 100% 70%, rgba(79,209,197,.2), rgba(79,209,197,0) 70%),' +
            'radial-gradient(90cqw 30cqh at 50% 100%, rgba(138,123,224,.35), rgba(138,123,224,0) 70%)',
        }}
      />
      <Piece vb={[0, 0, 1000, 1000]} fit="xMidYMid slice" style={{ inset: 0, width: '100%', height: '100%' }}>
        <Stars />
      </Piece>
      {/* a comet crossing high up */}
      <Piece
        vb={[0, 0, 200, 40]}
        anim="drift"
        style={{ left: '30%', top: card ? cm(4) : cm(6), width: cm(card ? 16 : 24), rotate: '-14deg' }}
      >
        <path d="M0 22L186 16v10z" fill={url('comet')} />
        <circle cx="188" cy="21" r="6" fill="#fff" />
        <circle cx="188" cy="21" r="12" fill="#fff" opacity=".2" />
      </Piece>
      {/* the moon (top corner) and the ringed planet (other corner) */}
      <Piece
        vb={[-140, -140, 280, 280]}
        style={{
          left: card ? `calc(100% - ${cm(9)})` : `calc(100% - ${cmh(18)})`,
          top: card ? cm(9) : cmh(18),
          width: card ? cm(38) : cmh(62),
          translate: '-50% -50%',
        }}
      >
        <Moon u={url} />
      </Piece>
      <Piece
        vb={[-100, -64, 200, 128]}
        anim="float"
        style={{
          left: cm(card ? 3 : 2),
          top: card ? cm(6) : poster ? cm(9) : cm(14),
          width: card ? cm(22) : cmh(34),
        }}
      >
        <g filter={url('glow')}>
          <RingedPlanet u={url} />
        </g>
      </Piece>
      {/* small planets beside the names on wide heroes */}
      <Piece
        vb={[-20, -20, 40, 40]}
        anim="orbit"
        style={{ ...beside('right', 56), top: '46%', width: cm(7) }}
      >
        <circle r="16" fill="#4FD1C5" />
        <path d="M-14-4c8 4 20 4 28 0" stroke="#2BA89D" strokeWidth="4" fill="none" />
      </Piece>
      <Piece
        vb={[-20, -20, 40, 40]}
        anim="orbit"
        style={{ ...beside('left', 58), top: '40%', width: cm(5), animationDelay: '-2s' }}
      >
        <circle r="16" fill="#FFD166" />
        <circle cx="-5" cy="-5" r="4" fill="#fff" opacity=".35" />
      </Piece>
      {/* the little world, the smoke and the rocket lifting off */}
      <Piece
        vb={[0, 0, 1200, 260]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? '30cqh' : '19cqh' }}
      >
        <World />
      </Piece>
      <Piece
        vb={[0, 0, 150, 170]}
        anim="float"
        style={{
          left: cm(card ? 4 : 5),
          bottom: card ? '24cqh' : '17cqh',
          width: card ? cm(15) : cmh(24),
          rotate: '-12deg',
          animationDuration: '7.5s',
        }}
      >
        <g data-anim="sway">
          <Astronaut u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 300, 110]}
        style={{ right: cm(card ? 2 : 0), bottom: card ? '10cqh' : '6cqh', width: cm(card ? 30 : 46) }}
      >
        <Smoke />
      </Piece>
      <Piece
        vb={[0, 0, 120, 320]}
        anim="float"
        style={{
          right: cm(card ? 11 : 14),
          bottom: card ? '15cqh' : '11cqh',
          width: card ? cm(10) : cmh(18),
          rotate: '8deg',
          animationDuration: '3s',
        }}
      >
        <Rocket u={url} />
      </Piece>
    </>
  );
}
