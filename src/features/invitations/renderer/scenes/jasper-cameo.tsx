import { cm, Frame, Layer, Piece, polar, r1, useIds, type SceneProps } from './kit';

/**
 * Jasper Cameo — blue jasperware with white relief: a border of pearls, acanthus scrolls in the
 * corners, a ribbon swag with a bow at the crown holding an oval cameo (a classical profile in a gilt
 * frame), a laurel garland below. The ground follows the page colour (the sage / lilac presets turn the
 * whole piece), the gilt follows the accent.
 */
const WHITE = '#FFFFFF';
const RELIEF_SHADE = 'rgba(35,50,74,.28)';
const GILT = 'var(--inv-accent, #B08F52)';
const GROUND = 'var(--inv-bg, #AFC6DE)';
const GROUND_DEEP = 'color-mix(in srgb, var(--inv-bg, #AFC6DE) 78%, #23324A)';

type Url = (name: string) => string;

/** An acanthus scroll for the top-left corner (viewBox 0 0 160 160). */
function Acanthus() {
  const leaf = (x: number, y: number, deg: number, s: number) => {
    const [tx, ty] = polar(x, y, s, deg);
    const [ax, ay] = polar(x, y, s * 0.55, deg - 28);
    const [bx, by] = polar(x, y, s * 0.55, deg + 28);
    const [n1x, n1y] = polar(x, y, s * 0.72, deg - 12);
    const [n2x, n2y] = polar(x, y, s * 0.72, deg + 12);
    return `M${x} ${y}Q${ax} ${ay} ${n1x} ${n1y}L${tx} ${ty}L${n2x} ${n2y}Q${bx} ${by} ${x} ${y}Z`;
  };
  return (
    <g fill={WHITE}>
      <path d="M8 150C8 70 50 20 132 10c-38 16-66 40-80 76-9 24-10 44-4 64z" />
      <path d="M48 150c-6-34 4-60 30-74 18-10 36-8 44 4 8 13 0 28-15 30-11 1-17-6-15-13 2-6 9-7 12-4" fill="none" stroke={WHITE} strokeWidth="6" strokeLinecap="round" />
      <path d="M132 10c16 2 24 12 20 22-3 8-12 10-18 6" fill="none" stroke={WHITE} strokeWidth="6" strokeLinecap="round" />
      {[
        [30, 96, -30, 34],
        [42, 64, -55, 30],
        [66, 40, -70, 28],
        [96, 24, -85, 24],
        [20, 124, -12, 30],
      ].map(([x, y, d, s], i) => (
        <path key={i} d={leaf(x!, y!, d!, s!)} />
      ))}
      <circle cx="146" cy="30" r="4.5" />
      <circle cx="104" cy="104" r="4" />
    </g>
  );
}

/** A laurel branch (viewBox 0 0 200 80), growing to the right. */
function Laurel() {
  const leaves: string[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 12 + t * 176;
    const y = 58 - Math.sin(t * Math.PI * 0.9) * 26;
    const up = i % 2 === 0;
    const [tx, ty] = polar(x, y, 20 - t * 6, up ? -60 : 40);
    const [cx1, cy1] = polar(x, y, 12, up ? -95 : 70);
    const [cx2, cy2] = polar(x, y, 12, up ? -25 : 10);
    leaves.push(`M${r1(x)} ${r1(y)}Q${cx1} ${cy1} ${tx} ${ty}Q${cx2} ${cy2} ${r1(x)} ${r1(y)}Z`);
  }
  return (
    <g>
      <path d="M8 60C60 60 120 50 190 22" fill="none" stroke={WHITE} strokeWidth="3" strokeLinecap="round" />
      {leaves.map((d, i) => (
        <path key={i} d={d} fill={WHITE} />
      ))}
      <circle cx="120" cy="54" r="4" fill={WHITE} />
      <circle cx="152" cy="44" r="3.4" fill={WHITE} />
    </g>
  );
}

/** The cameo: gilt oval frame with pearls, a white classical profile on a deeper ground (viewBox 0 0 120 150). */
function Cameo({ u }: { u: Url }) {
  const pearls = Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * Math.PI * 2;
    return [r1(60 + Math.cos(a) * 55), r1(75 + Math.sin(a) * 69)] as const;
  });
  return (
    <g>
      <ellipse cx="60" cy="75" rx="58" ry="72" fill={u('gilt')} />
      <ellipse cx="60" cy="75" rx="50" ry="63" style={{ fill: GROUND_DEEP }} />
      <ellipse cx="60" cy="75" rx="50" ry="63" fill={u('dome')} />
      {pearls.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="#FFFDF8" />
      ))}
      {/* a classical profile, facing left, with a chignon */}
      <g fill={WHITE} filter={u('relief')}>
        <path d="M68 38c-14-2-26 6-28 20-1 6 0 10-2 14l-6 9c-1 2 0 3 2 3l4 1-1 5c0 2 2 3 3 3l2 1-1 3c1 4 6 5 11 4 3-1 5 1 6 4l2 8c-4 6-6 13-6 20h34c-2-12-8-22-12-32-2-6-1-12 2-17 5-9 5-21-2-30-3-5-6-8-10-10z" />
        <circle cx="84" cy="52" r="10" />
        <path d="M58 44c6-6 16-6 22 0-6-2-14-1-22 0z" opacity=".6" />
      </g>
    </g>
  );
}

/** Ribbon swag with a bow at the middle (viewBox 0 0 400 110). */
function Swag() {
  return (
    <g fill={WHITE}>
      <path d="M0 12C60 70 140 86 200 44 260 86 340 70 400 12v10C340 84 260 100 200 58 140 100 60 84 0 22z" />
      <path d="M200 44c-26-26-58-30-62-12-4 16 30 22 62 18z" />
      <path d="M200 44c26-26 58-30 62-12 4 16-30 22-62 18z" />
      <path d="M194 50l-22 50 12-4 6 12 14-54zM206 50l22 50-12-4-6 12-14-54z" />
      <ellipse cx="200" cy="47" rx="9" ry="8" />
    </g>
  );
}


export default function JasperCameo({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const corner = cm(card ? 22 : 30);
  return (
    <>
      <Layer
        style={{
          background: `radial-gradient(75cqw 60cqh at 50% 45%, ${GROUND} 55%, ${GROUND_DEEP} 130%)`,
        }}
      />
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('gilt')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--inv-accent, #B08F52) 55%, #FFF6DC)' }} />
            <stop offset=".5" style={{ stopColor: GILT }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--inv-accent, #B08F52) 70%, #3A2A10)' }} />
          </linearGradient>
          <radialGradient id={ref('dome')} cx=".4" cy=".3" r=".8">
            <stop offset="0" stopColor="#fff" stopOpacity=".22" />
            <stop offset="1" stopColor="#000" stopOpacity=".12" />
          </radialGradient>
          <filter id={ref('relief')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1.2" dy="1.8" stdDeviation="1.2" floodColor="#23324A" floodOpacity=".35" />
          </filter>
          <filter id={ref('lift')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.6" floodColor="#23324A" floodOpacity=".3" />
          </filter>
        </defs>
      </svg>
      {/* pearl border + hairline */}
      <Frame inset={card ? '4cqmin' : '3.5cqmin'}>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="14"
          fill="none"
          stroke={WHITE}
          filter={url('lift')}
          style={{ strokeWidth: '1.15cqmin', strokeDasharray: '0 2.7cqmin', strokeLinecap: 'round' }}
        />
      </Frame>
      <Frame inset={card ? '5.6cqmin' : '5.4cqmin'}>
        <rect x="0" y="0" width="100%" height="100%" rx="10" fill="none" stroke={WHITE} strokeWidth="1" opacity=".75" />
      </Frame>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <Piece
          key={c}
          vb={[0, 0, 160, 160]}
          style={{
            width: corner,
            ...(c[0] === 't' ? { top: cm(5) } : { bottom: cm(5) }),
            ...(c[1] === 'l' ? { left: cm(5) } : { right: cm(5) }),
            scale: `${c[1] === 'r' ? -1 : 1} ${c[0] === 'b' ? -1 : 1}`,
          }}
        >
          <g filter={url('relief')}>
            <Acanthus />
          </g>
        </Piece>
      ))}
      <Piece vb={[0, 0, 400, 110]} style={{ left: '50%', top: cm(card ? 3 : 4), width: cm(card ? 60 : 78), translate: '-50% 0' }}>
        <g filter={url('relief')}>
          <Swag />
        </g>
      </Piece>
      <Piece vb={[0, 0, 120, 150]} style={{ left: '50%', top: cm(card ? 9 : 13), width: cm(card ? 11 : 19), translate: '-50% 0' }}>
        <Cameo u={url} />
      </Piece>
      <Piece vb={[0, 0, 420, 90]} style={{ left: '50%', bottom: cm(card ? 5 : 8), width: cm(card ? 44 : 62), translate: '-50% 0' }}>
        <g filter={url('relief')}>
          <g transform="translate(212 6)">
            <Laurel />
          </g>
          <g transform="translate(208 6) scale(-1 1)">
            <Laurel />
          </g>
          <path d="M210 62c-10-10-24-10-26-2s14 10 26 2zM210 62c10-10 24-10 26-2s-14 10-26 2z" fill={WHITE} />
          <circle cx="210" cy="62" r="5" fill={WHITE} />
        </g>
      </Piece>
    </>
  );
}
