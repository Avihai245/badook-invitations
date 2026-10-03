import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../theme';
import {
  Card,
  clamp,
  Cursor,
  keyframes,
  Phone,
  POSTERS,
  Poster,
  retype,
  SparkleIcon,
  useSpringAt,
} from '../ui';

/** 9–14s: names and date change live on the phone; "עצבו לי מהתמונות" restyles the invitation. */
export function EditScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();

  const names = retype('דנה & יואב', 'נועה & איתי', frame, 18, 0.75);
  const date = retype('12.06.2027', '04.09.2027', frame, 62, 0.9);
  const namesActive = frame >= 14 && frame < 60;
  const dateActive = frame >= 58 && frame < 92;
  const caret = Math.floor(frame / 8) % 2 === 0;

  // the AI chip: appears, gets clicked, restyles
  const chipIn = sp(80, { damping: 13 });
  const click = interpolate(frame, [104, 118], [0, 1], clamp);
  const restyle = interpolate(frame, [110, 132], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const working = frame >= 106 && frame < 132;
  const shimmer = interpolate(frame, [108, 134], [-1, 2], clamp);

  // cursor path: names field → date field → chip
  const cx = keyframes(
    frame,
    [
      [0, 520],
      [12, 300],
      [56, 300],
      [66, 260],
      [92, 260],
      [102, 250],
    ],
    Easing.inOut(Easing.cubic),
  );
  const cy = keyframes(
    frame,
    [
      [0, 900],
      [12, 330],
      [56, 330],
      [66, 480],
      [92, 480],
      [102, 812],
    ],
    Easing.inOut(Easing.cubic),
  );
  const press =
    frame >= 104 && frame < 120
      ? interpolate(frame, [104, 120], [0, 1])
      : frame >= 14 && frame < 26
        ? interpolate(frame, [14, 26], [0, 1])
        : frame >= 58 && frame < 70
          ? interpolate(frame, [58, 70], [0, 1])
          : 0;

  const before = POSTERS[0];
  const after = POSTERS[5];
  const phoneW = 400;
  const posterW = phoneW * 0.93;

  const field = (label: string, value: string, active: boolean, y: number, ltr = false) => (
    <div style={{ position: 'absolute', top: y, left: 36, right: 36 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.muted, marginBottom: 10 }}>{label}</div>
      <div
        style={{
          height: 72,
          borderRadius: 14,
          border: `2px solid ${active ? C.brand : C.line}`,
          boxShadow: active ? `0 0 0 5px rgba(160,112,63,0.15)` : 'none',
          background: C.surface,
          display: 'flex',
          alignItems: 'center',
          padding: '0 22px',
          fontSize: 32,
          fontWeight: 700,
          color: C.ink,
          direction: ltr ? 'ltr' : 'rtl',
          justifyContent: ltr ? 'flex-end' : 'flex-start',
        }}
      >
        <span>{value}</span>
        {active ? (
          <span
            style={{ width: 3, height: 36, background: C.brand, marginInline: 3, opacity: caret ? 1 : 0 }}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* editor panel */}
      <Card
        style={{
          left: 0,
          top: 170,
          width: 480,
          height: 560,
          transform: `translateX(${(1 - sp(4)) * -80}px)`,
          opacity: sp(4),
        }}
        radius={28}
      >
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 36,
            right: 36,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>עריכת ההזמנה</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 20,
              fontWeight: 700,
              color: C.success,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 99, background: C.success }} />
            נשמר
          </div>
        </div>
        {field('השמות', names.text, namesActive, 120)}
        {field('התאריך', date.text, dateActive, 270, true)}
        {field('המקום', 'גני הדר, רחובות', false, 420)}
      </Card>

      {/* the AI chip */}
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 775,
          transform: `scale(${chipIn * (1 - 0.06 * Math.sin(click * Math.PI))})`,
          transformOrigin: 'center',
          opacity: chipIn,
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '20px 32px',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${C.brandDeep}, ${C.brand})`,
            color: '#fff',
            fontSize: 32,
            fontWeight: 800,
            boxShadow: '0 16px 36px rgba(122,82,48,0.35)',
          }}
        >
          <SparkleIcon size={34} color="#fff" />
          {working ? 'מעצבים…' : 'עצבו לי מהתמונות'}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 120,
              left: `${shimmer * 100}%`,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))',
            }}
          />
        </div>
      </div>

      {/* the phone */}
      <Phone width={phoneW} style={{ left: 560, top: 90, transform: `translateY(${(1 - sp(0)) * 80}px)` }}>
        <div style={{ position: 'absolute', inset: 0, background: '#0d0c0b' }} />
        <div style={{ position: 'absolute', top: 18, left: (phoneW * 0.93 - posterW) / 2 }}>
          <Poster
            theme={before}
            width={posterW}
            names={names.text || ' '}
            date={date.text || ' '}
            t={frame}
          />
          <div style={{ position: 'absolute', inset: 0, opacity: restyle }}>
            <Poster
              theme={after}
              width={posterW}
              names={names.text || ' '}
              date={date.text || ' '}
              t={frame}
            />
          </div>
          {/* sweep of light while restyling */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 20,
              background: `linear-gradient(115deg, rgba(255,255,255,0) ${shimmer * 60 - 20}%, rgba(255,255,255,0.55) ${shimmer * 60}%, rgba(255,255,255,0) ${shimmer * 60 + 20}%)`,
              opacity: working ? 1 : 0,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 22,
            right: 22,
            bottom: 34,
            height: 64,
            borderRadius: 16,
            background: restyle > 0.5 ? C.brandDeep : '#e9c58b',
            color: restyle > 0.5 ? '#fff' : '#1d2b4f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          אישור הגעה
        </div>
        {/* sparkles on restyle */}
        {[0, 1, 2, 3, 4].map((i) => {
          const p = interpolate(frame, [112 + i * 3, 130 + i * 3], [0, 1], clamp);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 40 + ((i * 71) % 300),
                top: 120 + ((i * 137) % 520),
                opacity: Math.sin(p * Math.PI),
                transform: `scale(${0.5 + p})`,
              }}
            >
              <SparkleIcon size={40} color="#fff" />
            </div>
          );
        })}
      </Phone>
      <div
        style={{
          position: 'absolute',
          left: 600,
          top: 30,
          fontSize: 22,
          fontWeight: 700,
          color: C.brandDeep,
          background: C.surface,
          padding: '8px 18px',
          borderRadius: 999,
          boxShadow: SHADOW.md,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: sp(10),
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 99,
            background: '#ef4444',
            opacity: 0.5 + 0.5 * Math.sin(frame / 4),
          }}
        />
        תצוגה חיה
      </div>
      <Cursor x={cx} y={cy} pressed={press} />
    </div>
  );
}
