import 'server-only';
import type { ScheduledSend, SendKind } from '../types';
import type { ScheduleDb } from './db';

/**
 * The clock's turn for what hosts scheduled (features/jobs runClock, every minute): the sends whose
 * moment has come — the database hands each to one server (scheduled_send_claim) — run as the host
 * would from the dialog: the guest list as it is now, the ones the send is for (the system's number
 * reaches them, nothing on its way to them, and — unless it is for everyone — they haven't got it), sent
 * the same way (a credit each, in each guest's language), the rest going out with the WhatsApp queue.
 * How it went is kept on the send for the host to see. Plain functions over injected dependencies
 * (tests/unit/scheduler.test.ts).
 */

/** A guest of the send dialog's list (the gallery link's and the album's alike). */
export interface NoticeRow {
  guestId: string;
  reach: 'ok' | 'none' | 'landline' | 'opted_out';
  queued: boolean;
  last: { status: string } | null;
}

export type ApiResult = { status: number; body: Record<string, unknown> };

/** What each kind needs: the dialog's list, and its send (as the host's own). */
export interface KindRunner {
  state(ownerId: string, invitationId: string): Promise<ApiResult>;
  send(
    ownerId: string,
    invitationId: string,
    body: { action: 'send'; guestIds: string[] },
  ): Promise<ApiResult>;
}

export interface RunDeps {
  db: Pick<ScheduleDb, 'claim' | 'finish'>;
  runners: Record<SendKind, KindRunner>;
}

export interface RunSummary {
  ran: number;
  done: number;
  failed: number;
}

/** A run that died is taken again after this long (at most three tries). */
const STALE_SECONDS = 600;

/** The guests a send is for, from the dialog's list as it is now. */
export function recipients(rows: readonly NoticeRow[], audience: ScheduledSend['audience']): string[] {
  return rows
    .filter(
      (r) => r.reach === 'ok' && !r.queued && (audience === 'all' || !r.last || r.last.status === 'failed'),
    )
    .map((r) => r.guestId);
}

/** One send: { status, result, error } as it is kept. */
export async function runOne(
  s: ScheduledSend,
  runner: KindRunner,
): Promise<{ status: 'done' | 'failed'; result: Record<string, unknown> | null; error: string | null }> {
  const state = await runner.state(s.ownerId, s.invitationId);
  if (state.status !== 200)
    return { status: 'failed', result: null, error: String(state.body.code ?? `http_${state.status}`) };
  const guestIds = recipients((state.body.rows ?? []) as NoticeRow[], s.audience);
  if (!guestIds.length) return { status: 'done', result: { queued: 0, sent: 0, failed: 0 }, error: null };
  const res = await runner.send(s.ownerId, s.invitationId, { action: 'send', guestIds });
  const { ok: _ok, code, ...rest } = res.body;
  if (res.status === 200) return { status: 'done', result: rest, error: null };
  // nobody left to send to by now: nothing to do
  if (code === 'nobody')
    return { status: 'done', result: { queued: 0, sent: 0, failed: 0, ...rest }, error: null };
  return {
    status: 'failed',
    result: Object.keys(rest).length ? rest : null,
    error: String(code ?? res.status),
  };
}

/** The clock's turn: every send that is due, one after the other. Never throws. */
export async function processScheduledSends(deps: RunDeps, limit = 10): Promise<RunSummary> {
  const out: RunSummary = { ran: 0, done: 0, failed: 0 };
  let due: ScheduledSend[];
  try {
    due = await deps.db.claim(limit, STALE_SECONDS);
  } catch (err) {
    console.error('[scheduler] claim failed', err);
    return out;
  }
  for (const s of due) {
    out.ran++;
    const runner = deps.runners[s.kind];
    let outcome: Awaited<ReturnType<typeof runOne>>;
    try {
      outcome = runner
        ? await runOne(s, runner)
        : { status: 'failed', result: null, error: `unknown kind ${s.kind}` };
    } catch (err) {
      // left running: taken again after STALE_SECONDS (three tries in all)
      console.error('[scheduler] a send failed', s.id, err);
      continue;
    }
    if (outcome.status === 'done') out.done++;
    else out.failed++;
    await deps.db
      .finish(s.id, outcome.status, outcome.result, outcome.error)
      .catch((err) => console.error('[scheduler] finish failed', s.id, err));
  }
  return out;
}
