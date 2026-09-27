'use client';

import { ChevronLeft, ExternalLink, Lock, Mail, MailWarning, Trash2, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Badge, Button, Card, Field, Hint, Segmented, Select, Textarea, cn } from '@/components/app';
import { AdminPageHeader } from '@/features/admin/ui/AdminShell.client';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import {
  isolate,
  staffName,
  TICKET_STATUSES,
  TICKETS,
  type TicketPriority,
  type TicketStatus,
} from '../config';
import type { AdminTicket, AdminTicketMessage } from '../types';
import { AdminStatusBadge, ConfirmDialog, PriorityBadge, useAdminAction } from './shared';

type Confirm =
  | { kind: 'reply'; close: boolean }
  | { kind: 'note' }
  | { kind: 'status'; to: TicketStatus }
  | { kind: 'priority'; to: TicketPriority }
  | { kind: 'assign'; to: { userId: string; email: string } | null }
  | { kind: 'remove' };

/**
 * /app/admin/support/:id: one ticket — the conversation with the team's notes set apart and what
 * happened on it, the attached assistant conversation, the answer box ("send" / "send and close") and
 * a note box, the status, the priority and who handles it, and the customer (their account, contact
 * details masked for roles without users.pii). Every action says exactly what it will do first; roles
 * without support.reply see the buttons disabled with the reason. The console's live channel refreshes
 * it when the customer answers.
 */
export function AdminTicketScreen({ ticket }: { ticket: AdminTicket }) {
  const { t, fmt, date, can, staff } = useAdminUi();
  const s = t.support;
  const router = useRouter();
  const act = useAdminAction();
  const mayReply = can('support.reply');
  const reachable = ticket.customer.kind !== 'gone';
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const [empty, setEmpty] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const me = ticket.agents.find((a) => a.email === staff.email) ?? null;
  const base = `/api/admin/support/${ticket.id}`;
  const name = ticket.customer.name ?? s.confirm.theCustomer;
  const email = ticket.customer.email ?? s.customer.none;

  /** The answer or the note needs words; then the confirmation. */
  const ask = (c: Confirm) => {
    if ((c.kind === 'reply' || c.kind === 'note') && !text.trim()) {
      setEmpty(true);
      field.current?.focus();
      return;
    }
    setConfirm(c);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (!mayReply || (mode === 'reply' && !reachable)) return;
    ask(mode === 'reply' ? { kind: 'reply', close: false } : { kind: 'note' });
  };

  const run = async (c: Confirm, reason: string): Promise<boolean> => {
    switch (c.kind) {
      case 'reply': {
        const r = await act(
          `${base}/reply`,
          'POST',
          { body: text, close: c.close },
          c.close ? s.toasts.repliedClosed : s.toasts.replied,
        );
        if (r.ok) setText('');
        return r.ok;
      }
      case 'note': {
        const r = await act(`${base}/note`, 'POST', { body: text }, s.toasts.noted);
        if (r.ok) {
          setText('');
          setMode('reply');
        }
        return r.ok;
      }
      case 'status':
        return (await act(base, 'PATCH', { status: c.to }, s.toasts.status)).ok;
      case 'priority':
        return (await act(base, 'PATCH', { priority: c.to }, s.toasts.priority)).ok;
      case 'assign':
        return (await act(base, 'PATCH', { assignee: c.to?.userId ?? null }, s.toasts.assigned)).ok;
      case 'remove': {
        const r = await act(`${base}/delete`, 'POST', { reason }, s.toasts.removed, { refresh: false });
        if (r.ok) router.push('/app/admin/support');
        return r.ok;
      }
    }
  };

  const dialog = (c: Confirm) => {
    const c2 = s.confirm;
    switch (c.kind) {
      case 'reply': {
        const visitor = ticket.customer.kind === 'visitor';
        const body = c.close
          ? visitor
            ? c2.replyCloseVisitor
            : c2.replyCloseAccount
          : visitor
            ? c2.replyVisitor
            : c2.replyAccount;
        return {
          title: c.close ? c2.replyCloseTitle : c2.replyTitle,
          body: fmt(body, { name: isolate(name), email: isolate(email) }),
          confirm: c.close ? c2.sendClose : c2.send,
        };
      }
      case 'note':
        return { title: c2.noteTitle, body: c2.noteBody, confirm: c2.add };
      case 'status': {
        const to = s.status[c.to];
        const body =
          c.to === 'closed'
            ? c2.statusClosed
            : ticket.status === 'closed'
              ? fmt(c2.statusReopen, { to })
              : c.to === 'open'
                ? c2.statusOpen
                : c2.statusWaiting;
        return { title: fmt(c2.statusTitle, { to }), body, confirm: c2.change };
      }
      case 'priority':
        return c.to === 'high'
          ? { title: c2.highTitle, body: c2.highBody, confirm: t.common.confirm }
          : { title: c2.normalTitle, body: c2.normalBody, confirm: t.common.confirm };
      case 'assign':
        return c.to
          ? {
              title: fmt(c2.assignTitle, { who: isolate(c.to.email) }),
              body: fmt(c2.assignBody, { who: isolate(c.to.email) }),
              confirm: c2.assign,
            }
          : { title: c2.unassignTitle, body: c2.unassignBody, confirm: t.common.confirm };
      case 'remove':
        return { title: c2.removeTitle, body: c2.removeBody, confirm: c2.remove, danger: true };
    }
  };

  const replyBlocked = !mayReply ? s.denied : !reachable ? s.customer.gone : null;
  const current = confirm ? dialog(confirm) : null;

  return (
    <>
      <Link
        href="/app/admin/support"
        className="mb-3 inline-flex items-center gap-1 rounded-btn text-[13px] text-muted hover:text-ink"
      >
        <ChevronLeft aria-hidden className="icon-dir size-4" />
        {s.ticket.back}
      </Link>
      <AdminPageHeader
        title={<bdi className="break-words">{ticket.subject}</bdi>}
        intro={
          <span className="tabular-nums">
            {fmt(s.ticket.number, { n: ticket.number })} ·{' '}
            <time dateTime={ticket.createdAt} suppressHydrationWarning>
              {fmt(s.ticket.opened, { date: date(ticket.createdAt) })}
            </time>{' '}
            · {s.categories[ticket.category]} · {fmt(s.ticket.from, { source: s.sources[ticket.source] })} ·{' '}
            {fmt(s.ticket.language, { lang: s.ticket.languages[ticket.locale] })}
          </span>
        }
        actions={
          <span className="flex items-center gap-1.5" data-testid="admin-ticket-status">
            <AdminStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Conversation ticket={ticket} />
          {ticket.chat?.length ? <AttachedChat ticket={ticket} /> : null}

          <Card padding="lg" asChild>
            <section aria-labelledby="composer-title" data-testid="admin-composer">
              <h2 id="composer-title" className="mb-3 text-[15px] font-bold">
                {s.composer.label}
              </h2>
              <Segmented
                label={s.composer.mode}
                value={mode}
                onValueChange={(m) => {
                  setMode(m);
                  setEmpty(false);
                }}
                options={[
                  { value: 'reply', label: s.composer.reply },
                  { value: 'note', label: s.composer.note },
                ]}
              />
              <Field
                className="mt-3"
                label={mode === 'reply' ? s.composer.replyField : s.composer.noteField}
                error={empty ? s.composer.empty : undefined}
                help={
                  mode === 'reply'
                    ? (replyBlocked ?? s.composer.shortcut)
                    : `${s.ticket.noteHelp} ${s.composer.shortcut}`
                }
              >
                <Textarea
                  ref={field}
                  value={text}
                  rows={5}
                  maxLength={TICKETS.bodyMax}
                  onChange={(e) => {
                    setText(e.target.value);
                    setEmpty(false);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={mode === 'reply' ? s.composer.replyPlaceholder : s.composer.notePlaceholder}
                  className={cn(mode === 'note' && 'border-warning/40 bg-warning-bg/50')}
                  data-testid="admin-composer-text"
                />
              </Field>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {mode === 'reply' ? (
                  <>
                    <Hint text={s.composer.sendHelp} disabledText={replyBlocked}>
                      <Button
                        disabled={!!replyBlocked}
                        onClick={() => ask({ kind: 'reply', close: false })}
                        data-testid="admin-send"
                      >
                        {s.composer.send}
                      </Button>
                    </Hint>
                    <Hint text={s.composer.sendCloseHelp} disabledText={replyBlocked}>
                      <Button
                        variant="secondary"
                        disabled={!!replyBlocked}
                        onClick={() => ask({ kind: 'reply', close: true })}
                        data-testid="admin-send-close"
                      >
                        {s.composer.sendClose}
                      </Button>
                    </Hint>
                  </>
                ) : (
                  <Hint text={s.composer.addNoteHelp} disabledText={s.denied}>
                    <Button
                      icon={<Lock />}
                      disabled={!mayReply}
                      onClick={() => ask({ kind: 'note' })}
                      data-testid="admin-add-note"
                    >
                      {s.composer.addNote}
                    </Button>
                  </Hint>
                )}
              </div>
            </section>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4" aria-label={s.manage.title}>
          <Card padding="lg" data-testid="admin-manage">
            <h2 className="text-[15px] font-bold">{s.manage.title}</h2>
            {!mayReply ? <p className="mt-2 text-[13px] text-muted">{s.denied}</p> : null}
            <div className="mt-3 flex flex-col gap-4">
              <Field label={s.manage.status} help={s.manage.statusHelp}>
                <Select
                  value={ticket.status}
                  disabled={!mayReply}
                  onChange={(e) => setConfirm({ kind: 'status', to: e.target.value as TicketStatus })}
                  data-testid="admin-status"
                >
                  {TICKET_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {s.status[st]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold">{s.manage.priority}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {ticket.priority === 'high' ? (
                    <PriorityBadge priority="high" />
                  ) : (
                    <span className="text-[13.5px]">{s.priority.normal}</span>
                  )}
                  <Hint
                    text={ticket.priority === 'high' ? s.manage.markNormalHelp : s.manage.markHighHelp}
                    disabledText={s.denied}
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!mayReply}
                      onClick={() =>
                        setConfirm({ kind: 'priority', to: ticket.priority === 'high' ? 'normal' : 'high' })
                      }
                      data-testid="admin-priority"
                    >
                      {ticket.priority === 'high' ? s.manage.markNormal : s.manage.markHigh}
                    </Button>
                  </Hint>
                </div>
              </div>
              <Field label={s.manage.assignee} help={s.manage.assignHelp}>
                <Select
                  value={ticket.assignee?.userId ?? ''}
                  disabled={!mayReply}
                  onChange={(e) => {
                    const to = ticket.agents.find((a) => a.userId === e.target.value);
                    setConfirm({ kind: 'assign', to: to ? { userId: to.userId, email: to.email } : null });
                  }}
                  data-testid="admin-assignee"
                >
                  <option value="">{s.manage.nobody}</option>
                  {ticket.agents.map((a) => (
                    <option key={a.userId} value={a.userId}>
                      {a.email}
                    </option>
                  ))}
                  {ticket.assignee && !ticket.agents.some((a) => a.userId === ticket.assignee?.userId) ? (
                    <option value={ticket.assignee.userId}>{ticket.assignee.email}</option>
                  ) : null}
                </Select>
              </Field>
              {mayReply && me && ticket.assignee?.userId !== me.userId ? (
                <Hint text={s.manage.assignMeHelp}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<UserCheck />}
                    className="self-start"
                    onClick={() => setConfirm({ kind: 'assign', to: { userId: me.userId, email: me.email } })}
                    data-testid="admin-assign-me"
                  >
                    {s.manage.assignMe}
                  </Button>
                </Hint>
              ) : null}
              <div className="border-t border-line pt-3">
                <Hint text={s.manage.removeHelp} disabledText={s.denied}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    className="text-danger hover:text-danger"
                    disabled={!mayReply}
                    onClick={() => setConfirm({ kind: 'remove' })}
                    data-testid="admin-remove"
                  >
                    {s.manage.remove}
                  </Button>
                </Hint>
              </div>
            </div>
          </Card>
          <CustomerCard ticket={ticket} />
          {ticket.invitation ? <InvitationCard ticket={ticket} /> : null}
        </aside>
      </div>

      {confirm && current ? (
        <ConfirmDialog
          title={current.title}
          body={current.body}
          confirm={current.confirm}
          danger={'danger' in current && current.danger}
          reason={
            confirm.kind === 'remove'
              ? {
                  label: s.confirm.reason,
                  placeholder: s.confirm.reasonPlaceholder,
                  required: s.confirm.reasonRequired,
                }
              : undefined
          }
          onConfirm={(reason) => run(confirm, reason)}
          onClose={() => setConfirm(null)}
          testId={`admin-${confirm.kind}`}
        />
      ) : null}
    </>
  );
}

function eventLine(m: AdminTicketMessage, t: ReturnType<typeof useAdminUi>): string {
  const s = t.t.support;
  const e = s.ticket.events;
  const who = isolate(m.authorEmail ? staffName(m.authorEmail) : s.ticket.team);
  const to = m.meta.to ?? null;
  switch (m.event) {
    case 'closed':
      return m.meta.by === 'customer'
        ? e.closedCustomer
        : m.meta.by === 'auto'
          ? t.fmt(e.closedAuto, { days: TICKETS.autoCloseDays })
          : t.fmt(e.closedTeam, { who });
    case 'reopened':
      return m.meta.by === 'customer' ? e.reopenedCustomer : t.fmt(e.reopenedTeam, { who });
    case 'status':
      return t.fmt(e.status, { who, to: to ? s.status[to as TicketStatus] : '' });
    case 'assigned':
      return to ? t.fmt(e.assigned, { who, to: isolate(staffName(to)) }) : t.fmt(e.unassigned, { who });
    case 'priority':
      return t.fmt(e.priority, { who, to: to ? s.priority[to as TicketPriority] : '' });
    default:
      return '';
  }
}

function Conversation({ ticket }: { ticket: AdminTicket }) {
  const ui = useAdminUi();
  const { t, dateTime } = ui;
  const s = t.support;
  return (
    <section aria-labelledby="conversation-title">
      <h2 id="conversation-title" className="sr-only">
        {s.ticket.conversation}
      </h2>
      <ol className="flex flex-col gap-3" data-testid="admin-messages">
        {ticket.messages.map((m) => {
          const when = (
            <time dateTime={m.at} suppressHydrationWarning>
              {dateTime(m.at)}
            </time>
          );
          if (m.author === 'system')
            return (
              <li
                key={m.id}
                data-event={m.event}
                data-internal={m.internal ? '1' : undefined}
                className="flex items-center gap-3 py-1 text-[12.5px] text-muted"
              >
                <span aria-hidden className="h-px flex-1 bg-line" />
                <span className="text-center">
                  {eventLine(m, ui)} · {when}
                </span>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </li>
            );
          if (m.internal)
            return (
              <li
                key={m.id}
                data-note="1"
                className="rounded-card border border-warning/30 bg-warning-bg px-4 py-3"
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink">
                  <Lock aria-hidden className="size-3.5 text-warning" />
                  <span className="font-semibold text-warning">{s.ticket.note}</span>
                  {m.authorEmail ? (
                    <span dir="ltr" title={m.authorEmail}>
                      {staffName(m.authorEmail)}
                    </span>
                  ) : null}{' '}
                  · {when}
                </p>
                <p
                  dir="auto"
                  className="mt-1.5 text-start text-[14px] leading-[1.6] break-words whitespace-pre-wrap"
                >
                  {m.body}
                </p>
              </li>
            );
          const team = m.author === 'staff';
          return (
            <li
              key={m.id}
              data-author={m.author}
              className={cn(
                'flex max-w-[88%] flex-col gap-1',
                team ? 'items-end self-end' : 'items-start self-start',
              )}
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[12px] text-muted">
                {team ? (
                  <span dir="ltr" title={m.authorEmail ?? undefined}>
                    {m.authorEmail ? staffName(m.authorEmail) : s.ticket.team}
                  </span>
                ) : (
                  <span>{s.ticket.customer}</span>
                )}
                · {when}
                {team && m.emailed ? (
                  <Hint text={s.ticket.emailedHelp[m.emailed]}>
                    <span
                      tabIndex={0}
                      data-emailed={m.emailed}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-1.5 font-medium',
                        m.emailed === 'sent' ? 'text-success' : 'text-danger',
                      )}
                    >
                      {m.emailed === 'sent' ? (
                        <Mail aria-hidden className="size-3.5" />
                      ) : (
                        <MailWarning aria-hidden className="size-3.5" />
                      )}
                      {s.ticket.emailed[m.emailed]}
                    </span>
                  </Hint>
                ) : null}
              </span>
              <div
                dir="auto"
                className={cn(
                  'rounded-[18px] px-4 py-3 text-start text-[14.5px] leading-[1.6] break-words whitespace-pre-wrap',
                  team
                    ? 'rounded-ee-[6px] bg-brand-strong text-white'
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
  );
}

function AttachedChat({ ticket }: { ticket: AdminTicket }) {
  const { t, plural } = useAdminUi();
  const s = t.support.ticket;
  const chat = ticket.chat ?? [];
  return (
    <details className="rounded-card border border-line bg-surface" data-testid="admin-chat">
      <summary className="cursor-pointer rounded-card px-4 py-3 text-[14px] font-semibold">
        {s.chat} · {plural(s.chatCount, chat.length)}
      </summary>
      <ol className="flex flex-col gap-2 border-t border-line px-4 py-3">
        {chat.map((line, i) => (
          <li key={i} className="text-[13.5px] leading-[1.55]">
            <span className="font-semibold">{line.role === 'user' ? s.chatUser : s.chatAssistant}: </span>
            <span dir="auto" className="whitespace-pre-wrap">
              {line.content}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function CustomerCard({ ticket }: { ticket: AdminTicket }) {
  const { t, number, date } = useAdminUi();
  const s = t.support.customer;
  const c = ticket.customer;
  const masked = (v: string | null) => !!v && v.includes('***');
  const source = (v: string | null) =>
    !v
      ? s.none
      : v.startsWith('partner:')
        ? s.sources.partner
        : v === 'google'
          ? s.sources.google
          : s.sources.signup;
  const rows: { label: string; value: ReactNode }[] = [
    { label: s.name, value: c.name ? <bdi>{c.name}</bdi> : s.none },
    {
      label: s.email,
      value: c.email ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <span dir="ltr" className="text-start [overflow-wrap:anywhere] rtl:text-end">
            {c.email}
          </span>
          {masked(c.email) ? <MaskedMark /> : null}
        </span>
      ) : (
        s.none
      ),
    },
  ];
  if (c.phone)
    rows.push({
      label: s.phone,
      value: (
        <span className="flex flex-wrap items-center gap-1.5">
          <span dir="ltr">{c.phone}</span>
          {c.phone.includes('X') ? <MaskedMark /> : null}
        </span>
      ),
    });
  if (c.kind === 'account')
    rows.push(
      { label: s.plan, value: c.plan ? s.plans[c.plan] : s.none },
      { label: s.credits, value: <span className="tabular-nums">{number(c.credits ?? 0)}</span> },
      { label: s.invitations, value: <span className="tabular-nums">{number(c.invitations ?? 0)}</span> },
      { label: s.joined, value: c.joinedAt ? date(c.joinedAt) : s.none },
      { label: s.source, value: source(c.source) },
    );
  rows.push({ label: s.tickets, value: <span className="tabular-nums">{number(c.tickets)}</span> });
  return (
    <Card padding="lg" data-testid="admin-customer" data-kind={c.kind}>
      <h2 className="text-[15px] font-bold">{s.title}</h2>
      {c.kind === 'gone' ? <p className="mt-2 text-[13px] text-muted">{s.gone}</p> : null}
      {c.kind === 'visitor' ? <p className="mt-2 text-[13px] text-muted">{s.visitor}</p> : null}
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13.5px]">
        {rows.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 text-start">{value}</dd>
          </div>
        ))}
      </dl>
      {c.kind === 'account' && c.userId ? (
        <Hint text={s.openHelp}>
          <Button asChild size="sm" variant="secondary" className="mt-4">
            <Link href={`/app/admin/users/${c.userId}`} data-testid="admin-customer-link">
              {s.open}
            </Link>
          </Button>
        </Hint>
      ) : null}
    </Card>
  );
}

function MaskedMark() {
  const { t } = useAdminUi();
  return (
    <Hint text={t.common.maskedHelp}>
      <span tabIndex={0} className="inline-flex">
        <Badge variant="neutral">{t.common.masked}</Badge>
      </span>
    </Hint>
  );
}

function InvitationCard({ ticket }: { ticket: AdminTicket }) {
  const { t } = useAdminUi();
  const s = t.support.ticket;
  const i = ticket.invitation!;
  const status = (s.invitationStatus as Record<string, string>)[i.status] ?? i.status;
  return (
    <Card padding="lg" data-testid="admin-invitation">
      <h2 className="text-[15px] font-bold">{s.invitation}</h2>
      <p className="mt-2 text-[14px] font-semibold break-words">
        <bdi>{i.title ?? i.slug}</bdi>
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted">
        <span dir="ltr">/i/{i.slug}</span> · {status}
      </p>
      {i.status === 'published' ? (
        <Hint text={s.viewInvitationHelp}>
          <Button
            asChild
            size="sm"
            variant="secondary"
            icon={<ExternalLink className="icon-dir" />}
            className="mt-3"
          >
            <a href={`/i/${i.slug}`} target="_blank" rel="noopener noreferrer">
              {s.viewInvitation}
            </a>
          </Button>
        </Hint>
      ) : null}
    </Card>
  );
}
