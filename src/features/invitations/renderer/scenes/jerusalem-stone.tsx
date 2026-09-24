import { Layer, Piece, cm, polar, r1, rng, useIds, type SceneProps } from './kit';

/**
 * Jerusalem Stone — a wall of honey limestone ashlars with chiselled margins around a tall arched
 * window framed by voussoirs and a keystone; through it a clear sky over soft hills with cypresses
 * and an olive tree; an olive branch hangs over the arch; a stone sill below.
 */
const STONE = ['#E4D2B0', '#DCC7A2', '#E8D8BA', '#D6C19C', '#E1CDA9'];
const JOINT = '#C2AA82';
const OLIVE_LEAF = '#6E7D4A';
const OLIVE_LEAF_LIGHT = '#9AA774';
const CYPRESS = '#3F5A34';

type Url = (name: string) => string;

/** The ashlar wall (viewBox 0 0 1000 1000, sliced to cover). */
function Wall() {
  const rand = rng(21);
  const blocks: { x: number; y: number; w: number; h: number; tone: string }[] = [];
  const rowH = 78;
  for (let row = 0; row * rowH < 1000; row++) {
    let x = row % 2 ? -rand() * 90 : -rand() * 40;
    while (x < 1000) {
      const w = 130 + rand() * 90;
      blocks.push({ x, y: row * rowH, w, h: rowH, tone: STONE[Math.floor(rand() * STONE.length)]! });
      x += w;
    }
  }
  return (
    <>
      <rect width="1000" height="1000" fill={JOINT} />
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={r1(b.x + 2)} y={r1(b.y + 2)} width={r1(b.w - 4)} height={r1(b.h - 4)} rx="2" fill={b.tone} />
          <rect
            x={r1(b.x + 11)}
            y={r1(b.y + 11)}
            width={r1(b.w - 22)}
            height={r1(b.h - 22)}
            rx="3"
            fill="#fff"
            opacity={0.1 + (i % 3) * 0.05}
          />
          <path d={`M${r1(b.x + 11)} ${r1(b.y + b.h - 11)}H${r1(b.x + b.w - 11)}V${r1(b.y + 11)}`} stroke="#8C7550" strokeWidth="1.2" opacity=".25" fill="none" />
        </g>
      ))}
    </>
  );
}

/** The view through the window: hills, cypresses and an olive tree (viewBox 0 0 400 160). */
function View() {
  const cypress = (x: number, h: number, w: number) => (
    <path d={`M${x} ${160 - h}C${x + w * 0.55} ${160 - h * 0.7} ${x + w * 0.6} ${160 - h * 0.25} ${x + w * 0.2} 160H${x - w * 0.2}C${x - w * 0.6} ${160 - h * 0.25} ${x - w * 0.55} ${160 - h * 0.7} ${x} ${160 - h}Z`} fill={CYPRESS} />
  );
  return (
    <>
      <path d="M0 88C60 70 110 76 170 86S290 70 400 80V160H0Z" fill="#AFC3B0" opacity=".7" />
      <path d="M0 112C80 96 150 104 220 110S340 98 400 104V160H0Z" fill="#8FA98B" />
      <path d="M0 138C90 128 200 134 280 136S370 130 400 132V160H0Z" fill="#6E8B5E" />
      {cypress(70, 118, 22)}
      {cypress(96, 88, 17)}
      {cypress(330, 104, 20)}
      <g>
        <path d="M252 160c2-18 0-30-4-40M252 140c6-8 14-12 22-14" stroke="#5B4A36" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <ellipse cx="250" cy="112" rx="30" ry="18" fill={OLIVE_LEAF} />
        <ellipse cx="274" cy="118" rx="22" ry="14" fill={OLIVE_LEAF_LIGHT} />
        <ellipse cx="236" cy="120" rx="18" ry="12" fill={OLIVE_LEAF_LIGHT} opacity=".8" />
      </g>
    </>
  );
}

/** An olive branch hanging from the top-left corner (viewBox 0 0 240 200). */
function OliveBranch({ u }: { u: Url }) {
  const leaves = [
    [30, 22, 30, 42],
    [52, 34, 70, 40],
    [74, 50, 18, 44],
    [96, 66, 88, 42],
    [118, 86, 36, 40],
    [138, 104, 100, 38],
    [158, 126, 50, 36],
    [172, 148, 110, 32],
    [62, 44, 150, 34],
    [106, 78, 160, 34],
  ] as const;
  return (
    <g filter={u('soft')}>
      <path d="M-10 6C60 24 120 70 184 164" stroke="#5B4A36" strokeWidth="3.6" fill="none" strokeLinecap="round" />
      {leaves.map(([x, y, deg, len], i) => {
        const [tx, ty] = polar(x, y, len, deg);
        const [ax, ay] = polar(x, y, len * 0.5, deg - 16);
        const [bx, by] = polar(x, y, len * 0.5, deg + 16);
        return <path key={i} d={`M${x} ${y}Q${ax} ${ay} ${tx} ${ty}Q${bx} ${by} ${x} ${y}Z`} fill={i % 2 ? OLIVE_LEAF : OLIVE_LEAF_LIGHT} />;
      })}
      {[
        [104, 96],
        [150, 136],
        [128, 120],
      ].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="7" ry="9" fill={i === 1 ? '#3E3A2A' : '#6B7A3A'} />
          <ellipse cx={x! - 2} cy={y! - 3} rx="2" ry="3" fill="#fff" opacity=".35" />
        </g>
      ))}
    </g>
  );
}

export default function JerusalemStone({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const W = card ? 'min(62cqw, 60cqh)' : 'min(84cqw, 72cqh)';
  const top = card ? '14cqh' : '7cqh';
  const bottom = card ? '14cqh' : '8.5cqh';
  const band = card ? '3cqmin' : '4.2cqmin';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={ref('soft')} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="3" dy="6" stdDeviation="4" floodColor="#4A3A22" floodOpacity=".25" />
          </filter>
        </defs>
      </svg>
      <Piece vb={[0, 0, 1000, 1000]} fit="xMidYMid slice" style={{ inset: 0, width: '100%', height: '100%' }}>
        <Wall />
      </Piece>
      <Layer style={{ background: 'radial-gradient(90cqw 70cqh at 50% 40%, rgba(255,244,220,.35), rgba(120,90,50,.18) 90%)' }} />
      {/* voussoirs: a stone band around the arch, jointed radially */}
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          top: `calc(${top} - ${band})`,
          bottom,
          width: `calc(${W} + 2 * ${band})`,
          translate: '-50% 0',
          borderRadius: '9999px 9999px 0 0',
          // voussoir joints on the curve only; coursed joints down the jambs
          background:
            `repeating-conic-gradient(from -90deg at 50% calc(${W} / 2 + ${band}), transparent 0deg 8.6deg, rgba(120,95,60,.45) 8.6deg 9deg) 0 0 / 100% calc(${W} / 2 + ${band}) no-repeat,` +
            `repeating-linear-gradient(180deg, transparent 0 7cqmin, rgba(120,95,60,.4) 7cqmin calc(7cqmin + 1px)) 0 calc(${W} / 2 + ${band}) / 100% 100% no-repeat,` +
            'linear-gradient(180deg, #EFE2C8, #DCC8A4)',
          boxShadow: '0 10px 24px -12px rgba(70,50,20,.45)',
        }}
      />
      {/* the window */}
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          top,
          bottom,
          width: W,
          translate: '-50% 0',
          borderRadius: '9999px 9999px 0 0',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #8DB3CF 0%, #B7D0E2 45%, #E3ECF0 78%, #F2EEE4 100%)',
          boxShadow: 'inset 0 10px 18px -8px rgba(60,40,20,.35), inset 8px 0 14px -10px rgba(60,40,20,.3), inset -8px 0 14px -10px rgba(60,40,20,.3)',
        }}
      >
        <Piece vb={[0, 0, 400, 160]} fit="xMidYMax slice" style={{ left: 0, bottom: 0, width: '100%', height: card ? '38%' : '22%' }}>
          <View />
        </Piece>
      </Layer>
      {/* keystone */}
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          top: `calc(${top} - ${band} - 1.2cqmin)`,
          width: card ? '6cqmin' : '8cqmin',
          height: `calc(${band} + 3cqmin)`,
          translate: '-50% 0',
          clipPath: 'polygon(0 0, 100% 0, 80% 100%, 20% 100%)',
          background: 'linear-gradient(180deg, #F2E6CE, #D8C39C)',
        }}
      />
      {/* sill */}
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          bottom: `calc(${bottom} - 2.4cqmin)`,
          width: `calc(${W} + 4 * ${band})`,
          height: '2.8cqmin',
          translate: '-50% 0',
          background: 'linear-gradient(180deg, #F3E8D3, #D9C5A0)',
          boxShadow: '0 8px 14px -6px rgba(70,50,20,.5)',
          borderRadius: '2px',
        }}
      />
      <Piece vb={[0, 0, 240, 200]} anim="sway" style={{ right: cm(-6), top: cm(-3), width: cm(card ? 32 : 56), scale: '-1 1' }}>
        <OliveBranch u={url} />
      </Piece>
    </>
  );
}
