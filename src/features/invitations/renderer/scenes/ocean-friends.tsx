import type { CSSProperties } from 'react';
import { Layer, Piece, cm, cmh, polar, r1, useIds, type SceneProps } from './kit';

/**
 * Ocean Friends — under the sea for the little ones: sunbeams fanning down from the rippling surface,
 * a big smiling whale blowing bubbles, a floating jellyfish, little fish swimming to and fro, and on
 * the sand swaying seaweed, coral, shells, a starfish, a crab and an open treasure chest that
 * sparkles. The fish, the coral and the starfish follow the accent.
 */
const ACCENT = 'var(--inv-accent, #FF7A6B)';
const INK = '#123A57';
const WHALE = '#5A8FEA';
const WHALE_DEEP = '#3F6FD0';
const BELLY = '#D3E8FF';
const SAND = '#F5DDA8';
const SAND_DEEP = '#E8C582';
const WEED = '#35A57A';
const WEED_DEEP = '#23845F';
const GOLD = '#FFCF4A';
const BLUSH = '#FF8FA3';

type Url = (name: string) => string;

/** The whale, swimming right, tail up (viewBox 0 0 300 180). */
function Whale({ u }: { u: Url }) {
  return (
    <g>
      {/* the tail rising from its back end, flukes spread */}
      <path d="M78 124C52 116 38 92 40 64l18-2c0 22 10 40 30 50z" fill={u('whale')} />
      <path d="M48 64C36 44 16 38 2 44c12 12 28 20 46 22 14-14 32-22 50-20-10-12-32-14-50 18z" fill={u('whale')} />
      {/* body, belly and its grooves */}
      <path d="M62 116C62 66 112 34 176 34c64 0 110 32 110 76 0 38-46 58-114 58-62 0-100-22-110-52z" fill={u('whale')} />
      <path d="M92 148c34 18 132 22 178-12-8 22-50 34-98 34-38 0-66-8-80-22z" fill={BELLY} />
      <path d="M130 158c30 6 70 6 104-2M142 150c26 4 60 4 88-2" stroke="#A9CBF0" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* flipper, spots on the back */}
      <path d="M176 138c8 20 30 28 46 22-6-14-24-26-46-22z" fill={WHALE_DEEP} />
      <circle cx="150" cy="60" r="7" fill="#fff" opacity=".22" />
      <circle cx="176" cy="52" r="5" fill="#fff" opacity=".22" />
      <circle cx="132" cy="76" r="4" fill="#fff" opacity=".22" />
      {/* face */}
      <circle cx="238" cy="94" r="9" fill={INK} />
      <circle cx="241" cy="90" r="3" fill="#fff" />
      <path d="M244 120c10 9 26 8 34-4" stroke={INK} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <ellipse cx="222" cy="114" rx="10" ry="6" fill={BLUSH} opacity=".45" />
    </g>
  );
}

/** A jellyfish with a smiling bell and wavy tentacles (viewBox 0 0 100 170). */
function Jellyfish({ u }: { u: Url }) {
  const wave = (x: number) => `M${x} 56q-7 12 0 24t0 24t0 24t0 24`;
  return (
    <g>
      {/* the tentacles swing from the bell's rim */}
      <g data-anim="sweep" style={{ transformOrigin: '50px 56px', animationDuration: '4s' }}>
        {[22, 38, 54, 70].map((x, i) => (
          <path
            key={x}
            d={wave(x + (i % 2) * 4)}
            stroke={i % 2 ? '#E7A0E6' : '#F3B3D8'}
            strokeWidth="4.4"
            fill="none"
            strokeLinecap="round"
            opacity=".85"
          />
        ))}
      </g>
      <path d="M8 54C8 24 28 6 50 6s42 18 42 48c-8 6-16 2-22 6-6-6-14-4-20 0-6-4-14-6-20 0-6-4-14 0-22-6z" fill={u('jelly')} />
      <path d="M24 26c6-8 16-12 26-12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".55" />
      <circle cx="38" cy="38" r="4" fill={INK} />
      <circle cx="62" cy="38" r="4" fill={INK} />
      <path d="M44 46c3 3 9 3 12 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="30" cy="46" rx="5" ry="3" fill={BLUSH} opacity=".6" />
      <ellipse cx="70" cy="46" rx="5" ry="3" fill={BLUSH} opacity=".6" />
    </g>
  );
}

/** A little round fish facing left (viewBox 0 0 80 50), in `fill`. */
function Fish({ fill, stripe = '#fff' }: { fill: string; stripe?: string }) {
  return (
    <g>
      <path d="M60 25L78 9l-3 16 3 16z" style={{ fill }} />
      <path d="M8 25C8 12 24 4 40 4c16 0 26 10 28 21-2 11-12 21-28 21C24 46 8 38 8 25z" style={{ fill }} />
      <path d="M40 6c-6 12-6 26 0 38M50 8c-5 11-5 23 0 34" stroke={stripe} strokeWidth="4" fill="none" opacity=".75" />
      <circle cx="21" cy="21" r="4.6" fill={INK} />
      <circle cx="22.4" cy="19.6" r="1.5" fill="#fff" />
      <path d="M13 31c3 2 7 2 9 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** An open treasure chest with coins and a pearl string (viewBox 0 0 170 140). */
function Chest({ u }: { u: Url }) {
  return (
    <g>
      <ellipse cx="85" cy="58" rx="62" ry="26" fill={u('glow')} />
      {/* open lid, tipped back */}
      <path d="M22 60c0-30 26-50 63-50s63 20 63 50z" fill="#8A4F26" />
      <path d="M30 58c2-22 24-38 55-38s53 16 55 38" stroke={GOLD} strokeWidth="6" fill="none" />
      <path d="M85 12v46" stroke={GOLD} strokeWidth="6" />
      {/* coins heaped in the box, a pearl string over the edge */}
      {[
        [48, 64],
        [66, 58],
        [86, 56],
        [106, 60],
        [124, 66],
        [58, 72],
        [80, 68],
        [100, 70],
        [118, 76],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="10" fill={GOLD} />
          <circle cx={x} cy={y} r="6.4" fill="none" stroke="#E0A92E" strokeWidth="2" />
        </g>
      ))}
      <path d="M118 74c10 14 12 30 6 44" stroke="#FFF6EE" strokeWidth="5" strokeDasharray="0 7" strokeLinecap="round" fill="none" />
      {/* the box with gold bands and a lock */}
      <rect x="18" y="74" width="134" height="62" rx="8" fill="#9A5B2E" />
      <path d="M18 88h134M18 124h134" stroke="#7A4420" strokeWidth="3" opacity=".6" />
      <path d="M40 74v62M130 74v62" stroke={GOLD} strokeWidth="7" />
      <rect x="74" y="86" width="22" height="24" rx="5" fill={GOLD} />
      <circle cx="85" cy="96" r="3.4" fill="#7A4420" />
      <path d="M85 98v6" stroke="#7A4420" strokeWidth="2.6" strokeLinecap="round" />
      {/* sparkles */}
      {[
        [34, 30, 7, '0s'],
        [140, 34, 6, '-1.2s'],
        [104, 20, 5, '-2s'],
      ].map(([x, y, s, delay], i) => (
        <path
          key={i}
          data-anim="twinkle"
          style={{ animationDelay: delay as string }}
          d={`M${x} ${(y as number) - (s as number)}Q${x} ${y} ${(x as number) + (s as number)} ${y}Q${x} ${y} ${x} ${(y as number) + (s as number)}Q${x} ${y} ${(x as number) - (s as number)} ${y}Q${x} ${y} ${x} ${(y as number) - (s as number)}Z`}
          fill="#FFF7D6"
        />
      ))}
    </g>
  );
}

/** A clump of seaweed rising from y=300: ribbons that sway on their own (viewBox 0 0 120 300). */
function Seaweed({ tall }: { tall: number }) {
  const blades = [
    { x: 30, h: tall, tone: WEED_DEEP, delay: '0s' },
    { x: 60, h: tall * 0.82, tone: WEED, delay: '-2s' },
    { x: 88, h: tall * 0.64, tone: '#5CC495', delay: '-4s' },
  ];
  return (
    <g>
      {blades.map(({ x, h, tone, delay }) => (
        <g key={x} data-anim="sway" style={{ animationDelay: delay }}>
          <path
            d={`M${x} 300C${x - 18} ${300 - h * 0.25} ${x + 18} ${300 - h * 0.45} ${x} ${300 - h * 0.62}S${x - 16} ${300 - h * 0.86} ${x + 4} ${300 - h}`}
            stroke={tone}
            strokeWidth="13"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

/** Branching coral in the accent (viewBox 0 0 120 120). */
function Coral() {
  return (
    <g style={{ stroke: ACCENT }} strokeWidth="11" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 120V72M60 92L34 64V40M34 64L18 52M60 84L86 56V30M86 56L104 44M86 40L74 26" />
      <path d="M60 72L60 50" />
    </g>
  );
}

/** A five-armed starfish (viewBox -30 -30 60 60). */
function Starfish() {
  const pts = Array.from({ length: 10 }, (_, i) => polar(0, 0, i % 2 ? 11 : 27, i * 36 - 90).join(' '));
  return (
    <g>
      <path d={`M${pts.join('L')}Z`} style={{ fill: ACCENT, stroke: ACCENT }} strokeWidth="7" strokeLinejoin="round" />
      {[0, 72, 144, 216, 288].map((a) => {
        const [x, y] = polar(0, 0, 13, a - 90);
        return <circle key={a} cx={x} cy={y} r="2.2" fill="#fff" opacity=".7" />;
      })}
    </g>
  );
}

/** A crab waving its claws (viewBox 0 0 100 70). */
function Crab() {
  return (
    <g>
      <path d="M22 44l-14 14M28 50l-10 14M78 44l14 14M72 50l10 14" stroke="#E0503A" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 30L12 16M74 30l14-14" stroke="#E0503A" strokeWidth="5" strokeLinecap="round" />
      <path d="M4 16c0-8 12-12 16-4l-6 6zM96 16c0-8-12-12-16-4l6 6z" fill="#F2634B" />
      <ellipse cx="50" cy="44" rx="30" ry="20" fill="#F2634B" />
      <path d="M40 26V16M60 26V16" stroke="#E0503A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="14" r="5.4" fill="#fff" />
      <circle cx="60" cy="14" r="5.4" fill="#fff" />
      <circle cx="40" cy="15" r="2.8" fill={INK} />
      <circle cx="60" cy="15" r="2.8" fill={INK} />
      <path d="M42 48c4 4 12 4 16 0" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** A scallop shell (viewBox 0 0 50 44). */
function Shell() {
  return (
    <g>
      <path d="M25 42L6 20C8 8 16 2 25 2s17 6 19 18z" fill="#F8C9C0" />
      <path d="M25 42L14 8M25 42V4M25 42L36 8M25 42L8 18M25 42l17-24" stroke="#E7A79C" strokeWidth="2" />
      <path d="M19 42h12v2H19z" fill="#E7A79C" />
    </g>
  );
}

/** A column of bubbles (viewBox 0 0 40 120); they bob and shimmer. */
function Bubbles({ delay = '0s', count = 5 }: { delay?: string; count?: number }) {
  return (
    <g data-anim="float" style={{ animationDelay: delay, animationDuration: '3.4s' }}>
      {Array.from({ length: count }, (_, i) => {
        const r = 4 + ((i * 7) % 5);
        const y = 110 - i * 24;
        const x = 20 + (i % 2 ? 7 : -6);
        return (
          <g key={i} data-anim="twinkle" style={{ animationDelay: `${-i * 0.5}s` }}>
            <circle cx={x} cy={y} r={r} fill="#fff" fillOpacity=".25" stroke="#fff" strokeWidth="2" strokeOpacity=".85" />
            <circle cx={r1(x - r * 0.35)} cy={r1(y - r * 0.35)} r={r1(r * 0.28)} fill="#fff" opacity=".9" />
          </g>
        );
      })}
    </g>
  );
}

export default function OceanFriends({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const sand = card ? '26cqh' : '17cqh';
  /** beside the text column on wide heroes, pushed off-screen on narrow ones */
  const beside = (side: 'left' | 'right', gap: number): CSSProperties =>
    side === 'left' ? { left: `calc(50cqw + ${cm(gap)})` } : { right: `calc(50cqw + ${cm(gap)})` };
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('whale')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7AAEF7" />
            <stop offset="1" stopColor={WHALE} />
          </linearGradient>
          <radialGradient id={ref('jelly')} cx=".45" cy=".35" r=".75">
            <stop offset="0" stopColor="#FFD3EC" />
            <stop offset=".7" stopColor="#F6A9D6" />
            <stop offset="1" stopColor="#DC8BDD" />
          </radialGradient>
          <radialGradient id={ref('glow')}>
            <stop offset="0" stopColor="#FFF3B0" stopOpacity=".95" />
            <stop offset="1" stopColor="#FFF3B0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ref('beam')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".5" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={ref('soft')} x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0E4A66" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      {/* the surface: a bright band that ripples, and the light coming down */}
      <Layer
        style={{
          background:
            'radial-gradient(70cqw 30cqh at 50% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%),' +
            'linear-gradient(180deg, rgba(255,255,255,.35) 0, rgba(255,255,255,0) 6cqh)',
        }}
      />
      <Piece
        vb={[0, 0, 400, 600]}
        anim="sweep"
        fit="xMidYMin slice"
        style={{ left: 0, top: 0, width: '100%', height: '62%', transformOrigin: '50% 0' }}
      >
        {[-150, -80, -20, 40, 110].map((dx, i) => (
          <path
            key={dx}
            d={`M200 -10L${200 + dx * 2 - 34} 600H${200 + dx * 2 + 34}Z`}
            fill={url('beam')}
            opacity={i % 2 ? 0.45 : 0.7}
          />
        ))}
      </Piece>
      <Piece
        vb={[0, 0, 1200, 40]}
        fit="xMidYMin slice"
        style={{ left: 0, top: 0, width: '100%', height: cm(3) }}
      >
        <path d={`M0 18${'q25 -10 50 0t50 0'.repeat(12)}V0H0Z`} fill="#fff" opacity=".45" />
        <path d={`M0 26${'q25 -8 50 0t50 0'.repeat(12)}`} stroke="#fff" strokeWidth="3" fill="none" opacity=".6" />
      </Piece>
      {/* the whale blows a column of bubbles */}
      <Piece
        vb={[0, 0, 40, 120]}
        style={{
          left: card ? cm(22) : poster ? cm(28) : cmh(34),
          top: card ? cm(-2) : cm(-4),
          width: card ? cm(5) : cmh(7),
        }}
      >
        <Bubbles delay="-1s" />
      </Piece>
      <Piece
        vb={[0, 0, 300, 180]}
        anim="float"
        style={{
          left: cm(-5),
          top: card ? cm(8) : poster ? cm(6) : cm(12),
          width: card ? cm(32) : cmh(56),
        }}
      >
        <g filter={url('soft')}>
          <Whale u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 100, 170]}
        anim="float"
        style={{
          right: card ? cm(8) : cm(7),
          top: card ? cm(6) : poster ? cm(5) : cm(9),
          width: card ? cm(10) : cmh(17),
          animationDuration: '4.5s',
        }}
      >
        <g opacity=".95">
          <Jellyfish u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 80, 50]}
        anim="drift"
        style={{ right: card ? cm(22) : cm(26), top: card ? cm(24) : poster ? cm(30) : cm(40), width: cm(card ? 7 : 9) }}
      >
        <Fish fill={ACCENT} />
      </Piece>
      <Piece
        vb={[0, 0, 80, 50]}
        anim="drift"
        style={{
          right: card ? cm(14) : cm(16),
          top: card ? cm(30) : poster ? cm(36) : cm(47),
          width: cm(card ? 5 : 6),
          animationDirection: 'alternate-reverse',
        }}
      >
        <Fish fill="#FFC94A" />
      </Piece>
      {/* fish and bubbles beside the names — only where the hero is wide enough */}
      <Piece
        vb={[0, 0, 80, 50]}
        anim="drift"
        style={{ ...beside('right', 52), top: '50%', width: cm(10), scale: '-1 1' }}
      >
        <Fish fill={ACCENT} />
      </Piece>
      <Piece
        vb={[0, 0, 80, 50]}
        anim="drift"
        style={{ ...beside('right', 64), top: '61%', width: cm(7), scale: '-1 1', animationDirection: 'alternate-reverse' }}
      >
        <Fish fill="#7FD6C8" />
      </Piece>
      <Piece vb={[0, 0, 80, 50]} anim="drift" style={{ ...beside('left', 52), top: '40%', width: cm(8) }}>
        <Fish fill="#FFC94A" />
      </Piece>
      <Piece vb={[0, 0, 40, 120]} style={{ ...beside('left', 64), top: '47%', width: cm(6) }}>
        <Bubbles delay="-2s" />
      </Piece>
      {/* the sand, with ripples */}
      <Piece
        vb={[0, 0, 1200, 220]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? '34cqh' : '24cqh' }}
      >
        <path d="M0 90C200 60 420 80 620 76S1000 58 1200 76V220H0Z" fill={SAND_DEEP} />
        <path d="M0 120C240 100 480 112 720 108S1060 98 1200 110V220H0Z" fill={SAND} />
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M${60 + i * 130} ${150 + (i % 3) * 18}q20 -8 40 0t40 0`}
            stroke={SAND_DEEP}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </Piece>
      {/* seaweed at both edges */}
      <Piece vb={[0, 0, 120, 300]} style={{ left: cm(-4), bottom: 0, width: cm(card ? 16 : 22) }}>
        <Seaweed tall={280} />
      </Piece>
      <Piece vb={[0, 0, 120, 300]} flip style={{ right: cm(-5), bottom: 0, width: cm(card ? 14 : 19) }}>
        <Seaweed tall={250} />
      </Piece>
      {/* on the sand: coral, shells, a starfish, a crab and the treasure */}
      <Piece vb={[0, 0, 120, 120]} style={{ left: cm(card ? 12 : 14), bottom: `calc(${sand} - ${cm(3)})`, width: cm(card ? 12 : 17) }}>
        <Coral />
      </Piece>
      <Piece
        vb={[0, 0, 170, 140]}
        style={{ right: cm(card ? 12 : 13), bottom: card ? '8cqh' : '5cqh', width: cm(card ? 22 : 32) }}
      >
        <g filter={url('soft')}>
          <Chest u={url} />
        </g>
      </Piece>
      <Piece vb={[-30, -30, 60, 60]} style={{ left: cm(card ? 30 : 32), bottom: card ? '6cqh' : '4cqh', width: cm(card ? 7 : 9), rotate: '-12deg' }}>
        <Starfish />
      </Piece>
      <Piece vb={[0, 0, 50, 44]} style={{ left: cm(card ? 6 : 8), bottom: card ? '5cqh' : '3cqh', width: cm(card ? 6 : 8), rotate: '10deg' }}>
        <Shell />
      </Piece>
      <Piece vb={[0, 0, 50, 44]} style={{ right: cm(card ? 6 : 6), bottom: card ? '4cqh' : '2cqh', width: cm(card ? 5 : 6), rotate: '-14deg' }}>
        <Shell />
      </Piece>
      <Piece
        vb={[0, 0, 100, 70]}
        anim="drift"
        style={{ left: '50%', bottom: card ? '5cqh' : '3cqh', width: cm(card ? 10 : 13), translate: '-40% 0' }}
      >
        <Crab />
      </Piece>
      <Piece vb={[0, 0, 40, 120]} style={{ right: cm(card ? 26 : 30), bottom: `calc(${sand} + ${cm(2)})`, width: cm(card ? 4 : 5) }}>
        <Bubbles delay="-3s" count={4} />
      </Piece>
      <Piece vb={[0, 0, 40, 120]} style={{ left: cm(card ? 4 : 5), bottom: `calc(${sand} + ${cm(12)})`, width: cm(card ? 4 : 5) }}>
        <Bubbles delay="-0.5s" count={4} />
      </Piece>
    </>
  );
}
