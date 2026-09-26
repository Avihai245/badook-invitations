'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useGuest } from '../../renderer/guest.client';
import type { DietaryKey, Locale, RsvpResult, RsvpSubmission } from '../../contracts/types';
import { burstFrom } from '../../renderer/fx/burst';
import type { BurstKind } from '../../renderer/fx/theme';
import { t } from '../../i18n/dictionary';
import { Icon } from '../../ui/Icon';
import { CalendarMenu, type CalendarLinks } from '../venues/CalendarMenu.client';
import { RSVP_NOTES } from './notes';

/** Everything the form needs, already localized on the server. */
export interface RsvpFormConfig {
  slug: string;
  locale: Locale;
  askChildren: boolean;
  maxAdults: number;
  maxChildren: number;
  requirePhone: boolean;
  requireEmail: boolean;
  /** the host's form options: an email field at all, one full-name field, the message */
  askEmail: boolean;
  nameFormat: 'split' | 'full';
  askMessage: boolean;
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
  closedMessage: string;
  calendar: {
    label: string;
    links: CalendarLinks;
    labels: { google: string; apple: string; outlook: string };
  } | null;
  /** 'simulate' in the kitchen sink (P0); 'api' posts to /api/invitations/rsvp (P1). */
  submitMode: 'simulate' | 'api';
  /** a "yes" bursts in the template's particles (renderer/fx) — none when absent */
  celebrate?: { kind: BurstKind; colors: string[] } | null;
}

interface Adult {
  firstName?: string;
  lastName?: string;
  fullName?: string;
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

/**
 * What the browser keeps after a reply (§6.6): the edit token (+ the answers, to prefill an edit) —
 * under `rsvp:<slug>`, or `rsvp:<slug>:<guest token>` for a personal link, so guests sharing a browser
 * (or a host trying several personal links) never see or edit each other's reply.
 */
interface StoredReply {
  responseId: string;
  editToken: string;
  draft?: Pick<RsvpSubmission, 'answers' | 'message'> &
    ({ attending: true; adults: Adult[]; children: Child[] } | { attending: false; contact: Contact });
}
type Contact = { fullName?: string; phone?: string; email?: string };
const storageKey = (slug: string, guestToken?: string) =>
  guestToken ? `rsvp:${slug}:${guestToken}` : `rsvp:${slug}`;
function readReply(key: string): StoredReply | null {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as StoredReply) : null;
    return v && typeof v.editToken === 'string' ? v : null;
  } catch {
    return null;
  }
}
/**
 * What the guest has typed, kept in memory per invitation: the live language switch renders the form
 * again in the other locale, and nothing typed (or the "thank you" screen) may be lost on the way.
 */
interface Draft {
  attending: boolean | null;
  adults: Adult[];
  children: Child[];
  stash: { adults: Adult[]; children: Child[] };
  answers: Record<string, string | boolean>;
  message: string;
  decline: Contact;
  sent: boolean;
  /** the reply went to one of the site's sample invitations: nothing was kept */
  demo: boolean;
}
const drafts = new Map<string, Draft>();

function writeReply(key: string, reply: StoredReply) {
  try {
    window.localStorage.setItem(key, JSON.stringify(reply));
  } catch {
    // private mode / storage full: editing later just creates a new reply
  }
}

const PHONE_OK = (s: string) => /^\d{9,15}$/.test(s.replace(/\D/g, ''));
const EMAIL_OK = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);

const ALLERGIES: DietaryKey[] = ['nut_allergy', 'other_allergy'];
const needsNotes = (p: { dietary?: DietaryKey[] }) => (p.dietary ?? []).some((k) => ALLERGIES.includes(k));

/** The notes under the form and in its "thank you": the invitation's own quiet UI text. */
const NOTE_STYLE: CSSProperties = {
  fontFamily: 'var(--f-ui)',
  fontSize: 13,
  lineHeight: 1.55,
  color: 'var(--inv-ink-muted)',
  maxWidth: '44ch',
  marginInline: 'auto',
  textAlign: 'center',
};

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
  const [kept] = useState(() => drafts.get(config.slug));
  const [attending, setAttending] = useState<boolean | null>(kept?.attending ?? null);
  const [adults, setAdults] = useState<Adult[]>(kept?.adults ?? [{}]);
  const [children, setChildren] = useState<Child[]>(kept?.children ?? []);
  // Removed attendee cards are stashed so decreasing then increasing keeps what was typed (§6.2).
  const stash = useRef<{ adults: Adult[]; children: Child[] }>(kept?.stash ?? { adults: [], children: [] });
  const [answers, setAnswers] = useState<Record<string, string | boolean>>(kept?.answers ?? {});
  const [message, setMessage] = useState(kept?.message ?? '');
  const [decline, setDecline] = useState<Contact>(kept?.decline ?? {});
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(kept?.sent ? 'sent' : 'idle');
  const [demo, setDemo] = useState(kept?.demo ?? false);
  const [focusFirstError, setFocusFirstError] = useState(0);
  const [closed, setClosed] = useState(false);
  const [reply, setReply] = useState<StoredReply | null>(null);
  /** the "thank you" of a reply sent just now (celebrated) — not one shown again after a language switch */
  const [fresh, setFresh] = useState(false);
  const badge = useRef<HTMLSpanElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);
  // a personal link (?g=): the guest's name and phone fill whatever is still empty
  const guest = useGuest();
  useEffect(() => {
    if (!guest) return;
    const phone = guest.phone?.startsWith('+972') ? `0${guest.phone.slice(4)}` : (guest.phone ?? undefined);
    const [first, ...rest] = guest.name.trim().split(/\s+/);
    setAdults((list) => {
      const p = { ...(list[0] ?? {}) };
      if (config.nameFormat === 'full') p.fullName ||= guest.name;
      else if (!p.firstName && !p.lastName) {
        p.firstName = first ?? '';
        p.lastName = rest.join(' ');
      }
      if (!p.phone && phone) p.phone = phone;
      return [p, ...list.slice(1)];
    });
    setDecline((d) => ({ ...d, fullName: d.fullName || guest.name, phone: d.phone || phone }));
  }, [guest, config.nameFormat]);

  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);
  // the reply this browser sent — through this guest's personal link, or the general link
  const replyKey = storageKey(config.slug, guest?.token);
  useEffect(() => {
    if (config.submitMode === 'api') setReply(readReply(replyKey));
  }, [config.submitMode, replyKey]);

  useEffect(() => {
    drafts.set(config.slug, {
      attending,
      adults,
      children,
      stash: stash.current,
      answers,
      message,
      decline,
      sent: status === 'sent',
      demo,
    });
  }, [config.slug, attending, adults, children, answers, message, decline, status, demo]);

  // a "yes" just sent: the template's particles burst from the badge as its ring closes
  const celebrateKind = config.celebrate?.kind;
  const celebrateColors = config.celebrate?.colors.join(',') ?? '';
  useEffect(() => {
    if (status !== 'sent' || !fresh || !attending || !celebrateKind || !celebrateColors) return;
    const id = window.setTimeout(
      () => burstFrom(badge.current, celebrateKind, celebrateColors.split(','), { x: 0.5, y: 0.5 }),
      420,
    );
    return () => window.clearTimeout(id);
  }, [status, fresh, attending, celebrateKind, celebrateColors]);

  /** "You already replied — edit": refill the form from the stored answers; the next send replaces the reply. */
  const editStoredReply = () => {
    const d = reply?.draft;
    if (!d) return;
    setAnswers(d.answers ?? {});
    setMessage(d.message ?? '');
    setErrors({});
    if (d.attending) {
      setAttending(true);
      setAdults(d.adults.length ? d.adults : [{}]);
      setChildren(d.children);
    } else {
      setAttending(false);
      setDecline(d.contact);
    }
  };

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
        // without per-attendee details only the primary contact is asked for a name (§3)
        if (i === 0 || config.perAttendeeDetails) {
          if (config.nameFormat === 'full') {
            if (!p.fullName?.trim()) e[`a${i}.fullName`] = req;
          } else {
            if (!p.firstName?.trim()) e[`a${i}.firstName`] = req;
            if (!p.lastName?.trim()) e[`a${i}.lastName`] = req;
          }
        }
        if (needsNotes(p) && !p.dietaryNotes?.trim()) e[`a${i}.dietaryNotes`] = req;
      });
      const p0 = adults[0] ?? {};
      const phone = p0.phone?.trim() ?? '';
      const email = config.askEmail ? (p0.email?.trim() ?? '') : '';
      if (phone ? !PHONE_OK(phone) : config.requirePhone)
        e['a0.phone'] = phone ? t(L, 'rsvp.error.phone') : req;
      if (config.askEmail && (email ? !EMAIL_OK(email) : config.requireEmail))
        e['a0.email'] = email ? t(L, 'rsvp.error.email') : req;
      if (config.perAttendeeDetails) {
        children.forEach((c, i) => {
          if (!c.fullName?.trim()) e[`c${i}.fullName`] = req;
          if (needsNotes(c) && !c.dietaryNotes?.trim()) e[`c${i}.dietaryNotes`] = req;
        });
      }
      for (const q of config.customQuestions) {
        const v = answerOf(q);
        if (q.required && (v === undefined || v === '' || v === false)) e[`q.${q.id}`] = req;
      }
    } else {
      const phone = decline.phone?.trim() ?? '';
      const email = config.askEmail ? (decline.email?.trim() ?? '') : '';
      if (!decline.fullName?.trim()) e['d.fullName'] = req;
      // a way to reach them: phone or email — just the phone when email isn't asked
      if (!phone && !email) e['d.phone'] = config.askEmail ? t(L, 'rsvp.error.contact') : req;
      if (phone && !PHONE_OK(phone)) e['d.phone'] = t(L, 'rsvp.error.phone');
      if (email && !EMAIL_OK(email)) e['d.email'] = t(L, 'rsvp.error.email');
    }
    return e;
  }

  /** A select shows its first option until changed — that option is the answer. */
  const answerOf = (q: RsvpFormConfig['customQuestions'][number]) =>
    answers[q.id] ?? (q.type === 'select' ? q.options?.[0]?.value : undefined);

  function payload(): RsvpSubmission {
    const answered = Object.fromEntries(
      config.customQuestions.flatMap((q) => {
        const v = answerOf(q);
        return v === undefined ? [] : [[q.id, v]];
      }),
    );
    const base = {
      invitationSlug: config.slug,
      locale: L,
      hp: hpRef.current?.value ?? '',
      renderedAt: renderedAt.current,
      answers: attending ? answered : {},
      message: config.askMessage ? message.trim() || null : null,
      ...(reply ? { editToken: reply.editToken } : {}),
      ...(guest ? { guestToken: guest.token } : {}),
    };
    const nullable = (v: string | undefined) => (v?.trim() ? v.trim() : null);
    if (!attending) {
      return {
        ...base,
        attending: false,
        contact: {
          fullName: decline.fullName?.trim() ?? '',
          phone: nullable(decline.phone),
          email: config.askEmail ? nullable(decline.email) : null,
        },
      };
    }
    return {
      ...base,
      attending: true,
      adults: adults.map((p, i) => ({
        firstName: config.nameFormat === 'full' ? '' : (p.firstName?.trim() ?? ''),
        lastName: config.nameFormat === 'full' ? '' : (p.lastName?.trim() ?? ''),
        ...(config.nameFormat === 'full' ? { fullName: p.fullName?.trim() ?? '' } : {}),
        phone: i === 0 ? nullable(p.phone) : null,
        email: i === 0 && config.askEmail ? nullable(p.email) : null,
        dietary: p.dietary ?? [],
        dietaryNotes: nullable(p.dietaryNotes),
      })),
      children: children.map((c) => ({
        fullName: c.fullName?.trim() ?? '',
        age: c.age ?? 0,
        dietary: c.dietary ?? [],
        dietaryNotes: nullable(c.dietaryNotes),
      })),
    };
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
      setFresh(true);
      setStatus('sent');
      return;
    }
    // the server rejects replies sent less than 3s after the form appeared (§4)
    const wait = 3100 - (Date.now() - renderedAt.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const body = payload();
    let result: (RsvpResult & { demo?: boolean }) | null = null;
    try {
      const res = await fetch('/api/invitations/rsvp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      result = (await res.json().catch(() => null)) as (RsvpResult & { demo?: boolean }) | null;
    } catch {
      result = null;
    }
    if (result?.ok) {
      // a sample invitation keeps nothing: neither does the browser
      if ('demo' in result && result.demo) {
        setDemo(true);
        setFresh(true);
        setStatus('sent');
        return;
      }
      const { hp: _hp, renderedAt: _r, invitationSlug: _s, locale: _l, editToken: _t, ...rest } = body;
      const draft = (
        rest.attending ? { ...rest, adults, children } : { ...rest, contact: decline }
      ) as StoredReply['draft'];
      const stored = { responseId: result.responseId, editToken: result.editToken, draft };
      writeReply(replyKey, stored);
      setReply(stored);
      setFresh(true);
      setStatus('sent');
      return;
    }
    if (result && !result.ok && result.code === 'closed') {
      setClosed(true);
      setStatus('idle');
      return;
    }
    if (result && !result.ok && result.fieldErrors) {
      setErrors(result.fieldErrors);
      setStatus('idle');
      setFocusFirstError((n) => n + 1);
      return;
    }
    // network error / rate limited / server error: keep everything typed (§6.5)
    setStatus('error');
  }

  if (status === 'sent') {
    return (
      <div className="success" role="status" aria-live="polite" data-fresh={fresh ? '' : undefined}>
        <span className="success-badge" ref={badge}>
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
            <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity=".07" />
            <circle cx="12" cy="12" r="10" opacity=".25" />
            <circle className="ring" cx="12" cy="12" r="10" pathLength={1} transform="rotate(-90 12 12)" />
            <path className="draw" d="m7.5 12.5 3 3 6-6.5" />
          </svg>
        </span>
        <h3>{attending ? config.successMessage : config.declineMessage}</h3>
        {demo ? (
          <p className="demo-note" style={NOTE_STYLE}>
            {RSVP_NOTES[L].demo}
          </p>
        ) : null}
        {attending && config.calendar ? (
          <div className="actions">
            <CalendarMenu
              label={config.calendar.label}
              links={config.calendar.links}
              labels={config.calendar.labels}
            />
          </div>
        ) : null}
        <button
          className="linkbtn"
          type="button"
          onClick={() => {
            setFresh(false);
            setStatus('idle');
          }}
        >
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
      <output aria-live="polite">
        {/* a new number bumps in (invitation.css) — the live region itself stays */}
        <span className="bump" key={value}>
          {value}
        </span>
      </output>
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

  if (closed) return <p className="closed">{config.closedMessage}</p>;

  return (
    <div ref={formRef}>
      {reply && status !== 'sending' ? (
        <p className="replied" role="status">
          <Icon name="check" size={16} strokeWidth={2} />
          {reply.draft ? (
            <button type="button" className="linkbtn" onClick={editStoredReply}>
              {t(L, 'rsvp.alreadyReplied')}
            </button>
          ) : (
            t(L, 'rsvp.alreadyReplied')
          )}
        </p>
      ) : null}
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
                  {config.nameFormat === 'full' ? (
                    input(
                      `a${i}.fullName`,
                      t(L, 'rsvp.fullName'),
                      p.fullName,
                      (v) => updateAdult(i, { fullName: v }),
                      {
                        required: true,
                        autoComplete: i === 0 ? 'name' : 'off',
                      },
                    )
                  ) : (
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
                  )}
                  {i === 0 ? (
                    <div className={config.askEmail ? 'row2' : undefined}>
                      {input('a0.phone', t(L, 'rsvp.phone'), p.phone, (v) => updateAdult(0, { phone: v }), {
                        required: config.requirePhone,
                        type: 'tel',
                        ltr: true,
                        inputMode: 'tel',
                        placeholder: t(L, 'rsvp.phonePlaceholder'),
                        autoComplete: 'tel',
                      })}
                      {config.askEmail
                        ? input(
                            'a0.email',
                            t(L, 'rsvp.email'),
                            p.email,
                            (v) => updateAdult(0, { email: v }),
                            {
                              required: config.requireEmail,
                              type: 'email',
                              ltr: true,
                              inputMode: 'email',
                              placeholder: 'name@example.com',
                              autoComplete: 'email',
                            },
                          )
                        : null}
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
                      value={String(answerOf(q) ?? '')}
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
          <div className={config.askEmail ? 'row2' : undefined}>
            {input(
              'd.phone',
              t(L, 'rsvp.phone'),
              decline.phone,
              (v) => setDecline((d) => ({ ...d, phone: v })),
              {
                // without an email field the phone is the only way to reach them
                required: !config.askEmail,
                type: 'tel',
                ltr: true,
                inputMode: 'tel',
                placeholder: t(L, 'rsvp.phonePlaceholder'),
                autoComplete: 'tel',
              },
            )}
            {config.askEmail
              ? input(
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
                )
              : null}
          </div>
        </div>
      ) : null}

      {attending !== null ? (
        <>
          {config.askMessage ? (
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
          ) : null}
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
            <p className="privacy-note" style={{ ...NOTE_STYLE, marginTop: 14 }}>
              {RSVP_NOTES[L].privacy}{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {RSVP_NOTES[L].privacyLink}
              </a>
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
            ref={hpRef}
          />
        </>
      ) : null}
    </div>
  );
}
