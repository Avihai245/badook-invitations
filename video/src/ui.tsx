import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, SHADOW } from './theme';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function useLayout() {
  const { width, height } = useVideoConfig();
  return { portrait: height > width, width, height };
}

/** A spring from 0 to 1 starting at `delay` frames (local to the current Sequence). */
export function useSpringAt() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (delay: number, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) =>
    spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140, mass: 0.9, ...config } });
}

export function Card({
  children,
  style,
  radius = 24,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  radius?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        background: C.surface,
        borderRadius: radius,
        boxShadow: `${SHADOW.md}, 0 0 0 1px rgba(122,82,48,0.06)`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  bg = C.brandSoft,
  color = C.brandDeep,
  style,
}: {
  children: ReactNode;
  bg?: string;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 18px',
        borderRadius: 999,
        background: bg,
        color,
        fontWeight: 700,
        fontSize: 22,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- icons (SVG: no emoji fonts in headless Chromium) ---------- */

export const CheckIcon = ({
  size = 24,
  color = 'currentColor',
  stroke = 3.2,
  progress = 1,
}: {
  size?: number;
  color?: string;
  stroke?: number;
  progress?: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M4.5 12.5l5 5L19.5 7"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

export const DoubleCheck = ({ size = 28, color = C.wa }: { size?: number; color?: string }) => (
  <svg width={size * 1.3} height={size} viewBox="0 0 31 24" fill="none">
    <path d="M2 13l5 5L18 6" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 16l2 2L25 6" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SparkleIcon = ({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z" />
    <path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z" opacity={0.8} />
  </svg>
);

export const MusicIcon = ({ size = 26, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M9 18.5a3 3 0 11-2-2.83V5.5l12-2.5v12.5a3 3 0 11-2-2.83V7.4L9 9.1z" />
  </svg>
);

export const WhatsAppIcon = ({ size = 30, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2.5a9.5 9.5 0 00-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1012 2.5z"
      stroke={color}
      strokeWidth={1.9}
      strokeLinejoin="round"
    />
    <path
      d="M8.6 7.6c.2-.4.5-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.4 0 .6.5.9 1.6 2 2.6 2.5.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.3.1.4.3.4.5 0 .6-.3 1.4-1 1.8-.7.4-1.7.5-3.5-.3-1.9-.9-3.4-2.6-4.1-3.8-.8-1.4-.6-2.6-.4-3.1z"
      fill={color}
    />
  </svg>
);

export const PlayIcon = ({ size = 40, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export const LinkIcon = ({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2.2}
    strokeLinecap="round"
  >
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </svg>
);

export const CameraIcon = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <path
      d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
      strokeLinejoin="round"
    />
    <circle cx={12} cy={13} r={3.5} />
  </svg>
);

/** A mouse pointer (the "hand" doing the demo). */
export const Cursor = ({ x, y, pressed = 0 }: { x: number; y: number; pressed?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, zIndex: 50, pointerEvents: 'none' }}>
    {pressed > 0 ? (
      <div
        style={{
          position: 'absolute',
          left: -26,
          top: -26,
          width: 52,
          height: 52,
          borderRadius: 999,
          border: `3px solid ${C.brand}`,
          opacity: 1 - pressed,
          transform: `scale(${0.4 + pressed * 1.2})`,
        }}
      />
    ) : null}
    <svg
      width={44}
      height={44}
      viewBox="0 0 24 24"
      style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.25))' }}
    >
      <path
        d="M5 3l13 7.5-5.6 1.4L10 17.5z"
        fill={C.ink}
        stroke="#fff"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

export function Avatar({
  label,
  color,
  size = 48,
  style,
}: {
  label: string;
  color: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

/* ---------- invitation posters ---------- */

export interface PosterTheme {
  bg: string;
  ink: string;
  accent: string;
  kicker: string;
  names: string;
  date: string;
  motif: 'stars' | 'rings' | 'petals' | 'arch';
}

export const POSTERS: PosterTheme[] = [
  {
    bg: 'linear-gradient(170deg,#1d2b4f 0%,#3b3a6b 55%,#a0703f 130%)',
    ink: '#fdf3e1',
    accent: '#e9c58b',
    kicker: 'מתחתנים',
    names: 'דנה & יואב',
    date: '12.06.2027',
    motif: 'stars',
  },
  {
    bg: 'linear-gradient(170deg,#f8ebe4 0%,#f3d9c9 60%,#e8b9a0 100%)',
    ink: '#5b3a2a',
    accent: '#a0703f',
    kicker: 'מתחתנים',
    names: 'נועה & איתי',
    date: '04.09.2027',
    motif: 'petals',
  },
  {
    bg: 'linear-gradient(170deg,#163a2e 0%,#2f6b4f 70%,#c9b27c 140%)',
    ink: '#f4efe0',
    accent: '#d8c38b',
    kicker: 'בר מצווה',
    names: 'אורי',
    date: '21.03.2027',
    motif: 'rings',
  },
  {
    bg: 'linear-gradient(170deg,#6b1f2e 0%,#9b3a3f 60%,#e0a96d 130%)',
    ink: '#fff2df',
    accent: '#f0c27a',
    kicker: 'חינה',
    names: 'מיכל & עומר',
    date: '30.05.2027',
    motif: 'arch',
  },
  {
    bg: 'linear-gradient(170deg,#dbe7f6 0%,#c3d6f0 50%,#f6e3d5 100%)',
    ink: '#2c3e5c',
    accent: '#6b8cc7',
    kicker: 'ברית',
    names: 'בן לנו!',
    date: '15.01.2027',
    motif: 'stars',
  },
  {
    bg: 'linear-gradient(170deg,#f6ede1 0%,#ead8c0 60%,#c9a57c 100%)',
    ink: '#4a3220',
    accent: '#7a5230',
    kicker: 'מתחתנים',
    names: 'שירה & דניאל',
    date: '18.10.2027',
    motif: 'arch',
  },
  {
    bg: 'linear-gradient(170deg,#2a1b3d 0%,#5a3a7a 60%,#e8a2b8 130%)',
    ink: '#fbeefe',
    accent: '#f3b6cf',
    kicker: 'בת מצווה',
    names: 'ליה',
    date: '07.07.2027',
    motif: 'petals',
  },
  {
    bg: 'linear-gradient(170deg,#0f2f3a 0%,#1f5a66 60%,#e6c79c 130%)',
    ink: '#eef7f5',
    accent: '#e6c79c',
    kicker: 'מתחתנים',
    names: 'רוני & גל',
    date: '22.08.2027',
    motif: 'rings',
  },
];

export function Poster({
  theme,
  width,
  names,
  date,
  t = 0,
  style,
}: {
  theme: PosterTheme;
  width: number;
  names?: string;
  date?: string;
  /** time in frames, for the motif's motion */
  t?: number;
  style?: CSSProperties;
}) {
  const h = (width * 16) / 9;
  const u = width / 100; // one unit = 1% of the width
  return (
    <div
      style={{
        position: 'relative',
        width,
        height: h,
        borderRadius: Math.max(14, u * 7),
        background: theme.bg,
        overflow: 'hidden',
        color: theme.ink,
        fontFamily: FONT,
        flexShrink: 0,
        ...style,
      }}
    >
      <Motif theme={theme} w={width} h={h} t={t} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: u * 8,
        }}
      >
        <div style={{ fontSize: u * 6.5, fontWeight: 600, letterSpacing: u * 0.4, color: theme.accent }}>
          {theme.kicker}
        </div>
        <div
          style={{
            width: u * 18,
            height: Math.max(1, u * 0.5),
            background: theme.accent,
            margin: `${u * 4}px 0`,
            opacity: 0.8,
          }}
        />
        <div style={{ fontSize: u * 13, fontWeight: 800, lineHeight: 1.08 }}>{names ?? theme.names}</div>
        <div
          style={{
            fontSize: u * 6.5,
            fontWeight: 600,
            marginTop: u * 5,
            letterSpacing: u * 0.3,
            direction: 'ltr',
          }}
        >
          {date ?? theme.date}
        </div>
        <div style={{ fontSize: u * 4.8, fontWeight: 400, marginTop: u * 2, opacity: 0.8 }}>נשמח לראותכם</div>
      </div>
    </div>
  );
}

function Motif({ theme, w, h, t }: { theme: PosterTheme; w: number; h: number; t: number }) {
  const a = theme.accent;
  if (theme.motif === 'stars') {
    return (
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 22 }, (_, i) => {
          const x = ((i * 37) % 100) / 100;
          const y = ((i * 53) % 100) / 100;
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(t / 14 + i));
          return (
            <circle key={i} cx={x * w} cy={y * h * 0.9} r={(1 + (i % 3)) * (w / 260)} fill={a} opacity={tw} />
          );
        })}
      </svg>
    );
  }
  if (theme.motif === 'rings') {
    return (
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        {[0, 1, 2, 3].map((i) => (
          <circle
            key={i}
            cx={w / 2}
            cy={h / 2}
            r={w * (0.32 + i * 0.12) + Math.sin(t / 20 + i) * (w / 60)}
            fill="none"
            stroke={a}
            strokeOpacity={0.35 - i * 0.06}
            strokeWidth={Math.max(1, w / 220)}
          />
        ))}
      </svg>
    );
  }
  if (theme.motif === 'petals') {
    return (
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const x = (((i * 41) % 100) / 100) * w + Math.sin(t / 18 + i) * (w / 25);
          const y = ((((i * 29) % 100) / 100) * h + t * (w / 160) * (1 + (i % 3) * 0.4)) % h;
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx={w / 40}
              ry={w / 70}
              fill={a}
              opacity={0.45}
              transform={`rotate(${(i * 40 + t * 2) % 360} ${x} ${y})`}
            />
          );
        })}
      </svg>
    );
  }
  // arch
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
      <path
        d={`M ${w * 0.14} ${h * 0.86} V ${h * 0.36} A ${w * 0.36} ${w * 0.36} 0 0 1 ${w * 0.86} ${h * 0.36} V ${h * 0.86}`}
        fill="none"
        stroke={a}
        strokeOpacity={0.6}
        strokeWidth={Math.max(1, w / 150)}
      />
      <path
        d={`M ${w * 0.19} ${h * 0.84} V ${h * 0.37} A ${w * 0.31} ${w * 0.31} 0 0 1 ${w * 0.81} ${h * 0.37} V ${h * 0.84}`}
        fill="none"
        stroke={a}
        strokeOpacity={0.3}
        strokeWidth={Math.max(1, w / 300)}
      />
      {Array.from({ length: 5 }, (_, i) => (
        <circle
          key={i}
          cx={w * (0.2 + i * 0.15)}
          cy={h * 0.12 + Math.sin(t / 15 + i) * (w / 50)}
          r={w / 70}
          fill={a}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}

/** A phone frame; children fill its screen. */
export function Phone({
  width,
  children,
  style,
}: {
  width: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const h = width * 2.05;
  const bezel = width * 0.035;
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height: h,
        borderRadius: width * 0.14,
        background: '#141210',
        padding: bezel,
        boxShadow: `${SHADOW.xl}, inset 0 0 0 2px #3a3633`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: width * 0.11,
          overflow: 'hidden',
          background: C.canvas,
        }}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            top: width * 0.03,
            left: '50%',
            width: width * 0.28,
            height: width * 0.075,
            marginLeft: -width * 0.14,
            borderRadius: 999,
            background: '#141210',
          }}
        />
      </div>
    </div>
  );
}

/** Typewriter: the text shown at `frame` when deleting `from` then typing `to` (chars per frame `speed`). */
export function retype(from: string, to: string, frame: number, start: number, speed = 0.7) {
  const fromChars = Array.from(from);
  const toChars = Array.from(to);
  const del = Math.floor(Math.max(0, frame - start) * speed * 1.6);
  if (del < fromChars.length)
    return { text: fromChars.slice(0, fromChars.length - del).join(''), done: false };
  const typeStart = start + fromChars.length / (speed * 1.6);
  const typed = Math.floor(Math.max(0, frame - typeStart) * speed);
  return { text: toChars.slice(0, typed).join(''), done: typed >= toChars.length };
}

/** Move along a list of [frame, value] keyframes with an ease. */
export function keyframes(frame: number, points: [number, number][], ease?: (t: number) => number) {
  return interpolate(
    frame,
    points.map((p) => p[0]),
    points.map((p) => p[1]),
    { ...clamp, easing: ease },
  );
}
