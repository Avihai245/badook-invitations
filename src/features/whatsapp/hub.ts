import 'server-only';
import { z } from 'zod';
import { albumNoticesDb } from '@/features/album/server/notices-db';
import { albumTemplateReady, processAlbumNoticeQueue } from '@/features/album/server/notify';
import { accountDb, isAdminEmail, loadAccount } from '@/features/billing/server/account';
import type { PlanId } from '@/features/billing/plans';
import { effectiveFeatures, whyOff } from '@/features/flags/features';
import { featureInput } from '@/features/flags/server';
import type { InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { eventRange, zonedTimeToUtc } from '@/features/invitations/lib/dates';
import type { ApiResult } from '@/features/invitations/server/host-api';
import { hostDb, isUuid } from '@/features/invitations/server/host-db';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/session';
import { sendInvitations } from './api';
import { MESSAGE_KINDS, type EventValues, type MessageKind } from './catalog';
import { cloudApiConfigured } from './cloud-api';
import { approvedKinds, eventValues, noticesDb, processNotices } from './notices';
import {
  AUDIENCES,
  isPreset,
  kindOfKey,
  PRESET_STAGES,
  presetAllowed,
  STAGE_KINDS,
  validateSchedule,
  zonedParts,
  type Audience,
  type Preset,
  type StageDraft,
  type StageKind,
  type StageStatus,
} from './schedule';
import { configuredTemplateLanguages, processQueue, whatsappDb } from './sender';

/**
 * The guests' WhatsApp section on the server: its state (the sequence, its stages and what became of
 * their messages, every message sent, what this deployment and the host's plan allow), saving and
 * turning on a sequence (checked here exactly as the screen checks it: schedule.ts), sending any of
 * the approved messages now to chosen guests, and the job that runs the stages whose time has come.
 * Every call checks the event is the user's (and every database function checks it again).
 */

const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** A stored stage, as whatsapp_hub_state returns it. */
export interface StoredStage {
  id: string;
  key: string;
  kind: StageKind;
  message: MessageKind;
  audience: Audience;
  label: string | null;
  sendAt: string;
  enabled: boolean;
  status: StageStatus;
  ranAt: string | null;
  outcome: {
    ok: boolean;
    code?: string;
    queued?: number;
    needed?: number;
    balance?: number;
    fallback?: string;
    skipped?: Record<string, number>;
  } | null;
  /** its messages by status (queued, sent, delivered, read, failed, skipped) */
  stats: Record<string, number>;
}

/** One message of any kind, the newest first. */
export interface HistoryRow {
  id: string;
  kind: MessageKind;
  guestId: string | null;
  name: string | null;
  status: string;
  error: string | null;
  at: string;
  stageId: string | null;
}

export type ScheduleStatus = 'draft' | 'active' | 'paused' | 'canceled';

interface HubState {
  schedule: {
    preset: Preset;
    status: ScheduleStatus;
    consentAt: string | null;
    activatedAt: string | null;
    updatedAt: string;
  } | null;
  stages: StoredStage[];
  album: boolean;
  checkins: boolean;
  history: HistoryRow[];
}

export const hubDb = {
  state: (id: string, ownerId: string, limit = 200) =>
    rpc<HubState | null>('whatsapp_hub_state', { p_id: id, p_owner: ownerId, p_limit: limit }),
  save: (
    id: string,
    ownerId: string,
    preset: Preset,
    status: ScheduleStatus | null,
    stages: unknown[] | null,
    consent: boolean,
  ) =>
    rpc<HubState | null>('whatsapp_schedule_save', {
      p_id: id,
      p_owner: ownerId,
      p_preset: preset,
      p_status: status,
      p_stages: stages,
      p_consent: consent,
    }),
  due: (limit: number) =>
    rpc<
      {
        id: string;
        invitationId: string;
        ownerId: string;
        ownerEmail: string | null;
        preset: Preset;
        audienceSize: number;
      }[]
    >('whatsapp_stages_due', { p_limit: limit }),
  run: (
    stageId: string,
    approved: MessageKind[],
    album: boolean,
    priceUsd: number,
    unlimited: boolean,
    planOk: boolean,
  ) =>
    rpc<{ id: string; invitationId: string; status: StageStatus; outcome: unknown } | null>(
      'whatsapp_stage_run',
      {
        p_stage_id: stageId,
        p_approved: approved,
        p_album: album,
        p_price_usd: priceUsd,
        p_unlimited: unlimited,
        p_plan_ok: planOk,
      },
    ),
  noticeQueue: (id: string, ownerId: string, guestIds: string[], priceUsd: number, template: MessageKind) =>
    rpc<
      | ({ skipped?: Record<string, number> } & (
          | { ok: true; queued: number; balance: number }
          | { ok: false; code: 'credits'; needed: number; balance: number }
          | { ok: false; code: 'nobody' }
        ))
      | null
    >('whatsapp_notice_queue', {
      p_id: id,
      p_owner: ownerId,
      p_guest_ids: guestIds,
      p_price_usd: priceUsd,
      p_template: template,
      p_audience: null,
      p_stage_id: null,
    }),
};

/** What the section's screens need beyond the guest list (features/invitations/server/guests.ts). */
export interface HubData {
  schedule: HubState['schedule'];
  stages: StoredStage[];
  history: HistoryRow[];
  /** the messages the system's number can send here (approved templates) */
  approved: MessageKind[];
  /** the album can go with the thank-you: the plan has it and the album is on */
  album: boolean;
  /** the plan has the album (it may still be off) */
  albumFeature: boolean;
  checkins: boolean;
  /** each message's values, in the template's languages and the invitation's */
  values: Partial<Record<Locale, EventValues>>;
  timeZone: string;
  eventDate: string;
  startTime: string;
  rsvpDeadline: string | null;
  eventStart: number;
  eventEnd: number;
  plan: PlanId;
  admin: boolean;
}

async function accountOf(userId: string) {
  const user = await getSessionUser();
  return loadAccount({ id: userId, email: user?.id === userId ? user.email : undefined });
}

/** The event's dates and the plan: what both the screen and the checks read. */
async function context(id: string, userId: string, doc: InvitationDocument) {
  const [input, account] = await Promise.all([featureInput(id), accountOf(userId)]);
  const albumFeature = !!input && !whyOff('album', input);
  const { start, end } = eventRange(doc);
  return {
    albumFeature,
    plan: account.effective,
    admin: account.admin,
    eventStart: start.getTime(),
    eventEnd: end.getTime(),
  };
}

export async function loadHub(id: string, userId: string): Promise<HubData | null> {
  if (!isUuid(id)) return null;
  const [inv, state] = await Promise.all([hostDb.get(id, userId), hubDb.state(id, userId)]);
  if (!inv || !state) return null;
  const doc = inv.published ?? inv.draft;
  const ctx = await context(id, userId, doc);
  const locales = new Set<Locale>([...configuredTemplateLanguages().map((l) => l.locale), ...doc.locales]);
  return {
    schedule: state.schedule,
    stages: state.stages,
    history: state.history,
    approved: approvedKinds(),
    album: ctx.albumFeature && state.album,
    albumFeature: ctx.albumFeature,
    checkins: state.checkins,
    values: Object.fromEntries([...locales].map((l) => [l, eventValues(doc, l)])),
    timeZone: doc.timezone,
    eventDate: doc.event.date,
    startTime: doc.event.startTime,
    rsvpDeadline: doc.event.rsvpDeadline,
    eventStart: ctx.eventStart,
    eventEnd: ctx.eventEnd,
    plan: ctx.plan,
    admin: ctx.admin,
  };
}

/** GET /api/invitations/:id/whatsapp/hub — the section's state, fresh. */
export async function hubState(userId: string, id: string): Promise<ApiResult> {
  const hub = await loadHub(id, userId);
  if (!hub) return fail(404, 'not_found');
  return ok({ ok: true, hub });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const StageSchema = z.strictObject({
  key: z.string().regex(/^(invitation|followup[1-3]|event_reminder|thanks|custom[12])$/),
  kind: z.enum(STAGE_KINDS),
  message: z.enum(MESSAGE_KINDS),
  audience: z.enum(AUDIENCES),
  label: z.string().trim().max(60).nullable().default(null),
  date: z.string().regex(ISO_DATE),
  time: z.string().regex(HHMM),
  enabled: z.boolean(),
  /** send a stage that failed or was missed again (at its new time) */
  retry: z.boolean().optional(),
});
const SaveSchema = z.strictObject({
  preset: z.string().refine(isPreset),
  action: z.enum(['save', 'activate', 'pause', 'resume', 'cancel']),
  stages: z.array(StageSchema).max(8).optional(),
  /** the host confirmed their guests expect these messages (required to turn the sequence on) */
  consent: z.literal(true).optional(),
});

/**
 * PUT /api/invitations/:id/whatsapp/schedule — { preset, action, stages?, consent? }: save the
 * sequence (as a draft, or as it is when it's on), turn it on (consent required; nothing may stand in
 * its way: 422 { issues }), pause it, resume it, or cancel what is left of it. A sequence that is on
 * stays valid: an edit that breaks it is refused.
 */
export async function saveSchedule(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = SaveSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const { action, consent } = parsed.data;
  const preset = parsed.data.preset as Preset;
  const [inv, state] = await Promise.all([hostDb.get(id, userId), hubDb.state(id, userId)]);
  if (!inv || !state) return fail(404, 'not_found');
  const doc = inv.published ?? inv.draft;
  const input = parsed.data.stages ?? null;
  if (input) {
    const keys = new Set(input.map((s) => s.key));
    if (keys.size !== input.length) return fail(400, 'invalid');
    // each stage is its key's kind, and belongs to the preset (or ran already, from an earlier one)
    const ran = new Set(
      state.stages.filter((s) => s.status !== 'scheduled' && s.status !== 'canceled').map((s) => s.key),
    );
    if (
      input.some(
        (s) => kindOfKey(s.key) !== s.kind || (!PRESET_STAGES[preset].includes(s.key) && !ran.has(s.key)),
      )
    )
      return fail(400, 'invalid');
  }
  if (action === 'activate' && !consent) return fail(400, 'consent');
  const current = state.schedule?.status ?? null;
  const status: ScheduleStatus =
    action === 'activate' || action === 'resume'
      ? 'active'
      : action === 'pause'
        ? 'paused'
        : action === 'cancel'
          ? 'canceled'
          : (current ?? 'draft');
  if (action === 'pause' && current !== 'active') return fail(409, 'not_active');
  if (action === 'resume' && current !== 'paused') return fail(409, 'not_paused');
  if (action === 'resume' && !state.schedule?.consentAt) return fail(400, 'consent');

  // the stages as they'd be stored: the input (or what's there), each with where it stands
  const stored = new Map(state.stages.map((s) => [s.key, s]));
  const drafts: StageDraft[] = (
    input ?? state.stages.map((s) => ({ ...s, ...zonedParts(Date.parse(s.sendAt), doc.timezone) }))
  ).map((s) => {
    const before = stored.get(s.key);
    const retry = 'retry' in s && s.retry && (before?.status === 'failed' || before?.status === 'missed');
    const status: StageStatus =
      !before || retry || before.status === 'canceled' ? 'scheduled' : (before.status as StageStatus);
    return {
      key: s.key,
      kind: s.kind,
      message: s.message,
      audience: s.audience,
      label: s.label ?? null,
      date: s.date,
      time: s.time,
      enabled: s.enabled,
      status,
    };
  });
  if (status === 'active') {
    const ctx = await context(id, userId, doc);
    const issues = validateSchedule(preset, drafts, {
      now: Date.now(),
      timeZone: doc.timezone,
      eventStart: ctx.eventStart,
      eventEnd: ctx.eventEnd,
      approved: approvedKinds(),
      album: ctx.albumFeature && state.album,
      plan: ctx.plan,
      admin: ctx.admin,
      published: inv.status === 'published',
      configured: cloudApiConfigured(),
      checkins: state.checkins,
    });
    if (issues.some((i) => i.level === 'error')) return fail(422, 'issues', { issues });
  }
  const stages = input
    ? input.map((s) => ({
        key: s.key,
        kind: s.kind,
        message: s.message,
        audience: s.audience,
        label: s.kind === 'custom' ? s.label : null,
        sendAt: zonedTimeToUtc(s.date, s.time, doc.timezone).toISOString(),
        enabled: s.enabled,
        retry: !!s.retry,
      }))
    : null;
  const saved = await hubDb.save(id, userId, preset, status, stages, action === 'activate');
  if (!saved) return fail(404, 'not_found');
  const hub = await loadHub(id, userId);
  return ok({ ok: true, hub });
}

const SendSchema = z.strictObject({
  kind: z.enum(MESSAGE_KINDS),
  guestIds: z.array(z.string().refine(isUuid)).min(1).max(5000),
  consent: z.literal(true),
  /** the invitation only: also guests who already have it (paid again) */
  resend: z.boolean().optional(),
});

/** Messages sent right away in the request; the page asks for the rest batch by batch. */
const FIRST_BATCH = 25;

/** What's left of the event's queues: sendable now, and waiting for a later try (the invitation's). */
async function progress(id: string) {
  const [pending, notices, album, waiting] = await Promise.all([
    whatsappDb.pending(id),
    noticesDb.pending(id),
    albumNoticesDb.pending(id),
    whatsappDb.waiting(id),
  ]);
  return { pending: pending + notices + album, waiting: waiting.count, retryAt: waiting.nextAt };
}

/**
 * POST /api/invitations/:id/whatsapp/messages — { kind, guestIds, consent: true, resend? }: one of the
 * approved messages, now, to the chosen guests (a credit each; who can't get it is never charged).
 * The invitation goes through its own route's rules (sendInvitations); the album needs the plan's
 * album and the album on.
 */
export async function sendMessages(userId: string, id: string, raw: unknown): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = SendSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const { kind, guestIds, resend } = parsed.data;
  if (kind === 'invitation') return sendInvitations(userId, id, { guestIds, consent: true, resend });
  if (!cloudApiConfigured()) return fail(503, 'not_configured');
  if (!approvedKinds().includes(kind)) return fail(503, 'template');
  const inv = await hostDb.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  if (inv.status !== 'published') return fail(409, 'not_published');
  if (kind === 'album') {
    const input = await featureInput(id);
    if (!input || input.ownerId !== userId) return fail(404, 'not_found');
    if (whyOff('album', input)) return fail(403, 'feature_off', { feature: 'album' });
  }
  const account = await accountOf(userId);
  if (account.admin && account.credits < guestIds.length)
    await accountDb.creditsAdd(userId, guestIds.length - account.credits, 'admin', `whatsapp:${id}`);
  const price = serverEnv().INVITES_WHATSAPP_PRICE_USD;
  const queued =
    kind === 'album'
      ? await albumNoticesDb.queue(id, userId, guestIds, price)
      : await hubDb.noticeQueue(id, userId, guestIds, price, kind);
  if (!queued) return fail(404, 'not_found');
  const skipped = queued.skipped ? { skipped: queued.skipped } : {};
  if (!queued.ok)
    return queued.code === 'credits'
      ? fail(402, 'credits', { needed: queued.needed, balance: queued.balance, ...skipped })
      : fail(422, queued.code, skipped);
  const first =
    kind === 'album' ? await processAlbumNoticeQueue(id, FIRST_BATCH) : await processNotices(id, FIRST_BATCH);
  return ok({
    ok: true,
    queued: queued.queued,
    balance: queued.balance,
    ...skipped,
    ...first,
    ...(await progress(id)),
  });
}

/** POST /api/invitations/:id/whatsapp/messages/process — the next batch of every queue of the event. */
export async function continueMessages(userId: string, id: string): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const inv = await hostDb.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  if (!cloudApiConfigured()) return fail(503, 'not_configured');
  const [a, b, c] = await Promise.all([
    processQueue(id, FIRST_BATCH),
    processNotices(id, FIRST_BATCH),
    albumTemplateReady()
      ? processAlbumNoticeQueue(id, FIRST_BATCH)
      : Promise.resolve({ sent: 0, failed: 0, retried: 0 }),
  ]);
  const sum = {
    sent: a.sent + b.sent + c.sent,
    failed: a.failed + b.failed + c.failed,
    retried: a.retried + b.retried + c.retried,
  };
  return ok({ ok: true, ...sum, ...(await progress(id)) });
}

/**
 * The scheduled stages whose time has come: each run once (whatsapp_stage_run — its audience picked
 * now, its messages queued, or why not), with what the owner may send: the approved templates, the
 * album when their plan has it, the sequence their plan has (a plan that ended stops it), an admin's
 * credits. The queues then send them (jobs.ts runWhatsAppQueue).
 */
export async function runDueStages(limit = 20): Promise<{ ran: number; failed: number }> {
  const out = { ran: 0, failed: 0 };
  if (!cloudApiConfigured()) return out;
  const due = await hubDb.due(limit);
  if (!due.length) return out;
  const approved = approvedKinds();
  const price = serverEnv().INVITES_WHATSAPP_PRICE_USD;
  const inputs = new Map<string, Awaited<ReturnType<typeof featureInput>>>();
  for (const stage of due) {
    try {
      if (!inputs.has(stage.invitationId))
        inputs.set(stage.invitationId, await featureInput(stage.invitationId));
      const input = inputs.get(stage.invitationId);
      const admin = isAdminEmail(stage.ownerEmail);
      const album = !!input && effectiveFeatures(input).has('album');
      const planOk = !!input && presetAllowed(stage.preset, input.plan, admin || input.admin);
      const r = await hubDb.run(stage.id, approved, album, price, admin, planOk);
      if (!r) continue;
      out.ran++;
      if (r.status !== 'done') out.failed++;
    } catch (err) {
      console.error('[whatsapp schedule] stage failed to run', stage.id, err);
    }
  }
  return out;
}
