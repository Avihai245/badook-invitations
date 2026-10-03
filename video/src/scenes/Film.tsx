import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, PHOTO_TILES, SHADOW } from '../theme';
import { Card, clamp, PlayIcon, useSpringAt } from '../ui';

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const RSVPS = [38, 52, 24, 17, 12, 22, 9];

const STATS = [
  { v: '96%', l: 'הגיעו מתוך המאשרים' },
  { v: '318', l: 'תמונות בגלריה' },
];

/** 39–43s: the moments film strip and a small insights chart. */
export function FilmScene({ stats = STATS }: { stats?: { v: string; l: string }[] } = {}) {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const frameW = 230;
  const gap = 18;
  const shift = frame * 3.2;
  const stripIn = sp(0, { damping: 16 });
  const chartIn = sp(14, { damping: 16 });
  const max = Math.max(...RSVPS);
  const progress = interpolate(frame, [10, 120], [0.08, 0.72], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the film strip */}
      <div
        style={{
          position: 'absolute',
          left: -40,
          right: -40,
          top: 50,
          height: 300,
          background: '#1a1715',
          borderRadius: 20,
          boxShadow: SHADOW.xl,
          overflow: 'hidden',
          transform: `rotate(-3deg) scale(${0.9 + 0.1 * stripIn})`,
          opacity: stripIn,
        }}
      >
        {[14, 300 - 34].map((top) => (
          <div key={top} style={{ position: 'absolute', top, left: 0, right: 0, height: 20 }}>
            {Array.from({ length: 34 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: ((((i * 36 - shift) % 1224) + 1224) % 1224) - 40,
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  background: '#f3e6d6',
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        ))}
        {Array.from({ length: 7 }, (_, i) => {
          const x =
            ((((i * (frameW + gap) - shift) % (7 * (frameW + gap))) + 7 * (frameW + gap)) %
              (7 * (frameW + gap))) -
            frameW;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 50,
                left: x,
                width: frameW,
                height: 200,
                borderRadius: 10,
                background: PHOTO_TILES[(i * 2 + 1) % PHOTO_TILES.length],
              }}
            />
          );
        })}
      </div>
      {/* play badge + title */}
      <div
        style={{
          position: 'absolute',
          left: 500 - 60,
          top: 140,
          width: 120,
          height: 120,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: SHADOW.lg,
          transform: `scale(${sp(8, { damping: 11 })})`,
        }}
      >
        <div style={{ marginLeft: 8 }}>
          <PlayIcon size={56} color={C.brand} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 380,
          left: 60,
          right: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          opacity: stripIn,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, whiteSpace: 'nowrap' }}>סרט הרגעים</div>
        <div
          style={{
            flex: 1,
            height: 10,
            borderRadius: 99,
            background: 'rgba(122,82,48,0.15)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              marginInlineStart: 0,
              width: `${progress * 100}%`,
              height: '100%',
              background: C.brand,
              borderRadius: 99,
            }}
          />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.muted, direction: 'ltr' }}>
          0:{String(Math.floor(progress * 72)).padStart(2, '0')} / 1:12
        </div>
      </div>

      {/* insights */}
      <Card
        style={{
          left: 60,
          right: 60,
          top: 460,
          bottom: 20,
          opacity: chartIn,
          transform: `translateY(${(1 - chartIn) * 60}px)`,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 26, right: 34, fontSize: 30, fontWeight: 800, color: C.ink }}
        >
          תובנות
        </div>
        <div
          style={{ position: 'absolute', top: 34, left: 34, fontSize: 20, fontWeight: 600, color: C.muted }}
        >
          אישורי הגעה לפי יום
        </div>
        <div
          style={{
            position: 'absolute',
            right: 34,
            top: 100,
            width: 230,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {stats.map((s, i) => {
            const p = sp(24 + i * 8);
            return (
              <div
                key={s.l}
                style={{
                  background: C.brandSoft,
                  borderRadius: 20,
                  padding: '18px 22px',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 20}px)`,
                }}
              >
                <div style={{ fontSize: 50, fontWeight: 800, color: C.brandDeep, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginTop: 6 }}>{s.l}</div>
              </div>
            );
          })}
        </div>
        {/* bars (RTL: first day on the right) */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            right: 300,
            top: 100,
            bottom: 70,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 22,
            borderBottom: `2px solid ${C.line}`,
          }}
        >
          {RSVPS.map((v, i) => {
            const p = interpolate(frame, [20 + i * 4, 44 + i * 4], [0, 1], {
              ...clamp,
              easing: Easing.out(Easing.cubic),
            });
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: C.muted, opacity: p, marginBottom: 6 }}>
                  {v}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: `${(v / max) * 82 * p}%`,
                    borderRadius: '10px 10px 4px 4px',
                    background: i === 1 ? C.brand : '#d9bf9f',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', left: 40, right: 300, bottom: 30, display: 'flex', gap: 22 }}>
          {DAYS.map((d) => (
            <div
              key={d}
              style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 600, color: C.muted }}
            >
              {d}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
