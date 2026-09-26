import { Layer, Piece, cm, cmh, dayMonth, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Dig It! — a building site for toddlers: a tower crane's jib across the sky with a "work zone" sign
 * on its hook showing the day and month (it swings), a far building in scaffolding, and on the dirt
 * an excavator lifting a bucketful (its arm rises and falls, its beacon blinks), a dump truck with a
 * friendly face and a full load rolling to and fro, dirt piles, cones and caution tape. The machines
 * follow the accent.
 */
const MACHINE = 'var(--inv-accent, #FFC20E)';
const MACHINE_DEEP = 'color-mix(in srgb, var(--inv-accent, #FFC20E) 72%, #3A2A10)';
const STEEL = '#4A4540';
const STEEL_LIGHT = '#77706A';
const GLASS = '#CFEAF7';
const DIRT = '#B98552';
const DIRT_DEEP = '#9C6C40';
const DIRT_LIGHT = '#D3A56C';
const CONE = '#FF7A1A';
const HAZARD = '#FFC61A';
const INK = '#26221C';

type Url = (name: string) => string;

/** Rounded stroke digits in a 20×32 box (drawn with a thick round pen). */
const DIGIT: Record<string, string> = {
  '0': 'M10 4c-4.4 0-7 4.6-7 12s2.6 12 7 12 7-4.6 7-12-2.6-12-7-12z',
  '1': 'M5 9l6-5v24',
  '2': 'M3.5 9.5C4 6 6.6 4 10 4s6.5 2.2 6.5 6c0 6-13 11-13 18h13',
  '3': 'M4 5h12l-7 8.5c4.6-.4 8 2.4 8 7 0 4.4-3.2 7.5-7.6 7.5-3 0-5.4-1.4-6.4-3.6',
  '4': 'M13.5 28V4L3 19.5h15',
  '5': 'M16 4H6l-1.4 10c1.6-1.2 3.4-1.8 5.4-1.8 4.4 0 7 3 7 7.6S14 28 9.8 28c-3 0-5.4-1.4-6.4-3.6',
  '6': 'M15 5c-6.5 1-11.5 6.4-11.5 13.6 0 5.6 2.8 9.4 7 9.4 3.8 0 6.8-3 6.8-7.2s-2.8-7-6.6-7-6.4 2.6-7 6',
  '7': 'M3 4h14L8.5 28',
  '8': 'M10 15c-3.6 0-6-2.2-6-5.4S6.4 4 10 4s6 2.4 6 5.6-2.4 5.4-6 5.4zm0 0c-4 0-6.8 2.6-6.8 6.4S6 28 10 28s6.8-2.8 6.8-6.6S14 15 10 15z',
  '9': 'M5 27c6.5-1 11.5-6.4 11.5-13.6C16.5 7.8 13.7 4 9.5 4 5.7 4 2.7 7 2.7 11.2s2.8 7 6.6 7 6.4-2.6 7-6',
};

/** The work-zone sign on the crane's hook: the trolley, the cable, and the date (viewBox 0 0 160 176). */
function WorkSign({ dd, mm, u }: { dd: string; mm: string; u: Url }) {
  const digits = (text: string, x: number) =>
    [...text].map((c, i) => (
      <path
        key={`${x}${i}`}
        d={DIGIT[c] ?? ''}
        transform={`translate(${x + i * 24} 118) scale(1.05)`}
        stroke={INK}
        strokeWidth="4.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ));
  return (
    <g>
      {/* trolley on the jib, the cable and the hook */}
      <rect x="62" y="0" width="36" height="12" rx="3" fill={STEEL} />
      <circle cx="70" cy="4" r="3.4" fill={STEEL_LIGHT} />
      <circle cx="90" cy="4" r="3.4" fill={STEEL_LIGHT} />
      <path d="M78 12v44M82 12v44" stroke={STEEL} strokeWidth="1.6" />
      <rect x="70" y="54" width="20" height="12" rx="3" fill={HAZARD} stroke={INK} strokeWidth="2" />
      <path d="M80 66v8c0 5-8 5-8 0" stroke={STEEL} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M80 74L22 96M80 74l58 22" stroke={STEEL} strokeWidth="1.8" />
      {/* the sign: hazard frame, yellow plate, the date */}
      <g filter={u('soft')}>
        <rect x="8" y="94" width="144" height="80" rx="10" fill={INK} />
        <rect x="12" y="98" width="136" height="72" rx="7" fill={u('hazard')} />
        <rect x="22" y="106" width="116" height="56" rx="5" fill={HAZARD} />
      </g>
      <circle cx="22" cy="96" r="3.4" fill={STEEL_LIGHT} />
      <circle cx="138" cy="96" r="3.4" fill={STEEL_LIGHT} />
      {digits(dd, 30)}
      <circle cx="80" cy="147" r="3.6" fill={INK} />
      {digits(mm, 90)}
    </g>
  );
}

/** The crane's jib: a lattice girder, long enough to be cropped at any width (viewBox 0 0 2000 60). */
function Jib() {
  const zig: string[] = [];
  for (let x = 0; x < 1980; x += 36) zig.push(`M${x} 50L${x + 18} 10L${x + 36} 50`);
  return (
    <g>
      <path d={zig.join('')} stroke={MACHINE_DEEP} strokeWidth="4" fill="none" strokeLinejoin="round" />
      <path d="M0 8H1990M0 52H1990" style={{ stroke: MACHINE }} strokeWidth="8" strokeLinecap="round" />
      <path d="M1990 8V52" style={{ stroke: MACHINE }} strokeWidth="8" strokeLinecap="round" />
    </g>
  );
}

/** The crane's mast down the edge, the operator's cab on top (viewBox 0 0 60 2000, cropped below). */
function Mast() {
  const zig: string[] = [];
  for (let y = 60; y < 2000; y += 40) zig.push(`M8 ${y}L52 ${y + 20}L8 ${y + 40}`);
  return (
    <g>
      <path d={zig.join('')} stroke={MACHINE_DEEP} strokeWidth="4" fill="none" strokeLinejoin="round" />
      <path d="M8 40V2000M52 40V2000" style={{ stroke: MACHINE }} strokeWidth="8" />
      <rect x="0" y="0" width="60" height="58" rx="8" style={{ fill: MACHINE }} />
      <rect x="8" y="10" width="44" height="26" rx="5" fill={GLASS} />
      <path d="M14 12l10 0-12 20z" fill="#fff" opacity=".6" />
    </g>
  );
}

/**
 * An excavator facing right with a friendly face; its arm (boom, stick and a bucket of dirt) rises
 * and falls on its pivot (viewBox 0 0 300 250).
 */
function Excavator({ u }: { u: Url }) {
  return (
    <g>
      <g
        data-anim="sweep"
        style={{ transformOrigin: '168px 156px', animationDirection: 'alternate-reverse' }}
      >
        {/* boom (a curved beam), its ram, the stick */}
        <path d="M156 160C166 116 192 80 230 58l14 18c-32 18-54 48-62 88z" style={{ fill: MACHINE }} />
        <path d="M184 150l26-52" stroke="#D9DEE2" strokeWidth="6" strokeLinecap="round" />
        <path d="M184 150l12-24" stroke={STEEL_LIGHT} strokeWidth="9" strokeLinecap="round" />
        <path d="M228 60l18-10 34 78-18 8z" style={{ fill: MACHINE_DEEP }} />
        <circle cx="236" cy="66" r="7" fill={STEEL} />
        {/* the bucket, its teeth and a heap of dirt */}
        <path d="M252 122c-8 16-4 34 12 40h26c6-14 2-30-10-40z" fill={STEEL} />
        <path d="M262 162l-4 9 9-3zM274 163l-1 9 8-4zM286 162l2 9 6-6z" fill={STEEL_LIGHT} />
        <path d="M250 126c4-16 18-24 30-22 10 2 16 10 16 20-14-4-32-4-46 2z" fill={DIRT} />
        <circle cx="266" cy="114" r="4" fill={DIRT_DEEP} />
        <circle cx="282" cy="116" r="3" fill={DIRT_LIGHT} />
        <circle cx="270" cy="132" r="7" fill={STEEL_LIGHT} />
      </g>
      {/* tracks */}
      <rect x="18" y="196" width="190" height="46" rx="23" fill={STEEL} />
      <rect x="26" y="203" width="174" height="32" rx="16" fill="#2F2B27" />
      {[44, 80, 116, 152, 184].map((x) => (
        <g key={x}>
          <circle cx={x} cy="219" r="12" fill={STEEL_LIGHT} />
          <circle cx={x} cy="219" r="4" fill={STEEL} />
        </g>
      ))}
      {/* house with its rounded counterweight, exhaust and puffs */}
      <path
        d="M40 150h140c8 0 14 6 14 14v22c0 8-6 14-14 14H40c-14 0-26-12-26-25s12-25 26-25z"
        style={{ fill: MACHINE }}
      />
      <path d="M40 150c-14 0-26 12-26 25s12 25 26 25z" style={{ fill: MACHINE_DEEP }} />
      <rect x="54" y="122" width="10" height="30" rx="3" fill={STEEL} />
      <g data-anim="float" style={{ animationDuration: '2.4s' }}>
        <circle cx="60" cy="110" r="8" fill="#fff" opacity=".75" />
        <circle cx="52" cy="96" r="6" fill="#fff" opacity=".55" />
      </g>
      {/* the cab: window with a face below, beacon on the roof */}
      <path d="M84 150V88c0-8 6-14 14-14h40c10 0 16 6 18 14l8 62z" style={{ fill: MACHINE }} />
      <path d="M96 122V94c0-5 3-8 8-8h28c6 0 9 3 10 8l4 28z" fill={u('glass')} />
      <path d="M104 94h12l-14 22z" fill="#fff" opacity=".55" />
      <circle cx="110" cy="136" r="5" fill={INK} />
      <circle cx="136" cy="136" r="5" fill={INK} />
      <circle cx="111.6" cy="134.4" r="1.6" fill="#fff" />
      <circle cx="137.6" cy="134.4" r="1.6" fill="#fff" />
      <path d="M116 142c3 4 11 4 14 0" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <ellipse cx="100" cy="143" rx="5" ry="3" fill="#F0857A" opacity=".5" />
      <ellipse cx="146" cy="143" rx="5" ry="3" fill="#F0857A" opacity=".5" />
      <rect x="112" y="66" width="14" height="10" rx="3" fill={STEEL} />
      <g data-anim="twinkle" style={{ animationDuration: '.7s' }}>
        <circle cx="119" cy="62" r="10" fill="#FFB02E" opacity=".35" />
        <path d="M111 66a8 8 0 0 1 16 0z" fill="#FF9F1C" />
      </g>
      <path d="M40 180h36" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".35" />
    </g>
  );
}

/** A dump truck facing left with a friendly face and a heaped load (viewBox 0 0 300 210). */
function DumpTruck({ u }: { u: Url }) {
  return (
    <g>
      {/* load and bed */}
      <path d="M128 70c10-30 50-44 86-40s66 16 72 40z" fill={DIRT} />
      <circle cx="176" cy="46" r="7" fill={DIRT_DEEP} />
      <circle cx="222" cy="40" r="5" fill={DIRT_LIGHT} />
      <circle cx="252" cy="54" r="6" fill={DIRT_DEEP} />
      <path d="M120 66h176l-10 80H132z" fill="#F28C28" />
      <path d="M134 86h146M136 106h142M138 126h138" stroke="#D96F12" strokeWidth="4" />
      {/* chassis, cab, window, exhaust stack */}
      <rect x="20" y="138" width="272" height="26" rx="8" fill={STEEL} />
      <path d="M22 146V96c0-14 10-26 24-28l46-6c14-2 24 8 24 22v62z" style={{ fill: MACHINE }} />
      <path d="M40 104c0-10 6-18 16-20l34-4c8 0 12 4 12 12v14H40z" fill={u('glass')} />
      <path d="M50 86l16-2-18 20h-6z" fill="#fff" opacity=".55" />
      <rect x="104" y="44" width="10" height="30" rx="3" fill={STEEL} />
      {/* the face: headlight eyes and a grille smile */}
      <circle cx="36" cy="126" r="10" fill="#FFF8E0" />
      <circle cx="36" cy="128" r="5" fill={INK} />
      <circle cx="38" cy="126" r="1.8" fill="#fff" />
      <path d="M58 132c8 8 22 8 30 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="86" cy="120" rx="7" ry="4" fill="#F0857A" opacity=".45" />
      <rect x="10" y="150" width="30" height="12" rx="5" fill="#D9DEE2" />
      <g data-anim="twinkle" style={{ animationDuration: '.9s' }}>
        <circle cx="76" cy="58" r="10" fill="#FFB02E" opacity=".35" />
        <path d="M68 62a8 8 0 0 1 16 0z" fill="#FF9F1C" />
      </g>
      {/* wheels */}
      {[64, 214, 256].map((x) => (
        <g key={x}>
          <circle cx={x} cy="170" r="26" fill="#2F2B27" />
          <circle cx={x} cy="170" r="12" fill="#D9DEE2" />
          <circle cx={x} cy="170" r="4" fill={STEEL} />
        </g>
      ))}
    </g>
  );
}

function Cone() {
  // viewBox 0 0 60 80
  return (
    <g>
      <path d="M22 8c2-6 14-6 16 0l14 60H8z" fill={CONE} />
      <path d="M17 32h26l2.6 12H14.4zM12 54h36l2 8H10z" fill="#fff" />
      <rect x="2" y="66" width="56" height="10" rx="3" fill="#E0620E" />
    </g>
  );
}

/** A dirt pile with pebbles (viewBox 0 0 220 90). */
function DirtPile({ seed }: { seed: number }) {
  const rand = rng(seed);
  return (
    <g>
      <path d="M0 90C20 50 60 14 110 12s92 38 110 78z" fill={DIRT} />
      <path d="M60 40c20-18 60-22 84-8-26-2-60 2-84 8z" fill={DIRT_LIGHT} opacity=".7" />
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse
          key={i}
          cx={r1(30 + rand() * 160)}
          cy={r1(50 + rand() * 32)}
          rx={r1(3 + rand() * 4)}
          ry={r1(2 + rand() * 3)}
          fill={i % 2 ? DIRT_DEEP : DIRT_LIGHT}
        />
      ))}
    </g>
  );
}

export default function DigIt({ place, date }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const [dd, mm] = dayMonth(date) ?? ['17', '06'];
  const ground = card ? '26cqh' : '15cqh';
  const jibTop = card ? cm(3) : cm(5);
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <pattern
            id={ref('hazard')}
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="16" height="16" fill={HAZARD} />
            <rect width="8" height="16" fill={INK} />
          </pattern>
          <pattern
            id={ref('tape')}
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-40)"
          >
            <rect width="18" height="18" fill={HAZARD} />
            <rect width="9" height="18" fill={INK} />
          </pattern>
          <linearGradient id={ref('glass')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#E9F6FC" />
            <stop offset="1" stopColor={GLASS} />
          </linearGradient>
          <filter id={ref('soft')} x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3A2A10" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'radial-gradient(90cqw 40cqh at 50% 100%, rgba(255,225,160,.55), rgba(255,225,160,0) 70%)',
        }}
      />
      {/* clouds drifting behind the crane */}
      <Piece
        vb={[0, 0, 400, 120]}
        anim="drift"
        style={{ right: cm(-2), top: card ? cm(12) : cm(19), width: cm(card ? 30 : 46), opacity: 0.95 }}
      >
        <path d="M60 100c-26 0-30-34-6-40 2-26 36-34 52-14 12-20 46-18 48 8 24-2 30 30 8 46z" fill="#fff" />
        <path
          d="M262 70c-16 0-20-22-4-26 2-16 24-22 34-9 8-13 30-11 31 5 15-1 20 20 5 30z"
          fill="#fff"
          opacity=".85"
        />
      </Piece>
      {/* a far building in scaffolding on the horizon, behind the truck */}
      <Piece
        vb={[0, 0, 260, 200]}
        style={{
          right: cm(card ? 16 : 20),
          bottom: `calc(${ground} + ${cm(2)})`,
          width: cm(card ? 22 : 30),
          opacity: 0.55,
        }}
      >
        <g fill="none" stroke="#9FB3C4" strokeWidth="4" strokeLinecap="round">
          <path d="M30 200V60h200v140" />
          <path d="M30 100h200M30 140h200M30 180h200M80 60v140M130 60v140M180 60v140" strokeWidth="2.4" />
          <path d="M30 60l50 40M80 60l50 40M130 100l50 40M180 140l50 40" strokeWidth="2" />
        </g>
        <path d="M40 200v-50h40v50zM140 200v-90h40v90z" fill="#BFD0DD" />
      </Piece>
      {/* the ground: dirt with a lighter crest */}
      <Piece
        vb={[0, 0, 1200, 200]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? '34cqh' : '22cqh' }}
      >
        <path d="M0 70C200 50 400 64 600 60S1000 48 1200 62V200H0Z" fill={DIRT_LIGHT} />
        <path d="M0 96C240 82 480 92 720 88S1060 80 1200 90V200H0Z" fill={DIRT} />
        {Array.from({ length: 30 }, (_, i) => (
          <ellipse
            key={i}
            cx={20 + i * 40 + (i % 3) * 6}
            cy={120 + ((i * 29) % 70)}
            rx={4 + (i % 3)}
            ry={2.6 + (i % 2)}
            fill={i % 2 ? DIRT_DEEP : '#C99562'}
          />
        ))}
      </Piece>
      <Piece
        vb={[0, 0, 220, 90]}
        style={{ left: cm(card ? 18 : 24), bottom: `calc(${ground} - ${cm(6)})`, width: cm(card ? 22 : 34) }}
      >
        <DirtPile seed={3} />
      </Piece>
      <Piece
        vb={[0, 0, 220, 90]}
        style={{ right: cm(card ? 26 : 34), bottom: `calc(${ground} - ${cm(3)})`, width: cm(card ? 14 : 20) }}
      >
        <DirtPile seed={9} />
      </Piece>
      {/* the tower crane: its mast down the edge, the jib across the sky, the sign swinging on its hook */}
      <Piece
        vb={[0, 0, 60, 2000]}
        fit="xMidYMin slice"
        style={{
          left: cm(0.6),
          top: `calc(${jibTop} - ${cm(card ? 1.2 : 1.8)})`,
          width: cm(card ? 4 : 5.4),
          height: `calc(100% - ${ground} - ${jibTop})`,
        }}
      >
        <Mast />
      </Piece>
      <Piece
        vb={[0, 0, 2000, 60]}
        fit="xMaxYMid slice"
        style={{ left: cm(4), top: jibTop, width: card ? '64cqw' : '66cqw', height: cm(card ? 4 : 6) }}
      >
        <Jib />
      </Piece>
      <Piece
        vb={[0, 0, 160, 176]}
        anim="swing"
        style={{
          left: '50%',
          top: `calc(${jibTop} + ${cm(card ? 3 : 4.4)})`,
          width: card ? cm(20) : poster ? cm(24) : cmh(33),
          translate: '-50% 0',
          transformOrigin: '50% 0',
        }}
      >
        <WorkSign dd={dd} mm={mm} u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 60, 80]}
        style={{
          left: cm(card ? 32 : 40),
          bottom: `calc(${ground} - ${cm(2.5)})`,
          width: cm(card ? 4 : 6),
          rotate: '-8deg',
        }}
      >
        <Cone />
      </Piece>
      {/* the machines */}
      <Piece
        vb={[0, 0, 300, 250]}
        style={{ left: cm(card ? 1 : -2), bottom: card ? '6cqh' : '4cqh', width: cm(card ? 30 : 42) }}
      >
        <g filter={url('soft')}>
          <Excavator u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 300, 210]}
        anim="drift"
        style={{ right: cm(card ? 1 : -1), bottom: card ? '6cqh' : '4cqh', width: cm(card ? 30 : 40) }}
      >
        <g filter={url('soft')}>
          <DumpTruck u={url} />
        </g>
      </Piece>
      {/* caution tape between two cones, in front (narrower where the machines leave less room) */}
      <Piece
        vb={[0, 0, 300, 80]}
        style={{
          left: '50%',
          bottom: card ? '4cqh' : '2cqh',
          width: card ? cm(28) : `min(${cm(44)}, 26cqw)`,
          translate: '-50% 0',
        }}
      >
        <path d="M30 34C100 52 200 52 270 34l1 12C200 64 100 64 29 46z" fill={url('tape')} />
        <g transform="translate(0 4) scale(.9)">
          <Cone />
        </g>
        <g transform="translate(246 4) scale(.9)">
          <Cone />
        </g>
      </Piece>
    </>
  );
}
