import { Layer, Piece, ch, cm, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Campfire Night — a clearing in a pine forest at night: a crescent moon and twinkling stars over a
 * blue mountain ridge, tall pines framing the sky (an owl on a branch), a tent glowing from inside,
 * the campfire in a ring of stones with swaying flames and sparks rising, marshmallows toasting on
 * sticks and fireflies circling. The flames' glow follows the accent (ember, firefly and moonlight
 * presets tint it).
 */
const GLOW = 'var(--inv-accent, #F29A3A)';
const PINE_FAR = '#18304A';
const PINE_MID = '#10223A';
const PINE_NEAR = '#0A1626';

/** A pine: tiers of drooping boughs over a short trunk, its foot at (x, y). */
function Pine({ x, y, h, w, fill }: { x: number; y: number; h: number; w: number; fill: string }) {
  const tiers = 7;
  const paths = [];
  for (let i = 0; i < tiers; i++) {
    const top = y - h + (i * h * 0.78) / tiers;
    const bottom = top + h * 0.26;
    const half = (w * (0.22 + (0.78 * (i + 1)) / tiers)) / 2;
    paths.push(
      `M${r1(x)} ${r1(top)}L${r1(x + half)} ${r1(bottom)}Q${r1(x + half * 0.5)} ${r1(bottom - h * 0.035)} ${r1(x)} ${r1(bottom - h * 0.01)}Q${r1(x - half * 0.5)} ${r1(bottom - h * 0.035)} ${r1(x - half)} ${r1(bottom)}Z`,
    );
  }
  return (
    <g fill={fill}>
      <path
        d={`M${r1(x - w * 0.05)} ${r1(y)}h${r1(w * 0.1)}V${r1(y - h * 0.2)}h${r1(-w * 0.1)}Z`}
        fill="#050B14"
      />
      <path d={paths.join('')} />
    </g>
  );
}

/**
 * A stand of pines on the left edge (viewBox 0 0 200 700), the feet on the bottom edge: a tall one at
 * the edge, shorter ones inward so the text keeps its space. `far`: the paler row behind.
 */
function Stand({ owl, far = false }: { owl: boolean; far?: boolean }) {
  const [back, mid, near] = far ? ['#1E3B5E', '#1A3556', '#16304E'] : [PINE_FAR, PINE_MID, PINE_NEAR];
  return (
    <g>
      <Pine x={166} y={700} h={far ? 380 : 260} w={far ? 84 : 76} fill={back} />
      <Pine x={112} y={700} h={far ? 530 : 420} w={far ? 116 : 104} fill={mid} />
      <Pine x={40} y={700} h={690} w={150} fill={near} />
      {owl ? (
        // an SVG transform places it, the CSS wiggle (a transform too) runs on the group inside
        <g transform="translate(62 230)">
          <path d="M-30 20Q0 14 34 22" stroke="#0A1626" strokeWidth="5" strokeLinecap="round" fill="none" />
          <g data-anim="wiggle" style={{ transformBox: 'fill-box' }}>
            <ellipse cx="0" cy="0" rx="15" ry="19" fill="#3A3F52" />
            <path d="M-13-12L-9-24-3-15M13-12L9-24 3-15" fill="#3A3F52" />
            <circle cx="-6" cy="-6" r="5.4" fill="#F4E3B0" />
            <circle cx="6" cy="-6" r="5.4" fill="#F4E3B0" />
            <circle cx="-6" cy="-6" r="2.4" fill="#141A26" />
            <circle cx="6" cy="-6" r="2.4" fill="#141A26" />
            <path d="M-2-1L0 3 2-1Z" fill="#E0A34A" />
            <path d="M-9 6Q0 12 9 6M-8 11Q0 16 8 11" stroke="#5A6078" strokeWidth="1.4" fill="none" />
          </g>
        </g>
      ) : null}
    </g>
  );
}

/** The campfire (viewBox 0 0 200 170): logs in a ring of stones; the flames sway and flicker. */
function Fire() {
  const stones: [number, number, number][] = [
    [34, 146, 15],
    [58, 156, 16],
    [88, 161, 17],
    [118, 161, 17],
    [146, 156, 16],
    [168, 146, 14],
  ];
  return (
    <g>
      <ellipse cx="100" cy="150" rx="78" ry="16" fill="#2A1A14" />
      <path d="M44 146L150 118" stroke="#6B4226" strokeWidth="13" strokeLinecap="round" />
      <path d="M156 146L50 118" stroke="#7E5030" strokeWidth="13" strokeLinecap="round" />
      <path d="M150 118l3 1M50 118l-3 1" stroke="#C98A4A" strokeWidth="9" strokeLinecap="round" />
      <g data-anim="sway">
        <g data-anim="flicker">
          <path
            d="M100 4C128 38 146 70 138 104 132 128 116 138 100 138S66 128 62 104C56 76 74 60 80 40 86 58 92 64 98 66 94 44 96 24 100 4Z"
            fill="#E4471F"
          />
          <path
            d="M101 36C120 60 128 84 122 106 118 122 110 132 100 132S80 122 78 106C75 88 86 76 90 62 94 74 98 78 102 80 99 64 99 50 101 36Z"
            fill="#F7862A"
          />
          <path
            d="M100 70C112 86 116 100 112 114 109 124 105 130 100 130S90 124 88 114C85 102 92 92 96 84 97 92 99 96 102 97 100 88 99 80 100 70Z"
            fill="#FFD66B"
          />
        </g>
      </g>
      {stones.map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.66} fill={i % 2 ? '#5A5E6E' : '#6E7282'} />
      ))}
      {stones.map(([x, y, r], i) => (
        <ellipse
          key={`h${i}`}
          cx={x - r * 0.2}
          cy={y - r * 0.3}
          rx={r * 0.5}
          ry={r * 0.22}
          fill="#F6B46A"
          opacity=".35"
        />
      ))}
    </g>
  );
}

/** A tent glowing from inside, a lantern at its door (viewBox 0 0 220 160). */
function Tent() {
  return (
    <g>
      <ellipse cx="110" cy="152" rx="102" ry="9" fill="#060C16" opacity=".6" />
      <path d="M12 150L110 22 208 150Z" fill="#C1763C" />
      <path d="M110 22L208 150H150Z" fill="#9A5A2C" />
      <path d="M110 30L74 150H146Z" fill="#FFD27A" />
      <path d="M110 30L92 150H128Z" fill="#FFE9A8" />
      <path d="M110 30L60 150H74Z" fill="#E09A48" />
      <path d="M110 22L104 10M110 22L116 10" stroke="#5A3A20" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M12 150L0 158M208 150L220 158M40 112L2 152M180 112L218 152"
        stroke="#8A6A4A"
        strokeWidth="1.2"
      />
      <g data-anim="pulse">
        <circle cx="166" cy="128" r="22" fill="#FFD27A" opacity=".22" />
        <path d="M160 118h12l-2 18h-8z" fill="#FFE9A8" />
        <path d="M158 118h16M161 136h10" stroke="#3A2A1E" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M166 118v-8" stroke="#3A2A1E" strokeWidth="1.6" />
      </g>
    </g>
  );
}

/** Two sticks with marshmallows toasting, held in from the right (viewBox 0 0 200 110). */
function Marshmallows() {
  const mallow = (x: number, y: number, deg: number) => (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <rect x={x - 10} y={y - 8} width="20" height="16" rx="6" fill="#FFF8EE" />
      <rect x={x - 10} y={y - 8} width="9" height="16" rx="5" fill="#E8B06A" />
      <rect x={x - 10} y={y - 8} width="4" height="16" rx="3" fill="#B8783A" />
    </g>
  );
  return (
    <g>
      <path d="M204 88L40 44" stroke="#8A5A32" strokeWidth="4" strokeLinecap="round" />
      <path d="M204 106L62 86" stroke="#7A4E2A" strokeWidth="4" strokeLinecap="round" />
      {mallow(34, 42, 15)}
      {mallow(18, 38, 15)}
      {mallow(56, 84, 8)}
    </g>
  );
}

export default function CampfireNight({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const size = (n: number, h: number) => `min(${n}cqmin, ${h}cqh)`;
  const stars = (seed: number, n: number) => {
    const rand = rng(seed);
    return Array.from(
      { length: n },
      () => [r1(rand() * 200), r1(rand() * 110), r1(0.3 + rand() * 0.7)] as const,
    );
  };
  const flies = [
    [10, 58],
    [22, 70],
    [84, 54],
    [90, 66],
    [16, 44],
    [78, 76],
    [30, 82],
    [70, 84],
  ] as const;
  // the pines stand at both sides — on a phone partly off the edge, on a wide hero beside the text —
  // with a paler row behind them, spread further in on a wide hero
  const stand = card ? 'calc(50% - 56cqmin)' : 'max(-9cqmin, calc(50% - 80cqmin))';
  const back = card ? 'calc(50% - 38cqmin)' : 'calc(50% - 66cqmin)';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('moon-glow')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#DCE8FF" stopOpacity=".55" />
            <stop offset=".4" stopColor="#9DB6E8" stopOpacity=".18" />
            <stop offset="1" stopColor="#9DB6E8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ref('fire-glow')} cx=".5" cy=".5" r=".5">
            <stop offset="0" style={{ stopColor: GLOW }} stopOpacity=".62" />
            <stop offset=".45" style={{ stopColor: GLOW }} stopOpacity=".2" />
            <stop offset="1" style={{ stopColor: GLOW }} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ref('fly')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FBFFD8" />
            <stop offset=".3" stopColor="#DDF28A" stopOpacity=".85" />
            <stop offset="1" stopColor="#C9E265" stopOpacity="0" />
          </radialGradient>
          <mask id={ref('crescent')}>
            <rect width="100" height="100" fill="#fff" />
            <circle cx="63" cy="40" r="34" fill="#000" />
          </mask>
        </defs>
      </svg>
      {/* the night sky */}
      <Layer
        style={{
          background:
            'linear-gradient(180deg, #0A1230 0%, #101C41 30%, #172A52 52%, #203B64 68%, #2A4A70 78%)',
        }}
      />
      {[
        [3, 60, '0s'],
        [8, 34, '-1.4s'],
        [13, 22, '-0.7s'],
      ].map(([seed, n, delay], k) => (
        <Piece
          key={k}
          vb={[0, 0, 200, 110]}
          anim="twinkle"
          fit="xMidYMin slice"
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: ch(70),
            aspectRatio: 'auto',
            overflow: 'hidden',
            animationDelay: delay as string,
          }}
        >
          {stars(seed as number, n as number).map(([x, y, r], i) =>
            k === 2 && i % 4 === 0 ? (
              <path
                key={i}
                d={`M${x} ${y - r * 3}Q${x} ${y} ${x + r * 3} ${y}Q${x} ${y} ${x} ${y + r * 3}Q${x} ${y} ${x - r * 3} ${y}Q${x} ${y} ${x} ${y - r * 3}Z`}
                fill="#FFF6DC"
              />
            ) : (
              <circle key={i} cx={x} cy={y} r={r * 0.8} fill="#EAF0FF" opacity={0.45 + (i % 3) * 0.2} />
            ),
          )}
        </Piece>
      ))}
      {/* the crescent moon */}
      <Piece
        vb={[0, 0, 100, 100]}
        anim="pulse"
        style={{
          left: card ? '78%' : 'calc(50% + 24cqmin)',
          top: card ? '18%' : poster ? '10%' : '12%',
          width: size(card ? 30 : 40, 32),
          translate: '-50% -50%',
        }}
      >
        <circle cx="50" cy="50" r="50" fill={url('moon-glow')} />
      </Piece>
      <Piece
        vb={[0, 0, 100, 100]}
        style={{
          left: card ? '78%' : 'calc(50% + 24cqmin)',
          top: card ? '18%' : poster ? '10%' : '12%',
          width: size(card ? 9 : 13, 11),
          translate: '-50% -50%',
          rotate: '-18deg',
        }}
      >
        <circle cx="50" cy="50" r="40" fill="#FFF3CF" mask={url('crescent')} />
      </Piece>
      {/* the far ridge and the treeline under it */}
      <Piece
        vb={[0, 0, 1200, 260]}
        fit="xMidYMax slice"
        style={{
          left: 0,
          bottom: ch(10),
          width: '100%',
          height: ch(card ? 34 : 30),
          aspectRatio: 'auto',
          overflow: 'hidden',
        }}
      >
        <path
          d="M0 150L90 96 160 132 250 58 330 118 420 80 500 124 600 40 690 110 780 70 860 118 950 64 1040 120 1120 88 1200 124V260H0Z"
          fill="#1D355A"
        />
        <path
          d="M0 176L120 140 230 170 360 128 470 168 600 132 720 166 840 136 960 170 1080 140 1200 168V260H0Z"
          fill="#172B4A"
        />
        {Array.from({ length: 60 }, (_, i) => {
          const x = i * 20 + (i % 3) * 6;
          const h = 26 + ((i * 37) % 5) * 8;
          return <path key={i} d={`M${x} ${210 - h}L${x + 9} 212H${x - 9}Z`} fill={PINE_FAR} />;
        })}
        <path d="M0 206H1200V260H0Z" fill={PINE_FAR} />
      </Piece>
      {/* the clearing */}
      <Layer
        style={{
          top: 'auto',
          height: ch(card ? 12 : 11),
          background: 'linear-gradient(180deg, #13233A, #0B1524)',
        }}
      />
      <Piece
        vb={[0, 0, 100, 100]}
        anim="pulse"
        style={{
          left: '50%',
          bottom: card ? ch(-10) : ch(-8),
          width: size(card ? 60 : 92, 70),
          translate: '-50% 0',
        }}
      >
        <circle cx="50" cy="50" r="50" fill={url('fire-glow')} />
      </Piece>
      {/* pines at both sides: the paler row behind, the dark stand in front */}
      {(['left', 'right'] as const).map((edge, i) => (
        <Piece
          key={`b${edge}`}
          vb={[0, 0, 200, 700]}
          style={{ [edge]: back, bottom: 0, height: ch(card ? 80 : 64), aspectRatio: '200 / 700' }}
        >
          <g transform={i ? 'translate(200 0) scale(-1 1)' : undefined}>
            <Stand owl={false} far />
          </g>
        </Piece>
      ))}
      {(['left', 'right'] as const).map((edge, i) => (
        <Piece
          key={edge}
          vb={[0, 0, 200, 700]}
          style={{
            [edge]: stand,
            bottom: 0,
            height: card ? ch(96) : poster ? ch(76) : ch(82),
            aspectRatio: '200 / 700',
          }}
        >
          <g transform={i ? 'translate(200 0) scale(-1 1)' : undefined}>
            <Stand owl={!i && !card} />
          </g>
        </Piece>
      ))}
      {/* the tent, the fire, the marshmallows */}
      <Piece
        vb={[0, 0, 220, 160]}
        style={{
          left: card ? '10%' : 'max(3cqmin, calc(50% - 60cqmin))',
          bottom: ch(card ? 4 : 5),
          width: size(card ? 22 : 34, 30),
        }}
      >
        <Tent />
      </Piece>
      <Piece
        vb={[0, 0, 200, 170]}
        style={{
          left: '50%',
          bottom: ch(card ? 2 : 1.5),
          width: size(card ? 20 : 30, 26),
          translate: '-50% 0',
        }}
      >
        <Fire />
      </Piece>
      {card
        ? null
        : [
            // [offset from the centre, delay, size, height above the flames] (cqmin)
            [-5, 0, 1.2, 0],
            [3, -2.6, 1, 7],
            [-2, -5.2, 0.9, 13],
            [6, -1.5, 0.8, 3],
            [1, -3.8, 1.1, 10],
          ].map(([dx, delay, s, lift], k) => (
            <Piece
              key={k}
              vb={[0, 0, 10, 10]}
              anim="rise"
              style={{
                left: `calc(50% + ${cm(dx!)})`,
                bottom: `calc(${ch(1.5)} + ${size(26 + lift!, 22 + lift! * 0.8)})`,
                width: cm(s!),
                animationDelay: `${delay}s`,
              }}
            >
              <circle cx="5" cy="5" r="5" fill="#FFC061" />
            </Piece>
          ))}
      <Piece
        vb={[0, 0, 200, 110]}
        anim="float"
        style={{
          right: card ? '8%' : 'max(-4cqmin, calc(50% - 50cqmin))',
          bottom: ch(card ? 5 : 4),
          width: size(card ? 22 : 36, 30),
        }}
      >
        <Marshmallows />
      </Piece>
      {/* fireflies circling in the dark */}
      {flies.map(([x, y], i) => (
        <Piece
          key={i}
          vb={[0, 0, 10, 10]}
          anim={i % 2 ? 'orbit' : 'twinkle'}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: cm(card ? 1.6 : 2.2),
            animationDelay: `${-i * 1.1}s`,
          }}
        >
          <circle cx="5" cy="5" r="5" fill={url('fly')} />
        </Piece>
      ))}
    </>
  );
}
