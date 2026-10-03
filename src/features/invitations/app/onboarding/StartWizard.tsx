'use client';

import { ArrowRight, Check, ClipboardList, Loader2, Palette, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Field, Input, cn } from '@/components/app';
import { templateKeyFor } from '@/features/planning/templates';
import { useUi } from '@/lib/i18n/client';
import type { EventType, Locale } from '../../contracts/types';
import { browserTimezone, DEFAULT_TIMEZONE } from '../../lib/timezones';
import { TEMPLATES } from '../../templates/registry';
import { COUPLE_EVENTS } from '../../templates/seed-copy';
import { EVENT_ICONS } from '../event-icons';
import { nameFields, type NameKey } from '../gallery/CreateWizard';
import { parseWhole, planInit, saveAnswers, type StartAnswers } from './answers';

/** The kinds of events a host starts from here (a save-the-date starts from the gallery). */
export const START_TYPES: EventType[] = [
  'wedding',
  'engagement',
  'henna',
  'bar_mitzvah',
  'bat_mitzvah',
  'brit',
  'birthday',
  'baby_shower',
  'corporate',
  'other',
];

/** The design a "planning first" event starts with: the first listed design made for its type. */
export function defaultTemplate(type: EventType, locale: Locale): { id: string; locales: Locale[] } | null {
  for (const { manifest } of TEMPLATES.values()) {
    if (!manifest.listed || !manifest.categories.includes(type)) continue;
    const locales = manifest.supportsLocales.includes(locale) ? [locale] : [manifest.supportsLocales[0]!];
    return { id: manifest.id, locales };
  }
  return null;
}

type Step = 1 | 2 | 3;

/**
 * "New event" (UX report §4.2): three full screens, under a minute — what kind of event; when, roughly
 * how many guests and the budget (optional), and who it's for; then where to start — planning, the
 * invitation's design, or both. Planning first creates the event with a design for its type and its plan
 * at once and lands on the event's home (its tour opens); the others go on to the gallery, filtered by
 * the type, carrying the answers. "Skip" goes straight to the gallery from any screen.
 */
export function StartWizard() {
  const { t, locale, plural, number, fmt } = useUi();
  const S = t.start;
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<EventType | null>(null);
  const [date, setDate] = useState('');
  const [guests, setGuests] = useState('');
  const [budget, setBudget] = useState('');
  const [names, setNames] = useState<Record<NameKey, string>>({ primary: '', secondary: '', parents: '' });
  const [start, setStart] = useState<StartAnswers['start']>('all');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const formId = useId();
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  const fields = type ? nameFields(type, t.wizard.fields) : [];
  const guestsN = parseWhole(guests, 100_000);
  const budgetN = parseWhole(budget, 1_000_000_000);
  const today = new Date().toISOString().slice(0, 10);
  const missingNames = fields.filter((f) => f.required && !names[f.key].trim()).map((f) => f.key);
  const step2Valid = !!date && guestsN !== undefined && budgetN !== undefined && !missingNames.length;

  const answers = (): StartAnswers => ({
    eventType: type!,
    date: date || null,
    guests: guestsN ?? null,
    budget: budgetN ?? null,
    start,
    names,
  });

  async function finish() {
    const a = answers();
    if (a.start !== 'plan') {
      saveAnswers(a);
      router.push(`/app/invitations/new?gallery=1&type=${a.eventType}`);
      return;
    }
    // planning first: the event with a design for its type, and its plan, in one go
    const tpl = defaultTemplate(a.eventType, locale);
    if (!tpl) {
      saveAnswers(a);
      router.push(`/app/invitations/new?gallery=1&type=${a.eventType}`);
      return;
    }
    setBusy(true);
    setError(null);
    const l10n = (v: string) => (v.trim() ? Object.fromEntries(tpl.locales.map((l) => [l, v.trim()])) : null);
    const couple = COUPLE_EVENTS.includes(a.eventType);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: tpl.id,
          eventType: a.eventType,
          locales: tpl.locales,
          defaultLocale: tpl.locales[0],
          hosts: {
            primary: l10n(a.names.primary) ?? {},
            secondary: couple ? l10n(a.names.secondary) : null,
            parents: fields.some((f) => f.key === 'parents') ? l10n(a.names.parents) : null,
          },
          date: a.date,
          startTime: '19:00',
          timezone: locale === 'he' ? DEFAULT_TIMEZONE : browserTimezone(),
        }),
      });
      if (res.status === 401) return router.push(`/login?next=${encodeURIComponent('/app/invitations/new')}`);
      const body = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null;
      if (!res.ok || !body?.id) throw new Error(String(res.status));
      // the plan: a convenience — the event exists either way
      await fetch(`/api/invitations/${body.id}/planning`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(planInit(a, templateKeyFor(a.eventType) ?? 'blank')),
      }).catch(() => null);
      router.push(`/app/invitations/${body.id}?tour=1`);
    } catch {
      setBusy(false);
      setError(S.where.error);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1 && type) return setStep(2);
    if (step === 2) {
      setTried(true);
      if (step2Valid) setStep(3);
      return;
    }
    if (step === 3) void finish();
  };

  return (
    <div className="start-bg min-h-dvh" data-testid="start-wizard" data-fullscreen="">
      <div className="mx-auto flex min-h-dvh max-w-[920px] flex-col px-4 pt-5 pb-10 sm:px-8 sm:pt-8">
        <header className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-muted">{fmt(S.progress, { n: number(step) })}</p>
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={step}
              aria-label={fmt(S.progress, { n: number(step) })}
              className="mt-1.5 flex gap-1.5"
            >
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none',
                    n <= step ? 'bg-brand' : 'bg-line',
                  )}
                />
              ))}
            </div>
          </div>
          <Link
            href="/app/invitations/new?gallery=1"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-btn px-2 py-1.5 text-[13px] font-semibold text-muted hover:text-ink"
            data-testid="start-skip"
          >
            {S.skip}
            <X aria-hidden className="size-4" />
          </Link>
        </header>

        <form id={formId} onSubmit={onSubmit} className="mt-8 flex flex-1 flex-col sm:mt-12" noValidate>
          {step === 1 ? (
            <Screen headingRef={heading} title={S.type.title} body={S.type.body}>
              <div
                role="radiogroup"
                aria-label={S.type.title}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
              >
                {START_TYPES.map((k) => {
                  const Icon = EVENT_ICONS[k];
                  const on = type === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      data-type={k}
                      onClick={() => {
                        setType(k);
                        setStep(2);
                      }}
                      className={cn(
                        'group flex flex-col items-center gap-3 rounded-[22px] border-2 bg-surface px-3 py-6 text-center shadow-sm transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                        on ? 'border-brand' : 'border-transparent ring-1 ring-line',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-14 place-items-center rounded-[18px] transition-colors',
                          on
                            ? 'bg-brand text-white'
                            : 'bg-brand-soft text-brand-deep group-hover:bg-brand group-hover:text-white',
                        )}
                      >
                        <Icon className="size-7" strokeWidth={1.6} />
                      </span>
                      <span className="text-[15px] font-bold">{t.eventTypes[k]}</span>
                    </button>
                  );
                })}
              </div>
            </Screen>
          ) : step === 2 && type ? (
            <Screen headingRef={heading} title={S.details.title} body={S.details.body}>
              <div className="grid gap-4 rounded-[24px] bg-surface p-5 shadow-sm ring-1 ring-line sm:grid-cols-2 sm:p-7">
                {fields.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    help={f.hint}
                    required={f.required}
                    error={tried && missingNames.includes(f.key) ? t.wizard.errors.required : undefined}
                  >
                    <Input
                      value={names[f.key]}
                      maxLength={f.max}
                      onChange={(e) => setNames((n) => ({ ...n, [f.key]: e.target.value }))}
                    />
                  </Field>
                ))}
                <Field
                  label={S.details.date}
                  required
                  error={tried && !date ? S.details.dateRequired : undefined}
                >
                  <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field
                  label={S.details.guests}
                  help={S.details.guestsHint}
                  error={guestsN === undefined ? S.details.invalidNumber : undefined}
                >
                  <Input
                    inputMode="numeric"
                    dir="ltr"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    placeholder="150"
                  />
                </Field>
                <Field
                  label={S.details.budget}
                  help={S.details.budgetHint}
                  error={budgetN === undefined ? S.details.invalidNumber : undefined}
                >
                  <Input
                    inputMode="numeric"
                    dir="ltr"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="120,000"
                  />
                </Field>
              </div>
            </Screen>
          ) : (
            <Screen headingRef={heading} title={S.where.title} body={S.where.body}>
              <div role="radiogroup" aria-label={S.where.title} className="grid gap-3 md:grid-cols-3">
                {(
                  [
                    { key: 'plan', icon: <ClipboardList />, words: S.where.plan },
                    { key: 'design', icon: <Palette />, words: S.where.design },
                    { key: 'all', icon: <Sparkles />, words: S.where.all },
                  ] as const
                ).map(({ key, icon, words }) => {
                  const on = start === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      data-start={key}
                      onClick={() => setStart(key)}
                      className={cn(
                        'relative flex flex-col items-start gap-3 rounded-[22px] border-2 bg-surface p-5 text-start shadow-sm transition-[box-shadow,border-color] hover:shadow-md motion-reduce:transition-none',
                        on ? 'border-brand' : 'border-transparent ring-1 ring-line',
                      )}
                    >
                      {'badge' in words ? (
                        <span className="absolute -top-2.5 end-4 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-white">
                          {words.badge}
                        </span>
                      ) : null}
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-12 place-items-center rounded-[15px] [&_svg]:size-6',
                          on ? 'bg-brand text-white' : 'bg-brand-soft text-brand-deep',
                        )}
                      >
                        {icon}
                      </span>
                      <span className="text-[17px] font-bold">{words.title}</span>
                      <span className="text-[13.5px] text-muted">{words.body}</span>
                      {on ? (
                        <Check
                          aria-hidden
                          className="absolute end-4 bottom-4 size-5 text-brand"
                          strokeWidth={3}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {type && (guestsN || budgetN) ? (
                <p className="mt-4 text-[13px] text-muted">
                  {[
                    t.eventTypes[type],
                    guestsN
                      ? plural(t.planning.budget.guests.guestsN, guestsN, { n: number(guestsN) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-4 rounded-btn bg-danger-bg px-3 py-2 text-[13.5px] text-danger">
                  {error}
                </p>
              ) : null}
            </Screen>
          )}

          <footer className="mt-auto flex items-center justify-between gap-3 pt-8">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={busy}
              >
                {S.back}
              </Button>
            ) : (
              <span />
            )}
            {step > 1 ? (
              <Button
                type="submit"
                size="lg"
                disabled={busy}
                icon={busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : undefined}
              >
                {busy ? S.where.creating : step === 3 ? S.where.cta : S.next}
                {busy ? null : <ArrowRight aria-hidden className="icon-dir size-4" />}
              </Button>
            ) : null}
          </footer>
        </form>
      </div>
    </div>
  );
}

function Screen({
  headingRef,
  title,
  body,
  children,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="motion-safe:animate-app-fade-in">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[30px] leading-tight font-extrabold tracking-tight outline-none sm:text-[40px]"
      >
        {title}
      </h1>
      <p className="mt-2 text-[15px] text-muted sm:text-[16px]">{body}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}
