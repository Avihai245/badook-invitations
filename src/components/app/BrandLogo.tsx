/* The logo is a small static image already sized for 2x and 3x (AVIF / WebP), in two versions the look switches between by CSS: nothing for the image optimizer to add. */
import type { ReactNode } from 'react';
import { cn } from './utils';

/**
 * The logo's files (public/brand, from badook-logo[-light].png): AVIF and WebP at 240 and 360 px wide
 * (2x and 3x of the ~115 px it is shown at), content-hashed — cached for good (next.config.ts).
 */
const FILES = {
  dark: {
    avif: '/brand/badook-logo-240.5c37863668.avif 240w, /brand/badook-logo-360.d54b67750a.avif 360w',
    webp: '/brand/badook-logo-240.f138f56276.webp 240w, /brand/badook-logo-360.46f13ad321.webp 360w',
    src: '/brand/badook-logo-240.f138f56276.webp',
  },
  light: {
    avif: '/brand/badook-logo-light-240.f65a36dc71.avif 240w, /brand/badook-logo-light-360.4f922f5751.avif 360w',
    webp: '/brand/badook-logo-light-240.6759b05e6a.webp 240w, /brand/badook-logo-light-360.ec6c7761fb.webp 360w',
    src: '/brand/badook-logo-light-240.6759b05e6a.webp',
  },
} as const;
const LOGO = { width: 480, height: 161, sizes: '120px' };

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
  lazy = false,
}: {
  label: string;
  className?: string;
  tone?: 'auto' | 'onDark';
  suffix?: ReactNode;
  /** A logo below the first screen (the footer's): fetched when it nears the screen — the hidden look's never. */
  lazy?: boolean;
}) {
  const img = (file: (typeof FILES)[keyof typeof FILES], extra?: string) => (
    <picture className={cn('contents', extra)}>
      <source type="image/avif" srcSet={file.avif} sizes={LOGO.sizes} />
      <img
        src={file.src}
        srcSet={file.webp}
        sizes={LOGO.sizes}
        alt={label}
        width={LOGO.width}
        height={LOGO.height}
        decoding="async"
        loading={lazy ? 'lazy' : undefined}
        className={cn('h-[2.1em] w-auto max-w-none shrink-0', extra)}
      />
    </picture>
  );
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {tone === 'onDark' ? (
        img(FILES.light)
      ) : (
        <>
          {img(FILES.dark, 'dark:hidden')}
          {img(FILES.light, 'hidden dark:block')}
        </>
      )}
      {suffix ? <span className="text-[0.8em] font-bold tracking-tight">{suffix}</span> : null}
    </span>
  );
}
