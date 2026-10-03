import type { EventType } from '@/features/invitations/contracts/types';
import type { CategoryKey, CostBasis, Variant } from './categories';

/** A text in the two languages the host app speaks. */
export interface Bilingual {
  he: string;
  en: string;
}

/**
 * Tasks the app can tell are done by itself (from the invitation, the guest list, the replies, the
 * seating and the event day) — the "road to a perfect invitation" and two more — plus two that come
 * from data: the RSVP deadline and the final head-count that follows it. A system task is a row in
 * the host's list (its date, its order, whether it is hidden) whose status is derived, never stored.
 */
export const SYSTEM_KEYS = [
  'invitation_designed',
  'invitation_published',
  'guests_uploaded',
  'invites_sent',
  'rsvp_tracked',
  'rsvp_deadline',
  'final_headcount',
  'seating_done',
  'entry_station_ready',
] as const;
export type SystemKey = (typeof SYSTEM_KEYS)[number];
export const isSystemKey = (v: unknown): v is SystemKey => SYSTEM_KEYS.includes(v as SystemKey);

/** One task of a template: what to do and when, relative to the event's date. */
export interface TemplateTask {
  /** stable within the template (tests, de-duplication) */
  key: string;
  title: Bilingual;
  /** one short line of help, optional */
  notes?: Bilingual;
  /** days from the event's date: negative = before it, 0 = the day itself, positive = after */
  offset: number;
  /** the budget / vendor category it belongs to */
  category?: CategoryKey;
  /**
   * Fewer days than this left when the plan is made → the task is offered for hiding (it can no
   * longer be done the way it is meant: "book the hall" with ten days to go).
   */
  minDays?: number;
  /** 1 = important */
  priority?: 0 | 1;
  /** only for these wizard variants (all when omitted) */
  variants?: Variant[];
}

/** One budget category of a template: its recommended share of the total, and how its cost grows. */
export interface TemplateCategory {
  key: CategoryKey;
  /** the recommended share of the total budget, in percent (a template's shares add up to 100) */
  pct: number;
  basis: CostBasis;
}

/** What a plan starts from, for one kind of event. */
export interface PlanTemplate {
  key: string;
  /** the event types that start from it */
  eventTypes: readonly EventType[];
  /** 'full' = the whole road; 'light' = 10–20 tasks and a handful of categories */
  size: 'full' | 'light';
  /** the event-specific tasks (the system tasks are added by systemTasksFor) */
  tasks: readonly TemplateTask[];
  categories: readonly TemplateCategory[];
  /** vendor categories the event needs: "what is missing" lists those without a closed vendor */
  requiredVendors: readonly CategoryKey[];
}

/** The draft of a plan — a template's content in its stored shape (also a private template's). */
export interface PlanDraftTask {
  title: string;
  notes: string | null;
  offsetDays: number | null;
  dueDate: string | null;
  category: CategoryKey | null;
  priority: 0 | 1;
  systemKey: SystemKey | null;
  suggestHide: boolean;
  sort: number;
}
export interface PlanDraftCategory {
  key: CategoryKey;
  name: string;
  pct: number;
  basis: CostBasis;
  required: boolean;
  sort: number;
}
export interface PlanDraft {
  tasks: PlanDraftTask[];
  categories: PlanDraftCategory[];
  requiredVendors: CategoryKey[];
}
