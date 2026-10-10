import { planRank, type PlanId } from '@/features/billing/plans';
import type { HHmm, ISODate } from '@/features/invitations/contracts/types';
import { addDaysISO, zonedTimeToUtc } from '@/features/invitations/lib/dates';
import type { MessageKind } from './catalog';

/**
 * Smart scheduling for an event's WhatsApp messages, as plain math (tests/unit/whatsapp-schedule.test.ts):
 * the four ready sequences, the dates each stage suggests from the event's own dates (squeezed, or
 * fewer follow-ups, when the event is close), what a host's sequence must respect before it is turned
 * on, and how many messages it may take. Isomorphic: the screen shows exactly what the server checks.
 * A stage is one approved template (catalog.ts) sent at a moment to an audience the system picks when
 * the moment comes — the RSVP answers as they are then.
 */

export const PRESETS = ['basic', 'advanced', 'smart', 'premium'] as const;
export type Preset = (typeof PRESETS)[number];
export const isPreset = (v: unknown): v is Preset => PRESETS.includes(v as Preset);
/** The sequence the screen recommends (and opens on). */
export const RECOMMENDED_PRESET: Preset = 'smart';

/** The lowest plan each sequence comes with (the admins have every plan). */
export const PRESET_MIN_PLAN: Record<Preset, PlanId> = {
  basic: 'free',
  advanced: 'free',
  smart: 'pro',
  premium: 'business',
};
export const presetAllowed = (preset: Preset, plan: PlanId, admin = false) =>
  admin || planRank(plan) >= planRank(PRESET_MIN_PLAN[preset]);

export const STAGE_KINDS = ['invitation', 'followup', 'event_reminder', 'thanks', 'custom'] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

/**
 * Who a stage goes to, decided when it is sent: everyone; who the invitation hasn't reached yet; who
 * got it and hasn't answered; who said they're coming; who said they aren't; who arrived (checked in).
 */
export const AUDIENCES = ['not_received', 'unanswered', 'attending', 'declined', 'all', 'arrived'] as const;
export type Audience = (typeof AUDIENCES)[number];

/** The messages and audiences each kind of stage may use (the extra stages of Premium: any). */
export const STAGE_MESSAGES: Record<StageKind, readonly MessageKind[]> = {
  invitation: ['invitation'],
  followup: ['reminder'],
  event_reminder: ['event_reminder'],
  thanks: ['thanks', 'album'],
  custom: ['invitation', 'reminder', 'event_reminder', 'thanks', 'album'],
};
export const STAGE_AUDIENCES: Record<StageKind, readonly Audience[]> = {
  invitation: ['not_received'],
  followup: ['unanswered'],
  event_reminder: ['attending', 'all'],
  thanks: ['attending', 'all', 'arrived'],
  custom: AUDIENCES,
};
/** The audience a message suits best (a custom stage changing its message moves to it). */
export const MESSAGE_AUDIENCE: Record<MessageKind, Audience> = {
  invitation: 'not_received',
  reminder: 'unanswered',
  event_reminder: 'attending',
  thanks: 'attending',
  album: 'attending',
};

/** Each sequence's stages, by key (a key names a stage within the event). */
export const PRESET_STAGES: Record<Preset, readonly string[]> = {
  basic: ['invitation', 'event_reminder'],
  advanced: ['invitation', 'followup1', 'followup2', 'event_reminder'],
  smart: ['invitation', 'followup1', 'followup2', 'followup3', 'event_reminder', 'thanks'],
  premium: [
    'invitation',
    'followup1',
    'followup2',
    'followup3',
    'event_reminder',
    'thanks',
    'custom1',
    'custom2',
  ],
};
export const kindOfKey = (key: string): StageKind =>
  key.startsWith('followup') ? 'followup' : key.startsWith('custom') ? 'custom' : (key as StageKind);

export type StageStatus = 'scheduled' | 'done' | 'failed' | 'missed' | 'canceled';

/** A stage as the screen edits it: its moment in the event's own time zone. */
export interface StageDraft {
  key: string;
  kind: StageKind;
  message: MessageKind;
  audience: Audience;
  /** the host's own name for an extra stage (null: the kind's name) */
  label: string | null;
  date: ISODate;
  time: HHmm;
  enabled: boolean;
  /** stored stages: where they stand (a new one is 'scheduled') */
  status?: StageStatus;
}

/** Why the suggested dates moved: the event is close. */
export type ScheduleNote =
  | { code: 'compressed' }
  | { code: 'tooClose'; disabled: number }
  | { code: 'eveReminder' }
  | { code: 'eventPast' };

export interface ScheduleContext {
  /** today and now in the event's time zone */
  today: ISODate;
  now: HHmm;
  eventDate: ISODate;
  startTime: HHmm;
  rsvpDeadline: ISODate | null;
  /** the host's choice for the invitation's day (else: tomorrow) */
  inviteDate?: ISODate | null;
  /** the album can go with the thank-you (the plan has it and it's on) */
  album: boolean;
}

export const DEFAULT_TIME: HHmm = '11:00';
const FOLLOWUP_GAPS = [3, 7] as const;
/** The last follow-up's distance from the event (and from the RSVP deadline, one day). */
const LAST_FOLLOWUP_BEFORE_EVENT = 5;

/** Whole days from a to b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const t = (d: ISODate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86_400_000);
}
const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b);
const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b);

/** The next half hour at least 30 minutes from `now` (a send today), never before 09:00. */
function soonTime(now: HHmm): HHmm | null {
  const [h, m] = now.split(':').map(Number) as [number, number];
  const t = Math.max(9 * 60, Math.ceil((h * 60 + m + 30) / 30) * 30);
  if (t > 21 * 60) return null;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Spreads `n` follow-ups over the days after the invitation up to `last`: the usual gaps when they fit
 * in order, else evenly over the days there are — and when there are fewer days than follow-ups, one a
 * day and the rest off.
 */
export function followupDates(
  invite: ISODate,
  last: ISODate,
  n: number,
  idealLast: ISODate,
): { dates: ISODate[]; enabled: number; compressed: boolean } {
  if (n === 0) return { dates: [], enabled: 0, compressed: false };
  // three days after the invitation, a week after it, and (a third) a few days before the event
  const ideal = [...FOLLOWUP_GAPS.map((g) => addDaysISO(invite, g)), idealLast].slice(0, n);
  const ordered = ideal.every((d, i) => d > (i ? ideal[i - 1]! : invite) && d <= last);
  if (ordered) return { dates: ideal, enabled: n, compressed: false };
  const window = daysBetween(invite, last);
  if (window >= n) {
    const dates = Array.from({ length: n }, (_, i) => addDaysISO(invite, Math.round(((i + 1) * window) / n)));
    return { dates, enabled: n, compressed: true };
  }
  const fit = Math.max(0, window);
  const dates = Array.from({ length: n }, (_, i) => addDaysISO(invite, Math.min(i + 1, Math.max(fit, 1))));
  return { dates, enabled: fit, compressed: true };
}

/** A sequence's stages with dates suggested from the event, and why they moved (notes). */
export function defaultStages(
  preset: Preset,
  ctx: ScheduleContext,
): { stages: StageDraft[]; notes: ScheduleNote[] } {
  const notes: ScheduleNote[] = [];
  const keys = PRESET_STAGES[preset];
  const eventPast = ctx.eventDate < ctx.today;
  if (eventPast) notes.push({ code: 'eventPast' });
  const tomorrow = addDaysISO(ctx.today, 1);
  // the invitation: the host's day, else tomorrow — today when tomorrow is the event's day
  let invite = ctx.inviteDate && ctx.inviteDate >= ctx.today ? ctx.inviteDate : tomorrow;
  if (invite >= ctx.eventDate) invite = ctx.today;
  const inviteTime = invite === ctx.today ? (soonTime(ctx.now) ?? DEFAULT_TIME) : DEFAULT_TIME;
  // follow-ups end the day before the event, or the day before the RSVP deadline
  const dayBefore = addDaysISO(ctx.eventDate, -1);
  const last = ctx.rsvpDeadline
    ? minDate(dayBefore, maxDate(addDaysISO(ctx.rsvpDeadline, -1), invite))
    : dayBefore;
  const idealLast = minDate(addDaysISO(ctx.eventDate, -LAST_FOLLOWUP_BEFORE_EVENT), last);
  const followupKeys = keys.filter((k) => k.startsWith('followup'));
  const f = followupDates(invite, last, followupKeys.length, idealLast);
  if (f.enabled < followupKeys.length)
    notes.push({ code: 'tooClose', disabled: followupKeys.length - f.enabled });
  else if (f.compressed) notes.push({ code: 'compressed' });
  // the reminder: the event's morning — or the evening before, for an event that starts before noon
  const morningEvent = ctx.startTime < '12:00';
  if (morningEvent && keys.includes('event_reminder')) notes.push({ code: 'eveReminder' });

  const stages = keys.map((key): StageDraft => {
    const kind = kindOfKey(key);
    const base = { key, kind, label: null, enabled: true };
    switch (kind) {
      case 'invitation':
        return { ...base, message: 'invitation', audience: 'not_received', date: invite, time: inviteTime };
      case 'followup': {
        const i = followupKeys.indexOf(key);
        return {
          ...base,
          message: 'reminder',
          audience: 'unanswered',
          date: f.dates[i]!,
          time: DEFAULT_TIME,
          enabled: i < f.enabled,
        };
      }
      case 'event_reminder':
        return {
          ...base,
          message: 'event_reminder',
          audience: 'attending',
          date: morningEvent ? dayBefore : ctx.eventDate,
          time: morningEvent ? '19:00' : '10:00',
        };
      case 'thanks':
        return {
          ...base,
          message: ctx.album ? 'album' : 'thanks',
          audience: 'attending',
          date: addDaysISO(ctx.eventDate, 1),
          time: '12:00',
        };
      case 'custom':
        // two extra touches before the event: an early reminder to who's coming, a last call to who hasn't answered
        return key === 'custom1'
          ? {
              ...base,
              message: 'event_reminder',
              audience: 'attending',
              date: maxDate(addDaysISO(ctx.eventDate, -3), addDaysISO(invite, 1)),
              time: '19:00',
              enabled: daysBetween(invite, ctx.eventDate) > 3,
            }
          : {
              ...base,
              message: 'reminder',
              audience: 'unanswered',
              date: maxDate(addDaysISO(ctx.eventDate, -2), addDaysISO(invite, 1)),
              time: '10:00',
              enabled: daysBetween(invite, ctx.eventDate) > 2,
            };
    }
  });
  // an event already behind: only what comes after it is left
  if (eventPast) for (const s of stages) if (s.kind !== 'thanks') s.enabled = false;
  return { stages, notes };
}

/** The UTC moment of a stage's date and time in the event's time zone. */
export const stageInstant = (s: Pick<StageDraft, 'date' | 'time'>, timeZone: string): number =>
  zonedTimeToUtc(s.date, s.time, timeZone).getTime();

/** A UTC moment as a date, a time and a weekday (0 = Sunday) in a time zone. */
export function zonedParts(ms: number, timeZone: string): { date: ISODate; time: HHmm; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? 'Sun');
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`,
    weekday,
  };
}

export type IssueCode =
  | 'plan'
  | 'none'
  | 'past'
  | 'template'
  | 'album'
  | 'albumFallback'
  | 'afterEvent'
  | 'reminderAfterStart'
  | 'thanksBeforeEnd'
  | 'beforeInvitation'
  | 'audience'
  | 'message'
  | 'notPublished'
  | 'notConfigured'
  | 'night'
  | 'shabbat'
  | 'noCheckins';

export interface Issue {
  level: 'error' | 'warning';
  code: IssueCode;
  /** the stage it is about (none: the whole sequence) */
  key?: string;
}

export interface ValidateContext {
  now: number;
  timeZone: string;
  /** the event's start and end (UTC ms) */
  eventStart: number;
  eventEnd: number;
  approved: readonly MessageKind[];
  /** the album can be sent (the plan has it and it's on) */
  album: boolean;
  plan: PlanId;
  admin: boolean;
  published: boolean;
  configured: boolean;
  /** the event has check-ins (the "arrived" audience means something) */
  checkins: boolean;
}

/** A stage that will still run: on, and not run yet. */
export const pendingStage = (s: Pick<StageDraft, 'enabled' | 'status'>) =>
  s.enabled && (!s.status || s.status === 'scheduled');

/** What keeps a sequence from being turned on (errors) and what the host should look at (warnings). */
export function validateSchedule(
  preset: Preset,
  stages: readonly StageDraft[],
  ctx: ValidateContext,
): Issue[] {
  const issues: Issue[] = [];
  if (!ctx.configured) issues.push({ level: 'error', code: 'notConfigured' });
  if (!ctx.published) issues.push({ level: 'error', code: 'notPublished' });
  if (!presetAllowed(preset, ctx.plan, ctx.admin)) issues.push({ level: 'error', code: 'plan' });
  const live = stages.filter(pendingStage);
  if (!live.length) issues.push({ level: 'error', code: 'none' });
  const invitation = live.find((s) => s.kind === 'invitation');
  const inviteAt = invitation ? stageInstant(invitation, ctx.timeZone) : null;
  for (const s of live) {
    const at = stageInstant(s, ctx.timeZone);
    const add = (level: Issue['level'], code: IssueCode) => issues.push({ level, code, key: s.key });
    if (!STAGE_MESSAGES[s.kind].includes(s.message)) add('error', 'message');
    if (!STAGE_AUDIENCES[s.kind].includes(s.audience)) add('error', 'audience');
    if (!Number.isFinite(at) || at < ctx.now + 60_000) add('error', 'past');
    if (s.message === 'album' && !ctx.album)
      add(
        ctx.approved.includes('thanks') ? 'warning' : 'error',
        ctx.approved.includes('thanks') ? 'albumFallback' : 'album',
      );
    else if (!ctx.approved.includes(s.message)) add('error', 'template');
    if ((s.kind === 'invitation' || s.kind === 'followup') && at >= ctx.eventStart)
      add('error', 'afterEvent');
    if (s.kind === 'event_reminder' && at >= ctx.eventStart) add('error', 'reminderAfterStart');
    if (s.kind === 'thanks' && at < ctx.eventEnd) add('error', 'thanksBeforeEnd');
    if (s.kind === 'followup' && inviteAt !== null && at <= inviteAt) add('error', 'beforeInvitation');
    if (s.audience === 'arrived' && !ctx.checkins) add('warning', 'noCheckins');
    if (Number.isFinite(at)) {
      const { time, weekday } = zonedParts(at, ctx.timeZone);
      if (time < '08:00' || time >= '22:00') add('warning', 'night');
      // Friday afternoon to Saturday night: many guests keep Shabbat
      else if ((weekday === 5 && time >= '16:00') || (weekday === 6 && time < '20:00'))
        add('warning', 'shabbat');
    }
  }
  return issues;
}

/** A guest as the estimate sees them. */
export interface EstimateGuest {
  /** the system's number can reach them (a mobile, not opted out) */
  reachable: boolean;
  /** the invitation reached them (sent, delivered, read or opened) */
  received: boolean;
  answer: 'yes' | 'no' | null;
  arrived?: boolean;
}

/**
 * How many messages a stage may take: `now` — its audience today; `upTo` — the most it could be
 * when it runs (a guest who hasn't answered may still say yes; the invitation stage reaches who it
 * reaches before the follow-ups). A stage that ran counts nothing.
 */
export function estimateStage(
  s: Pick<StageDraft, 'audience' | 'enabled' | 'status'>,
  guests: readonly EstimateGuest[],
  invitationFirst: boolean,
): { now: number; upTo: number } {
  if (!pendingStage(s)) return { now: 0, upTo: 0 };
  const r = guests.filter((g) => g.reachable);
  const count = (f: (g: EstimateGuest) => boolean) => r.filter(f).length;
  const open = (g: EstimateGuest) => g.answer === null;
  switch (s.audience) {
    case 'all':
      return { now: r.length, upTo: r.length };
    case 'not_received': {
      const n = count((g) => !g.received && open(g));
      return { now: n, upTo: n };
    }
    case 'unanswered':
      return {
        now: count((g) => g.received && open(g)),
        upTo: count((g) => open(g) && (g.received || invitationFirst)),
      };
    case 'attending':
    case 'declined': {
      const answer = s.audience === 'attending' ? 'yes' : 'no';
      return { now: count((g) => g.answer === answer), upTo: count((g) => g.answer === answer || open(g)) };
    }
    case 'arrived':
      return { now: count((g) => !!g.arrived), upTo: count((g) => g.answer === 'yes' || !!g.arrived) };
  }
}
