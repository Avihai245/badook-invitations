'use client';

import {
  CalendarCheck2,
  Coins,
  CreditCard,
  Handshake,
  LifeBuoy,
  Mail,
  MessageCircle,
  Rocket,
  ShieldCheck,
  UserPlus,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Card, cn } from '@/components/app';
import type { ActivityItem, ActivityKind } from '../../activity';
import type { AdminDict } from '../../i18n';
import { isStaffRole } from '../../permissions';
import { useAdminUi } from '../AdminUi.client';
import { TimeAgo } from '../core/TimeAgo.client';

const ICONS: Record<ActivityKind, LucideIcon> = {
  signup: UserPlus,
  invitation_created: Mail,
  invitation_published: Rocket,
  rsvp: CalendarCheck2,
  whatsapp_batch: MessageCircle,
  payment: CreditCard,
  credits: Coins,
  ticket_opened: LifeBuoy,
  ticket_reply: LifeBuoy,
  partner_provision: Handshake,
  staff: ShieldCheck,
  team_action: UserRoundCog,
};

/** Where a line leads: its invitation, its user, or its ticket — in the console. */
export function activityHref(item: ActivityItem): string | null {
  if (item.ticketId) return `/app/admin/support/${item.ticketId}`;
  if (item.invitationId && item.kind !== 'payment' && item.kind !== 'signup')
    return `/app/admin/invitations/${item.invitationId}`;
  if (item.userId) return `/app/admin/users/${item.userId}`;
  return null;
}

type Ui = ReturnType<typeof useAdminUi>;

/** One line of the feed in words (no emails, no phone numbers: the lines carry none). */
export function activityText(
  item: ActivityItem,
  ui: Pick<Ui, 't' | 'fmt' | 'plural' | 'number' | 'money' | 'dir'>,
) {
  const { t, fmt, plural, number, money } = ui;
  const arrow = ui.dir === 'rtl' ? '←' : '→';
  const f = t.overview.feed;
  const d = item.detail ?? {};
  const name = item.subject ?? f.noName;
  const person = item.actor ?? f.noName;
  const title = item.subject ?? f.untitled;
  const staff = item.actor ?? f.someone;
  const roleName = (r: unknown) => (isStaffRole(r) ? t.roles[r] : String(r ?? ''));
  switch (item.kind) {
    case 'signup': {
      const src = String(d.source ?? 'signup');
      const via = src.startsWith('partner:') ? f.via.partner : src === 'google' ? f.via.google : f.via.signup;
      return `${fmt(f.signup, { name: person })} · ${via}`;
    }
    case 'invitation_created':
      return item.actor
        ? `${fmt(f.invitationCreated, { title })} · ${item.actor}`
        : fmt(f.invitationCreated, { title });
    case 'invitation_published':
      return fmt(f.invitationPublished, { title });
    case 'rsvp':
      return d.attending === false
        ? fmt(f.rsvpNo, { title })
        : plural(f.rsvpYes, item.amount ?? 0, { title, count: number(item.amount ?? 0) });
    case 'whatsapp_batch': {
      const channel = d.channel === 'table' ? 'table' : d.channel === 'gallery' ? 'gallery' : 'invitation';
      return plural(f.batch[channel], item.amount ?? 0, { title, count: number(item.amount ?? 0) });
    }
    case 'payment': {
      const product = f.products[item.subject ?? ''] ?? item.subject ?? '';
      const line = fmt(d.renewal ? f.renewal : f.payment, { product });
      const who = item.actor ? ` · ${item.actor}` : '';
      return item.amount !== null ? `${line} · ${money(Number(item.amount))}${who}` : `${line}${who}`;
    }
    case 'credits': {
      const n = item.amount ?? 0;
      return fmt(n >= 0 ? f.creditsAdded : f.creditsRemoved, {
        actor: staff,
        count: number(Math.abs(n)),
        name,
      });
    }
    case 'staff': {
      if (d.action === 'staff.remove') return fmt(f.staffRemoved, { actor: staff, name });
      const role =
        d.before && d.before !== d.role
          ? `${roleName(d.before)} ${arrow} ${roleName(d.role)}`
          : roleName(d.role);
      return fmt(d.before ? f.staffChanged : f.staffAdded, { actor: staff, name, role });
    }
    case 'team_action':
      return teamActionText(d, { actor: staff, name, title }, t, fmt);
    case 'ticket_opened':
      return item.actor
        ? `${fmt(f.ticketOpened, { subject: item.subject ?? '' })} · ${item.actor}`
        : fmt(f.ticketOpened, { subject: item.subject ?? '' });
    case 'ticket_reply':
      return fmt(f.ticketReply, { subject: item.subject ?? '' });
    case 'partner_provision':
      return item.subject
        ? `${fmt(f.partnerProvision, { name: person })} · ${item.subject}`
        : fmt(f.partnerProvision, { name: person });
  }
}

/** What the team did to a customer, in words (the feed and the audit log). */
export function teamActionText(
  d: Record<string, unknown>,
  who: { actor: string; name: string; title: string },
  t: AdminDict,
  fmt: Ui['fmt'],
): string {
  const f = t.overview.feed;
  const planName = (p: unknown) => (p === 'business' ? 'Business' : p === 'pro' ? 'Pro' : String(p ?? ''));
  switch (d.action) {
    case 'users.plan_gift':
      return d.plan ? fmt(f.gift, { ...who, plan: planName(d.plan) }) : fmt(f.giftRemoved, who);
    case 'users.discount':
      return d.percent
        ? fmt(f.discount, { ...who, percent: String(d.percent) })
        : fmt(f.discountRemoved, who);
    case 'users.suspend':
      return fmt(f.suspend, who);
    case 'users.restore':
      return fmt(f.restore, who);
    case 'invitations.feature': {
      const feature =
        (t.invitations.features.names as Record<string, string>)[String(d.feature)] ?? String(d.feature);
      return fmt(d.grant === false ? f.featureOff : f.featureOn, { ...who, feature });
    }
    default:
      return fmt(f.teamAction, { actor: who.actor, action: String(d.action ?? '') });
  }
}

/**
 * The live feed: the newest events, each in words with when it happened ("5 minutes ago") and where
 * it leads. It follows the system by itself (the page refreshes when the server says something changed).
 */
export function Feed({ items }: { items: ActivityItem[] }) {
  const ui = useAdminUi();
  const { t } = ui;
  return (
    <Card className="flex min-w-0 flex-col" data-testid="admin-feed">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-bold">{t.overview.feed.title}</h2>
        <p className="text-[12.5px] text-muted">{t.overview.feed.intro}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-[14px] text-muted">{t.overview.feed.empty}</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((item) => {
            const Icon = ICONS[item.kind] ?? ShieldCheck;
            const href = activityHref(item);
            const text = activityText(item, ui);
            const body = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4',
                    item.kind === 'payment'
                      ? 'bg-success-bg text-success'
                      : item.kind === 'staff' || item.kind === 'credits' || item.kind === 'team_action'
                        ? 'bg-info-bg text-info'
                        : 'bg-brand-soft text-brand-deep',
                  )}
                >
                  <Icon strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] leading-[1.45] text-ink [overflow-wrap:anywhere]">
                    {text}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {t.overview.feed.kinds[item.kind]} · <TimeAgo at={item.at} />
                  </span>
                </span>
              </>
            );
            return (
              <li key={item.id} data-kind={item.kind} data-testid="admin-feed-item">
                {href ? (
                  <Link
                    href={href}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-row-hover focus-visible:outline-offset-[-2px]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
