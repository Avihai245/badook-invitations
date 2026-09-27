'use client';

import { CheckCircle2, ChevronLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Card, Dialog, Field, Hint, PAGE_TITLE, Textarea, cn, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { useLiveRefresh } from '@/lib/live/client';
import { isolate, TICKETS } from '../config';
import type { CustomerMessage, CustomerTicket } from '../types';
import { TicketStatusBadge } from './StatusBadge';
import { ilDate, ilDateTime } from './when';

/**
 * /app/support/:id: one of the customer's tickets — the conversation with the team (the team's notes
 * never reach here), the assistant's conversation when one was attached, their answer, closing it. The
 * page listens on the ticket's own channel and shows the team's answer as it comes (no polling while
 * connected; every half minute when the connection is down).
 */
const teamAnswers = (x: CustomerTicket) => x.messages.filter((m) => m.author === 'team').length;

export function TicketScreen({ initial }: { initial: CustomerTicket }) {
  const { t, fmt, locale, plural } = useUi();
  const s = t.tickets;
  const k = s.ticket;
  const router = useRouter();
  const { toast } = useToast();
  const [ticket, setTicket] = useState(initial);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'close' | null>(null);
  const [closing, setClosing] = useState(false);
  const [announce, setAnnounce] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const lastMessage = useRef<HTMLLIElement>(null);
  const id = initial.id;

  // the app's menu counts answers not seen yet: this page has just seen them
  useEffect(() => {
    if (initial.unread) router.refresh();
    // once, for what the page opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // how many answers of the team the page shows (a new one is announced to screen readers)
  const answers = useRef(teamAnswers(initial));

  const reload = useCallback(async () => {
    // a page in the background doesn't mark the answers seen
    const seen = document.visibilityState === 'visible' ? '1' : '0';
    const res = await fetch(`/api/support/tickets/${id}?seen=${seen}`, { cache: 'no-store' }).catch(
      () => null,
    );
    if (res?.status === 401)
      return window.location.assign(`/login?next=${encodeURIComponent(`/app/support/${id}`)}`);
    const body = (await res?.json().catch(() => null)) as { ticket?: CustomerTicket } | null;
    const next = body?.ticket;
    if (!res?.ok || !next) return;
    if (teamAnswers(next) > answers.current) setAnnounce(k.newAnswer);
    answers.current = teamAnswers(next);
    setTicket(next);
  }, [id, k.newAnswer]);

  const live = useLiveRefresh(ticket.realtime, () => void reload(), TICKETS.pollMs);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = reply.trim();
    if (!text) {
      setError(s.form.errors.required);
      field.current?.focus();
      return;
    }
    setBusy('send');
    setError(null);
    const res = await fetch(`/api/support/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: text }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ticket?: CustomerTicket } | null;
    setBusy(null);
    if (res?.status === 401)
      return window.location.assign(`/login?next=${encodeURIComponent(`/app/support/${id}`)}`);
    if (res?.ok && body?.ticket) {
      answers.current = teamAnswers(body.ticket);
      setTicket(body.ticket);
      setReply('');
      toast({ title: k.sent, variant: 'success' });
      requestAnimationFrame(() =>
        lastMessage.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      );
      return;
    }
    setError(res?.status === 429 ? k.errors.rate : k.errors.generic);
  };

  const close = async () => {
    setBusy('close');
    const res = await fetch(`/api/support/tickets/${id}/close`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ticket?: CustomerTicket } | null;
    setBusy(null);
    setClosing(false);
    if (res?.ok && body?.ticket) {
      setTicket(body.ticket);
      toast({ title: k.closed, variant: 'success' });
      return;
    }
    toast({ title: k.errors.generic, variant: 'danger' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const eventText = (m: CustomerMessage) =>
    m.event === 'closed'
      ? m.by === 'customer'
        ? k.events.closedCustomer
        : m.by === 'auto'
          ? fmt(k.events.closedAuto, { days: TICKETS.autoCloseDays })
          : k.events.closedTeam
      : m.by === 'customer'
        ? k.events.reopenedCustomer
        : k.events.reopenedTeam;

  const note =
    ticket.status === 'closed'
      ? k.closedNote
      : ticket.status === 'waiting'
        ? fmt(k.waitingNote, { days: TICKETS.autoCloseDays })
        : null;

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8" data-testid="ticket-page">
      <Link
        href="/app/support"
        className="mb-3 inline-flex items-center gap-1 rounded-btn text-[13px] text-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="icon-dir size-4" />
        {k.back}
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className={cn(PAGE_TITLE.section, 'break-words')}>
          <bdi>{ticket.subject}</bdi>
        </h1>
        <p className="text-[13px] text-muted tabular-nums">
          {fmt(k.number, { n: ticket.number })} ·{' '}
          <time dateTime={ticket.createdAt} suppressHydrationWarning>
            {fmt(k.opened, { date: ilDate(locale, ticket.createdAt) })}
          </time>{' '}
          · {s.categories[ticket.category]}
        </p>
        {ticket.invitation ? (
          <p className="text-[13px] text-muted">
            {fmt(k.about, { title: isolate(ticket.invitation.title ?? ticket.invitation.slug) })}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="ticket-status">
          <span className="sr-only">{k.status}:</span>
          <TicketStatusBadge status={ticket.status} />
          <span className="text-[13px] text-muted">{s.statusHelp[ticket.status]}</span>
        </div>
      </header>

      <section aria-labelledby="ticket-conversation" className="mt-6">
        <h2 id="ticket-conversation" className="sr-only">
          {k.conversation}
        </h2>
        <ol className="flex flex-col gap-3" data-testid="ticket-messages">
          {ticket.messages.map((m, i) => {
            const last = i === ticket.messages.length - 1;
            if (m.author === 'system')
              return (
                <li
                  key={m.id}
                  ref={last ? lastMessage : undefined}
                  data-event={m.event}
                  className="flex items-center gap-3 py-1 text-[12.5px] text-muted"
                >
                  <span aria-hidden className="h-px flex-1 bg-line" />
                  <span className="text-center">
                    {eventText(m)} ·{' '}
                    <time dateTime={m.at} suppressHydrationWarning>
                      {ilDateTime(locale, m.at)}
                    </time>
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </li>
              );
            const mine = m.author === 'customer';
            return (
              <li
                key={m.id}
                ref={last ? lastMessage : undefined}
                data-author={m.author}
                className={cn(
                  'flex max-w-[88%] flex-col gap-1',
                  mine ? 'items-end self-end' : 'items-start self-start',
                )}
              >
                <span className="px-1 text-[12px] text-muted">
                  {mine ? k.you : fmt(k.team, { brand: t.brand })} ·{' '}
                  <time dateTime={m.at} suppressHydrationWarning>
                    {ilDateTime(locale, m.at)}
                  </time>
                </span>
                <div
                  dir="auto"
                  className={cn(
                    'rounded-[18px] px-4 py-3 text-start text-[14.5px] leading-[1.6] break-words whitespace-pre-wrap',
                    mine
                      ? 'rounded-ee-[6px] bg-brand-deep text-white'
                      : 'rounded-es-[6px] border border-line bg-surface text-ink shadow-sm',
                  )}
                >
                  {m.body}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {ticket.chat?.length ? (
        <details className="mt-5 rounded-card border border-line bg-surface" data-testid="ticket-chat">
          <summary className="cursor-pointer rounded-card px-4 py-3 text-[14px] font-semibold">
            {k.chat} · {plural(k.chatCount, ticket.chat.length)}
          </summary>
          <ol className="flex flex-col gap-2 border-t border-line px-4 py-3">
            {ticket.chat.map((line, i) => (
              <li key={i} className="text-[13.5px] leading-[1.55]">
                <span className="font-semibold">{line.role === 'user' ? k.chatUser : k.chatAssistant}: </span>
                <span dir="auto" className="whitespace-pre-wrap">
                  {line.content}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <Card padding="lg" className="mt-6">
        <form onSubmit={(e) => void send(e)} className="flex flex-col gap-3" data-testid="ticket-reply-form">
          <Field label={k.reply} error={error ?? undefined} help={note ?? undefined}>
            <Textarea
              ref={field}
              value={reply}
              rows={4}
              maxLength={TICKETS.bodyMax}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={k.replyPlaceholder}
              data-testid="ticket-reply"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Hint text={k.sendHint}>
              <Button
                type="submit"
                icon={<Send className="icon-dir" />}
                loading={busy === 'send'}
                data-testid="ticket-send"
              >
                {k.send}
              </Button>
            </Hint>
            {ticket.status !== 'closed' ? (
              <Hint text={k.closeHint}>
                <Button
                  variant="secondary"
                  icon={<CheckCircle2 />}
                  onClick={() => setClosing(true)}
                  data-testid="ticket-close"
                >
                  {k.close}
                </Button>
              </Hint>
            ) : null}
          </div>
        </form>
      </Card>

      <p
        className="mt-3 flex items-center gap-2 text-[12.5px] text-muted"
        data-testid="ticket-live"
        data-state={live}
      >
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            live === 'live' ? 'bg-success motion-safe:animate-pulse' : 'bg-line-strong',
          )}
        />
        {k.live}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      {closing ? (
        <Dialog
          open
          onOpenChange={(open) => !open && busy !== 'close' && setClosing(false)}
          title={k.closeTitle}
          description={k.closeBody}
          closeLabel={t.common.close}
          footer={
            <>
              <Button variant="secondary" onClick={() => setClosing(false)} disabled={busy === 'close'}>
                {t.common.cancel}
              </Button>
              <Button
                onClick={() => void close()}
                loading={busy === 'close'}
                data-testid="ticket-close-confirm"
              >
                {k.closeConfirm}
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
