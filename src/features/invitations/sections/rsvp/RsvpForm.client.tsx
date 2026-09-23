'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { DietaryKey, Locale } from '../../contracts/types';
import { t } from '../../i18n/dictionary';
import { Icon } from '../../ui/Icon';
import { CalendarMenu, type CalendarLinks } from '../venues/CalendarMenu.client';

/** Everything the form needs, already localized on the server. */
export interface RsvpFormConfig {
  slug: string;
  locale: Locale;
  askChildren: boolean;
  maxAdults: number;
  maxChildren: number;
  requirePhone: boolean;
  requireEmail: boolean;
  perAttendeeDetails: boolean;
  dietary: { enabled: boolean; options: DietaryKey[]; note: string | null };
  customQuestions: {
    id: string;
    type: 'text' | 'select' | 'boolean';
    required: boolean;
    label: string;
    options?: { value: string; label: string }[];
  }[];
  messageLabel: string;
  successMessage: string;
  declineMessage: string;
  calendar: {
    label: string;
    links: CalendarLinks;
    labels: { google: string; apple: string; outlook: string };
  } | null;
  /** 'simulate' in the kitchen sink (P0); 'api' posts to /api/invitations/rsvp (P1). */
  submitMode: 'simulate' | 'api';
}

interface Adult {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dietary?: DietaryKey[];
  dietaryNotes?: string;
}
interface Child {
  fullName?: string;
  age?: number;
  dietary?: DietaryKey[];
  dietaryNotes?: string;
}
type Errors = Record<string, string>;

const ALLERGIES: DietaryKey[] = ['nut_allergy', 'other_allergy'];
const needsNotes = (p: { dietary?: DietaryKey[] }) => (p.dietary ?? []).some((k) => ALLERGIES.includes(k));

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={error ? 'field err' : 'field'}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      <span className="msg" id={`${id}-err`} role={error ? 'alert' : undefined}>
        {error ?? ''}
      </span>
    </div>
  );
}

export function RsvpForm({ config }: { config: RsvpFormConfig }) {
  const L = config.locale;
  const uid = useId();
  const fid = (path: string) => `${uid}-${path}`;
  const renderedAt = useRef(0);
  const formRef = useRef<HTMLDivElement>(null);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [adults, setAdults] = useState<Adult[]>([{}]);
  const [children, setChildren] = useState<Child[]>([]);
  // Removed attendee cards are stashed so decreasing then increasing keeps what was typed (§6.2).
  const stash = useRef<{ adults: Adult[]; children: Child[] }>({ adults: [], children: [] });
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [message, setMessage] = useState('');
  const [decline, setDecline] = useState<{ fullName?: string; phone?: string; email?: string }>({});
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [focusFirstError, setFocusFirstError] = useState(0);

  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!focusFirstError) return;
    const el = formRef.current?.querySelector<HTMLElement>(
      '.field.err input, .field.err select, .field.err textarea',
    );
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusFirstError]);

  const clearError = (path: string) =>
    setErrors((e) => {
      if (!(path in e)) return e;
      const next = { ...e };
      delete next[path];
      return next;
    });

  const updateAdult = (i: number, patch: Partial<Adult>) => {
    setAdults((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  };
  const updateChild = (i: number, patch: Partial<Child>) => {
    setChildren((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  };

  const step = (kind: 'adults' | 'children', delta: 1 | -1) => {
    const [list, set, min, max] =
      kind === 'adults'
        ? ([adults, setAdults, 1, config.maxAdults] as const)
        : ([children, setChildren, 0, config.maxChildren] as const);
    if (delta > 0 && list.length < max) {
      const restored = stash.current[kind][list.length] ?? {};
      (set as (v: (Adult | Child)[]) => void)([...list, restored]);
    } else if (delta < 0 && list.length > min) {
      stash.current[kind][list.length - 1] = list[list.length - 1]!;
      (set as (v: (Adult | Child)[]) => void)(list.slice(0, -1));
    }
  };

  const toggleDiet = (current: DietaryKey[] | undefined, key: DietaryKey, checked: boolean): DietaryKey[] => {
    let next = new Set(current ?? []);
    if (checked) {
      // `none` is mutually exclusive with every other key (§3 validation rules)
      if (key === 'none') next = new Set<DietaryKey>(['none']);
      else {
        next.delete('none');
        next.add(key);
      }
    } else next.delete(key);
    return [...next];
  };

  function validate(): Errors {
    const e: Errors = {};
    const req = t(L, 'rsvp.error.required');
    if (attending) {
      adults.forEach((p, i) => {
        if (!p.firstName?.trim()) e[`a${i}.firstName`] = req;
        if (!p.lastName?.trim()) e[`a${i}.lastName`] = req;
        if (needsNotes(p) && !p.dietaryNotes?.trim()) e[`a${i}.dietaryNotes`] = req;
      });
      const p0 = adults[0] ?? {};
      const digits = (p0.phone ?? '').replace(/\D/g, '');
      if (config.requirePhone && !/^\d{9,15}$/.test(digits))
        e['a0.phone'] = p0.phone ? t(L, 'rsvp.error.phone') : req;
      if (!config.requirePhone && p0.phone && !/^\d{9,15}$/.test(digits))
        e['a0.phone'] = t(L, 'rsvp.error.phone');
      if (config.requireEmail && !/^\S+@\S+\.\S+$/.test(p0.email ?? '')) {
        e['a0.email'] = p0.email ? t(L, 'rsvp.error.email') : req;
      }
      children.forEach((c, i) => {
        if (!c.fullName?.trim()) e[`c${i}.fullName`] = req;
        if (needsNotes(c) && !c.dietaryNotes?.trim()) e[`c${i}.dietaryNotes`] = req;
      });
      for (const q of config.customQuestions) {
        const v = answers[q.id];
        if (q.required && (v === undefined || v === '' || v === false)) e[`q.${q.id}`] = req;
      }
    } else {
      if (!decline.fullName?.trim()) e['d.fullName'] = req;
      if (!decline.phone?.trim() && !decline.email?.trim()) e['d.phone'] = t(L, 'rsvp.error.contact');
    }
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFocusFirstError((n) => n + 1);
      return;
    }
    setStatus('sending');
    if (config.submitMode === 'simulate') {
      await new Promise((r) => setTimeout(r, 700));
      setStatus('sent');
      return;
    }
    // P1: POST /api/invitations/rsvp with the shared RsvpSubmission schema.
    setStatus('error');
  }

  if (status === 'sent') {
    return (
      <div className="success" role="status" aria-live="polite">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" opacity=".25" />
          <path className="draw" d="m7.5 12.5 3 3 6-6.5" />
        </svg>
        <h3>{attending ? config.successMessage : config.declineMessage}</h3>
        {attending && config.calendar ? (
          <div className="actions">
            <CalendarMenu
              label={config.calendar.label}
              links={config.calendar.links}
              labels={config.calendar.labels}
            />
          </div>
        ) : null}
        <button className="linkbtn" type="button" onClick={() => setStatus('idle')}>
          {t(L, 'rsvp.editResponse')}
        </button>
      </div>
    );
  }

  const dietChips = (
    who: string,
    selected: DietaryKey[] | undefined,
    onChange: (next: DietaryKey[]) => void,
  ) => (
    <div className="chips">
      {config.dietary.options.map((k) => {
        const on = (selected ?? []).includes(k);
        return (
          <label className="chip" key={k}>
            <input
              type="checkbox"
              value={k}
              checked={on}
              onChange={(ev) => onChange(toggleDiet(selected, k, ev.target.checked))}
              data-diet={who}
            />
            <span>
              {on ? <Icon name="check" size={14} strokeWidth={2} /> : null}
              {t(L, `diet.${k}`)}
            </span>
          </label>
        );
      })}
    </div>
  );

  const input = (
    path: string,
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    opts: {
      required?: boolean;
      type?: string;
      ltr?: boolean;
      inputMode?: 'tel' | 'email';
      placeholder?: string;
      autoComplete?: string;
    } = {},
  ) => (
    <Field id={fid(path)} label={label} required={opts.required} error={errors[path]}>
      <input
        id={fid(path)}
        value={value ?? ''}
        type={opts.type ?? 'text'}
        dir={opts.ltr ? 'ltr' : undefined}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete ?? 'off'}
        aria-invalid={errors[path] ? true : undefined}
        aria-describedby={errors[path] ? `${fid(path)}-err` : undefined}
        onChange={(ev) => {
          onChange(ev.target.value);
          clearError(path);
        }}
      />
    </Field>
  );

  const stepper = (kind: 'adults' | 'children', value: number, min: number, max: number) => (
    <div className="stepper">
      <button
        type="button"
        onClick={() => step(kind, -1)}
        disabled={value <= min}
        aria-label={t(L, 'rsvp.decrease')}
      >
        <Icon name="minus" size={18} />
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => step(kind, 1)}
        disabled={value >= max}
        aria-label={t(L, 'rsvp.increase')}
      >
        <Icon name="plus" size={18} />
      </button>
    </div>
  );

  return (
    <div ref={formRef}>
      <p className="q" id={fid('att')}>
        {t(L, 'rsvp.willAttend')} <span className="req">*</span>
      </p>
      <div className="choice" role="radiogroup" aria-labelledby={fid('att')}>
        {([true, false] as const).map((v) => (
          <label className={attending === v ? 'opt on' : 'opt'} key={String(v)}>
            <input
              type="radio"
              name={fid('attending')}
              checked={attending === v}
              onChange={() => {
                setAttending(v);
                setErrors({});
              }}
            />
            <span className="radio" aria-hidden="true">
              {attending === v ? <Icon name="check" size={12} strokeWidth={3} /> : null}
            </span>
            {t(L, v ? 'rsvp.yes' : 'rsvp.no')}
          </label>
        ))}
      </div>

      {attending === true ? (
        <>
          <div className="grp steppers">
            <div className="srow">
              <p className="q">
                <Icon name="users" size={18} />
                {t(L, 'rsvp.adults')}
              </p>
              {stepper('adults', adults.length, 1, config.maxAdults)}
            </div>
            {config.askChildren ? (
              <div className="srow">
                <p className="q">
                  <Icon name="baby" size={18} />
                  {t(L, 'rsvp.children')}
                </p>
                {stepper('children', children.length, 0, config.maxChildren)}
              </div>
            ) : null}
          </div>

          <div className="grp">
            <p className="q">{t(L, 'rsvp.adultDetails')}</p>
            {adults.map((p, i) =>
              i > 0 && !config.perAttendeeDetails ? null : (
                <div className="person" key={i}>
                  <h4>
                    {t(L, 'rsvp.person', { n: i + 1 })}
                    {i === 0 ? <span className="tag">{t(L, 'rsvp.primaryContact')}</span> : null}
                  </h4>
                  <div className="row2">
                    {input(
                      `a${i}.firstName`,
                      t(L, 'rsvp.firstName'),
                      p.firstName,
                      (v) => updateAdult(i, { firstName: v }),
                      {
                        required: true,
                        autoComplete: i === 0 ? 'given-name' : 'off',
                      },
                    )}
                    {input(
                      `a${i}.lastName`,
                      t(L, 'rsvp.lastName'),
                      p.lastName,
                      (v) => updateAdult(i, { lastName: v }),
                      {
                        required: true,
                        autoComplete: i === 0 ? 'family-name' : 'off',
                      },
                    )}
                  </div>
                  {i === 0 ? (
                    <div className="row2">
                      {input('a0.phone', t(L, 'rsvp.phone'), p.phone, (v) => updateAdult(0, { phone: v }), {
                        required: config.requirePhone,
                        type: 'tel',
                        ltr: true,
                        inputMode: 'tel',
                        placeholder: t(L, 'rsvp.phonePlaceholder'),
                        autoComplete: 'tel',
                      })}
                      {input('a0.email', t(L, 'rsvp.email'), p.email, (v) => updateAdult(0, { email: v }), {
                        required: config.requireEmail,
                        type: 'email',
                        ltr: true,
                        inputMode: 'email',
                        placeholder: 'name@example.com',
                        autoComplete: 'email',
                      })}
                    </div>
                  ) : null}
                  {config.dietary.enabled ? (
                    <>
                      <div className="field">
                        <label>{t(L, 'rsvp.dietary')}</label>
                        {i === 0 && config.dietary.note ? (
                          <p className="note">{config.dietary.note}</p>
                        ) : null}
                        {dietChips(`a${i}`, p.dietary, (next) => {
                          updateAdult(i, { dietary: next });
                          if (!next.some((k) => ALLERGIES.includes(k))) clearError(`a${i}.dietaryNotes`);
                        })}
                      </div>
                      {needsNotes(p)
                        ? input(
                            `a${i}.dietaryNotes`,
                            t(L, 'rsvp.dietaryNotes'),
                            p.dietaryNotes,
                            (v) => updateAdult(i, { dietaryNotes: v }),
                            {
                              required: true,
                            },
                          )
                        : null}
                    </>
                  ) : null}
                </div>
              ),
            )}
          </div>

          {children.length && config.perAttendeeDetails ? (
            <div className="grp">
              <p className="q">{t(L, 'rsvp.childDetails')}</p>
              {children.map((c, i) => (
                <div className="person" key={i}>
                  <h4>{t(L, 'rsvp.child', { n: i + 1 })}</h4>
                  <div className="row2">
                    {input(
                      `c${i}.fullName`,
                      t(L, 'rsvp.fullName'),
                      c.fullName,
                      (v) => updateChild(i, { fullName: v }),
                      {
                        required: true,
                      },
                    )}
                    <Field id={fid(`c${i}.age`)} label={t(L, 'rsvp.age')} required>
                      <select
                        id={fid(`c${i}.age`)}
                        value={c.age ?? 0}
                        onChange={(ev) => updateChild(i, { age: Number(ev.target.value) })}
                      >
                        {Array.from({ length: 18 }, (_, n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {config.dietary.enabled ? (
                    <>
                      <div className="field">
                        <label>{t(L, 'rsvp.dietary')}</label>
                        {dietChips(`c${i}`, c.dietary, (next) => updateChild(i, { dietary: next }))}
                      </div>
                      {needsNotes(c)
                        ? input(
                            `c${i}.dietaryNotes`,
                            t(L, 'rsvp.dietaryNotes'),
                            c.dietaryNotes,
                            (v) => updateChild(i, { dietaryNotes: v }),
                            {
                              required: true,
                            },
                          )
                        : null}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {config.customQuestions.map((q) => (
            <div className={errors[`q.${q.id}`] ? 'grp field err' : 'grp field'} key={q.id}>
              {q.type === 'boolean' ? (
                <label className="chip">
                  <input
                    type="checkbox"
                    checked={answers[q.id] === true}
                    onChange={(ev) => setAnswers((a) => ({ ...a, [q.id]: ev.target.checked }))}
                  />
                  <span>
                    {answers[q.id] === true ? <Icon name="check" size={14} strokeWidth={2} /> : null}
                    {q.label}
                  </span>
                </label>
              ) : (
                <>
                  <label className="q" htmlFor={fid(`q.${q.id}`)}>
                    {q.label}
                    {q.required ? <span className="req"> *</span> : null}
                  </label>
                  {q.type === 'select' ? (
                    <select
                      id={fid(`q.${q.id}`)}
                      value={String(answers[q.id] ?? q.options?.[0]?.value ?? '')}
                      onChange={(ev) => setAnswers((a) => ({ ...a, [q.id]: ev.target.value }))}
                    >
                      {q.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={fid(`q.${q.id}`)}
                      value={String(answers[q.id] ?? '')}
                      onChange={(ev) => setAnswers((a) => ({ ...a, [q.id]: ev.target.value }))}
                    />
                  )}
                </>
              )}
              <span className="msg">{errors[`q.${q.id}`] ?? ''}</span>
            </div>
          ))}
        </>
      ) : null}

      {attending === false ? (
        <div className="grp">
          {input(
            'd.fullName',
            t(L, 'rsvp.fullName'),
            decline.fullName,
            (v) => setDecline((d) => ({ ...d, fullName: v })),
            {
              required: true,
              autoComplete: 'name',
            },
          )}
          <div className="row2">
            {input(
              'd.phone',
              t(L, 'rsvp.phone'),
              decline.phone,
              (v) => setDecline((d) => ({ ...d, phone: v })),
              {
                type: 'tel',
                ltr: true,
                inputMode: 'tel',
                placeholder: t(L, 'rsvp.phonePlaceholder'),
                autoComplete: 'tel',
              },
            )}
            {input(
              'd.email',
              t(L, 'rsvp.email'),
              decline.email,
              (v) => setDecline((d) => ({ ...d, email: v })),
              {
                type: 'email',
                ltr: true,
                inputMode: 'email',
                placeholder: 'name@example.com',
                autoComplete: 'email',
              },
            )}
          </div>
        </div>
      ) : null}

      {attending !== null ? (
        <>
          <div className="grp field">
            <label className="q" htmlFor={fid('message')}>
              {config.messageLabel || t(L, 'rsvp.message')}
            </label>
            <textarea
              id={fid('message')}
              maxLength={500}
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
            />
          </div>
          <div className="grp">
            <button
              className="btn btn-primary"
              type="button"
              onClick={submit}
              disabled={status === 'sending'}
            >
              {status === 'sending' ? (
                t(L, 'rsvp.sending')
              ) : (
                <>
                  <Icon name="send" size={18} />
                  {t(L, 'rsvp.submit')}
                </>
              )}
            </button>
            <p
              className="form-status"
              role="status"
              aria-live="polite"
              style={{ display: status === 'error' ? 'block' : 'none' } as CSSProperties}
            >
              {status === 'error' ? t(L, 'rsvp.error.network') : ''}
            </p>
          </div>
          {/* honeypot: visually hidden, not display:none (§6.4) */}
          <input
            className="hp"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            defaultValue=""
          />
        </>
      ) : null}
    </div>
  );
}
