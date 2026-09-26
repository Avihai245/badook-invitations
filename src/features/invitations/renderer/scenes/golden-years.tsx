import type { CSSProperties } from 'react';
import { Frame, Layer, Piece, cm, cmh, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Golden Years — timeless elegance on champagne satin: golden bokeh drifting, a double foil frame with
 * scrolled corners, a laurel wreath crowning two champagne flutes that clink under a sparkle, bubbles
 * rising, a laurel garland tied with a ribbon at the foot and gold sparkles twinkling. The gold stays
 * gold; the ribbons follow the accent (burgundy and navy presets). Calm motion, a quiet centre.
 */
const RIBBON = 'var(--inv-accent, #8A6417)';
const RIBBON_DEEP = 'color-mix(in srgb, var(--inv-accent, #8A6417) 70%, #1A0E04)';
const GOLD_LINE = '#C0953F';

type Url = (name: string) => string;

/** An almond leaf from (x, y) toward `deg`. */
function leaf(x: number, y: number, deg: number, len: number, wid: number): string {
  const [tx, ty] = polar(x, y, len, deg);
  const off = (Math.atan2(wid, len * 0.5) * 180) / Math.PI;
  const mid = Math.hypot(wid, len * 0.5);
  const [ax, ay] = polar(x, y, mid, deg - off);
  const [bx, by] = polar(x, y, mid, deg + off);
  return `M${r1(x)} ${r1(y)}Q${ax} ${ay} ${tx} ${ty}Q${bx} ${by} ${r1(x)} ${r1(y)}Z`;
}

/**
 * A laurel branch along a circular arc (centre cx, cy, radius r) from angle a0 to a1, leaves in pairs
 * pointing the way it grows, smaller toward its tip.
 */
function Branch({
  cx,
  cy,
  r,
  a0,
  a1,
  n,
  size,
  u,
}: {
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
  n: number;
  size: number;
  u: Url;
}) {
  const dir = a1 > a0 ? 1 : -1;
  const [sx, sy] = polar(cx, cy, r, a0);
  const [ex, ey] = polar(cx, cy, r, a1);
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.6)) / (n + 0.4);
    const [x, y] = polar(cx, cy, r, a);
    const grow = a + dir * 90;
    const len = size * (1 - (i / n) * 0.45);
    leaves.push(<path key={`o${i}`} d={leaf(x, y, grow - dir * 38, len, len * 0.3)} />);
    leaves.push(<path key={`i${i}`} d={leaf(x, y, grow + dir * 30, len * 0.9, len * 0.28)} />);
  }
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return (
    <g fill={u('foil')}>
      <path
        d={`M${sx} ${sy}A${r} ${r} 0 ${large} ${dir > 0 ? 1 : 0} ${ex} ${ey}`}
        fill="none"
        stroke={GOLD_LINE}
        strokeWidth={r1(size * 0.1)}
        strokeLinecap="round"
      />
      {leaves}
      <circle cx={ex} cy={ey} r={r1(size * 0.16)} />
    </g>
  );
}

/** A ribbon bow at (x, y) in the accent. */
function Bow({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g>
      <path
        d={`M${x} ${y}l${-s * 0.6} ${s * 1.5}l${s * 0.3} ${-s * 0.1}l${s * 0.18} ${s * 0.3}Z`}
        style={{ fill: RIBBON_DEEP }}
      />
      <path
        d={`M${x} ${y}l${s * 0.6} ${s * 1.5}l${-s * 0.3} ${-s * 0.1}l${-s * 0.18} ${s * 0.3}Z`}
        style={{ fill: RIBBON_DEEP }}
      />
      <path
        d={`M${x} ${y}C${x - s * 0.9} ${y - s * 0.9} ${x - s * 1.5} ${y - s * 0.1} ${x - s * 1.1} ${y + s * 0.45}C${x - s * 0.8} ${y + s * 0.8} ${x - s * 0.3} ${y + s * 0.3} ${x} ${y}Z`}
        style={{ fill: RIBBON }}
      />
      <path
        d={`M${x} ${y}C${x + s * 0.9} ${y - s * 0.9} ${x + s * 1.5} ${y - s * 0.1} ${x + s * 1.1} ${y + s * 0.45}C${x + s * 0.8} ${y + s * 0.8} ${x + s * 0.3} ${y + s * 0.3} ${x} ${y}Z`}
        style={{ fill: RIBBON }}
      />
      <ellipse cx={x} cy={y} rx={r1(s * 0.24)} ry={r1(s * 0.3)} style={{ fill: RIBBON_DEEP }} />
    </g>
  );
}

/** A champagne flute standing at (x, y), tilted by `deg` about its foot. */
function Flute({ x, y, deg, u }: { x: number; y: number; deg: number; u: Url }) {
  return (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <ellipse
        cx={x}
        cy={y}
        rx="15"
        ry="3.4"
        fill="#FFFFFF"
        opacity=".75"
        stroke={GOLD_LINE}
        strokeWidth=".8"
      />
      <path d={`M${x - 1.4} ${y}V${y - 44}h2.8V${y}Z`} fill="#FFFFFF" opacity=".85" />
      <path
        d={`M${x - 13} ${y - 130}C${x - 13} ${y - 84} ${x - 8} ${y - 50} ${x} ${y - 44}C${x + 8} ${y - 50} ${x + 13} ${y - 84} ${x + 13} ${y - 130}Z`}
        fill="#FFFFFF"
        opacity=".35"
        stroke="#FFFFFF"
        strokeWidth="1.4"
      />
      <path
        d={`M${x - 12.4} ${y - 108}C${x - 12} ${y - 80} ${x - 7.6} ${y - 52} ${x} ${y - 46}C${x + 7.6} ${y - 52} ${x + 12} ${y - 80} ${x + 12.4} ${y - 108}Z`}
        fill={u('champagne')}
      />
      <ellipse cx={x} cy={y - 108} rx="12.4" ry="2.2" fill="#FFF3C4" />
      {[
        [-4, 62, 1.3],
        [3, 74, 1],
        [-1, 86, 1.2],
        [5, 94, 0.9],
        [-5, 98, 0.8],
      ].map(([dx, dy, r], i) => (
        <circle key={i} cx={x + dx!} cy={y - dy!} r={r} fill="#FFFBEA" opacity=".9" />
      ))}
      <path
        d={`M${x - 9} ${y - 122}C${x - 10} ${y - 96} ${x - 7} ${y - 72} ${x - 3} ${y - 56}`}
        stroke="#fff"
        strokeWidth="1.6"
        fill="none"
        opacity=".7"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A four-pointed sparkle (viewBox 0 0 20 20). */
function Sparkle({ fill }: { fill: string }) {
  return <path d="M10 0Q11 9 20 10Q11 11 10 20Q9 11 0 10Q9 9 10 0Z" fill={fill} />;
}

/** One scrolled corner of the frame (viewBox 0 0 100 100), drawn for the top-left. */
function Corner({ u }: { u: Url }) {
  return (
    <g>
      <path
        d="M6 70C6 34 34 6 70 6M16 58C16 34 34 16 58 16"
        fill="none"
        stroke={u('foil')}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M58 16C66 16 70 22 67 28S56 32 55 25 62 20 64 24"
        fill="none"
        stroke={u('foil')}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 58C16 66 22 70 28 67S32 56 25 55 20 62 24 64"
        fill="none"
        stroke={u('foil')}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g fill={u('foil')}>
        <path d={leaf(30, 30, -45, 20, 6)} />
        <path d={leaf(30, 30, -100, 14, 4.4)} />
        <path d={leaf(30, 30, 10, 14, 4.4)} />
        <circle cx="30" cy="30" r="4" />
      </g>
    </g>
  );
}

export default function GoldenYears({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const rand = rng(53);
  const bokeh = Array.from(
    { length: 16 },
    () => [r1(rand() * 100), r1(rand() * 180), r1(3 + rand() * 9), r1(0.1 + rand() * 0.18)] as const,
  );
  // the crest at the top: a laurel wreath around two flutes (the text stays below it)
  const crestW = card ? cm(30) : poster ? cmh(38) : cmh(46);
  const crestTop = card ? cm(5) : poster ? cm(6) : cm(8);
  const sparkles: [string, string, number, string][] = [
    // [left, top, size (cqmin), delay]
    ['14%', '15%', 4, '0s'],
    ['86%', '13%', 3.4, '-1.1s'],
    ['24%', '31%', 2.4, '-2s'],
    ['78%', '29%', 2.8, '-0.6s'],
    ['9%', '52%', 2.6, '-1.6s'],
    ['92%', '58%', 3.2, '-2.4s'],
    ['18%', '80%', 3, '-0.3s'],
    ['83%', '84%', 3.6, '-1.9s'],
  ];
  const bubble = (i: number): CSSProperties => ({
    left: `calc(50% + ${cm([-3.2, 2.6, -1, 3.8, 0.4][i]!)})`,
    top: `calc(${crestTop} + ${cm([4, 1, -2, 3, -4][i]!)})`,
    width: cm([1.2, 0.9, 1, 0.8, 1.1][i]!),
    animationDelay: `${-i * 1.8}s`,
  });
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('foil')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#FFF0BE" />
            <stop offset=".3" stopColor="#E3BC62" />
            <stop offset=".55" stopColor="#B9892E" />
            <stop offset=".78" stopColor="#F2D78C" />
            <stop offset="1" stopColor="#A57722" />
          </linearGradient>
          <linearGradient id={ref('champagne')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FBE7A8" />
            <stop offset="1" stopColor="#E0B85A" />
          </linearGradient>
          <filter id={ref('blur')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <filter id={ref('lift')} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#6B4A12" floodOpacity=".25" />
          </filter>
        </defs>
      </svg>
      {/* champagne satin, lit from above */}
      <Layer
        style={{
          background:
            'radial-gradient(120cqw 80cqh at 50% 36%, #FFFBF2 0%, #F9F0DF 46%, #EEDEC1 100%),' +
            'linear-gradient(180deg, #F9F0DF, #EEDEC1)',
        }}
      />
      <Layer
        anim="drift"
        style={{
          background:
            'linear-gradient(115deg, transparent 32%, rgba(255,255,255,.42) 47%, transparent 60%),' +
            'linear-gradient(115deg, transparent 58%, rgba(255,255,255,.22) 66%, transparent 74%)',
        }}
      />
      {/* golden bokeh */}
      {[0, 1].map((k) => (
        <Piece
          key={k}
          vb={[0, 0, 100, 180]}
          anim="float"
          fit="xMidYMid slice"
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            aspectRatio: 'auto',
            overflow: 'hidden',
            animationDelay: k ? '-3s' : '0s',
          }}
        >
          <g filter={url('blur')}>
            {bokeh
              .filter((_, i) => i % 2 === k)
              .map(([x, y, r, o], i) => (
                <circle key={i} cx={x} cy={y} r={r} fill="#E2B85E" opacity={o} />
              ))}
          </g>
        </Piece>
      ))}
      {/* the double foil frame and its scrolled corners */}
      <Frame inset={card ? '3cqmin' : '3.2cqmin'}>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="6"
          fill="none"
          stroke={url('foil')}
          strokeWidth="1.8"
        />
      </Frame>
      <Frame inset={card ? '4.4cqmin' : '4.8cqmin'}>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="4"
          fill="none"
          stroke={url('foil')}
          strokeWidth=".8"
          opacity=".8"
        />
      </Frame>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <Piece
          key={c}
          vb={[0, 0, 100, 100]}
          style={{
            width: cm(card ? 11 : 15),
            ...(c[0] === 't' ? { top: cm(1.6) } : { bottom: cm(1.6) }),
            ...(c[1] === 'l' ? { left: cm(1.6) } : { right: cm(1.6) }),
            scale: `${c[1] === 'r' ? -1 : 1} ${c[0] === 'b' ? -1 : 1}`,
          }}
        >
          <Corner u={url} />
        </Piece>
      ))}
      {/* tall laurel stems beside the text on a wide hero (off the edges on a phone) */}
      {(['right', 'left'] as const).map((edge, i) => (
        <Piece
          key={edge}
          vb={[0, 0, 120, 400]}
          anim="sway"
          style={{
            [edge]: `calc(50% + ${cm(card ? 56 : 62)})`,
            bottom: '10%',
            height: '72%',
            aspectRatio: '120 / 400',
            animationDelay: i ? '-2.6s' : '0s',
          }}
        >
          <g transform={i ? 'translate(120 0) scale(-1 1)' : undefined}>
            <Branch cx={-260} cy={230} r={330} a0={24} a1={-34} n={9} size={30} u={url} />
          </g>
        </Piece>
      ))}
      {/* the crest: a laurel wreath around two clinking flutes */}
      <Piece vb={[0, 0, 240, 220]} style={{ left: '50%', top: crestTop, width: crestW, translate: '-50% 0' }}>
        <g filter={url('lift')}>
          <Branch cx={120} cy={112} r={96} a0={100} a1={236} n={8} size={24} u={url} />
          <Branch cx={120} cy={112} r={96} a0={80} a1={-56} n={8} size={24} u={url} />
          <Flute x={100} y={196} deg={13} u={url} />
          <Flute x={140} y={196} deg={-13} u={url} />
          <Bow x={120} y={206} s={16} />
        </g>
        <g data-anim="pop" style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
          <path d="M120 38Q122 58 142 60Q122 62 120 82Q118 62 98 60Q118 58 120 38Z" fill="#FFF7DC" />
          <circle cx="138" cy="44" r="2.4" fill="#FFF7DC" />
          <circle cx="103" cy="46" r="1.8" fill="#FFF7DC" />
        </g>
      </Piece>
      {card
        ? null
        : [0, 1, 2, 3, 4].map((i) => (
            <Piece key={i} vb={[0, 0, 10, 10]} anim="rise" style={bubble(i)}>
              <circle cx="5" cy="5" r="4.2" fill="none" stroke="#D9AE52" strokeWidth="1.2" />
            </Piece>
          ))}
      {/* the garland at the foot */}
      <Piece
        vb={[0, 0, 320, 90]}
        style={{
          left: '50%',
          bottom: card ? cm(5) : cm(8),
          width: card ? cm(46) : cmh(64),
          translate: '-50% 0',
        }}
      >
        <g filter={url('lift')}>
          <Branch cx={160} cy={-260} r={320} a0={90} a1={123} n={8} size={22} u={url} />
          <Branch cx={160} cy={-260} r={320} a0={90} a1={57} n={8} size={22} u={url} />
          <Bow x={160} y={58} s={15} />
        </g>
      </Piece>
      {/* sparkles twinkling around */}
      {sparkles.map(([left, top, s, delay], i) => (
        <Piece
          key={i}
          vb={[0, 0, 20, 20]}
          anim="twinkle"
          style={{ left, top, width: cm(card ? s * 0.7 : s), translate: '-50% -50%', animationDelay: delay }}
        >
          <Sparkle fill={i % 2 ? '#E7C36C' : '#D4A74A'} />
        </Piece>
      ))}
    </>
  );
}
