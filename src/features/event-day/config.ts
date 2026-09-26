/**
 * The event day's numbers in one place (isomorphic: the browser and the server read the same values).
 * The database's own limits — the stations' and the guide's rate limits — are in
 * supabase/migrations/*_event_day.sql.
 */
export const EVENT_DAY = {
  /**
   * After the event's start by this much, a family that hasn't arrived is counted as not coming: the
   * host's screen warns about tables still under half full, suggests merging half-empty ones, and a
   * re-seat counts only the people who came.
   */
  graceMinutes: 45,
  /** the host's live screen and the stations ask the server again this often when the live channel is down */
  pollHostMs: 15_000,
  pollStationMs: 10_000,
  /** the timeline of arrivals: one bar per this many minutes */
  timelineBucketMinutes: 5,
  /** merge suggestions shown at most */
  maxSuggestions: 5,
  /** a re-seat's reason */
  reasonLength: 200,
  /** a station's name, as its staff types it */
  stationNameLength: 40,
  /** the guest's map works without signal once loaded: kept for the evening */
  offlineHours: 36,
  /** people one check-in may bring */
  maxCount: 99,
  /** a scanned code shown again this soon is the same guest still in front of the camera */
  rescanMs: 4_000,
  /** arrivals are erased this many days after the event (the privacy policy; the daily run) */
  keepCheckinsDays: 30,
} as const;

/** The QR on a guest's table guide (and printed cards): "BDK1." and the entrance code. */
export const QR_PREFIX = 'BDK1.';
