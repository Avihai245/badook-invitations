import type { CSSProperties } from 'react';
import { cn } from './utils';

export type SkeletonShape = 'block' | 'line' | 'circle';

export type SkeletonProps = {
  /** block = card/poster area (radius 12) · line = text line (12px, pill) · circle = avatar/icon. */
  shape?: SkeletonShape;
  /** Geometry lives in props (inline style) so it never fights utility classes. Numbers are px. */
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
};

const DEFAULTS: Record<
  SkeletonShape,
  { width: number | string; height: number | string; radius: number | string }
> = {
  block: { width: '100%', height: 80, radius: 12 },
  line: { width: '100%', height: 12, radius: 999 },
  circle: { width: 40, height: 40, radius: 999 },
};

/**
 * Placeholder shaped like the final UI (§9B.H — never page spinners). Gentle opacity pulse, static under
 * prefers-reduced-motion. Decorative: mark the loading region with `aria-busy` instead.
 */
export function Skeleton({ shape = 'block', width, height, radius, className, style }: SkeletonProps) {
  const d = DEFAULTS[shape];
  const w = width ?? d.width;
  const h = height ?? (shape === 'circle' && width !== undefined ? width : d.height);
  return (
    <span
      aria-hidden
      data-skeleton=""
      className={cn('block shrink-0 bg-line/70 motion-safe:animate-pulse', className)}
      style={{ width: w, height: h, borderRadius: radius ?? d.radius, ...style }}
    />
  );
}
