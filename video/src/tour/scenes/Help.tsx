import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../../theme';
import { Card, clamp, Cursor, SparkleIcon, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { BookIcon, ChatIcon, HelpIcon, MailIcon, SearchIcon, SendIcon } from '../data';

const TABS = [
  { label: 'מדריך', Icon: BookIcon },
  { label: 'שאלו את העוזר', Icon: ChatIcon },
  { label: 'פנייה לצוות', Icon: MailIcon },
];

const ARTICLES = [
  'איך שולחים את ההזמנה בוואטסאפ?',
  'משייכים תשובה מהקישור הכללי',
  'סידור שולחנות: המדריך המלא',
];

const QUESTION = 'אפשר לשנות את התאריך אחרי ששלחנו?';
const ANSWER = 'כן. משנים את התאריך בעריכת ההזמנה ומפרסמים שוב: כל האורחים יראו את התאריך החדש באותו קישור.';

const PANEL = { left: 0, top: 0, width: 700, height: 990 };

/** The help button opens a panel: a written guide, a smart assistant, and a direct line to the team. */
export function HelpScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();

  const tOpen = spoken('כפתור העזרה', 4);
  const tGuide = spoken('מדריך כתוב', -6);
  const tAssistant = spoken('עוזר חכם', -6);
  const tTeam = spoken('ופנייה ישירה', -6);
  const tab = frame >= tTeam ? 2 : frame >= tAssistant ? 1 : 0;
  const tabX = interpolate(frame, [tAssistant - 4, tAssistant + 6, tTeam - 4, tTeam + 6], [0, 1, 1, 2], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const panel = sp(tOpen, { damping: 17 });
  const appIn = sp(0, { damping: 16 });
  const press =
    frame >= tOpen - 6 && frame < tOpen + 8 ? interpolate(frame, [tOpen - 6, tOpen + 8], [0, 1]) : 0;
  const cursorOpacity = interpolate(frame, [tOpen + 4, tOpen + 14], [1, 0], clamp);
  const contentIn = (at: number) =>
    interpolate(frame, [at, at + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const answerChars = Array.from(ANSWER);
  const typed = answerChars.slice(0, Math.max(0, Math.floor((frame - tAssistant - 22) * 2.4))).join('');
  const thinking = frame >= tAssistant + 8 && frame < tAssistant + 22;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the app behind (dimmed when the panel is open) */}
      <Card
        style={{
          left: 300,
          right: 0,
          top: 30,
          height: 930,
          opacity: appIn,
          background: '#fbfaf8',
        }}
        radius={28}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: 36,
              left: 36,
              top: 40 + i * 215,
              height: 180,
              borderRadius: 22,
              background: C.surface,
              boxShadow: SHADOW.sm,
              border: `1px solid ${C.line}`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 30,
                right: 28,
                width: 180,
                height: 22,
                borderRadius: 8,
                background: C.subtle,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 70,
                right: 28,
                width: 280,
                height: 16,
                borderRadius: 8,
                background: C.subtle,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 100,
                right: 28,
                width: 220,
                height: 16,
                borderRadius: 8,
                background: C.subtle,
              }}
            />
          </div>
        ))}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,25,23,0.28)', opacity: panel }} />
      </Card>

      {/* the help button */}
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 840,
          width: 96,
          height: 96,
          borderRadius: 99,
          background: `linear-gradient(180deg, ${C.brand}, ${C.brandDeep})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 16px 34px rgba(122,82,48,0.4), 0 0 0 ${Math.sin(press * Math.PI) * 14}px rgba(160,112,63,0.2)`,
          transform: `scale(${appIn * (1 - 0.08 * Math.sin(press * Math.PI))})`,
          zIndex: 5,
        }}
      >
        <HelpIcon size={56} color="#fff" />
      </div>

      {/* the panel */}
      <Card
        style={{
          ...PANEL,
          opacity: Math.min(1, panel * 1.5),
          transform: `translateX(${(1 - panel) * -160}px)`,
          boxShadow: `${SHADOW.xl}, 0 0 0 1px rgba(122,82,48,0.06)`,
          zIndex: 10,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 30, right: 34, fontSize: 36, fontWeight: 800, color: C.ink }}
        >
          איך אפשר לעזור?
        </div>
        {/* tabs */}
        <div
          style={{
            position: 'absolute',
            top: 100,
            right: 30,
            left: 30,
            height: 72,
            borderRadius: 18,
            background: C.subtle,
            padding: 6,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 6,
              bottom: 6,
              right: 6 + tabX * ((640 - 12) / 3),
              width: (640 - 12) / 3,
              borderRadius: 14,
              background: C.surface,
              boxShadow: SHADOW.md,
            }}
          />
          <div style={{ position: 'relative', display: 'flex', height: '100%' }}>
            {TABS.map((t, i) => (
              <div
                key={t.label}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 23,
                  fontWeight: 800,
                  color: i === tab ? C.brandDeep : C.muted,
                }}
              >
                <t.Icon size={24} />
                {t.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', top: 200, right: 30, left: 30, bottom: 30 }}>
          {/* guide */}
          {tab === 0 ? (
            <div style={{ opacity: contentIn(Math.min(tGuide, tOpen + 6)) }}>
              <div
                style={{
                  height: 70,
                  borderRadius: 16,
                  border: `2px solid ${C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 18px',
                  fontSize: 24,
                  fontWeight: 600,
                  color: C.faint,
                }}
              >
                <SearchIcon size={28} />
                חיפוש במדריך
              </div>
              {ARTICLES.map((a, i) => {
                const p = sp(tGuide + 4 + i * 4, { damping: 16 });
                const open = i === 0;
                return (
                  <div
                    key={a}
                    style={{
                      marginTop: 16,
                      borderRadius: 20,
                      border: `2px solid ${open ? C.brandLine : C.line}`,
                      background: open ? C.brandSoft : C.surface,
                      padding: '20px 22px',
                      opacity: p,
                      transform: `translateY(${(1 - p) * 24}px)`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <BookIcon size={28} color={C.brand} />
                      <div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>{a}</div>
                    </div>
                    {open ? (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {['פותחים את „מזמינים“', 'בוחרים מאיפה לשלוח', 'שולחים, ורואים מי קיבל'].map(
                          (s, j) => (
                            <div
                              key={s}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                fontSize: 22,
                                fontWeight: 600,
                                color: C.ink,
                              }}
                            >
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 99,
                                  background: C.brand,
                                  color: '#fff',
                                  fontSize: 18,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {j + 1}
                              </div>
                              {s}
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* assistant */}
          {tab === 1 ? (
            <div style={{ opacity: contentIn(tAssistant) }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    maxWidth: 480,
                    background: C.brand,
                    color: '#fff',
                    borderRadius: '22px 22px 6px 22px',
                    padding: '16px 22px',
                    fontSize: 25,
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {QUESTION}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 560 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 99,
                      background: C.brandSoft,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <SparkleIcon size={28} color={C.brand} />
                  </div>
                  <div
                    style={{
                      background: C.subtle,
                      color: C.ink,
                      borderRadius: '22px 22px 22px 6px',
                      padding: '16px 22px',
                      fontSize: 25,
                      fontWeight: 600,
                      lineHeight: 1.45,
                      minHeight: 60,
                      minWidth: 110,
                    }}
                  >
                    {thinking ? (
                      <div style={{ display: 'flex', gap: 8, padding: '10px 4px' }}>
                        {[0, 1, 2].map((d) => (
                          <div
                            key={d}
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 99,
                              background: C.faint,
                              opacity: 0.35 + 0.65 * Math.abs(Math.sin(frame / 5 + d)),
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      typed
                    )}
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 18,
                  marginInlineStart: 60,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 20,
                  fontWeight: 700,
                  color: C.brandDeep,
                  background: C.brandSoft,
                  padding: '8px 16px',
                  borderRadius: 999,
                  opacity: typed.length === answerChars.length ? 1 : 0,
                }}
              >
                <BookIcon size={22} color={C.brand} />
                מתוך המדריך: עריכת ההזמנה
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 72,
                  borderRadius: 18,
                  border: `2px solid ${C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 20px',
                  fontSize: 23,
                  fontWeight: 600,
                  color: C.faint,
                }}
              >
                שאלו כל שאלה…
              </div>
            </div>
          ) : null}

          {/* team */}
          {tab === 2 ? (
            <div style={{ opacity: contentIn(tTeam) }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.muted }}>נושא</div>
              <div
                style={{
                  marginTop: 8,
                  height: 70,
                  borderRadius: 16,
                  border: `2px solid ${C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 18px',
                  fontSize: 25,
                  fontWeight: 700,
                  color: C.ink,
                }}
              >
                שאלה על שליחת ההזמנות
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.muted, marginTop: 22 }}>ההודעה</div>
              <div
                style={{
                  marginTop: 8,
                  height: 220,
                  borderRadius: 16,
                  border: `2px solid ${C.brand}`,
                  boxShadow: '0 0 0 6px rgba(160,112,63,0.12)',
                  padding: '16px 18px',
                  fontSize: 24,
                  fontWeight: 500,
                  color: C.ink,
                  lineHeight: 1.45,
                }}
              >
                {Array.from('היי, רצינו לשאול אם אפשר לשלוח תזכורת רק למי שעוד לא ענה?')
                  .slice(0, Math.max(0, Math.floor((frame - tTeam - 6) * 2)))
                  .join('')}
              </div>
              <div
                style={{
                  marginTop: 24,
                  height: 80,
                  borderRadius: 18,
                  background: `linear-gradient(180deg, ${C.brand} 0%, ${C.brandDeep} 100%)`,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                <SendIcon size={28} color="#fff" />
                שליחה לצוות
              </div>
              <div
                style={{ marginTop: 16, textAlign: 'center', fontSize: 21, fontWeight: 600, color: C.muted }}
              >
                נחזור אליכם במייל בהקדם
              </div>
            </div>
          ) : null}
        </div>
      </Card>
      <div style={{ opacity: cursorOpacity }}>
        <Cursor x={835} y={895} pressed={press} />
      </div>
    </div>
  );
}
