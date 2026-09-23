'use client';

import {
  Archive,
  ArchiveRestore,
  Copy,
  ListChecks,
  MailPlus,
  MoreHorizontal,
  PencilLine,
  Plus,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge, Button, EmptyState, IconButton, Menu, useToast, type BadgeVariant } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostsLine } from '../../lib/text';
import type { InvitationSummary } from '../../server/host-db';
import { getTemplate } from '../../templates/registry';
import { hostApi, loginUrl } from '../api';
import { posterColors } from '../poster';
import { TemplatePoster } from '../TemplatePoster';
import { FollowUpDialog, followUpTypes } from './FollowUpDialog';

const BADGE: Record<InvitationSummary['status'], BadgeVariant> = {
  draft: 'draft',
  published: 'live',
  archived: 'neutral',
};

/** §9B.3-A: the host's invitations as poster cards (4/3/2/1 columns), archive view, empty state. */
export function InvitationsList({ items }: { items: InvitationSummary[] }) {
  const { t, fmt, plural } = useUi();
  const router = useRouter();
  const { toast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<InvitationSummary | null>(null);
  const [, startTransition] = useTransition();

  const active = items.filter((i) => i.status !== 'archived');
  const archived = items.filter((i) => i.status === 'archived');
  const visible = showArchived ? archived : active;

  async function act(id: string, url: string, body: unknown, done: (res: Record<string, unknown>) => string) {
    setBusy(id);
    const res = await hostApi<Record<string, unknown>>(url, { method: 'POST', body });
    setBusy(null);
    if (res.status === 401) return router.push(loginUrl());
    if (!res.ok || !res.body) return void toast({ title: t.common.error, variant: 'danger' });
    toast({ title: done(res.body), variant: 'success' });
    startTransition(() => router.refresh());
  }
  const duplicate = (id: string) =>
    act(id, `/api/invitations/${id}/duplicate`, {}, (b) => fmt(t.list.duplicated, { slug: String(b.slug) }));
  const archive = (id: string, on: boolean) =>
    act(id, `/api/invitations/${id}/archive`, { archived: on }, () =>
      on ? t.list.archived : t.list.unarchived,
    );

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[26px] font-bold tracking-tight">
          {showArchived ? plural(t.list.showArchived, archived.length, { n: archived.length }) : t.list.title}
        </h1>
        <div className="flex items-center gap-2">
          {showArchived ? (
            <Button variant="ghost" onClick={() => setShowArchived(false)}>
              {t.list.hideArchived}
            </Button>
          ) : archived.length ? (
            <Button variant="ghost" icon={<Archive />} onClick={() => setShowArchived(true)}>
              {plural(t.list.showArchived, archived.length, { n: archived.length })}
            </Button>
          ) : null}
          <Button asChild icon={<Plus />}>
            <Link href="/app/invitations/new">{t.list.newInvitation}</Link>
          </Button>
        </div>
      </div>

      {visible.length ? (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <li key={item.id}>
              <InvitationCard
                item={item}
                busy={busy === item.id}
                onDuplicate={() => void duplicate(item.id)}
                onArchive={(on) => void archive(item.id, on)}
                onFollowUp={() => setFollowUp(item)}
              />
            </li>
          ))}
        </ul>
      ) : showArchived ? (
        <p className="mt-10 text-center text-muted">{t.list.archivedEmpty}</p>
      ) : (
        <EmptyState
          className="mt-10"
          titleAs="h2"
          illustration={<EnvelopeArt />}
          title={t.list.emptyTitle}
          description={t.list.emptyBody}
          action={
            <Button asChild size="lg">
              <Link href="/app/invitations/new">{t.list.emptyCta}</Link>
            </Button>
          }
        />
      )}
      {followUp ? <FollowUpDialog item={followUp} onClose={() => setFollowUp(null)} /> : null}
    </div>
  );
}

function InvitationCard({
  item,
  busy,
  onDuplicate,
  onArchive,
  onFollowUp,
}: {
  item: InvitationSummary;
  busy: boolean;
  onDuplicate: () => void;
  onArchive: (archived: boolean) => void;
  /** a save-the-date → its full invitation */
  onFollowUp: () => void;
}) {
  const { t, locale, date, number, plural } = useUi();
  const template = getTemplate(item.templateId)?.manifest;
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const monogram = item.monogram?.[loc] ?? item.monogram?.[item.defaultLocale] ?? '';
  const href = `/app/invitations/${item.id}/edit`;
  const stats = item.responses
    ? plural(t.list.stats, item.responses, {
        responses: number(item.responses),
        attending: number(item.attending),
      })
    : t.list.noResponses;
  const archived = item.status === 'archived';

  return (
    // One column on phones: a row (small poster + details) instead of a full-width 9:16 poster.
    <article className="group max-sm:flex max-sm:items-start max-sm:gap-4" aria-busy={busy || undefined}>
      <Link href={href} tabIndex={-1} aria-hidden className="block max-sm:w-24 max-sm:shrink-0">
        <TemplatePoster
          colors={
            template ? posterColors(template, item.sealColor) : { background: '#EFEDEA', seal: '#D6D3D1' }
          }
          text={monogram}
          className="transition-[transform,box-shadow] duration-250 group-hover:-translate-y-1 group-hover:shadow-lg motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
        />
      </Link>
      <div className="mt-2.5 flex items-start gap-2 max-sm:mt-1 max-sm:min-w-0 max-sm:flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 truncate text-[15px] font-bold">
              <Link href={href} lang={loc} className="rounded-[4px] hover:underline">
                {name}
              </Link>
            </h2>
            <Badge variant={BADGE[item.status]}>{t.status[item.status]}</Badge>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            <span dir="ltr" className="tabular-nums">
              {date(item.date, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}
            </span>
            {' · '}
            {stats}
          </p>
          {item.status === 'published' && item.unpublishedChanges ? (
            <p className="mt-0.5 text-[12px] font-medium text-warning">{t.status.unpublishedChanges}</p>
          ) : null}
        </div>
        <Menu
          trigger={
            <IconButton label={t.common.more} size="sm" disabled={busy} className="-me-1 mt-px">
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: t.list.menu.edit, icon: <PencilLine />, href },
            ...(item.status === 'published'
              ? [{ label: t.list.menu.share, icon: <Share2 />, href: `/app/invitations/${item.id}/share` }]
              : []),
            ...(item.status !== 'draft' || item.responses > 0
              ? [
                  {
                    label: t.list.menu.responses,
                    icon: <ListChecks />,
                    href: `/app/invitations/${item.id}/responses`,
                  },
                ]
              : []),
            ...(item.eventType === 'save_the_date' && !archived && followUpTypes(item.templateId).length
              ? [{ label: t.list.menu.followUp, icon: <MailPlus />, onSelect: onFollowUp }]
              : []),
            { label: t.list.menu.duplicate, icon: <Copy />, onSelect: onDuplicate },
            { type: 'separator' },
            archived
              ? { label: t.list.menu.unarchive, icon: <ArchiveRestore />, onSelect: () => onArchive(false) }
              : { label: t.list.menu.archive, icon: <Archive />, onSelect: () => onArchive(true) },
          ]}
        />
      </div>
    </article>
  );
}

/** Empty-state illustration: an envelope with a seal (decorative, 120×120). */
function EnvelopeArt() {
  return (
    <svg viewBox="0 0 120 120" fill="none">
      <rect x="14" y="30" width="92" height="64" rx="8" fill="#F5F0E8" stroke="#D6CFC4" strokeWidth="2" />
      <path d="M16 34 60 66l44-32" stroke="#D6CFC4" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="60" cy="66" r="13" fill="#731F2E" />
      <circle cx="60" cy="66" r="9" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
    </svg>
  );
}
