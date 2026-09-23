'use client';

import {
  Baby,
  Briefcase,
  Cake,
  CalendarHeart,
  Flower2,
  Gem,
  Gift,
  Heart,
  ScrollText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Button,
  Dialog,
  Field,
  Input,
  Segmented,
  Select,
  Skeleton,
  cn,
  rovingKeyDown,
} from '@/components/app';
import type { AppDict } from '@/lib/i18n/app.he';
import { useUi } from '@/lib/i18n/client';
import type { EventType, L10n, Locale } from '../../contracts/types';
import { CAPS } from '../../contracts/validate';
import { requireTemplate } from '../../templates/registry';
import { browserTimezone, DEFAULT_TIMEZONE, timezoneOptions } from '../../lib/timezones';
import { COUPLE_EVENTS } from '../../templates/seed-copy';

export interface WizardSeed {
  templateId: string;
  paletteId: string | null;
  fontPairId: string | null;
  /** preselected from the gallery filter */
  eventType: EventType | null;
}

const EVENT_ICONS: Record<EventType, LucideIcon> = {
  wedding: Heart,
  engagement: Gem,
  henna: Flower2,
  bar_mitzvah: ScrollText,
  bat_mitzvah: ScrollText,
  brit: Baby,
  birthday: Cake,
  baby_shower: Gift,
  save_the_date: CalendarHeart,
  corporate: Briefcase,
  other: Sparkles,
};

/** the create API keeps up to 40 characters of the parents' line */
const PARENTS_MAX = 40;

type NameKey = 'primary' | 'secondary' | 'parents';
type Names = Record<NameKey, string>;
const NO_NAMES: Names = { primary: '', secondary: '', parents: '' };
type Languages = Locale | 'both';

interface NameField {
  key: NameKey;
  label: string;
  hint?: string;
  required: boolean;
  max: number;
}

/** §9B.3-C step 2: the name fields adapt to the event type. */
function nameFields(type: EventType, f: AppDict['wizard']['fields']): NameField[] {
  const name = (key: NameKey, label: string): NameField => ({
    key,
    label,
    required: true,
    max: CAPS.hostName,
  });
  if (COUPLE_EVENTS.includes(type)) return [name('primary', f.name1), name('secondary', f.name2)];
  switch (type) {
    case 'bar_mitzvah':
    case 'bat_mitzvah':
      return [
        name('primary', f.celebrant),
        { key: 'parents', label: f.parents, hint: f.parentsHint, required: false, max: PARENTS_MAX },
      ];
    case 'brit':
      return [name('primary', f.babyParents)];
    case 'birthday':
    case 'baby_shower':
      return [name('primary', f.name)];
    default:
      return [name('primary', f.host)];
  }
}

/**
 * New-invitation wizard (§9B.3-C): a 560px dialog in 3 steps — event type → names, date and time →
 * languages (+ the names in the other language) — then POST /api/invitations and on to the editor.
 */
export function CreateWizard({ seed, onClose }: { seed: WizardSeed; onClose: () => void }) {
  const { t, fmt, locale: ui } = useUi();
  const w = t.wizard;
  const router = useRouter();
  const { manifest } = requireTemplate(seed.templateId);
  const types = manifest.categories;
  const supported = manifest.supportsLocales;
  /** the language of the names typed in step 2 */
  const first: Locale = supported.includes(ui) ? ui : supported[0]!;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [eventType, setEventType] = useState<EventType>(
    seed.eventType && types.includes(seed.eventType) ? seed.eventType : types[0]!,
  );
  const [names, setNames] = useState<Partial<Record<Locale, Names>>>({});
  const [age, setAge] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  // §7.2: Asia/Jerusalem for Hebrew, otherwise the browser's zone.
  const [timezone, setTimezone] = useState(() => (ui === 'he' ? DEFAULT_TIMEZONE : browserTimezone()));
  const [languages, setLanguages] = useState<Languages>(first);
  const [defaultLocale, setDefaultLocale] = useState<Locale>(first);
  const [attempted, setAttempted] = useState({ 2: false, 3: false });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formId = useId();
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    // Focus follows the step (not on open: the dialog focuses its first control).
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  const fields = nameFields(eventType, w.fields);
  const couple = COUPLE_EVENTS.includes(eventType);
  const locales: Locale[] =
    languages === 'both' ? [defaultLocale, ...supported.filter((l) => l !== defaultLocale)] : [languages];
  const others = locales.filter((l) => l !== first);
  const zones = useMemo(() => (step === 2 ? timezoneOptions([timezone]) : []), [step, timezone]);

  const namesOf = (l: Locale) => names[l] ?? NO_NAMES;
  const setName = (l: Locale, key: NameKey, value: string) =>
    setNames((prev) => ({ ...prev, [l]: { ...(prev[l] ?? NO_NAMES), [key]: value } }));
  const missing = (l: Locale) =>
    fields.filter((f) => f.required && !namesOf(l)[f.key].trim()).map((f) => f.key);
  const ageValue = age.trim() ? Number(age) : null;
  const ageInvalid = ageValue !== null && !(Number.isInteger(ageValue) && ageValue >= 1 && ageValue <= 120);
  const step2Valid = !missing(first).length && !!date && !!startTime && !!timezone && !ageInvalid;
  const step3Valid = others.every((l) => !missing(l).length);

  const focusFirstInvalid = () =>
    window.setTimeout(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);

  async function create() {
    const l10n = (key: NameKey): L10n | null => {
      const out: L10n = {};
      for (const l of locales) {
        const v = namesOf(l)[key].trim();
        if (v) out[l] = v;
      }
      return Object.keys(out).length ? out : null;
    };
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId: seed.templateId,
          eventType,
          locales,
          defaultLocale: locales[0],
          hosts: {
            primary: l10n('primary') ?? {},
            secondary: couple ? l10n('secondary') : null,
            parents: fields.some((f) => f.key === 'parents') ? l10n('parents') : null,
          },
          age: eventType === 'birthday' ? ageValue : null,
          paletteId: seed.paletteId,
          fontPairId: seed.fontPairId,
          date,
          startTime,
          timezone,
        }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/app/invitations/new')}`);
        return;
      }
      const body = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null;
      if (res.ok && body?.ok && body.id) {
        // The skeleton stays up until the editor replaces this page.
        router.push(`/app/invitations/${body.id}/edit`);
        return;
      }
      throw new Error(`create failed: ${res.status}`);
    } catch {
      setCreating(false);
      setError(w.errors.create);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 1) setStep(2);
    else if (step === 2) {
      if (step2Valid) setStep(3);
      else {
        setAttempted((a) => ({ ...a, 2: true }));
        focusFirstInvalid();
      }
    } else if (step3Valid) void create();
    else {
      setAttempted((a) => ({ ...a, 3: true }));
      focusFirstInvalid();
    }
  }

  const nameInputs = (l: Locale, show: boolean) => (
    <div className={cn('grid gap-4', couple && 'sm:grid-cols-2')}>
      {fields.map((f) => {
        const value = namesOf(l)[f.key];
        return (
          <Field
            key={f.key}
            label={f.label}
            required={f.required}
            help={f.hint}
            error={show && f.required && !value.trim() ? w.errors.required : undefined}
          >
            <Input
              value={value}
              onChange={(e) => setName(l, f.key, e.target.value)}
              maxLength={f.max}
              lang={l}
              dir={l === 'he' ? 'rtl' : 'ltr'}
              autoComplete="off"
            />
          </Field>
        );
      })}
    </div>
  );

  const title = [w.step1, w.step2, w.step3][step - 1];
  const templateName = manifest.name[ui] ?? manifest.name.en ?? manifest.id;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !creating && onClose()}
      title={fmt(w.title, { template: templateName })}
      description={
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="flex items-center gap-1.5">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
                  n === step ? 'w-5 bg-ink' : n < step ? 'w-1.5 bg-ink/60' : 'w-1.5 bg-line',
                )}
              />
            ))}
          </span>
          {fmt(w.progress, { step })}
        </span>
      }
      closeLabel={creating ? undefined : t.common.close}
      footer={
        creating ? null : (
          <>
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
                {t.common.back}
              </Button>
            ) : null}
            <Button type="submit" form={formId}>
              {step === 3 ? w.create : t.common.next}
            </Button>
          </>
        )
      }
    >
      {creating ? (
        <div role="status" className="flex items-center gap-4 py-2">
          <Skeleton width={72} height={128} radius={14} />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <p className="text-[15px] font-semibold">{w.creating}</p>
            <Skeleton shape="line" width="70%" />
            <Skeleton shape="line" width="45%" />
          </div>
        </div>
      ) : (
        <form ref={form} id={formId} onSubmit={submit} noValidate>
          <h3 ref={heading} id={headingId} tabIndex={-1} className="mb-4 text-[16px] font-bold outline-none">
            {title}
          </h3>

          {step === 1 ? (
            <div
              role="radiogroup"
              aria-labelledby={headingId}
              onKeyDown={rovingKeyDown}
              className="grid grid-cols-2 gap-2"
            >
              {types.map((type) => {
                const Icon = EVENT_ICONS[type];
                const on = type === eventType;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    data-roving-item=""
                    onClick={() => setEventType(type)}
                    className={cn(
                      'flex h-16 items-center gap-3 rounded-card border px-4 text-start text-[14px] font-semibold',
                      'transition-[background-color,border-color] duration-150 motion-reduce:transition-none',
                      on ? 'border-ink bg-subtle ring-1 ring-ink' : 'border-line bg-surface hover:bg-subtle',
                    )}
                  >
                    <Icon aria-hidden strokeWidth={1.75} className="size-[22px] shrink-0 text-muted" />
                    {t.eventTypes[type]}
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              {eventType === 'birthday' ? (
                <div className="grid grid-cols-[2fr_1fr] gap-4">
                  {nameInputs(first, attempted[2])}
                  <Field
                    label={w.fields.age}
                    help={w.fields.ageHint}
                    error={ageInvalid ? w.errors.age : undefined}
                  >
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      dir="ltr"
                    />
                  </Field>
                </div>
              ) : (
                nameInputs(first, attempted[2])
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label={w.fields.date}
                  required
                  error={attempted[2] && !date ? w.errors.date : undefined}
                >
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
                </Field>
                <Field
                  label={w.fields.startTime}
                  required
                  error={attempted[2] && !startTime ? w.errors.time : undefined}
                >
                  <Input
                    type="time"
                    step={300}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    dir="ltr"
                  />
                </Field>
              </div>
              <Field label={w.fields.timezone}>
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)} dir="ltr">
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-5">
              <div
                role="radiogroup"
                aria-labelledby={headingId}
                onKeyDown={rovingKeyDown}
                className={cn('grid gap-2', supported.length > 1 ? 'grid-cols-3' : 'grid-cols-1')}
              >
                {[...supported, ...(supported.length > 1 ? (['both'] as const) : [])].map((option) => {
                  const on = option === languages;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      data-roving-item=""
                      onClick={() => {
                        setLanguages(option);
                        if (option !== 'both') setDefaultLocale(option);
                      }}
                      className={cn(
                        'flex min-h-16 flex-col items-center justify-center gap-1 rounded-card border px-3 py-3 text-center',
                        'transition-[background-color,border-color] duration-150 motion-reduce:transition-none',
                        on
                          ? 'border-ink bg-subtle ring-1 ring-ink'
                          : 'border-line bg-surface hover:bg-subtle',
                      )}
                    >
                      <span
                        className="text-[15px] font-semibold"
                        lang={option === 'both' ? undefined : option}
                      >
                        {w.languages[option]}
                      </span>
                      {option === 'both' ? (
                        <span className="text-[12px] leading-snug text-muted">{w.languages.bothHint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {languages === 'both' ? (
                <Field label={w.languages.default}>
                  <Segmented<Locale>
                    value={defaultLocale}
                    onValueChange={setDefaultLocale}
                    options={supported.map((l) => ({ value: l, label: w.languages[l] }))}
                  />
                </Field>
              ) : null}
              {others.map((l) => (
                <fieldset key={l} className="flex flex-col gap-3 rounded-card border border-line p-4">
                  <legend className="px-1 text-[13px] font-bold text-muted">{w.fields.namesIn[l]}</legend>
                  {nameInputs(l, attempted[3])}
                </fieldset>
              ))}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}
