import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { LogoImg } from '../Shell';
import { C, SHADOW } from '../theme';
import { clamp, POSTERS, Poster, useLayout, useSpringAt } from '../ui';

/** 0–4s: the logo and the promise. */
export function LogoScene({ dur }: { dur: number }) {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { portrait } = useLayout();
  const s = sp(4, { damping: 13, stiffness: 120 });
  const exit = interpolate(frame, [dur - 5, dur + 4], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const line1 = 'כל האירוע שלכם.';
  const line2 = 'במקום אחד.';
  const w = (delay: number) =>
    interpolate(frame, [delay, delay + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  // three posters fanning out behind the logo
  const fan = sp(30, { damping: 16 });
  const posterW = portrait ? 250 : 230;

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 1 - exit,
        transform: `scale(${1 + exit * 0.06})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {[-1, 0, 1].map((k) => (
          <div
            key={k}
            style={{
              position: 'absolute',
              top: portrait ? 1180 : 600,
              left: '50%',
              marginLeft: -posterW / 2,
              transform: `translateX(${k * fan * (portrait ? 260 : 300)}px) translateY(${(1 - fan) * 200 + Math.abs(k) * 30}px) rotate(${k * fan * 9}deg)`,
              opacity: fan,
              boxShadow: SHADOW.xl,
              borderRadius: 18,
            }}
          >
            <Poster theme={POSTERS[k + 1]} width={posterW} t={frame} />
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          top: portrait ? 330 : 120,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ transform: `scale(${0.6 + 0.4 * s})`, opacity: Math.min(1, s * 1.5) }}>
          <LogoImg width={portrait ? 560 : 520} />
        </div>
        <div
          style={{
            marginTop: portrait ? 70 : 40,
            textAlign: 'center',
            fontWeight: 800,
            fontSize: portrait ? 96 : 88,
            lineHeight: 1.1,
            color: C.ink,
            letterSpacing: -1.5,
          }}
        >
          <div style={{ opacity: w(26), transform: `translateY(${(1 - w(26)) * 30}px)` }}>{line1}</div>
          <div style={{ opacity: w(40), transform: `translateY(${(1 - w(40)) * 30}px)`, color: C.brand }}>
            {line2}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** 43–45s: the end card. */
export function EndScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { portrait } = useLayout();
  const a = sp(0, { damping: 14 });
  const b = sp(8, { damping: 14 });
  const c = sp(16, { damping: 12 });
  const pulse = 1 + 0.03 * Math.sin(Math.max(0, frame - 30) / 4);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ transform: `scale(${0.7 + 0.3 * a})`, opacity: a }}>
        <LogoImg width={portrait ? 420 : 380} />
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: portrait ? 132 : 140,
          fontWeight: 800,
          color: C.ink,
          letterSpacing: -3,
          lineHeight: 1,
          opacity: b,
          transform: `translateY(${(1 - b) * 40}px)`,
        }}
      >
        מתחילים בחינם
      </div>
      <div
        style={{
          marginTop: 34,
          fontSize: portrait ? 50 : 52,
          fontWeight: 700,
          color: C.brandDeep,
          direction: 'ltr',
          opacity: b,
        }}
      >
        invitations.badooks.com
      </div>
      <div
        style={{
          marginTop: 56,
          padding: '28px 72px',
          borderRadius: 999,
          background: `linear-gradient(180deg, ${C.brand} 0%, ${C.brandDeep} 100%)`,
          color: '#fff',
          fontSize: 46,
          fontWeight: 800,
          boxShadow: '0 20px 40px rgba(122,82,48,0.35)',
          transform: `scale(${(0.6 + 0.4 * c) * pulse})`,
          opacity: c,
        }}
      >
        ליצירת הזמנה עכשיו
      </div>
    </AbsoluteFill>
  );
}
