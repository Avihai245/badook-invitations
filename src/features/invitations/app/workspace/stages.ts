/**
 * The event's space, grouped by the event's life (UX report §4.1): the event's home, then four stages —
 * planning, inviting, arranging, celebrating — and, at the bottom, insights and the event's settings.
 * Plain functions (the server's pages and the browser's navigation share them): which screen a path is,
 * which stage it belongs to, and each stage's status for its badge (✓ done / N open / starts in N days).
 */

import type { ToolKey } from '../../lib/tools';

export const STAGES = ['plan', 'invite', 'arrange', 'celebrate'] as const;
export type StageKey = (typeof STAGES)[number];

/** Each stage is one of the event's tools (lib/tools): a tool the host didn't ask for is not shown. */
export const STAGE_TOOL: Record<StageKey, ToolKey> = {
  plan: 'plan',
  invite: 'invite',
  arrange: 'seating',
  celebrate: 'day',
};

export type NavKey =
  | 'home'
  | 'tasks'
  | 'budget'
  | 'vendors'
  | 'ideas'
  | 'design'
  | 'guests'
  | 'share'
  | 'responses'
  | 'seating'
  | 'live'
  | 'gallery'
  | 'film'
  | 'insights'
  | 'settings';

/** Each screen's address under /app/invitations/<id> ('' is the event's home). */
export const NAV_PATHS: Record<NavKey, string> = {
  home: '',
  tasks: '/plan/tasks',
  budget: '/plan/budget',
  vendors: '/plan/vendors',
  ideas: '/plan/ideas',
  design: '/edit',
  guests: '/guests',
  share: '/share',
  responses: '/responses',
  seating: '/seating',
  live: '/live',
  gallery: '/gallery',
  film: '/gallery/film',
  insights: '/insights',
  settings: '/settings',
};

export const STAGE_ITEMS: Record<StageKey, NavKey[]> = {
  plan: ['tasks', 'budget', 'vendors', 'ideas'],
  invite: ['design', 'guests', 'share', 'responses'],
  arrange: ['seating'],
  celebrate: ['live', 'gallery', 'film'],
};

/** The screen a path is on, the most specific first (/gallery/film is the film, not the gallery). */
export function navKeyOf(path: string, id: string): NavKey | null {
  const base = `/app/invitations/${id}`;
  if (path === base || path === `${base}/`) return 'home';
  if (!path.startsWith(`${base}/`)) return null;
  const rest = path.slice(base.length);
  const keys = (Object.keys(NAV_PATHS) as NavKey[])
    .filter((k) => k !== 'home')
    .sort((a, b) => NAV_PATHS[b].length - NAV_PATHS[a].length);
  for (const k of keys) if (rest === NAV_PATHS[k] || rest.startsWith(`${NAV_PATHS[k]}/`)) return k;
  // the planning's own overview (/plan) and the seating's printouts belong to their stage
  if (rest === '/plan' || rest.startsWith('/plan/')) return 'tasks';
  return null;
}

/** The stage a screen is in — as the event shows its stages, when given (the guests sit with the seating without the invitation). */
export function stageOf(key: NavKey | null, caps?: WorkspaceCaps): StageKey | null {
  if (!key) return null;
  if (caps) for (const s of STAGES) if (stageItems(s, caps).includes(key)) return s;
  for (const s of STAGES) if (STAGE_ITEMS[s].includes(key)) return s;
  return null;
}

/** What the event offers (features and the deployment): a stage's screens that aren't there aren't shown. */
export interface WorkspaceCaps {
  /** the planning tools (tasks, budget, vendors, ideas) */
  planning: boolean;
  /** seating / the event day: on, or only the package keeps them off ('plan': offered with an upgrade) */
  seating: 'on' | 'plan' | null;
  eventDay: 'on' | 'plan' | null;
  gallery: boolean;
  insights: boolean;
  /** the tools the host asked for (lib/tools eventTools): the stages of the others are not shown */
  tools: readonly ToolKey[];
}

export function stageItems(stage: StageKey, caps: WorkspaceCaps): NavKey[] {
  if (!caps.tools.includes(STAGE_TOOL[stage])) return [];
  // seating without the invitation: the guest list is the seating's own first screen
  const items =
    stage === 'arrange' && !caps.tools.includes('invite')
      ? (['guests', 'seating'] as NavKey[])
      : STAGE_ITEMS[stage];
  return items.filter((k) => {
    if (stage === 'plan') return caps.planning;
    if (k === 'seating') return caps.seating !== null;
    if (k === 'live') return caps.eventDay !== null;
    if (k === 'gallery' || k === 'film') return caps.gallery;
    return true;
  });
}

/** What a stage's status is worked out from (all of it already on the workspace's header). */
export interface StageFacts {
  status: 'draft' | 'published' | 'archived';
  guests: number;
  sent: number;
  /** whole days to the event (0 on the day, negative after) */
  daysLeft: number;
  /** the plan: none yet (null), or its open tasks and this week's */
  plan: { open: number; week: number } | null;
  /** the seating: tables made and the confirmed guests not seated yet (null: not known) */
  seating: { tables: number; unseated: number } | null;
}

export type StageStatus =
  | { kind: 'done' }
  | { kind: 'open'; n: number }
  | { kind: 'week'; n: number }
  | { kind: 'inProgress' }
  | { kind: 'notStarted' }
  | { kind: 'draft' }
  | { kind: 'toSend'; n: number }
  | { kind: 'startsIn'; n: number }
  | { kind: 'today' }
  | { kind: 'none' };

export function stageStatus(stage: StageKey, f: StageFacts): StageStatus {
  switch (stage) {
    case 'plan':
      // the week's tasks, not the whole plan's open ones (thirty open tasks only frighten)
      if (!f.plan) return { kind: 'notStarted' };
      if (f.plan.week) return { kind: 'week', n: f.plan.week };
      return f.plan.open ? { kind: 'inProgress' } : { kind: 'done' };
    case 'invite':
      if (f.status !== 'published') return { kind: 'draft' };
      if (!f.guests) return { kind: 'notStarted' };
      return f.sent < f.guests ? { kind: 'toSend', n: f.guests - f.sent } : { kind: 'done' };
    case 'arrange':
      if (!f.seating) return { kind: 'none' };
      if (!f.seating.tables) return { kind: 'notStarted' };
      return f.seating.unseated ? { kind: 'open', n: f.seating.unseated } : { kind: 'done' };
    case 'celebrate':
      if (f.daysLeft > 0) return { kind: 'startsIn', n: f.daysLeft };
      if (f.daysLeft === 0) return { kind: 'today' };
      return { kind: 'done' };
  }
}

/** The facts as far as the server knows them: the days to the event wait for the visitor's own today. */
export type StageFactsSoFar = Omit<StageFacts, 'daysLeft'> & { daysLeft: number | null };

/** A stage's status once it can be told: "celebrate" counts days, the others don't need today. */
export function stageStatusSoFar(stage: StageKey, f: StageFactsSoFar): StageStatus | null {
  if (f.daysLeft === null && stage === 'celebrate') return null;
  return stageStatus(stage, { ...f, daysLeft: f.daysLeft ?? 0 });
}

/** How a stage's step is drawn: finished, with work going on, or not begun yet. */
export type StageProgress = 'done' | 'active' | 'waiting';

export function stageProgress(s: StageStatus | null): StageProgress {
  switch (s?.kind) {
    case 'done':
      return 'done';
    case 'open':
    case 'week':
    case 'inProgress':
    case 'toSend':
    case 'draft':
    case 'today':
      return 'active';
    default:
      return 'waiting';
  }
}

/** "Celebrate" opens by itself this many days before the event (and stays open after it). */
export const CELEBRATE_OPENS_DAYS = 30;

/**
 * Whether the sidebar shows a stage open before the host opens or closes it: the stage of the screen
 * they are on, and every stage with something left to do — a finished stage folds into its ✓ row.
 * "Celebrate" waits until a month before the event (its screens matter then, and after it: the gallery
 * and the film), so it stays closed until the visitor's today is known.
 */
export function stageOpenByDefault(stage: StageKey, f: StageFactsSoFar, viewing: StageKey | null): boolean {
  if (stage === viewing) return true;
  if (stage === 'celebrate') return f.daysLeft !== null && f.daysLeft <= CELEBRATE_OPENS_DAYS;
  return stageStatusSoFar(stage, f)?.kind !== 'done';
}

/** Whole days from `today` (YYYY-MM-DD) to the event's date (YYYY-MM-DD). */
export function daysTo(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
