import { clsx, type ClassValue } from 'clsx';

/** Joins class names (clsx). Also used to join space-separated id lists (aria-describedby). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Wrapper classes for an icon slot: every icon passed to a primitive gets the app stroke (1.75,
 * §9A.5) and never shrinks. Size is added per component (`[&_svg]:size-4`, …), so callers can pass
 * plain `<Send />` without size props — CSS beats lucide's width/height/stroke-width attributes.
 */
export const iconSlot =
  'inline-flex shrink-0 items-center justify-center [&_svg]:shrink-0 [&_svg]:stroke-[1.75]';
