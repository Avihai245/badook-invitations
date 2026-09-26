import 'server-only';
import { EVENT_DAY } from '../config';
import { eventDayDb } from './db';

/**
 * What the privacy policy promises about arrivals (part of the daily run, features/jobs): who arrived
 * when is erased 30 days after the event, and an undone arrival after a day.
 */
export function eventDayHousekeeping() {
  return eventDayDb.maintenance(EVENT_DAY.keepCheckinsDays);
}
