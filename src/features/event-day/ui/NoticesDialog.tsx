'use client';

import { Check, Link2, MessageCircle, Printer, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dialog, Hint, IconButton, Segmented, Skeleton, useToast } from '@/components/app';
import { loginUrl } from '@/features/invitations/app/api';
import { whatsappCapable } from '@/features/invitations/lib/guest-import';
import { dictFor, fmt as format } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { NoticeRow } from '../model';
import { dayApi, type NoticesState } from './host-api';

/** Where a family stands: told its number (or on its way), told another number, not told yet. */
export type NoticeState = 'queued' | 'told' | 'update' | 'unseated' | 'unsent' | 'none';

export function noticeState(r: NoticeRow): NoticeState {
  if (r.queued) return 'queued';
  if (r.told) {
    if (!r.table) return 'unseated';
    return r.table.number === r.told.number ? 'told' : 'update';
  }
  return r.table ? 'unsent' : 'none';
}

type Tab = 'all' | 'update' | 'unsent' | 'told';
const IN_TAB: Record<Tab, (s: NoticeState) => boolean> = {
  all: () => true,
  update: (s) => s === 'update' || s === 'unseated',
  unsent: (s) => s === 'unsent',
  told: (s) => s === 'told' || s === 'queued',
};
/** a family the system's number can tell now */
const sendable = (r: NoticeRow) => {
  const s = noticeState(r);
  return (s === 'unsent' || s === 'update') && r.reach === 'ok' && !!r.token;
};
/** a family whose current number the host can mark as told */
const markable = (r: NoticeRow) => {
  const s = noticeState(r);
  return s === 'unsent' || s === 'update';
};

/**
 * "Send guests their table": every family with a seat, what it was told and what it should be told —
 * from the system's WhatsApp number (the second template; a credit each), from the host's own WhatsApp
 * (wa.me with a ready message, then marked as told), marked as told by hand, or on printed table
 * cards. `only`: just these families (after a re-seat, the ones to tell from the host's WhatsApp).
 */
export function NoticesDialog({
  id,
  open,
  onOpenChange,
  only = null,
  onChanged,
}: {
  id: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  only?: readonly string[] | null;
  /** something was sent or marked (the caller refreshes what it shows) */
  onChanged?(): void;
}) {
  const { t, fmt, plural, number } = useUi();
  const N = t.eventDay.notices;
  const { toast } = useToast();
  const [data, setData] = useState<NoticesState | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [busy, setBusy] = useState<'send' | 'mark' | null>(null);

  const load = useCallback(async () => {
    const res = await dayApi.notices(id);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok || !res.body) return setFailed(true);
    setFailed(false);
    setData(res.body);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    setData(null);
    setTab(null);
    void load();
  }, [open, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const list = only ? data.rows.filter((r) => only.includes(r.unitId)) : data.rows;
    return [...list].sort(
      (a, b) =>
        (a.table?.number ?? Number.MAX_SAFE_INTEGER) - (b.table?.number ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name),
    );
  }, [data, only]);
  const counts = useMemo(() => {
    const c = { all: rows.length, update: 0, unsent: 0, told: 0 } as Record<Tab, number>;
    for (const r of rows) {
      const s = noticeState(r);
      for (const k of ['update', 'unsent', 'told'] as const) if (IN_TAB[k](s)) c[k] += 1;
    }
    return c;
  }, [rows]);
  const current: Tab = only ? 'all' : (tab ?? (counts.update ? 'update' : counts.unsent ? 'unsent' : 'all'));
  const shown = rows.filter((r) => IN_TAB[current](noticeState(r)));
  const toSend = shown.filter(sendable);
  const toMark = shown.filter(markable);

  const guideUrl = (r: NoticeRow) =>
    data && r.token ? `${data.base}/e/${data.slug}/table?g=${encodeURIComponent(r.token)}` : null;

  const mark = async (unitIds: string[], quiet = false) => {
    if (!unitIds.length) return;
    if (!quiet) setBusy('mark');
    const res = await dayApi.markNotices(id, unitIds);
    setBusy(null);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (!res.ok || !res.body) return toast({ variant: 'danger', title: t.eventDay.errors.failed });
    const n = res.body.marked ?? 0;
    if (!quiet) toast({ variant: 'success', title: plural(N.marked, n, { n: number(n) }) });
    await load();
    onChanged?.();
  };

  const skippedLine = (skipped: Record<string, number> | undefined) => {
    if (!skipped) return null;
    const parts = (Object.keys(N.reasons) as (keyof typeof N.reasons)[])
      .filter((k) => (skipped[k] ?? 0) > 0)
      .map((k) => fmt(N.reasons[k], { n: number(skipped[k]!) }));
    return parts.length ? fmt(N.skipped, { reasons: parts.join(', ') }) : null;
  };

  const send = async () => {
    const unitIds = toSend.map((r) => r.unitId);
    if (!unitIds.length) return;
    setBusy('send');
    const res = await dayApi.sendNotices(id, unitIds);
    setBusy(null);
    if (res.status === 401) return window.location.assign(loginUrl());
    const body = res.body as (typeof res.body & { needed?: number; balance?: number }) | null;
    if (!res.ok || !body) {
      const code = body?.code;
      const title =
        code === 'credits'
          ? fmt(N.errors.credits, { needed: number(body?.needed ?? 0), balance: number(body?.balance ?? 0) })
          : code === 'not_published' || code === 'nobody'
            ? N.errors[code]
            : code === 'not_configured'
              ? N.notReady
              : N.errors.failed;
      toast({ variant: 'danger', title, description: skippedLine(body?.skipped) ?? undefined });
      return;
    }
    const waiting = body.pending > 0 ? fmt(N.waiting, { n: number(body.pending) }) : null;
    toast({
      variant: 'success',
      title: plural(N.sent, body.queued, { n: number(body.queued) }),
      description: [waiting, skippedLine(body.skipped)].filter(Boolean).join(' ') || undefined,
    });
    await load();
    onChanged?.();
  };

  const sendOwn = (r: NoticeRow) => {
    const url = guideUrl(r);
    if (!data || !url || !r.phone || !r.table) return;
    const own = dictFor(data.own.locale).eventDay.notices;
    const table =
      format(own.ownTable, { number: r.table.number }) + (r.table.label ? ` (${r.table.label})` : '');
    const text = format(own.ownMessage, { name: r.name, hosts: data.own.hosts, table, url });
    window.open(
      `https://wa.me/${r.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener',
    );
    void mark([r.unitId], true);
  };

  const copy = (r: NoticeRow) => {
    const url = guideUrl(r);
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast({ variant: 'success', title: N.copied }),
      () => toast({ variant: 'danger', title: t.eventDay.errors.failed }),
    );
  };

  const statusOf = (r: NoticeRow) => {
    const s = noticeState(r);
    const told = r.told ? fmt(N.row.table, { number: r.told.number }) : '';
    if (s === 'queued') return <Badge variant="info">{N.row.queued}</Badge>;
    if (s === 'told')
      return (
        <Badge variant="live">
          {r.told?.channel === 'manual' ? N.row.manual : fmt(N.row.told, { number: r.told!.number })}
        </Badge>
      );
    if (s === 'update')
      return (
        <Badge variant="warning">
          {fmt(N.row.update, { told, now: fmt(N.row.table, { number: r.table!.number }) })}
        </Badge>
      );
    if (s === 'unseated') return <Badge variant="warning">{fmt(N.row.unseated, { told })}</Badge>;
    if (s === 'unsent') return <Badge variant="draft">{N.row.unsent}</Badge>;
    return null;
  };

  const reachNote = (r: NoticeRow) =>
    !r.token ? N.row.noLink : !r.phone || !whatsappCapable(r.phone) ? N.row.noPhone : null;

  const title = only ? plural(t.eventDay.notified.manual, only.length, { n: number(only.length) }) : N.title;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={only ? undefined : N.intro}
      closeLabel={N.close}
      className="max-w-[640px]"
      footer={
        data && rows.length ? (
          <>
            {!only ? (
              <Hint text={N.cardsHint}>
                <Button variant="ghost" size="sm" icon={<Printer />} className="me-auto" asChild>
                  <a href={`/app/invitations/${id}/seating/cards`} target="_blank" rel="noreferrer">
                    {N.cards}
                  </a>
                </Button>
              </Hint>
            ) : null}
            <Hint text={N.markToldHint}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Check />}
                disabled={!toMark.length}
                loading={busy === 'mark'}
                onClick={() => void mark(toMark.map((r) => r.unitId))}
                data-testid="notices-mark-all"
              >
                {N.markAll}
              </Button>
            </Hint>
            {data.ready ? (
              <Hint text={fmt(N.sendAllHint, { brand: t.brand })} disabledText={N.sendNone}>
                <Button
                  variant="whatsapp"
                  size="sm"
                  icon={<Send className="icon-dir" />}
                  disabled={!toSend.length}
                  loading={busy === 'send'}
                  onClick={() => void send()}
                  data-testid="notices-send"
                >
                  {toSend.length
                    ? plural(N.sendAll, toSend.length, { n: number(toSend.length) })
                    : N.sendNone}
                </Button>
              </Hint>
            ) : null}
          </>
        ) : null
      }
    >
      {!data ? (
        failed ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[13.5px] text-danger">{t.eventDay.errors.failed}</p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              {t.common.retry}
            </Button>
          </div>
        ) : (
          <div className="grid gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={52} radius={10} />
            ))}
          </div>
        )
      ) : !rows.length ? (
        <p className="text-[13.5px] text-muted">{N.empty}</p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="notices-dialog">
          {!data.ready ? (
            <p className="rounded-input bg-warning-bg px-3 py-2 text-[13px] text-warning">{N.notReady}</p>
          ) : null}
          {!only ? (
            <>
              <p className="text-[12.5px] text-muted">
                {fmt(N.counts, {
                  seated: number(rows.filter((r) => r.table).length),
                  told: number(counts.told),
                  update: number(counts.update),
                })}
              </p>
              <Segmented<Tab>
                value={current}
                onValueChange={setTab}
                label={N.title}
                className="max-w-full overflow-x-auto"
                options={(['all', 'update', 'unsent', 'told'] as const).map((k) => ({
                  value: k,
                  label: `${N.tabs[k]} · ${number(counts[k])}`,
                }))}
              />
            </>
          ) : null}
          <ul className="-mx-1 flex max-h-[46dvh] flex-col overflow-y-auto px-1" data-testid="notices-rows">
            {shown.map((r) => {
              const note = reachNote(r);
              const url = guideUrl(r);
              const own = !!r.table && !!url && whatsappCapable(r.phone);
              return (
                <li
                  key={r.unitId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2.5 last:border-b-0"
                  data-notice-row={r.name}
                  data-notice-state={noticeState(r)}
                >
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <p className="truncate text-[14px] font-semibold">
                      <bdi>{r.name}</bdi>
                      <span className="ms-2 text-[12.5px] font-normal text-muted">
                        {r.table
                          ? fmt(N.row.table, { number: r.table.number }) +
                            (r.table.label ? ` · ${r.table.label}` : '')
                          : N.row.noTable}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      {statusOf(r)}
                      {note ? <span className="text-[11.5px] text-muted">{note}</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {own ? (
                      <Hint text={N.sendOwnHint}>
                        <IconButton label={N.sendOwn} size="sm" onClick={() => sendOwn(r)} data-send-own="">
                          <MessageCircle />
                        </IconButton>
                      </Hint>
                    ) : null}
                    {markable(r) && r.table ? (
                      <Hint text={N.markToldHint}>
                        <IconButton label={N.markTold} size="sm" onClick={() => void mark([r.unitId])}>
                          <Check />
                        </IconButton>
                      </Hint>
                    ) : null}
                    {url ? (
                      <Hint text={N.copyLinkHint}>
                        <IconButton label={N.copyLink} size="sm" onClick={() => copy(r)}>
                          <Link2 />
                        </IconButton>
                      </Hint>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {data.ready && toSend.length ? (
            <p className="text-end text-[12px] text-muted">
              {data.unlimited
                ? N.unlimited
                : fmt(N.cost, { n: number(toSend.length), credits: number(data.credits) })}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
