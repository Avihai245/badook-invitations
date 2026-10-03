/**
 * The event's space, grouped by the event's life (UX report §4.1): the event's home, then four stages —
 * planning, inviting, arranging, celebrating — and, at the bottom, insights and the event's settings.
 * Plain functions (the server's pages and the browser's navigation share them): which screen a path is,
 * which stage it belongs to, and each stage's status for its badge (✓ done / N open / starts in N days).
 */

export const STAGES = ['plan', 'invite', 'arrange', 'celebrate'] as const;
export type StageKey = (typeof STAGES)[number];

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

export function stageOf(key: NavKey | null): StageKey | null {
  if (!key) return null;
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
}

export function stageItems(stage: StageKey, caps: WorkspaceCaps): NavKey[] {
  return STAGE_ITEMS[stage].filter((k) => {
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
  /** the plan: none yet (null), or its open tasks */
  plan: { open: number } | null;
  /** the seating: tables made and the confirmed guests not seated yet (null: not known) */
  seating: { tables: number; unseated: number } | null;
}

export type StageStatus =
  | { kind: 'done' }
  | { kind: 'open'; n: number }
  | { kind: 'notStarted' }
  | { kind: 'draft' }
  | { kind: 'toSend'; n: number }
  | { kind: 'startsIn'; n: number }
  | { kind: 'today' }
  | { kind: 'none' };

export function stageStatus(stage: StageKey, f: StageFacts): StageStatus {
  switch (stage) {
    case 'plan':
      if (!f.plan) return { kind: 'notStarted' };
      return f.plan.open ? { kind: 'open', n: f.plan.open } : { kind: 'done' };
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

/** Whole days from `today` (YYYY-MM-DD) to the event's date (YYYY-MM-DD). */
export function daysTo(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
