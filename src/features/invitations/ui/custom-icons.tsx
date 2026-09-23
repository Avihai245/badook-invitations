import type { SVGProps } from 'react';

/**
 * The 3 custom icons from docs/invitations/icons/*.svg (24px grid, stroke = currentColor).
 * tests/unit/design-system.test.ts asserts these paths stay identical to the kit files.
 */
export const CUSTOM_ICON_PATHS = {
  chuppah: [
    'M3 8c2.5-3.6 15.5-3.6 18 0',
    'M3 8q1.5 2 3 0t3 0 3 0 3 0 3 0 3 0',
    'M4.5 9.3V21M19.5 9.3V21',
    'M2.5 21h19',
  ],
  rings: [
    { circle: { cx: 9, cy: 15, r: 5.5 } },
    { circle: { cx: 15, cy: 15, r: 5.5 } },
    'M12 6.5 13.5 4h3L18 6.5l-3 3z',
  ],
  toast: [
    'M4 3.5l5 1-1.2 5.2a2.5 2.5 0 0 1-3 1.8 2.5 2.5 0 0 1-1.7-2.9z',
    'M6.2 11.4 5.2 17.5M3.2 17.1l4 .8',
    'M20 3.5l-5 1 1.2 5.2a2.5 2.5 0 0 0 3 1.8 2.5 2.5 0 0 0 1.7-2.9z',
    'M17.8 11.4l1 6.1M20.8 17.1l-4 .8',
    'M12 .8v1.8M10.3 1.6l.8.8M13.7 1.6l-.8.8',
  ],
} as const;

export type CustomIconName = keyof typeof CUSTOM_ICON_PATHS;

export function CustomIcon({
  name,
  size = 20,
  strokeWidth = 1.5,
  ...rest
}: { name: CustomIconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {CUSTOM_ICON_PATHS[name].map((p, i) =>
        typeof p === 'string' ? <path key={i} d={p} /> : <circle key={i} {...p.circle} />,
      )}
    </svg>
  );
}
