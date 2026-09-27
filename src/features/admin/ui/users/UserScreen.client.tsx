'use client';

import { ArrowLeft, ArrowRight, ExternalLink, Gift, Percent, ShieldCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Card, DataTable, Hint, type DataTableColumn } from '@/components/app';
import type { UserDetail } from '../../server/core-db';
import { useAdminUi } from '../AdminUi.client';
import { describeAudit } from '../audit/describe';
import { lastDayOf } from '../core/dates';
import { anyMessages, MessagesTable } from '../core/MessagesTable.client';
import { ScrollArea } from '../core/ScrollArea.client';
import { TimeAgo } from '../core/TimeAgo.client';
import { STATUS_BADGE } from '../invitations/InvitationsScreen.client';
import { planLabel, sourceLabel } from './labels';
import { UserActions } from './UserActions.client';

type Invitation = UserDetail['invitations'][number];
type LedgerRow = UserDetail['credits']['ledger'][number];

/** A labelled value of the details (a description list's row). */
function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(110px,40%)_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-[13.5px] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <Card padding="md" className="min-w-0" data-testid={testId}>
      <h2 className="mb-2 text-[15px] font-bold">{title}</h2>
      {children}
    </Card>
  );
}

/**
 * One customer: who they are and where they came from, their plan and billing, credits with every
 * movement (the team's: who and why), invitations, messages, payments, what the team did about them —
 * and the actions the staff member's role allows. Badook Events' part (where the account came from)
 * and the support tickets come from their areas (`partner`, `tickets`).
 */
export function UserScreen({
  user,
  self,
  today,
  partner,
  tickets,
}: {
  user: UserDetail;
  self: boolean;
  today: string;
  partner: ReactNode;
  tickets: ReactNode;
}) {
  const ui = useAdminUi();
  const { t, fmt, number, money, date, dateTime, can, dir } = ui;
  const u = t.users;
  const P = u.page;
  const name = user.name ?? u.noName;
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const plan = user.plan;
  const lastGiftDay = plan.gift && plan.renewsAt ? date(lastDayOf(plan.renewsAt)) : null;
  // a gift in force (after its last day the account is on Free, the gift stays on record)
  const giftNow = plan.gift && plan.effective !== 'free';

  const invitationColumns: DataTableColumn<Invitation>[] = [
    {
      key: 'title',
      header: t.invitations.columns.invitation,
      cell: (i) => (
        <span className="flex min-w-[150px] flex-col">
          <Link
            href={`/app/admin/invitations/${i.id}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {i.title ?? t.invitations.untitled}
          </Link>
          <span dir="ltr" className="text-start text-[12px] text-muted">
            /i/{i.slug}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t.invitations.columns.status,
      cell: (i) => <Badge variant={STATUS_BADGE[i.status]}>{t.invitations.status[i.status]}</Badge>,
    },
    {
      key: 'event',
      header: t.invitations.columns.event,
      cell: (i) => (
        <span className="whitespace-nowrap">{i.eventDate ? date(i.eventDate) : t.invitations.noDate}</span>
      ),
    },
    { key: 'guests', header: t.invitations.columns.guests, numeric: true, cell: (i) => number(i.guests) },
    {
      key: 'rsvps',
      header: t.invitations.columns.rsvps,
      cell: (i) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmt(t.invitations.rsvpsCell, {
            yes: number(i.rsvps.yes),
            no: number(i.rsvps.no),
            people: number(i.rsvps.people),
          })}
        </span>
      ),
    },
    {
      key: 'messages',
      header: t.invitations.columns.whatsapp,
      numeric: true,
      cell: (i) => number(i.messages),
    },
    {
      key: 'created',
      header: t.invitations.columns.created,
      cell: (i) => <span className="whitespace-nowrap">{date(i.createdAt)}</span>,
    },
    {
      key: 'public',
      header: <span className="sr-only">{t.invitations.page.openPublic}</span>,
      cell: (i) =>
        i.status === 'published' ? (
          <Hint text={t.invitations.page.openPublicHelp}>
            <a
              href={`/i/${i.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`${t.invitations.page.openPublic}: ${i.title ?? i.slug}`}
              className="inline-grid size-8 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink"
            >
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </Hint>
        ) : null,
    },
  ];

  const ledgerColumns: DataTableColumn<LedgerRow>[] = [
    {
      key: 'when',
      header: P.when,
      cell: (l) => <span className="whitespace-nowrap">{dateTime(l.at)}</span>,
    },
    {
      key: 'change',
      header: P.change,
      numeric: true,
      cell: (l) => (
        <span dir="ltr" className={l.delta > 0 ? 'font-semibold text-success' : 'text-ink'}>
          {l.delta > 0 ? `+${number(l.delta)}` : number(l.delta)}
        </span>
      ),
    },
    {
      key: 'what',
      header: P.what,
      cell: (l) => (
        <span className="flex min-w-[180px] flex-col">
          <span>{P.reasons[l.reason] ?? l.reason}</span>
          {l.by ? (
            <span className="text-[12px] text-muted">
              {fmt(P.byLine, { name: l.by.name ?? l.by.email, reason: l.by.reason ?? '' })}
            </span>
          ) : null}
          {l.invitationId ? (
            <Link
              href={`/app/admin/invitations/${l.invitationId}`}
              className="text-[12px] text-muted underline"
            >
              {t.invitations.columns.invitation}
            </Link>
          ) : null}
        </span>
      ),
    },
  ];

  const payments = [
    ...user.payments.checkouts.map((k) => ({
      key: k.id,
      label: t.overview.feed.products[k.product] ?? k.product,
      renewal: false,
      amount: k.amount,
      status: k.status as string,
      at: k.completedAt ?? k.createdAt,
    })),
    ...user.payments.renewals.map((r, i) => ({
      key: `renewal-${i}`,
      label: r.product ? (t.overview.feed.products[r.product] ?? r.product) : P.paymentRenewal,
      renewal: true,
      amount: r.amount,
      status: r.status as string,
      at: r.at,
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <>
      <Link
        href="/app/admin/users"
        className="mb-3 inline-flex items-center gap-1.5 rounded-btn text-[13px] font-medium text-muted hover:text-ink"
      >
        <Back aria-hidden className="size-4" />
        {P.back}
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-[24px] font-bold tracking-tight [overflow-wrap:anywhere] lg:text-[28px]"
            data-testid="admin-user-name"
          >
            {name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
            <span>{sourceLabel(t, user.source)}</span>
            <span aria-hidden>·</span>
            <span>
              {P.joined} {date(user.createdAt)}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.staff ? (
              <Badge variant="info" icon={<ShieldCheck />}>
                {fmt(u.staffBadge, { role: t.roles[user.staff.role] })}
              </Badge>
            ) : null}
            {user.suspended ? (
              <Badge variant="danger" icon={<UserX />} data-testid="admin-user-suspended">
                {u.suspended}
              </Badge>
            ) : null}
            {giftNow ? (
              <Badge variant="live" icon={<Gift />}>
                {u.gift}
              </Badge>
            ) : null}
            {user.discount?.active ? (
              <Badge variant="warning" icon={<Percent />}>
                {fmt(u.discountBadge, { percent: user.discount.percent })}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={P.identity} testId="admin-user-identity">
            <dl>
              <Row label={P.email}>
                <span dir="ltr" data-testid="admin-user-email">
                  {user.email}
                </span>
                {user.masked ? (
                  <span className="ms-2 text-[12px] text-muted">({t.common.maskedHelp})</span>
                ) : null}
              </Row>
              <Row label={P.phone}>
                {user.phone ? (
                  <span dir="ltr" data-testid="admin-user-phone">
                    {user.phone}
                  </span>
                ) : (
                  <span className="text-muted">{u.noPhone}</span>
                )}
              </Row>
              <Row label={P.source}>
                {sourceLabel(t, user.source)}
                {user.venue ? (
                  <span className="block text-[12.5px] text-muted">
                    {P.venue}: {user.venue.name}
                    {user.venue.address ? ` · ${user.venue.address}` : ''}
                  </span>
                ) : null}
                {user.externalId ? (
                  <span className="block text-[12.5px] text-muted">
                    {P.externalId}: <span dir="ltr">{user.externalId}</span>
                  </span>
                ) : null}
              </Row>
              <Row label={P.signIn}>{user.providers.map((p) => P.providers[p] ?? p).join(' · ')}</Row>
              <Row label={P.joined}>{dateTime(user.createdAt)}</Row>
              <Row label={P.lastSignIn}>
                {user.lastSignInAt ? <TimeAgo at={user.lastSignInAt} /> : t.kit.never}
              </Row>
              <Row label={P.confirmed}>{user.confirmedAt ? date(user.confirmedAt) : P.notConfirmed}</Row>
              {user.staff ? (
                <Row label={P.staff}>
                  {fmt(P.staffLine, {
                    role: t.roles[user.staff.role],
                    source: P.staffSources[user.staff.source],
                  })}
                  {user.platformOwner ? (
                    <span className="block text-[12.5px] text-muted">{P.platformOwner}</span>
                  ) : null}
                </Row>
              ) : null}
              {user.suspended ? (
                <Row label={u.suspended}>
                  <span className="text-danger">{P.suspendedLine}</span>
                </Row>
              ) : null}
            </dl>
          </Section>

          {partner}

          <Section title={P.plan} testId="admin-user-plan">
            <dl>
              <Row label={P.planInForce}>
                <span className="font-semibold" data-testid="admin-user-effective-plan">
                  {planLabel(t, plan.effective)}
                </span>
              </Row>
              {plan.plan !== 'free' ? (
                <>
                  <Row label={P.planStored}>
                    {planLabel(t, plan.plan)} ·{' '}
                    {plan.gift ? (giftNow ? u.gift : u.giftEnded) : u.planStatus[plan.status]}
                  </Row>
                  {plan.renewsAt ? (
                    <Row label={plan.gift || plan.status === 'canceled' ? P.endsAt : P.renewsAt}>
                      {plan.gift && lastGiftDay
                        ? fmt(P.giftLine, { date: lastGiftDay })
                        : date(plan.renewsAt)}
                    </Row>
                  ) : null}
                  {can('finance.view') && plan.price !== null && !plan.gift ? (
                    <Row label={P.price}>{money(Number(plan.price))}</Row>
                  ) : null}
                </>
              ) : null}
              <Row label={P.provider}>
                {P.providers2[plan.provider ?? 'none'] ?? plan.provider}
                <span className="block text-[12.5px] text-muted">
                  {plan.hasSubscription ? P.subscription : P.noSubscription}
                </span>
              </Row>
              <Row label={P.discount}>
                {user.discount ? (
                  <span data-testid="admin-user-discount">
                    {fmt(P.discountLine, {
                      percent: number(user.discount.percent),
                      until: user.discount.until
                        ? fmt(P.discountUntil, { date: date(lastDayOf(user.discount.until)) })
                        : P.discountNoEnd,
                    })}{' '}
                    · {P.discountSources[user.discount.source] ?? user.discount.source}
                    {!user.discount.active ? ` · ${P.discountExpired}` : ''}
                    {user.discount.note ? (
                      <span className="block text-[12.5px] text-muted">
                        {P.note}: {user.discount.note}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted">{P.noDiscount}</span>
                )}
              </Row>
            </dl>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <UserActions user={user} self={self} today={today} />
          <Card padding="md" className="min-w-0">
            <p className="text-[13px] text-muted">{P.balance}</p>
            <p
              className="text-[30px] leading-[1.35] font-bold tracking-[-0.02em]"
              data-testid="admin-user-credits"
            >
              {number(user.credits.balance)}
            </p>
            <p className="text-[12.5px] text-muted">{P.credits}</p>
          </Card>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Section title={P.ledger} testId="admin-user-ledger">
          {user.credits.ledger.length ? (
            <ScrollArea label={P.ledger} className="-mx-[18px]">
              <DataTable
                caption={P.ledger}
                columns={ledgerColumns}
                rows={user.credits.ledger}
                getRowKey={(l) => l.id}
              />
            </ScrollArea>
          ) : (
            <p className="py-2 text-[13.5px] text-muted">{P.ledgerEmpty}</p>
          )}
        </Section>

        <Section title={P.invitations} testId="admin-user-invitations">
          {user.invitations.length ? (
            <ScrollArea label={P.invitations} className="-mx-[18px]">
              <DataTable
                caption={P.invitations}
                columns={invitationColumns}
                rows={user.invitations}
                getRowKey={(i) => i.id}
              />
            </ScrollArea>
          ) : (
            <p className="py-2 text-[13.5px] text-muted">{P.invitationsEmpty}</p>
          )}
        </Section>

        <Section title={P.messages} testId="admin-user-messages">
          {anyMessages(user.messages) ? (
            <MessagesTable counts={user.messages} caption={P.messages} className="-mx-[18px]" />
          ) : (
            <p className="py-2 text-[13.5px] text-muted">{P.messagesEmpty}</p>
          )}
        </Section>

        <Section title={P.payments} testId="admin-user-payments">
          {payments.length ? (
            <>
              <ul className="divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-medium">{p.label}</span>
                      <span className="block text-[12px] text-muted">
                        {p.renewal ? `${P.paymentRenewal} · ` : ''}
                        {date(p.at)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {p.amount !== null ? (
                        <span className="tabular-nums">{money(Number(p.amount))}</span>
                      ) : null}
                      <Badge
                        variant={p.status === 'paid' ? 'live' : p.status === 'failed' ? 'danger' : 'neutral'}
                      >
                        {P.paymentStatuses[p.status] ?? p.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
              {!can('finance.view') ? <p className="mt-2 text-[12px] text-muted">{P.amountHidden}</p> : null}
            </>
          ) : (
            <p className="py-2 text-[13.5px] text-muted">{P.paymentsEmpty}</p>
          )}
        </Section>

        {tickets}

        {user.audit ? (
          <Section title={P.audit} testId="admin-user-audit">
            {user.audit.length ? (
              <>
                <ol className="divide-y divide-line">
                  {user.audit.map((row) => {
                    const line = describeAudit(row, ui);
                    return (
                      <li key={row.id} className="py-2.5">
                        <p className="text-[13.5px]">{line.text}</p>
                        {line.detail ? <p className="text-[12.5px] text-muted">{line.detail}</p> : null}
                        {line.reason ? (
                          <p className="text-[12.5px] text-muted">
                            {fmt(t.audit.reason, { reason: line.reason })}
                          </p>
                        ) : null}
                        <p className="text-[12px] text-muted">
                          <TimeAgo at={row.at} />
                        </p>
                      </li>
                    );
                  })}
                </ol>
                <Link
                  href={`/app/admin/audit?targetType=user&targetId=${user.id}`}
                  className="mt-2 inline-block text-[13px] font-medium underline"
                >
                  {P.auditAll}
                </Link>
              </>
            ) : (
              <p className="py-2 text-[13.5px] text-muted">{P.auditEmpty}</p>
            )}
          </Section>
        ) : null}
      </div>
    </>
  );
}
