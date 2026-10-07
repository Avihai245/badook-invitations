'use client';

import { ArrowUp, Pencil, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { UpgradeDialog, upgradeReason, type UpgradeReason } from '@/features/billing/UpgradeDialog.client';
import { Button, Dialog, Input, Skeleton, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { EventType, L10n } from '../../contracts/types';
import { CAPS } from '../../contracts/validate';
import { requireTemplate } from '../../templates/registry';
import { browserTimezone, DEFAULT_TIMEZONE } from '../../lib/timezones';
import { COUPLE_EVENTS } from '../../templates/seed-copy';
import {
  ASSISTANT,
  PARENTS_MAX,
  fieldsFor,
  isRequired,
  nextField,
  sanitizeDraft,
  type AssistantField,
  type AssistantMessage,
  type Draft,
  type TurnResult,
} from '../../assistant/model';
import { EVENT_ICONS } from '../event-icons';
import { DEFAULT_TOOLS } from '../../lib/tools';
import { readAnswers } from '../onboarding/answers';
import { saveEventTools } from '../tools/ToolsPicker';
import type { WizardSeed } from './CreateWizard';

/** The languages the questionnaire writes an invitation in (the others come from the editor). */
export const ASSISTANT_LOCALES = ['he', 'en'] as const;
type AssistantLocale = (typeof ASSISTANT_LOCALES)[number];

/** The invitation's language: the UI's when the design has it, else Hebrew or English; null: neither. */
export function assistantLocale(templateId: string, ui: AssistantLocale): AssistantLocale | null {
  const supported = requireTemplate(templateId).manifest.supportsLocales;
  if (supported.includes(ui)) return ui;
  return ASSISTANT_LOCALES.find((l) => supported.includes(l)) ?? null;
}

/** The host's today (YYYY-MM-DD, their clock), for "next Friday". */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "12.3.2027", "12/03/27", "2027-03-12" → ISO; null when it isn't a date. */
function parseDate(text: string): string | null {
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  const dmy = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/.exec(text);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : dmy
      ? [Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]), Number(dmy[2]), Number(dmy[1])]
      : [0, 0, 0];
  if (!y) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** "20:00", "8:30" → HH:mm; null when it isn't a time. */
function parseTime(text: string): string | null {
  const m = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/.exec(text);
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : null;
}

/**
 * "Quick create with AI": the design is chosen; a short chat asks only what matters — the event, the
 * names, the date and time, the place, the colors and a personal line — and the invitation is made on
 * the design from the answers, then opens in the editor (where everything else stays a menu away). The
 * host may write it all in one message (the AI reads it: POST /api/invitations/assistant) or answer
 * one question at a time, tapping a date, a time or a color. Without the AI the device asks the same
 * questions itself, with an input made for each.
 */
export function AssistantWizard({
  seed,
  onClose,
  onManual,
}: {
  seed: WizardSeed;
  onClose: () => void;
  /** the 3-step wizard instead, on the same design */
  onManual: () => void;
}) {
  const { t, fmt, date: formatDate, locale: ui } = useUi();
  const a = t.assistant;
  const router = useRouter();
  const { manifest } = requireTemplate(seed.templateId);
  const locale = assistantLocale(seed.templateId, ui) ?? 'he';
  const templateName = manifest.name[ui] ?? manifest.name.en ?? manifest.id;

  const initialDraft = useMemo(
    () =>
      sanitizeDraft(
        {
          eventType: seed.eventType && manifest.categories.includes(seed.eventType) ? seed.eventType : null,
          paletteId: seed.paletteId,
        },
        manifest,
      ),
    [seed, manifest],
  );
  const [mode, setMode] = useState<'ai' | 'script'>('ai');
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [skipped, setSkipped] = useState<AssistantField[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => [
    { role: 'assistant', content: a.intro },
  ]);
  const [text, setText] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const next = nextField(seed.templateId, draft, skipped);
  const fields = fieldsFor(seed.templateId, draft);
  const type = draft.eventType ?? null;

  /** The question for a field, in the device's own words (the AI words its own). */
  function question(
    field: AssistantField | null,
    m: 'ai' | 'script' = mode,
    eventType: EventType | null = type,
  ): string {
    const q = a.questions;
    switch (field) {
      case null:
        return a.done;
      case 'primary':
        if (eventType && COUPLE_EVENTS.includes(eventType)) return q.primaryCouple;
        if (eventType === 'bar_mitzvah' || eventType === 'bat_mitzvah') return q.primaryCelebrant;
        if (eventType === 'brit') return q.primaryParents;
        if (eventType === 'birthday' || eventType === 'baby_shower') return q.primaryPerson;
        return q.primaryHost;
      case 'style':
        return m === 'ai' ? q.styleAi : q.style;
      case 'story':
        return m === 'ai' ? q.storyAi : q.story;
      default:
        return q[field];
    }
  }

  // the first question, once the intro is there
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setMessages((list) => [...list, { role: 'assistant', content: question(next) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);
  useEffect(() => {
    if (!busy && !creating) input.current?.focus();
  }, [busy, creating, next]);

  /** The answers are in: the next question (the AI's words when it has them). */
  function advance(
    nextDraft: Draft,
    nextSkipped: AssistantField[],
    said: AssistantMessage[],
    reply: string | null,
    m: 'ai' | 'script' = mode,
  ) {
    const clean = sanitizeDraft(nextDraft, manifest);
    setDraft(clean);
    setSkipped(nextSkipped);
    const asked = nextField(seed.templateId, clean, nextSkipped);
    // the event's type decides how the names are asked: the question reads the new one
    const words = reply ?? question(asked, m, clean.eventType ?? null);
    setMessages([...said, { role: 'assistant', content: words }]);
  }
  /** A tapped answer (an event type, a date, a time, a color): no need to ask the AI. */
  function answer(patch: Draft, label: string) {
    const said: AssistantMessage[] = [...messages, { role: 'user', content: label }];
    advance({ ...draft, ...patch }, skipped, said, null);
  }

  function skip(field: AssistantField, label: string) {
    const said: AssistantMessage[] = [...messages, { role: 'user', content: label }];
    advance(draft, [...new Set([...skipped, field])], said, null);
  }

  /** "Change" on the summary: the field is asked again. */
  function change(field: AssistantField) {
    const cleared: Draft =
      field === 'venue'
        ? { ...draft, venueName: null, venueAddress: null }
        : field === 'style'
          ? { ...draft, paletteId: null }
          : { ...draft, [field]: null };
    advance(
      cleared,
      skipped.filter((f) => f !== field),
      messages,
      null,
    );
  }

  /** Typed text as the answer to the field asked (no AI): the device's own reading of it. */
  function scriptAnswer(said: AssistantMessage[], value: string, m: 'ai' | 'script') {
    const field = next;
    const v = value.trim();
    const again = (words?: string) =>
      setMessages([...said, { role: 'assistant', content: words ?? question(field, m) }]);
    switch (field) {
      case 'primary':
      case 'secondary':
        return advance(
          { ...draft, [field]: [...v].slice(0, CAPS.hostName).join('') },
          skipped,
          said,
          null,
          m,
        );
      case 'parents':
        return advance({ ...draft, parents: [...v].slice(0, PARENTS_MAX).join('') }, skipped, said, null, m);
      case 'age': {
        const n = Number(v.replace(/[^\d]/g, ''));
        if (!Number.isInteger(n) || n < 1 || n > 120) return again(a.ageInvalid);
        return advance({ ...draft, age: n }, skipped, said, null, m);
      }
      case 'venue': {
        const [name, ...rest] = v.split(/[,،]/);
        return advance(
          {
            ...draft,
            venueName: name?.trim() || null,
            venueAddress: rest.join(',').trim() || null,
          },
          skipped,
          said,
          null,
          m,
        );
      }
      case 'story':
        return advance({ ...draft, story: v }, skipped, said, null, m);
      case 'date': {
        const d = parseDate(v);
        return d ? advance({ ...draft, date: d }, skipped, said, null, m) : again();
      }
      case 'startTime': {
        const time = parseTime(v);
        return time ? advance({ ...draft, startTime: time }, skipped, said, null, m) : again();
      }
      default:
        return again();
    }
  }

  async function send(value: string) {
    const content = [...value.trim()].slice(0, ASSISTANT.messageMax).join('');
    if (!content || busy) return;
    setText('');
    setError(null);
    const said: AssistantMessage[] = [...messages, { role: 'user', content }];
    if (mode === 'script') return scriptAnswer(said, content, 'script');
    setMessages(said);
    setBusy(true);
    try {
      const res = await fetch('/api/invitations/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: seed.templateId,
          uiLocale: ui,
          locale,
          today: today(),
          draft,
          skipped,
          messages: said.slice(-ASSISTANT.maxMessages),
        }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/app/invitations/new')}`);
        return;
      }
      const body = (await res.json().catch(() => null)) as (TurnResult & { ok?: boolean }) | null;
      if (!res.ok || !body?.ok) throw new Error(`assistant: ${res.status}`);
      if (body.source === 'script' && body.reason === 'error') {
        // a passing failure (a slow or busy model): the device reads this answer and asks on, and the
        // next message goes to the AI again
        scriptAnswer(said, content, 'ai');
        return;
      }
      if (body.source === 'script') {
        // no AI from here on (not set up, or past a limit): say so once, then the device reads this
        // answer and asks on
        setMode('script');
        const note: AssistantMessage[] = [...said, { role: 'assistant', content: a.offline }];
        scriptAnswer(note, content, 'script');
        return;
      }
      advance(body.draft, body.skipped, said, body.reply);
    } catch {
      setMessages(said);
      setError(a.error);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!draft.eventType || !draft.primary || !draft.date || !draft.startTime) return;
    const one = (v: string | null | undefined): L10n | null => (v?.trim() ? { [locale]: v.trim() } : null);
    const couple = COUPLE_EVENTS.includes(draft.eventType);
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: seed.templateId,
          eventType: draft.eventType,
          locales: [locale],
          defaultLocale: locale,
          hosts: {
            primary: one(draft.primary) ?? {},
            secondary: couple ? one(draft.secondary) : null,
            parents: one(draft.parents),
          },
          age: draft.eventType === 'birthday' ? (draft.age ?? null) : null,
          paletteId: draft.paletteId ?? seed.paletteId,
          fontPairId: seed.fontPairId,
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime ?? null,
          // as in the wizard: Asia/Jerusalem for Hebrew, otherwise the browser's zone
          timezone: ui === 'he' ? DEFAULT_TIMEZONE : browserTimezone(),
          venue:
            draft.venueName || draft.venueAddress
              ? { name: one(draft.venueName) ?? {}, address: one(draft.venueAddress) ?? {} }
              : null,
          story: one(draft.story),
        }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/app/invitations/new')}`);
        return;
      }
      const body = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null;
      const limit = upgradeReason(res.status, body);
      if (limit) {
        setCreating(false);
        setUpgrade(limit);
        return;
      }
      if (res.ok && body?.ok && body.id) {
        // what the host said they need in the start wizard (lib/tools), else the invitation they came for
        await saveEventTools(body.id, readAnswers()?.tools ?? DEFAULT_TOOLS);
        // The skeleton stays up until the editor replaces this page.
        router.push(`/app/invitations/${body.id}/edit`);
        return;
      }
      throw new Error(`create failed: ${res.status}`);
    } catch {
      setCreating(false);
      setError(a.createError);
    }
  }

  function submitText(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  const paletteName = (id: string | null | undefined) => {
    const p = manifest.palettePresets.find((x) => x.id === id);
    return p ? (p.name[ui] ?? p.name.en ?? p.id) : null;
  };
  const dateLabel = (iso: string) => formatDate(`${iso}T12:00:00`);
  const value = (f: AssistantField): string | null => {
    switch (f) {
      case 'eventType':
        return type ? t.eventTypes[type] : null;
      case 'date':
        return draft.date ? dateLabel(draft.date) : null;
      case 'startTime':
        return draft.startTime ? [draft.startTime, draft.endTime].filter(Boolean).join('–') : null;
      case 'venue':
        return [draft.venueName, draft.venueAddress].filter(Boolean).join(', ') || null;
      case 'style':
        return paletteName(draft.paletteId);
      case 'age':
        return draft.age ? String(draft.age) : null;
      default:
        return draft[f] ?? null;
    }
  };
  const label = (f: AssistantField) => {
    if (f !== 'primary' || !type) return a.labels[f];
    return COUPLE_EVENTS.includes(type)
      ? a.labels.primary
      : t.wizard.fields[
          type === 'bar_mitzvah' || type === 'bat_mitzvah'
            ? 'celebrant'
            : type === 'brit'
              ? 'babyParents'
              : type === 'birthday' || type === 'baby_shower'
                ? 'name'
                : 'host'
        ];
  };

  const chip =
    'inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 hover:bg-subtle disabled:opacity-50 motion-reduce:transition-none';
  const showText =
    mode === 'ai' ||
    next === 'primary' ||
    next === 'secondary' ||
    next === 'parents' ||
    next === 'age' ||
    next === 'venue' ||
    next === 'story';

  return (
    <>
      {upgrade ? <UpgradeDialog reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
      <Dialog
        open
        onOpenChange={(open) => !open && !creating && onClose()}
        title={fmt(a.title, { template: templateName })}
        description={a.description}
        closeLabel={creating ? undefined : t.common.close}
        className="max-w-[600px]!"
        footer={
          creating ? null : (
            <>
              <Button variant="ghost" icon={<Pencil />} onClick={onManual}>
                {a.manual}
              </Button>
              {next === null ? (
                <Button icon={<Sparkles />} onClick={() => void create()}>
                  {a.create}
                </Button>
              ) : null}
            </>
          )
        }
      >
        {creating ? (
          <div role="status" className="flex items-center gap-4 py-2">
            <Skeleton width={72} height={128} radius={14} />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <p className="text-[15px] font-semibold">{a.creating}</p>
              <Skeleton shape="line" width="70%" />
              <Skeleton shape="line" width="45%" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              ref={log}
              role="log"
              aria-live="polite"
              className="flex h-[min(46vh,380px)] flex-col gap-2.5 overflow-y-auto rounded-card border border-line bg-subtle/50 p-3"
            >
              {messages.map((m, i) => (
                <p
                  key={i}
                  dir="auto"
                  className={cn(
                    'max-w-[85%] rounded-[18px] px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-line',
                    m.role === 'assistant'
                      ? 'self-start rounded-ss-md bg-surface shadow-xs'
                      : 'self-end rounded-se-md bg-ink text-white',
                  )}
                >
                  {m.content}
                </p>
              ))}
              {busy ? (
                <p
                  role="status"
                  className="self-start rounded-[18px] bg-surface px-3.5 py-2 text-[14px] text-muted"
                >
                  {a.thinking}
                </p>
              ) : null}
              {next === null ? (
                <section
                  aria-label={a.summary}
                  className="mt-1 rounded-card border border-line bg-surface p-3.5"
                >
                  <h3 className="mb-2 text-[14px] font-bold">{a.summary}</h3>
                  <dl className="flex flex-col gap-1.5 text-[13px]">
                    {fields.map((f) => {
                      const v = value(f);
                      return (
                        <div key={f} className="flex items-start gap-2">
                          <dt className="w-24 shrink-0 text-muted">{label(f)}</dt>
                          <dd
                            dir="auto"
                            className={cn(
                              'min-w-0 flex-1 break-words',
                              !v && 'text-muted',
                              f === 'story' && 'line-clamp-3',
                            )}
                          >
                            {v ?? a.noValue}
                          </dd>
                          <button
                            type="button"
                            onClick={() => change(f)}
                            className="shrink-0 text-[12px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
                          >
                            {a.change}
                            <span className="sr-only"> {label(f)}</span>
                          </button>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="mt-3 rounded-input bg-subtle px-3 py-2 text-[12.5px] leading-snug text-muted">
                    {a.advanced}
                  </p>
                </section>
              ) : null}
            </div>

            {!busy && next === 'eventType' ? (
              <div className="flex flex-wrap gap-2">
                {manifest.categories.map((c) => {
                  const Icon = EVENT_ICONS[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      className={chip}
                      onClick={() => answer({ eventType: c }, t.eventTypes[c])}
                    >
                      <Icon aria-hidden strokeWidth={1.75} className="size-4 text-muted" />
                      {t.eventTypes[c]}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {!busy && next === 'date' ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (dateValue) answer({ date: dateValue }, dateLabel(dateValue));
                }}
              >
                <Input
                  type="date"
                  aria-label={a.labels.date}
                  value={dateValue}
                  min={today()}
                  onChange={(e) => setDateValue(e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                <Button type="submit" disabled={!dateValue}>
                  {a.send}
                </Button>
              </form>
            ) : null}

            {!busy && next === 'startTime' ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (timeValue) answer({ startTime: timeValue }, timeValue);
                }}
              >
                <Input
                  type="time"
                  step={300}
                  aria-label={a.labels.startTime}
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                <Button type="submit" disabled={!timeValue}>
                  {a.send}
                </Button>
              </form>
            ) : null}

            {!busy && next === 'style' ? (
              <div className="flex flex-wrap gap-2">
                {manifest.palettePresets.map((p) => {
                  const palette = { ...manifest.tokens.palette, ...p.palette };
                  const name = p.name[ui] ?? p.name.en ?? p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={chip}
                      onClick={() => answer({ paletteId: p.id }, name)}
                    >
                      <span aria-hidden className="flex gap-1">
                        {[palette.bg, palette.accent, palette.ink].map((c, i) => (
                          <span
                            key={i}
                            className="size-3 rounded-full border border-black/10"
                            style={{ background: c }}
                          />
                        ))}
                      </span>
                      {name}
                    </button>
                  );
                })}
                <button type="button" className={chip} onClick={() => skip('style', a.anyStyle)}>
                  {a.anyStyle}
                </button>
              </div>
            ) : null}

            {!busy && next !== null && next !== 'style' && !isRequired(next) ? (
              <div className="flex flex-wrap gap-2">
                {next === 'story' && mode === 'ai' ? (
                  <button type="button" className={chip} onClick={() => void send(a.writeForMeMessage)}>
                    <Sparkles aria-hidden className="size-4 text-muted" />
                    {a.writeForMe}
                  </button>
                ) : null}
                <button type="button" className={chip} onClick={() => skip(next, a.skip)}>
                  {a.skip}
                </button>
              </div>
            ) : null}

            {showText && !(next === null && mode === 'script') ? (
              <form onSubmit={submitText} className="flex gap-2">
                <Input
                  ref={input}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={ASSISTANT.messageMax}
                  placeholder={mode === 'ai' ? a.placeholderAi : a.placeholder}
                  aria-label={mode === 'ai' ? a.placeholderAi : a.placeholder}
                  disabled={busy}
                  dir="auto"
                  autoComplete="off"
                  className="flex-1"
                />
                <Button type="submit" disabled={busy || !text.trim()} icon={<ArrowUp />} loading={busy}>
                  {a.send}
                </Button>
              </form>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-input bg-danger/10 px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>
    </>
  );
}
