import { Layer, Piece, cm, rng, r1, useIds, type SceneProps } from './kit';

/**
 * Dino Hatch — a prehistoric valley: a smoking volcano, rolling green hills with ferns, a chunky
 * T-rex and a stegosaurus, a cracked spotted egg, a trail of three-toed footprints and a sun. The lava
 * and the stegosaurus plates follow the accent.
 */
const GREEN = '#6CC04A';
const GREEN_DEEP = '#3F8A2E';
const GREEN_DARK = '#2E6A22';
const YELLOW = '#F9C74F';
const BROWN = '#8B5E3C';
const LAVA = 'var(--inv-accent, #FF7A1A)';
const INK = '#23311F';

type Url = (name: string) => string;

/** A chunky T-rex facing right (viewBox 0 0 220 200). */
function Rex({ u }: { u: Url }) {
  return (
    <g>
      <path d="M40 150C10 150-6 120 4 110c16 18 36 16 52 6z" fill={GREEN_DEEP} />
      <path d="M60 196l6-40h26l-4 40zM112 196l2-38h26l2 38z" fill={GREEN_DEEP} />
      <path
        d="M50 168c0-50 30-86 80-90l30-2c24-2 44 14 44 36 0 14-8 22-22 24l-30 4c-8 30-30 56-62 56-28 0-40-12-40-28z"
        fill={u('rex')}
      />
      <path d="M150 110c-4 10-4 18 2 24l10-10z" fill={GREEN_DEEP} />
      <path d="M160 104l30-2c6 0 10 4 10 8" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M170 106l3 6 3-6M182 106l3 6 3-6" stroke="#fff" strokeWidth="2.4" fill="none" />
      <circle cx="170" cy="86" r="7" fill="#fff" />
      <circle cx="172" cy="86" r="4" fill={INK} />
      <circle cx="173" cy="84" r="1.4" fill="#fff" />
      <path
        d="M114 132c8 4 12 10 10 16"
        stroke={GREEN_DEEP}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="96" cy="150" rx="26" ry="20" fill="#A5DB84" opacity=".7" />
      {[
        [96, 96],
        [118, 90],
        [80, 116],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={5 - i} fill={GREEN_DEEP} opacity=".5" />
      ))}
    </g>
  );
}

/** A stegosaurus facing left (viewBox 0 0 240 160). */
function Stego({ u }: { u: Url }) {
  const plates = [
    [90, 56, 22],
    [116, 44, 26],
    [144, 44, 26],
    [170, 54, 22],
    [192, 70, 16],
  ];
  return (
    <g>
      {plates.map(([x, y, s], i) => (
        <path
          key={i}
          d={`M${x! - s! / 2} ${y! + 12}L${x} ${y! - s!}L${x! + s! / 2} ${y! + 12}Z`}
          style={{ fill: LAVA }}
          strokeLinejoin="round"
        />
      ))}
      <path d="M200 100c20 0 34 10 40 24-18-4-30-4-44 2z" fill={YELLOW} />
      <path d="M236 124l-6 8 10-2z" fill={INK} />
      <path
        d="M60 106c0-34 36-54 86-54s74 26 70 58c-2 14-14 20-30 20H90c-18 0-30-10-30-24z"
        fill={u('stego')}
      />
      <path d="M78 150l4-26h18l-2 26zM170 150l-2-26h18l4 26z" fill="#D9A62E" />
      <path d="M64 104c-20-2-40 4-50 16 4 12 18 16 30 12 10-4 18-12 20-28z" fill={u('stego')} />
      <circle cx="26" cy="116" r="4" fill={INK} />
      <path d="M16 126c6 2 12 2 16-2" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
      {[110, 140, 170].map((x) => (
        <circle key={x} cx={x} cy={96} r="5" fill="#fff" opacity=".35" />
      ))}
    </g>
  );
}

/** The cracked, spotted egg (viewBox 0 0 100 120). */
function Egg() {
  return (
    <g>
      <path d="M50 6C24 6 8 50 8 76c0 24 18 40 42 40s42-16 42-40C92 50 76 6 50 6z" fill="#FFF8E6" />
      <circle cx="34" cy="52" r="7" fill={GREEN} opacity=".7" />
      <circle cx="62" cy="36" r="5" fill={GREEN} opacity=".7" />
      <circle cx="66" cy="78" r="8" fill={GREEN} opacity=".7" />
      <circle cx="36" cy="94" r="5" fill={GREEN} opacity=".7" />
      <path
        d="M14 62l14 8 10-10 12 12 12-12 12 10 14-8"
        stroke={INK}
        strokeWidth="2.6"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M50 6C24 6 8 50 8 76c0 24 18 40 42 40s42-16 42-40C92 50 76 6 50 6z"
        fill="none"
        stroke="#E2D6B8"
        strokeWidth="2"
      />
    </g>
  );
}

function Fern({ tone = GREEN_DEEP }: { tone?: string }) {
  // viewBox 0 0 120 200, rising from the bottom
  const leaves: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y = 180 - i * 18;
    const l = 40 - i * 3.6;
    const x = 60 + Math.sin(i / 3) * 6;
    leaves.push(
      `M${r1(x)} ${y}q${-l * 0.5} ${-6} ${-l} ${-2}q${l * 0.5} ${-6} ${l} ${2}M${r1(x)} ${y}q${l * 0.5} ${-6} ${l} ${-2}q${-l * 0.5} ${-6} ${-l} ${2}`,
    );
  }
  return (
    <g>
      <path
        d="M60 200C58 150 66 90 58 20"
        stroke={tone}
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
      />
      <path d={leaves.join('')} fill={tone} />
    </g>
  );
}

function Footprint({ x, y, deg, s }: { x: number; y: number; deg: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg}) scale(${s})`} fill={BROWN} opacity=".45">
      <ellipse cx="0" cy="6" rx="7" ry="8" />
      <ellipse cx="-8" cy="-8" rx="3" ry="7" transform="rotate(-24 -8 -8)" />
      <ellipse cx="0" cy="-11" rx="3" ry="7" />
      <ellipse cx="8" cy="-8" rx="3" ry="7" transform="rotate(24 8 -8)" />
    </g>
  );
}

export default function DinoHatch({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const rand = rng(4);
  const puffs = Array.from(
    { length: 5 },
    (_, i) => [r1(96 + i * 7 + rand() * 6), r1(40 - i * 16), r1(10 + i * 3)] as const,
  );
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('rex')} cx=".4" cy=".3" r=".8">
            <stop offset="0" stopColor="#8CD86A" />
            <stop offset=".7" stopColor={GREEN} />
            <stop offset="1" stopColor={GREEN_DEEP} />
          </radialGradient>
          <radialGradient id={ref('stego')} cx=".4" cy=".3" r=".8">
            <stop offset="0" stopColor="#FFE08A" />
            <stop offset=".7" stopColor={YELLOW} />
            <stop offset="1" stopColor="#D9A62E" />
          </radialGradient>
          <filter id={ref('soft')} x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#23311F" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'radial-gradient(40cqmin 40cqmin at 14% 9%, rgba(255,236,160,.9), rgba(255,236,160,0) 70%)',
        }}
      />
      <Piece vb={[0, 0, 60, 60]} anim="spin" style={{ left: cm(8), top: cm(7), width: cm(card ? 10 : 14) }}>
        <circle cx="30" cy="30" r="16" fill={YELLOW} />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i * 36 * Math.PI) / 180;
          return (
            <path
              key={i}
              d={`M${r1(30 + Math.cos(a) * 21)} ${r1(30 + Math.sin(a) * 21)}L${r1(30 + Math.cos(a) * 28)} ${r1(30 + Math.sin(a) * 28)}`}
              stroke={YELLOW}
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}
      </Piece>
      {/* volcano with smoke and lava */}
      <Piece
        vb={[0, 0, 200, 160]}
        style={{ right: cm(-4), bottom: card ? '26cqh' : '17cqh', width: cm(card ? 34 : 54) }}
      >
        <g opacity=".95">
          {puffs.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y + 30} r={r} fill="#fff" opacity={0.9 - i * 0.12} />
          ))}
          <path d="M20 160L84 52h32l64 108z" fill="#9C7A5C" />
          <path d="M84 52h32l10 18c-10 8-22 6-28-2-6 8-16 8-22 0z" style={{ fill: LAVA }} />
          <path
            d="M100 66c-4 16 2 30-4 44"
            style={{ stroke: LAVA }}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M20 160L84 52h8L50 160z" fill="#fff" opacity=".12" />
        </g>
      </Piece>
      {/* the valley */}
      <Piece
        vb={[0, 0, 1200, 300]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? '32cqh' : '22cqh' }}
      >
        <path d="M0 110C200 60 380 80 560 100S920 60 1200 90V300H0Z" fill="#A8D98A" />
        <path d="M0 170C220 130 420 150 620 164S980 130 1200 150V300H0Z" fill={GREEN} />
        <path d="M0 240C260 220 520 232 760 236S1060 226 1200 232V300H0Z" fill={GREEN_DEEP} />
        {Array.from({ length: 7 }, (_, i) => (
          <Footprint key={i} x={420 + i * 60} y={200 + (i % 2) * 14} deg={80} s={1.1} />
        ))}
      </Piece>
      <Piece vb={[0, 0, 120, 200]} style={{ left: cm(-3), bottom: cm(-2), width: cm(card ? 14 : 20) }}>
        <Fern />
      </Piece>
      <Piece
        vb={[0, 0, 120, 200]}
        style={{ right: cm(-4), bottom: cm(-3), width: cm(card ? 12 : 18), rotate: '10deg' }}
      >
        <Fern tone={GREEN_DARK} />
      </Piece>
      <Piece
        vb={[0, 0, 220, 200]}
        style={{ left: cm(card ? 4 : 2), bottom: card ? '10cqh' : '5cqh', width: cm(card ? 24 : 40) }}
      >
        <g filter={url('soft')}>
          <Rex u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 240, 160]}
        style={{ right: cm(card ? 4 : 1), bottom: card ? '8cqh' : '4.5cqh', width: cm(card ? 26 : 42) }}
      >
        <g filter={url('soft')}>
          <Stego u={url} />
        </g>
      </Piece>
      <Piece
        vb={[0, 0, 100, 120]}
        anim="sway"
        style={{ left: '50%', bottom: card ? '6cqh' : '9cqh', width: cm(card ? 7 : 10), translate: '-50% 0' }}
      >
        <g filter={url('soft')}>
          <Egg />
        </g>
      </Piece>
    </>
  );
}
