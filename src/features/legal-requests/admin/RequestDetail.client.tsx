'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Badge, Button, Card, Checkbox, Field, Textarea } from '@/components/app';
import { useAdminUi } from '@/features/admin/ui/AdminUi.client';
import { ConfirmDialog } from '@/features/support/tickets/admin/shared';
import { isFinalRequestStatus, LEGAL_REQUESTS, REQUEST_SET_STATUSES, type RequestStatus } from '../config';
import type { AdminRequest } from '../types';
import { Fact, Notices, Timeline, Typed, type NoticeState } from './parts';
import { useLegalAction, type AdminStrings } from './shared';

/**
 * One privacy request: what is asked, by whom (contact details only for roles with users.pii), the due
 * date (overdue marked), the delivery of the notices (NOT sent shown plainly), the status (a final one
 * needs a note and tells the requester; the note goes in that email only if ticked) and the timeline.
 */
export function RequestDetail({
  s,
  request: r,
  back,
}: {
  s: AdminStrings;
  request: AdminRequest;
  back: string;
}) {
  const { fmt, dateTime, can } = useAdminUi();
  const act = useLegalAction(s);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [includeNote, setIncludeNote] = useState(false);
  const [confirm, setConfirm] = useState<RequestStatus | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const mayAct = can('support.reply');
  const open = ['new', 'verifying', 'in_progress'].includes(r.status);

  const choose = (status: RequestStatus) => {
    if (isFinalRequestStatus(status) && !note.trim()) {
      setNoteError(true);
      field.current?.focus();
      return;
    }
    setNoteError(false);
    setConfirm(status);
  };
  const run = async (status: RequestStatus) => {
    const done = await act(`/api/admin/legal/requests/${r.id}`, { status, note, includeNote });
    if (done) {
      setNote('');
      setIncludeNote(false);
    }
    return done;
  };

  const notices: { label: string; state: NoticeState }[] = [
    {
      label: s.notices.team,
      state: r.teamNotifiedAt ? { kind: 'sent', at: r.teamNotifiedAt } : { kind: 'notSent' },
    },
    {
      label: s.notices.requester,
      state: r.requesterNotifiedAt ? { kind: 'sent', at: r.requesterNotifiedAt } : { kind: 'notSent' },
    },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="request-detail">
      <Link href={back} className="inline-flex items-center gap-1 text-[13px] font-medium lg:hidden">
        <ChevronLeft aria-hidden className="size-4 icon-dir" />
        {s.detail.back}
      </Link>
      <Card padding="lg" asChild>
        <section aria-labelledby="request-title">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="request-title" className="text-[18px] font-bold tabular-nums">
              {fmt(s.detail.request, { n: r.number })}
            </h2>
            {r.overdue ? <Badge variant="danger">{s.badges.overdue}</Badge> : null}
            <Badge variant={open ? 'warning' : 'neutral'}>{s.status.request[r.status]}</Badge>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Fact label={s.detail.kind}>{s.kind[r.kind]}</Fact>
            <Fact label={s.detail.relation}>{s.relation[r.relation]}</Fact>
            <Fact label={s.detail.created}>{dateTime(r.createdAt)}</Fact>
            <Fact label={s.detail.due}>{dateTime(r.dueAt)}</Fact>
            {r.resolvedAt ? <Fact label={s.detail.resolved}>{dateTime(r.resolvedAt)}</Fact> : null}
          </dl>
          <h3 className="mt-4 mb-1 text-[13px] font-semibold">{s.detail.description}</h3>
          <Typed>{r.details}</Typed>
          {r.reference ? (
            <>
              <h3 className="mt-3 mb-1 text-[13px] font-semibold">{s.detail.reference}</h3>
              <Typed>{r.reference}</Typed>
            </>
          ) : null}
          {r.decisionNote ? (
            <>
              <h3 className="mt-3 mb-1 text-[13px] font-semibold">{s.detail.resolutionNote}</h3>
              <Typed>{r.decisionNote}</Typed>
            </>
          ) : null}
        </section>
      </Card>

      <Card padding="md" asChild>
        <section aria-labelledby="request-contact">
          <h3 id="request-contact" className="text-[14px] font-bold">
            {s.detail.contact}
          </h3>
          {r.email ? (
            <dl className="mt-2 grid gap-3 sm:grid-cols-3">
              <Fact label={s.detail.name}>{r.name}</Fact>
              <Fact label={s.detail.email}>
                <span dir="ltr">{r.email}</span>
              </Fact>
              <Fact label={s.detail.phone}>
                <span dir="ltr">{r.phone ?? s.detail.none}</span>
              </Fact>
            </dl>
          ) : (
            <p className="mt-1 text-[13px] text-muted">{s.detail.masked}</p>
          )}
        </section>
      </Card>

      <Notices s={s} rows={notices} />

      <Card padding="md" asChild>
        <section aria-labelledby="request-actions">
          <h3 id="request-actions" className="text-[14px] font-bold">
            {s.request.title}
          </h3>
          {mayAct ? (
            <>
              <Field
                label={s.request.noteLabel}
                help={s.request.noteHelp}
                error={noteError ? s.actions.noteRequired : undefined}
                counter={{ value: note.length, max: LEGAL_REQUESTS.requestNote }}
                className="mt-2"
              >
                <Textarea
                  ref={field}
                  rows={3}
                  value={note}
                  maxLength={LEGAL_REQUESTS.requestNote}
                  onChange={(e) => (setNote(e.target.value), setNoteError(false))}
                  data-testid="request-note"
                />
              </Field>
              <div className="mt-2">
                <Checkbox
                  checked={includeNote}
                  onCheckedChange={setIncludeNote}
                  label={s.request.includeNote}
                />
                <p className="ps-6 text-[12px] text-muted">{s.request.includeNoteHelp}</p>
              </div>
              <p className="mt-2 text-[12px] text-muted">{s.request.finalMail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {REQUEST_SET_STATUSES.filter((st) => st !== r.status).map((st) => (
                  <Button
                    key={st}
                    variant="secondary"
                    size="sm"
                    onClick={() => choose(st)}
                    data-testid={`request-status-${st}`}
                  >
                    {s.status.request[st]}
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
          title={s.status.request[confirm]}
          body={s.request.confirm[confirm as 'verifying']}
          confirm={s.actions.confirm.confirm}
          onConfirm={() => run(confirm)}
          onClose={() => setConfirm(null)}
          testId="request-confirm"
        />
      ) : null}
    </div>
  );
}
