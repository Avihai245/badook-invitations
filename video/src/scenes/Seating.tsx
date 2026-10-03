import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../theme';
import { Avatar, Card, clamp, Cursor, keyframes, SparkleIcon, useSpringAt } from '../ui';

const TABLES = [
  { x: 280, y: 450, name: 'שולחן 1' },
  { x: 720, y: 450, name: 'שולחן 2' },
  { x: 280, y: 790, name: 'שולחן 3' },
  { x: 720, y: 790, name: 'שולחן 4' },
];
const SEATS = 6;
const SEAT_R = 128;
const COLORS = [
  '#a0703f',
  '#2a78d6',
  '#15803d',
  '#b45309',
  '#7a5230',
  '#9b3a3f',
  '#1f5a66',
  '#5a3a7a',
  '#c24d1f',
];
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';

const seatPos = (t: number, s: number) => {
  const a = ((-90 + s * (360 / SEATS)) * Math.PI) / 180;
  return { x: TABLES[t].x + SEAT_R * Math.cos(a), y: TABLES[t].y + SEAT_R * Math.sin(a) };
};

// waiting chips → target seats; the first two are dragged by hand, the rest by "סידור אוטומטי"
const PENDING: { t: number; s: number }[] = [
  { t: 0, s: 2 },
  { t: 1, s: 4 },
  { t: 0, s: 3 },
  { t: 1, s: 2 },
  { t: 2, s: 2 },
  { t: 3, s: 2 },
  { t: 0, s: 4 },
  { t: 1, s: 3 },
  { t: 2, s: 3 },
  { t: 3, s: 3 },
  { t: 2, s: 4 },
];
const CHIP = 54;
const trayPos = (i: number) => ({ x: 935 - i * 60, y: 112 });

/** 29–34s: guests dragged onto round tables, then "סידור אוטומטי" seats everyone. */
export function SeatingScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const inOut = Easing.inOut(Easing.cubic);

  const drag = (i: number, from: number, to: number) =>
    interpolate(frame, [from, to], [0, 1], { ...clamp, easing: inOut });
  const manual = [drag(0, 18, 46), drag(1, 56, 84)];
  const autoAt = (i: number) => 104 + (i - 2) * 3;
  const press = interpolate(frame, [96, 106], [0, 1], clamp);

  const chipState = (i: number) => {
    const from = trayPos(i);
    const to = seatPos(PENDING[i].t, PENDING[i].s);
    const p = i < 2 ? manual[i] : sp(autoAt(i), { damping: 14, stiffness: 120 });
    const lift = i < 2 ? Math.sin(Math.min(1, p) * Math.PI) : Math.sin(Math.min(1, p) * Math.PI) * 0.6;
    return {
      x: from.x + (to.x - from.x) * p,
      y: from.y + (to.y - from.y) * p - lift * (i < 2 ? 0 : 90),
      scale: 1 + lift * 0.18,
      landed: p > 0.97,
      moving: p > 0.01 && p < 0.97,
    };
  };

  const cursorX = keyframes(
    frame,
    [
      [0, 560],
      [14, 935],
      [18, 935],
      [46, seatPos(0, 2).x],
      [52, 875],
      [56, 875],
      [84, seatPos(1, 4).x],
      [94, 150],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 640],
      [14, 112],
      [18, 112],
      [46, seatPos(0, 2).y],
      [52, 112],
      [56, 112],
      [84, seatPos(1, 4).y],
      [94, 110],
    ],
    inOut,
  );
  const cursorPress =
    frame >= 14 && frame < 24
      ? interpolate(frame, [14, 24], [0, 1])
      : frame >= 52 && frame < 62
        ? interpolate(frame, [52, 62], [0, 1])
        : press > 0 && press < 1
          ? press
          : 0;
  const cursorOut = interpolate(frame, [110, 120], [1, 0], clamp);

  const seated = (t: number) => 2 + PENDING.filter((p, i) => p.t === t && chipState(i).landed).length;
  const floorIn = sp(4, { damping: 16 });
  const btnPulse = frame > 86 && frame < 96 ? 1 + 0.04 * Math.sin((frame - 86) / 1.6) : 1;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* tray */}
      <Card style={{ left: 0, right: 0, top: 0, height: 180, opacity: sp(0) }} radius={26}>
        <div
          style={{ position: 'absolute', top: 22, right: 32, fontSize: 26, fontWeight: 800, color: C.ink }}
        >
          ממתינים לשיבוץ{' '}
          <span style={{ color: C.muted, fontWeight: 600 }}>
            · {PENDING.filter((_, i) => !chipState(i).landed).length}
          </span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 22,
            top: 74,
            height: 76,
            padding: '0 26px',
            borderRadius: 18,
            background: `linear-gradient(90deg, ${C.brandDeep}, ${C.brand})`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 28,
            fontWeight: 800,
            boxShadow: '0 12px 26px rgba(122,82,48,0.3)',
            transform: `scale(${btnPulse * (1 - 0.07 * Math.sin(press * Math.PI))})`,
          }}
        >
          <SparkleIcon size={30} color="#fff" />
          סידור אוטומטי
        </div>
      </Card>

      {/* floor */}
      <Card
        style={{
          left: 0,
          right: 0,
          top: 210,
          bottom: 0,
          background: '#fffdf9',
          transform: `translateY(${(1 - floorIn) * 50}px)`,
          opacity: floorIn,
        }}
        radius={28}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(122,82,48,0.12) 1.6px, transparent 1.6px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 20,
            fontWeight: 700,
            color: C.brandDeep,
            background: C.brandSoft,
            padding: '6px 20px',
            borderRadius: 999,
          }}
        >
          רחבת ריקודים
        </div>
      </Card>
      {TABLES.map((t, ti) => {
        const full = seated(ti);
        const flash = interpolate(full, [4, 5], [0, 1], clamp);
        return (
          <div key={ti} style={{ position: 'absolute', left: 0, top: 0, opacity: floorIn }}>
            {Array.from({ length: SEATS }, (_, s) => {
              const p = seatPos(ti, s);
              return (
                <div
                  key={s}
                  style={{
                    position: 'absolute',
                    left: p.x - CHIP / 2,
                    top: p.y - CHIP / 2,
                    width: CHIP,
                    height: CHIP,
                    borderRadius: 99,
                    border: `2.5px dashed ${C.lineStrong}`,
                    background: 'rgba(255,255,255,0.7)',
                  }}
                />
              );
            })}
            <div
              style={{
                position: 'absolute',
                left: t.x - 80,
                top: t.y - 80,
                width: 160,
                height: 160,
                borderRadius: 999,
                background: C.surface,
                boxShadow: `${SHADOW.md}, 0 0 0 3px ${flash > 0 ? C.success : C.brandLine}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>{t.name}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: full >= 5 ? C.success : C.muted,
                  direction: 'ltr',
                }}
              >
                {full}/{SEATS}
              </div>
            </div>
            {/* already seated */}
            {[0, 1].map((s) => {
              const p = seatPos(ti, s === 0 ? 5 : 0);
              return (
                <Avatar
                  key={s}
                  label={LETTERS[(ti * 2 + s + 11) % LETTERS.length]}
                  color={COLORS[(ti * 2 + s + 3) % COLORS.length]}
                  size={CHIP}
                  style={{
                    position: 'absolute',
                    left: p.x - CHIP / 2,
                    top: p.y - CHIP / 2,
                    boxShadow: SHADOW.sm,
                    border: '3px solid #fff',
                  }}
                />
              );
            })}
          </div>
        );
      })}

      {/* pending chips (in the tray, flying, or seated) */}
      {PENDING.map((_, i) => {
        const s = chipState(i);
        return (
          <Avatar
            key={i}
            label={LETTERS[i % LETTERS.length]}
            color={COLORS[i % COLORS.length]}
            size={CHIP}
            style={{
              position: 'absolute',
              left: s.x - CHIP / 2,
              top: s.y - CHIP / 2,
              transform: `scale(${s.scale})`,
              border: '3px solid #fff',
              boxShadow: s.moving ? '0 18px 30px rgba(28,25,23,0.28)' : SHADOW.sm,
              zIndex: s.moving ? 20 : 2,
              opacity: sp(2 + i, { damping: 20 }),
            }}
          />
        );
      })}
      <div style={{ opacity: cursorOut }}>
        <Cursor x={cursorX} y={cursorY} pressed={cursorPress} />
      </div>
    </div>
  );
}
