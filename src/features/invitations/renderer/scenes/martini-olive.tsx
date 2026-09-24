import { Layer, Piece, cm, polar, r1, useIds, type SceneProps } from './kit';

/**
 * Martini Olive — a retro cocktail party on olive-green wallpaper: a cream scalloped valance at the
 * top, a big martini with a speared olive, tall taper candles in brass sticks, scattered olives, and a
 * checkerboard strip with a scalloped edge along the floor. The pick and pimentos follow the accent.
 */
const CREAM = '#F7F0E1';
const OLIVE = '#A7B56B';
const OLIVE_DEEP = '#6F7D34';
const PIMENTO = 'var(--inv-accent, #CC4128)';
const SILVER = '#C9CCCF';
const BLACK = '#111111';
const BRASS = '#C9A24A';

type Url = (name: string) => string;

function Olive({ x, y, r, deg = 0, u }: { x: number; y: number; r: number; deg?: number; u: Url }) {
  return (
    <g transform={`rotate(${deg} ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={r} ry={r1(r * 0.78)} fill={u('olive')} />
      <ellipse cx={r1(x + r * 0.62)} cy={y} rx={r1(r * 0.3)} ry={r1(r * 0.34)} style={{ fill: PIMENTO }} />
      <ellipse cx={r1(x - r * 0.3)} cy={r1(y - r * 0.36)} rx={r1(r * 0.28)} ry={r1(r * 0.12)} fill="#fff" opacity=".5" />
    </g>
  );
}

/** The martini (viewBox 0 0 200 300): V glass, stem, foot, a speared olive. */
function Martini({ u }: { u: Url }) {
  return (
    <g>
      <path d="M150 20L96 116" style={{ stroke: PIMENTO }} strokeWidth="4" strokeLinecap="round" />
      <path d="M150 20l8-10M150 20l12 2" style={{ stroke: PIMENTO }} strokeWidth="3" strokeLinecap="round" />
      <path d="M22 70H178L104 160H96Z" fill={u('glass')} />
      <path d="M36 86H164L102 156H98Z" fill="#EEF0C9" opacity=".75" />
      <path d="M36 86H164" stroke="#fff" strokeWidth="2" opacity=".8" />
      <Olive x={112} y={104} r={15} deg={-58} u={u} />
      <path d="M22 70H178L104 160H96Z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" opacity=".9" />
      <path d="M40 78L92 142" stroke="#fff" strokeWidth="3" opacity=".45" strokeLinecap="round" />
      <path d="M97 160h6v96h-6z" fill={SILVER} />
      <path d="M99 160v96" stroke="#fff" strokeWidth="1.4" opacity=".7" />
      <path d="M60 268c0-8 18-12 40-12s40 4 40 12-18 10-40 10-40-2-40-10z" fill={SILVER} />
      <path d="M70 266c6-4 18-6 30-6" stroke="#fff" strokeWidth="2" opacity=".7" fill="none" />
    </g>
  );
}

/** Three taper candles in brass sticks (viewBox 0 0 160 300). */
function Candles({ u }: { u: Url }) {
  const candle = (x: number, h: number) => (
    <g key={x}>
      <ellipse cx={x} cy={300 - h - 34} rx="14" ry="22" fill={u('flame-glow')} data-anim="flicker" />
      <path d={`M${x} ${300 - h - 44}c-5 8-6 14 0 18 6-4 5-10 0-18z`} fill="#FFD27A" data-anim="flicker" />
      <path d={`M${x} ${300 - h - 36}c-2 4-2 7 0 9 2-2 2-5 0-9z`} fill="#fff" />
      <path d={`M${x} ${300 - h - 27}v6`} stroke="#3A2A18" strokeWidth="1.4" />
      <path d={`M${x - 6} ${300 - h - 20}h12l2 ${h - 20}h-16z`} fill={CREAM} />
      <path d={`M${x - 3} ${300 - h - 18}v${h - 26}`} stroke="#fff" strokeWidth="2" opacity=".6" />
      <path d={`M${x - 12} 262h24l-4 8h-16z`} fill={BRASS} />
      <path d={`M${x - 5} 270h10v14h-10z`} fill={BRASS} />
      <path d={`M${x - 16} 284h32l4 10h-40z`} fill={BRASS} />
      <path d={`M${x - 14} 262h28`} stroke="#fff" strokeWidth="1.4" opacity=".4" />
    </g>
  );
  return <g>{[candle(34, 200), candle(80, 250), candle(126, 170)]}</g>;
}

export default function MartiniOlive({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const check = card ? '4cqmin' : '5.2cqmin';
  const scallop = card ? '5cqmin' : '6.5cqmin';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id={ref('olive')} cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#C9D48E" />
            <stop offset=".6" stopColor={OLIVE} />
            <stop offset="1" stopColor={OLIVE_DEEP} />
          </radialGradient>
          <linearGradient id={ref('glass')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".12" />
            <stop offset="1" stopColor="#fff" stopOpacity=".3" />
          </linearGradient>
          <radialGradient id={ref('flame-glow')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FFE3A0" stopOpacity=".7" />
            <stop offset="1" stopColor="#FFE3A0" stopOpacity="0" />
          </radialGradient>
          <filter id={ref('soft')} x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#10140A" floodOpacity=".45" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 1.2cqmin, transparent 1.2cqmin 5cqmin),' +
            'radial-gradient(70cqw 50cqh at 50% 42%, rgba(167,181,107,.28), rgba(20,26,8,.35) 100%)',
        }}
      />
      {/* scalloped valance */}
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          top: 0,
          width: '100%',
          height: `calc(${scallop} * 1.2)`,
          background: CREAM,
        }}
      />
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          top: `calc(${scallop} * 1.2 - 1px)`,
          width: '100%',
          height: `calc(${scallop} / 2 + 1px)`,
          background: `radial-gradient(circle calc(${scallop} / 2) at 50% 0, ${CREAM} 96%, transparent 100%) 0 0 / ${scallop} 100% repeat-x`,
          filter: 'drop-shadow(0 5px 4px rgba(0,0,0,.25))',
        }}
      />
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          top: `calc(${scallop} * .55)`,
          width: '100%',
          height: '0.5cqmin',
          background: `repeating-linear-gradient(90deg, ${OLIVE_DEEP} 0 1.4cqmin, transparent 1.4cqmin 2.4cqmin)`,
          opacity: 0.6,
        }}
      />
      {/* olives tumbling */}
      <Piece vb={[0, 0, 300, 120]} anim="float" style={{ left: '50%', top: `calc(${scallop} * 2.2)`, width: cm(card ? 26 : 40), translate: '-50% 0' }}>
        <g filter={url('soft')}>
          <Olive x={60} y={60} r={16} deg={-20} u={url} />
          <Olive x={150} y={34} r={13} deg={30} u={url} />
          <Olive x={236} y={70} r={15} deg={-150} u={url} />
        </g>
      </Piece>
      {/* the floor: checkerboard with a scalloped edge */}
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          bottom: 0,
          width: '100%',
          height: `calc(${check} * 2)`,
          background: `repeating-conic-gradient(${BLACK} 0 25%, ${CREAM} 0 50%) 0 0 / calc(${check} * 2) calc(${check} * 2)`,
        }}
      />
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          bottom: `calc(${check} * 2 - 1px)`,
          width: '100%',
          height: `calc(${check} / 2)`,
          background: `radial-gradient(circle calc(${check} / 2) at 50% 100%, ${CREAM} 96%, transparent 100%) 0 0 / ${check} 100% repeat-x`,
        }}
      />
      <Piece vb={[0, 0, 200, 300]} style={{ right: cm(card ? 4 : 1), bottom: `calc(${check} * 2 + ${check} / 2 - 1cqmin)`, width: cm(card ? 22 : 36), rotate: '6deg' }}>
        <g filter={url('soft')}>
          <Martini u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 160, 300]} style={{ left: cm(card ? 3 : 0), bottom: `calc(${check} * 2 + ${check} / 2 - 1.5cqmin)`, width: cm(card ? 18 : 28) }}>
        <g filter={url('soft')}>
          <Candles u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 60, 60]} style={{ left: '30%', bottom: `calc(${check} * 2 + ${check} / 2)`, width: cm(card ? 5 : 7) }}>
        <Olive x={30} y={36} r={15} deg={12} u={url} />
      </Piece>
      <Piece vb={[0, 0, 120, 40]} style={{ right: cm(10), top: cm(card ? 16 : 30), width: cm(card ? 8 : 12) }}>
        {[0, 1, 2, 3].map((i) => {
          const [x, y] = polar(60, 20, 30 + i * 6, -20 + i * 40);
          return <circle key={i} cx={x} cy={y} r={2 + (i % 2)} fill={CREAM} opacity=".45" />;
        })}
      </Piece>
    </>
  );
}
