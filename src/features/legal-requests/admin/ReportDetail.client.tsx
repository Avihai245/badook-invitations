'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Badge, Button, Card, Field, Textarea } from '@/components/app';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import { ConfirmDialog } from '@/features/support/tickets/admin/shared';
import { LEGAL_REQUESTS, NOTE_REQUIRED_ACTIONS, type ReportAction } from '../config';
import type { AdminReport } from '../types';
import { Fact, Notices, Timeline, Typed, type NoticeState } from './parts';
import { useLegalAction, type AdminStrings } from './shared';

const WITH_DIALOG: readonly ReportAction[] = ['hide', 'restore', 'remove', 'keep', 'dismiss', 'close'];
const RESOLVED = ['actioned', 'dismissed', 'closed'];

/**
 * One report: what was reported and by whom (contact details only for roles with users.pii — the database
 * masks them), the item's state, the delivery of the notices (NOT sent shown plainly), the decisions
 * (each says what it will do first; removing for good only appears for roles that may) and the timeline.
 */
export function ReportDetail({ s, report: r, back }: { s: AdminStrings; report: AdminReport; back: string }) {
  const { fmt, dateTime, can } = useAdminUi();
  const act = useLegalAction(s);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [confirm, setConfirm] = useState<ReportAction | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const mayAct = can('support.reply');
  const resolved = RESOLVED.includes(r.status);
  const item = r.item;
  const itemLive = !!r.itemId && !!item && !item.deleted;
  // hidden because of a report: the host cannot show it again, only staff (restore, keep, dismiss) can
  const held = itemLive && item.status === 'hidden' && item.reason === 'report';

  const actions: ReportAction[] = [
    r.status === 'new' ? 'review' : null,
    itemLive && item.status !== 'hidden' ? 'hide' : null,
    itemLive && item.status === 'hidden' && r.priorStatus ? 'restore' : null,
    itemLive && can('users.suspend') ? 'remove' : null,
    !resolved ? 'keep' : null,
    !resolved ? 'dismiss' : null,
    !resolved ? 'close' : null,
    'note',
  ].filter((a): a is ReportAction => a !== null);

  const run = async (action: ReportAction): Promise<boolean> => {
    const done = await act(`/api/admin/legal/reports/${r.id}`, { action, note });
    if (done) setNote('');
    return done;
  };
  const choose = (action: ReportAction) => {
    if (
      (!note.trim() && (NOTE_REQUIRED_ACTIONS as readonly string[]).includes(action)) ||
      (action === 'note' && !note.trim())
    ) {
      setNoteError(true);
      field.current?.focus();
      return;
    }
    setNoteError(false);
    if (WITH_DIALOG.includes(action)) setConfirm(action);
    else void run(action);
  };

  const notices: { label: string; state: NoticeState }[] = [
    {
      label: s.notices.team,
      state: r.teamNotifiedAt ? { kind: 'sent', at: r.teamNotifiedAt } : { kind: 'notSent' },
    },
    {
      label: s.notices.host,
      state: !r.invitationId
        ? { kind: 'text', text: s.notices.notApplicable }
        : r.hostNotifiedAt
          ? { kind: 'sent', at: r.hostNotifiedAt }
          : { kind: 'notSent' },
    },
    {
      label: s.notices.reporter,
      state: !r.canReply
        ? { kind: 'text', text: s.notices.noEmail }
        : r.reporterNotifiedAt
          ? { kind: 'sent', at: r.reporterNotifiedAt }
          : resolved
            ? { kind: 'notSent' }
            : { kind: 'text', text: s.notices.afterOutcome },
    },
  ];

  const dialog = (action: ReportAction) => ({
    title: s.actions[action],
    body: (
      <>
        {s.actions.confirm[action as 'hide']}
        {action === 'keep' || action === 'dismiss' || action === 'close' || action === 'remove' ? (
          <> {r.canReply ? s.actions.confirm.reporterMail : s.actions.confirm.reporterNoMail}</>
        ) : null}
      </>
    ),
  });

  return (
    <div className="flex flex-col gap-4" data-testid="report-detail">
      <Link href={back} className="inline-flex items-center gap-1 text-[13px] font-medium lg:hidden">
        <ChevronLeft aria-hidden className="size-4 icon-dir" />
        {s.detail.back}
      </Link>
      <Card padding="lg" asChild>
        <section aria-labelledby="report-title">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="report-title" className="text-[18px] font-bold tabular-nums">
              {fmt(s.detail.report, { n: r.number })}
            </h2>
            {r.urgent ? <Badge variant="danger">{s.badges.urgent}</Badge> : null}
            {r.intimate ? <Badge variant="danger">{s.badges.intimate}</Badge> : null}
            <Badge variant={resolved ? 'neutral' : 'warning'}>{s.status.report[r.status]}</Badge>
            {r.resolution ? <Badge variant="info">{s.resolution[r.resolution]}</Badge> : null}
            {held ? (
              <Badge variant="warning" data-testid="report-held">
                {s.badges.held}
              </Badge>
            ) : r.hiddenByReport ? (
              <Badge variant="warning">{s.badges.hiddenByReport}</Badge>
            ) : null}
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Fact label={s.detail.category}>{s.category[r.category]}</Fact>
            <Fact label={s.detail.role}>{s.role[r.role]}</Fact>
            <Fact label={s.detail.surface}>{s.surface[r.surface]}</Fact>
            <Fact label={s.detail.created}>{dateTime(r.createdAt)}</Fact>
            {r.resolvedAt ? <Fact label={s.detail.resolved}>{dateTime(r.resolvedAt)}</Fact> : null}
          </dl>
          <h3 className="mt-4 mb-1 text-[13px] font-semibold">{s.detail.description}</h3>
          <Typed>{r.description}</Typed>
          {r.reference ? (
            <>
              <h3 className="mt-3 mb-1 text-[13px] font-semibold">{s.detail.reference}</h3>
              <Typed>{r.reference}</Typed>
            </>
          ) : null}
          {r.resolutionNote ? (
            <>
              <h3 className="mt-3 mb-1 text-[13px] font-semibold">{s.detail.resolutionNote}</h3>
              <Typed>{r.resolutionNote}</Typed>
            </>
          ) : null}
        </section>
      </Card>

      <Card padding="md" asChild>
        <section aria-labelledby="report-item">
          <h3 id="report-item" className="text-[14px] font-bold">
            {s.detail.item}
          </h3>
          {item ? (
            <p className="mt-1 text-[14px]">
              {item.deleted
                ? s.detail.itemDeleted
                : fmt(s.detail.itemStatus, {
                    status: `${item.status}${item.reason ? ` (${item.reason})` : ''}`,
                  })}
            </p>
          ) : (
            <p className="mt-1 text-[14px] text-muted">{s.detail.itemNone}</p>
          )}
          {held ? (
            <p
              role="status"
              data-testid="report-held-note"
              className="mt-2 rounded-[10px] border border-warning/40 bg-warning-bg px-3 py-2 text-[13px]"
            >
              {s.detail.held}
            </p>
          ) : null}
          {r.invitationId ? (
            <Link
              href={`/app/admin/invitations/${r.invitationId}`}
              className="mt-1 inline-block text-[13px] font-medium underline underline-offset-2"
            >
              {s.detail.invitation}
            </Link>
          ) : null}
        </section>
      </Card>

      <Card padding="md" asChild>
        <section aria-labelledby="report-contact">
          <h3 id="report-contact" className="text-[14px] font-bold">
            {s.detail.contact}
          </h3>
          {r.canReply && !r.reporterEmail ? (
            <p className="mt-1 text-[13px] text-muted">{s.detail.masked}</p>
          ) : !r.canReply && !r.reporterName && !r.reporterPhone ? (
            <p className="mt-1 text-[13px] text-muted">{s.detail.none}</p>
          ) : (
            <dl className="mt-2 grid gap-3 sm:grid-cols-3">
              <Fact label={s.detail.name}>{r.reporterName ?? s.detail.none}</Fact>
              <Fact label={s.detail.email}>
                <span dir="ltr">{r.reporterEmail ?? s.detail.none}</span>
              </Fact>
              <Fact label={s.detail.phone}>
                <span dir="ltr">{r.reporterPhone ?? s.detail.none}</span>
              </Fact>
            </dl>
          )}
        </section>
      </Card>

      <Notices s={s} rows={notices} />

      <Card padding="md" asChild>
        <section aria-labelledby="report-actions">
          <h3 id="report-actions" className="text-[14px] font-bold">
            {s.actions.title}
          </h3>
          {mayAct ? (
            <>
              <Field
                label={s.actions.noteLabel}
                help={s.actions.noteHelp}
                error={noteError ? s.actions.noteRequired : undefined}
                counter={{ value: note.length, max: LEGAL_REQUESTS.reportNote }}
                className="mt-2"
              >
                <Textarea
                  ref={field}
                  rows={3}
                  value={note}
                  maxLength={LEGAL_REQUESTS.reportNote}
                  onChange={(e) => (setNote(e.target.value), setNoteError(false))}
                  data-testid="report-note"
                />
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <Button
                    key={a}
                    variant={
                      a === 'remove' ? 'danger' : a === 'review' || a === 'note' ? 'secondary' : 'secondary'
                    }
                    size="sm"
                    onClick={() => choose(a)}
                    data-testid={`report-action-${a}`}
                  >
                    {s.actions[a]}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-muted">{s.actions.noPermission}</p>
          )}
        </section>
      </Card>

      <Timeline s={s} events={r.events} />

      {confirm ? (
        <ConfirmDialog
          {...dialog(confirm)}
          confirm={s.actions.confirm.confirm}
          danger={confirm === 'remove'}
          onConfirm={() => run(confirm)}
          onClose={() => setConfirm(null)}
          testId="report-confirm"
        />
      ) : null}
    </div>
  );
}
