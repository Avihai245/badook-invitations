import type { SVGProps } from 'react';

/**
 * The custom icons from docs/invitations/icons/*.svg (24px grid, stroke = currentColor).
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
  // T3: teens & music
  'pixel-heart': ['M5 3h6v2h2V3h6v2h2v8h-2v2h-2v2h-2v2h-2v2h-2v-2H9v-2H7v-2H5v-2H3V5h2z', 'M7 9V7h2'],
  'mirror-ball': [
    'M12 1.5v3.3',
    { circle: { cx: 12, cy: 13, r: 8.2 } },
    'M4.4 9.6q7.6 2.2 15.2 0',
    'M3.8 13.2q8.2 2 16.4 0',
    'M5 16.8q7 1.8 14 0',
    'M12 4.8c-7.5 3.1-7.5 13.3 0 16.4',
    'M12 4.8c7.5 3.1 7.5 13.3 0 16.4',
    'M12 4.8v16.4',
    'M20.5 2.5v3M19 4h3',
  ],
  'ballet-slippers': [
    'M5.2 10.3c-1 1.8-1 4.7-.1 7.3.4 1.2.9 2.2 1.5 2.9h1.5c.6-.9.9-2.3 1-3.8.1-2.6-.4-5.2-1.4-6.8-.8-.4-1.8-.3-2.5.4z',
    'M5.3 12.1c.9.6 2.1.6 3-.2',
    'M18.8 10.3c1 1.8 1 4.7.1 7.3-.4 1.2-.9 2.2-1.5 2.9h-1.5c-.6-.9-.9-2.3-1-3.8-.1-2.6.4-5.2 1.4-6.8.8-.4 1.8-.3 2.5.4z',
    'M18.7 12.1c-.9.6-2.1.6-3-.2',
    'M6.6 10 11.2 4M17.4 10 12.8 4',
    'M12 3.8c-1.5-1.6-3.6-1.8-3.4-.5.2 1.1 2 1.2 3.4.5zM12 3.8c1.5-1.6 3.6-1.8 3.4-.5-.2 1.1-2 1.2-3.4.5z',
    'M11.2 4.3 10 6.6M12.8 4.3 14 6.6',
  ],
  vinyl: [
    { circle: { cx: 12, cy: 12, r: 9.5 } },
    { circle: { cx: 12, cy: 12, r: 3.2 } },
    { circle: { cx: 12, cy: 12, r: 0.6 } },
    'M17.4 12A5.4 5.4 0 0 0 12 6.6',
    'M6.6 12a5.4 5.4 0 0 0 5.4 5.4',
    'M5.6 8.4a7.4 7.4 0 0 1 3-2.8',
  ],
  cassette: [
    'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z',
    'M6 8.5h12v5H6z',
    { circle: { cx: 9, cy: 11, r: 1.4 } },
    { circle: { cx: 15, cy: 11, r: 1.4 } },
    'M10.4 11h3.2',
    'M7 18.5 8.2 16h7.6l1.2 2.5',
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
