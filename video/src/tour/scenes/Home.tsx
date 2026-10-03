import type { CSSProperties, ReactNode } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { zoneOf } from '../../../../src/features/planning/model/gauge';
import { BudgetGauge, ZONE_BG, ZONE_COLOR } from '../../scenes/Budget';
import { C, SHADOW } from '../../theme';
import { Card, CheckIcon, clamp, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { EVENT, FlagIcon, HeartIcon, ListIcon, Ltr, money, UsersIcon } from '../data';

const STAGES = [
  { label: 'מתכננים', sub: 'תקציב, משימות וספקים', word: 'מתכננים', Icon: ListIcon },
  { label: 'מזמינים', sub: 'הזמנה ואישורי הגעה', word: 'מזמינים', Icon: UsersIcon },
  { label: 'מסדרים', sub: 'הושבה והכנות אחרונות', word: 'מסדרים', Icon: FlagIcon },
  { label: 'חוגגים', sub: 'יום האירוע ואחריו', word: 'וחוגגים', Icon: HeartIcon },
];

const BUDGET_USED = 0.56;
const RSVP = { coming: 96, declined: 9 };
const TASKS = { done: 12, all: 30 };

/** The event's home: countdown, next step, budget gauge, RSVP ring, tasks, and the four-stage road. */
export function HomeScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const out = Easing.out(Easing.cubic);

  // focus: each card lights up when the voice names it
  const focusAt = [
    spoken('ספירה לאחור'),
    spoken('הצעד הבא'),
    spoken('מד התקציב'),
    spoken('אישורי ההגעה'),
    spoken('והמשימות'),
  ];
  const stageAt = STAGES.map((s) => spoken(s.word, -4));
  const roadStart = spoken('והכול מסודר', -6);
  const focus = (i: number) => {
    const from = focusAt[i];
    const to = i + 1 < focusAt.length ? focusAt[i + 1] : roadStart;
    return interpolate(frame, [from - 4, from + 6, to - 2, to + 8], [0, 1, 1, 0], clamp);
  };
  const glow = (f: number): CSSProperties => ({
    boxShadow: `${SHADOW.md}, 0 0 0 ${f * 5}px rgba(160,112,63,${0.35 * f})`,
    transform: `scale(${1 + 0.025 * f})`,
  });
  const pop = (i: number) => sp(4 + i * 4, { damping: 16 });
  const popStyle = (i: number): CSSProperties => ({
    opacity: pop(i),
    translate: `0 ${(1 - pop(i)) * 40}px`,
  });

  const fill = interpolate(frame, [10, 50], [0, 1], { ...clamp, easing: out });
  const value = BUDGET_USED * fill;
  const zone = zoneOf(value);
  const coming = Math.round(RSVP.coming * fill);
  const minutes = 42 - (frame > 150 ? 1 : 0);

  // the road: the current stage moves along as the voice names them
  const roadP = keyframes4(frame, stageAt);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* header + countdown */}
      <Card
        style={{ left: 0, top: 10, width: 750, height: 200, ...popStyle(0), ...glow(focus(0)) }}
        radius={26}
      >
        <div style={{ position: 'absolute', top: 34, right: 34 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.muted }}>החתונה של</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: C.ink, lineHeight: 1.15 }}>{EVENT.couple}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.brandDeep, marginTop: 6 }}>
            <Ltr>{EVENT.date}</Ltr> · {EVENT.venue}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 36, left: 30, display: 'flex', gap: 12 }}>
          {[
            { v: EVENT.daysLeft, l: 'ימים' },
            { v: 6, l: 'שעות' },
            { v: minutes, l: 'דקות' },
          ].map((b) => (
            <div
              key={b.l}
              style={{
                width: 98,
                height: 128,
                borderRadius: 18,
                background: C.brandSoft,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: 50, fontWeight: 800, color: C.brandDeep, lineHeight: 1 }}>
                {String(Math.round(b.v * Math.min(1, fill * 1.2))).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.brand, marginTop: 6 }}>{b.l}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* the next step */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 232,
          width: 750,
          height: 150,
          borderRadius: 26,
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: `2px solid #bbf7d0`,
          ...popStyle(1),
          ...glow(focus(1)),
        }}
      >
        <div style={{ position: 'absolute', top: 26, right: 30 }}>
          <div
            style={{
              display: 'inline-block',
              fontSize: 20,
              fontWeight: 800,
              color: '#fff',
              background: C.success,
              padding: '4px 14px',
              borderRadius: 999,
            }}
          >
            הצעד הבא
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#14532d', marginTop: 12 }}>
            לבחור צלם · 3 הצעות מחכות
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 44,
            height: 62,
            padding: '0 30px',
            borderRadius: 16,
            background: C.success,
            color: '#fff',
            fontSize: 26,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 10px 24px rgba(21,128,61,0.3)',
          }}
        >
          לבחירה
        </div>
      </div>

      {/* budget */}
      <Card
        style={{ left: 385, width: 365, top: 404, height: 300, ...popStyle(2), ...glow(focus(2)) }}
        radius={26}
      >
        <Title>מד התקציב</Title>
        <BudgetGauge
          value={value}
          ghost={0.8}
          displayWidth={250}
          labels={false}
          style={{ position: 'absolute', top: 78, left: (365 - 250) / 2 }}
        />
        <div style={{ position: 'absolute', top: 222, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
            <Ltr>{Math.round(value * 100)}%</Ltr>
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 8,
              fontSize: 18,
              fontWeight: 700,
              color: ZONE_COLOR[zone],
              background: ZONE_BG[zone],
              padding: '3px 12px',
              borderRadius: 999,
            }}
          >
            נשארו <Ltr>{money(EVENT.budget * (1 - value))}</Ltr>
          </div>
        </div>
      </Card>

      {/* RSVP ring */}
      <Card
        style={{ left: 0, top: 404, width: 365, height: 300, ...popStyle(3), ...glow(focus(3)) }}
        radius={26}
      >
        <Title>אישורי הגעה</Title>
        <Ring coming={coming} declined={Math.round(RSVP.declined * fill)} total={EVENT.guests} />
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            fontSize: 18,
            fontWeight: 700,
            color: C.muted,
          }}
        >
          <span style={{ color: C.success }}>
            <Ltr>{coming}</Ltr> מגיעים
          </span>
          <span style={{ color: C.danger }}>
            <Ltr>{Math.round(RSVP.declined * fill)}</Ltr> לא
          </span>
          <span>
            <Ltr>{EVENT.guests - coming - Math.round(RSVP.declined * fill)}</Ltr> ממתינים
          </span>
        </div>
      </Card>

      {/* tasks */}
      <Card
        style={{ left: 0, top: 726, width: 750, height: 190, ...popStyle(4), ...glow(focus(4)) }}
        radius={26}
      >
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 30,
            left: 30,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 800, color: C.ink }}>המשימות</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.brandDeep }}>
            <Ltr>{Math.round(TASKS.done * fill)}</Ltr> מתוך <Ltr>{TASKS.all}</Ltr> הושלמו
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 84,
            right: 30,
            left: 30,
            height: 14,
            borderRadius: 99,
            background: C.subtle,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: `${(TASKS.done / TASKS.all) * 100 * fill}%`,
              background: C.brand,
              borderRadius: 99,
            }}
          />
        </div>
        <div style={{ position: 'absolute', top: 120, right: 30, display: 'flex', gap: 12 }}>
          {[
            { t: 'לבחור צלם', d: 'בעוד 9 ימים', c: C.warning, bg: C.warningBg },
            { t: 'טעימות בקייטרינג', d: 'בעוד 3 שבועות', c: C.muted, bg: C.subtle },
          ].map((x) => (
            <div
              key={x.t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 20,
                fontWeight: 700,
                color: C.ink,
                border: `1.5px solid ${C.line}`,
                borderRadius: 999,
                padding: '6px 8px 6px 16px',
              }}
            >
              <span style={{ paddingInlineStart: 6 }}>{x.t}</span>
              <span style={{ color: x.c, background: x.bg, padding: '2px 10px', borderRadius: 999 }}>
                {x.d}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* the four stages */}
      <Card style={{ left: 772, top: 10, width: 228, height: 906, ...popStyle(0) }} radius={26}>
        <div
          style={{ position: 'absolute', top: 28, right: 26, fontSize: 24, fontWeight: 800, color: C.ink }}
        >
          הדרך שלכם
        </div>
        {/* the road */}
        <div
          style={{
            position: 'absolute',
            top: 146,
            height: 3 * 200,
            right: 22 + 28 - 3,
            width: 6,
            borderRadius: 6,
            background: `repeating-linear-gradient(180deg, ${C.brandLine} 0 14px, transparent 14px 24px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 146,
            height: Math.max(0, roadP) * 200,
            right: 22 + 28 - 3,
            width: 6,
            borderRadius: 6,
            background: C.brand,
          }}
        />
        {STAGES.map((s, i) => {
          const lit = interpolate(frame, [stageAt[i] - 4, stageAt[i] + 8], [0, 1], clamp);
          const current = i === 0 && frame < stageAt[0] - 4 ? 1 : lit;
          const done = i < Math.floor(roadP + 0.001) ? 1 : 0;
          const active = Math.max(current, done);
          return (
            <div
              key={s.label}
              style={{
                position: 'absolute',
                top: 118 + i * 200,
                right: 22,
                left: 10,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  flexShrink: 0,
                  borderRadius: 999,
                  background: active > 0.5 ? C.brand : C.surface,
                  border: `3px solid ${active > 0.02 ? C.brand : C.lineStrong}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${1 + 0.15 * Math.sin(lit * Math.PI)})`,
                  boxShadow:
                    lit > 0 && lit < 1 ? `0 0 0 ${lit * 10}px rgba(160,112,63,${0.25 * (1 - lit)})` : 'none',
                }}
              >
                {done ? (
                  <CheckIcon size={30} color="#fff" />
                ) : (
                  <s.Icon size={28} color={active > 0.5 ? '#fff' : C.muted} />
                )}
              </div>
              <div style={{ paddingTop: 6 }}>
                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    color: active > 0.5 ? C.brandDeep : C.ink,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 17, fontWeight: 500, color: C.muted, lineHeight: 1.3, marginTop: 4 }}>
                  {s.sub}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/** 0 before the first time, then i + p between the i-th and the next (eased). */
function keyframes4(frame: number, at: number[]) {
  let v = 0;
  for (let i = 1; i < at.length; i++) {
    v += interpolate(frame, [at[i] - 6, at[i] + 6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  }
  return v;
}

function Title({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: 24, right: 28, fontSize: 26, fontWeight: 800, color: C.ink }}>
      {children}
    </div>
  );
}

function Ring({ coming, declined, total }: { coming: number; declined: number; total: number }) {
  const R = 62;
  const SW = 20;
  const circ = 2 * Math.PI * R;
  const seg = (v: number, offset: number, color: string) => (
    <circle
      cx={90}
      cy={90}
      r={R}
      fill="none"
      stroke={color}
      strokeWidth={SW}
      strokeDasharray={`${(v / total) * circ} ${circ}`}
      strokeDashoffset={-(offset / total) * circ}
      transform="rotate(-90 90 90)"
    />
  );
  return (
    <div style={{ position: 'absolute', top: 62, left: (365 - 180) / 2, width: 180, height: 180 }}>
      <svg width={180} height={180}>
        <circle cx={90} cy={90} r={R} fill="none" stroke="#e7e5e4" strokeWidth={SW} />
        {seg(declined, coming, C.danger)}
        {seg(coming, 0, C.success)}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{coming}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.muted }}>
          מתוך <Ltr>{total}</Ltr>
        </div>
      </div>
    </div>
  );
}
