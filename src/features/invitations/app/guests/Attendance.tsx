'use client';

import { Minus, PencilLine, Plus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button, Dialog, Segmented, cn, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostApi, loginUrl } from '../api';
import type { GuestRecord } from '../../server/guests';

type Choice = 'coming' | 'declined' | 'none';

/**
 * A guest's attendance in the list — and the way to set it: coming (how many, of how many invited),
 * not coming, or no reply yet; set by the host ("manual"), and a request to bring more people waiting
 * for the host. A button: it opens AnswerDialog.
 */
export function AttendanceCell({ guest, onOpen }: { guest: GuestRecord; onOpen: () => void }) {
  const { t, fmt, number } = useUi();
  const A = t.guests.answer;
  const r = guest.response;
  const coming = r?.attending ? r.adults + r.children : 0;
  const extra = r?.attending ? (r.extraRequested ?? 0) : 0;
  const label = !r
    ? A.none
    : !r.attending
      ? A.declined
      : guest.partySize && coming < guest.partySize
        ? `${A.coming} · ${fmt(A.of, { n: number(coming), total: number(guest.partySize) })}`
        : fmt(A.attending, { n: number(coming) });
  return (
    <span className="inline-flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={fmt(A.edit, { name: guest.name })}
        data-guest-answer={guest.id}
        data-answer={!r ? 'none' : r.attending ? 'coming' : 'declined'}
        className={cn(
          'group inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors',
          !r
            ? 'border-dashed border-line-strong text-muted hover:border-brand hover:text-ink'
            : r.attending
              ? 'border-success/30 bg-success-bg text-success hover:border-success'
              : 'border-line bg-subtle text-ink/70 hover:border-line-strong',
        )}
      >
        {label}
        {r?.source === 'host' ? (
          <span
            title={A.manualHint}
            className="rounded-full bg-surface/80 px-1.5 text-[10.5px] font-semibold text-muted"
          >
            {A.manual}
          </span>
        ) : null}
        <PencilLine aria-hidden className="size-3.5 opacity-50 group-hover:opacity-100" />
      </button>
      {extra ? (
        <button
          type="button"
          onClick={onOpen}
          data-guest-extra={guest.id}
          className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[11.5px] font-semibold text-warning hover:underline"
        >
          <UserPlus aria-hidden className="size-3.5" />
          {fmt(A.extraBadge, { n: number(extra) })}
        </button>
      ) : null}
    </span>
  );
}

/**
 * Setting a guest's answer: coming (how many — by default as many as invited; more invites them with
 * that many), not coming, or no reply yet (only an answer the host set can be taken back). A request
 * to bring more people is approved or declined here too.
 */
export function AnswerDialog({
  invitationId,
  guest,
  onClose,
  onSaved,
}: {
  invitationId: string;
  guest: GuestRecord;
  onClose: () => void;
  onSaved: (guest: GuestRecord) => void;
}) {
  const { t, fmt, plural, number } = useUi();
  const A = t.guests.answer;
  const { toast } = useToast();
  const r = guest.response;
  const invited = guest.partySize ?? 1;
  const [choice, setChoice] = useState<Choice>(!r ? 'none' : r.attending ? 'coming' : 'declined');
  const [count, setCount] = useState(r?.attending ? r.adults + r.children : invited);
  const [busy, setBusy] = useState(false);
  const guestOwn = !!r && r.source !== 'host';
  const extra = r?.attending ? (r.extraRequested ?? 0) : 0;

  const send = async (body: unknown, done: string) => {
    setBusy(true);
    const res = await hostApi<{ guest?: GuestRecord; code?: string }>(
      `/api/invitations/${invitationId}/guests/${guest.id}/answer`,
      { method: 'PUT', body },
    );
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.body?.code === 'guest_reply') return toast({ title: A.guestReply, variant: 'danger' });
    if (!res.ok || !res.body?.guest) return toast({ title: t.guests.toast.error, variant: 'danger' });
    toast({ title: done, variant: 'success' });
    onSaved(res.body.guest);
  };

  const save = () =>
    void send(
      {
        kind: 'answer',
        attending: choice === 'none' ? null : choice === 'coming',
        count: choice === 'coming' ? count : null,
      },
      A.saved,
    );
  const decide = (approve: boolean) =>
    void send(
      { kind: 'extra', approve },
      approve ? fmt(A.approved, { n: number((r ? r.adults + r.children : 0) + extra) }) : A.declinedToast,
    );

  const options: { value: Choice; label: string; disabled?: boolean }[] = [
    { value: 'coming', label: A.coming },
    { value: 'declined', label: A.declined },
    { value: 'none', label: A.none, disabled: guestOwn },
  ];

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fmt(A.title, { name: guest.name })}
      description={A.body}
      closeLabel={t.common.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={save} disabled={busy} data-testid="answer-save">
            {A.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="answer-dialog">
        {extra ? (
          <div
            className="flex flex-col gap-2 rounded-[14px] border border-warning-line bg-warning-bg p-3"
            data-testid="answer-extra"
          >
            <p className="flex items-center gap-1.5 text-[14px] font-bold text-warning">
              <UserPlus aria-hidden className="size-4" />
              {plural(A.extra, extra, { n: number(extra) })}
            </p>
            <p className="text-[13px] text-ink/80">
              {fmt(A.extraBody, { total: number((r ? r.adults + r.children : 0) + extra) })}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide(true)} disabled={busy} data-testid="extra-approve">
                {A.approve}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decide(false)} disabled={busy}>
                {A.decline}
              </Button>
            </div>
          </div>
        ) : null}

        <Segmented
          label={A.column}
          value={choice}
          onValueChange={(v) => setChoice(v as Choice)}
          options={options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
          fullWidth
        />
        {guestOwn ? <p className="-mt-2 text-[12.5px] text-muted">{A.guestAnswered}</p> : null}

        {choice === 'coming' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold" id="answer-count-label">
                {A.count}
              </span>
              <div className="flex items-center gap-2" role="group" aria-labelledby="answer-count-label">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Minus />}
                  aria-label={t.seating.inspector.fewer}
                  onClick={() => setCount((n) => Math.max(1, n - 1))}
                  disabled={count <= 1}
                />
                <output
                  aria-live="polite"
                  className="min-w-10 text-center text-[20px] font-bold tabular-nums"
                  data-testid="answer-count"
                >
                  {number(count)}
                </output>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus />}
                  aria-label={t.seating.inspector.more}
                  onClick={() => setCount((n) => Math.min(99, n + 1))}
                  disabled={count >= 99}
                />
              </div>
            </div>
            <p className="text-[12.5px] text-muted">{plural(A.invited, invited, { n: number(invited) })}</p>
            {count > invited ? (
              <p className="rounded-btn bg-warning-bg px-3 py-2 text-[12.5px] text-warning">
                {fmt(A.over, { n: number(count) })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
