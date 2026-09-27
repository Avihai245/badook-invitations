/* eslint-disable @next/next/no-img-element -- the logo is a small static PNG already sized for 2x, in two versions the look switches between by CSS: nothing for the image optimizer to add */
import type { ReactNode } from 'react';
import { cn } from './utils';

const LOGO = {
  src: '/brand/badook-logo.png',
  light: '/brand/badook-logo-light.png',
  width: 480,
  height: 161,
};

/**
 * The Badook logo (public/brand): the orange wordmark and its line "בדוק וסגרתם אירוע". Its height
 * follows the font size around it (2.1em). On a dark ground — the dark look, or `tone="onDark"` (the
 * home page's hero) — the line under the name is light; the orange is the same. The name is the
 * image's alt text; `suffix` is a word beside it (the admin console's "ניהול").
 */
export function BrandLogo({
  label,
  className,
  tone = 'auto',
  suffix,
}: {
  label: string;
  className?: string;
  tone?: 'auto' | 'onDark';
  suffix?: ReactNode;
}) {
  const img = (src: string, extra?: string) => (
    <img
      src={src}
      alt={label}
      width={LOGO.width}
      height={LOGO.height}
      decoding="async"
      className={cn('h-[2.1em] w-auto max-w-none shrink-0', extra)}
    />
  );
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {tone === 'onDark' ? (
        img(LOGO.light)
      ) : (
        <>
          {img(LOGO.src, 'dark:hidden')}
          {img(LOGO.light, 'hidden dark:block')}
        </>
      )}
      {suffix ? <span className="text-[0.8em] font-bold tracking-tight">{suffix}</span> : null}
    </span>
  );
}
