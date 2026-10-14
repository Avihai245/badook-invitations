'use client';

import { Send } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/app/Button';
import { Field } from '@/components/app/Field';
import { Input, Select, Textarea } from '@/components/app/Input';
import { fmt, intlLocale, type AppDict } from '@/lib/i18n/app';
import {
  LEGAL_REQUESTS,
  REQUEST_KINDS,
  REQUEST_RELATIONS,
  type RequestKind,
  type RequestRelation,
} from '../config';
import { emailOk, ErrorSummary, Honeypot, phoneOk, Result } from './form-bits';

type Strings = AppDict['legalRequests']['privacyRequest'];
type Done = { number: number | null; dueAt: string | null };

/**
 * /privacy-request: the form. The layered collection notice comes in as `notice` (right above the
 * button). The success card shows the number and the due date the database stored — it does not say that
 * an email was sent.
 */
export function PrivacyRequestForm({
  t,
  locale,
  defaultKind,
  notice,
}: {
  t: Strings;
  locale: 'he' | 'en';
  defaultKind: RequestKind;
  notice: ReactNode;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [details, setDetails] = useState('');
  const labels: Record<string, string> = {
    name: t.name,
    email: t.email,
    phone: t.phone,
    details: t.details.label,
  };
  const focusField = (form: HTMLFormElement | null, name: string) =>
    form?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const v = (k: string) => (data[k] ?? '').trim();
    const next: Record<string, string> = {};
    if (!v('name')) next.name = t.errors.name;
    if (!emailOk(v('email'))) next.email = t.errors.email;
    if (v('phone') && !phoneOk(v('phone'))) next.phone = t.errors.phone;
    const len = details.trim().length;
    if (len < LEGAL_REQUESTS.details.min || len > LEGAL_REQUESTS.details.max) next.details = t.errors.details;
    setErrors(next);
    const first = ['name', 'email', 'phone', 'details'].find((k) => next[k]);
    if (first) return focusField(form, first);

    setState('sending');
    const res = await fetch('/api/legal/privacy-request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: v('kind'),
        relation: v('relation'),
        name: v('name'),
        email: v('email'),
        phone: v('phone'),
        details: details.trim(),
        reference: v('reference'),
        locale,
        website: v('website'),
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      fields?: string[];
      number?: number | null;
      dueAt?: string | null;
    } | null;
    setState('idle');
    if (res?.ok && body?.ok) {
      setDone({ number: body.number ?? null, dueAt: body.dueAt ?? null });
      return setState('done');
    }
    if (!res) return setErrors({ form: t.errors.network });
    if (res.status === 429) return setErrors({ form: t.errors.rate });
    if (body?.error === 'invalid' && body.fields?.length) {
      const msg: Record<string, string> = {
        name: t.errors.name,
        email: t.errors.email,
        phone: t.errors.phone,
        details: t.errors.details,
      };
      setErrors(Object.fromEntries(body.fields.map((f) => [f, msg[f] ?? t.errors.server])));
      return focusField(form, body.fields[0] ?? '');
    }
    setErrors({ form: t.errors.server });
  };

  if (state === 'done' && done) {
    const due = done.dueAt
      ? new Intl.DateTimeFormat(intlLocale(locale), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Asia/Jerusalem',
        }).format(new Date(done.dueAt))
      : null;
    return (
      <Result title={t.success.title}>
        {done.number !== null ? (
          <p className="text-[16px] font-semibold tabular-nums" data-testid="request-number">
            {fmt(t.success.number, { n: done.number })}
          </p>
        ) : null}
        {due ? <p className="text-[14px] font-medium">{fmt(t.success.due, { date: due })}</p> : null}
        <p className="text-[14px] text-muted">{t.success.next}</p>
        <p className="text-[14px] text-muted">{t.success.keep}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => (setDone(null), setDetails(''), setState('idle'))}>
            {t.success.again}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">{t.success.home}</Link>
          </Button>
        </div>
      </Result>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
      data-testid="request-form"
      aria-busy={state === 'sending'}
    >
      <ErrorSummary
        title={t.errors.summary}
        errors={errors}
        labels={labels}
        focusField={(n) => focusField(document.querySelector('[data-testid="request-form"]'), n)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.kind.label} required>
          <Select name="kind" defaultValue={defaultKind}>
            {REQUEST_KINDS.map((k) => (
              <option key={k} value={k}>
                {t.kind.options[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.relation.label} required>
          <Select name="relation" defaultValue={defaultRelation(defaultKind)}>
            {REQUEST_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {t.relation.options[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.name} error={errors.name} required>
          <Input name="name" autoComplete="name" maxLength={LEGAL_REQUESTS.name} />
        </Field>
        <Field label={t.email} error={errors.email} required>
          <Input name="email" type="email" autoComplete="email" dir="ltr" maxLength={LEGAL_REQUESTS.email} />
        </Field>
        <Field label={t.phone} error={errors.phone}>
          <Input name="phone" type="tel" autoComplete="tel" dir="ltr" maxLength={LEGAL_REQUESTS.phone.max} />
        </Field>
      </div>
      <Field
        label={t.details.label}
        help={t.details.help}
        error={errors.details}
        counter={{ value: details.length, max: LEGAL_REQUESTS.details.max }}
        required
      >
        <Textarea name="details" rows={6} value={details} onChange={(e) => setDetails(e.target.value)} />
      </Field>
      <Field label={t.reference.label} help={t.reference.help}>
        <Input name="reference" maxLength={LEGAL_REQUESTS.reference} dir="auto" />
      </Field>
      <Honeypot />
      {notice}
      <div>
        <Button type="submit" size="lg" icon={<Send className="icon-dir" />} loading={state === 'sending'}>
          {state === 'sending' ? t.sending : t.submit}
        </Button>
      </div>
    </form>
  );
}

/** A child's photo is asked by a parent or guardian, most often. */
function defaultRelation(kind: RequestKind): RequestRelation {
  return kind === 'child_photo' ? 'guardian' : 'guest';
}
