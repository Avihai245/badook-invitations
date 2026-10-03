import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../theme';
import { Avatar, Card, clamp, DoubleCheck, LinkIcon, WhatsAppIcon, useSpringAt } from '../ui';

const GUESTS = [
  { name: 'דנה כהן', phone: '052-418-2290', n: 2, color: '#a0703f' },
  { name: 'משפחת לוי', phone: '054-730-1185', n: 4, color: '#2a78d6' },
  { name: 'רון אברהם', phone: '050-662-9047', n: 1, color: '#15803d' },
  { name: 'יעל מזרחי', phone: '053-905-3312', n: 3, color: '#b45309' },
  { name: 'עומר ביטון', phone: '058-221-7764', n: 2, color: '#7a5230' },
  { name: 'שני פרץ', phone: '052-374-5501', n: 2, color: '#9b3a3f' },
  { name: 'אבי וגלית', phone: '054-118-6639', n: 2, color: '#1f5a66' },
];

/** 14–19s: an Excel sheet flies into the guest list, rows fill, then WhatsApp sends personal links. */
export function GuestsScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();

  // the sheet's flight
  const fly = interpolate(frame, [8, 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sheetX = interpolate(fly, [0, 1], [170, 640]);
  const sheetY = interpolate(fly, [0, 1], [380, 170]) - Math.sin(fly * Math.PI) * 180;
  const sheetScale = interpolate(fly, [0, 0.8, 1], [1, 0.7, 0.2]);
  const sheetOpacity = interpolate(fly, [0.85, 1], [1, 0], clamp);
  const sheetIn = sp(2);

  const rowsShown = (i: number) => sp(30 + i * 5, { damping: 16 });
  const btnIn = sp(64);
  const press = interpolate(frame, [82, 90], [0, 1], clamp);
  const pressScale = 1 - 0.06 * Math.sin(press * Math.PI);
  const sent = (i: number) => sp(90 + i * 3, { damping: 14 });
  const count = Math.round(GUESTS.reduce((s, g, i) => s + g.n * Math.min(1, rowsShown(i)), 0));
  const bubble = sp(96, { damping: 15 });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* guest list */}
      <Card
        style={{ right: 0, top: 60, width: 640, height: 880, transform: `translateY(${(1 - sp(0)) * 60}px)` }}
        radius={28}
      >
        <div
          style={{
            padding: '30px 34px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, color: C.ink }}>המוזמנים</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: C.brandDeep,
              background: C.brandSoft,
              padding: '6px 16px',
              borderRadius: 999,
            }}
          >
            {count} אורחים
          </div>
        </div>
        {GUESTS.map((g, i) => {
          const r = rowsShown(i);
          const s = sent(i);
          return (
            <div
              key={g.name}
              style={{
                height: 86,
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '0 34px',
                borderBottom: `1px solid ${C.subtle}`,
                opacity: r,
                transform: `translateX(${(1 - r) * 60}px)`,
              }}
            >
              <Avatar label={g.name[0]} color={g.color} size={50} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.ink }}>{g.name}</div>
                <div style={{ fontSize: 20, color: C.muted, direction: 'ltr', textAlign: 'right' }}>
                  {g.phone}
                </div>
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.muted,
                  background: C.subtle,
                  borderRadius: 10,
                  padding: '4px 12px',
                }}
              >
                {g.n}
              </div>
              <div
                style={{
                  width: 110,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'flex-end',
                  opacity: s,
                  transform: `scale(${0.5 + 0.5 * s})`,
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 700, color: C.waInk }}>נשלח</span>
                <DoubleCheck size={22} color={C.wa} />
              </div>
            </div>
          );
        })}
        {/* the WhatsApp button */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 34,
            right: 34,
            opacity: btnIn,
            transform: `translateY(${(1 - btnIn) * 40}px) scale(${pressScale})`,
          }}
        >
          <div
            style={{
              height: 88,
              borderRadius: 18,
              background: C.waStrong,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              fontSize: 30,
              fontWeight: 800,
              boxShadow: `0 14px 30px rgba(15,125,65,${0.25 + press * 0.2})`,
            }}
          >
            <WhatsAppIcon size={38} />
            שליחה בוואטסאפ לכולם
          </div>
        </div>
      </Card>

      {/* the sheet */}
      <div
        style={{
          position: 'absolute',
          left: sheetX - 90,
          top: sheetY - 100,
          transform: `scale(${sheetScale * sheetIn}) rotate(${fly * -14}deg)`,
          opacity: sheetOpacity,
          zIndex: 5,
        }}
      >
        <ExcelSheet />
      </div>

      {/* a WhatsApp message with a personal link */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 400,
          width: 330,
          opacity: bubble,
          transform: `translateY(${(1 - bubble) * 40}px) scale(${0.85 + 0.15 * bubble})`,
          transformOrigin: 'bottom right',
        }}
      >
        <div
          style={{
            background: '#dcf8c6',
            borderRadius: '22px 22px 22px 6px',
            padding: '20px 22px',
            boxShadow: SHADOW.lg,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>
            היי דנה! הוזמנתם לחתונה של נועה & איתי
          </div>
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 19,
              fontWeight: 700,
              color: '#027eb5',
              direction: 'ltr',
              justifyContent: 'flex-end',
            }}
          >
            badooks.com/i/dana-7k2
            <LinkIcon size={20} color="#027eb5" />
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 6,
              fontSize: 16,
              color: C.muted,
              direction: 'ltr',
            }}
          >
            <span>20:41</span>
            <DoubleCheck size={16} color="#34b7f1" />
          </div>
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 22,
            fontWeight: 700,
            color: C.waInk,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <LinkIcon size={22} color={C.waInk} />
          קישור אישי לכל אורח
        </div>
      </div>
    </div>
  );
}

function ExcelSheet() {
  return (
    <div style={{ width: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          position: 'relative',
          width: 150,
          height: 180,
          borderRadius: 16,
          background: '#fff',
          boxShadow: SHADOW.lg,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '16px 16px 16px 46px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 5,
          }}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} style={{ background: i < 3 ? '#a7d7b8' : '#e3f1e8', borderRadius: 3 }} />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 46,
            width: 64,
            height: 64,
            borderRadius: 10,
            background: '#107c41',
            color: '#fff',
            fontWeight: 800,
            fontSize: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Heebo, sans-serif',
          }}
        >
          X
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, direction: 'ltr' }}>guests.xlsx</div>
    </div>
  );
}
