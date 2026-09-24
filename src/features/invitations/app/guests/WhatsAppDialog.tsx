'use client';

import { CheckCircle2, Clock, Coins, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, Checkbox, cn, Dialog, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { fillTemplate, TEMPLATE_TEXT } from '@/features/whatsapp/template-text';
import { hostApi, loginUrl } from '../api';
import { formatIls, whatsappReach } from '../../lib/guest-list';
import { wasSent } from '../../lib/guest-status';
import type { GuestRecord, GuestsPageData } from '../../server/guests';

type Audience = 'unsent' | 'selected' | 'all';

/** Rounds of "send the next batch" before the page stops asking (the scheduled job finishes the rest). */
const MAX_ROUNDS = 400;
const SENT: ReadonlySet<string> = new Set(['sent', 'delivered', 'read']);

/** Who of `base` gets a message now, and why the others don't (never charged for them). */
interface Plan {
  send: GuestRecord[];
  /** already have the invitation: sent only when the host asks to send again */
  received: number;
  noPhone: number;
  landline: number;
  optedOut: number;
  queued: number;
}

function planFor(base: readonly GuestRecord[], resend: boolean): Plan {
  const plan: Plan = { send: [], received: 0, noPhone: 0, landline: 0, optedOut: 0, queued: 0 };
  for (const x of base) {
    const reach = whatsappReach(x);
    if (reach !== 'ok') plan[reach]++;
    else if (x.sendStatus === 'queued') plan.queued++;
    else if (!wasSent(x)) plan.send.push(x);
    else {
      plan.received++;
      if (resend) plan.send.push(x);
    }
  }
  return plan;
}

/**
 * Send the invitation from the system's WhatsApp number: who gets it (guests who already have it are
 * left out unless the host asks to send again; landlines and guests who asked to stop never get it),
 * the message as they'll see it, what it costs (Meta's marketing rate per message, for what is really
 * sent), the host's confirmation that their guests expect it — then the queue is sent batch by batch
 * with a progress line. Messages WhatsApp asked us to hold back are retried by the scheduled job.
 */
export function WhatsAppDialog({
  data,
  guests,
  selected,
  onClose,
  onDone,
}: {
  data: GuestsPageData;
  guests: readonly GuestRecord[];
  selected: ReadonlySet<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, fmt, number, locale } = useUi();
  const w = t.guests.whatsapp;
  const { toast } = useToast();
  const [audience, setAudience] = useState<Audience>(selected.size ? 'selected' : 'unsent');
  const [resend, setResend] = useState(false);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<'review' | 'sending' | 'done'>('review');
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0, waiting: 0 });
  const [error, setError] = useState<string | null>(null);
  // the server's count of missing credits, for the recipients it was asked about
  const [missing, setMissing] = useState<{ n: number; short: number } | null>(null);

  const bases = useMemo<Record<Audience, GuestRecord[]>>(
    () => ({
      unsent: guests.filter((g) => !wasSent(g)),
      selected: guests.filter((g) => selected.has(g.id)),
      all: [...guests],
    }),
    [guests, selected],
  );
  const plan = planFor(bases[audience], resend);
  const recipients = plan.send;
  const n = recipients.length;
  const ils = (v: number) => formatIls(v, locale);
  const total = Math.round(n * data.whatsapp.priceIls * 100) / 100;
  const short = data.unlimited ? 0 : Math.max(0, n - data.credits, missing?.n === n ? missing.short : 0);
  const template = TEMPLATE_TEXT[data.whatsapp.lang];
  const sample = recipients[0]?.name ?? guests[0]?.name ?? '';
  const message = fillTemplate(template.body, [
    sample,
    data.whatsapp.hosts,
    data.whatsapp.event,
    data.whatsapp.date,
  ]);

  // why "send" can't be pressed, said next to it
  const blocked = !data.whatsapp.configured
    ? w.blocked.notConfigured
    : !data.published
      ? w.blocked.notPublished
      : !n
        ? w.blocked.nobody
        : short > 0
          ? fmt(w.blocked.credits, { n: number(short) })
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
    }>(`/api/invitations/${data.id}/whatsapp`, {
      method: 'POST',
      body: { guestIds: recipients.map((g) => g.id), consent: true, resend },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.status === 402) {
      setMissing({ n, short: Math.max(0, (res.body?.needed ?? n) - (res.body?.balance ?? 0)) });
      return setPhase('review');
    }
    if (!res.ok || !res.body) {
      setPhase('review');
      return setError(
        res.body?.code === 'not_configured'
          ? w.notConfigured
          : res.body?.code === 'not_published'
            ? w.notPublished
            : res.body?.code === 'nobody'
              ? w.nobody
              : t.guests.toast.error,
      );
    }
    const queued = res.body.queued;
    let done = res.body.sent + res.body.failed;
    let failed = res.body.failed;
    let pending = res.body.pending;
    let waiting = res.body.waiting;
    setProgress({ done, total: queued, failed, waiting });
    // what can be sent now; messages waiting for a later try are the scheduled job's
    for (let round = 0; pending > 0 && round < MAX_ROUNDS; round++) {
      const next = await hostApi<{ sent: number; failed: number; pending: number; waiting: number }>(
        `/api/invitations/${data.id}/whatsapp/process`,
        { method: 'POST' },
      );
      if (!next.ok || !next.body) break;
      done += next.body.sent + next.body.failed;
      failed += next.body.failed;
      pending = next.body.pending;
      waiting = next.body.waiting;
      setProgress({ done, total: queued, failed, waiting });
      if (next.body.sent + next.body.failed === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    // the outcome as the list has it — another tab or the scheduled job may have sent some of them
    const final = await hostApi<{ guests: GuestRecord[] }>(`/api/invitations/${data.id}/guests`);
    if (final.ok && final.body) {
      const ids = new Set(recipients.map((g) => g.id));
      const mine = final.body.guests.filter((g) => ids.has(g.id));
      const sentNow = mine.filter((g) => SENT.has(g.sendStatus)).length;
      failed = mine.filter((g) => g.sendStatus === 'failed').length;
      waiting = mine.filter((g) => g.sendStatus === 'queued').length;
      done = sentNow + failed;
      setProgress({ done, total: queued, failed, waiting });
    }
    setPhase('done');
    toast({ title: fmt(w.done, { n: number(done - failed) }), variant: 'success' });
    onDone();
  };

  const audienceOptions = (['unsent', 'selected', 'all'] as const)
    .filter((a) => a !== 'selected' || selected.size > 0)
    .map((a) => ({
      value: a,
      label: fmt(a === 'unsent' ? w.toUnsent : a === 'selected' ? w.toSelected : w.toAll, {
        n: number(planFor(bases[a], resend).send.length),
      }),
    }));
  const skippedLines = (
    [
      ['received', resend ? 0 : plan.received],
      ['landline', plan.landline],
      ['optedOut', plan.optedOut],
      ['noPhone', plan.noPhone],
      ['queued', plan.queued],
    ] as const
  ).filter(([, count]) => count > 0);

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && phase !== 'sending' && onClose()}
      title={w.title}
      description={w.intro}
      closeLabel={t.common.close}
      className="max-w-[600px]"
      footer={
        phase === 'done' ? (
          <Button onClick={onClose}>{t.common.close}</Button>
        ) : (
          <>
            {phase === 'review' && blocked ? (
              <p className="me-auto text-[12.5px] font-medium text-muted" data-testid="whatsapp-blocked">
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
                : fmt(w.send, { n: number(n) })}
            </Button>
          </>
        )
      }
    >
      {phase === 'done' ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" data-testid="whatsapp-done">
          <CheckCircle2 aria-hidden className="size-12 text-success" />
          <p className="text-[15px] font-semibold">
            {fmt(w.done, { n: number(progress.done - progress.failed) })}
          </p>
          {progress.failed ? (
            <p className="text-[13px] text-danger">{fmt(w.failed, { n: number(progress.failed) })}</p>
          ) : null}
          {progress.waiting ? (
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <Clock aria-hidden className="size-4" />
              {fmt(w.waiting, { n: number(progress.waiting) })}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!data.whatsapp.configured ? (
            <p
              role="alert"
              className="rounded-card border border-[#fde68a] bg-warning-bg px-3 py-2.5 text-[13px] text-warning"
            >
              {w.notConfigured}
            </p>
          ) : !data.published ? (
            <p
              role="alert"
              className="rounded-card border border-[#fde68a] bg-warning-bg px-3 py-2.5 text-[13px] text-warning"
            >
              {w.notPublished}
            </p>
          ) : null}

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold">{w.recipients}</legend>
            <div className="flex flex-col gap-1.5">
              {audienceOptions.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-card border px-3 py-2 text-[13.5px] transition-colors',
                    audience === o.value
                      ? 'border-brand bg-brand-soft/50 font-semibold'
                      : 'border-line hover:bg-subtle',
                  )}
                >
                  <input
                    type="radio"
                    name="whatsapp-audience"
                    value={o.value}
                    checked={audience === o.value}
                    onChange={() => setAudience(o.value)}
                    className="size-4 shrink-0 accent-[var(--color-brand)]"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div
            className="rounded-card border border-line px-3.5 py-3 text-[13px]"
            data-testid="whatsapp-plan"
          >
            <p className="font-semibold">{fmt(w.willSend, { n: number(n) })}</p>
            {skippedLines.length ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                {skippedLines.map(([key, count]) => (
                  <li key={key}>· {fmt(w.skipped[key], { n: number(count) })}</li>
                ))}
              </ul>
            ) : null}
            {plan.received ? (
              <Checkbox
                className="mt-1.5"
                checked={resend}
                onCheckedChange={setResend}
                label={fmt(w.resend, { n: number(plan.received) })}
              />
            ) : null}
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold">{w.preview}</p>
            <div
              className="rounded-[14px] bg-[#e7ddd3] p-3"
              dir={data.whatsapp.lang === 'he' ? 'rtl' : 'ltr'}
            >
              <div className="max-w-[340px] rounded-[10px] bg-white px-3 pt-2.5 pb-2 shadow-sm">
                <p className="text-[13.5px] leading-[1.5] whitespace-pre-line text-[#111b21]">{message}</p>
                <p className="mt-1 text-[11.5px] text-[#667781]">{template.footer}</p>
                <div className="mt-2 border-t border-[#e9edef] pt-2 text-center text-[13.5px] font-medium text-[#027eb5]">
                  {template.button}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-line bg-canvas px-3.5 py-3 text-[13px]">
            <p className="flex items-center gap-2 font-semibold">
              <Coins aria-hidden className="size-4 text-brand" />
              {w.cost}
            </p>
            <p className="mt-1 text-muted">{fmt(w.perMessage, { price: ils(data.whatsapp.priceIls) })}</p>
            <p className="mt-0.5">
              {fmt(w.total, { n: number(n), price: ils(data.whatsapp.priceIls), total: ils(total) })}
            </p>
            {!data.unlimited ? (
              <p className="mt-0.5 text-muted">{fmt(w.balance, { n: number(data.credits) })}</p>
            ) : null}
            {short > 0 ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 font-semibold text-danger">
                {fmt(w.missing, { n: number(short) })}
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
