import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../../theme';
import { Card, CheckIcon, clamp, Cursor, keyframes, POSTERS, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { CalendarIcon, ClockIcon, EVENT, Ltr, money, UsersIcon, WalletIcon } from '../data';

const TYPES = [
  { label: 'חתונה', bg: POSTERS[1].bg },
  { label: 'בר מצווה', bg: POSTERS[2].bg },
  { label: 'בת מצווה', bg: POSTERS[6].bg },
  { label: 'ברית', bg: POSTERS[4].bg },
  { label: 'חינה', bg: POSTERS[3].bg },
  { label: 'יום הולדת', bg: POSTERS[0].bg },
];

const CHOICES = [
  { title: 'מתכננים', sub: 'תקציב, משימות וספקים' },
  { title: 'מעצבים את ההזמנה', sub: 'בוחרים עיצוב ושולחים לאורחים' },
  { title: 'הכול', sub: 'תכנון והזמנה, צעד אחר צעד', badge: 'מומלץ' },
];

const CARD = { left: 90, top: 30, width: 820, height: 940 };
const PAD = 48;
const INNER = CARD.width - PAD * 2;

/** The new-event wizard: event type → date, guests, budget → where to start → ready. */
export function StartScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const inOut = Easing.inOut(Easing.cubic);

  const tTile = spoken('בוחרים את סוג', 14);
  const tScreen2 = spoken('מוסיפים תאריך', -6);
  const tDate = spoken('תאריך', 0);
  const tGuests = spoken('מספר אורחים', -2);
  const tBudget = spoken('ותקציב', -2);
  const tScreen3 = spoken('ובוחרים מאיפה', -8);
  const tChoice = spoken('ובוחרים מאיפה', 22);
  const tDone = spoken('פחות מדקה', -6);

  // which screen: 0 → 1 → 2 (RTL: the next one comes in from the left)
  const pos = keyframes(
    frame,
    [
      [tScreen2 - 10, 0],
      [tScreen2 + 4, 1],
      [tScreen3 - 10, 1],
      [tScreen3 + 4, 2],
    ],
    inOut,
  );
  const step = Math.min(2, Math.round(pos));
  const done = sp(tDone, { damping: 16 });
  const cardIn = sp(0, { damping: 16 });

  const pick = interpolate(frame, [tTile, tTile + 10], [0, 1], clamp);
  const chosen = interpolate(frame, [tChoice, tChoice + 10], [0, 1], clamp);

  const typed = (text: string, at: number, speed = 0.8) => {
    const chars = Array.from(text);
    return chars.slice(0, Math.max(0, Math.floor((frame - at) * speed))).join('');
  };

  // the hand: the "wedding" tile → "המשך" → "המשך" → "הכול"
  const btnY = CARD.top + CARD.height - PAD - 40;
  const cx = keyframes(
    frame,
    [
      [0, 700],
      [tTile - 12, 760],
      [tScreen2 - 22, 760],
      [tScreen2 - 12, 430],
      [tScreen3 - 22, 430],
      [tScreen3 - 12, 440],
      [tChoice - 14, 470],
    ],
    inOut,
  );
  const cy = keyframes(
    frame,
    [
      [0, 900],
      [tTile - 12, 380],
      [tScreen2 - 22, 380],
      [tScreen2 - 12, btnY],
      [tScreen3 - 22, btnY],
      [tScreen3 - 12, btnY],
      [tChoice - 14, 640],
    ],
    inOut,
  );
  const press = (at: number) =>
    frame >= at && frame < at + 14 ? interpolate(frame, [at, at + 14], [0, 1]) : 0;
  const pressed = Math.max(press(tTile), press(tScreen2 - 12), press(tScreen3 - 12), press(tChoice));
  const cursorOpacity = interpolate(frame, [tDone - 6, tDone + 4], [1, 0], clamp);

  const screen = (i: number) => ({
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: INNER,
    height: '100%',
    transform: `translateX(${(pos - i) * INNER * 1.15}px)`,
    opacity: interpolate(Math.abs(pos - i), [0, 0.9], [1, 0], clamp),
  });

  const heading = (title: string, sub: string) => (
    <div style={{ marginBottom: 34 }}>
      <div style={{ fontSize: 44, fontWeight: 800, color: C.ink, letterSpacing: -0.5 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: C.muted, marginTop: 6 }}>{sub}</div>
    </div>
  );

  const field = (label: string, icon: React.ReactNode, value: string, active: boolean, hint?: string) => (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginBottom: 10 }}>{label}</div>
      <div
        style={{
          height: 84,
          borderRadius: 18,
          border: `2px solid ${active ? C.brand : C.line}`,
          boxShadow: active ? '0 0 0 6px rgba(160,112,63,0.14)' : 'none',
          background: C.surface,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
        }}
      >
        <div style={{ color: C.brand, display: 'flex' }}>{icon}</div>
        <Ltr style={{ fontSize: 34, fontWeight: 700, color: C.ink }}>{value}</Ltr>
        {active ? (
          <div
            style={{
              width: 3,
              height: 38,
              background: C.brand,
              opacity: Math.floor(frame / 8) % 2 ? 0 : 1,
            }}
          />
        ) : null}
        {hint ? (
          <div style={{ marginInlineStart: 'auto', fontSize: 20, fontWeight: 600, color: C.faint }}>
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );

  const dateText = typed(EVENT.date, tDate, 0.9);
  const guestsText = typed(String(EVENT.guests), tGuests, 0.5);
  const budgetText = typed(money(EVENT.budget), tBudget, 0.7);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card
        style={{
          ...CARD,
          transform: `translateY(${(1 - cardIn) * 60}px)`,
          opacity: cardIn,
          boxShadow: `${SHADOW.lg}, 0 0 0 1px rgba(122,82,48,0.06)`,
        }}
        radius={28}
      >
        {/* header: title + the three steps */}
        <div
          style={{
            position: 'absolute',
            top: 34,
            left: PAD,
            right: PAD,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: 1 - done,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 800, color: C.brandDeep }}>אירוע חדש</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: C.muted }}>
              שלב <Ltr>{step + 1}</Ltr> מתוך <Ltr>3</Ltr>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 56,
                    height: 10,
                    borderRadius: 99,
                    background: C.subtle,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: `${Math.max(0, Math.min(1, pos + 1 - i)) * 100}%`,
                      background: C.brand,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 110,
            bottom: 150,
            left: PAD,
            right: PAD,
            overflow: 'hidden',
            opacity: 1 - done,
          }}
        >
          {/* 1: event type */}
          <div style={screen(0)}>
            {heading('מה חוגגים?', 'בוחרים את סוג האירוע')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              {TYPES.map((t, i) => {
                const on = i === 0 && pick > 0;
                const tileIn = sp(4 + i * 3, { damping: 15 });
                return (
                  <div
                    key={t.label}
                    style={{
                      position: 'relative',
                      height: 200,
                      borderRadius: 22,
                      border: `2px solid ${on ? C.brand : C.line}`,
                      background: on ? C.brandSoft : C.surface,
                      boxShadow: on ? `0 0 0 ${pick * 6}px rgba(160,112,63,0.16)` : SHADOW.sm,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 16,
                      opacity: tileIn,
                      transform: `scale(${(0.85 + 0.15 * tileIn) * (on ? 1 + 0.04 * Math.sin(pick * Math.PI) : 1)})`,
                    }}
                  >
                    <div
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 999,
                        background: t.bg,
                        boxShadow: SHADOW.md,
                      }}
                    />
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>{t.label}</div>
                    {on ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: 12,
                          left: 12,
                          width: 40,
                          height: 40,
                          borderRadius: 99,
                          background: C.brand,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: `scale(${pick})`,
                        }}
                      >
                        <CheckIcon size={26} color="#fff" progress={pick} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2: date, guests, budget */}
          <div style={screen(1)}>
            {heading('הפרטים הבסיסיים', 'אפשר לשנות הכול אחר כך')}
            {field(
              'תאריך האירוע',
              <CalendarIcon size={32} />,
              dateText,
              frame >= tDate - 4 && frame < tGuests - 4,
            )}
            {field(
              'כמה אורחים, בערך?',
              <UsersIcon size={32} />,
              guestsText,
              frame >= tGuests - 4 && frame < tBudget - 4,
              'הערכה',
            )}
            {field('תקציב', <WalletIcon size={32} />, budgetText, frame >= tBudget - 4 && frame < tScreen3)}
          </div>

          {/* 3: where to start */}
          <div style={screen(2)}>
            {heading('מאיפה מתחילים?', 'אפשר לעבור ביניהם בכל רגע')}
            {CHOICES.map((c, i) => {
              const on = i === 2 && chosen > 0;
              return (
                <div
                  key={c.title}
                  style={{
                    position: 'relative',
                    height: 136,
                    marginBottom: 18,
                    borderRadius: 22,
                    border: `2px solid ${on ? C.brand : C.line}`,
                    background: on ? C.brandSoft : C.surface,
                    boxShadow: on ? `0 0 0 ${chosen * 6}px rgba(160,112,63,0.16)` : SHADOW.sm,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    padding: '0 30px',
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 99,
                      border: `3px solid ${on ? C.brand : C.lineStrong}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 99,
                        background: C.brand,
                        transform: `scale(${on ? chosen : 0})`,
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ fontSize: 32, fontWeight: 800, color: C.ink }}>{c.title}</div>
                      {c.badge ? (
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: '#fff',
                            background: C.brand,
                            padding: '4px 14px',
                            borderRadius: 999,
                          }}
                        >
                          {c.badge}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 23, fontWeight: 500, color: C.muted, marginTop: 4 }}>{c.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* the button */}
        <div
          style={{
            position: 'absolute',
            left: PAD,
            right: PAD,
            bottom: PAD,
            height: 84,
            borderRadius: 18,
            background: `linear-gradient(180deg, ${C.brand} 0%, ${C.brandDeep} 100%)`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 800,
            boxShadow: '0 14px 30px rgba(122,82,48,0.3)',
            opacity: 1 - done,
          }}
        >
          {step < 2 ? 'המשך' : 'יוצאים לדרך'}
        </div>

        {/* ready */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: done,
            transform: `scale(${0.9 + 0.1 * done})`,
          }}
        >
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 999,
              background: C.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(21,128,61,0.3)',
            }}
          >
            <CheckIcon
              size={92}
              color="#fff"
              stroke={3}
              progress={interpolate(frame, [tDone + 4, tDone + 18], [0, 1], clamp)}
            />
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, color: C.ink, marginTop: 40 }}>האירוע מוכן!</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.brandDeep, marginTop: 14 }}>
            החתונה של {EVENT.couple}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 14,
              marginTop: 30,
              fontSize: 24,
              fontWeight: 700,
              color: C.ink,
            }}
          >
            {[
              <Ltr key="d">{EVENT.date}</Ltr>,
              <span key="g">
                <Ltr>{EVENT.guests}</Ltr> אורחים
              </span>,
              <Ltr key="b">{money(EVENT.budget)}</Ltr>,
            ].map((t, i) => (
              <div key={i} style={{ background: C.subtle, padding: '10px 20px', borderRadius: 999 }}>
                {t}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 26,
              fontWeight: 700,
              color: C.success,
              background: C.successBg,
              padding: '12px 26px',
              borderRadius: 999,
            }}
          >
            <ClockIcon size={28} color={C.success} />
            פחות מדקה
          </div>
        </div>
      </Card>
      <div style={{ opacity: cursorOpacity }}>
        <Cursor x={cx} y={cy} pressed={pressed} />
      </div>
    </div>
  );
}
