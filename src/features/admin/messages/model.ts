/**
 * The console's messages area (/app/admin/messages): what the database counts (admin_messages_overview,
 * supabase/migrations/*_admin_money_messages.sql) and what is worked out from it here — totals and
 * rates, the days of a chart, the emails by group. Isomorphic and pure (tests/unit/admin-messages.test.ts).
 *
 * WhatsApp has three kinds, each from the system's number: the invitations (whatsapp_messages), the
 * table numbers on the event day (seating_notices) and the gallery links (gallery_notices). A message
 * counts on the day it was queued (Israel), with the status it has now.
 */

export const WA_KINDS = ['invitation', 'table', 'gallery'] as const;
export type WaKind = (typeof WA_KINDS)[number];
export const WA_STATUSES = ['queued', 'sending', 'sent', 'delivered', 'read', 'failed'] as const;
export type WaStatus = (typeof WA_STATUSES)[number];

export type EmailStatus = 'sent' | 'failed' | 'skipped';

export interface FailureRaw {
  id: string;
  kind: WaKind;
  at: string;
  error: string | null;
  invitationId: string;
  slug: string | null;
  /** the invitation's hosts (its draft), for its title */
  hosts: unknown;
  locale: string | null;
  ownerId: string;
  ownerName: string | null;
  /** masked for roles without users.pii */
  ownerEmail: string | null;
}

export interface QueueRow {
  kind: WaKind;
  /** waiting to go (retrying included) */
  queued: number;
  /** waiting for another try (Meta asked to slow down) */
  retrying: number;
  sending: number;
  /** sending for more than 10 minutes: the sender stopped (taken again, up to 3 tries) */
  stuck: number;
  /** the oldest one waiting (null: none) */
  oldestAt: string | null;
}

export interface MessagesRaw {
  /** the 30 days (Israel), first and last */
  from: string;
  to: string;
  days: { day: string; kind: WaKind; status: WaStatus; n: number }[];
  totals: { kind: WaKind; status: WaStatus; n: number; usd: number }[];
  /** what Meta charges for this month (USD) */
  monthUsd: number;
  queue: QueueRow[];
  /** failures by their error, the ten most common (30 days) */
  errors: { error: string; n: number; invitation: number; table: number; gallery: number; lastAt: string }[];
  failures: FailureRaw[];
  optOuts: { total: number; last30: number; reply: number; meta: number };
  emails: { day: string; kind: string; status: EmailStatus; n: number }[];
}

// ─── WhatsApp ──────────────────────────────────────────────────────────────────────────────────

export interface WaTotals {
  total: number;
  /** still queued or being sent */
  pending: number;
  /** accepted by WhatsApp: sent, delivered or read */
  sent: number;
  /** delivered or read */
  delivered: number;
  read: number;
  failed: number;
  /** what Meta charges for them: sent, delivered, read (USD) */
  usd: number;
  /** delivered ÷ (accepted + failed); null: none finished */
  deliveredRate: number | null;
  /** read ÷ delivered */
  readRate: number | null;
  /** failed ÷ (accepted + failed) */
  failRate: number | null;
}

const CHARGED: readonly WaStatus[] = ['sent', 'delivered', 'read'];

export function waTotals(rows: MessagesRaw['totals'], kind: WaKind | 'all' = 'all'): WaTotals {
  const of = (statuses: readonly WaStatus[]) =>
    rows
      .filter((r) => (kind === 'all' || r.kind === kind) && statuses.includes(r.status))
      .reduce((a, r) => a + r.n, 0);
  const sent = of(CHARGED);
  const delivered = of(['delivered', 'read']);
  const read = of(['read']);
  const failed = of(['failed']);
  const finished = sent + failed;
  return {
    total: of(WA_STATUSES),
    pending: of(['queued', 'sending']),
    sent,
    delivered,
    read,
    failed,
    usd: rows
      .filter((r) => (kind === 'all' || r.kind === kind) && CHARGED.includes(r.status))
      .reduce((a, r) => a + r.usd, 0),
    deliveredRate: finished > 0 ? delivered / finished : null,
    readRate: delivered > 0 ? read / delivered : null,
    failRate: finished > 0 ? failed / finished : null,
  };
}

/** Every day from `from` to `to` (YYYY-MM-DD), both included. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end && out.length < 400; t += 86_400_000)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export interface WaDay {
  day: string;
  read: number;
  /** delivered, not read (yet) */
  delivered: number;
  /** sent, not delivered (yet) */
  sent: number;
  failed: number;
  /** queued or being sent */
  pending: number;
}

/** A day per row of the chart (the stack's order: read at the bottom, then delivered, sent, failed, pending). */
export function waDays(raw: Pick<MessagesRaw, 'days' | 'from' | 'to'>, kind: WaKind | 'all'): WaDay[] {
  const byDay = new Map(
    daysBetween(raw.from, raw.to).map((day) => [
      day,
      { day, read: 0, delivered: 0, sent: 0, failed: 0, pending: 0 } as WaDay,
    ]),
  );
  for (const r of raw.days) {
    const d = byDay.get(r.day);
    if (!d || (kind !== 'all' && r.kind !== kind)) continue;
    const key: keyof Omit<WaDay, 'day'> =
      r.status === 'queued' || r.status === 'sending' ? 'pending' : r.status;
    d[key] += r.n;
  }
  return [...byDay.values()];
}

// ─── emails ────────────────────────────────────────────────────────────────────────────────────

/**
 * The emails' groups on the chart (five, so each keeps its color): guests' replies to hosts, the hosts'
 * daily summaries, the family's comments on a draft, the team's (money alerts, the contact form,
 * support), anything else.
 */
export const EMAIL_GROUPS = ['replies', 'digests', 'review', 'team', 'other'] as const;
export type EmailGroup = (typeof EMAIL_GROUPS)[number];

export function emailGroupOf(kind: string): EmailGroup {
  switch (kind) {
    case 'rsvp_reply':
      return 'replies';
    case 'rsvp_digest':
      return 'digests';
    case 'review':
      return 'review';
    case 'billing_alert':
    case 'contact':
    case 'support':
      return 'team';
    default:
      return 'other';
  }
}

export type EmailDay = { day: string } & Record<EmailGroup, number>;

export function emailDays(raw: Pick<MessagesRaw, 'emails' | 'from' | 'to'>): EmailDay[] {
  const byDay = new Map(
    daysBetween(raw.from, raw.to).map((day) => [
      day,
      { day, replies: 0, digests: 0, review: 0, team: 0, other: 0 } as EmailDay,
    ]),
  );
  for (const r of raw.emails) {
    const d = byDay.get(r.day);
    if (d) d[emailGroupOf(r.kind)] += r.n;
  }
  return [...byDay.values()];
}

export interface EmailKindTotals {
  kind: string;
  sent: number;
  failed: number;
  /** email isn't set up: only logged */
  skipped: number;
}

/** The 30 days' emails by kind, the most first. */
export function emailTotals(raw: Pick<MessagesRaw, 'emails'>): EmailKindTotals[] {
  const by = new Map<string, EmailKindTotals>();
  for (const r of raw.emails) {
    const t = by.get(r.kind) ?? { kind: r.kind, sent: 0, failed: 0, skipped: 0 };
    t[r.status] += r.n;
    by.set(r.kind, t);
  }
  return [...by.values()].sort(
    (a, b) => b.sent + b.failed + b.skipped - (a.sent + a.failed + a.skipped) || a.kind.localeCompare(b.kind),
  );
}
