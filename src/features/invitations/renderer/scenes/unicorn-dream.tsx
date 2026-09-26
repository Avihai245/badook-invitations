import { Layer, Piece, cm, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Unicorn Dream — a candy-coloured sky: a pastel rainbow arching over the names from two clouds,
 * twinkling sparkles and stars, and on a bank of soft clouds a unicorn rocking gently, its mane and
 * tail in every pastel, a golden horn shedding glitter; a bunch of balloons and floating hearts. The
 * mane's first lock, a balloon and the hearts follow the accent.
 */
const ACCENT = 'var(--inv-accent, #C7307F)';
const ACCENT_SOFT = 'color-mix(in srgb, var(--inv-accent, #C7307F) 45%, #FFFFFF)';
const PLUM = '#4A2A55';
const LILAC = '#C3A8F2';
const MINT = '#9EE3CB';
const PEACH = '#FFC7A6';
const LEMON = '#FFE89A';
const SKY = '#A6D8F5';
const PINK = '#FFA6CB';
const GOLD = '#F7C948';
const HOOF = '#D9C3F5';

type Url = (name: string) => string;

const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

const star = (x: number, y: number, s: number) =>
  `M${Array.from({ length: 10 }, (_, i) => polar(x, y, i % 2 ? s * 0.45 : s, i * 36 - 90).join(' ')).join('L')}Z`;

/** A fluffy cloud centred on (x, y), `s` its scale. */
function Cloud({ x, y, s, shade = '#EBDDFB' }: { x: number; y: number; s: number; shade?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-58 22c-18 0-24-24-6-30 0-18 22-26 34-14 6-20 38-22 46-2 14-10 36-2 34 16 18 2 18 30 0 30z"
        fill={shade}
      />
      <path
        d="M-58 16c-18 0-24-24-6-30 0-18 22-26 34-14 6-20 38-22 46-2 14-10 36-2 34 16 18 2 18 30 0 30z"
        fill="#fff"
      />
    </g>
  );
}

/** The rainbow: six pastel bands from cloud to cloud (viewBox 0 0 400 214). */
function Rainbow() {
  const bands = [PINK, PEACH, LEMON, MINT, SKY, LILAC];
  return (
    <g>
      {bands.map((c, i) => {
        const r = 180 - i * 17;
        return (
          <path
            key={c}
            d={`M${200 - r} 200A${r} ${r} 0 0 1 ${200 + r} 200`}
            stroke={c}
            strokeWidth="18"
            fill="none"
          />
        );
      })}
      <path d="M26 200A174 174 0 0 1 374 200" stroke="#fff" strokeWidth="3" fill="none" opacity=".5" />
      <Cloud x={40} y={192} s={0.62} />
      <Cloud x={360} y={192} s={0.62} />
    </g>
  );
}

/** One flowing lock of mane or tail: a teardrop from (x, y) curling down to (ex, ey), `w` wide. */
const lock = (x: number, y: number, ex: number, ey: number, w: number, curl: number) =>
  `M${x} ${y}C${x + w} ${y + (ey - y) * 0.2} ${ex + w + curl} ${ey - (ey - y) * 0.35} ${ex} ${ey}` +
  `C${ex - curl * 0.6} ${ey - (ey - y) * 0.3} ${x - w * 0.4} ${y + (ey - y) * 0.4} ${x} ${y}Z`;

/** A unicorn standing, facing left: rainbow mane and tail, a golden horn (viewBox 0 0 260 230). */
function Unicorn({ u }: { u: Url }) {
  const glitter: [number, number, number][] = [
    [40, 4, 2.6],
    [26, 18, 2],
    [18, -2, 1.8],
    [52, -12, 2.2],
    [12, 30, 1.6],
  ];
  return (
    <g>
      {/* tail: flowing pastel locks that sway from the rump */}
      <g data-anim="sway" style={{ animationDelay: '-2s' }}>
        <path d={lock(214, 128, 232, 206, 34, 14)} fill={LILAC} />
        <path d={lock(216, 134, 250, 186, 26, 10)} fill={MINT} />
        <path d={lock(212, 132, 214, 200, 18, 12)} style={{ fill: ACCENT_SOFT }} />
        <path d={lock(218, 128, 254, 160, 16, 6)} fill={LEMON} />
      </g>
      {/* far legs, a shade darker */}
      <rect x="150" y="160" width="20" height="54" rx="10" fill="#EFE6FB" />
      <rect x="206" y="158" width="20" height="56" rx="10" fill="#EFE6FB" />
      <path
        d="M150 204h20v4c0 5.5-4.5 10-10 10s-10-4.5-10-10zM206 204h20v4c0 5.5-4.5 10-10 10s-10-4.5-10-10z"
        fill="#CDB5F0"
      />
      {/* body and near legs */}
      <ellipse cx="184" cy="146" rx="56" ry="36" fill={u('coat')} />
      <rect x="132" y="158" width="22" height="58" rx="11" fill="#fff" />
      <rect x="188" y="160" width="22" height="56" rx="11" fill="#fff" />
      <path
        d="M132 206h22v4c0 6-5 11-11 11s-11-5-11-11zM188 206h22v4c0 6-5 11-11 11s-11-5-11-11z"
        fill={HOOF}
      />
      <ellipse cx="200" cy="132" rx="22" ry="12" fill="#fff" opacity=".7" />
      {/* neck */}
      <path d="M104 96c14-8 34-6 46 8 10 12 14 28 12 44l-40 6c0-20-6-38-22-52z" fill={u('coat')} />
      {/* head: cranium and a long soft muzzle */}
      <path
        d="M72 44c24-14 58-6 64 24 4 18-4 34-18 44-12 8-22 12-32 18-14 8-32 8-42-2-10-10-8-26 2-38 8-10 14-22 26-46z"
        fill={u('coat')}
      />
      <path d="M34 104c-8 10-6 22 4 28 10 6 26 2 38-6-14 2-30-4-42-22z" fill="#FFE4F0" />
      <path d="M40 112c2-3 6-4 9-2" stroke="#D98AB0" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M44 128c6 3 14 2 19-2" stroke={PLUM} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* ear */}
      <path d="M112 48l6-30 16 26z" fill="#fff" />
      <path d="M116 44l4-16 8 14z" fill="#FFC3DC" />
      {/* horn: a golden spiral, glitter trailing off */}
      <path d="M86 44L58 -8l40 40z" fill={u('horn')} />
      <path d="M70 18l16-6M76 28l15-6M64 8l12-4" stroke="#E0A92E" strokeWidth="3" strokeLinecap="round" />
      {glitter.map(([x, y, r], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill={GOLD}
          data-anim="twinkle"
          style={{ animationDelay: `${-i * 0.6}s` }}
        />
      ))}
      {/* face: a happy closed eye with lashes, a rosy cheek */}
      <path d="M82 76q9 8 18 0" stroke={PLUM} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M84 80l-4 4M90 82l-1 5M96 81l2 5" stroke={PLUM} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="92" cy="98" rx="10" ry="6" fill="#FF9EC4" opacity=".5" />
      {/* mane: big locks down the back of the neck, a forelock by the horn; the first in the accent */}
      <g data-anim="sway">
        <path d={lock(116, 40, 150, 104, 34, 12)} style={{ fill: ACCENT_SOFT }} />
        <path d={lock(126, 64, 158, 132, 28, 12)} fill={LILAC} />
        <path d={lock(136, 92, 162, 150, 22, 10)} fill={MINT} />
        <path d={lock(110, 38, 132, 62, 16, 8)} fill={PEACH} />
      </g>
      <path d={lock(100, 36, 84, 60, 14, 6)} fill={LEMON} />
    </g>
  );
}

/** Three balloons on strings tied together (viewBox 0 0 120 230). */
function Balloons() {
  const balloon = (x: number, y: number, fill: string, delay: string) => (
    <g data-anim="float" style={{ animationDelay: delay }}>
      <path
        d={`M${x} ${y + 38}C${x - 8} ${y + 90} 70 170 60 226`}
        stroke="#B9A3C9"
        strokeWidth="1.6"
        fill="none"
      />
      <ellipse cx={x} cy={y} rx="24" ry="30" style={{ fill }} />
      <path d={`M${x - 4} ${y + 30}h8l-4 6z`} style={{ fill }} />
      <ellipse
        cx={x - 9}
        cy={y - 10}
        rx="5"
        ry="9"
        fill="#fff"
        opacity=".45"
        transform={`rotate(-20 ${x - 9} ${y - 10})`}
      />
    </g>
  );
  return (
    <g>
      {balloon(34, 72, LILAC, '-1s')}
      {balloon(86, 60, MINT, '-3s')}
      {balloon(58, 34, ACCENT, '0s')}
    </g>
  );
}

function Heart({ fill }: { fill: string }) {
  // viewBox 0 0 40 36
  return <path d="M20 34C8 25 2 18 2 11a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 7-6 14-18 23z" style={{ fill }} />;
}

/** Sparkles and little stars over the sky (viewBox 0 0 1000 1000, sliced), quieter behind the names. */
function Sparkles() {
  const rand = rng(23);
  const items: { d: string; fill: string; delay: string }[] = [];
  for (let i = 0; i < 46; i++) {
    const x = r1(rand() * 1000);
    const y = r1(rand() * 1000);
    if (x > 250 && x < 750 && y > 300 && y < 700) continue;
    const s = r1(4 + rand() * 9);
    items.push({
      d: i % 3 ? sparkle(x, y, s) : star(x, y, s),
      fill: [GOLD, '#fff', PINK, LILAC][i % 4]!,
      delay: `${r1(-rand() * 2.8)}s`,
    });
  }
  return (
    <g>
      {items.map((it, i) => (
        <path
          key={i}
          d={it.d}
          fill={it.fill}
          data-anim={i % 4 ? 'twinkle' : 'pop'}
          style={{ animationDelay: it.delay, transformBox: 'fill-box' }}
        />
      ))}
    </g>
  );
}

export default function UnicornDream({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const bank = card ? '24cqh' : '15cqh';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('coat')} cx=".4" cy=".3" r=".85">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".75" stopColor="#FBF6FF" />
            <stop offset="1" stopColor="#E9DEFA" />
          </radialGradient>
          <linearGradient id={ref('horn')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#FFF1B8" />
            <stop offset="1" stopColor={GOLD} />
          </linearGradient>
          <filter id={ref('soft')} x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#8A5FB0" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'radial-gradient(60cqmin 40cqmin at 50% 20%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%),' +
            'radial-gradient(80cqw 40cqh at 50% 100%, rgba(255,214,235,.7), rgba(255,214,235,0) 70%)',
        }}
      />
      <Piece vb={[0, 0, 1000, 1000]} fit="xMidYMid slice" style={{ inset: 0, width: '100%', height: '100%' }}>
        <Sparkles />
      </Piece>
      {/* the rainbow arching over the names */}
      <Piece
        vb={[0, 0, 400, 214]}
        style={{
          left: '50%',
          top: card ? cm(3) : cm(4),
          width: card ? cm(56) : poster ? cm(70) : `min(${cm(94)}, 52cqh)`,
          translate: '-50% 0',
        }}
      >
        <g filter={url('soft')}>
          <Rainbow />
        </g>
      </Piece>
      {/* small clouds drifting by */}
      <Piece
        vb={[0, 0, 200, 60]}
        anim="drift"
        style={{
          left: cm(-4),
          top: card ? cm(26) : poster ? cm(40) : cm(56),
          width: cm(card ? 18 : 24),
          opacity: 0.9,
        }}
      >
        <Cloud x={70} y={34} s={0.6} />
      </Piece>
      <Piece
        vb={[0, 0, 200, 60]}
        anim="drift"
        style={{
          right: cm(-6),
          top: card ? cm(30) : poster ? cm(46) : cm(66),
          width: cm(card ? 16 : 20),
          opacity: 0.85,
          animationDirection: 'alternate-reverse',
        }}
      >
        <Cloud x={120} y={34} s={0.5} />
      </Piece>
      {/* the cloud bank along the bottom */}
      <Piece
        vb={[0, 0, 1200, 200]}
        fit="xMidYMax slice"
        style={{ left: 0, bottom: 0, width: '100%', height: card ? '34cqh' : '22cqh' }}
      >
        {[
          [0, 120, 1.4],
          [170, 110, 1.3],
          [380, 118, 1.5],
          [590, 112, 1.3],
          [800, 116, 1.5],
          [1010, 108, 1.4],
          [1200, 118, 1.4],
        ].map(([x, y, s], i) => (
          <Cloud key={`b${i}`} x={x!} y={y!} s={s!} shade="#EDE2FA" />
        ))}
        <path d="M0 126h1200v74H0z" fill="#FFFFFF" />
        {[
          [60, 160, 1.5],
          [270, 172, 1.6],
          [480, 164, 1.4],
          [690, 176, 1.6],
          [900, 162, 1.5],
          [1120, 172, 1.6],
        ].map(([x, y, s], i) => (
          <Cloud key={`f${i}`} x={x!} y={y!} s={s!} shade="#FFFFFF" />
        ))}
        <path d="M0 184h1200v16H0z" fill="#fff" />
      </Piece>
      {/* balloons, hearts and the unicorn */}
      <Piece
        vb={[0, 0, 120, 230]}
        anim="sway"
        style={{
          left: cm(card ? 4 : 5),
          bottom: `calc(${bank} - ${cm(2)})`,
          width: card ? cm(13) : `min(${cm(24)}, 15cqh)`,
        }}
      >
        <Balloons />
      </Piece>
      <Piece
        vb={[0, 0, 40, 36]}
        anim="rise"
        style={{
          right: card ? cm(40) : cm(48),
          bottom: `calc(${bank} + ${cm(card ? 14 : 22)})`,
          width: cm(card ? 4 : 6),
          rotate: '-12deg',
        }}
      >
        <Heart fill={ACCENT} />
      </Piece>
      <Piece
        vb={[0, 0, 40, 36]}
        anim="rise"
        style={{
          right: card ? cm(34) : cm(40),
          bottom: `calc(${bank} + ${cm(card ? 20 : 30)})`,
          width: cm(card ? 3 : 4),
          rotate: '10deg',
          animationDelay: '-2.5s',
        }}
      >
        <Heart fill={PINK} />
      </Piece>
      <Piece
        vb={[0, 0, 260, 230]}
        anim="sway"
        style={{
          right: cm(card ? 3 : 4),
          bottom: `calc(${bank} - ${cm(card ? 4 : 6)})`,
          width: card ? cm(30) : `min(${cm(52)}, 34cqh)`,
        }}
      >
        <g filter={url('soft')}>
          <Unicorn u={url} />
        </g>
      </Piece>
    </>
  );
}
