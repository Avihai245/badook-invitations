'use client';

import { CheckCircle2, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/app';
import { useUi } from '@/lib/i18n/client';

const TOPICS = ['support', 'billing', 'privacy', 'accessibility', 'business', 'other'] as const;
type Topic = (typeof TOPICS)[number];
type Errors = Partial<Record<'name' | 'email' | 'phone' | 'message' | 'form', string>>;

/** The contact form: name, email, optional phone, topic and message; errors in words, focus on the first. */
export function ContactForm({ defaultTopic = 'support' }: { defaultTopic?: Topic }) {
  const { t, locale } = useUi();
  const c = t.site.contact;
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const next: Errors = {};
    if (!data.name?.trim()) next.name = c.errors.required;
    if (!data.email?.trim()) next.email = c.errors.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) next.email = c.errors.email;
    if (!data.message?.trim()) next.message = c.errors.required;
    else if (data.message.length > 5000) next.message = c.errors.tooLong;
    setErrors(next);
    if (Object.keys(next).length) {
      form.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    setState('sending');
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, locale }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { code?: string; fields?: string[] } | null;
    if (res?.ok) return setState('sent');
    setState('idle');
    if (res?.status === 429) return setErrors({ form: c.errors.rate });
    if (body?.fields?.includes('phone')) return setErrors({ phone: c.errors.phone });
    if (body?.fields?.includes('email')) return setErrors({ email: c.errors.email });
    setErrors({ form: c.errors.server });
  };

  if (state === 'sent')
    return (
      <div
        role="status"
        className="site-swap flex flex-col items-start gap-4 rounded-[18px] border border-line bg-surface p-6"
      >
        <CheckCircle2 aria-hidden className="size-10 text-success" />
        <p className="text-[16px] font-semibold">{c.sent}</p>
        <Button variant="secondary" onClick={() => setState('idle')}>
          {c.again}
        </Button>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
      data-testid="contact-form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={c.name} error={errors.name} required>
          <Input name="name" autoComplete="name" maxLength={120} />
        </Field>
        <Field label={c.email} error={errors.email} required>
          <Input name="email" type="email" autoComplete="email" dir="ltr" maxLength={254} />
        </Field>
        <Field label={`${c.phone} (${c.optional})`} error={errors.phone}>
          <Input name="phone" type="tel" autoComplete="tel" dir="ltr" maxLength={40} />
        </Field>
        <Field label={c.topic}>
          <Select name="topic" defaultValue={defaultTopic}>
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {c.topics[topic]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={c.message} error={errors.message} required>
        <Textarea name="message" rows={6} maxLength={5000} />
      </Field>
      {/* not for people: bots fill it in, and the message is then dropped */}
      <div aria-hidden className="absolute -start-[9999px] size-px overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {errors.form ? (
        <p role="alert" className="rounded-card bg-danger-bg px-3 py-2 text-[14px] text-danger">
          {errors.form}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" icon={<Send className="icon-dir" />} loading={state === 'sending'}>
          {state === 'sending' ? c.sending : c.send}
        </Button>
        <p className="text-[13px] text-muted">{c.privacy}</p>
      </div>
    </form>
  );
}
