'use client';

import { RotateCcw, WandSparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, Dialog, Field, Hint, Input, Select, Skeleton, cn, rovingKeyDown } from '@/components/app';
import { UpgradeDialog, upgradeReason, type UpgradeReason } from '@/features/billing/UpgradeDialog.client';
import { HelpFor } from '@/features/invitations/app/HelpFor';
import { hostApi } from '@/features/invitations/app/api';
import { EVENT_ICONS } from '@/features/invitations/app/event-icons';
import { nameFields, type NameKey } from '@/features/invitations/app/gallery/CreateWizard';
import {
  EVENT_TYPES,
  LOCALES,
  dirOf,
  type EventType,
  type InvitationDocument,
  type L10n,
  type Locale,
} from '@/features/invitations/contracts/types';
import { uploadFile } from '@/features/invitations/editor/fields/media';
import { NATIVE_NAMES, isFreeLocale } from '@/features/invitations/lib/locales';
import { browserTimezone, DEFAULT_TIMEZONE, timezoneOptions } from '@/features/invitations/lib/timezones';
import { getTemplate } from '@/features/invitations/templates/registry';
import { COUPLE_EVENTS } from '@/features/invitations/templates/seed-copy';
import { seedDocument, type WizardInput } from '@/features/invitations/templates/seed-document';
import { useUi } from '@/lib/i18n/client';
import { applyConcept } from '../apply';
import { ART_DIRECTION } from '../config';
import type { Concept } from '../model';
import { ConceptsView } from './ConceptsView';
import { PhotoPicker } from './PhotoPicker';
import { StudioErrors } from './StudioPanel';
import { usedPhotos, useStudio } from './useStudio';

type Names = Record<NameKey, string>;
const NO_NAMES: Names = { primary: '', secondary: '', parents: '' };
const STEP_KEYS = ['event', 'details', 'languages', 'photos'] as const;

/**
 * "Design it for me" for a new invitation (the gallery; feature `art_direction`): what is celebrated,
 * the names and date, the languages, then 3–5 photos and a mood → three concepts, live → the chosen
 * one becomes the invitation: made on the concept's design, its photos uploaded, the concept applied,
 * and on to the editor.
 */
export function StudioWizard({
  cinematic,
  moreLanguages = true,
  onClose,
}: {
  cinematic: boolean;
  /** languages beyond Hebrew and English may be chosen (feature `languages`) */
  moreLanguages?: boolean;
  onClose: () => void;
}) {
  const { t, fmt, locale: ui } = useUi();
  const w = t.wizard;
  const a = t.studio.art;
  const router = useRouter();
  // any of the seven — beyond Hebrew and English only with the `languages` feature
  const supported = LOCALES.filter((l) => moreLanguages || isFreeLocale(l));
  /** the language of the names typed in step 2 */
  const first: Locale = supported.includes(ui) ? ui : supported[0]!;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [names, setNames] = useState<Partial<Record<Locale, Names>>>({});
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [timezone, setTimezone] = useState(() => (ui === 'he' ? DEFAULT_TIMEZONE : browserTimezone()));
  /** the chosen languages, in the order they were picked */
  const [chosen, setChosen] = useState<Locale[]>([first]);
  const [defaultLocale, setDefaultLocale] = useState<Locale>(first);
  const [attempted, setAttempted] = useState({ 2: false, 3: false });
  const [creating, setCreating] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string | null } | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);
  const created = useRef<string | null>(null);

  const formId = useId();
  const headingId = useId();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  const fields = nameFields(eventType, w.fields);
  const couple = COUPLE_EVENTS.includes(eventType);
  // the default first (it opens first and leads the switcher), then the others as picked
  const locales: Locale[] = [defaultLocale, ...chosen.filter((l) => l !== defaultLocale)];
  const toggleLanguage = (l: Locale) =>
    setChosen((list) => {
      if (!list.includes(l)) return [...list, l];
      if (list.length === 1) return list;
      const next = list.filter((x) => x !== l);
      if (l === defaultLocale) setDefaultLocale(next[0]!);
      return next;
    });
  const others = locales.filter((l) => l !== first);
  const zones = useMemo(() => (step === 2 ? timezoneOptions([timezone]) : []), [step, timezone]);
  const namesOf = (l: Locale) => names[l] ?? NO_NAMES;
  const setName = (l: Locale, key: NameKey, value: string) =>
    setNames((prev) => ({ ...prev, [l]: { ...(prev[l] ?? NO_NAMES), [key]: value } }));
  const missing = (l: Locale) =>
    fields.filter((f) => f.required && !namesOf(l)[f.key].trim()).map((f) => f.key);
  const step2Valid = !missing(first).length && !!date && !!startTime && !!timezone;
  const step3Valid = others.every((l) => !missing(l).length);

  const studio = useStudio({ invitationId: null, eventType, locales, uiLocale: ui === 'en' ? 'en' : 'he' });

  const l10n = (key: NameKey): L10n | null => {
    const out: L10n = {};
    for (const l of locales) {
      const v = namesOf(l)[key].trim();
      if (v) out[l] = v;
    }
    return Object.keys(out).length ? out : null;
  };
  const input = (): WizardInput => ({
    eventType,
    locales,
    defaultLocale: locales[0]!,
    hosts: {
      primary: l10n('primary') ?? {},
      secondary: couple ? l10n('secondary') : null,
      parents: fields.some((f) => f.key === 'parents') ? l10n('parents') : null,
    },
    date,
    startTime,
    endTime: null,
    timezone,
  });

  // the previews: each concept's design seeded with the host's details, the concept applied
  const docFor = (concept: Concept): InvitationDocument | null => {
    const entry = getTemplate(concept.templateId);
    if (!entry) return null;
    const seeded = seedDocument(entry.manifest, entry.defaults, input());
    return applyConcept(seeded, concept, entry.manifest, entry.defaults, studio.conceptPhotos(), cinematic);
  };

  /** Made, photos up, the concept on it, saved — then the editor. */
  async function use(concept: Concept) {
    const entry = getTemplate(concept.templateId);
    if (!entry) return;
    setCreating(concept.id);
    setFailed(null);
    let id = created.current;
    try {
      if (!id) {
        const details = input();
        const res = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId: concept.templateId,
            eventType,
            locales: details.locales,
            defaultLocale: details.defaultLocale,
            hosts: details.hosts,
            age: null,
            paletteId: null,
            fontPairId: null,
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
        const limit = upgradeReason(res.status, body);
        if (limit) {
          setCreating(null);
          setUpgrade(limit);
          return;
        }
        if (!res.ok || !body?.ok || !body.id) throw new Error(`create: ${res.status}`);
        id = body.id;
        created.current = id;
      }
      // the photos this concept shows, uploaded to the new invitation
      const used = usedPhotos(concept, cinematic);
      const refs = await Promise.all(
        studio.photos.map(async (p, i) =>
          p.origin.kind === 'ref'
            ? p.origin.ref
            : used.has(i) && p.upload
              ? (await uploadFile(id!, p.upload)).ref
              : null,
        ),
      );
      const got = await hostApi<{ ok: boolean; draft: InvitationDocument; updatedAt: string }>(
        `/api/invitations/${id}`,
      );
      if (!got.ok || !got.body?.ok) throw new Error('draft');
      const draft = applyConcept(
        got.body.draft,
        concept,
        entry.manifest,
        entry.defaults,
        studio.conceptPhotos(refs),
        cinematic,
      );
      const saved = await hostApi(`/api/invitations/${id}`, {
        method: 'PATCH',
        body: { draft, updatedAt: got.body.updatedAt },
      });
      if (!saved.ok) throw new Error(`save: ${saved.status}`);
      router.push(`/app/invitations/${id}/edit`);
    } catch {
      setCreating(null);
      setFailed({ id });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 1) setStep(2);
    else if (step === 2) {
      if (step2Valid) setStep(3);
      else {
        setAttempted((x) => ({ ...x, 2: true }));
        window.setTimeout(
          () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
          0,
        );
      }
    } else if (step === 3) {
      if (step3Valid) setStep(4);
      else {
        setAttempted((x) => ({ ...x, 3: true }));
        window.setTimeout(
          () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
          0,
        );
      }
    } else if (step === 4) void studio.ask().then((ok) => ok && setStep(5));
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

  const concepts = step === 5 && studio.result;
  const shownStep = Math.min(step, 4) as 1 | 2 | 3 | 4;
  const title = [w.step1, w.step2, w.step3, a.photos][shownStep - 1];
  const enough = studio.photos.length >= ART_DIRECTION.minPhotos;

  return (
    <>
      {upgrade ? <UpgradeDialog reason={upgrade} onClose={() => setUpgrade(null)} /> : null}
      <Dialog
        open
        onOpenChange={(open) => !open && !creating && onClose()}
        title={concepts ? a.conceptsTitle : a.wizardTitle}
        description={
          concepts ? (
            a.conceptsIntro
          ) : (
            <span className="flex items-center gap-2.5">
              <span aria-hidden className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      'h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
                      n === shownStep ? 'w-5 bg-inverse' : n < shownStep ? 'w-1.5 bg-ink/60' : 'w-1.5 bg-line',
                    )}
                  />
                ))}
              </span>
              {fmt(a.wizardProgress, { step: shownStep })} · {a.wizardSteps[STEP_KEYS[shownStep - 1]!]}
            </span>
          )
        }
        closeLabel={creating ? undefined : t.common.close}
        help={creating ? undefined : <HelpFor area={step >= 4 ? 'studio' : 'wizard'} inDialog />}
        className={concepts ? 'max-w-[1200px]!' : undefined}
        footer={
          creating ? null : concepts ? (
            <>
              <Button variant="ghost" onClick={() => setStep(4)}>
                {a.back}
              </Button>
              <Hint text={a.againHint}>
                <Button
                  variant="secondary"
                  icon={<RotateCcw />}
                  loading={studio.busy}
                  onClick={() => void studio.ask(true)}
                  data-testid="studio-again"
                >
                  {a.again}
                </Button>
              </Hint>
            </>
          ) : (
            <>
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : 1))}>
                  {t.common.back}
                </Button>
              ) : null}
              {step === 4 ? (
                <Hint text={a.createHint}>
                  <Button
                    type="submit"
                    form={formId}
                    icon={<WandSparkles />}
                    loading={studio.busy}
                    disabled={!enough || studio.reading > 0}
                    data-testid="studio-create"
                  >
                    {studio.busy ? a.creating : a.create}
                  </Button>
                </Hint>
              ) : (
                <Button type="submit" form={formId}>
                  {t.common.next}
                </Button>
              )}
            </>
          )
        }
      >
        {creating ? (
          <div role="status" className="flex items-center gap-4 py-2">
            <Skeleton width={72} height={128} radius={14} />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <p className="text-[15px] font-semibold">{a.creatingInvitation}</p>
              <Skeleton shape="line" width="70%" />
              <Skeleton shape="line" width="45%" />
            </div>
          </div>
        ) : concepts ? (
          <>
            {failed ? (
              <div
                role="alert"
                className="mb-3 flex flex-wrap items-center gap-3 rounded-input bg-danger/10 px-3 py-2"
              >
                <span className="text-[13px] text-danger">{a.uploadFailed}</span>
                {failed.id ? (
                  <Button variant="secondary" size="sm" asChild>
                    <a href={`/app/invitations/${failed.id}/edit`}>{a.openEditor}</a>
                  </Button>
                ) : null}
              </div>
            ) : null}
            <StudioErrors studio={studio} />
            <ConceptsView
              result={concepts}
              docFor={docFor}
              locale={locales[0]!}
              cinematic={cinematic}
              photosIn={(c) => [...usedPhotos(c, cinematic)].filter((i) => i < studio.photos.length).length}
              using={creating}
              onUse={(c) => void use(c)}
            />
          </>
        ) : (
          <form ref={form} id={formId} onSubmit={submit} noValidate data-testid="studio-wizard">
            <h3
              ref={heading}
              id={headingId}
              tabIndex={-1}
              className="mb-4 text-[16px] font-bold outline-none"
            >
              {title}
            </h3>

            {step === 1 ? (
              <div
                role="radiogroup"
                aria-labelledby={headingId}
                onKeyDown={rovingKeyDown}
                className="grid grid-cols-2 gap-2"
              >
                {EVENT_TYPES.map((type) => {
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
                        'flex h-14 items-center gap-3 rounded-card border px-4 text-start text-[14px] font-semibold',
                        on
                          ? 'border-ink bg-subtle ring-1 ring-ink'
                          : 'border-line bg-surface hover:bg-subtle',
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
                {nameInputs(first, attempted[2])}
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
                <p className="-mt-2 text-[13px] leading-snug text-muted">{w.languages.hint}</p>
                <div
                  role="group"
                  aria-labelledby={headingId}
                  className={cn(
                    'grid gap-2',
                    supported.length > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1',
                  )}
                >
                  {supported.map((l) => {
                    const on = chosen.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        data-language={l}
                        onClick={() => toggleLanguage(l)}
                        className={cn(
                          'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-card border px-3 py-2.5 text-center',
                          'transition-[background-color,border-color] duration-150 motion-reduce:transition-none',
                          on
                            ? 'border-ink bg-subtle ring-1 ring-ink'
                            : 'border-line bg-surface hover:bg-subtle',
                        )}
                      >
                        <span className="text-[15px] font-semibold" lang={l} dir={dirOf(l)}>
                          {NATIVE_NAMES[l]}
                        </span>
                        {NATIVE_NAMES[l] !== t.editor.languageIn[l] ? (
                          <span className="text-[12px] leading-snug text-muted">
                            {t.editor.languageIn[l]}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {chosen.length > 1 ? (
                  <Field label={w.languages.default} help={w.languages.defaultHelp}>
                    <Select
                      value={defaultLocale}
                      onChange={(e) => setDefaultLocale(e.target.value as Locale)}
                    >
                      {chosen.map((l) => (
                        <option key={l} value={l} lang={l}>
                          {NATIVE_NAMES[l]}
                        </option>
                      ))}
                    </Select>
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

            {step === 4 ? (
              <div className="flex flex-col gap-4">
                <p className="text-[13px] leading-relaxed text-muted">{a.intro}</p>
                <PhotoPicker studio={studio} />
                <StudioErrors studio={studio} />
                {!enough ? <p className="text-[12.5px] text-muted">{a.needPhotos}</p> : null}
                {studio.busy ? (
                  <p role="status" className="text-[12.5px] text-muted">
                    {a.creatingHint}
                  </p>
                ) : null}
              </div>
            ) : null}
          </form>
        )}
      </Dialog>
    </>
  );
}
