import type { ReactNode } from 'react';
import { Layer, Piece, cm, r1, useIds, type SceneProps } from './kit';

/**
 * Neon Night — after dark: laser fans sweeping from the top corners, neon signs drawn as double
 * tubes with a halo (a lightning bolt, a heart), neon corner brackets, and a perspective grid floor
 * glowing to the horizon. The heart and the magenta light follow the accent.
 */
const MAGENTA = 'var(--inv-accent, #FF2BD6)';
const LIME = '#B6FF3B';
const CYAN = '#22E4FF';
const YELLOW = '#FFE14D';

type Url = (name: string) => string;

/** A neon tube: a blurred halo, the coloured glass, a white-hot core. */
function Tube({ d, color, w = 5, u }: { d: string; color: string; w?: number; u: Url }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} style={{ stroke: color }} strokeWidth={w * 3.2} opacity=".55" filter={u('halo')} />
      <path d={d} style={{ stroke: color }} strokeWidth={w} />
      <path d={d} stroke="#fff" strokeWidth={r1(w * 0.36)} opacity=".85" />
    </g>
  );
}

/** A fan of laser beams from (x, y). */
function Lasers({ x, y, from, to, n, color, len }: { x: number; y: number; from: number; to: number; n: number; color: string; len: number }): ReactNode {
  return Array.from({ length: n }, (_, i) => {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    return (
      <path
        key={i}
        d={`M${x} ${y}L${r1(x + Math.cos(a) * len)} ${r1(y + Math.sin(a) * len)}`}
        style={{ stroke: color }}
        strokeWidth="1.4"
        opacity={0.35 + (i % 2) * 0.25}
      />
    );
  });
}

/** Perspective grid floor (viewBox 0 0 800 260), horizon at the top. */
function Grid() {
  const lines: string[] = [];
  for (let i = -12; i <= 12; i++) lines.push(`M400 0L${400 + i * 90} 260`);
  const rows = [8, 20, 36, 58, 88, 128, 180, 250];
  return (
    <g fill="none">
      {lines.map((d, i) => (
        <path key={i} d={d} style={{ stroke: MAGENTA }} strokeWidth="1.3" opacity=".55" />
      ))}
      {rows.map((y) => (
        <path key={y} d={`M0 ${y}H800`} stroke={CYAN} strokeWidth={r1(0.8 + y / 120)} opacity=".6" />
      ))}
      <path d="M0 1H800" stroke="#fff" strokeWidth="2" opacity=".85" />
    </g>
  );
}

export default function NeonNight({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={ref('halo')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={ref('beam')} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'radial-gradient(90cqw 40cqh at 50% 100%, color-mix(in srgb, var(--inv-accent, #FF2BD6) 38%, transparent), transparent 70%),' +
            'radial-gradient(60cqmin 50cqmin at 0% 0%, rgba(34,228,255,.18), transparent 70%),' +
            'radial-gradient(60cqmin 50cqmin at 100% 0%, color-mix(in srgb, var(--inv-accent, #FF2BD6) 22%, transparent), transparent 70%),' +
            'linear-gradient(180deg, #120E26 0%, #0B0A12 55%, #150A24 100%)',
        }}
      />
      <Piece vb={[0, 0, 400, 400]} anim="sweep" style={{ left: cm(-6), top: cm(-6), width: cm(card ? 48 : 76) }}>
        <g filter={url('beam')}>
          <Lasers x={0} y={0} from={18} to={72} n={8} color={CYAN} len={560} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 400, 400]} anim="sweep" style={{ right: cm(-6), top: cm(-6), width: cm(card ? 48 : 76), scale: '-1 1' }}>
        <g filter={url('beam')}>
          <Lasers x={0} y={0} from={20} to={70} n={7} color="var(--inv-accent, #FF2BD6)" len={560} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 800, 260]} fit="xMidYMin slice" style={{ left: 0, bottom: 0, width: '100%', height: card ? '34cqh' : '22cqh' }}>
        <Grid />
      </Piece>
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          width: '100%',
          bottom: card ? '34cqh' : '22cqh',
          height: '0.6cqmin',
          background: '#fff',
          boxShadow: `0 0 2cqmin 0.6cqmin ${CYAN}, 0 0 6cqmin 1cqmin color-mix(in srgb, var(--inv-accent, #FF2BD6) 70%, transparent)`,
        }}
      />
      {/* neon corner brackets */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <Piece
          key={c}
          vb={[0, 0, 100, 100]}
          style={{
            width: cm(card ? 10 : 14),
            ...(c[0] === 't' ? { top: cm(5) } : { bottom: cm(card ? 5 : 26) }),
            ...(c[1] === 'l' ? { left: cm(5) } : { right: cm(5) }),
            scale: `${c[1] === 'r' ? -1 : 1} ${c[0] === 'b' ? -1 : 1}`,
          }}
        >
          <Tube d="M10 90V30Q10 10 30 10H90" color={CYAN} w={4} u={url} />
        </Piece>
      ))}
      <Piece vb={[0, 0, 100, 140]} anim="flicker" style={{ left: cm(card ? 12 : 14), top: cm(card ? 12 : 17), width: cm(card ? 9 : 14), rotate: '-10deg' }}>
        <Tube d="M62 8L22 76H50L36 132L84 56H54L70 8Z" color={YELLOW} w={5} u={url} />
      </Piece>
      <Piece vb={[0, 0, 140, 120]} style={{ right: cm(card ? 12 : 13), top: cm(card ? 11 : 16), width: cm(card ? 11 : 17), rotate: '8deg' }}>
        <Tube d="M70 108C28 78 10 60 10 38 10 20 24 10 38 10c14 0 26 8 32 22 6-14 18-22 32-22 14 0 28 10 28 28 0 22-18 40-60 70z" color={MAGENTA} w={5} u={url} />
      </Piece>
      <Piece vb={[0, 0, 60, 60]} anim="twinkle" style={{ left: '50%', top: cm(card ? 8 : 11), width: cm(card ? 5 : 7), translate: '-50% 0' }}>
        <Tube d="M30 6V54M6 30H54M13 13l34 34M47 13 13 47" color={LIME} w={3} u={url} />
      </Piece>
    </>
  );
}
