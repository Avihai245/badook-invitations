import type { CSSProperties } from 'react';
import { C, SHADOW } from '../theme';

export const FAMILY_COLORS = ['#a0703f', '#2a78d6', '#15803d', '#b45309', '#9b3a3f', '#1f5a66', '#5a3a7a'];

export type Shape = 'round' | 'square' | 'knights';

/** Chair centers around a table drawn at (0,0), in px — as the app spreads them (geometry.ts). */
export function chairs(shape: Shape, seats: number, w: number, h: number) {
  const gap = 24;
  if (shape === 'round') {
    const r = w / 2 + gap;
    return Array.from({ length: seats }, (_, i) => {
      const a = ((-90 + (i * 360) / seats) * Math.PI) / 180;
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    });
  }
  if (shape === 'square') {
    // the same number on every side (the first sides get the remainder)
    const out: { x: number; y: number }[] = [];
    for (let side = 0; side < 4; side++) {
      const n = Math.floor(seats / 4) + (side < seats % 4 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const along = ((k + 0.5) / n - 0.5) * w;
        const off = w / 2 + gap;
        out.push(
          side === 0
            ? { x: along, y: -off }
            : side === 1
              ? { x: off, y: along }
              : side === 2
                ? { x: -along, y: off }
                : { x: -off, y: -along },
        );
      }
    }
    return out;
  }
  // knights: along both long sides
  const per = Math.ceil(seats / 2);
  return Array.from({ length: seats }, (_, i) => {
    const side = i < per ? -1 : 1;
    const k = i < per ? i : i - per;
    const n = i < per ? per : seats - per;
    return { x: ((k + 0.5) / n - 0.5) * w, y: side * (h / 2 + gap) };
  });
}

/**
 * A table with its chairs: `filled` chairs taken (colored by `colors`, in order), the rest dashed.
 * `pop` 0→1 grows it in; `ring` 0→1 fills a green arrival ring (the event-day map).
 */
export function Table({
  x,
  y,
  shape,
  seats,
  w,
  h = w,
  filled = 0,
  colors = [],
  pop = 1,
  label,
  ring,
  highlight = 0,
  chairSize = 30,
}: {
  x: number;
  y: number;
  shape: Shape;
  seats: number;
  w: number;
  h?: number;
  filled?: number;
  colors?: string[];
  pop?: number;
  label?: string;
  ring?: number;
  highlight?: number;
  chairSize?: number;
}) {
  const spots = chairs(shape, seats, w, h);
  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: 0,
    height: 0,
    transform: `scale(${pop})`,
    opacity: Math.min(1, pop * 1.4),
  };
  return (
    <div style={style}>
      {spots.map((p, i) => {
        const taken = i < filled;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x - chairSize / 2,
              top: p.y - chairSize / 2,
              width: chairSize,
              height: chairSize,
              borderRadius: 999,
              background: taken ? (colors[i] ?? C.brand) : 'rgba(255,255,255,0.85)',
              border: taken ? '3px solid #fff' : `2.5px dashed ${C.lineStrong}`,
              boxShadow: taken ? SHADOW.sm : undefined,
              boxSizing: 'border-box',
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: -w / 2,
          top: -h / 2,
          width: w,
          height: h,
          borderRadius: shape === 'round' ? 999 : 14,
          background: C.surface,
          boxShadow: `${SHADOW.md}, 0 0 0 ${3 + highlight * 3}px ${highlight > 0.05 ? C.brand : C.brandLine}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {ring !== undefined ? (
          <svg
            width={w + 16}
            height={h + 16}
            style={{ position: 'absolute', left: -8, top: -8, transform: 'rotate(-90deg)' }}
          >
            <circle
              cx={(w + 16) / 2}
              cy={(h + 16) / 2}
              r={w / 2 + 4}
              fill="none"
              stroke={ring >= 0.999 ? C.success : '#22a35a'}
              strokeWidth={7}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - ring}
            />
          </svg>
        ) : null}
        {label ? (
          <div
            style={{
              fontSize: Math.min(26, w / 4.4),
              fontWeight: 800,
              color: C.ink,
              direction: 'ltr',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The hall from above: walls, the stage and the dance floor (fractions of the box it fills). */
export function Floor({
  width,
  height,
  style,
  stage = { x: 0.3, y: 0.03, w: 0.4, h: 0.12 },
  dance = { x: 0.33, y: 0.2, w: 0.34, h: 0.24 },
}: {
  width: number;
  height: number;
  style?: CSSProperties;
  stage?: { x: number; y: number; w: number; h: number };
  dance?: { x: number; y: number; w: number; h: number };
}) {
  const box = (r: { x: number; y: number; w: number; h: number }): CSSProperties => ({
    position: 'absolute',
    left: r.x * width,
    top: r.y * height,
    width: r.w * width,
    height: r.h * height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 22,
    borderRadius: 12,
  });
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        borderRadius: 26,
        background: '#fbf7f1',
        boxShadow: `${SHADOW.md}, inset 0 0 0 7px #a8977f`,
        ...style,
      }}
    >
      <div style={{ ...box(stage), background: '#efe2d0', color: C.brandDeep, border: `2px solid #c9a27a` }}>
        במה
      </div>
      <div
        style={{
          ...box(dance),
          color: '#8a6a4a',
          background:
            'repeating-linear-gradient(90deg, #f3e8d8 0px, #f3e8d8 22px, #eadbc6 22px, #eadbc6 24px)',
          border: '2px dashed #c9a27a',
        }}
      >
        רחבה
      </div>
    </div>
  );
}

/** A hall template drawn small (the cards in the app's picker). */
export function HallSketch({
  variant,
  width,
}: {
  variant: 'classic' | 'wide' | 'garden' | 'banquet';
  width: number;
}) {
  const height = (width * 2) / 3;
  const rounds = (pts: [number, number][]) =>
    pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.25} fill="#c9a27a" />);
  const grid = (xs: number[], ys: number[], skip: (x: number, y: number) => boolean) =>
    ys.flatMap((y) => xs.filter((x) => !skip(x, y)).map((x) => [x, y] as [number, number]));
  const shapes = {
    classic: (
      <>
        <rect
          x={11}
          y={0.8}
          width={8}
          height={2.4}
          rx={0.3}
          fill="#efe2d0"
          stroke="#c9a27a"
          strokeWidth={0.2}
        />
        <rect
          x={10.5}
          y={4}
          width={9}
          height={5.5}
          rx={0.3}
          fill="#f3e8d8"
          stroke="#c9a27a"
          strokeWidth={0.2}
        />
        {rounds(grid([3, 7, 23, 27], [5, 9.5, 14], () => false))}
        {rounds(grid([11, 15, 19], [13.5, 17.5], () => false))}
      </>
    ),
    wide: (
      <>
        <rect
          x={8}
          y={0.6}
          width={14}
          height={2}
          rx={0.3}
          fill="#efe2d0"
          stroke="#c9a27a"
          strokeWidth={0.2}
        />
        <rect
          x={7}
          y={3.4}
          width={16}
          height={4}
          rx={0.3}
          fill="#f3e8d8"
          stroke="#c9a27a"
          strokeWidth={0.2}
        />
        {rounds(grid([4, 8.5, 13, 17.5, 22, 26.5], [10.5, 15], () => false))}
      </>
    ),
    garden: (
      <>
        <rect
          x={12}
          y={0.6}
          width={6}
          height={1.8}
          rx={0.3}
          fill="#efe2d0"
          stroke="#c9a27a"
          strokeWidth={0.2}
        />
        <circle cx={15} cy={10.5} r={4} fill="#e4f1df" stroke="#8fb487" strokeWidth={0.2} />
        {rounds(
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return [15 + 9 * Math.cos(a), 10.5 + 6.6 * Math.sin(a)] as [number, number];
          }),
        )}
      </>
    ),
    banquet: (
      <>
        <rect
          x={11}
          y={0.6}
          width={8}
          height={2}
          rx={0.3}
          fill="#efe2d0"
          stroke="#c9a27a"
          strokeWidth={0.2}
        />
        <rect x={9.5} y={3.6} width={11} height={1.1} rx={0.2} fill="#b8895c" />
        {[7.5, 11.5, 15.5].map((y) =>
          [4, 16].map((x) => (
            <rect key={`${x}${y}`} x={x} y={y} width={10} height={1.1} rx={0.2} fill="#c9a27a" />
          )),
        )}
      </>
    ),
  };
  return (
    <svg width={width} height={height} viewBox="-0.5 -0.5 31 21" style={{ display: 'block' }}>
      <rect x={0} y={0} width={30} height={20} rx={0.5} fill="#fffdf9" stroke="#a8977f" strokeWidth={0.45} />
      {shapes[variant]}
    </svg>
  );
}

export const UploadIcon = ({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
    <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" strokeLinecap="round" />
  </svg>
);

export const PrintIcon = ({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <path d="M7 8V3h10v5" strokeLinejoin="round" />
    <rect x={3} y={8} width={18} height={9} rx={2} />
    <path d="M7 14h10v7H7z" strokeLinejoin="round" />
  </svg>
);
