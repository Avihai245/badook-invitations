import { Frame, Layer, Piece, cm, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Bukhara Silk — bold ikat bands with feathered (dye-bled) lozenges at the top and bottom, suzani
 * rosettes stitched over their edges, tulip sprigs at the sides, a chain-stitch frame and tassels
 * swinging from the top band. The magenta follows the accent.
 */
const MAGENTA = 'var(--inv-accent, #C2185B)';
const MAGENTA_DEEP = 'color-mix(in srgb, var(--inv-accent, #C2185B) 70%, #2A0616)';
const SAFFRON = '#F2A900';
const GREEN = '#7CB342';
const INDIGO = '#3949AB';
const INDIGO_DEEP = '#22254F';
const CREAM = '#FFF8EE';

type Url = (name: string) => string;

/** A feathered ikat lozenge: horizontal bars following a diamond, jittered at the edges. */
function lozenge(cx: number, cy: number, w: number, h: number, seed: number): string {
  const rand = rng(seed);
  const bar = 5;
  let d = '';
  for (let y = cy - h / 2; y < cy + h / 2; y += bar) {
    const t = 1 - Math.abs((y + bar / 2 - cy) / (h / 2));
    const half = (w / 2) * t;
    if (half < 1) continue;
    const jl = (rand() - 0.5) * 7;
    const jr = (rand() - 0.5) * 7;
    d += `M${r1(cx - half + jl)} ${r1(y)}H${r1(cx + half + jr)}V${r1(y + bar + 0.6)}H${r1(cx - half + jl)}Z`;
  }
  return d;
}

/** An ikat band (viewBox 0 0 600 120): lozenges on indigo, arrow marks between. */
function Ikat({ seed }: { seed: number }) {
  const motifs = [0, 1, 2, 3, 4, 5];
  return (
    <g>
      <rect width="600" height="120" fill={INDIGO_DEEP} />
      {motifs.map((i) => {
        const cx = 50 + i * 100;
        const alt = i % 2 === 1;
        return (
          <g key={i}>
            <path d={lozenge(cx, 60, 92, 112, seed + i)} style={{ fill: alt ? SAFFRON : MAGENTA }} />
            <path d={lozenge(cx, 60, 58, 72, seed + i + 40)} fill={alt ? INDIGO : CREAM} />
            <path d={lozenge(cx, 60, 26, 34, seed + i + 80)} style={{ fill: alt ? MAGENTA : GREEN }} />
            <path d={`M${cx + 50} 8l7 10-7 10-7-10zM${cx + 50} 92l7 10-7 10-7-10z`} fill={GREEN} opacity=".9" />
          </g>
        );
      })}
    </g>
  );
}

/** A suzani rosette (viewBox centred on 0 0, radius ~100). */
function Rosette({ u }: { u: Url }) {
  const ring = (n: number, r0: number, r1v: number, spread: number, fill: string, turn = 0) =>
    Array.from({ length: n }, (_, i) => {
      const deg = turn + (i * 360) / n;
      const [ax, ay] = polar(0, 0, r0, deg - spread);
      const [bx, by] = polar(0, 0, r0, deg + spread);
      const [tx, ty] = polar(0, 0, r1v, deg);
      const [c1x, c1y] = polar(0, 0, r1v * 0.98, deg - spread * 1.6);
      const [c2x, c2y] = polar(0, 0, r1v * 0.98, deg + spread * 1.6);
      return <path key={i} d={`M${ax} ${ay}Q${c1x} ${c1y} ${tx} ${ty}Q${c2x} ${c2y} ${bx} ${by}Z`} style={{ fill }} />;
    });
  return (
    <g filter={u('stitch')}>
      <circle r="98" style={{ fill: MAGENTA_DEEP }} />
      {ring(12, 70, 100, 12, MAGENTA)}
      <circle r="72" fill={CREAM} />
      <circle r="72" fill="none" style={{ stroke: MAGENTA }} strokeWidth="3" strokeDasharray="6 5" />
      {ring(8, 30, 66, 18, SAFFRON, 22.5)}
      {ring(8, 30, 56, 12, INDIGO)}
      <circle r="30" style={{ fill: MAGENTA }} />
      <circle r="22" fill={CREAM} />
      <circle r="14" fill={GREEN} />
      <circle r="6" fill={SAFFRON} />
      {Array.from({ length: 16 }, (_, i) => {
        const [x, y] = polar(0, 0, 86, i * 22.5 + 11);
        return <circle key={i} cx={x} cy={y} r="3" fill={SAFFRON} />;
      })}
    </g>
  );
}

/** A tulip sprig (viewBox 0 0 60 140), growing up. */
function Tulips() {
  const tulip = (x: number, y: number, s: number) => (
    <g>
      <path d={`M${x - 9 * s} ${y - 6 * s}Q${x - 10 * s} ${y + 8 * s} ${x} ${y + 9 * s}Q${x + 10 * s} ${y + 8 * s} ${x + 9 * s} ${y - 6 * s}L${x + 4 * s} ${y - 1 * s}L${x} ${y - 10 * s}L${x - 4 * s} ${y - 1 * s}Z`} style={{ fill: MAGENTA }} />
      <path d={`M${x - 3 * s} ${y}Q${x} ${y + 7 * s} ${x + 3 * s} ${y}`} stroke={SAFFRON} strokeWidth={1.6 * s} fill="none" />
    </g>
  );
  return (
    <g>
      <path d="M30 140C28 110 34 80 30 40M30 100C20 90 16 76 18 62M30 86c10-8 14-20 12-32" stroke={GREEN} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M30 120c-10-4-16-12-16-22 10 2 16 10 16 22zM30 112c10-4 16-12 16-22-10 2-16 10-16 22z" fill={GREEN} />
      {tulip(30, 34, 1.3)}
      {tulip(18, 58, 0.95)}
      {tulip(42, 50, 0.95)}
    </g>
  );
}

/** A tassel (viewBox 0 0 30 90). */
function Tassel({ color }: { color: string }) {
  return (
    <g>
      <path d="M15 0V26" stroke={SAFFRON} strokeWidth="1.6" />
      <circle cx="15" cy="28" r="5" style={{ fill: color }} />
      <path d="M9 34h12l3 8H6z" fill={SAFFRON} />
      <path d="M7 42h16c2 16 2 30 0 44H7c-2-14-2-28 0-44z" style={{ fill: color }} />
      {[9, 12, 15, 18, 21].map((x) => (
        <path key={x} d={`M${x} 46V84`} stroke="#000" strokeWidth=".6" opacity=".18" />
      ))}
    </g>
  );
}

export default function Bukhara({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const band = card ? '13cqh' : '10cqh';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={ref('stitch')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#22254F" floodOpacity=".35" />
          </filter>
        </defs>
      </svg>
      <Layer style={{ background: 'radial-gradient(80cqw 60cqh at 50% 50%, rgba(255,250,240,.7), transparent 70%)' }} />
      <Piece vb={[0, 0, 600, 120]} fit="xMidYMid slice" style={{ left: 0, top: 0, width: '100%', height: band }}>
        <Ikat seed={3} />
      </Piece>
      <Piece vb={[0, 0, 600, 120]} fit="xMidYMid slice" style={{ left: 0, bottom: 0, width: '100%', height: band }}>
        <Ikat seed={9} />
      </Piece>
      <Frame inset={card ? '4cqmin' : '4.5cqmin'}>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="10"
          fill="none"
          style={{ stroke: MAGENTA, strokeWidth: '0.55cqmin', strokeDasharray: '1.6cqmin 1cqmin', strokeLinecap: 'round' }}
        />
      </Frame>
      <Frame inset={card ? '5.8cqmin' : '6.3cqmin'}>
        <rect x="0" y="0" width="100%" height="100%" rx="7" fill="none" stroke={INDIGO} strokeWidth="1" opacity=".5" />
      </Frame>
      {[12, 30, 50, 70, 88].map((x, i) => (
        <Piece
          key={x}
          vb={[0, 0, 30, 90]}
          anim="sway"
          style={{ left: `${x}%`, top: `calc(${band} - 0.5cqmin)`, width: cm(card ? 3.5 : 5.5), translate: '-50% 0' }}
        >
          <Tassel color={i % 2 ? SAFFRON : MAGENTA} />
        </Piece>
      ))}
      <Piece vb={[-100, -100, 200, 200]} style={{ left: cm(-14), top: `calc(${band} - ${cm(16)})`, width: cm(card ? 26 : 40) }}>
        <Rosette u={url} />
      </Piece>
      <Piece vb={[-100, -100, 200, 200]} style={{ right: cm(-14), bottom: `calc(${band} - ${cm(18)})`, width: cm(card ? 28 : 44) }}>
        <Rosette u={url} />
      </Piece>
      <Piece vb={[-100, -100, 200, 200]} style={{ right: cm(4), top: `calc(${band} + ${cm(5)})`, width: cm(card ? 9 : 13) }}>
        <Rosette u={url} />
      </Piece>
      <Piece vb={[-100, -100, 200, 200]} style={{ left: cm(5), bottom: `calc(${band} + ${cm(6)})`, width: cm(card ? 9 : 13) }}>
        <Rosette u={url} />
      </Piece>
      <Piece vb={[0, 0, 60, 140]} style={{ left: cm(1.5), top: '44%', width: cm(card ? 7 : 11) }}>
        <Tulips />
      </Piece>
      <Piece vb={[0, 0, 60, 140]} flip style={{ right: cm(1.5), top: '44%', width: cm(card ? 7 : 11) }}>
        <Tulips />
      </Piece>
    </>
  );
}
