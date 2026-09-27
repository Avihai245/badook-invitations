'use client';

import { CheckCircle2, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Hint, Input, Select, Textarea } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { subjectFrom, TICKET_CATEGORIES, TICKETS, type TicketCategory } from '../config';
import type { ChatLine } from '../types';

/**
 * The assistant's "talk to a person" (inside its chat panel): a ticket for the team with the
 * conversation attached. The customer sees exactly what is sent — the subject and the message
 * (suggested from their questions, theirs to change), the type, and every line of the conversation —
 * and sends it; then the way to the ticket, where the team's answer comes.
 */
export function ChatHandoff({
  conversation,
  hidden = false,
  onBack,
  onFinish,
  onNavigate,
}: {
  /** the conversation as the assistant's server gets it (the latest part, starting with a question) */
  conversation: ChatLine[];
  /** back in the chat for a moment: the draft stays */
  hidden?: boolean;
  /** back to the chat, the draft kept */
  onBack: () => void;
  /** back to the chat once the ticket was sent */
  onFinish: () => void;
  /** a link was followed (a phone closes the chat that covers the page) */
  onNavigate: () => void;
}) {
  const { t, fmt, locale, plural } = useUi();
  const h = t.tickets.handoff;
  const questions = conversation.filter((l) => l.role === 'user');
  const [subject, setSubject] = useState(() => subjectFrom(questions[0]?.content ?? '', 120));
  const [category, setCategory] = useState<TicketCategory>('support');
  const [message, setMessage] = useState(() => questions.at(-1)?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; number: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // the view changed under the keyboard: its heading takes the focus
  useEffect(() => {
    if (!hidden) heading.current?.focus({ preventScroll: true });
  }, [done, hidden]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError(t.tickets.form.errors.required);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: subject.trim(),
        category,
        body: message.trim(),
        locale,
        source: 'chat',
        chat: conversation,
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ticket?: { id: string; number: number } } | null;
    setBusy(false);
    if (res?.ok && body?.ticket) return setDone({ id: body.ticket.id, number: body.ticket.number });
    setError(res?.status === 429 ? h.errors.rate : h.errors.generic);
  };

  if (done)
    return (
      <div
        hidden={hidden}
        className="flex min-h-0 flex-1 flex-col items-start gap-3 overflow-y-auto px-4 py-6"
        data-testid="handoff-done"
      >
        <CheckCircle2 aria-hidden className="size-9 text-success" />
        <h3 ref={heading} tabIndex={-1} className="text-[15px] leading-snug font-bold outline-none">
          {fmt(h.done, { n: done.number })}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Hint text={h.openHint}>
            <Button asChild size="sm">
              <Link href={`/app/support/${done.id}`} onClick={onNavigate} data-testid="handoff-open">
                {h.open}
              </Link>
            </Button>
          </Hint>
          <Hint text={h.finishHint}>
            <Button size="sm" variant="secondary" onClick={onFinish}>
              {h.back}
            </Button>
          </Hint>
        </div>
      </div>
    );

  return (
    <form
      hidden={hidden}
      onSubmit={(e) => void send(e)}
      className="flex min-h-0 flex-1 flex-col"
      data-testid="handoff"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4">
        <h3 ref={heading} tabIndex={-1} className="text-[15px] font-bold outline-none">
          {h.title}
        </h3>
        <p className="text-[13px] text-pretty text-muted">{h.intro}</p>
        <Field label={h.subject} required>
          <Input
            value={subject}
            maxLength={TICKETS.subjectMax}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field label={h.category}>
          <Select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.tickets.categories[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={h.message} required>
          <Textarea
            value={message}
            rows={3}
            maxLength={TICKETS.bodyMax}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[72px]"
          />
        </Field>
        <section aria-labelledby="handoff-preview" className="rounded-[12px] border border-line bg-canvas">
          <h4 id="handoff-preview" className="px-3 pt-2.5 text-[12.5px] font-semibold">
            {h.preview}: {plural(h.attached, conversation.length)}
          </h4>
          <ol className="flex max-h-[168px] flex-col gap-1.5 overflow-y-auto px-3 pt-1.5 pb-2.5" tabIndex={0}>
            {conversation.map((line, i) => (
              <li key={i} className="text-[12.5px] leading-[1.5]">
                <span className="font-semibold">
                  {line.role === 'user' ? t.tickets.ticket.chatUser : t.tickets.ticket.chatAssistant}:{' '}
                </span>
                <span dir="auto" className="whitespace-pre-wrap">
                  {line.content}
                </span>
              </li>
            ))}
          </ol>
        </section>
        {error ? (
          <p role="alert" className="rounded-card bg-danger-bg px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <Hint text={h.backHint}>
          <Button variant="secondary" onClick={onBack} disabled={busy}>
            {h.back}
          </Button>
        </Hint>
        <Hint text={h.sendHint}>
          <Button
            type="submit"
            icon={<Send className="icon-dir" />}
            loading={busy}
            data-testid="handoff-send"
          >
            {h.send}
          </Button>
        </Hint>
      </div>
    </form>
  );
}
