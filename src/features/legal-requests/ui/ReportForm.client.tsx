'use client';

import { Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/app/Button';
import { Checkbox } from '@/components/app/Checkbox';
import { Field } from '@/components/app/Field';
import { Input, Select, Textarea } from '@/components/app/Input';
import { fmt, type AppDict } from '@/lib/i18n/app';
import { LEGAL_REQUESTS, REPORT_CATEGORIES, REPORT_ROLES, type ReportCategory } from '../config';
import { emailOk, ErrorSummary, Honeypot, phoneOk, Result } from './form-bits';

type Strings = AppDict['legalRequests']['report'];
type Done = { number: number | null; hidden: boolean; urgent: boolean; withContact: boolean };

/**
 * /report: the form. What the server makes of the gallery link the visitor came with is asked once the
 * page is open (POST /api/legal/report/link — the page itself holds no gallery code): `ok`
 * (the report is about that gallery / item, which the server resolves again on sending), or not — then
 * the visitor describes where the content is (`reference`). The layered collection notice (a server
 * component) comes in as `notice`, right above the button. Nothing here says an email was sent: the
 * success card shows the number the database stored and, only when the server said so, that the item was
 * hidden.
 */
export function ReportForm({
  t,
  locale,
  token,
  notice,
}: {
  t: Strings;
  locale: 'he' | 'en';
  /** the link's parameters, passed back to the server as they came */
  token: { g?: string; a?: string; i?: string };
  notice: ReactNode;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [category, setCategory] = useState<ReportCategory>('privacy');
  const [intimate, setIntimate] = useState(false);
  const [description, setDescription] = useState('');
  const [broken, setBroken] = useState(false);
  // no link parameters: nothing to check; otherwise the server tells whether they open a gallery (until
  // it answers the form assumes they do — sending says so again if not)
  const hasLink = !!(token.g || token.a);
  const [link, setLink] = useState<{ state: 'none' | 'checking' | 'ok' | 'invalid'; item: boolean }>({
    state: hasLink ? 'checking' : token.i ? 'invalid' : 'none',
    item: !!token.i,
  });
  useEffect(() => {
    if (!hasLink) return;
    let live = true;
    void fetch('/api/legal/report/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token),
    })
      .then((r) => r.json())
      .then((b: { state?: string; item?: boolean }) => {
        if (live) setLink({ state: b.state === 'ok' ? 'ok' : 'invalid', item: b.item === true });
      })
      .catch(() => live && setLink({ state: 'checking', item: !!token.i }));
    return () => {
      live = false;
    };
  }, [hasLink, token]);
  const linked = (link.state === 'ok' || link.state === 'checking') && !broken;

  const labels: Record<string, string> = {
    description: t.description.label,
    reference: t.reference.label,
    name: t.contact.name,
    email: t.contact.email,
    phone: t.contact.phone,
  };
  const focusField = (form: HTMLFormElement | null, name: string) =>
    form?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const v = (k: string) => (data[k] ?? '').trim();
    const next: Record<string, string> = {};
    const len = description.trim().length;
    if (len < LEGAL_REQUESTS.description.min || len > LEGAL_REQUESTS.description.max)
      next.description =
        len < LEGAL_REQUESTS.description.min ? t.errors.descriptionShort : t.errors.description;
    if (!linked && !v('reference')) next.reference = t.errors.reference;
    if (v('email') && !emailOk(v('email'))) next.email = t.errors.email;
    if (v('phone') && !phoneOk(v('phone'))) next.phone = t.errors.phone;
    if (category === 'copyright') {
      if (!v('name')) next.name = t.errors.copyrightName;
      if (!v('email')) next.email = t.errors.copyrightEmail;
    }
    setErrors(next);
    const first = ['description', 'reference', 'name', 'email', 'phone'].find((k) => next[k]);
    if (first) return focusField(form, first);

    setState('sending');
    const res = await fetch('/api/legal/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        category,
        intimate: category === 'harmful' && intimate,
        role: v('role'),
        description: description.trim(),
        name: v('name'),
        email: v('email'),
        phone: v('phone'),
        reference: linked ? '' : v('reference'),
        ...(linked ? token : {}),
        locale,
        website: v('website'),
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      fields?: string[];
      number?: number | null;
      hidden?: boolean;
      urgent?: boolean;
    } | null;
    setState('idle');
    if (res?.ok && body?.ok) {
      setDone({
        number: body.number ?? null,
        hidden: body.hidden === true,
        urgent: body.urgent === true,
        withContact: !!v('email'),
      });
      return setState('done');
    }
    if (!res) return setErrors({ form: t.errors.network });
    if (body?.error === 'link_invalid') {
      setBroken(true);
      setErrors({ reference: t.linkBroken });
      // the reference field appears with this render
      return void setTimeout(() => focusField(form, 'reference'), 0);
    }
    if (res.status === 429) return setErrors({ form: t.errors.rate });
    if (body?.error === 'invalid' && body.fields?.length) {
      const mapped: Record<string, string> = {};
      for (const f of body.fields) {
        mapped[f] =
          f === 'email'
            ? t.errors.email
            : f === 'phone'
              ? t.errors.phone
              : f === 'description'
                ? t.errors.description
                : f === 'reference'
                  ? t.errors.reference
                  : f === 'name'
                    ? t.errors.copyrightName
                    : t.errors.server;
      }
      setErrors(mapped);
      return focusField(form, body.fields[0] ?? '');
    }
    setErrors({ form: t.errors.server });
  };

  if (state === 'done' && done)
    return (
      <Result title={t.success.title}>
        {done.number !== null ? (
          <p className="text-[16px] font-semibold tabular-nums" data-testid="report-number">
            {fmt(t.success.number, { n: done.number })}
          </p>
        ) : null}
        <p className="text-[14px] text-muted">{t.success.keep}</p>
        <h3 className="text-[15px] font-bold">{t.success.nextTitle}</h3>
        <ul className="list-disc ps-5 text-[14px]">
          <li>{t.success.next}</li>
          {done.hidden ? <li>{t.success.hidden}</li> : null}
          {done.urgent ? <li>{t.success.urgent}</li> : null}
          <li>{done.withContact ? t.success.withContact : t.success.noContact}</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => (setDone(null), setDescription(''), setState('idle'))}>
            {t.success.again}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">{t.success.home}</Link>
          </Button>
        </div>
      </Result>
    );

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
      data-testid="report-form"
      aria-busy={state === 'sending'}
    >
      <ErrorSummary
        title={t.errors.summary}
        errors={errors}
        labels={labels}
        focusField={(n) => focusField(document.querySelector('[data-testid="report-form"]'), n)}
      />
      <p className="text-[14px] text-muted" data-testid="report-link-note">
        {linked
          ? link.item
            ? t.linkedItem
            : t.linkedGallery
          : link.state === 'invalid' || broken
            ? t.linkBroken
            : t.unlinked}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.category.label} help={t.category.help[category]} required>
          <Select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
          >
            {REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.category.options[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.role.label} required>
          <Select name="role" defaultValue="other">
            {REPORT_ROLES.map((r) => (
              <option key={r} value={r}>
                {t.role.options[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {category === 'harmful' ? (
        <div>
          <Checkbox checked={intimate} onCheckedChange={setIntimate} label={t.intimate.label} />
          <p className="mt-1 ps-6 text-[12px] text-muted">{t.intimate.help}</p>
        </div>
      ) : null}

      {!linked ? (
        <Field label={t.reference.label} help={t.reference.help} error={errors.reference} required>
          <Input name="reference" maxLength={LEGAL_REQUESTS.reference} dir="auto" />
        </Field>
      ) : null}

      <Field
        label={t.description.label}
        help={t.description.help}
        error={errors.description}
        counter={{ value: description.length, max: LEGAL_REQUESTS.description.max }}
        required
      >
        <Textarea
          name="description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-[14px] border border-line p-4">
        <legend className="px-1 text-[14px] font-bold">{t.contact.legend}</legend>
        <p className="text-[13px] text-muted">{t.contact.intro}</p>
        {category === 'copyright' ? <p className="text-[13px] font-medium">{t.contact.copyright}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.contact.name} error={errors.name} required={category === 'copyright'}>
            <Input name="name" autoComplete="name" maxLength={LEGAL_REQUESTS.name} />
          </Field>
          <Field label={t.contact.email} error={errors.email} required={category === 'copyright'}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              maxLength={LEGAL_REQUESTS.email}
            />
          </Field>
          <Field label={t.contact.phone} error={errors.phone}>
            <Input
              name="phone"
              type="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={LEGAL_REQUESTS.phone.max}
            />
          </Field>
        </div>
      </fieldset>

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
