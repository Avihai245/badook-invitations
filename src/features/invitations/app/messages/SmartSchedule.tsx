'use client';

import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Check,
  CircleAlert,
  Eye,
  Lock,
  Pause,
  PencilLine,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  cn,
  Dialog,
  Field,
  Input,
  Select,
  Switch,
  useToast,
  type BadgeVariant,
} from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { MessageKind } from '@/features/whatsapp/catalog';
import type { HubData, ScheduleStatus, StoredStage } from '@/features/whatsapp/hub';
import {
  defaultStages,
  estimateStage,
  MESSAGE_AUDIENCE,
  pendingStage,
  PRESET_MIN_PLAN,
  PRESET_STAGES,
  PRESETS,
  presetAllowed,
  RECOMMENDED_PRESET,
  STAGE_AUDIENCES,
  STAGE_MESSAGES,
  stageInstant,
  validateSchedule,
  zonedParts,
  type Issue,
  type Preset,
  type ScheduleNote,
  type StageDraft,
} from '@/features/whatsapp/schedule';
import { hostApi, loginUrl } from '../api';
import { formatIls } from '../../lib/guest-list';
import type { GuestsPageData } from '../../server/guests';
import { estimateGuest, MessagePreview, PreviewButton, previewLanguages } from './shared';

/** A stored stage as the screen edits it: its moment in the event's time zone. */
function toDraft(s: StoredStage, timeZone: string): StageDraft & { stored: StoredStage } {
  const { date, time } = zonedParts(Date.parse(s.sendAt), timeZone);
  return {
    key: s.key,
    kind: s.kind,
    message: s.message,
    audience: s.audience,
    label: s.label,
    date,
    time,
    enabled: s.enabled,
    status: s.status,
    stored: s,
  };
}
type Draft = StageDraft & { stored?: StoredStage; retry?: boolean };

const STATUS_BADGE: Record<string, BadgeVariant> = {
  scheduled: 'info',
  done: 'live',
  failed: 'danger',
  missed: 'warning',
  canceled: 'draft',
  off: 'draft',
};

/**
 * Smart scheduling: pick one of four ready sequences (Smart recommended), see its stages with dates
 * suggested from the event, adjust any of them (date, time, who, which message, on or off) while the
 * phone beside shows exactly what goes out, review — every stage, how many messages at most, what it
 * may cost, what stands in the way — and turn it on. Once on: pause, resume, cancel, and each stage's
 * outcome (sent, delivered, read; or why it wasn't sent, and sending it again).
 */
export function SmartSchedule({
  data,
  hub,
  onChange,
}: {
  data: GuestsPageData;
  hub: HubData;
  onChange: (hub: HubData) => void;
}) {
  const { t, fmt, plural, number, date, locale } = useUi();
  const w = t.waMessages;
  const s = w.smart;
  const { toast } = useToast();
  const tz = hub.timeZone;
  const status = hub.schedule?.status ?? null;

  const context = () => {
    const now = zonedParts(Date.now(), tz);
    return {
      today: now.date,
      now: now.time,
      eventDate: hub.eventDate,
      startTime: hub.startTime,
      rsvpDeadline: hub.rsvpDeadline,
      album: hub.album && hub.approved.includes('album'),
    };
  };
  /** A preset's stages: those that already ran stay, the rest suggested anew. */
  const fresh = (p: Preset): { stages: Draft[]; notes: ScheduleNote[] } => {
    const { stages, notes } = defaultStages(p, context());
    const ran = hub.stages
      .filter((x) => x.status !== 'scheduled' && x.status !== 'canceled')
      .map((x) => toDraft(x, tz));
    const keys = new Set(ran.map((r) => r.key));
    return { stages: [...ran, ...stages.filter((x) => !keys.has(x.key))], notes };
  };

  const [preset, setPreset] = useState<Preset | null>(hub.schedule?.preset ?? null);
  const [stages, setStages] = useState<Draft[]>(() => hub.stages.map((x) => toDraft(x, tz)));
  const [notes, setNotes] = useState<ScheduleNote[]>([]);
  const [picking, setPicking] = useState(!hub.schedule);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);

  const ordered = useMemo(
    () => [...stages].sort((a, b) => stageInstant(a, tz) - stageInstant(b, tz) || a.key.localeCompare(b.key)),
    [stages, tz],
  );
  const estimateGuests = useMemo(() => data.guests.map(estimateGuest), [data.guests]);
  const invitationFirst = stages.some((x) => x.kind === 'invitation' && pendingStage(x));
  const estimates = Object.fromEntries(
    stages.map((x) => [x.key, estimateStage(x, estimateGuests, invitationFirst)]),
  );
  const issues = preset
    ? validateSchedule(preset, stages, {
        now: Date.now(),
        timeZone: tz,
        eventStart: hub.eventStart,
        eventEnd: hub.eventEnd,
        approved: hub.approved,
        album: hub.album,
        plan: hub.plan,
        admin: hub.admin,
        published: data.published,
        configured: data.whatsapp.configured,
        checkins: hub.checkins,
      })
    : [];
  const stageIssues = (key: string) => issues.filter((i) => i.key === key);
  const errors = issues.filter((i) => i.level === 'error');
  const languages = previewLanguages(data);
  const nameOf = (x: Pick<Draft, 'key' | 'label'>) =>
    x.label || (s.stageNames as Record<string, string>)[x.key] || x.key;
  const when = (x: Pick<Draft, 'date' | 'time'>) =>
    date(stageInstant(x, tz), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    });
  const issueText = (i: Issue) =>
    i.code === 'plan' && preset
      ? fmt(w.issues.plan, { plan: s.plans[PRESET_MIN_PLAN[preset]] })
      : w.issues[i.code];

  const choose = (p: Preset) => {
    const next = fresh(p);
    setPreset(p);
    setStages(next.stages);
    setNotes(next.notes);
    setPicking(false);
    setDirty(true);
    setPreviewKey(null);
  };
  const update = (key: string, patch: Partial<Draft>) => {
    setStages((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    setDirty(true);
  };

  const call = async (action: 'save' | 'activate' | 'pause' | 'resume' | 'cancel', consent = false) => {
    if (!preset) return false;
    setBusy(true);
    const withStages = action === 'save' || action === 'activate' || (action === 'resume' && dirty);
    const res = await hostApi<{ hub: HubData; code?: string; issues?: Issue[] }>(
      `/api/invitations/${data.id}/whatsapp/schedule`,
      {
        method: 'PUT',
        body: {
          preset,
          action,
          ...(withStages
            ? {
                stages: stages.map((x) => ({
                  key: x.key,
                  kind: x.kind,
                  message: x.message,
                  audience: x.audience,
                  label: x.label,
                  date: x.date,
                  time: x.time,
                  enabled: x.enabled,
                  ...(x.retry ? { retry: true } : {}),
                })),
              }
            : {}),
          ...(consent ? { consent: true } : {}),
        },
      },
    );
    setBusy(false);
    if (res.status === 401) {
      window.location.assign(loginUrl());
      return false;
    }
    if (!res.ok || !res.body?.hub) {
      toast({
        title:
          res.body?.code === 'issues'
            ? w.errors.issues
            : res.body?.code === 'consent'
              ? w.errors.consent
              : w.errors.generic,
        variant: 'danger',
      });
      return false;
    }
    const next = res.body.hub;
    onChange(next);
    setStages(next.stages.map((x) => toDraft(x, tz)));
    setDirty(false);
    toast({
      title:
        action === 'activate'
          ? s.toast.activated
          : action === 'pause'
            ? s.toast.paused
            : action === 'resume'
              ? s.toast.resumed
              : action === 'cancel'
                ? s.toast.canceled
                : s.toast.saved,
      variant: 'success',
    });
    return true;
  };

  const shownPreview = ordered.find((x) => x.key === previewKey) ?? ordered.find(pendingStage) ?? ordered[0];
  const editingStage = stages.find((x) => x.key === editing) ?? null;

  if (picking || !preset)
    return (
      <PresetPicker
        hub={hub}
        current={preset}
        onChoose={(p) => {
          if (hub.stages.length && !window.confirm(s.changeConfirm)) return;
          choose(p);
        }}
        onCancel={preset ? () => setPicking(false) : undefined}
      />
    );

  const banner = status ?? 'draft';
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card
          padding="md"
          className="flex flex-wrap items-center justify-between gap-3"
          data-testid="schedule-status"
        >
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-muted">{s.selected}</p>
            <p className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold">
              {s.presets[preset].name}
              <Badge variant={banner === 'active' ? 'live' : banner === 'paused' ? 'warning' : 'draft'}>
                {banner === 'active' ? (
                  <Play aria-hidden className="size-3" />
                ) : banner === 'paused' ? (
                  <Pause aria-hidden className="size-3" />
                ) : null}
                {s.status[banner]}
              </Badge>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
            {s.change}
          </Button>
        </Card>

        {!data.whatsapp.configured ? (
          <p
            role="status"
            className="rounded-card border border-warning-line bg-warning-bg px-4 py-3 text-[13px] text-warning"
          >
            {w.notConfigured}
          </p>
        ) : null}
        {notes.length ? (
          <ul
            className="flex flex-col gap-1 rounded-card border border-info-line bg-info-bg px-4 py-3 text-[13px] text-info"
            data-testid="schedule-notes"
          >
            {notes.map((n) => (
              <li key={n.code} className="flex items-start gap-2">
                <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
                {n.code === 'tooClose'
                  ? plural(s.notes.tooClose, n.disabled, { n: number(n.disabled) })
                  : s.notes[n.code]}
              </li>
            ))}
          </ul>
        ) : null}

        <ol className="flex flex-col gap-3" data-testid="schedule-stages">
          {ordered.map((x, i) => {
            const own = stageIssues(x.key);
            const e = estimates[x.key]!;
            const ran = !pendingStage(x) && x.enabled && x.status && x.status !== 'scheduled';
            const badge = !x.enabled ? 'off' : (x.status ?? 'scheduled');
            const outcome = x.stored?.outcome;
            const stats = x.stored?.stats ?? {};
            return (
              <li key={x.key}>
                <Card
                  padding="md"
                  className={cn(
                    'flex flex-col gap-2',
                    previewKey === x.key && 'ring-2 ring-brand',
                    !x.enabled && 'opacity-70',
                  )}
                  data-stage={x.key}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-deep">
                      {ran && x.status === 'done' ? <Check aria-hidden className="size-4" /> : number(i + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-bold">
                        {nameOf(x)}
                        <Badge variant={STATUS_BADGE[badge] ?? 'neutral'}>{s.stageStatus[badge]}</Badge>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
                        <span className="flex items-center gap-1">
                          <CalendarClock aria-hidden className="size-3.5" />
                          {when(x)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users aria-hidden className="size-3.5" />
                          {fmt(s.to, { audience: w.audiences[x.audience] })}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px]">
                        {w.kinds[x.message]}
                        {pendingStage(x) ? (
                          <span className="text-muted">
                            {' · '}
                            {e.upTo ? plural(s.estimate, e.upTo, { n: number(e.upTo) }) : s.estimate.zero}
                            {x.audience !== 'all' && x.audience !== 'not_received' ? ` · ${s.dynamic}` : ''}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {!ran ? (
                      <Switch
                        checked={x.enabled}
                        onCheckedChange={(on) => update(x.key, { enabled: on })}
                        label={fmt(s.enable, { name: nameOf(x) })}
                        className="mt-1 shrink-0"
                      />
                    ) : null}
                  </div>

                  {ran ? (
                    <div className="rounded-card bg-canvas px-3 py-2 text-[12.5px]">
                      {outcome?.ok && outcome.queued ? (
                        <p className="font-semibold">
                          {plural(s.outcome.queued, outcome.queued, { n: number(outcome.queued) })}
                        </p>
                      ) : outcome?.code && outcome.code in s.outcome ? (
                        <p
                          className={cn('font-semibold', x.status === 'done' ? 'text-muted' : 'text-danger')}
                        >
                          {fmt(
                            s.outcome[outcome.code as Exclude<keyof typeof s.outcome, 'queued'>] as string,
                            {
                              needed: number(outcome.needed ?? 0),
                              balance: number(outcome.balance ?? 0),
                            },
                          )}
                        </p>
                      ) : null}
                      {outcome?.fallback ? <p className="text-muted">{s.outcome.fallback}</p> : null}
                      {Object.keys(stats).length ? (
                        <p className="mt-0.5 text-muted">
                          {Object.entries(stats)
                            .map(([k, n]) => `${number(n)} ${(s.stats as Record<string, string>)[k] ?? k}`)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {own.length ? (
                    <ul className="flex flex-col gap-0.5 text-[12.5px]">
                      {own.map((issue) => (
                        <li
                          key={issue.code}
                          className={cn(
                            'flex items-start gap-1.5',
                            issue.level === 'error' ? 'text-danger' : 'text-warning',
                          )}
                        >
                          {issue.level === 'error' ? (
                            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                          )}
                          {issueText(issue)}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {!ran ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<PencilLine />}
                        onClick={() => setEditing(x.key)}
                      >
                        {s.edit}
                      </Button>
                    ) : x.status === 'failed' || x.status === 'missed' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<RotateCcw />}
                        onClick={() => {
                          // the next round half hour at least 30 minutes away, in the event's zone
                          const soon = zonedParts(
                            Math.ceil((Date.now() + 30 * 60_000) / 1_800_000) * 1_800_000,
                            tz,
                          );
                          update(x.key, {
                            status: 'scheduled',
                            retry: true,
                            date: soon.date,
                            time: soon.time,
                          });
                          setEditing(x.key);
                        }}
                      >
                        {s.retry}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Eye />}
                      onClick={() => setPreviewKey(x.key)}
                      className="max-lg:hidden"
                    >
                      {s.preview}
                    </Button>
                    <PreviewButton
                      title={nameOf(x)}
                      kind={x.message}
                      values={hub.values}
                      languages={languages}
                      time={x.time}
                      day={date(stageInstant(x, tz), { day: 'numeric', month: 'long', timeZone: tz })}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>

        <ActionBar
          status={status}
          dirty={dirty}
          busy={busy}
          errors={errors.length}
          onSave={() => void call('save')}
          onReview={() => setReview(true)}
          onPause={() => void call('pause')}
          onCancel={() => {
            if (window.confirm(s.actions.cancelConfirm)) void call('cancel');
          }}
        />
      </div>

      <aside className="hidden lg:block">
        {shownPreview ? (
          <div className="sticky top-4">
            <p className="mb-2 text-[13px] font-semibold">
              {w.preview.title} · {nameOf(shownPreview)}
            </p>
            <MessagePreview
              kind={shownPreview.message}
              values={hub.values}
              languages={languages}
              time={shownPreview.time}
              day={date(stageInstant(shownPreview, tz), { day: 'numeric', month: 'long', timeZone: tz })}
            />
          </div>
        ) : null}
      </aside>

      {editingStage ? (
        <StageEditor
          stage={editingStage}
          name={nameOf(editingStage)}
          hub={hub}
          languages={languages}
          issues={stageIssues(editingStage.key)}
          issueText={issueText}
          onApply={(patch) => {
            update(editingStage.key, patch);
            setPreviewKey(editingStage.key);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {review ? (
        <ReviewDialog
          data={data}
          stages={ordered}
          estimates={estimates}
          issues={issues}
          issueText={issueText}
          nameOf={nameOf}
          when={when}
          needsConsent={status !== 'paused' || !hub.schedule?.consentAt}
          busy={busy}
          locale={locale}
          onActivate={async (consent) => {
            const done = await call(status === 'paused' && !consent ? 'resume' : 'activate', consent);
            if (done) setReview(false);
          }}
          onClose={() => setReview(false)}
        />
      ) : null}
    </div>
  );
}

/** The four sequences side by side; Smart stands out as recommended; a plan's lock says which plan. */
function PresetPicker({
  hub,
  current,
  onChoose,
  onCancel,
}: {
  hub: HubData;
  current: Preset | null;
  onChoose: (p: Preset) => void;
  onCancel?: () => void;
}) {
  const { t, fmt, plural, number } = useUi();
  const w = t.waMessages;
  const s = w.smart;
  return (
    <div className="flex flex-col gap-4" data-testid="preset-picker">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-extrabold">{s.choose}</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted">{s.intro}</p>
        </div>
        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((p) => {
          const recommended = p === RECOMMENDED_PRESET;
          const allowed = presetAllowed(p, hub.plan, hub.admin);
          const keys = PRESET_STAGES[p];
          return (
            <Card
              key={p}
              padding="md"
              className={cn(
                'relative flex flex-col gap-3',
                recommended && 'border-brand shadow-md ring-2 ring-brand',
                current === p && 'bg-brand-soft/40',
              )}
              data-preset={p}
            >
              {recommended ? (
                <span className="absolute -top-3 start-4 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[12px] font-bold text-white">
                  <Sparkles aria-hidden className="size-3.5" />
                  {s.recommended}
                </span>
              ) : null}
              <div>
                <p className="text-[17px] font-extrabold">{s.presets[p].name}</p>
                <p className="text-[13px] text-muted">{s.presets[p].tagline}</p>
              </div>
              <p className="text-[13px] font-semibold">
                {plural(s.stagesCount, keys.length, { n: number(keys.length) })}
              </p>
              <ol className="flex flex-1 flex-col gap-1 text-[12.5px] text-muted">
                {keys.map((k) => (
                  <li key={k} className="flex items-start gap-1.5">
                    <CalendarCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand" />
                    {(s.stageNames as Record<string, string>)[k]}
                  </li>
                ))}
              </ol>
              {allowed ? (
                <Button variant={recommended ? 'primary' : 'secondary'} onClick={() => onChoose(p)}>
                  {s.select}
                </Button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
                    <Lock aria-hidden className="size-3.5" />
                    {fmt(s.locked, { plan: s.plans[PRESET_MIN_PLAN[p]] })}
                  </p>
                  <Button asChild variant="secondary">
                    <Link href="/app/billing">{s.upgrade}</Link>
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ActionBar({
  status,
  dirty,
  busy,
  errors,
  onSave,
  onReview,
  onPause,
  onCancel,
}: {
  status: ScheduleStatus | null;
  dirty: boolean;
  busy: boolean;
  errors: number;
  onSave: () => void;
  onReview: () => void;
  onPause: () => void;
  onCancel: () => void;
}) {
  const { t } = useUi();
  const a = t.waMessages.smart.actions;
  const live = status === 'active' || status === 'paused';
  return (
    <div
      className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-card border border-line bg-surface/95 p-3 shadow-md backdrop-blur"
      data-testid="schedule-actions"
    >
      {live ? (
        <Button variant="ghost" icon={<XCircle />} onClick={onCancel} disabled={busy}>
          {a.cancel}
        </Button>
      ) : null}
      {status === 'active' ? (
        <Button variant="secondary" icon={<Pause />} onClick={onPause} disabled={busy}>
          {a.pause}
        </Button>
      ) : null}
      {live && dirty ? (
        <Button variant="secondary" onClick={onSave} disabled={busy || (status === 'active' && errors > 0)}>
          {a.saveChanges}
        </Button>
      ) : null}
      {!live ? (
        <Button variant="secondary" onClick={onSave} disabled={busy || !dirty}>
          {a.save}
        </Button>
      ) : null}
      {status === 'paused' ? (
        <Button icon={<Play />} onClick={onReview} disabled={busy}>
          {a.resume}
        </Button>
      ) : !live ? (
        <Button icon={<Play />} onClick={onReview} disabled={busy}>
          {status === 'canceled' ? a.restart : a.review}
        </Button>
      ) : null}
    </div>
  );
}

/** One stage's settings, with the phone beside (stacked on a phone) changing as they change. */
function StageEditor({
  stage,
  name,
  hub,
  languages,
  issues,
  issueText,
  onApply,
  onClose,
}: {
  stage: Draft;
  name: string;
  hub: HubData;
  languages: ReturnType<typeof previewLanguages>;
  issues: Issue[];
  issueText: (i: Issue) => string;
  onApply: (patch: Partial<Draft>) => void;
  onClose: () => void;
}) {
  const { t, fmt, date } = useUi();
  const w = t.waMessages;
  const e = w.editor;
  const [d, setD] = useState<Draft>(stage);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const messages = STAGE_MESSAGES[d.kind];
  const audiences = STAGE_AUDIENCES[d.kind];
  const albumOk = hub.album && hub.approved.includes('album');
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={fmt(e.title, { name })}
      closeLabel={t.common.close}
      className="max-w-[860px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => onApply(d)}>{e.apply}</Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={e.date}>
              <Input
                type="date"
                value={d.date}
                onChange={(ev) => ev.target.value && set({ date: ev.target.value })}
              />
            </Field>
            <Field label={e.time}>
              <Input
                type="time"
                step={300}
                value={d.time}
                onChange={(ev) => ev.target.value && set({ time: ev.target.value })}
              />
            </Field>
          </div>
          <p className="-mt-2 text-[12px] text-muted">{fmt(e.zone, { zone: hub.timeZone })}</p>
          {d.kind === 'custom' ? (
            <Field label={e.label}>
              <Input
                value={d.label ?? ''}
                maxLength={60}
                onChange={(ev) => set({ label: ev.target.value || null })}
              />
            </Field>
          ) : null}
          {d.kind === 'thanks' ? (
            <Checkbox
              checked={d.message === 'album'}
              disabled={!albumOk && d.message !== 'album'}
              onCheckedChange={(on) => set({ message: on ? 'album' : 'thanks' })}
              label={
                <span>
                  {e.withAlbum}
                  {!albumOk ? <span className="block text-[12px] text-muted">{e.albumNo}</span> : null}
                </span>
              }
            />
          ) : messages.length > 1 ? (
            <Field label={e.message}>
              <Select
                value={d.message}
                onChange={(ev) => {
                  const message = ev.target.value as MessageKind;
                  set({ message, audience: MESSAGE_AUDIENCE[message] });
                }}
              >
                {messages.map((m) => (
                  <option key={m} value={m}>
                    {w.kinds[m]}
                    {hub.approved.includes(m) ? '' : ` — ${w.template.pending}`}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {audiences.length > 1 ? (
            <Field label={e.audience}>
              <Select
                value={d.audience}
                onChange={(ev) => set({ audience: ev.target.value as Draft['audience'] })}
              >
                {audiences.map((a) => (
                  <option key={a} value={a}>
                    {w.audiences[a]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-[13px]">
              <span className="font-semibold">{e.audience}: </span>
              {w.audiences[d.audience]}
            </p>
          )}
          <p className="text-[12.5px] text-muted">{e.recheck}</p>
          <Checkbox checked={d.enabled} onCheckedChange={(on) => set({ enabled: on })} label={e.enabled} />
          {issues.length ? (
            <ul className="flex flex-col gap-0.5 text-[12.5px] text-muted">
              {issues.map((i) => (
                <li key={i.code}>· {issueText(i)}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <MessagePreview
          kind={d.message}
          values={hub.values}
          languages={languages}
          time={d.time}
          day={date(stageInstant(d, hub.timeZone), { day: 'numeric', month: 'long', timeZone: hub.timeZone })}
          frame={false}
        />
      </div>
    </Dialog>
  );
}

/** Before turning on: every stage, how many messages at most, the cost, the credits, what's in the way. */
function ReviewDialog({
  data,
  stages,
  estimates,
  issues,
  issueText,
  nameOf,
  when,
  needsConsent,
  busy,
  locale,
  onActivate,
  onClose,
}: {
  data: GuestsPageData;
  stages: Draft[];
  estimates: Record<string, { now: number; upTo: number }>;
  issues: Issue[];
  issueText: (i: Issue) => string;
  nameOf: (x: Pick<Draft, 'key' | 'label'>) => string;
  when: (x: Pick<Draft, 'date' | 'time'>) => string;
  needsConsent: boolean;
  busy: boolean;
  locale: 'he' | 'en';
  onActivate: (consent: boolean) => void;
  onClose: () => void;
}) {
  const { t, fmt, plural, number } = useUi();
  const w = t.waMessages;
  const r = w.review;
  const [consent, setConsent] = useState(false);
  const live = stages.filter(pendingStage);
  const total = live.reduce((sum, x) => sum + (estimates[x.key]?.upTo ?? 0), 0);
  const ils = (v: number) => formatIls(v, locale);
  const cost = Math.round(total * data.whatsapp.priceIls * 100) / 100;
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const where = (i: Issue) => {
    const stage = i.key ? stages.find((x) => x.key === i.key) : null;
    return stage ? `${nameOf(stage)}: ${issueText(i)}` : issueText(i);
  };
  const blocked = errors.length > 0 || (needsConsent && !consent);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={r.title}
      description={r.intro}
      closeLabel={t.common.close}
      className="max-w-[640px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            icon={<Play />}
            onClick={() => onActivate(needsConsent && consent)}
            disabled={blocked}
            loading={busy}
          >
            {r.activate}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full text-[13px]" data-testid="review-table">
            <thead className="bg-canvas text-start text-[12px] text-muted">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">{r.when}</th>
                <th className="px-3 py-2 text-start font-semibold">{r.message}</th>
                <th className="px-3 py-2 text-start font-semibold">{r.audience}</th>
                <th className="px-3 py-2 text-end font-semibold">{r.count}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {live.map((x) => (
                <tr key={x.key}>
                  <td className="px-3 py-2 whitespace-nowrap">{when(x)}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{nameOf(x)}</span>
                    <span className="block text-[12px] text-muted">{w.kinds[x.message]}</span>
                  </td>
                  <td className="px-3 py-2">{w.audiences[x.audience]}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{number(estimates[x.key]?.upTo ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-card border border-line bg-canvas px-3.5 py-3 text-[13px]">
          <p className="font-semibold">{plural(r.total, total, { n: number(total) })}</p>
          <p className="mt-1">{fmt(r.cost, { total: ils(cost), price: ils(data.whatsapp.priceIls) })}</p>
          <p className="mt-0.5 text-muted">
            {data.unlimited ? r.unlimited : fmt(r.balance, { n: number(data.credits) })}
          </p>
          {!data.unlimited && total > data.credits ? (
            <p className="mt-1.5 font-semibold text-warning">
              {r.short}{' '}
              <Link href="/app/billing#credits" className="text-brand-deep underline">
                {r.buy}
              </Link>
            </p>
          ) : null}
          <p className="mt-1.5 text-[12.5px] text-muted">{r.totalHint}</p>
        </div>

        {errors.length ? (
          <div
            role="alert"
            className="rounded-card border border-danger-line bg-danger-bg px-3.5 py-3 text-[13px] text-danger"
            data-testid="review-errors"
          >
            <p className="font-semibold">{r.errors}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {errors.map((i) => (
                <li key={`${i.key}-${i.code}`}>· {where(i)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {warnings.length ? (
          <div className="rounded-card border border-warning-line bg-warning-bg px-3.5 py-3 text-[13px] text-warning">
            <p className="font-semibold">{r.warnings}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {warnings.map((i) => (
                <li key={`${i.key}-${i.code}`}>· {where(i)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {needsConsent ? (
          <Checkbox
            checked={consent}
            onCheckedChange={setConsent}
            label={
              <span>
                {t.guests.whatsapp.consent} <span className="text-muted">{t.guests.whatsapp.optOut}</span>
              </span>
            }
          />
        ) : null}
      </div>
    </Dialog>
  );
}
