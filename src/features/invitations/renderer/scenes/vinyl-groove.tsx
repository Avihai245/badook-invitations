import { Layer, Piece, cm, r1, useIds, type SceneProps } from './kit';

/**
 * Vinyl Groove — a hi-fi corner after dark: a walnut turntable with an aluminium plate, a record
 * turning under the tonearm, a walnut speaker whose woofer thumps, an arc lamp throwing warm light
 * from above, an LED level meter whose peaks breathe and music notes rising into the room. The
 * record's label and the meter's peaks follow the accent.
 */
const ACCENT = 'var(--inv-accent, #F0A43A)';
const CREAM = '#F6E6CC';
const BRASS = '#C9A24E';
const BRASS_LIGHT = '#F1D899';
const BRASS_DEEP = '#7E5E22';
const TEAL = '#3FB8AF';
const MUSTARD = '#E8B23A';

type Url = (name: string) => string;

/** A top-down turntable (viewBox 0 0 500 400); the record's centre is at 210,200. */
function Turntable({ u }: { u: Url }) {
  const grooves = Array.from({ length: 16 }, (_, i) => 66 + i * 6);
  return (
    <g>
      <rect x="0" y="0" width="500" height="400" rx="18" fill={u('walnut')} />
      {[40, 110, 190, 260, 330].map((y, i) => (
        <path
          key={y}
          d={`M6 ${y}C120 ${y - 10 + i * 3} 300 ${y + 12} 494 ${y - 4}`}
          stroke="#3A2416"
          strokeWidth="1.4"
          fill="none"
          opacity=".35"
        />
      ))}
      <rect x="18" y="18" width="464" height="364" rx="8" fill={u('plate')} />
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M18 ${26 + i * 20}H482`} stroke="#fff" strokeWidth=".8" opacity=".18" />
      ))}
      {/* platter rim */}
      <circle cx="210" cy="200" r="172" fill="#8C8781" />
      <circle cx="210" cy="200" r="168" fill="#2A2725" />
      {/* the record: turns (grooves + label, asymmetric enough to see it turn) */}
      <g data-anim="turn">
        <circle cx="210" cy="200" r="163" fill="#141212" />
        {grooves.map((r, i) => (
          <circle
            key={r}
            cx="210"
            cy="200"
            r={r}
            fill="none"
            stroke={i % 3 ? '#262322' : '#34302E'}
            strokeWidth={i % 4 ? 1.2 : 2.4}
          />
        ))}
        <circle cx="210" cy="200" r="56" style={{ fill: ACCENT }} />
        <circle cx="210" cy="200" r="48" fill="none" stroke={CREAM} strokeWidth="1.4" opacity=".7" />
        <path d="M178 176h40M178 186h28" stroke={CREAM} strokeWidth="5" strokeLinecap="round" opacity=".9" />
        <path
          d="M196 226h30M188 236h44"
          stroke="#1B1411"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".45"
        />
        <path d="M232 166l8 14h-16z" fill={CREAM} opacity=".9" />
      </g>
      {/* light across the grooves stays put while the record turns */}
      <path d="M210 200L112 58A172 172 0 0 1 168 34Z" fill={u('sheen')} />
      <path d="M210 200L308 342A172 172 0 0 1 252 366Z" fill={u('sheen')} />
      <circle cx="210" cy="200" r="6" fill="#DAD6D0" />
      <circle cx="210" cy="200" r="2.4" fill="#8C8781" />
      {/* the tonearm: pivot, counterweight, arm, headshell on the outer grooves */}
      <path d="M430 92L462 42" stroke="#6E6A66" strokeWidth="16" strokeLinecap="round" />
      <path d="M430 92L462 42" stroke="#C9C5BF" strokeWidth="10" strokeLinecap="round" />
      <circle cx="430" cy="92" r="28" fill="#6E6A66" />
      <circle cx="430" cy="92" r="22" fill={u('chrome')} />
      <circle cx="430" cy="92" r="8" fill="#3A3634" />
      <path
        d="M430 92L352 240Q344 256 330 266"
        fill="none"
        stroke="#5E5A56"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M430 92L352 240Q344 256 330 266"
        fill="none"
        stroke="#E8E5E0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M318 256L344 276L332 292L306 272Z" fill="#2A2725" />
      <path d="M318 256L344 276" stroke="#C9C5BF" strokeWidth="3" />
      <path d="M340 272L356 262" stroke="#C9C5BF" strokeWidth="3" strokeLinecap="round" />
      {/* the arm rest, speed buttons and the pilot light */}
      <rect x="452" y="232" width="14" height="30" rx="4" fill="#6E6A66" />
      <rect x="36" y="346" width="34" height="16" rx="4" fill="#3A3634" />
      <rect x="78" y="346" width="34" height="16" rx="4" fill="#5E5A56" />
      <circle cx="130" cy="354" r="5" fill={MUSTARD} data-anim="pulse" />
    </g>
  );
}

/** A walnut speaker on tapered legs (viewBox 0 0 200 330): a tweeter over a woofer that thumps. */
function Speaker({ u }: { u: Url }) {
  return (
    <g>
      <path d="M34 296L26 330H38L48 296ZM166 296L174 330H162L152 296Z" fill="#2A1A10" />
      <rect x="0" y="0" width="200" height="300" rx="14" fill={u('walnut')} />
      <rect x="14" y="14" width="172" height="272" rx="8" fill="#211813" />
      {[60, 150, 230].map((y) => (
        <path
          key={y}
          d={`M4 ${y}C60 ${y - 6} 130 ${y + 8} 196 ${y - 2}`}
          stroke="#3A2416"
          strokeWidth="1.2"
          fill="none"
          opacity=".3"
        />
      ))}
      <circle cx="100" cy="66" r="24" fill="#8C8781" />
      <circle cx="100" cy="66" r="20" fill={u('cone')} />
      <circle cx="100" cy="66" r="6" fill="#4A4542" />
      <circle cx="100" cy="182" r="76" fill="#8C8781" />
      <circle cx="100" cy="182" r="71" fill="#15110F" />
      <g data-anim="pop" style={{ transformBox: 'fill-box' }}>
        <circle cx="100" cy="182" r="64" fill={u('cone')} />
        <circle cx="100" cy="182" r="64" fill="none" stroke="#2A2522" strokeWidth="6" />
        <circle cx="100" cy="182" r="20" fill={u('cap')} />
      </g>
      {[
        [26, 26],
        [174, 26],
        [26, 274],
        [174, 274],
      ].map(([x, y]) => (
        <circle key={`${x}.${y}`} cx={x} cy={y} r="3.4" fill={BRASS} />
      ))}
    </g>
  );
}

/** An arc lamp (viewBox 0 0 300 1000): a brass stem from the right edge over to a glowing dome. */
function Lamp({ u }: { u: Url }) {
  const stem = 'M300 1000C302 560 300 90 204 50C158 32 122 58 114 100';
  return (
    <g>
      <path d="M58 150H170L300 1000H-60Z" fill={u('lampcone')} opacity=".32" filter={u('blur')} />
      <path d={stem} fill="none" stroke={BRASS_DEEP} strokeWidth="9" strokeLinecap="round" />
      <path d={stem} fill="none" stroke={BRASS} strokeWidth="5" strokeLinecap="round" />
      <path d={stem} fill="none" stroke={BRASS_LIGHT} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      <path d="M52 150C54 108 172 108 176 150Z" fill={u('shade')} />
      <path d="M52 150H176" stroke={BRASS_DEEP} strokeWidth="4" strokeLinecap="round" />
      <g data-anim="pulse">
        <ellipse cx="114" cy="156" rx="46" ry="16" fill={u('glow')} />
        <ellipse cx="114" cy="152" rx="16" ry="8" fill="#FFF3D1" />
      </g>
    </g>
  );
}

/** An LED level meter (viewBox 0 0 230 104): 11 columns of 8 segments, their peaks breathing. */
function Meter({ u }: { u: Url }) {
  const levels = [5, 7, 6, 8, 6, 4, 7, 5, 6, 3, 5];
  const segColor = (s: number) => (s >= 6 ? ACCENT : s >= 4 ? MUSTARD : TEAL);
  return (
    <g filter={u('glowf')}>
      {levels.map((level, c) =>
        Array.from({ length: 8 }, (_, s) => {
          const lit = s < level;
          const peak = s === level - 1 || s === level;
          return (
            <rect
              key={`${c}.${s}`}
              x={c * 21}
              y={92 - s * 12.5}
              width="17"
              height="9"
              rx="2"
              opacity={lit ? 1 : s === level ? 0.55 : 0.12}
              data-anim={peak ? 'twinkle' : undefined}
              style={{
                fill: segColor(s),
                animationDelay: peak ? `${r1(((c * 7) % 11) * 0.26)}s` : undefined,
              }}
            />
          );
        }),
      )}
    </g>
  );
}

/** An eighth note (viewBox 0 0 30 40) or two beamed eighths (viewBox 0 0 44 40). */
function Note({ beamed }: { beamed: boolean }) {
  const head = (x: number, y: number) => (
    <ellipse cx={x} cy={y} rx="7" ry="5.2" transform={`rotate(-20 ${x} ${y})`} />
  );
  return beamed ? (
    <g>
      {head(9, 32)}
      {head(33, 28)}
      <path d="M14.2 31V8H16.6V31ZM38.2 27V4H40.6V27ZM14.2 7L40.6 2.6V9L14.2 13.4Z" />
    </g>
  ) : (
    <g>
      {head(13, 31)}
      <path d="M18.2 30V4H20.6V30Z" />
      <path d="M20.6 4C22 11 30 12 28 23 27 17 24 14 20.6 13Z" />
    </g>
  );
}

const NOTES: readonly (readonly [number, number, boolean, number, string])[] = [
  // x %, bottom %, beamed?, delay s, colour
  [20, 24, false, 0, CREAM],
  [84, 30, true, 1.8, MUSTARD],
  [9, 33, true, 3.6, CREAM],
  [91, 21, false, 5.4, CREAM],
  [74, 35, false, 7.2, ACCENT],
];

export default function VinylGroove({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const deckW = card ? cm(52) : 'min(86cqmin, 48cqh)';
  const speakerW = 'min(32cqmin, 29cqh)';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('walnut')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#7A4B2C" />
            <stop offset=".5" stopColor="#5B3520" />
            <stop offset="1" stopColor="#3E2415" />
          </linearGradient>
          <linearGradient id={ref('plate')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#DEDAD3" />
            <stop offset=".55" stopColor="#C4BFB7" />
            <stop offset="1" stopColor="#A9A39A" />
          </linearGradient>
          <radialGradient id={ref('sheen')} cx="210" cy="200" r="172" gradientUnits="userSpaceOnUse">
            <stop offset=".3" stopColor="#fff" stopOpacity="0" />
            <stop offset=".75" stopColor="#fff" stopOpacity=".16" />
            <stop offset="1" stopColor="#fff" stopOpacity=".04" />
          </radialGradient>
          <radialGradient id={ref('chrome')} cx=".35" cy=".35" r=".7">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#8C8781" />
          </radialGradient>
          <radialGradient id={ref('cone')} cx=".4" cy=".35" r=".75">
            <stop offset="0" stopColor="#4A4340" />
            <stop offset=".7" stopColor="#221D1B" />
            <stop offset="1" stopColor="#141110" />
          </radialGradient>
          <radialGradient id={ref('cap')} cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#8E8680" />
            <stop offset="1" stopColor="#2E2826" />
          </radialGradient>
          <linearGradient id={ref('shade')} x1="0" x2="1">
            <stop offset="0" stopColor={BRASS_DEEP} />
            <stop offset=".35" stopColor={BRASS_LIGHT} />
            <stop offset="1" stopColor={BRASS} />
          </linearGradient>
          <radialGradient id={ref('glow')}>
            <stop offset="0" stopColor="#FFE9B0" stopOpacity=".95" />
            <stop offset="1" stopColor="#FFB547" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ref('lampcone')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFC56B" />
            <stop offset=".6" stopColor="#FFB547" stopOpacity=".25" />
            <stop offset="1" stopColor="#FFB547" stopOpacity="0" />
          </linearGradient>
          <filter id={ref('blur')} x="-20%" y="-5%" width="140%" height="110%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id={ref('glowf')} x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={ref('drop')} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity=".45" />
          </filter>
        </defs>
      </svg>
      {/* the room: walnut slats in the dark, the lamp's warmth from the upper right */}
      <Layer
        style={{
          background:
            'radial-gradient(70cqmin 60cqmin at 72% 12%, rgba(255,181,71,.26), transparent 70%),' +
            'radial-gradient(90cqw 40cqh at 50% 100%, rgba(255,160,70,.12), transparent 70%),' +
            'repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 1px, transparent 1px 5.5cqmin),' +
            'linear-gradient(180deg, #1C1410 0%, #261A14 50%, #1A120E 100%)',
        }}
      />
      <Piece
        vb={[0, 0, 300, 1000]}
        style={{
          right: card ? '-2cqw' : '-1cqw',
          top: card ? '-6cqh' : 0,
          width: card ? cm(26) : 'min(46cqmin, 40cqh)',
        }}
      >
        <Lamp u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 230, 104]}
        style={{
          left: card ? '6cqw' : '7cqw',
          top: card ? '10cqh' : place === 'hero' ? 'max(9cqh, 70px)' : '7cqh',
          width: card ? cm(22) : 'min(40cqmin, 30cqh)',
        }}
      >
        <Meter u={url} />
      </Piece>
      {/* the speakers: one beside the deck on a portrait, a stereo pair on a landscape */}
      {(['left', 'right'] as const).map((side) =>
        side === 'right' && card ? null : (
          <Piece
            key={side}
            vb={[0, 0, 200, 330]}
            style={{
              [side]: card ? '4cqw' : `clamp(-3cqw, (100cqw - 100cqh) * 0.2, 5cqw)`,
              bottom: card ? '6cqh' : '9cqh',
              width: card ? cm(20) : speakerW,
              // the right one only fits beside a landscape deck: on a portrait it moves off the edge
              translate: side === 'right' ? 'max(0px, (100cqh - 100cqw) * 5) 0' : undefined,
            }}
          >
            <g filter={url('drop')}>
              <Speaker u={url} />
            </g>
          </Piece>
        ),
      )}
      <Piece
        vb={[0, 0, 500, 400]}
        style={{
          left: '50%',
          bottom: `calc(${deckW} * -0.2)`,
          width: deckW,
          // centred between a stereo pair, a little right of the single speaker on a portrait
          translate: card ? '-28% 0' : 'calc(-50% + clamp(0px, (100cqh - 100cqw) * 0.2, 8%)) 0',
        }}
      >
        <g filter={url('drop')}>
          <Turntable u={url} />
        </g>
      </Piece>
      {/* music notes rising into the room */}
      {NOTES.filter((_, i) => !card || i < 3).map(([x, bottom, beamed, delay, color], i) => (
        <Piece
          key={i}
          vb={beamed ? [0, 0, 44, 40] : [0, 0, 30, 40]}
          anim="rise"
          style={{
            left: `${x}%`,
            bottom: `${bottom}%`,
            width: cm(card ? (beamed ? 5 : 3.4) : beamed ? 7.4 : 5),
            translate: '-50% 0',
            rotate: `${i % 2 ? 10 : -8}deg`,
            fill: color,
            animationDelay: `${delay}s`,
          }}
        >
          <Note beamed={beamed} />
        </Piece>
      ))}
    </>
  );
}
