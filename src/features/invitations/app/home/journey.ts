import type { ToolKey } from '../../lib/tools';
import { publishHref } from '../workspace/paths';

/**
 * The event's path — one engine for every screen (the event's home, the card on the list): the steps the
 * host's chosen tools (lib/tools) call for, in plain words, each done, current, to do, or waiting for
 * something before it. Only the tools the host asked for: a host who wants a digital invitation sees
 * four steps (the invitation, the guests, sending, the replies); one who only plans sees the plan; one
 * who also seats the guests sees the tables. Exactly one step is current — the one thing to do now.
 * Pure: the server, the browser and the tests share it.
 */

export interface HomeFacts {
  /** whole days to the event, in its own time zone (0: today, negative: it has passed) */
  daysLeft: number;
  status: 'draft' | 'published' | 'archived';
  unpublishedChanges: boolean;
  /** guests on the list, reached by the invitation, and without a reply of their own */
  guests: number;
  sent: number;
  notAnswered: number;
  /** replies through the general link, matched to no guest */
  unmatched: number;
  /** every reply (a guest's own or through the general link) */
  responses: number;
  /** the planning: null when unknown or not offered; else whether it is set up, its budget and this week */
  planning: { planned: boolean; totalBudget: number | null; week: number; open: number } | null;
  /** the seating (null: not known) — its tables and the "yes" families without one */
  seating: { tables: number; unseated: number } | null;
  /** the event day's check-in and the live gallery are offered */
  eventDay: boolean;
  gallery: boolean;
}

export type StepKey = 'invitation' | 'guests' | 'send' | 'rsvp' | 'plan' | 'seating' | 'day';

/** Each step's wording, by where it stands (the i18n's journey.steps[key][variant]). */
export interface StepVariants {
  invitation: 'publish' | 'changes' | 'done';
  guests: 'add' | 'link' | 'done';
  send: 'waiting' | 'send' | 'share' | 'done';
  rsvp: 'waiting' | 'follow' | 'remind' | 'match' | 'done';
  plan: 'setup' | 'budget' | 'tasks' | 'onTrack' | 'done';
  seating: 'waiting' | 'start' | 'open' | 'done';
  day: 'soon' | 'prepare' | 'today' | 'after';
}

/**
 * done: finished. current: the one thing to do now. todo: there to do, after the current one. waiting:
 * nothing to do yet (sending before the invitation is live, the event day two weeks before it).
 */
export type StepState = 'done' | 'current' | 'todo' | 'waiting';

export type JourneyStep = {
  [K in StepKey]: {
    key: K;
    tool: ToolKey;
    variant: StepVariants[K];
    state: StepState;
    /** the count the step's words use (guests to send, tasks this week…) */
    n?: number;
    /** where its button goes */
    href: string;
    /** a second, smaller way: a general link instead of a list, changing the design */
    alt?: { key: 'shareLink' | 'editDesign'; href: string };
  };
}[StepKey];

export interface Journey {
  steps: JourneyStep[];
  /** the one step to do now (null: nothing to do — everything done, or waiting) */
  current: JourneyStep | null;
  done: number;
  total: number;
}

type Draft = Omit<JourneyStep, 'state'> & { complete: boolean; ready: boolean };

/** The event day's screens: the entrance when there is one, else the gallery. */
function dayHref(base: string, f: HomeFacts) {
  return f.eventDay ? `${base}/live` : `${base}/gallery`;
}

function inviteSteps(id: string, base: string, f: HomeFacts): Draft[] {
  const live = f.status === 'published';
  const viaLink = f.guests === 0 && f.responses > 0;
  const out: Draft[] = [
    live && f.unpublishedChanges
      ? {
          key: 'invitation',
          tool: 'invite',
          variant: 'changes',
          href: publishHref(id),
          complete: false,
          ready: true,
        }
      : live
        ? {
            key: 'invitation',
            tool: 'invite',
            variant: 'done',
            href: `${base}/edit`,
            complete: true,
            ready: true,
          }
        : {
            key: 'invitation',
            tool: 'invite',
            variant: 'publish',
            href: publishHref(id),
            complete: false,
            ready: true,
          },
    f.guests > 0
      ? {
          key: 'guests',
          tool: 'invite',
          variant: 'done',
          n: f.guests,
          href: `${base}/guests`,
          complete: true,
          ready: true,
        }
      : viaLink
        ? {
            key: 'guests',
            tool: 'invite',
            variant: 'link',
            href: `${base}/share`,
            complete: true,
            ready: true,
          }
        : {
            key: 'guests',
            tool: 'invite',
            variant: 'add',
            href: `${base}/guests?import=1`,
            alt: { key: 'shareLink', href: `${base}/share` },
            complete: false,
            ready: true,
          },
  ];
  // sending: once the invitation is live — to the list on WhatsApp, or the general link when there's no list
  if (!live)
    out.push({
      key: 'send',
      tool: 'invite',
      variant: 'waiting',
      href: publishHref(id),
      complete: false,
      ready: false,
    });
  else if (f.guests > 0)
    out.push(
      f.sent >= f.guests
        ? {
            key: 'send',
            tool: 'invite',
            variant: 'done',
            href: `${base}/guests`,
            complete: true,
            ready: true,
          }
        : {
            key: 'send',
            tool: 'invite',
            variant: 'send',
            n: f.guests - f.sent,
            href: `${base}/guests?send=1`,
            complete: false,
            ready: true,
          },
    );
  else
    out.push({
      key: 'send',
      tool: 'invite',
      variant: viaLink ? 'done' : 'share',
      href: `${base}/share`,
      complete: viaLink,
      ready: true,
    });
  // the replies: after sending; replies to match, then a reminder to whoever didn't answer
  const sentAll = live && (f.guests > 0 ? f.sent >= f.guests : f.responses > 0);
  if (f.unmatched > 0)
    out.push({
      key: 'rsvp',
      tool: 'invite',
      variant: 'match',
      n: f.unmatched,
      href: `${base}/guests`,
      complete: false,
      ready: true,
    });
  else if (!live || (!sentAll && f.responses === 0))
    out.push({
      key: 'rsvp',
      tool: 'invite',
      variant: 'waiting',
      href: `${base}/responses`,
      complete: false,
      ready: false,
    });
  else if (f.guests > 0 && f.sent >= f.guests && f.notAnswered > 0)
    out.push({
      key: 'rsvp',
      tool: 'invite',
      variant: 'remind',
      n: f.notAnswered,
      href: `${base}/guests`,
      complete: false,
      ready: f.daysLeft >= 0,
    });
  else if (f.guests > 0 && f.sent >= f.guests && f.notAnswered === 0)
    out.push({
      key: 'rsvp',
      tool: 'invite',
      variant: 'done',
      href: `${base}/responses`,
      complete: true,
      ready: true,
    });
  else
    out.push({
      key: 'rsvp',
      tool: 'invite',
      variant: 'follow',
      href: `${base}/responses`,
      // a general link has no end: following the replies is never "to do" by itself
      complete: false,
      ready: false,
    });
  return out;
}

function planStep(base: string, f: HomeFacts): Draft {
  const p = f.planning;
  if (!p || !p.planned)
    return {
      key: 'plan',
      tool: 'plan',
      variant: 'setup',
      href: `${base}/plan`,
      complete: false,
      ready: true,
    };
  if (p.totalBudget === null)
    return {
      key: 'plan',
      tool: 'plan',
      variant: 'budget',
      href: `${base}/plan/budget`,
      complete: false,
      ready: true,
    };
  if (p.week > 0)
    return {
      key: 'plan',
      tool: 'plan',
      variant: 'tasks',
      n: p.week,
      href: `${base}/plan/tasks`,
      complete: false,
      ready: true,
    };
  if (p.open > 0)
    // nothing due this week: the plan goes on by itself — not "to do" now
    return {
      key: 'plan',
      tool: 'plan',
      variant: 'onTrack',
      n: p.open,
      href: `${base}/plan/tasks`,
      complete: false,
      ready: false,
    };
  return { key: 'plan', tool: 'plan', variant: 'done', href: `${base}/plan`, complete: true, ready: true };
}

function seatingStep(base: string, f: HomeFacts, tools: ReadonlySet<ToolKey>): Draft {
  const href = `${base}/seating`;
  if (f.seating && f.seating.tables > 0 && f.seating.unseated === 0)
    return { key: 'seating', tool: 'seating', variant: 'done', href, complete: true, ready: true };
  if (f.seating && f.seating.tables > 0)
    return {
      key: 'seating',
      tool: 'seating',
      variant: 'open',
      n: f.seating.unseated,
      href,
      complete: false,
      ready: true,
    };
  // with the invitation, the tables wait for the first replies; without it, the host seats their own list
  const waiting = tools.has('invite') && f.responses === 0;
  return {
    key: 'seating',
    tool: 'seating',
    variant: waiting ? 'waiting' : 'start',
    href,
    complete: false,
    ready: !waiting,
  };
}

/** Two weeks before the event its day's screens come forward; on the day it's the one step. */
export const DAY_OPENS_DAYS = 14;

function dayStep(base: string, f: HomeFacts): Draft {
  if (f.daysLeft < 0)
    return {
      key: 'day',
      tool: 'day',
      variant: 'after',
      href: f.gallery ? `${base}/gallery/film` : `${base}/insights`,
      complete: false,
      ready: true,
    };
  if (f.daysLeft === 0)
    return {
      key: 'day',
      tool: 'day',
      variant: 'today',
      href: dayHref(base, f),
      complete: false,
      ready: true,
    };
  if (f.daysLeft <= DAY_OPENS_DAYS)
    return {
      key: 'day',
      tool: 'day',
      variant: 'prepare',
      href: dayHref(base, f),
      complete: false,
      ready: true,
    };
  return { key: 'day', tool: 'day', variant: 'soon', href: dayHref(base, f), complete: false, ready: false };
}

/** Far from the event the plan comes first; closer, the invitation does. */
export const PLAN_FIRST_DAYS = 60;

/**
 * The event's path by the host's tools. `tools` are the tools the event shows that it can also use
 * (lib/tools eventTools, without what the event doesn't offer).
 */
export function journey(id: string, f: HomeFacts, tools: ReadonlySet<ToolKey>): Journey {
  const base = `/app/invitations/${id}`;
  const invite = tools.has('invite') ? inviteSteps(id, base, f) : [];
  const plan = tools.has('plan') ? [planStep(base, f)] : [];
  const drafts: Draft[] = [
    ...(f.daysLeft > PLAN_FIRST_DAYS ? [...plan, ...invite] : [...invite, ...plan]),
    ...(tools.has('seating') ? [seatingStep(base, f, tools)] : []),
    ...(tools.has('day') ? [dayStep(base, f)] : []),
  ];
  // after the event: only what's left of it (the film, the numbers) and what was already done
  const past = f.daysLeft < 0;
  const steps = past ? drafts.filter((d) => d.complete || d.key === 'day') : drafts;

  // the current step: the day itself on the day, changes the guests don't see yet, else the first to do
  const urgent =
    steps.find((d) => d.key === 'day' && (d.variant === 'today' || d.variant === 'after')) ??
    steps.find((d) => d.key === 'invitation' && d.variant === 'changes');
  const current = urgent ?? steps.find((d) => !d.complete && d.ready) ?? null;
  const out = steps.map(({ complete, ready, ...s }) => ({
    ...s,
    state: (s.key === current?.key ? 'current' : complete ? 'done' : ready ? 'todo' : 'waiting') as StepState,
  })) as JourneyStep[];
  const done = out.filter((s) => s.state === 'done').length;
  return {
    steps: out,
    current: out.find((s) => s.state === 'current') ?? null,
    done,
    total: out.length,
  };
}
