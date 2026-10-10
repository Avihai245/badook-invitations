'use client';

import { CheckCircle2, Clock, Coins, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Checkbox, Dialog, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { MessageKind } from '@/features/whatsapp/catalog';
import { hostApi, loginUrl } from '../api';
import { formatIls, whatsappReach } from '../../lib/guest-list';
import type { GuestRecord, GuestsPageData } from '../../server/guests';

/** Rounds of "send the next batch" before the page stops asking (the scheduled job finishes the rest). */
const MAX_ROUNDS = 400;

/**
 * Sends one of the approved messages — the RSVP reminder, the reminder before the event, the
 * thank-you (with or without the album) — now, to the guests chosen on the screen: who gets it and
 * who doesn't (no mobile, asked to stop; an RSVP reminder never goes to who already answered), what it
 * costs, the host's confirmation that their guests expect it — then the queue batch by batch with a
 * progress line. (The invitation itself keeps its own dialog: guests/WhatsAppDialog.)
 */
export function SendDialog({
  data,
  kind,
  chosen,
  onClose,
  onDone,
}: {
  data: GuestsPageData;
  kind: Exclude<MessageKind, 'invitation'>;
  chosen: readonly GuestRecord[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, fmt, plural, number, locale } = useUi();
  const w = t.guests.whatsapp;
  const m = t.waMessages;
  const { toast } = useToast();
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<'review' | 'sending' | 'done'>('review');
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0, waiting: 0 });
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(0);

  const skipped = { noPhone: 0, landline: 0, optedOut: 0 };
  let answered = 0;
  const recipients: GuestRecord[] = [];
  for (const g of chosen) {
    const reach = whatsappReach(g);
    if (reach !== 'ok') skipped[reach]++;
    else if (kind === 'reminder' && g.response) answered++;
    else recipients.push(g);
  }
  const n = recipients.length;
  const ils = (v: number) => formatIls(v, locale);
  const total = Math.round(n * data.whatsapp.priceIls * 100) / 100;
  const short = data.unlimited ? 0 : Math.max(0, n - data.credits, missing);
  const blocked = !data.whatsapp.configured
    ? w.blocked.notConfigured
    : !data.published
      ? w.blocked.notPublished
      : !n
        ? w.blocked.nobody
        : short > 0
          ? plural(w.blocked.credits, short, { n: number(short) })
          : !consent
            ? w.blocked.consent
            : null;

  const send = async () => {
    setError(null);
    setPhase('sending');
    setProgress({ done: 0, total: n, failed: 0, waiting: 0 });
    const res = await hostApi<{
      queued: number;
      sent: number;
      failed: number;
      pending: number;
      waiting: number;
      code?: string;
      needed?: number;
      balance?: number;
    }>(`/api/invitations/${data.id}/whatsapp/messages`, {
      method: 'POST',
      body: { kind, guestIds: recipients.map((g) => g.id), consent: true },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.status === 402) {
      setMissing(Math.max(0, (res.body?.needed ?? n) - (res.body?.balance ?? 0)));
      return setPhase('review');
    }
    if (!res.ok || !res.body) {
      setPhase('review');
      const code = res.body?.code;
      return setError(
        code === 'not_configured'
          ? w.notConfigured
          : code === 'not_published'
            ? w.notPublished
            : code === 'nobody'
              ? w.nobody
              : code === 'template'
                ? m.errors.template
                : code === 'feature_off' || code === 'no_album'
                  ? m.errors.feature
                  : m.errors.generic,
      );
    }
    const queued = res.body.queued;
    let done = res.body.sent + res.body.failed;
    let failed = res.body.failed;
    let pending = res.body.pending;
    let waiting = res.body.waiting;
    setProgress({ done, total: queued, failed, waiting });
    for (let round = 0; pending > 0 && round < MAX_ROUNDS; round++) {
      const next = await hostApi<{ sent: number; failed: number; pending: number; waiting: number }>(
        `/api/invitations/${data.id}/whatsapp/messages/process`,
        { method: 'POST' },
      );
      if (!next.ok || !next.body) break;
      done += next.body.sent + next.body.failed;
      failed += next.body.failed;
      pending = next.body.pending;
      waiting = next.body.waiting;
      setProgress({ done: Math.min(done, queued), total: queued, failed, waiting });
      if (next.body.sent + next.body.failed === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    setPhase('done');
    const ok = Math.max(0, Math.min(done, queued) - failed);
    toast({ title: plural(m.manual.done, ok, { n: number(ok) }), variant: 'success' });
    onDone();
  };

  const lines = (
    [
      ['landline', skipped.landline],
      ['optedOut', skipped.optedOut],
      ['noPhone', skipped.noPhone],
    ] as const
  ).filter(([, c]) => c > 0);

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && phase !== 'sending' && onClose()}
      title={fmt(m.manual.sentTitle, { kind: m.kinds[kind] })}
      description={m.manual.sendIntro}
      closeLabel={t.common.close}
      className="max-w-[560px]"
      footer={
        phase === 'done' ? (
          <Button onClick={onClose}>{t.common.close}</Button>
        ) : (
          <>
            {phase === 'review' && blocked ? (
              <p className="me-auto text-[12.5px] font-medium text-muted" data-testid="send-blocked">
                {blocked}
              </p>
            ) : null}
            <Button variant="ghost" onClick={onClose} disabled={phase === 'sending'}>
              {t.common.cancel}
            </Button>
            <Button
              variant="whatsapp"
              icon={<MessageCircle />}
              onClick={() => void send()}
              disabled={!!blocked || phase === 'sending'}
            >
              {phase === 'sending'
                ? fmt(w.sending, { done: number(progress.done), n: number(progress.total) })
                : plural(w.send, n, { n: number(n) })}
            </Button>
          </>
        )
      }
    >
      {phase === 'done' ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" data-testid="send-done">
          <CheckCircle2 aria-hidden className="size-12 text-success" />
          <p className="text-[15px] font-semibold">
            {plural(m.manual.done, progress.done - progress.failed, {
              n: number(progress.done - progress.failed),
            })}
          </p>
          {progress.failed ? (
            <p className="text-[13px] text-danger">
              {plural(w.failed, progress.failed, { n: number(progress.failed) })}
            </p>
          ) : null}
          {progress.waiting ? (
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <Clock aria-hidden className="size-4" />
              {plural(w.waiting, progress.waiting, { n: number(progress.waiting) })}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-line px-3.5 py-3 text-[13px]" data-testid="send-plan">
            <p className="font-semibold">{plural(w.willSend, n, { n: number(n) })}</p>
            {lines.length || answered ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                {answered ? (
                  <li>· {plural(m.manual.remindAnswered, answered, { n: number(answered) })}</li>
                ) : null}
                {lines.map(([key, count]) => (
                  <li key={key}>· {plural(w.skipped[key], count, { n: number(count) })}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-card border border-line bg-canvas px-3.5 py-3 text-[13px]">
            <p className="flex items-center gap-2 font-semibold">
              <Coins aria-hidden className="size-4 text-brand" />
              {w.cost}
            </p>
            <p className="mt-1 text-muted">{fmt(w.perMessage, { price: ils(data.whatsapp.priceIls) })}</p>
            <p className="mt-0.5">
              {plural(w.total, n, { n: number(n), price: ils(data.whatsapp.priceIls), total: ils(total) })}
            </p>
            {!data.unlimited ? (
              <p className="mt-0.5 text-muted">{fmt(w.balance, { n: number(data.credits) })}</p>
            ) : null}
            {short > 0 ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 font-semibold text-danger">
                {plural(w.missing, short, { n: number(short) })}
                <Link href="/app/billing#credits" className="text-brand-deep underline">
                  {w.buy}
                </Link>
              </p>
            ) : null}
          </div>

          <Checkbox
            checked={consent}
            onCheckedChange={setConsent}
            label={
              <span>
                {w.consent} <span className="text-muted">{w.optOut}</span>
              </span>
            }
          />

          {error ? (
            <p role="alert" className="rounded-card bg-danger-bg px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
