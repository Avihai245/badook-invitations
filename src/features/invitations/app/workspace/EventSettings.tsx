'use client';

import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Copy,
  CreditCard,
  LayoutGrid,
  PenLine,
  Settings2,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Card, PageHeader, useToast } from '@/components/app';
import { PlanSettings } from '@/features/planning/ui/PlanSettings';
import { useUi } from '@/lib/i18n/client';
import { hostApi, loginUrl } from '../api';
import { hostsLine } from '../../lib/text';
import type { InvitationSummary } from '../../server/host-db';
import type { ToolKey } from '../../lib/tools';
import { useOpenTools } from './context';

/**
 * The event's settings (the navigation's foot): its details (in the editor), the planning's settings, its
 * package, and duplicating or archiving it — what used to be scattered over the list's menu and the
 * planning's header.
 */
export function EventSettingsScreen({
  item,
  planning,
  tools,
}: {
  item: InvitationSummary;
  planning: boolean;
  /** the event's tools (invitations/lib/tools): shown, could have, need an upgrade */
  tools: { tools: ToolKey[]; offered: ToolKey[]; locked: ToolKey[] };
}) {
  const { t, locale, date, fmt } = useUi();
  const S = t.eventSettings;
  const { toast } = useToast();
  const router = useRouter();
  const [planOpen, setPlanOpen] = useState(false);
  const openTools = useOpenTools();
  const T = t.eventHome.tools;
  const [busy, setBusy] = useState(false);
  const loc = item.locales.includes(locale) ? locale : item.defaultLocale;
  const name = hostsLine(item.hosts, loc) || t.eventTypes[item.eventType];
  const archived = item.status === 'archived';

  const act = async (path: string, body: unknown, done: (b: Record<string, unknown>) => void) => {
    setBusy(true);
    const res = await hostApi<Record<string, unknown>>(`/api/invitations/${item.id}/${path}`, {
      method: 'POST',
      body,
    });
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok) return toast({ title: t.common.error, variant: 'danger' });
    done(res.body ?? {});
  };

  return (
    <div className="mx-auto max-w-[960px] px-4 pt-6 pb-16 sm:px-6">
      <PageHeader size="section" title={S.title} description={S.subtitle} />
      <div className="mt-6 grid gap-4">
        <Row
          icon={<CalendarDays />}
          title={S.details.title}
          body={fmt(S.details.body, {
            name,
            type: t.eventTypes[item.eventType],
            date: date(item.date, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
          })}
          action={
            <Button variant="secondary" icon={<PenLine />} asChild>
              <Link href={`/app/invitations/${item.id}/edit`}>{S.details.cta}</Link>
            </Button>
          }
        />
        <Row
          icon={<LayoutGrid />}
          title={T.title}
          body={tools.tools.map((k) => T.items[k].title).join(' · ')}
          action={
            <Button variant="secondary" onClick={openTools} aria-haspopup="dialog">
              {T.manage}
            </Button>
          }
        />
        {planning ? (
          <Row
            icon={<Settings2 />}
            title={S.planning.title}
            body={S.planning.body}
            action={
              <Button variant="secondary" onClick={() => setPlanOpen(true)} aria-haspopup="dialog">
                {S.planning.cta}
              </Button>
            }
          />
        ) : null}
        <Row
          icon={<CreditCard />}
          title={S.plan.title}
          body={S.plan.body}
          action={
            <Button variant="secondary" icon={<Sparkles />} asChild>
              <Link href="/app/billing">{S.plan.cta}</Link>
            </Button>
          }
        />
        <Row
          icon={<Copy />}
          title={S.duplicate.title}
          body={S.duplicate.body}
          action={
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void act('duplicate', {}, (b) => {
                  toast({ title: fmt(t.list.duplicated, { slug: String(b.slug) }), variant: 'success' });
                  if (typeof b.id === 'string') router.push(`/app/invitations/${b.id}`);
                })
              }
            >
              {S.duplicate.cta}
            </Button>
          }
        />
        <Row
          icon={archived ? <ArchiveRestore /> : <Archive />}
          title={archived ? S.archive.restoreTitle : S.archive.title}
          body={archived ? S.archive.restoreBody : S.archive.body}
          action={
            <Button
              variant={archived ? 'secondary' : 'danger'}
              disabled={busy}
              onClick={() =>
                void act('archive', { archived: !archived }, () => {
                  toast({ title: archived ? t.list.unarchived : t.list.archived, variant: 'success' });
                  router.refresh();
                })
              }
            >
              {archived ? S.archive.restore : S.archive.cta}
            </Button>
          }
        />
      </div>
      {planning ? <PlanSettings open={planOpen} onOpenChange={setPlanOpen} /> : null}
    </div>
  );
}

function Row({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <Card padding="lg" className="flex flex-wrap items-center gap-4">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-brand-soft text-brand-deep [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 basis-[240px]">
        <h2 className="text-[15.5px] font-bold">{title}</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">{body}</p>
      </div>
      <div className="shrink-0 max-sm:w-full max-sm:[&>*]:w-full">{action}</div>
    </Card>
  );
}
