'use client';

import { ChevronLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, Field, Hint, Input, PageHeader, Select, Textarea, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { TICKET_CATEGORIES, TICKETS, type TicketCategory } from '../config';

type Errors = Partial<Record<'subject' | 'body' | 'form', string>>;

/**
 * /app/support/new: a ticket for the team — the subject, what it is about, the message and (when it is
 * about one) which of the customer's invitations. Errors in words, focus on the first; once sent, its
 * page.
 */
export function NewTicket({
  invitations,
  defaults,
}: {
  invitations: { id: string; title: string }[];
  defaults: { category: TicketCategory; invitationId: string | null };
}) {
  const { t, fmt, locale } = useUi();
  const s = t.tickets;
  const f = s.form;
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [body, setBody] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const subject = String(data.get('subject') ?? '').trim();
    const next: Errors = {};
    if (!subject) next.subject = f.errors.required;
    else if (subject.length > TICKETS.subjectMax)
      next.subject = fmt(f.errors.tooLong, { n: TICKETS.subjectMax });
    if (!body.trim()) next.body = f.errors.required;
    else if (body.length > TICKETS.bodyMax) next.body = fmt(f.errors.tooLong, { n: TICKETS.bodyMax });
    setErrors(next);
    const first = (['subject', 'body'] as const).find((k) => next[k]);
    if (first) {
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject,
        category: String(data.get('category') ?? 'support'),
        body: body.trim(),
        invitationId: String(data.get('invitationId') ?? '') || null,
        locale,
        source: 'app',
      }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as {
      ticket?: { id: string };
      fields?: string[];
    } | null;
    if (res?.status === 401) return window.location.assign('/login?next=%2Fapp%2Fsupport%2Fnew');
    if (res?.ok && json?.ticket?.id) {
      toast({ title: f.opened, variant: 'success' });
      router.push(`/app/support/${json.ticket.id}`);
      return;
    }
    setBusy(false);
    if (res?.status === 429) return setErrors({ form: f.errors.rate });
    if (json?.fields?.includes('subject')) return setErrors({ subject: f.errors.required });
    if (json?.fields?.includes('body')) return setErrors({ body: f.errors.required });
    setErrors({ form: f.errors.generic });
  };

  return (
    <div className="mx-auto max-w-[760px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <Link
        href="/app/support"
        className="mb-3 inline-flex items-center gap-1 rounded-btn text-[13px] text-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="icon-dir size-4" />
        {s.ticket.back}
      </Link>
      <PageHeader title={f.title} description={f.subtitle} />
      <Card padding="lg" className="mt-6">
        <form
          noValidate
          onSubmit={(e) => void submit(e)}
          className="flex flex-col gap-4"
          data-testid="ticket-form"
        >
          <Field label={f.subject} error={errors.subject} required>
            <Input
              name="subject"
              maxLength={TICKETS.subjectMax}
              placeholder={f.subjectPlaceholder}
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.category}>
              <Select name="category" defaultValue={defaults.category}>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {s.categories[c]}
                  </option>
                ))}
              </Select>
            </Field>
            {invitations.length ? (
              <Field label={`${f.invitation} (${t.common.optional})`}>
                <Select name="invitationId" defaultValue={defaults.invitationId ?? ''}>
                  <option value="">{f.noInvitation}</option>
                  {invitations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <Field
            label={f.message}
            error={errors.body}
            required
            help={f.privacy}
            counter={
              body.length > TICKETS.bodyMax * 0.8 ? { value: body.length, max: TICKETS.bodyMax } : undefined
            }
          >
            <Textarea
              name="body"
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={f.messagePlaceholder}
            />
          </Field>
          {errors.form ? (
            <p role="alert" className="rounded-card bg-danger-bg px-3 py-2 text-[14px] text-danger">
              {errors.form}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Hint text={f.sendHint}>
              <Button
                type="submit"
                icon={<Send className="icon-dir" />}
                loading={busy}
                data-testid="ticket-submit"
              >
                {f.send}
              </Button>
            </Hint>
            <Hint text={f.cancelHint}>
              <Button variant="ghost" asChild>
                <Link href="/app/support">{f.cancel}</Link>
              </Button>
            </Hint>
          </div>
        </form>
      </Card>
    </div>
  );
}
