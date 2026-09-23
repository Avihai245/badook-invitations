import type { KeyboardEvent } from 'react';

const KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * `onKeyDown` for single-select groups (radiogroup / tablist) whose items carry `data-roving-item`.
 * Arrows follow the VISUAL order: the direction is read from the group's computed CSS `direction`
 * at key time, so ArrowLeft moves to the next item in RTL — correct for any `dir` ancestor, with no
 * context or hydration involved. Home/End jump, focus wraps, disabled items are skipped, and the
 * newly focused item is activated via `click()` (automatic activation).
 */
export function rovingKeyDown(event: KeyboardEvent<HTMLElement>): void {
  if (!KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
  const group = event.currentTarget;
  const items = Array.from(group.querySelectorAll<HTMLElement>('[data-roving-item]')).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
  );
  if (items.length === 0) return;

  const current = items.findIndex((el) => el.contains(document.activeElement));
  let next: number;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  else {
    const rtl = getComputedStyle(group).direction === 'rtl';
    const forward = event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    next = (Math.max(current, 0) + (forward ? 1 : -1) + items.length) % items.length;
  }

  event.preventDefault();
  const target = items[next];
  if (!target || target === items[current]) return;
  target.focus();
  target.click();
}
