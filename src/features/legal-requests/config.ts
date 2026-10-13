/**
 * "Report content / request removal" and the privacy requests (supabase/migrations/*_legal_compliance.sql):
 * anyone, with or without an account, can report an item of an event gallery or ask about their personal
 * information; the team handles both from the admin console (/app/admin/legal). Pure — the same words and
 * limits for the server, the public forms and the console. The limits are the database's.
 */

export const REPORT_CATEGORIES = ['privacy', 'copyright', 'child_safety', 'harmful', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Who the reporter is in relation to the item (media_reports.role). */
export const REPORT_ROLES = ['uploader', 'depicted', 'guardian', 'copyright_owner', 'other'] as const;
export type ReportRole = (typeof REPORT_ROLES)[number];

export const REPORT_STATUSES = ['new', 'in_review', 'actioned', 'dismissed', 'closed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_RESOLUTIONS = ['hidden', 'removed', 'kept', 'host_handled', 'not_applicable'] as const;
export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number];

/** A staff decision on a report (media_report_admin_act). */
export const REPORT_ACTIONS = ['review', 'hide', 'restore', 'remove', 'keep', 'dismiss', 'close', 'note'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];
/** The decisions that end a report: the reporter is told the outcome. */
export const FINAL_REPORT_ACTIONS = ['remove', 'keep', 'dismiss', 'close'] as const;
/** The decisions that need a note (the database refuses them without one). */
export const NOTE_REQUIRED_ACTIONS = FINAL_REPORT_ACTIONS;
export const isFinalReportAction = (a: ReportAction) => (FINAL_REPORT_ACTIONS as readonly string[]).includes(a);

export const REQUEST_KINDS = [
  'access',
  'correction',
  'deletion',
  'restriction',
  'gallery_removal',
  'child_photo',
  'biometric_exclusion',
  'other',
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_RELATIONS = ['host', 'guest', 'guardian', 'depicted', 'other'] as const;
export type RequestRelation = (typeof REQUEST_RELATIONS)[number];

export const REQUEST_STATUSES = [
  'new',
  'verifying',
  'in_progress',
  'fulfilled',
  'partly',
  'declined',
  'closed',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
/** The statuses a staff member sets (privacy_request_admin_set). */
export const REQUEST_SET_STATUSES = REQUEST_STATUSES.filter((s) => s !== 'new');
export const FINAL_REQUEST_STATUSES = ['fulfilled', 'partly', 'declined', 'closed'] as const;
export const isFinalRequestStatus = (s: string) => (FINAL_REQUEST_STATUSES as readonly string[]).includes(s);
export const OPEN_REQUEST_STATUSES = ['new', 'verifying', 'in_progress'] as const;

export const LEGAL_REQUESTS = {
  description: { min: 10, max: 2000 },
  details: { min: 10, max: 4000 },
  reference: 500,
  name: 120,
  email: 254,
  /** media_reports.reporter_phone / privacy_requests.phone */
  phone: { min: 5, max: 30 },
  /** the staff's note on a report / on a request */
  reportNote: 2000,
  requestNote: 4000,
  /** per address (hashed): reports, and requests, an hour and a day */
  rate: { perHour: 5, perDay: 20 },
  /** the same address pointing at the same item for the same reason within this time is the same report */
  duplicateHours: 24,
  /** the console's lists */
  listLimit: 100,
} as const;

export const PHONE_RE = /^[+\d\s().-]{5,30}$/;
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export const isReportCategory = (v: unknown): v is ReportCategory =>
  typeof v === 'string' && (REPORT_CATEGORIES as readonly string[]).includes(v);
export const isRequestKind = (v: unknown): v is RequestKind =>
  typeof v === 'string' && (REQUEST_KINDS as readonly string[]).includes(v);

/** The console's link to a report or a request (the team's emails carry it; the page opens it). */
export const adminLegalHref = (tab: 'reports' | 'requests', id?: string): string =>
  `/app/admin/legal?tab=${tab}${id ? `&id=${id}` : ''}`;
