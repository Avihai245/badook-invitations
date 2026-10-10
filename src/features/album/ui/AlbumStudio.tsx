'use client';
/* eslint-disable @next/next/no-img-element -- the gallery's photos come from short-lived signed URLs of private storage */

import {
  BookHeart,
  CalendarClock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Images,
  Layers,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  Star,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaHelp,
  Badge,
  Button,
  Card,
  CardTitle,
  Dialog,
  Hint,
  Input,
  L10nTabs,
  PageHeader,
  Segmented,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from '@/components/app';
import type { Locale } from '@/features/invitations/contracts/types';
import { hostApi, loginUrl } from '@/features/invitations/app/api';
import { nativeName } from '@/features/invitations/lib/locales';
import { SendLinkDialog } from '@/features/live-gallery/ui/host/SendLinkDialog';
import { ALBUM_GUEST } from '@/lib/i18n/album-guest';
import { fmt as format } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n/guest';
import { ALBUM } from '../config';
import { ALBUM_SHARE_MESSAGE, albumLinkIn } from '../messages';
import type { AlbumLayout, HostAlbumView, StudioItem } from '../types';

type Help = ReturnType<typeof useUi>['t']['album']['help']['items'];
const HELP_ICONS: Record<keyof Help, LucideIcon> = {
  when: CalendarClock,
  what: Images,
  design: Layers,
  share: Share2,
};

/**
 * The album's studio (/app/invitations/:id/gallery/album, feature album): when it opens and whether it
 * can be viewed, videos and chapters, the title and the thank-you letter in each of the invitation's
 * languages (empty: the event type's own words), the cover and the photos left out, the link with its
 * QR code (and a new one), and the thank-you to every guest. Every change saves at once.
 */
export function AlbumStudio({ initial }: { initial: HostAlbumView }) {
  const { t, fmt, date, plural, number } = useUi();
  const A = t.album;
  const S = A.studio;
  const { toast } = useToast();
  const [view, setView] = useState(initial);
  const a = view.album!;
  const id = view.id;

  const patch = useCallback(
    async (body: Record<string, unknown>, done?: string) => {
      const res = await hostApi<{ view?: HostAlbumView }>(`/api/invitations/${id}/album`, {
        method: 'PATCH',
        body,
      });
      if (res.status === 401) {
        window.location.assign(loginUrl());
        return false;
      }
      if (!res.ok || !res.body?.view) {
        toast({ title: S.failed, variant: 'danger' });
        return false;
      }
      setView(res.body.view);
      if (done) toast({ title: done, variant: 'success' });
      return true;
    },
    [id, S.failed, toast],
  );

  // ── the photos ──
  const [items, setItems] = useState<StudioItem[] | null>(null);
  const [layout, setLayout] = useState<AlbumLayout | null>(null);
  const loadItems = useCallback(async () => {
    const res = await hostApi<{ items: StudioItem[]; layout: AlbumLayout }>(
      `/api/invitations/${id}/album/items`,
    );
    if (res.ok && res.body) {
      setItems(res.body.items);
      setLayout(res.body.layout);
    } else setItems([]);
  }, [id]);
  useEffect(() => {
    void loadItems();
  }, [loadItems]);
  const hidden = useMemo(() => new Set(a.hiddenItems), [a.hiddenItems]);
  const highlights = useMemo(() => new Set(layout?.highlights ?? []), [layout]);
  const toggleHidden = async (itemId: string) => {
    const next = hidden.has(itemId) ? a.hiddenItems.filter((x) => x !== itemId) : [...a.hiddenItems, itemId];
    if (await patch({ hiddenItems: next })) void loadItems();
  };
  const setCover = async (itemId: string | null) => {
    if (await patch({ coverItemId: itemId })) void loadItems();
  };

  // ── the words ──
  const locales = view.event.locales;
  const [wordsLocale, setWordsLocale] = useState<Locale>(view.event.defaultLocale);
  const [title, setTitle] = useState(a.title);
  const [message, setMessage] = useState(a.message);
  const [saving, setSaving] = useState(false);
  const dirty =
    JSON.stringify(title) !== JSON.stringify(a.title) ||
    JSON.stringify(message) !== JSON.stringify(a.message);
  const saveWords = async () => {
    setSaving(true);
    await patch({ title, message }, S.saved);
    setSaving(false);
  };
  const defaultMessage = fill(ALBUM_GUEST[wordsLocale].message, {
    event: view.event.phrase[wordsLocale] ?? '',
  });

  // ── the link ──
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [sending, setSending] = useState(false);
  const rotate = async () => {
    setRotating(true);
    const res = await hostApi<{ view?: HostAlbumView }>(`/api/invitations/${id}/album/rotate`, {
      method: 'POST',
      body: {},
    });
    setRotating(false);
    setConfirmRotate(false);
    if (res.ok && res.body?.view) setView(res.body.view);
    else toast({ title: S.failed, variant: 'danger' });
  };
  const copy = () =>
    a.url &&
    navigator.clipboard.writeText(a.url).then(
      () => toast({ title: A.card.copied, variant: 'success' }),
      () => toast({ title: A.card.copyFailed, variant: 'danger' }),
    );
  const whatsapp = () => {
    if (!a.url) return;
    const l = view.event.defaultLocale;
    const text = format(ALBUM_SHARE_MESSAGE[l], {
      event: view.event.phrase[l] ?? '',
      hosts: view.event.names[l] ?? '',
      url: albumLinkIn(a.url, l, l),
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const qrDownload = (kind: 'png' | 'svg') => {
    if (!a.qr) return;
    const href =
      kind === 'png' ? a.qr.png : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.qr.svg)}`;
    const link = document.createElement('a');
    link.href = href;
    link.download = `album-${view.slug}.${kind}`;
    link.click();
  };

  const morning =
    a.opensAt && !a.custom
      ? date(a.opensAt, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  const help = (
    <AreaHelp
      label={t.common.helpLabel}
      title={A.help.title}
      items={(Object.keys(A.help.items) as (keyof Help)[]).map((key) => {
        const Icon = HELP_ICONS[key];
        return { icon: <Icon />, label: A.help.items[key].label, text: A.help.items[key].text };
      })}
    />
  );
  const coverId = layout?.cover ?? null;

  return (
    <div className="mx-auto max-w-[1760px] px-4 pt-6 pb-16 sm:px-6" data-testid="album-studio">
      <PageHeader
        size="section"
        title={A.title}
        help={help}
        description={A.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Images />} asChild>
              <Link href={`/app/invitations/${id}/gallery`}>{A.back}</Link>
            </Button>
            <Badge variant={a.state === 'open' ? 'live' : a.state === 'soon' ? 'info' : 'neutral'}>
              {a.state === 'soon' && a.opensAt
                ? fmt(A.state.soon, {
                    date: date(a.opensAt, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : A.state[a.state]}
            </Badge>
            {a.url ? (
              <Button icon={<ExternalLink className="icon-dir" />} asChild>
                <a href={a.url} target="_blank" rel="noreferrer">
                  {A.card.open}
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <Card padding="lg" className="flex flex-col gap-4" data-testid="album-settings">
          <CardTitle as="h2">{S.settings}</CardTitle>
          <Row label={S.enabled} hint={S.enabledHint}>
            <Switch
              label={S.enabled}
              checked={a.enabled}
              onCheckedChange={(on) => void patch({ enabled: on })}
            />
          </Row>
          <div>
            <p className="mb-1.5 text-[13.5px] font-semibold">{S.opens}</p>
            <Segmented<'morning' | 'now'>
              label={S.opens}
              value={a.custom ? 'now' : 'morning'}
              onValueChange={(v) =>
                void patch(
                  { opensAt: v === 'now' ? new Date().toISOString() : null },
                  v === 'now' ? A.card.opened : undefined,
                )
              }
              options={[
                { value: 'morning', label: S.opensMorning },
                { value: 'now', label: S.opensNow },
              ]}
            />
            {morning ? (
              <p className="mt-1.5 text-[12.5px] text-muted">{fmt(S.opensHint, { date: morning })}</p>
            ) : null}
          </div>
          <Row label={S.videos} hint={S.videosHint}>
            <Switch
              label={S.videos}
              checked={a.showVideos}
              onCheckedChange={(on) =>
                void patch({ showVideos: on }).then((ok) => {
                  if (ok) void loadItems();
                })
              }
            />
          </Row>
          <Row label={S.chapters} hint={S.chaptersHint}>
            <Switch
              label={S.chapters}
              checked={a.chapters}
              onCheckedChange={(on) => void patch({ chapters: on })}
            />
          </Row>
        </Card>

        <Card padding="lg" className="flex flex-col gap-4" data-testid="album-link">
          <div>
            <CardTitle as="h2" className="mb-1">
              {S.link}
            </CardTitle>
            <p className="text-[13px] text-muted">{S.linkHint}</p>
          </div>
          {a.url ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={a.url}
                  dir="ltr"
                  textAlign="start"
                  onFocus={(e) => e.target.select()}
                  data-testid="album-link-url"
                />
                <Button variant="secondary" icon={<Copy />} onClick={() => void copy()}>
                  {t.common.copy}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Hint text={A.card.sendHint}>
                  <Button
                    size="sm"
                    variant="whatsapp"
                    icon={<Send className="icon-dir" />}
                    disabled={!a.enabled}
                    onClick={() => setSending(true)}
                  >
                    {A.card.send}
                  </Button>
                </Hint>
                <Hint text={A.card.whatsappHint}>
                  <Button size="sm" variant="secondary" icon={<MessageCircle />} onClick={whatsapp}>
                    {A.card.whatsapp}
                  </Button>
                </Hint>
                <Button size="sm" variant="ghost" icon={<Download />} onClick={() => qrDownload('png')}>
                  {S.qrPng}
                </Button>
                <Button size="sm" variant="ghost" icon={<Download />} onClick={() => qrDownload('svg')}>
                  {S.qrSvg}
                </Button>
                <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setConfirmRotate(true)}>
                  {S.rotate}
                </Button>
              </div>
              {a.qr ? (
                <span
                  className="block size-36 self-start rounded-[12px] border border-line bg-white p-2"
                  role="img"
                  aria-label={S.link}
                  // the qrcode library's own SVG markup, made by our server from the album's link
                  dangerouslySetInnerHTML={{ __html: a.qr.svg }}
                />
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] text-warning">{S.lost}</p>
              <Button
                size="sm"
                variant="secondary"
                icon={<RefreshCw />}
                onClick={() => setConfirmRotate(true)}
              >
                {S.rotate}
              </Button>
            </div>
          )}
        </Card>

        <Card padding="lg" className="flex flex-col gap-4 lg:col-span-2" data-testid="album-words">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle as="h2" className="mb-1">
                {S.words}
              </CardTitle>
              <p className="text-[13px] text-muted">{S.wordsHint}</p>
            </div>
            {locales.length > 1 ? (
              <L10nTabs<Locale>
                label={S.language}
                value={wordsLocale}
                onValueChange={setWordsLocale}
                missingLabel={S.missing}
                options={locales.map((l) => ({
                  value: l,
                  label: t.editor.languageShort[l],
                  ariaLabel: nativeName(l),
                  lang: l,
                }))}
              />
            ) : null}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[13.5px] font-semibold">{S.titleLabel}</span>
            <Input
              lang={wordsLocale}
              dir={wordsLocale === 'he' || wordsLocale === 'ar' ? 'rtl' : 'ltr'}
              value={title[wordsLocale] ?? ''}
              placeholder={view.event.names[wordsLocale] ?? ''}
              maxLength={ALBUM.text.title}
              onChange={(e) => setTitle({ ...title, [wordsLocale]: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13.5px] font-semibold">{S.messageLabel}</span>
            <Textarea
              lang={wordsLocale}
              dir={wordsLocale === 'he' || wordsLocale === 'ar' ? 'rtl' : 'ltr'}
              rows={4}
              value={message[wordsLocale] ?? ''}
              placeholder={defaultMessage}
              maxLength={ALBUM.text.message}
              onChange={(e) => setMessage({ ...message, [wordsLocale]: e.target.value })}
            />
          </label>
          <div>
            <Button disabled={!dirty} loading={saving} onClick={() => void saveWords()}>
              {S.save}
            </Button>
          </div>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="album-photos">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="album-photos" className="text-[18px] font-bold">
              {S.photos}
            </h2>
            <p className="text-[13px] text-muted">{S.photosHint}</p>
          </div>
          {a.hiddenItems.length ? (
            <span className="text-[13px] text-muted">
              {plural(S.hidden, a.hiddenItems.length, { n: number(a.hiddenItems.length) })}
            </span>
          ) : null}
        </div>
        {!items ? (
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8"
            aria-busy="true"
            aria-label={S.loading}
          >
            {Array.from({ length: 16 }, (_, k) => (
              <Skeleton key={k} height={120} radius={10} />
            ))}
          </div>
        ) : !items.length ? (
          <p className="rounded-input bg-subtle px-3 py-3 text-[13.5px] text-muted">{S.empty}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8" data-testid="album-photos">
            {items.map((p) => {
              const isHidden = hidden.has(p.id);
              const isCover = coverId === p.id;
              return (
                <li
                  key={p.id}
                  className={`group relative aspect-square overflow-hidden rounded-[10px] bg-subtle ${isHidden ? 'opacity-40' : ''} ${isCover ? 'ring-2 ring-brand ring-offset-2' : ''}`}
                  data-album-photo={p.id}
                  data-hidden={isHidden || undefined}
                >
                  {p.thumb ? (
                    <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover" />
                  ) : null}
                  <span className="absolute inset-x-1 top-1 flex flex-wrap gap-1">
                    {isCover ? (
                      <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-semibold text-white">
                        {S.cover}
                        {!a.coverItemId ? ` · ${S.coverAuto}` : ''}
                      </span>
                    ) : highlights.has(p.id) ? (
                      <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-semibold text-white">
                        {S.highlight}
                      </span>
                    ) : null}
                  </span>
                  <span className="absolute inset-x-1 bottom-1 flex justify-between">
                    {p.kind === 'image' && !isHidden ? (
                      <button
                        type="button"
                        className="grid size-8 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
                        aria-label={isCover && a.coverItemId ? S.autoCover : S.setCover}
                        title={isCover && a.coverItemId ? S.autoCover : S.setCover}
                        aria-pressed={isCover}
                        onClick={() => void setCover(isCover && a.coverItemId ? null : p.id)}
                      >
                        <Star aria-hidden className={`size-4 ${isCover ? 'fill-current' : ''}`} />
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
                      aria-label={isHidden ? S.show : S.hide}
                      title={isHidden ? S.show : S.hide}
                      aria-pressed={isHidden}
                      onClick={() => void toggleHidden(p.id)}
                    >
                      {isHidden ? (
                        <Eye aria-hidden className="size-4" />
                      ) : (
                        <EyeOff aria-hidden className="size-4" />
                      )}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SendLinkDialog id={id} open={sending} onOpenChange={setSending} kind="album" />
      <Dialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={S.rotateTitle}
        description={S.rotateBody}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRotate(false)}>
              {t.common.cancel}
            </Button>
            <Button loading={rotating} icon={<BookHeart />} onClick={() => void rotate()}>
              {S.rotateConfirm}
            </Button>
          </>
        }
      />
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="text-[12.5px] text-muted">{hint}</p>
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}
