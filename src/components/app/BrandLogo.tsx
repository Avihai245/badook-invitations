import { cn } from './utils';

/**
 * The Badook mark: an envelope closed with a wax seal (what every invitation opens with) and the
 * wordmark. Decorative mark, readable name.
 */
export function BrandLogo({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-[1.6em] shrink-0">
        <rect x="2.5" y="7" width="27" height="19" rx="4" fill="#F6EDE1" stroke="#A0703F" strokeWidth="1.6" />
        <path
          d="M3.8 9.2 16 18.2 28.2 9.2"
          fill="none"
          stroke="#A0703F"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="18.2" r="4.3" fill="#B5523B" />
        <circle cx="16" cy="18.2" r="2.1" fill="none" stroke="#F3C9B8" strokeWidth=".9" opacity=".8" />
      </svg>
      <span className="font-bold tracking-tight" dir="ltr">
        {label}
      </span>
    </span>
  );
}
