import { Layer, Piece, cm, rng, r1, useIds, type SceneProps } from './kit';

/**
 * Klaf — an open Torah scroll: the parchment is the page, rolled at both sides onto twin wooden
 * rollers (atzei chaim) with turned handles; a band of tallit stripes crosses its foot, a silver yad
 * points in from the side, a scribe's quill rests at the top. No crowns. The stripes follow the accent.
 */
const WOOD = '#7B4A2A';
const WOOD_DEEP = '#4E2C17';
const WOOD_LIGHT = '#A8704A';
const PARCH = '#F4EAD3';
const PARCH_SHADE = '#C9B48A';
const STRIPE = 'var(--inv-accent, #2F6EA5)';

type Url = (name: string) => string;

/** Turned handle, top end (viewBox 0 0 60 110); the bottom one is flipped. */
function Handle({ u }: { u: Url }) {
  return (
    <g>
      <path d="M22 110V92h16v18z" fill={u('wood')} />
      <ellipse cx="30" cy="92" rx="26" ry="7" fill={u('wood')} />
      <ellipse cx="30" cy="90" rx="26" ry="6" fill={WOOD_LIGHT} opacity=".55" />
      <path d="M25 90V60h10v30z" fill={u('wood')} />
      <ellipse cx="30" cy="60" rx="12" ry="4" fill={WOOD_DEEP} />
      <path d="M30 14c9 0 14 10 14 22s-6 22-14 22-14-10-14-22 5-22 14-22z" fill={u('wood')} />
      <path d="M25 20c-4 6-5 20 0 30" stroke="#fff" strokeWidth="2" opacity=".25" fill="none" />
      <path d="M26 14c0-6 2-10 4-12 2 2 4 6 4 12z" fill={WOOD_DEEP} />
    </g>
  );
}

/** A silver yad (pointer) with its little hand (viewBox 0 0 220 60), pointing left. */
function Yad({ u }: { u: Url }) {
  return (
    <g>
      <path d="M210 26c8 0 8 8 0 8" stroke="#8A8F96" strokeWidth="2" fill="none" />
      <path d="M196 24h14v12h-14z" fill={u('silver')} />
      <path d="M56 27L196 22v16L56 33z" fill={u('silver')} />
      <circle cx="120" cy="30" r="6" fill={u('silver')} />
      <circle cx="160" cy="30" r="5" fill={u('silver')} />
      <path d="M56 26c-8-4-18-4-26 0h-12c-3 0-3 4 0 4h14c-2 2-2 4 0 6 8 2 16 2 24-2z" fill={u('silver')} />
      <path d="M70 28H190" stroke="#fff" strokeWidth="1.4" opacity=".6" />
    </g>
  );
}

/** A quill feather (viewBox 0 0 60 240), nib at the bottom. */
function Quill() {
  const barbs: string[] = [];
  for (let i = 0; i < 18; i++) {
    const y = 20 + i * 9;
    const w = 20 - Math.abs(i - 7) * 1.5;
    barbs.push(`M30 ${y}Q${r1(30 - w * 0.7)} ${y - 4} ${r1(30 - w)} ${y - 12}M30 ${y}Q${r1(30 + w * 0.7)} ${y - 4} ${r1(30 + w)} ${y - 12}`);
  }
  return (
    <g>
      <path d="M30 8C10 30 8 120 26 190h8C52 120 50 30 30 8z" fill="#F6F0E4" />
      <path d={barbs.join('')} stroke="#D6CAB4" strokeWidth="1.2" fill="none" />
      <path d="M30 10V222" stroke="#B9A98C" strokeWidth="1.6" />
      <path d="M28 200l2 30 2-30z" fill="#2A1D12" />
    </g>
  );
}

export default function Klaf({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  // the parchment between the rollers; the rollers sit on its two edges
  const W = card ? 'min(80cqw, 88cqh)' : 'min(90cqw, 76cqh)';
  const roller = card ? '7cqmin' : '9cqmin';
  const handle = `calc(${roller} * 110 / 60)`;
  const rand = rng(5);
  const flecks = Array.from({ length: 40 }, () => [r1(rand() * 100), r1(rand() * 160), r1(0.3 + rand() * 0.8)] as const);
  const side = (s: 'left' | 'right') => ({ [s]: `calc(50% - ${W} / 2 - ${roller} / 2)` });
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('wood')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={WOOD_DEEP} />
            <stop offset=".45" stopColor={WOOD_LIGHT} />
            <stop offset="1" stopColor={WOOD_DEEP} />
          </linearGradient>
          <linearGradient id={ref('silver')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#F3F5F7" />
            <stop offset=".5" stopColor="#B8BEC6" />
            <stop offset="1" stopColor="#7E858E" />
          </linearGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#3A2410" floodOpacity=".3" />
          </filter>
        </defs>
      </svg>
      {/* parchment: warm stains and flecks, darker at the edges */}
      <Layer
        style={{
          background:
            'radial-gradient(40cqmin 30cqmin at 22% 30%, rgba(201,180,138,.25), transparent 70%),' +
            'radial-gradient(50cqmin 40cqmin at 78% 72%, rgba(201,180,138,.22), transparent 70%),' +
            'radial-gradient(90cqw 70cqh at 50% 50%, transparent 60%, rgba(120,90,50,.28) 100%)',
        }}
      />
      <Piece vb={[0, 0, 100, 160]} fit="xMidYMid slice" style={{ inset: 0, width: '100%', height: '100%' }}>
        {flecks.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#8C6A3E" opacity={0.08 + (i % 3) * 0.04} />
        ))}
      </Piece>
      {/* the rolled parchment on each roller (shaded cylinders), then the turned handles */}
      {(['left', 'right'] as const).map((s) => (
        <div
          key={s}
          style={{
            position: 'absolute',
            ...side(s),
            top: `calc(${handle} * .8)`,
            bottom: `calc(${handle} * .8)`,
            width: roller,
            borderRadius: '1.2cqmin',
            background: `linear-gradient(90deg, ${PARCH_SHADE}, ${PARCH} 40%, #FBF5E6 55%, ${PARCH_SHADE})`,
            boxShadow: '0 0 1.6cqmin rgba(60,40,15,.35)',
          }}
        />
      ))}
      {(['left', 'right'] as const).flatMap((s) => [
        <Piece key={`${s}t`} vb={[0, 0, 60, 110]} style={{ ...side(s), top: 0, width: roller }}>
          <g filter={url('soft')}>
            <Handle u={url} />
          </g>
        </Piece>,
        <Piece key={`${s}b`} vb={[0, 0, 60, 110]} style={{ ...side(s), bottom: 0, width: roller, scale: '1 -1' }}>
          <g filter={url('soft')}>
            <Handle u={url} />
          </g>
        </Piece>,
      ])}
      {/* tallit stripes across the foot of the sheet */}
      <Layer
        style={{
          inset: 'auto',
          left: `calc(50% - ${W} / 2 + ${roller} / 2)`,
          width: `calc(${W} - ${roller})`,
          bottom: card ? '12cqh' : '10cqh',
          height: card ? '9cqmin' : '11cqmin',
          background:
            `linear-gradient(180deg, transparent 0 14%, ${STRIPE} 14% 30%, transparent 30% 38%, ${STRIPE} 38% 44%, transparent 44% 56%, ${STRIPE} 56% 62%, transparent 62% 70%, ${STRIPE} 70% 86%, transparent 86%),` +
            'linear-gradient(180deg, #FBF7EC, #F2EAD6)',
          boxShadow: '0 1px 2px rgba(60,40,15,.2)',
          opacity: 0.95,
        }}
      />
      <Piece vb={[0, 0, 220, 60]} style={{ right: `calc(50% - ${W} / 2 + ${roller})`, bottom: card ? '24cqh' : '20cqh', width: cm(card ? 30 : 44), rotate: '-18deg' }}>
        <g filter={url('soft')}>
          <Yad u={url} />
        </g>
      </Piece>
      <Piece vb={[0, 0, 60, 240]} anim="sway" style={{ left: `calc(50% - ${W} / 2 + ${roller} * 1.6)`, top: cm(card ? 4 : 6), width: cm(card ? 7 : 10), rotate: '-28deg' }}>
        <g filter={url('soft')}>
          <Quill />
        </g>
      </Piece>
    </>
  );
}
