'use client';

import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  FileSpreadsheet,
  Hourglass,
  ListChecks,
  MailCheck,
  MessageCircle,
  Palette,
  Send,
  Share2,
  Upload,
  Users,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, Card, cn, Input, KpiCard, PageHeader, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { GuestStats } from '../../lib/guest-status';
import type { ResponseStats } from '../../lib/responses';
import type { InvitationSummary } from '../../server/host-db';
import { HelpFor } from '../HelpFor';
import { publishHref } from '../workspace/paths';

export type OverviewStep = 'design' | 'publish' | 'import' | 'send' | 'track';

export interface OverviewFacts {
  status: InvitationSummary['status'];
  unpublishedChanges: boolean;
  guests: number;
  sent: number;
  responses: number;
}

/** Which of the five steps are done, and the first one that isn't (the one to do now). */
export function overviewSteps(f: OverviewFacts): {
  done: Record<OverviewStep, boolean>;
  next: OverviewStep | null;
} {
  const done: Record<OverviewStep, boolean> = {
    design: true,
    publish: f.status === 'published' && !f.unpublishedChanges,
    import: f.guests > 0,
    send: f.guests > 0 && f.sent >= f.guests,
    track: f.responses > 0,
  };
  const order: OverviewStep[] = ['design', 'publish', 'import', 'send', 'track'];
  return { done, next: order.find((s) => !done[s]) ?? null };
}

/**
 * The invitation's overview (/app/invitations/[id]): its numbers, the two things hosts come for —
 * uploading the guest list from Excel and sending it on WhatsApp — as big cards, the five steps to a
 * finished invitation with what's done, and its link.
 */
export function InvitationOverview({
  item,
  guests,
  replies,
  url,
}: {
  item: InvitationSummary;
  guests: GuestStats;
  replies: ResponseStats;
  url: string;
}) {
  const { t, fmt, plural, number } = useUi();
  const o = t.overview;
  const { toast } = useToast();
  const base = `/app/invitations/${item.id}`;
  const live = item.status === 'published';
  const facts: OverviewFacts = {
    status: item.status,
    unpublishedChanges: item.unpublishedChanges,
    guests: guests.total,
    sent: guests.sent,
    responses: replies.responses,
  };
  const { done, next } = overviewSteps(facts);
  const toSend = Math.max(0, guests.total - guests.sent);
  const coming = replies.responses - replies.declined;

  const copy = () =>
    navigator.clipboard.writeText(url).then(
      () => toast({ title: o.link.copied, variant: 'success' }),
      () => toast({ title: t.share.copyFailed, variant: 'danger' }),
    );

  // the WhatsApp card: what stands in the way, or how many are still waiting
  const send =
    guests.total === 0
      ? { note: o.main.send.noGuests, href: `${base}/guests?import=1`, cta: o.main.import.cta, ready: false }
      : !live
        ? {
            note: o.main.send.notPublished,
            href: publishHref(item.id),
            cta: o.steps.publish.cta,
            ready: false,
          }
        : toSend === 0
          ? {
              note: o.main.send.allSent,
              href: `${base}/guests`,
              cta: t.workspace.tabs.guestsShort,
              ready: false,
            }
          : {
              note: plural(o.main.send.toSend, toSend, { n: number(toSend) }),
              href: `${base}/guests?send=1`,
              cta: o.main.send.cta,
              ready: true,
            };

  const steps: { key: OverviewStep; icon: LucideIcon; href: string; note?: string }[] = [
    { key: 'design', icon: Palette, href: `${base}/edit` },
    {
      key: 'publish',
      icon: Send,
      href: publishHref(item.id),
      note: live && item.unpublishedChanges ? o.steps.publish.again : undefined,
    },
    {
      key: 'import',
      icon: FileSpreadsheet,
      href: `${base}/guests?import=1`,
      note: guests.total
        ? plural(t.workspace.guestsCount, guests.total, { n: number(guests.total) })
        : undefined,
    },
    { key: 'send', icon: MessageCircle, href: `${base}/guests?send=1` },
    {
      key: 'track',
      icon: ListChecks,
      href: `${base}/responses`,
      note: replies.responses
        ? plural(t.workspace.responsesCount, replies.responses, { n: number(replies.responses) })
        : undefined,
    },
  ];
  const doneCount = steps.filter((s) => done[s.key]).length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6">
      <PageHeader
        size="section"
        title={o.title}
        help={<HelpFor area="overview" />}
        description={o.subtitle}
      />

      <section
        aria-label={o.stats.label}
        className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <KpiCard
          icon={<Users />}
          label={o.stats.guests}
          value={number(guests.total)}
          sub={guests.total ? undefined : o.stats.noGuests}
        />
        <KpiCard
          icon={<MailCheck />}
          label={o.stats.sent}
          value={number(guests.sent)}
          sub={guests.total ? fmt(o.stats.ofGuests, { n: number(guests.total) }) : undefined}
        />
        <KpiCard
          icon={<CheckCheck />}
          label={o.stats.attending}
          value={number(coming)}
          sub={
            replies.attending
              ? plural(o.stats.people, replies.attending, { n: number(replies.attending) })
              : undefined
          }
        />
        <KpiCard icon={<UserX />} label={o.stats.declined} value={number(replies.declined)} />
        <KpiCard
          icon={<Hourglass />}
          label={o.stats.pending}
          value={guests.total ? number(guests.pending) : '—'}
          className="max-sm:col-span-2"
        />
      </section>

      <h2 className="mt-8 text-[17px] font-bold">{o.main.title}</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <ActionCard
          tone="excel"
          icon={FileSpreadsheet}
          title={o.main.import.title}
          body={o.main.import.body}
          note={
            guests.total ? plural(t.workspace.guestsCount, guests.total, { n: number(guests.total) }) : null
          }
          action={
            <Button size="lg" icon={<Upload />} asChild>
              <Link href={`${base}/guests?import=1`}>
                {guests.total ? o.main.import.more : o.main.import.cta}
              </Link>
            </Button>
          }
        />
        <ActionCard
          tone="whatsapp"
          icon={MessageCircle}
          title={o.main.send.title}
          body={o.main.send.body}
          note={send.note}
          action={
            <Button
              size="lg"
              variant={send.ready ? 'whatsapp' : 'secondary'}
              icon={send.ready ? <Send className="icon-dir" /> : <ArrowLeft className="icon-dir" />}
              asChild
            >
              <Link href={send.href}>{send.cta}</Link>
            </Button>
          }
        />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-[16px] font-bold">{o.steps.title}</h2>
            <span className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
              <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-subtle">
                <span
                  className="block h-full rounded-full bg-linear-to-l from-brand to-brand-deep transition-[width] duration-500"
                  style={{ width: `${(doneCount / steps.length) * 100}%` }}
                />
              </span>
              {fmt(o.steps.progress, { done: number(doneCount), total: number(steps.length) })}
            </span>
          </div>
          <ol className="divide-y divide-line">
            {steps.map(({ key, icon: Icon, href, note }, i) => {
              const isDone = done[key];
              const isNext = next === key;
              const s = o.steps[key];
              return (
                <li
                  key={key}
                  data-step={key}
                  data-done={isDone ? '' : undefined}
                  className={cn('flex items-center gap-3.5 px-5 py-3.5', isNext && 'bg-brand-soft/45')}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold',
                      isDone
                        ? 'bg-success text-white'
                        : isNext
                          ? 'bg-brand text-white shadow-[0_6px_14px_-6px_rgba(122,82,48,0.8)]'
                          : 'bg-subtle text-muted',
                    )}
                  >
                    {isDone ? (
                      <Check className="size-[18px]" strokeWidth={2.5} />
                    ) : (
                      <Icon className="size-[17px]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[14.5px] font-semibold', isDone && 'text-muted')}>
                      <span className="sr-only">{number(i + 1)}. </span>
                      {s.title}
                      {isDone ? <span className="sr-only"> ({o.steps.done})</span> : null}
                    </p>
                    <p className="text-[12.5px] text-muted">{note ?? s.body}</p>
                  </div>
                  {isNext ? (
                    <Button size="sm" asChild>
                      <Link href={href}>{s.cta}</Link>
                    </Button>
                  ) : isDone && key === 'publish' ? null : (
                    <Link
                      href={href}
                      className="shrink-0 rounded-btn px-2 py-1 text-[13px] font-semibold text-brand-deep hover:bg-brand-soft"
                    >
                      {isDone && key === 'import'
                        ? o.main.import.more
                        : isDone && key === 'send'
                          ? t.workspace.tabs.guestsShort
                          : s.cta}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <h2 className="text-[16px] font-bold">{o.link.title}</h2>
          {live ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={url}
                  dir="ltr"
                  textAlign="start"
                  aria-label={o.link.title}
                  onFocus={(e) => e.target.select()}
                />
                <Button variant="secondary" icon={<Copy />} onClick={() => void copy()}>
                  {o.link.copy}
                </Button>
              </div>
              <Link
                href={`${base}/share`}
                className="inline-flex items-center gap-1.5 self-start rounded-btn text-[13.5px] font-semibold text-brand-deep hover:underline"
              >
                <Share2 aria-hidden className="size-4" />
                {o.link.share}
              </Link>
            </>
          ) : (
            <>
              <p className="text-[13.5px] text-muted">{o.link.notLive}</p>
              <Button icon={<Send className="icon-dir" />} asChild className="self-start">
                <Link href={publishHref(item.id)}>{o.steps.publish.cta}</Link>
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

const TONES = {
  excel: {
    ring: 'border-[#cfe6d8]',
    glow: 'from-[#e8f5ee] via-surface to-surface',
    icon: 'bg-[#1d6f42] text-white shadow-[0_10px_22px_-10px_rgba(29,111,66,0.9)]',
    note: 'text-[#1d6f42]',
  },
  whatsapp: {
    ring: 'border-[#c9ecd7]',
    glow: 'from-[#e7f8ee] via-surface to-surface',
    icon: 'bg-whatsapp text-white shadow-[0_10px_22px_-10px_rgba(37,211,102,0.95)]',
    note: 'text-[#128c4a]',
  },
} as const;

/** One of the two big cards: an icon, what it does, where things stand, and the button. */
function ActionCard({
  tone,
  icon: Icon,
  title,
  body,
  note,
  action,
}: {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title: string;
  body: string;
  note: string | null;
  action: ReactNode;
}) {
  const c = TONES[tone];
  return (
    <section
      data-action={tone}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[18px] border bg-linear-to-b p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6',
        c.ring,
        c.glow,
      )}
    >
      <span aria-hidden className={cn('grid size-12 place-items-center rounded-[14px]', c.icon)}>
        <Icon className="size-6" strokeWidth={1.8} />
      </span>
      <h3 className="mt-4 text-[18px] leading-snug font-bold">{title}</h3>
      <p className="mt-1.5 text-[14px] text-pretty text-muted">{body}</p>
      {note ? <p className={cn('mt-3 text-[13px] font-semibold', c.note)}>{note}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2 [&_a]:max-sm:w-full">{action}</div>
    </section>
  );
}
