import { Layer, Piece, r1, rng, type SceneProps } from './kit';

/**
 * Cloud Arch — hushed gallery-white minimalism: an arch-topped card lifted off a warm wall by a long
 * soft shadow, an inner hairline, a blind-embossed roundel at its crown, hairline rules and a sheet
 * of sand paper with a torn deckle edge peeking below. The bronze follows the accent.
 */
const BRONZE = 'var(--inv-accent, #8E6B4F)';
const SAND = '#DCD5CB';
const SAND_DEEP = '#C9BBA8';
const CARD = '#FAF9F6';

/** Half of the blind-embossed laurel ring in the roundel (viewBox 0 0 100 100, left side). */
const WREATH =
  'M47 76C30 72 22 58 24 42M24 42c-4-4-4-10 0-13 3 4 3 9 0 13M27 54c-6-1-9-6-8-11 5 1 8 6 8 11M33 65c-6 1-10-3-11-8 5-1 9 3 11 8M42 72c-4 4-10 4-12 0 4-3 9-3 12 0M24 31c0-5 3-9 8-9 0 5-3 9-8 9';

/** A strip whose bottom edge is torn deckle (viewBox 0 0 1000 30). */
function deckle(seed: number): string {
  const rand = rng(seed);
  let d = 'M0 0H1000';
  for (let x = 1000; x >= 0; x -= 7) d += `L${x} ${r1(15 + rand() * 9 + Math.sin(x / 41) * 3)}`;
  return `${d}Z`;
}

export default function CloudArch({ place }: SceneProps) {
  const card = place === 'card';
  // the arch card: as wide as the screen allows, never wider than it is tall
  const w = card ? 'min(70cqw, 74cqh)' : 'min(86cqw, 78cqh)';
  const top = card ? '8cqh' : '6.5cqh';
  const bottom = card ? '12cqh' : '10.5cqh';
  return (
    <>
      <Layer
        style={{
          background:
            'radial-gradient(90cqmin 70cqmin at 50% 0%, rgba(255,255,255,.7), rgba(255,255,255,0) 70%),' +
            'radial-gradient(120cqw 40cqh at 50% 100%, rgba(201,187,168,.25), transparent 70%)',
        }}
      />
      {/* the card: arch top, long soft shadow */}
      <Layer
        style={{
          inset: 'auto',
          left: '50%',
          top,
          bottom,
          width: w,
          translate: '-50% 0',
          borderRadius: '9999px 9999px 3px 3px',
          background: `linear-gradient(180deg, #FFFFFF 0%, ${CARD} 40%, #F6F4EF 100%)`,
          boxShadow:
            '0 1px 0 rgba(255,255,255,.9) inset, 0 40px 60px -34px rgba(70,52,36,.34), 0 12px 24px -16px rgba(70,52,36,.18)',
        }}
      >
        {/* inner hairline */}
        <div
          style={{
            position: 'absolute',
            inset: '2.6cqmin',
            borderRadius: '9999px 9999px 2px 2px',
            border: `1px solid ${SAND_DEEP}`,
            opacity: 0.75,
          }}
        />
        {/* embossed roundel at the crown */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: card ? '6cqmin' : 'min(8.5cqmin, 4.5cqh)',
            width: card ? '9cqmin' : 'min(14cqmin, 9cqh)',
            aspectRatio: '1',
            translate: '-50% 0',
            borderRadius: '50%',
            background: CARD,
            boxShadow:
              '-1.5px -1.5px 2px rgba(255,255,255,1) inset, 1.5px 2px 3px rgba(120,100,78,.28) inset, 0 1px 0 rgba(255,255,255,.8)',
          }}
        >
          <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <circle cx="50" cy="50" r="36" fill="none" style={{ stroke: BRONZE }} strokeWidth="1.2" opacity=".55" />
            {[1, -1].map((side) => (
              <g key={side} transform={side < 0 ? 'translate(100 0) scale(-1 1)' : undefined}>
                <g transform="translate(.9 .9)" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round">
                  <path d={WREATH} />
                </g>
                <g stroke={SAND_DEEP} strokeWidth="2.2" fill="none" strokeLinecap="round">
                  <path d={WREATH} />
                </g>
              </g>
            ))}
            <path d="M50 22l3 5-3 5-3-5z" style={{ fill: BRONZE }} opacity=".7" />
          </svg>
        </div>
        {/* the torn deckle edge the card ends in */}
        <svg
          viewBox="0 0 1000 30"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left: 0,
            bottom: card ? '-1.4cqmin' : '-1.8cqmin',
            width: '100%',
            height: card ? '2.6cqmin' : '3.2cqmin',
            overflow: 'visible',
            filter: 'drop-shadow(0 2px 2px rgba(70,52,36,.16))',
          }}
        >
          <path d={deckle(3)} fill="#F6F4EF" />
        </svg>
        {/* hairline rules with a bronze point, low on the card */}
        <svg
          viewBox="0 0 200 12"
          style={{ position: 'absolute', left: '50%', bottom: card ? '5cqmin' : '8cqmin', width: '46%', translate: '-50% 0', overflow: 'visible' }}
        >
          <path d="M0 6H86M114 6H200" stroke={SAND_DEEP} strokeWidth=".8" />
          <path d="M100 1.5 104.5 6 100 10.5 95.5 6Z" style={{ fill: BRONZE }} opacity=".8" />
        </svg>
      </Layer>
    </>
  );
}
