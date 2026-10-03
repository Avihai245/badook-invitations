'use client';

import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, cn, Field, Input, Switch, Textarea, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { INTEGRATION_MODES, type IntegrationMode, type PlanView } from '../model/plan';
import type { PrivateTemplateItems } from '../model/draft';
import { hasSeats } from '../model/draft';
import { daysBetween } from '../model/schedule';
import { systemTasksFor } from '../model/system-tasks';
import { templateFor } from '../templates';
import { usePlan } from './PlanProvider';

const STEPS = ['event', 'numbers', 'link'] as const;
type Step = (typeof STEPS)[number];

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 9);
const toInt = (v: string): number | null => (v === '' ? null : Number.parseInt(v, 10));

/**
 * Setting a plan up: three short steps — the event (taken from the invitation, with the plan made for
 * its kind), the guests and the total budget (the guest count taken from the list), and how far the
 * plan follows the rest of the invitation. Every step can be skipped; "start planning" works at any
 * point with what has been chosen so far.
 */
export function Onboarding() {
  const { t, fmt, plural, number, date } = useUi();
  const O = t.planning.onboarding;
  const { toast } = useToast();
  const plan = usePlan();
  const { view } = plan;
  const type = view.invitation.eventType;
  const tpl = templateFor(type);
  const [step, setStep] = useState<Step>('event');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // step 1: only an event with no template of its own chooses how to start
  const [start, setStart] = useState<'blank' | 'draft' | 'private'>('blank');
  const [describe, setDescribe] = useState('');
  const [draft, setDraft] = useState<PrivateTemplateItems | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);

  // step 2
  const invited = view.headcount.invited;
  const [budget, setBudget] = useState('');
  const [adults, setAdults] = useState(String(invited || ''));
  const [children, setChildren] = useState('');

  // step 3
  const [mode, setMode] = useState<IntegrationMode>('recommended');
  const [email, setEmail] = useState(true);

  const eventDate = view.invitation.date;
  const daysLeft = eventDate ? daysBetween(view.today, eventDate) : null;
  const summary = useMemo(() => {
    if (!tpl) return null;
    const system = systemTasksFor({
      size: tpl.size,
      seating: view.features.seating,
      checkin: view.features.checkin,
      seated: hasSeats(tpl),
    }).length;
    const horizon = Math.max(0, ...tpl.tasks.map((x) => (x.offset < 0 ? -x.offset : 0)));
    return {
      tasks: tpl.tasks.length + system,
      categories: tpl.categories.length,
      squeezed: daysLeft !== null && daysLeft >= 0 && daysLeft < horizon,
      full: tpl.size === 'full',
    };
  }, [tpl, view.features.seating, view.features.checkin, daysLeft]);

  const modeText: Record<IntegrationMode, { title: string; body: string }> = {
    standalone: { title: O.link.standalone, body: O.link.standaloneBody },
    recommended: { title: O.link.recommended, body: O.link.recommendedBody },
    full: { title: O.link.full, body: O.link.fullBody },
  };

  const index = STEPS.indexOf(step);
  const isOther = type === 'other';

  const make = async () => {
    setBusy(true);
    setFailed(false);
    const template = isOther
      ? start === 'draft' && draft
        ? 'draft'
        : 'blank'
      : (templateFor(type)?.key ?? 'blank');
    const res = await plan.call<{ view?: PlanView }>('', {
      op: 'init',
      template,
      ...(template === 'draft' && draft ? { draft } : {}),
      totalBudget: toInt(digits(budget)),
      manualAdults: toInt(digits(adults)),
      manualChildren: toInt(digits(children)),
      integrationsMode: mode,
      remindersEmail: email,
    });
    setBusy(false);
    if (res.status === 409) return void plan.refresh();
    if (!res.ok || !res.body?.view) {
      setFailed(true);
      return void toast({ title: O.failed, variant: 'danger' });
    }
    plan.setView(res.body.view);
  };

  const askDraft = async () => {
    setDrafting(true);
    setDraftFailed(false);
    const res = await plan.call<{ draft?: PrivateTemplateItems }>('/ai', { description: describe });
    setDrafting(false);
    if (!res.ok || !res.body?.draft) return setDraftFailed(true);
    setDraft(res.body.draft);
  };

  const next = () => (index < STEPS.length - 1 ? setStep(STEPS[index + 1]!) : void make());
  const back = () => index > 0 && setStep(STEPS[index - 1]!);

  return (
    <section aria-labelledby="plan-onboarding-title" className="mx-auto flex max-w-[720px] flex-col gap-5">
      <header>
        <h2 id="plan-onboarding-title" className="text-[22px] font-bold">
          {O.title}
        </h2>
        <p className="mt-1 text-[14px] text-muted">{O.subtitle}</p>
      </header>

      <ol aria-label={O.title} className="flex gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={s === step ? 'step' : undefined}
            className={cn(
              'flex flex-1 items-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold ring-1',
              s === step
                ? 'bg-brand-soft text-brand-deep ring-brand-line'
                : i < index
                  ? 'bg-success-bg text-success ring-success-line'
                  : 'bg-surface text-muted ring-line',
            )}
          >
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-full bg-surface text-[11.5px] tabular-nums"
            >
              {i < index ? <Check className="size-3" strokeWidth={3} /> : number(i + 1)}
            </span>
            <span className="truncate max-sm:sr-only">{O.steps[s]}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only">{fmt(O.stepOf, { n: number(index + 1), total: number(STEPS.length) })}</p>

      <Card padding="lg" className="flex flex-col gap-5">
        {step === 'event' ? (
          <>
            <div>
              <h3 className="text-[17px] font-bold">{O.event.title}</h3>
              <p className="mt-1 text-[14px] text-muted">{O.event.body}</p>
            </div>
            <dl className="grid gap-3 rounded-card bg-subtle p-4 sm:grid-cols-2">
              <div>
                <dt className="text-[12.5px] text-muted">{t.eventTypes[type]}</dt>
                <dd className="text-[15px] font-semibold">
                  {eventDate
                    ? date(eventDate, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">{O.event.date}</dt>
                <dd className="text-[15px] font-semibold">
                  {daysLeft === null
                    ? '—'
                    : daysLeft >= 0
                      ? plural(t.planning.common.inDays, daysLeft, { n: number(daysLeft) })
                      : plural(t.planning.common.daysAgo, -daysLeft, { n: number(-daysLeft) })}
                </dd>
              </div>
            </dl>

            {summary ? (
              <div className="flex items-start gap-3 rounded-card border border-brand-line bg-brand-soft/50 p-4">
                <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-deep" />
                <div>
                  <p className="text-[14px] font-bold">{O.event.template}</p>
                  <p className="mt-0.5 text-[13.5px] text-ink/80">
                    {fmt(summary.full ? O.event.templateFull : O.event.templateLight, {
                      tasks: number(summary.tasks),
                      categories: number(summary.categories),
                    })}
                  </p>
                  {summary.squeezed ? (
                    <p className="mt-1.5 text-[13px] text-warning">{O.event.squeezed}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isOther ? (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] font-semibold">{O.event.other}</p>
                <div role="radiogroup" aria-label={O.event.other} className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { key: 'blank', title: O.event.blank, body: O.event.blankBody, locked: false },
                      {
                        key: 'draft',
                        title: O.event.describe,
                        body: O.event.describeBody,
                        locked: !view.features.ai,
                      },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={start === o.key}
                      disabled={o.locked}
                      onClick={() => setStart(o.key)}
                      className={cn(
                        'flex min-h-11 flex-col items-start gap-1 rounded-card border p-4 text-start transition-colors disabled:opacity-60',
                        start === o.key
                          ? 'border-brand bg-brand-soft/50'
                          : 'border-line bg-surface hover:bg-subtle',
                      )}
                    >
                      <span className="flex items-center gap-2 text-[14.5px] font-bold">
                        {o.title}
                        {o.locked ? (
                          <Badge variant="info">{fmt(O.event.locked, { plan: 'Pro' })}</Badge>
                        ) : null}
                      </span>
                      <span className="text-[13px] text-muted">{o.body}</span>
                    </button>
                  ))}
                </div>
                {start === 'draft' && view.features.ai ? (
                  <div className="flex flex-col gap-3">
                    <Field label={O.event.describeLabel}>
                      <Textarea
                        value={describe}
                        maxLength={600}
                        placeholder={O.event.describePlaceholder}
                        onChange={(e) => setDescribe(e.target.value)}
                      />
                    </Field>
                    <Button
                      variant="secondary"
                      icon={<Sparkles />}
                      loading={drafting}
                      disabled={describe.trim().length < 8 || drafting}
                      onClick={() => void askDraft()}
                      className="self-start"
                    >
                      {drafting ? O.event.describing : O.event.describeCta}
                    </Button>
                    {draftFailed ? <p className="text-[13px] text-danger">{O.event.describeFailed}</p> : null}
                    {draft ? (
                      <div className="rounded-card border border-line bg-subtle p-3">
                        <p className="text-[13px] font-semibold">{O.event.describeReview}</p>
                        <p className="mt-1 text-[12.5px] text-muted">
                          {plural(O.event.draftTasks, draft.tasks.length, { n: number(draft.tasks.length) })}
                        </p>
                        <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
                          {draft.tasks.map((task, i) => (
                            <li
                              key={`${task.title}-${i}`}
                              className="flex items-center justify-between gap-3 text-[13px]"
                            >
                              <span className="min-w-0 truncate">{task.title}</span>
                              <button
                                type="button"
                                className="shrink-0 text-[12.5px] font-semibold text-brand-deep underline"
                                onClick={() =>
                                  setDraft({ ...draft, tasks: draft.tasks.filter((_, j) => j !== i) })
                                }
                              >
                                {t.planning.common.delete}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {step === 'numbers' ? (
          <>
            <div>
              <h3 className="text-[17px] font-bold">{O.numbers.title}</h3>
              <p className="mt-1 text-[14px] text-muted">{O.numbers.body}</p>
            </div>
            <Field label={O.numbers.budget} help={O.numbers.budgetHint}>
              <Input
                inputMode="numeric"
                dir="ltr"
                textAlign="start"
                value={budget}
                placeholder="₪"
                onChange={(e) => setBudget(digits(e.target.value))}
              />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13.5px] font-semibold">{O.numbers.guests}</legend>
              <p className="text-[12.5px] text-muted">
                {invited > 0 ? fmt(O.numbers.guestsFromList, { n: number(invited) }) : O.numbers.noList}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={O.numbers.adults}>
                  <Input
                    inputMode="numeric"
                    dir="ltr"
                    textAlign="start"
                    value={adults}
                    onChange={(e) => setAdults(digits(e.target.value))}
                  />
                </Field>
                <Field label={O.numbers.children}>
                  <Input
                    inputMode="numeric"
                    dir="ltr"
                    textAlign="start"
                    value={children}
                    onChange={(e) => setChildren(digits(e.target.value))}
                  />
                </Field>
              </div>
            </fieldset>
          </>
        ) : null}

        {step === 'link' ? (
          <>
            <div>
              <h3 className="text-[17px] font-bold">{O.link.title}</h3>
              <p className="mt-1 text-[14px] text-muted">{O.link.body}</p>
            </div>
            <div role="radiogroup" aria-label={O.link.title} className="flex flex-col gap-3">
              {INTEGRATION_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex min-h-11 flex-col items-start gap-1 rounded-card border p-4 text-start transition-colors',
                    mode === m ? 'border-brand bg-brand-soft/50' : 'border-line bg-surface hover:bg-subtle',
                  )}
                >
                  <span className="flex items-center gap-2 text-[14.5px] font-bold">
                    {modeText[m].title}
                    {m === 'recommended' ? <Badge variant="info">{O.link.recommended}</Badge> : null}
                  </span>
                  <span className="text-[13px] text-muted">{modeText[m].body}</span>
                </button>
              ))}
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-line pt-4">
              <span>
                <span className="block text-[14px] font-semibold">{O.link.reminders}</span>
                <span className="block text-[12.5px] text-muted">{O.link.remindersBody}</span>
              </span>
              <Switch label={O.link.reminders} checked={email} onCheckedChange={setEmail} />
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex gap-2">
            {index > 0 ? (
              <Button
                variant="ghost"
                icon={<ArrowLeft className="icon-dir" />}
                onClick={back}
                disabled={busy}
              >
                {O.back}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:flex-col-reverse">
            {index < STEPS.length - 1 ? (
              <Button variant="ghost" onClick={() => void make()} disabled={busy} loading={busy}>
                {O.skip}
              </Button>
            ) : null}
            <Button
              icon={index < STEPS.length - 1 ? <ArrowRight className="icon-dir" /> : undefined}
              onClick={next}
              loading={busy && index === STEPS.length - 1}
              disabled={busy || (isOther && start === 'draft' && !draft && index === 0)}
            >
              {index < STEPS.length - 1 ? O.next : busy ? O.creating : O.finish}
            </Button>
          </div>
        </div>
        {failed ? (
          <p role="alert" className="text-[13px] text-danger">
            {O.failed}
          </p>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {busy ? O.creating : ''}
        </p>
      </Card>
    </section>
  );
}
