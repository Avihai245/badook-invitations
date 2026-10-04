import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, PHOTO_TILES, SHADOW } from '../../theme';
import { Card, CheckIcon, clamp, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { ClockIcon, Ltr, money } from '../data';

const TASKS = [
  { text: 'לסגור אולם', due: 'הושלם', tone: 'done' },
  { text: 'לבחור צלם', due: 'בעוד 9 ימים', tone: 'soon' },
  { text: 'טעימות בקייטרינג', due: 'בעוד 3 שבועות', tone: 'later' },
  { text: 'לשלוח את ההזמנות', due: 'בעוד חודש', tone: 'later' },
  { text: 'להזמין DJ', due: 'בעוד 5 שבועות', tone: 'later' },
] as const;

const QUOTES = [
  { name: 'סטודיו אור', price: 8_500 },
  { name: 'רגעים', price: 7_200, best: true },
  { name: 'פלאש הפקות', price: 9_800 },
];

const IDEAS = [
  { label: 'פרחים', bg: PHOTO_TILES[3] },
  { label: 'שולחן כלה', bg: PHOTO_TILES[5] },
  { label: 'תאורה', bg: PHOTO_TILES[6] },
  { label: 'עוגה', bg: PHOTO_TILES[0] },
  { label: 'מזכרות', bg: PHOTO_TILES[4] },
];

/** Planning: tasks on a timeline, vendors with quotes, and an ideas board. */
export function TasksScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const tVendors = spoken('ספקים', -6);
  const tIdeas = spoken('ולוח רעיונות', -6);
  const tasksIn = sp(0, { damping: 16 });
  const row = (i: number) => sp(6 + i * 5, { damping: 16 });
  const vendorsIn = sp(tVendors, { damping: 16 });
  const quote = (i: number) => sp(tVendors + 6 + i * 5, { damping: 15 });
  const pick = interpolate(frame, [tVendors + 26, tVendors + 36], [0, 1], clamp);
  const board = sp(tIdeas, { damping: 16 });
  const idea = (i: number) => sp(tIdeas + 4 + i * 4, { damping: 12 });
  const tick = interpolate(frame, [spoken('לפי לוח זמנים', 0), spoken('לפי לוח זמנים', 12)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* tasks */}
      <Card
        style={{
          right: 0,
          top: 10,
          width: 560,
          height: 620,
          opacity: tasksIn,
          transform: `translateY(${(1 - tasksIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{
            position: 'absolute',
            top: 26,
            right: 30,
            left: 30,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>המשימות</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 20,
              fontWeight: 700,
              color: C.brandDeep,
              background: C.brandSoft,
              padding: '6px 14px',
              borderRadius: 999,
            }}
          >
            <ClockIcon size={22} color={C.brand} />
            לפי לוח הזמנים
          </div>
        </div>
        {TASKS.map((t, i) => {
          const p = row(i);
          const done = t.tone === 'done';
          const chip =
            t.tone === 'done'
              ? { c: C.success, bg: C.successBg }
              : t.tone === 'soon'
                ? { c: C.warning, bg: C.warningBg }
                : { c: C.muted, bg: C.subtle };
          return (
            <div
              key={t.text}
              style={{
                position: 'absolute',
                top: 96 + i * 102,
                right: 30,
                left: 30,
                height: 86,
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                borderTop: i ? `1px solid ${C.subtle}` : 'none',
                opacity: p,
                transform: `translateX(${(1 - p) * 60}px)`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: `2.5px solid ${done ? C.success : C.lineStrong}`,
                  background: done ? C.success : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {done ? <CheckIcon size={28} color="#fff" /> : null}
              </div>
              <div
                style={{
                  fontSize: 27,
                  fontWeight: 700,
                  color: done ? C.muted : C.ink,
                  textDecoration: done ? 'line-through' : 'none',
                }}
              >
                {t.text}
              </div>
              <div
                style={{
                  marginInlineStart: 'auto',
                  fontSize: 21,
                  fontWeight: 700,
                  color: chip.c,
                  background: chip.bg,
                  padding: '6px 14px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  boxShadow:
                    t.tone === 'soon'
                      ? `0 0 0 ${Math.sin(tick * Math.PI) * 6}px rgba(180,83,9,0.18)`
                      : 'none',
                }}
              >
                {t.due}
              </div>
            </div>
          );
        })}
      </Card>

      {/* vendors */}
      <Card
        style={{
          left: 0,
          top: 10,
          width: 410,
          height: 620,
          opacity: vendorsIn,
          transform: `translateY(${(1 - vendorsIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 26, right: 28, fontSize: 30, fontWeight: 800, color: C.ink }}
        >
          ספקים
        </div>
        <div
          style={{ position: 'absolute', top: 76, right: 28, fontSize: 21, fontWeight: 600, color: C.muted }}
        >
          צלם · <Ltr>3</Ltr> הצעות מחיר
        </div>
        {QUOTES.map((q, i) => {
          const p = quote(i);
          const on = !!q.best && pick > 0;
          return (
            <div
              key={q.name}
              style={{
                position: 'absolute',
                top: 130 + i * 150,
                right: 22,
                left: 22,
                height: 130,
                borderRadius: 20,
                border: `2px solid ${on ? C.brand : C.line}`,
                background: on ? C.brandSoft : C.surface,
                boxShadow: on ? `0 0 0 ${pick * 5}px rgba(160,112,63,0.15)` : 'none',
                padding: '18px 20px',
                opacity: p,
                transform: `translateY(${(1 - p) * 30}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>{q.name}</div>
                {q.best ? (
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: C.success,
                      background: C.successBg,
                      padding: '3px 10px',
                      borderRadius: 999,
                    }}
                  >
                    הכי משתלם
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
                <Ltr style={{ fontSize: 32, fontWeight: 800, color: C.brandDeep }}>{money(q.price)}</Ltr>
                {on ? (
                  <div
                    style={{
                      marginInlineStart: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 20,
                      fontWeight: 800,
                      color: '#fff',
                      background: C.brand,
                      padding: '6px 14px',
                      borderRadius: 999,
                      transform: `scale(${pick})`,
                    }}
                  >
                    <CheckIcon size={20} color="#fff" progress={pick} />
                    נבחר
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </Card>

      {/* ideas board */}
      <Card
        style={{
          left: 0,
          right: 0,
          top: 660,
          height: 320,
          opacity: board,
          transform: `translateY(${(1 - board) * 50}px)`,
          background: '#fbf7f1',
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 22, right: 30, fontSize: 28, fontWeight: 800, color: C.ink }}
        >
          לוח רעיונות
        </div>
        <div
          style={{
            position: 'absolute',
            top: 80,
            right: 26,
            left: 26,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {IDEAS.map((x, i) => {
            const p = idea(i);
            return (
              <div
                key={x.label}
                style={{
                  width: 172,
                  background: '#fff',
                  borderRadius: 16,
                  padding: 10,
                  boxShadow: SHADOW.md,
                  transform: `rotate(${((i % 3) - 1) * 3}deg) scale(${p})`,
                  opacity: Math.min(1, p * 1.4),
                }}
              >
                <div style={{ height: 140, borderRadius: 10, background: x.bg }} />
                <div
                  style={{ fontSize: 21, fontWeight: 700, color: C.ink, marginTop: 8, textAlign: 'center' }}
                >
                  {x.label}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
