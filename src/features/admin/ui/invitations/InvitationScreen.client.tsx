'use client';

import { ArrowLeft, ArrowRight, ExternalLink, Lock, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, DataTable, Hint, type DataTableColumn } from '@/components/app';
import type { Feature, Package } from '@/features/flags/features';
import { useUi } from '@/lib/i18n/client';
import type { InvitationDetail, MessageKind, StatusCounts } from '../../server/core-db';
import { useAdminUi } from '../AdminUi.client';
import { ActionDialog } from '../core/ActionDialog.client';
import { adminCall } from '../core/post';
import { STATUS_BADGE } from './InvitationsScreen.client';

export interface FeatureItem {
  feature: Feature;
  on: boolean;
  why: 'unavailable' | 'switched_off' | 'plan' | null;
  package: Package;
  /** the team turned it on beyond the plan */
  granted: boolean;
}

const KINDS: readonly MessageKind[] = ['invitation', 'table', 'gallery'];
const STATUSES: readonly (keyof StatusCounts)[] = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
];

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(110px,40%)_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-[13.5px] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * One invitation in the console — read only (it's the customer's): what it is, its owner, its numbers
 * (guests, RSVPs, messages by kind and status, the gallery, versions, visits), and its features: what
 * is in force and why, with the team's grants beyond the plan (invitations.features).
 */
export function InvitationScreen({
  invitation: inv,
  features,
  templateName,
}: {
  invitation: InvitationDetail;
  features: FeatureItem[] | null;
  templateName: string;
}) {
  const { t, fmt, number, date, dateTime, can, dir } = useAdminUi();
  const { t: app } = useUi();
  const I = t.invitations;
  const P = I.page;
  const F = I.features;
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const title = inv.title ?? I.untitled;
  const [pending, setPending] = useState<FeatureItem | null>(null);
  const [open, setOpen] = useState(false);
  const featureName = (f: string) => F.names[f] ?? f;
  const eventName = (e: string) => (app.eventTypes as Record<string, string>)[e] ?? e;
  const messages = KINDS.map((kind) => ({ kind, counts: inv.counts.messages[kind] }));
  const anyMessages = messages.some((m) => STATUSES.some((s) => m.counts[s] > 0));
  const allowed = can('invitations.features');

  const columns: DataTableColumn<FeatureItem>[] = [
    {
      key: 'feature',
      header: F.columns.feature,
      cell: (f) => <span className="font-medium whitespace-nowrap">{featureName(f.feature)}</span>,
    },
    {
      key: 'state',
      header: F.columns.state,
      cell: (f) => (
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap gap-1">
            <Badge variant={f.on ? 'live' : 'draft'}>{f.on ? F.on : F.off}</Badge>
            {f.granted ? <Badge variant="info">{F.granted}</Badge> : null}
          </span>
          {!f.on && f.why ? <span className="text-[12px] text-muted">{F.why[f.why]}</span> : null}
        </span>
      ),
    },
    {
      key: 'package',
      header: F.columns.package,
      cell: (f) => <span className="whitespace-nowrap">{F.packages[f.package]}</span>,
    },
    {
      key: 'action',
      header: F.columns.action,
      cell: (f) => {
        const why = !allowed ? F.noPermission : f.why === 'unavailable' && !f.granted ? F.unavailable : null;
        return (
          <Hint text={f.granted ? F.revokeHelp : F.grantHelp} disabledText={why}>
            <Button
              size="sm"
              variant={f.granted ? 'ghost' : 'secondary'}
              disabled={why !== null}
              data-testid={`admin-feature-${f.feature}`}
              onClick={() => {
                setPending(f);
                setOpen(true);
              }}
            >
              {f.granted ? F.revoke : F.grant}
            </Button>
          </Hint>
        );
      },
    },
  ];

  return (
    <>
      <Link
        href="/app/admin/invitations"
        className="mb-3 inline-flex items-center gap-1.5 rounded-btn text-[13px] font-medium text-muted hover:text-ink"
      >
        <Back aria-hidden className="size-4" />
        {P.back}
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-[24px] font-bold tracking-tight [overflow-wrap:anywhere] lg:text-[28px]"
            data-testid="admin-invitation-title"
          >
            {title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
            <Badge variant={STATUS_BADGE[inv.status]}>{I.status[inv.status]}</Badge>
            <span>{eventName(inv.eventType)}</span>
            {inv.eventDate ? (
              <>
                <span aria-hidden>·</span>
                <span>{date(inv.eventDate)}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inv.status === 'published' ? (
            <Hint text={P.openPublicHelp}>
              <Button asChild variant="secondary" icon={<ExternalLink />}>
                <a
                  href={`/i/${inv.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="admin-invitation-public"
                >
                  {P.openPublic}
                </a>
              </Button>
            </Hint>
          ) : null}
          <Hint text={P.openOwnerHelp}>
            <Button asChild variant="secondary" icon={<UserRound />}>
              <Link href={`/app/admin/users/${inv.owner.id}`}>{P.openOwner}</Link>
            </Button>
          </Hint>
        </div>
      </div>
      <p className="mb-4 flex items-start gap-2 rounded-[12px] border border-line bg-subtle px-4 py-3 text-[13.5px] text-muted">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        {inv.status === 'published' ? P.readOnly : `${P.readOnly} ${P.notPublished}`}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="md" className="min-w-0" data-testid="admin-invitation-summary">
          <h2 className="mb-2 text-[15px] font-bold">{P.summary}</h2>
          <dl>
            <Row label={P.address}>
              <span dir="ltr">/i/{inv.slug}</span>
            </Row>
            <Row label={P.openOwner}>
              <Link href={`/app/admin/users/${inv.owner.id}`} className="underline-offset-2 hover:underline">
                {inv.owner.name ?? t.users.noName}
              </Link>
              <span dir="ltr" className="block text-[12.5px] text-muted">
                {inv.owner.email}
              </span>
            </Row>
            <Row label={P.eventType}>{eventName(inv.eventType)}</Row>
            <Row label={P.date}>
              {inv.eventDate
                ? `${date(inv.eventDate)}${inv.startTime ? ` · ${inv.startTime}` : ''}`
                : I.noDate}
            </Row>
            <Row label={P.template}>{templateName}</Row>
            <Row label={P.languages}>
              {(inv.locales ?? []).map((l) => I.languages[l] ?? l).join(' · ') || '—'}
            </Row>
            <Row label={P.created}>{dateTime(inv.createdAt)}</Row>
            <Row label={P.firstPublished}>
              {inv.firstPublishedAt ? dateTime(inv.firstPublishedAt) : I.never}
            </Row>
            {inv.publishedAt && inv.publishedAt !== inv.firstPublishedAt ? (
              <Row label={P.lastPublished}>
                {dateTime(inv.publishedAt)} · {P.version} {number(inv.version)}
              </Row>
            ) : null}
            {inv.unpublishedChanges ? <Row label={P.version}>{P.unpublished}</Row> : null}
            {inv.source ? (
              <Row label={P.saveTheDate}>
                <Link href={`/app/admin/invitations/${inv.source.id}`} className="underline">
                  {inv.source.title ?? I.untitled}
                </Link>
              </Row>
            ) : null}
          </dl>
        </Card>

        <Card padding="md" className="min-w-0" data-testid="admin-invitation-numbers">
          <h2 className="mb-2 text-[15px] font-bold">{P.numbers}</h2>
          <dl>
            <Row label={P.guests}>
              <span className="tabular-nums">{number(inv.counts.guests)}</span>
              <span className="ms-2 text-[12.5px] text-muted">
                {fmt(P.withPhone, { n: number(inv.counts.guestsWithPhone) })}
              </span>
            </Row>
            <Row label={P.rsvps}>
              <span className="tabular-nums" data-testid="admin-invitation-rsvps">
                {fmt(I.rsvpsCell, {
                  yes: number(inv.counts.rsvps.yes),
                  no: number(inv.counts.rsvps.no),
                  people: number(inv.counts.rsvps.people),
                })}
              </span>
            </Row>
            <Row label={P.gallery}>
              {inv.counts.gallery.enabled === null
                ? P.galleryOff
                : `${fmt(P.galleryLine, {
                    items: number(inv.counts.gallery.items),
                    published: number(inv.counts.gallery.published),
                  })}${inv.counts.gallery.enabled ? '' : ` · ${P.galleryPaused}`}`}
            </Row>
            <Row label={P.versions}>
              {fmt(P.versionsLine, {
                publishes: number(inv.counts.versions.publishes),
                saves: number(inv.counts.versions.saves),
              })}
            </Row>
            <Row label={P.visits}>
              {fmt(P.visitsLine, {
                total: number(inv.counts.visits.total),
                d30: number(inv.counts.visits.d30),
              })}
            </Row>
          </dl>
        </Card>
      </div>

      <Card padding="md" className="mt-4 min-w-0" data-testid="admin-invitation-messages">
        <h2 className="mb-2 text-[15px] font-bold">{P.messages}</h2>
        {anyMessages ? (
          <div className="-mx-[18px] overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">{P.messages}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-b border-line bg-canvas px-3 py-2.5 text-start font-semibold text-muted"
                  >
                    {P.kind}
                  </th>
                  {STATUSES.map((s) => (
                    <th
                      key={s}
                      scope="col"
                      className="border-b border-line bg-canvas px-3 py-2.5 text-center font-semibold whitespace-nowrap text-muted"
                    >
                      {P.statuses[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.kind}>
                    <th
                      scope="row"
                      className="border-b border-line px-3 py-2.5 text-start font-medium whitespace-nowrap"
                    >
                      {P.kinds[m.kind]}
                    </th>
                    {STATUSES.map((s) => (
                      <td key={s} className="border-b border-line px-3 py-2.5 text-center tabular-nums">
                        {number(m.counts[s])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-[13.5px] text-muted">{P.noMessages}</p>
        )}
      </Card>

      {features ? (
        <Card padding="md" className="mt-4 min-w-0" data-testid="admin-invitation-features">
          <h2 className="text-[15px] font-bold">{F.title}</h2>
          <p className="mb-3 text-[13px] text-muted">{F.intro}</p>
          <DataTable
            caption={F.title}
            columns={columns}
            rows={features}
            getRowKey={(f) => f.feature}
            rowData={(f) => ({ 'data-feature': f.feature, 'data-on': String(f.on) })}
            className="-mx-[18px]"
          />
        </Card>
      ) : null}

      <ActionDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
        }}
        testId="admin-feature-dialog"
        title={
          pending
            ? fmt(pending.granted ? F.revokeTitle : F.grantTitle, { feature: featureName(pending.feature) })
            : ''
        }
        description={
          pending
            ? fmt(pending.granted ? F.revokeBody : F.grantBody, {
                feature: featureName(pending.feature),
                title,
              })
            : ''
        }
        confirmLabel={pending?.granted ? F.revoke : F.grant}
        confirmHelp={pending?.granted ? F.revokeHelp : F.grantHelp}
        confirmVariant={pending?.granted ? 'danger' : 'primary'}
        errors={I.errors}
        success={
          pending
            ? fmt(pending.granted ? F.revokedToast : F.grantedToast, {
                feature: featureName(pending.feature),
              })
            : ''
        }
        onConfirm={(reason) =>
          adminCall(`/api/admin/invitations/${inv.id}/features`, {
            feature: pending!.feature,
            grant: !pending!.granted,
            reason,
          })
        }
      />
    </>
  );
}
