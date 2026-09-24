import type { CSSProperties } from 'react';
import { Layer, Piece, cm, r1, useIds, type SceneProps } from './kit';

/**
 * Deco Gatsby — the Roaring Twenties in gold on onyx: a stepped ziggurat frame in triple gold lines
 * with diamonds at the middle of each side, a sunburst fan rising from a rule at the crown, chevrons
 * along the foot and a champagne coupe with rising bubbles. The gold follows the accent (silver /
 * emerald presets).
 */
const GOLD = 'var(--inv-accent, #CFAE6B)';
const GOLD_LIGHT = 'color-mix(in srgb, var(--inv-accent, #CFAE6B) 50%, #FFF4D8)';
const GOLD_DEEP = 'color-mix(in srgb, var(--inv-accent, #CFAE6B) 60%, #2A1E08)';
const LINE = 1.5; // px, the frame's hairlines

type Url = (name: string) => string;

/** A sunburst fan (viewBox 0 0 200 110), base centred at (100, 104). */
function Fan({ u, rays = 15 }: { u: Url; rays?: number }) {
  const p = (a: number, r: number) => `${r1(100 + Math.cos(a) * r)} ${r1(104 + Math.sin(a) * r)}`;
  return (
    <g>
      {Array.from({ length: rays }, (_, i) => {
        const a0 = Math.PI + (i * Math.PI) / rays;
        const a1 = Math.PI + ((i + 1) * Math.PI) / rays;
        return (
          <path
            key={i}
            d={`M${p(a0, 24)}L${p(a0, 96)}L${p(a1, 96)}L${p(a1, 24)}Z`}
            fill={i % 2 ? u('gold') : 'none'}
            stroke={u('gold')}
            strokeWidth="1.2"
          />
        );
      })}
      <path d="M76 104a24 24 0 0 1 48 0z" fill={u('gold')} />
      <path d="M86 104a14 14 0 0 1 28 0z" fill="#0E0E10" />
      <path d="M2 104a98 98 0 0 1 196 0" fill="none" stroke={u('gold')} strokeWidth="2" />
    </g>
  );
}

/** A champagne coupe with bubbles (viewBox 0 0 120 160). */
function Coupe({ u }: { u: Url }) {
  return (
    <g>
      <path d="M14 40c0 26 20 40 46 40s46-14 46-40z" fill={u('champagne')} />
      <path d="M14 40h92" style={{ stroke: GOLD_LIGHT }} strokeWidth="2" />
      <path d="M14 40c0 26 20 40 46 40s46-14 46-40" fill="none" stroke="#fff" strokeWidth="2" opacity=".7" />
      <path d="M58 80h4v52h-4z" fill="#E8E2D2" />
      <path d="M36 146c0-8 10-14 24-14s24 6 24 14z" fill="#E8E2D2" />
      {[
        [44, 50, 2.4],
        [62, 58, 1.8],
        [78, 48, 2.2],
        [54, 30, 1.6],
        [70, 20, 2],
        [60, 6, 1.4],
      ].map(([x, y, r], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill="none"
          style={{ stroke: GOLD_LIGHT }}
          strokeWidth="1"
          data-anim={i > 2 ? 'twinkle' : undefined}
        />
      ))}
    </g>
  );
}

/** One stepped corner (viewBox 0 0 100 100) of three nested lines, drawn for the top-left. */
function Corner() {
  const path = (o: number) =>
    `M${o} 100V${30 + o}H${10 + o}V${20 + o}H${20 + o}V${10 + o}H${30 + o}V${o}H100`;
  return (
    <g fill="none" style={{ stroke: GOLD }} strokeWidth={LINE} vectorEffect="non-scaling-stroke">
      {[0, 6, 12].map((o) => (
        <path key={o} d={path(o)} vectorEffect="non-scaling-stroke" />
      ))}
      <path d="M36 36l6 6-6 6-6-6z" style={{ fill: GOLD }} stroke="none" />
    </g>
  );
}

const tripleLine = (dir: 'h' | 'v'): CSSProperties => {
  const line = `linear-gradient(${GOLD}, ${GOLD})`;
  const size = dir === 'h' ? `100% ${LINE}px` : `${LINE}px 100%`;
  const at = (p: string) => (dir === 'h' ? `0 ${p}` : `${p} 0`);
  return {
    background: `${line} ${at('0')} / ${size} no-repeat, ${line} ${at('50%')} / ${size} no-repeat, ${line} ${at('100%')} / ${size} no-repeat`,
  };
};

export default function DecoGatsby({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const inset = card ? '4cqmin' : '4.5cqmin';
  const corner = card ? '9cqmin' : '12cqmin';
  const gap = `calc(${corner} * .12 + ${LINE}px)`; // the three lines span 12% of a corner
  const diamond = (style: CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        width: '2.6cqmin',
        aspectRatio: '1',
        rotate: '45deg',
        background: GOLD,
        boxShadow: '0 0 0 0.8cqmin #0E0E10',
        ...style,
      }}
    />
  );
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('gold')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: GOLD_LIGHT }} />
            <stop offset=".5" style={{ stopColor: GOLD }} />
            <stop offset="1" style={{ stopColor: GOLD_DEEP }} />
          </linearGradient>
          <linearGradient id={ref('champagne')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#F7E7B4" stopOpacity=".95" />
            <stop offset="1" stopColor="#D9B45A" stopOpacity=".9" />
          </linearGradient>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'repeating-linear-gradient(90deg, color-mix(in srgb, var(--inv-accent, #CFAE6B) 6%, transparent) 0 1px, transparent 1px 3.2cqmin),' +
            'radial-gradient(80cqw 55cqh at 50% 45%, rgba(46,46,51,.6), transparent 80%)',
        }}
      />
      {/* the stepped frame: four corners + triple lines between them */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <Piece
          key={c}
          vb={[0, 0, 100, 100]}
          style={{
            width: corner,
            ...(c[0] === 't' ? { top: inset } : { bottom: inset }),
            ...(c[1] === 'l' ? { left: inset } : { right: inset }),
            scale: `${c[1] === 'r' ? -1 : 1} ${c[0] === 'b' ? -1 : 1}`,
          }}
        >
          <Corner />
        </Piece>
      ))}
      {(['top', 'bottom'] as const).map((e) => (
        <div
          key={e}
          style={{
            position: 'absolute',
            left: `calc(${inset} + ${corner} - 1px)`,
            right: `calc(${inset} + ${corner} - 1px)`,
            [e]: inset,
            height: gap,
            ...tripleLine('h'),
            ...(e === 'bottom' ? { scale: '1 -1' } : null),
          }}
        />
      ))}
      {(['left', 'right'] as const).map((e) => (
        <div
          key={e}
          style={{
            position: 'absolute',
            top: `calc(${inset} + ${corner} - 1px)`,
            bottom: `calc(${inset} + ${corner} - 1px)`,
            [e]: inset,
            width: gap,
            ...tripleLine('v'),
          }}
        />
      ))}
      {diamond({ left: `calc(50% - 1.3cqmin)`, top: `calc(${inset} + ${gap} / 2 - 1.3cqmin)` })}
      {diamond({ left: `calc(50% - 1.3cqmin)`, bottom: `calc(${inset} + ${gap} / 2 - 1.3cqmin)` })}
      {diamond({ top: `calc(50% - 1.3cqmin)`, left: `calc(${inset} + ${gap} / 2 - 1.3cqmin)` })}
      {diamond({ top: `calc(50% - 1.3cqmin)`, right: `calc(${inset} + ${gap} / 2 - 1.3cqmin)` })}
      {/* the fan rising from a rule at the crown */}
      <Piece
        vb={[0, 0, 200, 110]}
        style={{ left: '50%', top: card ? '6cqh' : '7cqh', width: cm(card ? 26 : 40), translate: '-50% 0' }}
      >
        <Fan u={url} />
      </Piece>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: `calc(${card ? '6cqh' : '7cqh'} + ${cm(card ? 26 : 40)} * 104 / 200)`,
          width: cm(card ? 44 : 62),
          height: '1.4cqmin',
          translate: '-50% 0',
          ...tripleLine('h'),
        }}
      />
      {/* chevrons along the foot */}
      <Piece
        vb={[0, 0, 400, 40]}
        fit="xMidYMid slice"
        style={{
          left: `calc(${inset} + ${gap} + 3cqmin)`,
          width: `calc(100% - 2 * (${inset} + ${gap} + 3cqmin))`,
          bottom: `calc(${inset} + ${gap} + 3cqmin)`,
          height: card ? '4cqmin' : '5cqmin',
          aspectRatio: 'auto',
          overflow: 'hidden',
        }}
      >
        {[0, 1].map((row) => (
          <path
            key={row}
            d={`M0 ${14 + row * 14}${Array.from({ length: 20 }, (_, i) => `L${i * 20 + 10} ${4 + row * 14}L${i * 20 + 20} ${14 + row * 14}`).join('')}`}
            fill="none"
            stroke={url('gold')}
            strokeWidth="2"
            opacity={1 - row * 0.4}
          />
        ))}
      </Piece>
      <Piece
        vb={[0, 0, 120, 160]}
        anim="float"
        style={{
          left: '50%',
          bottom: card ? '10cqh' : '9cqh',
          width: cm(card ? 8 : 12),
          translate: '-50% 0',
        }}
      >
        <Coupe u={url} />
      </Piece>
    </>
  );
}
