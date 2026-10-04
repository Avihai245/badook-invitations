import { fmt } from '@/lib/i18n/app';
import type { AppDict } from '@/lib/i18n/app.he';
import type { SystemKey } from './types';

/**
 * What a system task is called, in the host's language. The five of the road to a perfect invitation
 * are named by the overview's steps (one text for both places); the others by the planning dictionary.
 */
const STEP_OF = {
  invitation_designed: 'design',
  invitation_published: 'publish',
  guests_uploaded: 'import',
  invites_sent: 'send',
  rsvp_tracked: 'track',
} as const;

export interface SystemText {
  title: string;
  body: string;
}

export function systemText(
  t: AppDict,
  key: SystemKey,
  /** the replies' numbers the head-count task quotes */
  confirmed: { adults: number; children: number },
): SystemText {
  if (key in STEP_OF) {
    const s = t.overview.steps[STEP_OF[key as keyof typeof STEP_OF]];
    return { title: s.title, body: s.body };
  }
  const S = t.planning.system;
  switch (key) {
    case 'rsvp_deadline':
      return { title: S.rsvp_deadline.title, body: S.rsvp_deadline.body };
    case 'final_headcount':
      return {
        title: fmt(confirmed.children > 0 ? S.final_headcount.title : S.final_headcount.titleAdults, {
          adults: confirmed.adults,
          children: confirmed.children,
        }),
        body: S.final_headcount.body,
      };
    case 'seating_done':
      return { title: S.seating_done.title, body: S.seating_done.body };
    case 'entry_station_ready':
      return { title: S.entry_station_ready.title, body: S.entry_station_ready.body };
    default:
      return { title: key, body: '' };
  }
}
