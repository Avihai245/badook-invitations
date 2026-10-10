'use client';

import { BookHeart, Copy, Crown, ExternalLink, MessageCircle, Pencil, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, CardTitle, Hint, useToast } from '@/components/app';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { SendLinkDialog } from '@/features/live-gallery/ui/host/SendLinkDialog';
import { fmt as format } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { ALBUM_SHARE_MESSAGE, albumLinkIn } from '../messages';
import type { HostAlbumView } from '../types';

/**
 * The album's card in the gallery tab (feature album): where it stands (opens the morning after, open,
 * off), and what the hosts do with it — view it, copy its link, share it on WhatsApp with a ready
 * thank-you, thank every guest from the list, open it now, edit it. Without the feature: the package
 * that has it, or the switch.
 */
export function AlbumCard({ initial }: { initial: HostAlbumView }) {
  const { t, fmt, date, number, locale } = useUi();
  const A = t.album;
  const { toast } = useToast();
  const [view, setView] = useState(initial);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const a = view.album;
  const f = view.feature;

  const call = async (url: string, method: 'PATCH' | 'POST', body: unknown) => {
    setBusy(true);
    const res = await hostApi<{ view?: HostAlbumView }>(url, { method, body });
    setBusy(false);
    if (res.status === 401) {
      window.location.assign(loginUrl());
      return null;
    }
    if (!res.ok) {
      toast({ title: t.common.error, variant: 'danger' });
      return null;
    }
    return res.body;
  };
  const switchOn = async () => {
    const body = await call(`/api/invitations/${view.id}/features`, 'PATCH', {
      feature: 'album',
      off: false,
    });
    if (!body) return;
    const fresh = await hostApi<{ view: HostAlbumView }>(`/api/invitations/${view.id}/album`);
    if (fresh.ok && fresh.body?.view) setView(fresh.body.view);
  };
  const openNow = async () => {
    const body = await call(`/api/invitations/${view.id}/album`, 'PATCH', {
      opensAt: new Date().toISOString(),
    });
    if (body?.view) {
      setView(body.view);
      toast({ title: A.card.opened, variant: 'success' });
    }
  };
  const copy = () =>
    a?.url &&
    navigator.clipboard.writeText(a.url).then(
      () => toast({ title: A.card.copied, variant: 'success' }),
      () => toast({ title: A.card.copyFailed, variant: 'danger' }),
    );
  /** WhatsApp with a ready thank-you in the invitation's language (for a group, a status…) */
  const whatsapp = () => {
    if (!a?.url) return;
    const l = view.event.defaultLocale;
    const text = format(ALBUM_SHARE_MESSAGE[l], {
      event: view.event.phrase[l] ?? '',
      hosts: view.event.names[l] ?? '',
      url: albumLinkIn(a.url, l, l),
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const head = (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-deep"
      >
        <BookHeart className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle as="h2" className="mb-0">
            {A.card.title}
          </CardTitle>
          {a ? (
            <Badge
              variant={a.state === 'open' ? 'live' : a.state === 'soon' ? 'info' : 'neutral'}
              data-testid="album-state"
            >
              {a.state === 'soon' && a.opensAt
                ? fmt(A.state.soon, {
                    date: date(a.opensAt, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : A.state[a.state]}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] text-muted">{A.card.body}</p>
      </div>
    </div>
  );

  if (!f.on && f.why === 'plan')
    return (
      <Card padding="lg" className="flex flex-col gap-3" data-testid="album-card">
        {head}
        <div className="flex flex-wrap items-center gap-3 rounded-input border border-brand-line bg-brand-soft px-3 py-2.5 text-[13px]">
          <Crown aria-hidden className="size-4 text-brand-deep" />
          <span>{fmt(A.plan.title, { plan: A.plans[f.plan] })}</span>
          <Link href={`/app/billing?plan=${f.plan}`} className="font-semibold text-brand-deep underline">
            {fmt(A.plan.cta, { plan: A.plans[f.plan] })}
          </Link>
        </div>
      </Card>
    );
  if (!f.on)
    return (
      <Card padding="lg" className="flex flex-col gap-3" data-testid="album-card">
        {head}
        <p className="text-[13px] text-muted">{A.off.title}</p>
        <div>
          <Button size="sm" icon={<BookHeart />} loading={busy} onClick={() => void switchOn()}>
            {A.off.cta}
          </Button>
        </div>
      </Card>
    );

  return (
    <Card padding="lg" className="flex flex-col gap-4" data-testid="album-card">
      {head}
      {!a ? (
        <p className="rounded-input bg-subtle px-3 py-2.5 text-[13px] text-muted">{A.card.noGallery}</p>
      ) : (
        <>
          <p className="text-[13px] font-semibold" data-testid="album-counts">
            {fmt(A.card.photos, { photos: number(view.counts.images), videos: number(view.counts.videos) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {a.url ? (
              <Hint text={A.card.openHint}>
                <Button size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
                  <a href={a.url} target="_blank" rel="noreferrer" data-testid="album-open" lang={locale}>
                    {A.card.open}
                  </a>
                </Button>
              </Hint>
            ) : null}
            <Hint text={A.card.sendHint}>
              <Button
                size="sm"
                variant="whatsapp"
                icon={<Send className="icon-dir" />}
                onClick={() => setSending(true)}
                disabled={!a.enabled}
                data-testid="album-send"
              >
                {A.card.send}
              </Button>
            </Hint>
            {a.url ? (
              <>
                <Hint text={A.card.whatsappHint}>
                  <Button size="sm" variant="secondary" icon={<MessageCircle />} onClick={whatsapp}>
                    {A.card.whatsapp}
                  </Button>
                </Hint>
                <Button size="sm" variant="secondary" icon={<Copy />} onClick={() => void copy()}>
                  {A.card.copy}
                </Button>
              </>
            ) : null}
            {a.state === 'soon' ? (
              <Hint text={A.card.openNowHint}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Sparkles />}
                  loading={busy}
                  onClick={() => void openNow()}
                >
                  {A.card.openNow}
                </Button>
              </Hint>
            ) : null}
            <Hint text={A.card.editHint}>
              <Button size="sm" variant="ghost" icon={<Pencil />} asChild>
                <Link href={`/app/invitations/${view.id}/gallery/album`} data-testid="album-edit">
                  {A.card.edit}
                </Link>
              </Button>
            </Hint>
          </div>
          <SendLinkDialog id={view.id} open={sending} onOpenChange={setSending} kind="album" />
        </>
      )}
    </Card>
  );
}
