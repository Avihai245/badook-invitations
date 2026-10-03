import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../theme';
import { Avatar, Card, CheckIcon, clamp, keyframes, useSpringAt } from '../ui';

const TOASTS = [
  { at: 18, who: 'ד', color: '#a0703f', title: 'דנה אישרה הגעה · 2 אנשים', ok: true },
  { at: 42, who: 'ל', color: '#2a78d6', title: 'משפחת לוי אישרו · 4 אנשים', ok: true },
  { at: 66, who: 'ר', color: '#78716c', title: 'רון לא יגיע · שלח ברכה', ok: false },
  { at: 90, who: 'י', color: '#b45309', title: 'יעל אישרה הגעה · 3 אנשים', ok: true },
];

const INVITED = 180;

/** 19–24s: the coming / declined / waiting ring fills while RSVP toasts slide in. */
export function RsvpScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const ease = Easing.out(Easing.cubic);
  const coming = keyframes(
    frame,
    [
      [6, 0],
      [30, 96],
      [54, 118],
      [78, 121],
      [102, 136],
      [130, 142],
    ],
    ease,
  );
  const declined = keyframes(
    frame,
    [
      [6, 0],
      [30, 8],
      [66, 9],
      [80, 14],
    ],
    ease,
  );
  const waiting = INVITED - coming - declined;

  const R = 200;
  const SW = 54;
  const circ = 2 * Math.PI * R;
  const seg = (value: number, offset: number, color: string) => (
    <circle
      cx={260}
      cy={260}
      r={R}
      fill="none"
      stroke={color}
      strokeWidth={SW}
      strokeDasharray={`${(value / INVITED) * circ} ${circ}`}
      strokeDashoffset={-(offset / INVITED) * circ}
      transform="rotate(-90 260 260)"
    />
  );
  const ringIn = sp(0, { damping: 15 });

  const legend = [
    { label: 'מגיעים', value: coming, color: C.success },
    { label: 'לא מגיעים', value: declined, color: C.danger },
    { label: 'ממתינים', value: waiting, color: '#d6d3d1' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card
        style={{
          left: 0,
          top: 120,
          width: 520,
          height: 760,
          transform: `scale(${0.85 + 0.15 * ringIn})`,
          opacity: ringIn,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 30, right: 34, fontSize: 30, fontWeight: 800, color: C.ink }}
        >
          אישורי הגעה
        </div>
        <svg width={520} height={520} style={{ position: 'absolute', top: 70, left: 0 }}>
          <circle cx={260} cy={260} r={R} fill="none" stroke={C.subtle} strokeWidth={SW} />
          {seg(waiting, coming + declined, '#e7e5e4')}
          {seg(declined, coming, C.danger)}
          {seg(coming, 0, C.success)}
        </svg>
        <div style={{ position: 'absolute', top: 70 + 260 - 80, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 104, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
            {Math.round(coming)}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.success, marginTop: 6 }}>מגיעים</div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 30,
            right: 30,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {legend.map((l) => (
            <div
              key={l.label}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 22,
                  fontWeight: 600,
                  color: C.muted,
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 99, background: l.color }} />
                {l.label}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.ink }}>{Math.round(l.value)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* toasts: newest on top, the others slide down */}
      {TOASTS.map((t, i) => {
        const p = sp(t.at, { damping: 15, stiffness: 160 });
        if (frame < t.at) return null;
        const below = TOASTS.filter((o, j) => j > i && frame >= o.at).reduce(
          (s, o) => s + sp(o.at, { damping: 16 }),
          0,
        );
        const y = 150 + below * 150;
        const check = interpolate(frame, [t.at + 6, t.at + 18], [0, 1], clamp);
        return (
          <div
            key={t.title}
            style={{
              position: 'absolute',
              right: 0,
              top: y,
              width: 472,
              transform: `translateX(${(1 - p) * 520}px)`,
              opacity: Math.min(1, p * 1.3) * (1 - below * 0.12),
              zIndex: 10 + i,
            }}
          >
            <div
              style={{
                background: C.surface,
                borderRadius: 22,
                boxShadow: SHADOW.lg,
                padding: '20px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderInlineStart: `6px solid ${t.ok ? C.success : C.danger}`,
              }}
            >
              <Avatar label={t.who} color={t.color} size={58} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 23,
                    fontWeight: 700,
                    color: C.ink,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.title}
                </div>
                <div style={{ fontSize: 18, color: C.muted, marginTop: 2 }}>עכשיו · דרך הקישור האישי</div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 99,
                  background: t.ok ? C.successBg : C.dangerBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {t.ok ? (
                  <CheckIcon size={28} color={C.success} progress={check} />
                ) : (
                  <svg width={22} height={22} viewBox="0 0 24 24">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke={C.danger}
                      strokeWidth={3.2}
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
