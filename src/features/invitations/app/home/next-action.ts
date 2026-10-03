import { publishHref } from '../workspace/paths';

/**
 * "The next step", one engine (UX report §4.3): what matters most for an event right now, by where it
 * stands and how far away it is — replacing the overview's three competing lists ("what to do now",
 * the planning's next step, the road to a perfect invitation). The first action is the event home's hero
 * card; the next few are its "also worth doing". Pure: the event's home and the tests share it.
 */

export type ActionKey =
  | 'budget'
  | 'planSetup'
  | 'publish'
  | 'publishChanges'
  | 'guests'
  | 'send'
  | 'matchReplies'
  | 'remind'
  | 'seating'
  | 'gallery'
  | 'eventDay'
  | 'film'
  | 'insights'
  | 'tasks'
  | 'allSet';

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
  /** the planning: null when the event has none; else whether it is set up, its budget and this week */
  planning: { planned: boolean; totalBudget: number | null; week: number; open: number } | null;
  /** the seating (null: not offered) — its tables and the "yes" families without one */
  seating: { tables: number; unseated: number } | null;
  /** the event day's check-in and the live gallery are offered */
  eventDay: boolean;
  gallery: boolean;
}

export interface HomeAction {
  key: ActionKey;
  /** the count the action's words use (guests to send, tasks this week…) */
  n?: number;
  /** where it goes, under /app/invitations/<id> (or a full path from publishHref) */
  href: string;
  /** the tone of its card: the brand's, WhatsApp's for sending, the celebration's for the day itself */
  tone: 'brand' | 'whatsapp' | 'celebrate' | 'calm';
}

/** Every action that applies now, the most important first. */
export function homeActions(id: string, f: HomeFacts): HomeAction[] {
  const base = `/app/invitations/${id}`;
  const out: HomeAction[] = [];
  const add = (a: HomeAction) => out.push(a);
  const past = f.daysLeft < 0;
  const today = f.daysLeft === 0;
  const live = f.status === 'published';
  const noBudget = !!f.planning && (!f.planning.planned || f.planning.totalBudget === null);
  const seatingOpen = !!f.seating && (f.seating.tables === 0 || f.seating.unseated > 0);

  if (past) {
    if (f.gallery) add({ key: 'film', href: `${base}/gallery/film`, tone: 'celebrate' });
    add({ key: 'insights', href: `${base}/insights`, tone: 'calm' });
    return out;
  }
  if (today) {
    if (f.eventDay) add({ key: 'eventDay', href: `${base}/live`, tone: 'celebrate' });
    if (f.gallery) add({ key: 'gallery', href: `${base}/gallery`, tone: 'celebrate' });
  }

  // far enough away that the money comes first
  if (!today && noBudget && f.daysLeft > 60)
    add(
      f.planning!.planned
        ? { key: 'budget', href: `${base}/plan/budget`, tone: 'brand' }
        : { key: 'planSetup', href: `${base}/plan`, tone: 'brand' },
    );
  if (!live) add({ key: 'publish', href: publishHref(id), tone: 'brand' });
  if (!f.guests) add({ key: 'guests', href: `${base}/guests?import=1`, tone: 'brand' });
  else if (live && f.sent < f.guests)
    add({ key: 'send', n: f.guests - f.sent, href: `${base}/guests?send=1`, tone: 'whatsapp' });
  if (live && f.unpublishedChanges) add({ key: 'publishChanges', href: publishHref(id), tone: 'brand' });
  // two weeks before: the tables
  if (!today && seatingOpen && f.daysLeft < 14)
    add({ key: 'seating', n: f.seating!.unseated, href: `${base}/seating`, tone: 'brand' });
  if (f.unmatched) add({ key: 'matchReplies', n: f.unmatched, href: `${base}/guests`, tone: 'calm' });
  if (live && f.guests && f.sent >= f.guests && f.notAnswered)
    add({ key: 'remind', n: f.notAnswered, href: `${base}/guests`, tone: 'whatsapp' });
  // the rest, in a calmer order
  if (!today && noBudget && f.daysLeft <= 60)
    add(
      f.planning!.planned
        ? { key: 'budget', href: `${base}/plan/budget`, tone: 'brand' }
        : { key: 'planSetup', href: `${base}/plan`, tone: 'brand' },
    );
  if (!today && seatingOpen && f.daysLeft >= 14 && f.daysLeft <= 45)
    add({ key: 'seating', n: f.seating!.unseated, href: `${base}/seating`, tone: 'brand' });
  if (!today && f.gallery && f.daysLeft <= 30)
    add({ key: 'gallery', href: `${base}/gallery`, tone: 'brand' });
  if (f.planning?.planned && f.planning.week)
    add({ key: 'tasks', n: f.planning.week, href: `${base}/plan/tasks`, tone: 'brand' });
  if (!out.length) add({ key: 'allSet', href: `${base}/responses`, tone: 'calm' });
  return out;
}

/** The one action for the event's home hero card. */
export function getNextAction(id: string, f: HomeFacts): HomeAction {
  return homeActions(id, f)[0]!;
}

/** Up to three smaller suggestions after it ("also worth doing"). */
export function alsoWorth(id: string, f: HomeFacts, max = 3): HomeAction[] {
  return homeActions(id, f).slice(1, 1 + max);
}
