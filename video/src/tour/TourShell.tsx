import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { LogoImg } from '../Shell';
import { C } from '../theme';
import { clamp, useLayout } from '../ui';
import { useSegment } from './context';
import type { Cue, TourSchedule } from './schedule';

/**
 * The tour's layout (the demo's SceneShell, adapted to leave room for the subtitles):
 * landscape: an 800×800 stage on the left, kicker + headline on the right, the subtitle bar at the bottom.
 * portrait: kicker + headline on top, a 900×900 stage, the subtitles in the lower third.
 * Scenes draw on a 1000×1000 stage like the demo's.
 */
export const STAGE = {
  landscape: { scale: 0.8, left: 150, top: 40 },
  portrait: { scale: 0.92, top: 420 },
} as const;

export function TourShell({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  const { dur } = useSegment();
  return (
    <NarratedShell kicker={kicker} title={title} dur={dur}>
      {children}
    </NarratedShell>
  );
}

/** The same layout for any narrated video: its scene's length given (the seating tutorial's too). */
export function NarratedShell({
  kicker,
  title,
  dur,
  children,
}: {
  kicker: string;
  title: string;
  dur: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const exit = interpolate(frame, [dur - 5, dur + 4], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const enter = interpolate(frame, [3, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const words = title.split(' ');

  const caption = (
    <div
      style={{
        opacity: 1 - exit,
        transform: `translateY(${-exit * 40}px)`,
        textAlign: portrait ? 'center' : 'start',
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: C.brand,
          letterSpacing: 1,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 20}px)`,
          marginBottom: portrait ? 10 : 18,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontSize: portrait ? 70 : 84,
          lineHeight: 1.08,
          fontWeight: 800,
          color: C.ink,
          letterSpacing: -1.5,
          textWrap: 'balance',
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
          marginTop: portrait ? 22 : 32,
          marginInline: portrait ? 'auto' : undefined,
        }}
      />
    </div>
  );

  const pop = interpolate(frame, [3, 21], [0, 1], { ...clamp, easing: Easing.bezier(0.2, 0.9, 0.3, 1.15) });
  const scale = portrait ? STAGE.portrait.scale : STAGE.landscape.scale;
  const stage = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1000,
        height: 1000,
        transformOrigin: '0 0',
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${0.9 + 0.1 * pop - 0.04 * exit}) translateY(${(1 - pop) * 40}px)`,
          opacity: Math.min(enter * 1.4, 1) * (1 - exit),
        }}
      >
        {children}
      </div>
    </div>
  );

  if (portrait) {
    return (
      <AbsoluteFill>
        <div style={{ position: 'absolute', top: 190, left: 70, right: 70 }}>{caption}</div>
        <div
          style={{
            position: 'absolute',
            top: STAGE.portrait.top,
            left: (1080 - 1000 * scale) / 2,
            width: 1000 * scale,
            height: 1000 * scale,
          }}
        >
          {stage}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 150,
          bottom: 260,
          right: 120,
          width: 680,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ width: '100%' }}>{caption}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: STAGE.landscape.top,
          left: STAGE.landscape.left,
          width: 1000 * scale,
          height: 1000 * scale,
        }}
      >
        {stage}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Plays one of the demo's fixed-length scenes slower, so its animation fills the narration: `content`
 * frames of the scene are stretched over `target` frames of the tour (playback rate between 0.45 and 1).
 */
export function Stretch({
  content,
  target,
  children,
}: {
  content: number;
  target: number;
  children: ReactNode;
}) {
  const rate = Math.min(1, Math.max(0.45, content / Math.max(1, target)));
  return (
    <Sequence layout="none" playbackRate={rate} name="stretched demo scene">
      {children}
    </Sequence>
  );
}

/** The subtitle bar: the sentence being read, white on a dark pill. */
export function Subtitles({ cues, total }: { cues: Cue[]; total: number }) {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const cue = cues.find((c) => frame >= c.from && frame < c.to);
  if (!cue) return null;
  const first = cues[0];
  const shown =
    interpolate(frame, [first.from, first.from + 8], [0, 1], clamp) *
    interpolate(frame, [total - 12, total - 2], [1, 0], clamp);
  const t = frame - cue.from;
  const textIn = interpolate(t, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const band = portrait
    ? { top: 1380, height: 340, left: 60, right: 60 }
    : { bottom: 36, height: 200, left: 160, right: 160 };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          ...band,
          display: 'flex',
          alignItems: portrait ? 'center' : 'flex-end',
          justifyContent: 'center',
          opacity: shown,
        }}
      >
        <div
          style={{
            maxWidth: portrait ? 960 : 1500,
            padding: portrait ? '22px 36px' : '18px 40px',
            borderRadius: 26,
            background: 'rgba(28,25,23,0.82)',
            boxShadow: '0 18px 40px rgba(28,25,23,0.25)',
            color: '#fff',
            fontSize: portrait ? 46 : 44,
            lineHeight: 1.4,
            fontWeight: 600,
            textAlign: 'center',
            direction: 'rtl',
            textWrap: 'balance',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              opacity: textIn,
              transform: `translateY(${(1 - textIn) * 8}px)`,
            }}
          >
            {cue.text}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Logo + one dot per feature scene, shown from the first feature to the end card. */
export function TourChrome({ schedule }: { schedule: TourSchedule }) {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const segs = schedule.segments;
  const features = segs.slice(1, -1);
  const first = features[0].start;
  const last = segs[segs.length - 1].start;
  const opacity = interpolate(frame, [first, first + 15, last, last + 10], [0, 1, 1, 0], clamp);
  if (opacity <= 0) return null;
  const current = features.findIndex((s) => frame >= s.start && frame < s.start + s.dur);
  const progress = (i: number) =>
    interpolate(frame, [features[i].start, features[i].start + features[i].dur], [0, 1], clamp);
  const dots = (
    <div style={{ display: 'flex', gap: 10, direction: 'rtl' }}>
      {features.map((s, i) => (
        <div
          key={s.id}
          style={{
            width: i === current ? 52 : 16,
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
              width: `${progress(i) * 100}%`,
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
            top: 80,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <LogoImg width={200} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 1790,
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
      <div style={{ position: 'absolute', top: 64, right: 120 }}>
        <LogoImg width={200} />
      </div>
      <div style={{ position: 'absolute', top: 806, right: 120 }}>{dots}</div>
    </AbsoluteFill>
  );
}
