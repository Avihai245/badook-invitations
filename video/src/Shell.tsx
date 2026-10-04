import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import logo from '../../public/brand/badook-logo.png';
import { C } from './theme';
import { SCENES, OVERLAP, sceneStart } from './timing';
import { clamp, useLayout } from './ui';

/** The warm canvas with slow, soft blobs behind every scene. */
export function Background() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const blob = (x: number, y: number, r: number, color: string, phase: number) => (
    <div
      style={{
        position: 'absolute',
        left: x * width + Math.sin(frame / 90 + phase) * 60 - r,
        top: y * height + Math.cos(frame / 110 + phase) * 50 - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 70%)`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.bgFrom} 0%, ${C.bgTo} 100%)` }}>
      {blob(0.1, 0.15, 520, 'rgba(255,255,255,0.75)', 0)}
      {blob(0.9, 0.8, 620, 'rgba(160,112,63,0.14)', 2)}
      {blob(0.75, 0.1, 420, 'rgba(248,235,228,0.9)', 4)}
      {blob(0.2, 0.9, 460, 'rgba(234,216,192,0.6)', 1)}
    </AbsoluteFill>
  );
}

export function LogoImg({ width, style }: { width: number; style?: React.CSSProperties }) {
  return <Img src={logo} style={{ width, height: (width * 161) / 480, display: 'block', ...style }} />;
}

/** Small logo + step progress, shown during the feature scenes. */
export function Chrome() {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const first = sceneStart(1);
  const last = sceneStart(SCENES.length - 1);
  const opacity = interpolate(frame, [first, first + 15, last, last + OVERLAP], [0, 1, 1, 0], clamp);
  const steps = SCENES.length - 2;
  const current = SCENES.findIndex((_, i) => frame >= sceneStart(i) && frame < sceneStart(i + 1)) - 1;
  const stepProgress = (i: number) =>
    interpolate(frame, [sceneStart(i + 1), sceneStart(i + 2)], [0, 1], clamp);
  const dots = (
    <div style={{ display: 'flex', gap: 12, direction: 'rtl' }}>
      {Array.from({ length: steps }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 64 : 22,
            height: 10,
            borderRadius: 999,
            background: 'rgba(122,82,48,0.18)',
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
              width: `${stepProgress(i) * 100}%`,
              background: C.brand,
              borderRadius: 999,
            }}
          />
        </div>
      ))}
    </div>
  );
  if (portrait) {
    return (
      <AbsoluteFill style={{ opacity }}>
        <div
          style={{
            position: 'absolute',
            top: 120,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <LogoImg width={230} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 1640,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {dots}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: 'absolute', top: 70, right: 120 }}>
        <LogoImg width={220} />
      </div>
      <div style={{ position: 'absolute', bottom: 80, right: 120 }}>{dots}</div>
    </AbsoluteFill>
  );
}

/**
 * One feature scene: a caption (kicker + headline, words rising in) and a 1000×1000 visual scaled into
 * the layout's stage. Fades/slides out around its end while the next scene (overlapping by OVERLAP frames) comes in.
 */
export function SceneShell({
  kicker,
  caption,
  dur,
  children,
}: {
  kicker: string;
  caption: string;
  dur: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait } = useLayout();
  const exit = interpolate(frame, [dur - 5, dur + 4], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const enter = interpolate(frame, [3, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

  const words = caption.split(' ');
  const captionFont = portrait ? 86 : 92;
  const captionBlock = (
    <div style={{ opacity: 1 - exit, transform: `translateY(${-exit * 40}px)` }}>
      <div
        style={{
          fontSize: portrait ? 30 : 30,
          fontWeight: 700,
          color: C.brand,
          letterSpacing: 1,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 20}px)`,
          marginBottom: 18,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontSize: captionFont,
          lineHeight: 1.08,
          fontWeight: 800,
          color: C.ink,
          letterSpacing: -1.5,
          textWrap: 'balance',
          textAlign: portrait ? 'center' : 'start',
        }}
      >
        {words.map((w, i) => {
          const p = interpolate(frame, [6 + i * 3, 20 + i * 3], [0, 1], {
            ...clamp,
            easing: Easing.out(Easing.cubic),
          });
          return (
            <span key={i}>
              <span
                style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 36}px)` }}
              >
                {w}
              </span>
              {i < words.length - 1 ? ' ' : null}
            </span>
          );
        })}
      </div>
      <div
        style={{
          height: 8,
          width: 120 * enter,
          background: C.brand,
          borderRadius: 999,
          marginTop: 32,
          marginInline: portrait ? 'auto' : undefined,
        }}
      />
    </div>
  );

  const pop = interpolate(frame, [3, 21], [0, 1], { ...clamp, easing: Easing.bezier(0.2, 0.9, 0.3, 1.15) });
  const stageScale = portrait ? 0.98 : 0.94;
  const stage = (
    <div
      style={{
        width: 1000,
        height: 1000,
        position: 'relative',
        transform: `scale(${stageScale * (0.9 + 0.1 * pop - 0.04 * exit)}) translateY(${(1 - pop) * 40}px)`,
        opacity: Math.min(enter * 1.4, 1) * (1 - exit),
      }}
    >
      {children}
    </div>
  );
  void fps;

  if (portrait) {
    return (
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            top: 250,
            bottom: 300,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 40,
          }}
        >
          <div style={{ width: 940, textAlign: 'center' }}>{captionBlock}</div>
          <div
            style={{
              width: 1000 * stageScale,
              height: 1000 * stageScale,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {stage}
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 120,
          width: 640,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ width: '100%' }}>{captionBlock}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 110,
          width: 1000,
          height: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {stage}
      </div>
    </AbsoluteFill>
  );
}
