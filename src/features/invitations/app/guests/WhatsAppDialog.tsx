'use client';

import { CheckCircle2, Coins, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, Checkbox, cn, Dialog, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { fillTemplate, TEMPLATE_TEXT } from '@/features/whatsapp/template-text';
import { hostApi, loginUrl } from '../api';
import { wasSent } from '../../lib/guest-status';
import type { GuestRecord, GuestsPageData } from '../../server/guests';

type Audience = 'unsent' | 'selected' | 'all';

/** Rounds of "send the next batch" before the page stops asking (the scheduled job finishes the rest). */
const MAX_ROUNDS = 400;
const SENT: ReadonlySet<string> = new Set(['sent', 'delivered', 'read']);

/**
 * Send the invitation from the system's WhatsApp number: who gets it, the message as they'll see it,
 * what it costs (Meta's marketing rate per message), the host's confirmation that their guests expect
 * it — then the queue is sent batch by batch with a progress line.
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
  const { t, fmt, number } = useUi();
  const w = t.guests.whatsapp;
  const { toast } = useToast();
  const withPhone = useMemo(() => guests.filter((g) => g.phone && g.sendStatus !== 'queued'), [guests]);
  const groups: Record<Audience, GuestRecord[]> = {
    unsent: withPhone.filter((g) => !wasSent(g)),
    selected: withPhone.filter((g) => selected.has(g.id)),
    all: withPhone,
  };
  const [audience, setAudience] = useState<Audience>(selected.size ? 'selected' : 'unsent');
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<'review' | 'sending' | 'done'>('review');
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(0);

  const recipients = groups[audience];
  const n = recipients.length;
  const ils = (v: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(v);
  const total = Math.round(n * data.whatsapp.priceIls * 100) / 100;
  const short = data.unlimited ? 0 : Math.max(0, n - data.credits);
  const template = TEMPLATE_TEXT[data.whatsapp.lang];
  const sample = recipients[0]?.name ?? guests[0]?.name ?? '';
  const message = fillTemplate(template.body, [
    sample,
    data.whatsapp.hosts,
    data.whatsapp.event,
    data.whatsapp.date,
  ]);

  const blocked = !data.whatsapp.configured || !data.published;

  const send = async () => {
    setError(null);
    setPhase('sending');
    setProgress({ done: 0, total: n, failed: 0 });
    const res = await hostApi<{
      queued: number;
      sent: number;
      failed: number;
      pending: number;
      code?: string;
      needed?: number;
      balance?: number;
    }>(`/api/invitations/${data.id}/whatsapp`, {
      method: 'POST',
      body: { guestIds: recipients.map((g) => g.id), consent: true },
    });
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.status === 402) {
      setMissing(Math.max(0, (res.body?.needed ?? n) - (res.body?.balance ?? 0)));
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
    setProgress({ done, total: queued, failed });
    for (let round = 0; pending > 0 && round < MAX_ROUNDS; round++) {
      const next = await hostApi<{ sent: number; failed: number; pending: number }>(
        `/api/invitations/${data.id}/whatsapp/process`,
        { method: 'POST' },
      );
      if (!next.ok || !next.body) break;
      done += next.body.sent + next.body.failed;
      failed += next.body.failed;
      pending = next.body.pending;
      setProgress({ done, total: queued, failed });
      if (next.body.sent + next.body.failed === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    // the outcome as the list has it — another tab or the scheduled job may have sent some of them
    const final = await hostApi<{ guests: GuestRecord[] }>(`/api/invitations/${data.id}/guests`);
    if (final.ok && final.body) {
      const ids = new Set(recipients.map((g) => g.id));
      const mine = final.body.guests.filter((g) => ids.has(g.id));
      const sentNow = mine.filter((g) => SENT.has(g.sendStatus)).length;
      failed = mine.filter((g) => g.sendStatus === 'failed').length;
      done = sentNow + failed;
      setProgress({ done, total: queued, failed });
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
        n: number(groups[a].length),
      }),
    }));

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
            <Button variant="ghost" onClick={onClose} disabled={phase === 'sending'}>
              {t.common.cancel}
            </Button>
            <Button
              icon={<MessageCircle />}
              onClick={() => void send()}
              disabled={blocked || !n || !consent || short > 0 || phase === 'sending'}
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
            {short > 0 || missing > 0 ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 font-semibold text-danger">
                {fmt(w.missing, { n: number(Math.max(short, missing)) })}
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
