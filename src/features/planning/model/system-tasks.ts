import type { SystemKey } from './types';

/**
 * What the app knows about an invitation, enough to tell which system tasks are done. One function
 * (systemTaskDone) answers for both the "road to a perfect invitation" on the overview and the
 * planning tasks, so the two can never disagree (features/invitations/app/overview).
 */
export interface SystemFacts {
  status: 'draft' | 'published' | 'archived';
  unpublishedChanges: boolean;
  /** guests on the list */
  guests: number;
  /** guests the invitation reached */
  sent: number;
  /** replies received */
  responses: number;
  /** the RSVP deadline (YYYY-MM-DD, in the event's zone) and today in the same zone; null: none set */
  deadline: string | null;
  today: string;
  /** seating: live tables, "yes" families without a table, and whether the entrance station exists */
  tables: number;
  confirmedUnseated: number;
  stationReady: boolean;
}

/** Facts when only the five overview steps are asked for. */
export const BASE_FACTS = {
  deadline: null,
  today: '1970-01-01',
  tables: 0,
  confirmedUnseated: 0,
  stationReady: false,
} as const satisfies Partial<SystemFacts>;

/**
 * Whether a system task is done by what the app can see. `final_headcount` is the host's own phone
 * call to the venue, so it is never derived (its status is the host's); `rsvp_deadline` is a
 * milestone: done once its day has passed.
 */
export function systemTaskDone(key: SystemKey, f: SystemFacts): boolean | null {
  switch (key) {
    case 'invitation_designed':
      // the host can reach the workspace only after the wizard made the design: always done
      return true;
    case 'invitation_published':
      return f.status === 'published' && !f.unpublishedChanges;
    case 'guests_uploaded':
      return f.guests > 0;
    case 'invites_sent':
      return f.guests > 0 && f.sent >= f.guests;
    case 'rsvp_tracked':
      return f.responses > 0;
    case 'rsvp_deadline':
      return f.deadline ? f.today > f.deadline : null;
    case 'seating_done':
      return f.tables > 0 && f.confirmedUnseated === 0;
    case 'entry_station_ready':
      return f.stationReady;
    case 'final_headcount':
      return null;
  }
}

/** Where a system task's button goes (relative to the invitation's workspace). */
export const SYSTEM_HREF: Record<SystemKey, string | null> = {
  invitation_designed: '/edit',
  invitation_published: '/edit?publish=1',
  guests_uploaded: '/guests?import=1',
  invites_sent: '/guests?send=1',
  rsvp_tracked: '/responses',
  rsvp_deadline: '/responses',
  final_headcount: '/responses',
  seating_done: '/seating',
  entry_station_ready: '/live',
};

/**
 * The system tasks a new plan starts with and when each is due, in days from the event (the RSVP
 * deadline's and the head-count's dates come from the invitation itself, these are only the place
 * they sort to when it has none). The tasks that need the seating or the event day are added only
 * when the event has those features.
 */
export const SYSTEM_TASK_OFFSETS: Record<SystemKey, number> = {
  invitation_designed: -75,
  invitation_published: -70,
  guests_uploaded: -65,
  invites_sent: -60,
  rsvp_tracked: -45,
  rsvp_deadline: -14,
  final_headcount: -13,
  seating_done: -10,
  entry_station_ready: -3,
};

export interface SystemTaskSpec {
  key: SystemKey;
  /** the task this plan gets for it (no title: a system task is named by the dictionary) */
  offset: number;
  minDays: number;
  /** needs the seating (`seating`) / the event day (`checkin`) feature */
  needs: 'seating' | 'checkin' | null;
}

const SPECS: readonly SystemTaskSpec[] = [
  { key: 'invitation_designed', offset: SYSTEM_TASK_OFFSETS.invitation_designed, minDays: 0, needs: null },
  { key: 'invitation_published', offset: SYSTEM_TASK_OFFSETS.invitation_published, minDays: 0, needs: null },
  { key: 'guests_uploaded', offset: SYSTEM_TASK_OFFSETS.guests_uploaded, minDays: 0, needs: null },
  { key: 'invites_sent', offset: SYSTEM_TASK_OFFSETS.invites_sent, minDays: 0, needs: null },
  { key: 'rsvp_tracked', offset: SYSTEM_TASK_OFFSETS.rsvp_tracked, minDays: 0, needs: null },
  { key: 'rsvp_deadline', offset: SYSTEM_TASK_OFFSETS.rsvp_deadline, minDays: 0, needs: null },
  { key: 'final_headcount', offset: SYSTEM_TASK_OFFSETS.final_headcount, minDays: 0, needs: null },
  { key: 'seating_done', offset: SYSTEM_TASK_OFFSETS.seating_done, minDays: 0, needs: 'seating' },
  {
    key: 'entry_station_ready',
    offset: SYSTEM_TASK_OFFSETS.entry_station_ready,
    minDays: 0,
    needs: 'checkin',
  },
];

/**
 * The system tasks a plan gets: all the basic ones; the seating and entrance ones only when the
 * template is a full one (or the event is a company event) and the event has the feature.
 */
export function systemTasksFor(opts: {
  size: 'full' | 'light';
  seating: boolean;
  checkin: boolean;
  seated: boolean;
}): SystemTaskSpec[] {
  return SPECS.filter((s) => {
    if (s.needs === null) return true;
    if (!opts.seated) return false;
    return s.needs === 'seating' ? opts.seating : opts.checkin;
  });
}
