import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../theme';
import { clamp, CheckIcon, SparkleIcon, MusicIcon, Pill, POSTERS, Poster, useSpringAt } from '../ui';

/** 4–9s: a gallery of animated invitation posters scrolling, one gets chosen. */
export function DesignScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const cardW = 290;
  const cardH = (cardW * 16) / 9;
  const gap = 28;
  // the scroll slows to a stop around frame 80
  const scroll = interpolate(frame, [0, 85], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const chosen = sp(88, { damping: 14 });
  const cols = [
    { x: 35, items: [0, 3, 6, 1], speed: 520, offset: -120 },
    { x: 35 + 320, items: [5, 1, 4, 7], speed: 760, offset: -380 },
    { x: 35 + 640, items: [2, 7, 0, 3], speed: 600, offset: -200 },
  ];
  const chosenCol = 1;
  const chosenIdx = 1; // POSTERS[1] in the middle column
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 40,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.55)',
          boxShadow: `${SHADOW.md}, inset 0 0 0 1px rgba(122,82,48,0.08)`,
        }}
      >
        {cols.map((col, ci) => {
          const y = col.offset - col.speed * (1 - scroll) + 0;
          return col.items.map((p, i) => {
            const isChosen = ci === chosenCol && i === chosenIdx;
            const top = y + i * (cardH + gap) + 40;
            const dim = isChosen ? 1 : 1 - chosen * 0.45;
            return (
              <div
                key={`${ci}-${i}`}
                style={{
                  position: 'absolute',
                  left: col.x,
                  top,
                  transform: `scale(${isChosen ? 1 + chosen * 0.06 : 1 - chosen * 0.03})`,
                  opacity: dim,
                  borderRadius: 22,
                  boxShadow: isChosen ? `0 0 0 ${chosen * 6}px ${C.brand}, ${SHADOW.lg}` : SHADOW.md,
                  zIndex: isChosen ? 5 : 1,
                }}
              >
                <Poster theme={POSTERS[p]} width={cardW} t={frame + i * 10} />
              </div>
            );
          });
        })}
        {/* fade edges */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(251,243,232,0.9) 0%, rgba(251,243,232,0) 12%, rgba(251,243,232,0) 88%, rgba(243,230,214,0.95) 100%)',
          }}
        />
      </div>
      {/* the chosen card's badges */}
      <div
        style={{
          position: 'absolute',
          left: cols[chosenCol].x + cardW / 2 - 28,
          top: -380 + (cardH + gap) * chosenIdx + 40 - 28,
          width: 56,
          height: 56,
          borderRadius: 999,
          background: C.brand,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${chosen})`,
          boxShadow: SHADOW.lg,
          zIndex: 10,
        }}
      >
        <CheckIcon size={34} color="#fff" progress={interpolate(frame, [96, 110], [0, 1], clamp)} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 18,
          zIndex: 10,
        }}
      >
        <Pill
          style={{
            fontSize: 28,
            padding: '14px 26px',
            boxShadow: SHADOW.lg,
            background: C.surface,
            transform: `translateY(${(1 - sp(20)) * 120}px)`,
            opacity: sp(20),
          }}
        >
          <MusicIcon size={28} color={C.brand} />
          <span>עם מוזיקה</span>
          <Equalizer frame={frame} />
        </Pill>
        <Pill
          style={{
            fontSize: 28,
            padding: '14px 26px',
            boxShadow: SHADOW.lg,
            background: C.surface,
            color: C.ink,
            transform: `translateY(${(1 - sp(30)) * 120}px)`,
            opacity: sp(30),
          }}
        >
          <SparkleIcon size={28} color={C.brand} />
          <span>עיצובים מונפשים</span>
        </Pill>
      </div>
    </div>
  );
}

function Equalizer({ frame }: { frame: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 26 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 5,
            borderRadius: 3,
            background: C.brand,
            height: 6 + 18 * Math.abs(Math.sin(frame / 4 + i * 1.3)),
          }}
        />
      ))}
    </div>
  );
}
