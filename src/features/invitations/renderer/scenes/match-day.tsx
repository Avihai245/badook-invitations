import { Layer, Piece, cm, dayMonth, polar, useIds, type SceneProps } from './kit';

/**
 * Match Day — the stadium at night from above: mowed stripes, chalk lines (halfway line and centre
 * circle around the names, the penalty box below), floodlight towers throwing beams from the top
 * corners, a split-flap scoreboard showing the day and month, a ball on the spot and a jersey with the
 * number 10. The yellow follows the accent.
 */
const PITCH = '#1E7A3C';
const PITCH_LIGHT = '#2A9249';
const CHALK = '#F4F4F0';
const YELLOW = 'var(--inv-accent, #FFD100)';
const RED = '#E63946';

type Url = (name: string) => string;

/** Block digits for the scoreboard / jersey (viewBox per digit 0 0 20 32), drawn as paths. */
const DIGIT: Record<string, string> = {
  '0': 'M3 2h14v28H3zM8 7v18h4V7z',
  '1': 'M8 2h6v28H8zM4 6l4-4v6z',
  '2': 'M3 2h14v16H9v7h8v5H3V14h9V7H3z',
  '3': 'M3 2h14v28H3v-5h9v-7H6v-4h6V7H3z',
  '4': 'M3 2h5v12h4V2h5v28h-5V19H3z',
  '5': 'M3 2h14v5H8v7h9v16H3v-5h9v-7H3z',
  '6': 'M3 2h14v5H8v7h9v16H3zM8 18v7h4v-7z',
  '7': 'M3 2h14v28h-5V7H3z',
  '8': 'M3 2h14v28H3zM8 7v7h4V7zM8 18v7h4v-7z',
  '9': 'M3 2h14v28H3v-5h9v-7H3zM8 7v7h4V7z',
};

function Digits({ text, x, y, s, fill }: { text: string; x: number; y: number; s: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} style={{ fill }}>
      {[...text].map((c, i) => (
        <path key={i} d={DIGIT[c] ?? ''} transform={`translate(${i * 22} 0)`} fillRule="evenodd" />
      ))}
    </g>
  );
}

/** Split-flap scoreboard (viewBox 0 0 240 90) showing `dd` : `mm`. */
function Scoreboard({ dd, mm, u }: { dd: string; mm: string; u: Url }) {
  const flap = (x: number, d: string) => (
    <g key={x}>
      <rect x={x} y="22" width="46" height="56" rx="4" fill="#15181A" />
      <Digits text={d} x={x + 3} y={28} s={1.4} fill={CHALK} />
      <path d={`M${x} 50H${x + 46}`} stroke="#000" strokeWidth="2" />
      <path d={`M${x} 51H${x + 46}`} stroke="#fff" strokeWidth=".6" opacity=".25" />
    </g>
  );
  return (
    <g filter={u('soft')}>
      <rect x="0" y="0" width="240" height="90" rx="8" fill="#23272A" />
      <rect x="4" y="4" width="232" height="82" rx="6" fill="none" stroke="#3A4044" strokeWidth="2" />
      <rect x="18" y="8" width="70" height="8" rx="2" style={{ fill: YELLOW }} />
      <rect x="152" y="8" width="70" height="8" rx="2" fill={RED} />
      {flap(20, dd[0]!)}
      {flap(70, dd[1]!)}
      {flap(124, mm[0]!)}
      {flap(174, mm[1]!)}
      <circle cx="120" cy="42" r="3.4" style={{ fill: YELLOW }} />
      <circle cx="120" cy="58" r="3.4" style={{ fill: YELLOW }} />
    </g>
  );
}

/** A floodlight tower (viewBox 0 0 120 260) with its beam cone. */
function Floodlight({ u }: { u: Url }) {
  return (
    <g>
      <path d="M40 60L260 300H-120Z" fill={u('beam')} opacity=".55" />
      <path d="M58 60V260M50 260h16" stroke="#3A4044" strokeWidth="4" />
      <path
        d="M54 90l8 20M62 90l-8 20M54 130l8 20M62 130l-8 20M54 170l8 20M62 170l-8 20"
        stroke="#3A4044"
        strokeWidth="2"
      />
      <rect x="18" y="14" width="80" height="48" rx="4" fill="#2A2F33" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <circle key={`${r}${c}`} cx={30 + c * 19} cy={25 + r * 13} r="5.4" fill="#FFFBE0" />
        )),
      )}
    </g>
  );
}

/** Soccer ball (viewBox -50 -50 100 100). */
function Ball({ u }: { u: Url }) {
  const pent = (cx: number, cy: number, r: number, turn: number) => {
    const pts = Array.from({ length: 5 }, (_, i) => polar(cx, cy, r, turn + i * 72).join(' '));
    return `M${pts.join('L')}Z`;
  };
  return (
    <g filter={u('soft')}>
      <circle r="44" fill="#fff" />
      <path d={pent(0, 0, 14, -90)} fill="#15181A" />
      {[-90, -18, 54, 126, 198].map((a) => {
        const [x, y] = polar(0, 0, 36, a + 36);
        return <path key={a} d={pent(x, y, 11, a + 36 + 180)} fill="#15181A" />;
      })}
      {[-90, -18, 54, 126, 198].map((a) => {
        const [x1, y1] = polar(0, 0, 14, a);
        const [x2, y2] = polar(0, 0, 27, a);
        return <path key={`l${a}`} d={`M${x1} ${y1}L${x2} ${y2}`} stroke="#15181A" strokeWidth="2" />;
      })}
      <circle r="44" fill={u('ballshade')} />
    </g>
  );
}

/** A jersey with the number 10 (viewBox 0 0 120 120). */
function Jersey() {
  return (
    <g>
      <path d="M36 8l24 8 24-8 30 18-12 26-14-6v66H32V46l-14 6L6 26z" style={{ fill: YELLOW }} />
      <path d="M48 12c4 8 20 8 24 0" stroke="#15181A" strokeWidth="3" fill="none" />
      <path d="M6 26l30-18M114 26 84 8" stroke="#15181A" strokeWidth="3" />
      <Digits text="10" x={37} y={44} s={1.05} fill="#15181A" />
    </g>
  );
}

export default function MatchDay({ place, date }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const [dd, mm] = dayMonth(date) ?? ['17', '06'];
  const stripe = card ? '8cqmin' : '11cqmin';
  const line = '0.7cqmin';
  const circle = card ? '30cqmin' : 'min(76cqmin, 56cqh)';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id={ref('beam')} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFFBE0" stopOpacity=".55" />
            <stop offset="1" stopColor="#FFFBE0" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={ref('ballshade')} cx=".35" cy=".3" r=".8">
            <stop offset=".55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".3" />
          </radialGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#04160A" floodOpacity=".5" />
          </filter>
        </defs>
      </svg>
      {/* mowed stripes, darker toward the stands */}
      <Layer
        style={{
          background:
            `repeating-linear-gradient(180deg, ${PITCH} 0 ${stripe}, ${PITCH_LIGHT} ${stripe} calc(2 * ${stripe})),` +
            PITCH,
        }}
      />
      <Layer
        style={{
          background: 'radial-gradient(80cqw 60cqh at 50% 50%, transparent 55%, rgba(4,30,14,.55) 100%)',
        }}
      />
      {/* chalk: halfway line (broken by the circle), centre circle, penalty box */}
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          width: '100%',
          top: `calc(50% - ${line} / 2)`,
          height: line,
          background: `linear-gradient(90deg, ${CHALK} calc(50% - ${circle} / 2), transparent calc(50% - ${circle} / 2) calc(50% + ${circle} / 2), ${CHALK} calc(50% + ${circle} / 2))`,
          opacity: 0.7,
        }}
      />
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          top: '50%',
          width: circle,
          aspectRatio: '1',
          translate: '-50% -50%',
          borderRadius: '50%',
          border: `${line} solid ${CHALK}`,
          opacity: 0.55,
        }}
      />
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          bottom: '-1cqmin',
          width: card ? '56cqmin' : 'min(74cqw, 90cqh)',
          height: card ? '12cqh' : '15cqh',
          translate: '-50% 0',
          border: `${line} solid ${CHALK}`,
          opacity: 0.65,
        }}
      />
      <Piece vb={[0, 0, 120, 260]} style={{ left: cm(-8), top: cm(-2), width: cm(card ? 18 : 30) }}>
        <Floodlight u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 120, 260]}
        style={{ right: cm(-8), top: cm(-2), width: cm(card ? 18 : 30), scale: '-1 1' }}
      >
        <Floodlight u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 240, 90]}
        style={{ left: '50%', top: cm(card ? 4 : 7), width: cm(card ? 26 : 38), translate: '-50% 0' }}
      >
        <Scoreboard dd={dd} mm={mm} u={url} />
      </Piece>
      <Piece
        vb={[-50, -50, 100, 100]}
        anim="float"
        style={{
          left: '50%',
          bottom: card ? '4cqh' : '6.5cqh',
          width: cm(card ? 8 : 12),
          translate: '-50% 0',
        }}
      >
        <Ball u={url} />
      </Piece>
      <Piece
        vb={[0, 0, 120, 120]}
        style={{ left: cm(4), bottom: cm(card ? 4 : 30), width: cm(card ? 11 : 17), rotate: '-12deg' }}
      >
        <g filter={url('soft')}>
          <Jersey />
        </g>
      </Piece>
      <Piece vb={[0, 0, 60, 40]} style={{ right: cm(6), bottom: cm(card ? 4 : 32), width: cm(card ? 6 : 9) }}>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${6 + i * 18} 30l6-20h6l-6 20z`} fill={CHALK} opacity={0.35 + i * 0.15} />
        ))}
      </Piece>
    </>
  );
}
