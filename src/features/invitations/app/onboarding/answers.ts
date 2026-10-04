import type { EventType } from '../../contracts/types';

/**
 * What the host answered in the start wizard, kept for the next screen in this tab (the gallery's
 * create wizard reads it to prefill the date and names, and to set the plan up with the budget and the
 * guests). Session storage: it may be empty (a private window, another tab) — then nothing is prefilled.
 */
export interface StartAnswers {
  eventType: EventType;
  date: string | null;
  guests: number | null;
  budget: number | null;
  start: 'plan' | 'design' | 'all';
  names: { primary: string; secondary: string; parents: string };
}

const KEY = 'badook:start';

export function saveAnswers(a: StartAnswers): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* nothing to prefill later */
  }
}

export function readAnswers(): StartAnswers | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StartAnswers) : null;
  } catch {
    return null;
  }
}

export function clearAnswers(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* gone with the tab anyway */
  }
}

/** A whole, non-negative number typed by the host ("1,200" too); null when empty, undefined when not a number. */
export function parseWhole(text: string, max: number): number | null | undefined {
  const clean = text.replace(/[,\s₪]/g, '');
  if (!clean) return null;
  if (!/^\d+$/.test(clean)) return undefined;
  const n = Number(clean);
  return n <= max ? n : undefined;
}

/**
 * The plan a new event starts with from these answers: the planning template for its type, the budget
 * split in whole shekels, the expected guests as the budget's head-count (until there is a list).
 */
export function planInit(a: Pick<StartAnswers, 'budget' | 'guests'>, template: string) {
  return {
    op: 'init' as const,
    template,
    totalBudget: a.budget,
    guestBasis: 'manual' as const,
    ...(a.guests ? { manualAdults: a.guests, manualChildren: 0 } : {}),
    integrationsMode: 'recommended' as const,
  };
}
