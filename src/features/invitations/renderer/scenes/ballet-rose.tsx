import { Layer, Piece, cm, cmh, petalPath, r1, useIds, type SceneAnim, type SceneProps } from './kit';

/**
 * Ballet Rose — a little theatre before the show: rose velvet curtains drawn back with gold ropes and
 * tassels, a swagged valance with gold fringe, a warm spotlight on a blush backdrop, a pair of pointe
 * shoes hanging by their ribbons and a tutu on a satin hanger (both swinging gently), a bouquet of
 * roses thrown on the boards, petals drifting down and footlights along the stage. The roses follow
 * the accent.
 */
const ROSE = 'var(--inv-accent, #C8385F)';
const ROSE_DEEP = 'color-mix(in srgb, var(--inv-accent, #C8385F) 70%, #3A0716)';
const ROSE_LIGHT = 'color-mix(in srgb, var(--inv-accent, #C8385F) 55%, #FFE4EA)';
const GOLD = '#D8A64A';
const GOLD_LIGHT = '#F6D98C';
const GOLD_DEEP = '#9A6A1E';
const SATIN = '#F6C3CF';

type Url = (name: string) => string;

/** The left curtain (viewBox 0 0 200 1000, stretched to its box): gathered at a tie-back at 52%. */
function Curtain({ u }: { u: Url }) {
  const edge = 'M202 0C150 140 64 330 36 520C30 640 64 820 118 1000';
  return (
    <g>
      <path d={`M-4 0H202${edge.slice(6)}H-4Z`} fill={u('velvet')} />
      <path d={edge} fill="none" stroke="#3E0618" strokeWidth="14" opacity=".35" filter={u('blur')} />
      <path d={edge} fill="none" stroke="#F08AA6" strokeWidth="3" opacity=".45" transform="translate(-7 0)" />
      <path d="M-4 505Q28 536 64 524" fill="none" stroke={GOLD_DEEP} strokeWidth="8" strokeLinecap="round" />
      <path d="M-4 505Q28 536 64 524" fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="round" />
      <path
        d="M-4 505Q28 536 64 524"
        fill="none"
        stroke={GOLD_LIGHT}
        strokeWidth="5"
        strokeDasharray="2 5"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A tassel (viewBox 0 0 40 90) hanging from its cord at the top. */
function Tassel() {
  return (
    <g>
      <path d="M20 0V20" stroke={GOLD_DEEP} strokeWidth="3" />
      <circle cx="20" cy="24" r="7" fill={GOLD} />
      <circle cx="18" cy="22" r="2.4" fill={GOLD_LIGHT} />
      <path d="M13 30h14l6 52H7z" fill={GOLD} />
      <path d="M11 36h18" stroke={GOLD_DEEP} strokeWidth="3" />
      {[10, 14, 18, 22, 26, 30].map((x) => (
        <path
          key={x}
          d={`M${x} 42L${x + (x - 20) * 0.18} 84`}
          stroke={GOLD_DEEP}
          strokeWidth="1.2"
          opacity=".6"
        />
      ))}
    </g>
  );
}

/** The valance (viewBox 0 0 2400 150): a velvet band with gold braid, swags with fringe, tassels. */
function Valance({ u }: { u: Url }) {
  const swags = Array.from({ length: 10 }, (_, i) => i * 240);
  return (
    <g>
      <rect x="0" y="0" width="2400" height="46" fill={u('valance')} />
      {swags.map((x) => (
        <g key={x}>
          <path d={`M${x - 6} 38Q${x + 120} 168 ${x + 246} 38Z`} fill={u('swag')} />
          <path
            d={`M${x + 4} 46Q${x + 120} 150 ${x + 236} 46`}
            fill="none"
            stroke="#3E0618"
            strokeWidth="3"
            opacity=".25"
          />
          <path
            d={`M${x} 42Q${x + 120} 166 ${x + 240} 42`}
            fill="none"
            stroke={GOLD}
            strokeWidth="13"
            strokeDasharray="2.2 3.2"
            opacity=".95"
          />
        </g>
      ))}
      <path d="M0 40H2400" stroke={GOLD} strokeWidth="6" />
      <path d="M0 40H2400" stroke={GOLD_LIGHT} strokeWidth="6" strokeDasharray="4 8" />
      <path d="M0 30H2400" stroke={GOLD_DEEP} strokeWidth="2" opacity=".7" />
      {swags.map((x) => (
        <g key={x} transform={`translate(${x - 11} 40) scale(.55)`}>
          <Tassel />
        </g>
      ))}
    </g>
  );
}

/** A pointe shoe hanging toe down (viewBox origin at the opening's centre, about 30 × 104). */
function Shoe({ x, y, turn, u }: { x: number; y: number; turn: number; u: Url }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <path
        d="M-12 0C-20 10-22 44-15 72C-12 86-6 96 0 100H7C11 92 13 76 12 56C11 30 8 10 4 0Z"
        fill={u('satin')}
      />
      <path d="M-12 0C-8 7 0 8 4 0" fill="#C8667F" />
      <path d="M-4 98H7" stroke="#D07C92" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M-14 30C-15 50-12 70-6 86"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        opacity=".55"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Two pointe shoes on their ribbons (viewBox 0 0 120 300), tied in a bow at the top. */
function Slippers({ u }: { u: Url }) {
  return (
    <g>
      <g fill="none" strokeLinecap="round">
        <path d="M60 14C54 80 40 150 36 196" stroke="#E9A3B5" strokeWidth="5" />
        <path d="M60 14C66 80 80 150 84 204" stroke="#E9A3B5" strokeWidth="5" />
        <path d="M60 14C56 80 44 150 40 196" stroke="#FCE1E8" strokeWidth="1.6" opacity=".8" />
        <path d="M60 14C64 80 76 150 80 204" stroke="#FCE1E8" strokeWidth="1.6" opacity=".8" />
      </g>
      <g filter={u('drop')}>
        <Shoe x={34} y={194} turn={5} u={u} />
        <Shoe x={86} y={202} turn={-7} u={u} />
      </g>
      <g fill="none" strokeLinecap="round" stroke="#E9A3B5" strokeWidth="4">
        <path d="M31 200C22 214 26 232 16 246" />
        <path d="M89 208C100 222 94 240 104 254" />
      </g>
      <path d="M60 14C48 2 34 2 36 12C38 20 52 20 60 14Z" fill="#F3B5C4" />
      <path d="M60 14C72 2 86 2 84 12C82 20 68 20 60 14Z" fill="#EFA7B8" />
      <path d="M60 14L50 34M60 14L70 36" stroke="#E9A3B5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="14" r="5" fill="#E28EA5" />
    </g>
  );
}

/** A tutu on a gold hanger (viewBox 0 0 160 300): satin bodice, three layers of tulle. */
function Tutu({ u }: { u: Url }) {
  const hem = (y: number, w: number, bumps: number) => {
    const x0 = 80 - w / 2;
    const step = w / bumps;
    let d = `M${x0} ${y}`;
    for (let i = 0; i < bumps; i++)
      d += `Q${r1(x0 + step * (i + 0.5))} ${y + 12} ${r1(x0 + step * (i + 1))} ${y}`;
    return d;
  };
  return (
    <g>
      <path
        d="M80 0V10C80 18 72 18 72 12"
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M26 46L80 18L134 46" fill="none" stroke={GOLD} strokeWidth="5" strokeLinejoin="round" />
      <path d="M62 44L60 84M98 44L100 84" stroke="#EFA7B8" strokeWidth="4" strokeLinecap="round" />
      <g filter={u('drop')}>
        {/* tulle: back, middle and front layers flaring from the waist */}
        <path d={`M56 146L4 186${hem(186, 152, 8).slice(`M4 186`.length)}L104 146Z`} fill="#F7D0DA" />
        <path
          d={`M58 146L12 196${hem(196, 136, 7).slice(`M12 196`.length)}L102 146Z`}
          fill="#FBE2E8"
          opacity=".95"
        />
        <path
          d={`M60 146L22 204${hem(204, 116, 6).slice(`M22 204`.length)}L100 146Z`}
          fill="#FFF3F6"
          opacity=".92"
        />
        {[30, 44, 58, 72, 88, 102, 116, 130].map((x) => (
          <path key={x} d={`M80 148L${x} 198`} stroke="#fff" strokeWidth="1" opacity=".55" />
        ))}
        {/* the satin bodice */}
        <path d="M58 82C66 88 94 88 102 82L106 142C96 148 64 148 54 142Z" fill={u('bodice')} />
        <path d="M60 84C64 110 62 128 58 142" fill="none" stroke="#fff" strokeWidth="2" opacity=".45" />
        {[
          [72, 100],
          [88, 108],
          [80, 122],
          [70, 132],
          [92, 128],
        ].map(([x, y]) => (
          <circle key={`${x}.${y}`} cx={x} cy={y} r="1.8" fill="#fff" opacity=".85" />
        ))}
        <path d="M54 140C66 148 94 148 106 140L106 148C94 154 66 154 54 148Z" style={{ fill: ROSE }} />
        <path
          d="M80 146C72 138 64 140 66 146C68 152 76 150 80 146ZM80 146C88 138 96 140 94 146C92 152 84 150 80 146Z"
          style={{ fill: ROSE_DEEP }}
        />
      </g>
    </g>
  );
}

/** A rose head seen from above (centred at 0,0, radius ~r): three rings of petals, a curled heart. */
function Rose({ r }: { r: number }) {
  const ring = (n: number, turn: number, len: number, wid: number, fill: string) =>
    Array.from({ length: n }, (_, i) => (
      <path
        key={`${len}.${i}`}
        d={petalPath(0, 0, turn + (i * 360) / n, r * len, r * wid, 0.72)}
        style={{ fill }}
        stroke="rgba(60,5,20,.28)"
        strokeWidth={r * 0.04}
      />
    ));
  return (
    <g>
      {ring(5, 10, 1.05, 0.78, ROSE_DEEP)}
      {ring(5, 46, 0.82, 0.62, ROSE)}
      {ring(3, 0, 0.56, 0.46, ROSE_LIGHT)}
      <path
        d={`M${r * 0.06} ${-r * 0.04}C${r * 0.2} ${-r * 0.3} ${-r * 0.3} ${-r * 0.32} ${-r * 0.26} ${r * 0.02}C${-r * 0.22} ${r * 0.32} ${r * 0.28} ${r * 0.3} ${r * 0.32} ${-r * 0.02}`}
        fill="none"
        style={{ stroke: ROSE_DEEP }}
        strokeWidth={r * 0.1}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Three roses tied with a ribbon, lying on the boards (viewBox 0 0 220 110). */
function Bouquet({ u }: { u: Url }) {
  return (
    <g filter={u('drop')}>
      <path
        d="M40 60L200 92M46 70L196 100M44 50L198 84"
        stroke="#4E7A3C"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M96 64C110 44 134 44 146 56C130 60 112 64 96 64Z" fill="#6B9A4E" />
      <path d="M84 78C98 96 124 100 138 88C122 82 102 78 84 78Z" fill="#5A8A42" />
      <path d="M150 70L170 58L176 76L158 90Z" fill="#F7E4D8" />
      <path d="M150 70C160 62 168 72 160 80C154 84 146 78 150 70Z" style={{ fill: ROSE_LIGHT }} />
      <path
        d="M160 76C176 70 190 80 186 90M160 76C170 88 166 102 176 106"
        fill="none"
        style={{ stroke: ROSE_LIGHT }}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g transform="translate(40 58)">
        <Rose r={22} />
      </g>
      <g transform="translate(62 32) rotate(30)">
        <Rose r={18} />
      </g>
      <g transform="translate(66 80) rotate(-40)">
        <Rose r={17} />
      </g>
    </g>
  );
}

/** The stage floor (viewBox 0 0 1600 200): boards running upstage, a pool of light in the centre. */
function Boards({ u }: { u: Url }) {
  const lines = Array.from({ length: 33 }, (_, i) => i - 16);
  return (
    <g>
      <rect width="1600" height="200" fill={u('boards')} />
      {lines.map((i) => (
        <path
          key={i}
          d={`M${r1(800 + i * 36)} 0L${r1(800 + i * 120)} 200`}
          stroke="#9E5A55"
          strokeWidth="1.4"
          opacity=".28"
        />
      ))}
      {[18, 48, 92, 150].map((y) => (
        <path key={y} d={`M0 ${y}H1600`} stroke="#9E5A55" strokeWidth=".8" opacity=".15" />
      ))}
      <ellipse cx="800" cy="84" rx="460" ry="66" fill={u('pool')} />
      <rect width="1600" height="16" fill={u('upstage')} />
    </g>
  );
}

const PETALS: readonly (readonly [number, number, number, number, SceneAnim | undefined])[] = [
  // x %, y %, rotation, size, loop
  [34, 11, 20, 5.2, 'drift'],
  [58, 9, -40, 4.2, 'float'],
  [66, 17, 70, 3.6, 'sway'],
  [44, 23, 150, 4.6, 'drift'],
  [27, 27, -110, 3.8, 'float'],
  [74, 29, 40, 4.8, 'sway'],
  [16, 44, 200, 4, 'drift'],
  [85, 50, -20, 3.6, 'float'],
  [12, 70, 60, 4.4, 'sway'],
  [89, 74, -80, 4, 'drift'],
  [38, 91, 10, 4.2, undefined],
  [47, 95, 120, 3.4, undefined],
  [31, 96, -60, 3.2, undefined],
];

export default function BalletRose({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const hero = place === 'hero';
  const curtainW = card ? 'min(24cqw, 40cqh)' : 'min(28cqw, 34cqh)';
  const valanceH = card ? cm(20) : cmh(24);
  const floorH = card ? '22cqh' : '16cqh';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('velvet')} x1="0" x2="1">
            <stop offset="0" stopColor="#5E0C28" />
            <stop offset=".1" stopColor="#9C2148" />
            <stop offset=".2" stopColor="#6E1231" />
            <stop offset=".32" stopColor="#AE2B55" />
            <stop offset=".44" stopColor="#761536" />
            <stop offset=".56" stopColor="#B8325D" />
            <stop offset=".68" stopColor="#7E1839" />
            <stop offset=".8" stopColor="#B02E58" />
            <stop offset=".9" stopColor="#7A1637" />
            <stop offset="1" stopColor="#9E244B" />
          </linearGradient>
          <linearGradient id={ref('valance')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5A0B26" />
            <stop offset="1" stopColor="#8E1C41" />
          </linearGradient>
          <radialGradient id={ref('swag')} cx=".5" cy=".95" r=".7">
            <stop offset="0" stopColor="#C23B64" />
            <stop offset=".6" stopColor="#951F45" />
            <stop offset="1" stopColor="#62102C" />
          </radialGradient>
          <linearGradient id={ref('satin')} x1="0" x2="1">
            <stop offset="0" stopColor="#F9D3DC" />
            <stop offset=".55" stopColor={SATIN} />
            <stop offset="1" stopColor="#DE8FA5" />
          </linearGradient>
          <linearGradient id={ref('bodice')} x1="0" x2="1">
            <stop offset="0" stopColor="#FAD4DD" />
            <stop offset="1" stopColor="#E693AA" />
          </linearGradient>
          <linearGradient id={ref('boards')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#E3AFA2" />
            <stop offset="1" stopColor="#C98A7F" />
          </linearGradient>
          <radialGradient id={ref('pool')}>
            <stop offset="0" stopColor="#FFF6E8" stopOpacity=".85" />
            <stop offset="1" stopColor="#FFF6E8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ref('upstage')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8E4A52" stopOpacity=".45" />
            <stop offset="1" stopColor="#8E4A52" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ref('cone')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFF8EC" stopOpacity=".95" />
            <stop offset="1" stopColor="#FFF8EC" stopOpacity=".15" />
          </linearGradient>
          <linearGradient id={ref('petal')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: ROSE_LIGHT }} />
            <stop offset="1" style={{ stopColor: ROSE }} />
          </linearGradient>
          <filter id={ref('blur')} x="-20%" y="-5%" width="140%" height="110%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={ref('soft')} x="-30%" y="-10%" width="160%" height="120%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id={ref('drop')} x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#5A1A2E" floodOpacity=".25" />
          </filter>
        </defs>
      </svg>
      {/* the backdrop: blush, warmer where the spotlight falls */}
      <Layer
        style={{
          background:
            'radial-gradient(70cqw 46cqh at 50% 42%, rgba(255,251,244,.95), rgba(255,251,244,0) 72%),' +
            'linear-gradient(180deg, #EFC3CD 0%, #F8DCE2 38%, #F7D6DD 70%, #EDBFC9 100%)',
        }}
      />
      <Layer
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(160,60,90,.05) 0 1px, transparent 1px 7cqmin),' +
            'radial-gradient(90cqw 70cqh at 50% 45%, transparent 55%, rgba(120,30,60,.16) 100%)',
        }}
      />
      {/* the spotlight's cone, breathing */}
      <Piece
        vb={[0, 0, 400, 1000]}
        fit="none"
        anim="pulse"
        style={{
          left: '50%',
          top: 0,
          width: card ? '60cqw' : 'min(92cqw, 90cqh)',
          height: '100%',
          translate: '-50% 0',
        }}
      >
        <path d="M168 0H232L380 1000H20Z" fill={url('cone')} filter={url('soft')} opacity=".6" />
      </Piece>
      {/* the stage */}
      <Piece
        vb={[0, 0, 1600, 200]}
        fit="xMidYMin slice"
        style={{ left: 0, bottom: 0, width: '100%', height: floorH, aspectRatio: 'auto' }}
      >
        <Boards u={url} />
      </Piece>
      {/* footlights along the edge of the stage */}
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          data-anim={i % 2 ? 'flicker' : undefined}
          style={{
            position: 'absolute',
            left: `${6 + i * 11}%`,
            bottom: card ? '2cqh' : '1.4cqh',
            width: cm(card ? 2.4 : 3.2),
            aspectRatio: '1.6',
            translate: '-50% 0',
            borderRadius: '50% 50% 30% 30%',
            background: 'radial-gradient(circle at 50% 40%, #FFFBEA, #FFD98A 45%, rgba(255,200,120,0) 72%)',
            boxShadow: `0 0 ${cm(3)} ${cm(1)} rgba(255,214,140,.55)`,
            animationDelay: `${i * 0.8}s`,
          }}
        />
      ))}
      {/* the bouquet thrown on the boards */}
      <Piece
        vb={[0, 0, 220, 110]}
        style={{
          left: card ? '54%' : '56%',
          bottom: card ? '6cqh' : '3cqh',
          width: card ? cm(18) : cmh(30),
          rotate: '-6deg',
        }}
      >
        <Bouquet u={url} />
      </Piece>
      {/* curtains, drawn back and tied */}
      <Piece vb={[0, 0, 200, 1000]} fit="none" style={{ left: 0, top: 0, width: curtainW, height: '100%' }}>
        <Curtain u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 200, 1000]}
        fit="none"
        flip
        style={{ right: 0, top: 0, width: curtainW, height: '100%' }}
      >
        <Curtain u={url} />
      </Piece>
      {(['left', 'right'] as const).map((side) => (
        <Piece
          key={side}
          vb={[0, 0, 40, 90]}
          anim="sway"
          style={{
            [side]: `calc(${curtainW} * 0.31 - ${cm(card ? 1.6 : 2.4)})`,
            top: '52.4%',
            width: cm(card ? 3.2 : 4.8),
            animationDirection: side === 'right' ? 'alternate-reverse' : undefined,
          }}
        >
          <Tassel />
        </Piece>
      ))}
      {/* the valance over the whole proscenium */}
      <Piece
        vb={[0, 0, 2400, 150]}
        fit="xMidYMin slice"
        style={{ left: 0, top: 0, width: '100%', height: valanceH, aspectRatio: 'auto' }}
      >
        <Valance u={url} />
      </Piece>
      {/* pointe shoes and a tutu, hanging from the valance */}
      {!card ? (
        <>
          <Piece
            vb={[0, 0, 120, 300]}
            anim="swing"
            style={{
              left: hero ? '21%' : '19%',
              top: `calc(${valanceH} * .62)`,
              width: cmh(hero ? 17 : 14),
              translate: '-50% 0',
            }}
          >
            <Slippers u={url} />
          </Piece>
          <Piece
            vb={[0, 0, 160, 300]}
            anim="swing"
            style={{
              left: hero ? '79%' : '81%',
              top: `calc(${valanceH} * .62)`,
              width: cmh(hero ? 21 : 17),
              translate: '-50% 0',
              animationDirection: 'alternate-reverse',
            }}
          >
            <Tutu u={url} />
          </Piece>
        </>
      ) : null}
      {/* petals drifting down */}
      {PETALS.filter((_, i) => !card || i % 2 === 0).map(([x, y, rot, s, anim], i) => (
        <Piece
          key={i}
          vb={[0, 0, 40, 40]}
          anim={anim}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: card ? cm(s * 0.6) : cmh(s),
            rotate: `${rot}deg`,
            animationDelay: `${(i * 0.9) % 5}s`,
          }}
        >
          <path d={petalPath(8, 32, -45, 30, 17, 0.7)} fill={url('petal')} />
          <path d={petalPath(9, 31, -45, 19, 6)} fill="#fff" opacity=".3" />
        </Piece>
      ))}
      {/* gold glints in the light */}
      {(
        [
          [38, 14, 1.2],
          [64, 18, 0.2],
          [30, 26, 2],
          [72, 30, 0.8],
        ] as const
      ).map(([x, y, delay]) => (
        <Piece
          key={x}
          vb={[-10, -10, 20, 20]}
          anim="twinkle"
          style={{ left: `${x}%`, top: `${y}%`, width: cm(card ? 2 : 3), animationDelay: `${delay}s` }}
        >
          <path d="M0-10Q0 0 10 0Q0 0 0 10Q0 0-10 0Q0 0 0-10Z" fill={GOLD} />
        </Piece>
      ))}
    </>
  );
}
