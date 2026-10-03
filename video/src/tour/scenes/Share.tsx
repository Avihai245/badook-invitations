import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { QrCode } from '../../scenes/EventDay';
import { C, SHADOW } from '../../theme';
import {
  Avatar,
  Card,
  CheckIcon,
  clamp,
  LinkIcon,
  Phone,
  POSTERS,
  Poster,
  SparkleIcon,
  useSpringAt,
} from '../../ui';
import { useSegment } from '../context';
import { CopyIcon, EVENT, Ltr } from '../data';

const PERSONAL = [
  { name: 'משפחת כהן', slug: 'cohen-4f8', color: '#2a78d6' },
  { name: 'דנה לוי', slug: 'dana-7k2', color: '#a0703f' },
  { name: 'רון אברהם', slug: 'ron-a91', color: '#15803d' },
];

/** After publishing: the invitation's link and QR code, and a personal link that greets each guest. */
export function ShareScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();

  const tLink = spoken('קישור משלה', -8);
  const tQr = spoken('וקוד QR', -6);
  const tPersonal = spoken('קישור אישי', -6);
  const tName = spoken('שפונה אליו בשם', -4);
  const tFill = spoken('וממלא את הפרטים', -4);

  const linkIn = sp(Math.min(tLink, 6), { damping: 16 });
  const copied = frame >= tLink + 16;
  const qrIn = sp(tQr, { damping: 15 });
  const listIn = sp(tPersonal, { damping: 16 });
  const phoneIn = sp(tName - 4, { damping: 15 });
  const fillP = interpolate(frame, [tFill, tFill + 16], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const greet = interpolate(frame, [tName + 4, tName + 18], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const rowOn = (i: number) => sp(tPersonal + 4 + i * 4, { damping: 16 });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* published + link */}
      <Card
        style={{
          right: 0,
          top: 20,
          width: 560,
          height: 250,
          opacity: linkIn,
          transform: `translateY(${(1 - linkIn) * 40}px)`,
        }}
        radius={26}
      >
        <div
          style={{ position: 'absolute', top: 26, right: 30, display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: C.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon size={26} color="#fff" />
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>ההזמנה פורסמה</div>
        </div>
        <div
          style={{ position: 'absolute', top: 90, right: 30, fontSize: 20, fontWeight: 600, color: C.muted }}
        >
          הקישור של ההזמנה
        </div>
        <div
          style={{
            position: 'absolute',
            top: 126,
            right: 30,
            left: 30,
            height: 80,
            borderRadius: 18,
            border: `2px solid ${C.line}`,
            background: C.subtle,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px 0 22px',
            gap: 12,
          }}
        >
          <LinkIcon size={26} color={C.brand} />
          <Ltr style={{ fontSize: 26, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>
            badooks.com/e/avirotem
          </Ltr>
          <div
            style={{
              marginInlineStart: 'auto',
              height: 58,
              padding: '0 18px',
              borderRadius: 14,
              background: copied ? C.successBg : C.surface,
              color: copied ? C.success : C.brandDeep,
              border: `1.5px solid ${copied ? '#bbf7d0' : C.brandLine}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {copied ? <CheckIcon size={22} color={C.success} /> : <CopyIcon size={22} />}
            {copied ? 'הועתק' : 'העתקה'}
          </div>
        </div>
      </Card>

      {/* QR */}
      <Card
        style={{
          right: 290,
          top: 300,
          width: 270,
          height: 330,
          opacity: qrIn,
          transform: `scale(${0.85 + 0.15 * qrIn})`,
        }}
        radius={26}
      >
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <QrCode size={200} />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 26,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 800,
            color: C.ink,
          }}
        >
          קוד <Ltr>QR</Ltr> להזמנה
        </div>
      </Card>

      {/* the mini poster on the QR's side */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 300,
          opacity: qrIn,
          transform: `rotate(${(1 - qrIn) * 8 + 3}deg)`,
          boxShadow: SHADOW.lg,
          borderRadius: 18,
        }}
      >
        <Poster theme={{ ...POSTERS[5], names: EVENT.couple, date: EVENT.date }} width={186} t={frame} />
      </div>

      {/* personal links */}
      <Card
        style={{
          right: 0,
          top: 660,
          width: 560,
          height: 320,
          opacity: listIn,
          transform: `translateY(${(1 - listIn) * 50}px)`,
        }}
        radius={26}
      >
        <div
          style={{ position: 'absolute', top: 24, right: 30, fontSize: 28, fontWeight: 800, color: C.ink }}
        >
          קישור אישי לכל מוזמן
        </div>
        {PERSONAL.map((g, i) => {
          const p = rowOn(i);
          const hot = i === 0 && frame >= tName - 4;
          return (
            <div
              key={g.slug}
              style={{
                position: 'absolute',
                top: 82 + i * 76,
                right: 20,
                left: 20,
                height: 66,
                borderRadius: 16,
                background: hot ? C.brandSoft : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 12px',
                opacity: p,
                transform: `translateX(${(1 - p) * 50}px)`,
              }}
            >
              <Avatar label={g.name[0]} color={g.color} size={44} />
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, width: 150 }}>{g.name}</div>
              <Ltr style={{ fontSize: 21, fontWeight: 600, color: '#027eb5' }}>badooks.com/i/{g.slug}</Ltr>
            </div>
          );
        })}
      </Card>

      {/* the guest's phone */}
      <Phone
        width={380}
        style={{ left: 10, top: 110, opacity: phoneIn, transform: `translateY(${(1 - phoneIn) * 80}px)` }}
      >
        <div style={{ position: 'absolute', inset: 0, background: '#f7f1ea' }} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 300,
            background: POSTERS[5].bg,
          }}
        />
        <div
          style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', color: '#4a3220' }}
        >
          <div style={{ fontSize: 20, fontWeight: 600, color: '#7a5230' }}>מתחתנים</div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.2, marginTop: 8 }}>{EVENT.couple}</div>
          <Ltr style={{ fontSize: 22, fontWeight: 700 }}>{EVENT.date}</Ltr>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 232,
            left: 18,
            right: 18,
            borderRadius: 24,
            background: '#fff',
            boxShadow: SHADOW.md,
            padding: '26px 22px',
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: C.ink,
              opacity: greet,
              transform: `translateY(${(1 - greet) * 14}px)`,
            }}
          >
            שלום משפחת כהן
          </div>
          <div style={{ fontSize: 19, fontWeight: 500, color: C.muted, marginTop: 4 }}>
            נשמח לראותכם בחתונה של {EVENT.couple}
          </div>
          <div style={{ marginTop: 20, fontSize: 18, fontWeight: 700, color: C.muted }}>השם</div>
          <PrefilledField value="משפחת כהן" p={fillP} />
          <div style={{ marginTop: 14, fontSize: 18, fontWeight: 700, color: C.muted }}>כמה תגיעו?</div>
          <PrefilledField value="4" p={fillP} ltr />
          <div
            style={{
              marginTop: 20,
              height: 54,
              borderRadius: 14,
              background: C.brandDeep,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 23,
              fontWeight: 800,
            }}
          >
            אישור הגעה
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: fillP,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 19,
              fontWeight: 700,
              color: C.brandDeep,
              background: C.brandSoft,
              padding: '8px 16px',
              borderRadius: 999,
            }}
          >
            <SparkleIcon size={20} color={C.brand} />
            הפרטים כבר מולאו בשבילכם
          </div>
        </div>
      </Phone>
    </div>
  );
}

function PrefilledField({ value, p, ltr }: { value: string; p: number; ltr?: boolean }) {
  return (
    <div
      style={{
        marginTop: 6,
        height: 50,
        borderRadius: 12,
        border: `2px solid ${p > 0.5 ? C.brand : C.line}`,
        background: p > 0.5 ? C.brandSoft : C.surface,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: 23,
        fontWeight: 700,
        color: C.ink,
        boxShadow: `0 0 0 ${Math.sin(p * Math.PI) * 6}px rgba(160,112,63,0.18)`,
      }}
    >
      <span style={{ opacity: p, direction: ltr ? 'ltr' : 'rtl' }}>{value}</span>
    </div>
  );
}
