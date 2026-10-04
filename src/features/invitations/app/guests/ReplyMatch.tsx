'use client';

import { Check, Link2, MessageCircle, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Dialog, Select, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { hostApi, loginUrl } from '../api';
import { suggestGuests } from '../../lib/rsvp-summary';
import { guestPhone } from '../../lib/guest-list';
import type { GuestRecord, GuestsPageReply } from '../../server/guests';

/**
 * Replies that came through the invitation's general link belong to no guest on the list: a banner says
 * how many, and its dialog matches each to a guest — the likeliest ones first (same phone, same name),
 * any guest without a reply of their own from the list.
 */
export function UnmatchedReplies({
  id,
  replies,
  guests,
  onChanged,
}: {
  id: string;
  /** the replies matched to no guest on the list */
  replies: GuestsPageReply[];
  guests: GuestRecord[];
  onChanged: () => void;
}) {
  const { t, plural, number } = useUi();
  const u = t.guests.unmatched;
  const [open, setOpen] = useState(false);
  if (!replies.length) return null;
  return (
    <>
      <Card
        padding="md"
        className="mt-4 flex flex-wrap items-center justify-between gap-3 border-info-line bg-info-bg/60"
        data-testid="unmatched-replies"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-info"
          >
            <Link2 className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">
              {plural(u.banner, replies.length, { n: number(replies.length) })}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">{u.bannerBody}</p>
          </div>
        </div>
        <Button variant="secondary" icon={<Sparkles />} onClick={() => setOpen(true)}>
          {u.action}
        </Button>
      </Card>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={u.title}
        description={u.body}
        closeLabel={t.common.close}
        className="max-w-[640px]"
      >
        <ul className="mt-4 flex flex-col gap-3">
          {replies.map((r) => (
            <ReplyRow key={r.id} id={id} reply={r} guests={guests} onChanged={onChanged} />
          ))}
        </ul>
      </Dialog>
    </>
  );
}

function ReplyRow({
  id,
  reply,
  guests,
  onChanged,
}: {
  id: string;
  reply: GuestsPageReply;
  guests: GuestRecord[];
  onChanged: () => void;
}) {
  const { t, plural, number, fmt } = useUi();
  const u = t.guests.unmatched;
  const { toast } = useToast();
  const suggestions = useMemo(() => suggestGuests(reply, guests), [reply, guests]);
  const free = useMemo(() => guests.filter((g) => !g.response), [guests]);
  const [pick, setPick] = useState(suggestions[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const match = async (guestId: string) => {
    if (!guestId) return;
    setBusy(true);
    const res = await hostApi(`/api/invitations/${id}/responses/${reply.id}`, {
      method: 'PATCH',
      body: { guestId },
    });
    setBusy(false);
    if (res.status === 401) return window.location.assign(loginUrl());
    if (res.status === 409) return toast({ title: u.taken, variant: 'danger' });
    if (!res.ok) return toast({ title: t.guests.toast.error, variant: 'danger' });
    const name = guests.find((g) => g.id === guestId)?.name ?? '';
    setDone(name);
    toast({ title: fmt(u.matched, { name }), variant: 'success' });
    onChanged();
  };

  const people = reply.adults + reply.children;
  return (
    <li className="rounded-card border border-line bg-canvas p-4" data-reply={reply.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[15px] font-semibold">
          <bdi>{reply.name}</bdi>
          {reply.phone ? (
            <span dir="ltr" className="ms-2 text-[12.5px] font-normal text-muted tabular-nums">
              {guestPhone(reply.phone)}
            </span>
          ) : null}
        </p>
        <Badge variant={reply.attending ? 'live' : 'neutral'}>
          {reply.attending ? plural(u.coming, people, { n: number(people) }) : u.declined}
        </Badge>
      </div>
      {done !== null ? (
        <p className="mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-success">
          <Check aria-hidden className="size-4" />
          {fmt(u.matched, { name: done })}
        </p>
      ) : (
        <>
          {suggestions.length ? (
            <div className="mt-3">
              <p className="text-[12px] font-semibold text-muted">{u.suggest}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {suggestions.map((g) => (
                  <Button
                    key={g.id}
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void match(g.id)}
                  >
                    <bdi>{g.name}</bdi>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-muted">{u.noSuggest}</p>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12px] font-semibold text-muted">
              {u.pickLabel}
              <Select value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{u.pickPlaceholder}</option>
                {free.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.phone ? ` · ${guestPhone(g.phone)}` : ''}
                  </option>
                ))}
              </Select>
            </label>
            <Button disabled={!pick || busy} onClick={() => void match(pick)}>
              {u.match}
            </Button>
          </div>
        </>
      )}
    </li>
  );
}

/**
 * "Send from my WhatsApp" as a queue: the guests not reached yet, one at a time — open the chat with the
 * ready message (it marks them as sent), then "next". For while the system's own number isn't connected.
 */
export function OwnSendQueue({
  open,
  onOpenChange,
  queue,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the guests to send to, in the list's order */
  queue: GuestRecord[];
  /** opens the chat for one guest (and marks them as sent) */
  onSend: (g: GuestRecord) => void;
}) {
  const { t, fmt, number } = useUi();
  const o = t.guests.own;
  // the queue is fixed when the dialog opens: sending moves a guest out of "not sent"
  const [list, setList] = useState<GuestRecord[]>([]);
  const [at, setAt] = useState(0);
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!open) return;
    setList(queue);
    setAt(0);
    setSent(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- taken once per opening, on purpose
  }, [open]);
  const current = list[at] ?? null;
  const finished = list.length > 0 && at >= list.length;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={o.title}
      description={o.body}
      closeLabel={t.common.close}
    >
      {list.length === 0 ? (
        <p className="mt-4 text-[14px] text-muted">{o.none}</p>
      ) : finished ? (
        <p className="mt-5 flex items-center gap-2 rounded-card bg-success-bg px-4 py-3 text-[14px] font-semibold text-success">
          <Check aria-hidden className="size-5" />
          {o.done}
        </p>
      ) : current ? (
        <div className="mt-5" data-testid="own-queue">
          <div className="flex items-center justify-between text-[12.5px] font-semibold text-muted">
            <span>{fmt(o.progress, { i: number(at + 1), n: number(list.length) })}</span>
            <span aria-hidden className="h-1.5 w-32 overflow-hidden rounded-full bg-subtle">
              <span
                className="block h-full rounded-full bg-whatsapp transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${(at / list.length) * 100}%` }}
              />
            </span>
          </div>
          <div className="mt-3 rounded-card border border-wa-line bg-wa-soft/50 p-4">
            <p className="text-[17px] font-bold">
              <bdi>{current.name}</bdi>
            </p>
            <p dir="ltr" className="mt-0.5 text-start text-[13px] text-muted tabular-nums">
              {guestPhone(current.phone)}
            </p>
            {sent.has(current.id) ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-success">
                <Check aria-hidden className="size-4" />
                {o.sent}
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
            <Button
              variant={sent.has(current.id) ? 'secondary' : 'whatsapp'}
              icon={<MessageCircle />}
              onClick={() => {
                onSend(current);
                setSent((s) => new Set(s).add(current.id));
              }}
            >
              {o.open}
            </Button>
            <Button
              variant={sent.has(current.id) ? 'primary' : 'ghost'}
              icon={<Send className="icon-dir" />}
              onClick={() => setAt((i) => i + 1)}
            >
              {sent.has(current.id) ? o.next : o.skip}
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
