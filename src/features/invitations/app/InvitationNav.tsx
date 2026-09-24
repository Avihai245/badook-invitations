'use client';

import { ChevronLeft, ListChecks, PencilLine, Send, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, cn } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { useInWorkspace } from './workspace/context';

export type InvitationTab = 'guests' | 'responses' | 'share';

/**
 * The header of an invitation's pages: back to all invitations, its title and date, whether it is
 * live, and tabs to its editor, guest list, RSVPs and share screen. Inside the invitation's workspace
 * (app/(shell)/invitations/[id]/layout.tsx) its header and tabs take this place: nothing is drawn.
 */
export function InvitationNav({
  id,
  title,
  dateLine,
  published,
  current,
  actions,
}: {
  id: string;
  title: string;
  dateLine: string;
  published: boolean;
  current: InvitationTab;
  actions?: ReactNode;
}) {
  const { t } = useUi();
  const inWorkspace = useInWorkspace();
  const n = t.shell.invitationNav;
  if (inWorkspace) return null;
  const tabs = [
    { key: 'edit', href: `/app/invitations/${id}/edit`, label: n.edit, icon: <PencilLine /> },
    { key: 'guests', href: `/app/invitations/${id}/guests`, label: n.guests, icon: <Users /> },
    { key: 'responses', href: `/app/invitations/${id}/responses`, label: n.responses, icon: <ListChecks /> },
    { key: 'share', href: `/app/invitations/${id}/share`, label: n.share, icon: <Send /> },
  ] as const;
  return (
    <div className="border-b border-line bg-surface/70">
      <div className="mx-auto max-w-[1200px] px-4 pt-5 sm:px-6">
        <Link
          href="/app/invitations"
          className="inline-flex items-center gap-1 rounded-btn text-[13px] text-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="icon-dir size-4" />
          {n.back}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* the page's own title is its h1; this line says which invitation it belongs to */}
          <p className="font-display text-[22px] leading-tight font-bold tracking-[-0.01em] text-balance">
            <bdi>{title}</bdi>
          </p>
          <Badge variant={published ? 'live' : 'draft'}>
            {published ? t.status.published : t.status.draft}
          </Badge>
          {actions ? <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <p className="mt-0.5 text-[13px] text-muted">{dateLine}</p>
        <nav aria-label={n.label} className="-mb-px mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = tab.key === current;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pt-2 pb-2.5 text-[14px] font-semibold transition-colors [&_svg]:size-4',
                  active ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
