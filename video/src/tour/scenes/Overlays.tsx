/**
 * What the tour adds on top of the demo's scenes (which play underneath, stretched to the voice): the
 * parts the narration mentions that the 45-second demo does not show. Coordinates are the demo's
 * 1000×1000 stage; each overlay sits in a part of the stage its scene leaves empty.
 */
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../../theme';
import { Avatar, Card, CheckIcon, clamp, Cursor, SparkleIcon, useSpringAt, WhatsAppIcon } from '../../ui';
import { useSegment } from '../context';
import { ChatIcon, EVENT, Ltr, SendIcon } from '../data';

/** design: "more than 60 designs, made for the event's type" — a count badge and the type chips. */
export function DesignOverlay() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const badge = sp(spoken('יותר משישים', -4), { damping: 13 });
  const chipsIn = sp(spoken('שמותאמים', -8), { damping: 16 });
  const types = ['חתונה', 'בר מצווה', 'ברית', 'חינה'];
  const active = Math.min(types.length - 1, Math.max(0, Math.floor((frame - spoken('שמותאמים', 4)) / 9)));
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 28,
          right: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 26px',
          borderRadius: 999,
          background: `linear-gradient(90deg, ${C.brandDeep}, ${C.brand})`,
          color: '#fff',
          fontSize: 32,
          fontWeight: 800,
          boxShadow: SHADOW.lg,
          transform: `scale(${badge})`,
          opacity: Math.min(1, badge * 1.5),
          zIndex: 20,
        }}
      >
        <Ltr>60+</Ltr> עיצובים
      </div>
      <div
        style={{
          position: 'absolute',
          top: 34,
          left: 28,
          display: 'flex',
          gap: 10,
          opacity: chipsIn,
          transform: `translateY(${(1 - chipsIn) * -30}px)`,
          zIndex: 20,
        }}
      >
        {types.map((t, i) => (
          <div
            key={t}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              fontSize: 24,
              fontWeight: 700,
              background: i === active ? C.ink : C.surface,
              color: i === active ? '#fff' : C.ink,
              boxShadow: SHADOW.md,
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </>
  );
}

/** edit: send a draft to the family, get comments, then publish. */
export function EditOverlay() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken, sentence } = useSegment();
  const tDraft = spoken('לשלוח טיוטה', -4);
  const tNotes = spoken('לקבל הערות', -4);
  const tPublish = spoken('לפרסם', -6);
  const strip = sp(sentence(1) - 8, { damping: 16 });
  const comment = sp(tNotes, { damping: 14 });
  const steps = [
    { label: 'טיוטה למשפחה', at: tDraft, Icon: SendIcon },
    { label: '2 הערות', at: tNotes, Icon: ChatIcon },
    { label: 'פורסם', at: tPublish, Icon: null },
  ];
  return (
    <>
      <Card
        style={{
          left: 0,
          top: 880,
          width: 530,
          height: 104,
          opacity: strip,
          transform: `translateY(${(1 - strip) * 40}px)`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 6,
          zIndex: 20,
        }}
        radius={24}
      >
        {steps.map((s, i) => {
          const on = interpolate(frame, [s.at, s.at + 8], [0, 1], clamp);
          const last = i === steps.length - 1;
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 13px',
                  borderRadius: 999,
                  fontSize: 21,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  background: on > 0.5 ? (last ? C.success : C.brandSoft) : C.subtle,
                  color: on > 0.5 ? (last ? '#fff' : C.brandDeep) : C.faint,
                  transform: `scale(${1 + 0.08 * Math.sin(on * Math.PI)})`,
                }}
              >
                {s.Icon ? <s.Icon size={22} /> : <CheckIcon size={22} color="currentColor" progress={on} />}
                {s.label}
              </div>
              {!last ? (
                <div style={{ width: 10, height: 3, borderRadius: 3, background: C.lineStrong }} />
              ) : null}
            </div>
          );
        })}
      </Card>
      {/* a comment from the family */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 18,
          width: 520,
          opacity: comment,
          transform: `translateY(${(1 - comment) * -30}px) scale(${0.9 + 0.1 * comment})`,
          transformOrigin: 'top right',
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
            background: C.surface,
            borderRadius: 22,
            padding: '16px 20px',
            boxShadow: SHADOW.lg,
          }}
        >
          <Avatar label="א" color="#9b3a3f" size={50} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.muted }}>אמא של רותם · הערה על הטיוטה</div>
            <div style={{ fontSize: 25, fontWeight: 700, color: C.ink, marginTop: 4 }}>
              מהמם! אולי להוסיף את שעת קבלת הפנים?
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** guests: send from Badook's number, or from your own WhatsApp one by one. */
export function GuestsOverlay() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const tA = spoken('מהמספר של באדוק', -4);
  const tB = spoken('או מהוואטסאפ', -4);
  const card = sp(tA - 6, { damping: 16 });
  const sel = interpolate(frame, [tB, tB + 8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const oneByOne = Math.min(16, Math.max(0, Math.floor((frame - tB - 6) / 5)));
  const option = (title: string, sub: string, on: number, y: number) => (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 18,
        right: 18,
        height: 104,
        borderRadius: 18,
        border: `2px solid ${on > 0.5 ? C.wa : C.line}`,
        background: on > 0.5 ? C.waSoft : C.surface,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 16px',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 99,
          border: `3px solid ${on > 0.5 ? C.waStrong : C.lineStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 99,
            background: C.waStrong,
            transform: `scale(${on})`,
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 19, fontWeight: 600, color: on > 0.5 ? C.waInk : C.muted }}>{sub}</div>
      </div>
    </div>
  );
  return (
    <Card
      style={{
        left: 0,
        top: 690,
        width: 340,
        height: 300,
        opacity: card,
        transform: `translateY(${(1 - card) * 40}px)`,
        zIndex: 20,
      }}
      radius={24}
    >
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 24,
          fontWeight: 800,
          color: C.ink,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 99,
            background: C.wa,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WhatsAppIcon size={24} />
        </div>
        איך שולחים?
      </div>
      {option('מהמספר של באדוק', 'לכולם בלחיצה', 1 - sel, 70)}
      {option('מהוואטסאפ שלכם', sel > 0.5 ? `אחד אחרי השני · ${oneByOne}/16` : 'אחד אחרי השני', sel, 186)}
    </Card>
  );
}

/** rsvp: an answer from the general link, matched to a guest in one click. */
export function RsvpOverlay() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken, sentence } = useSegment();
  const card = sp(sentence(1) - 4, { damping: 15 });
  const tClick = spoken('בלחיצה אחת', -2);
  const done = sp(tClick + 6, { damping: 14 });
  const press =
    frame >= tClick && frame < tClick + 14 ? interpolate(frame, [tClick, tClick + 14], [0, 1]) : 0;
  const cursorIn = interpolate(frame, [tClick - 26, tClick - 8], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const cursorOut = interpolate(frame, [tClick + 16, tClick + 24], [1, 0], clamp);
  return (
    <>
      <Card
        style={{
          right: 0,
          top: 760,
          width: 472,
          height: 220,
          opacity: card,
          transform: `translateY(${(1 - card) * 50}px)`,
          zIndex: 30,
          boxShadow: SHADOW.lg,
        }}
        radius={22}
      >
        <div
          style={{ position: 'absolute', top: 18, right: 22, fontSize: 20, fontWeight: 700, color: C.muted }}
        >
          תשובה מהקישור הכללי
        </div>
        <div
          style={{
            position: 'absolute',
            top: 54,
            right: 22,
            left: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Avatar label="א" color="#5a3a7a" size={52} />
          <div style={{ fontSize: 25, fontWeight: 800, color: C.ink }}>
            משפחת אזולאי · <Ltr>3</Ltr> אנשים
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 22,
            left: 22,
            height: 64,
            borderRadius: 16,
            background: done > 0.5 ? C.successBg : C.brand,
            border: done > 0.5 ? `2px solid ${C.success}` : 'none',
            color: done > 0.5 ? C.success : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontSize: 24,
            fontWeight: 800,
            transform: `scale(${1 - 0.05 * Math.sin(press * Math.PI)})`,
          }}
        >
          {done > 0.5 ? (
            <>
              <CheckIcon size={26} color={C.success} progress={done} />
              שויך למוזמן: משפחת אזולאי
            </>
          ) : (
            <>
              <SparkleIcon size={24} color="#fff" />
              שיוך למוזמן
            </>
          )}
        </div>
      </Card>
      <div style={{ opacity: cursorIn * cursorOut }}>
        <Cursor x={740 - (1 - cursorIn) * 80} y={928 + (1 - cursorIn) * 60} pressed={press} />
      </div>
    </>
  );
}

/** seating: once everyone is seated, each guest gets their table number on WhatsApp. */
export function SeatingOverlay() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const tSend = spoken('ושולחים לכל אורח', -6);
  const pill = sp(tSend, { damping: 15 });
  const sent = interpolate(frame, [tSend + 14, tSend + 22], [0, 1], clamp);
  const count = Math.round(interpolate(frame, [tSend + 6, tSend + 30], [0, EVENT.guests], clamp));
  return (
    <div
      style={{
        position: 'absolute',
        right: 32,
        top: 80,
        height: 70,
        padding: '0 24px',
        borderRadius: 18,
        background: sent > 0.5 ? C.waSoft : C.waStrong,
        border: `2px solid ${sent > 0.5 ? C.wa : C.waStrong}`,
        color: sent > 0.5 ? C.waInk : '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 26,
        fontWeight: 800,
        opacity: pill,
        transform: `scale(${0.8 + 0.2 * pill})`,
        transformOrigin: 'right center',
        boxShadow: '0 12px 26px rgba(15,125,65,0.22)',
        zIndex: 20,
      }}
    >
      {sent > 0.5 ? (
        <>
          <CheckIcon size={28} color={C.waInk} progress={sent} />
          מספר השולחן נשלח · <Ltr>{count}</Ltr> אורחים
        </>
      ) : (
        <>
          <WhatsAppIcon size={30} />
          שליחת מספרי השולחנות לאורחים
        </>
      )}
    </div>
  );
}
