'use client';
/* eslint-disable @next/next/no-img-element -- the album's photos come from short-lived signed URLs of private storage: nothing for the image optimizer to cache */

import { ArrowDown, ArrowUp, Check, Download, Globe, Play, Share2, Sparkles } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { BrandLogo } from '@/components/app/BrandLogo';
import { RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { DAY_MONTH_YEAR, formatDate } from '@/features/invitations/lib/dates';
import { nativeName } from '@/features/invitations/lib/locales';
import { galleryApi } from '@/features/live-gallery/client/api';
import { downloadAll } from '@/features/live-gallery/client/download';
import { MediaViewer } from '@/features/live-gallery/ui/MediaViewer';
import { ALBUM_GUEST } from '@/lib/i18n/album-guest';
import { fill, localeText } from '@/lib/i18n/guest';
import { ALBUM } from '../config';
import { aspectOf, justifyRows, type AlbumChapter } from '../model';
import type { AlbumPageData, AlbumPhoto } from '../types';

/**
 * The album (/e/<slug>/album?a=…): the morning after the event, everything guests shared in the
 * gallery as one designed page in the invitation's own colors and fonts — a full-screen cover with the
 * names, the hosts' thank-you, the best moments as a mosaic, then the evening chapter by chapter in
 * justified rows (a photo opens full screen: swipe, download, share), and a closing "thank you". Every
 * one of the invitation's languages, switched in place. A page left open asks for fresh photo links
 * before they run out.
 */
export function AlbumView({
  data,
  token,
  lang,
}: {
  data: AlbumPageData;
  token: string;
  lang: Locale | null;
}) {
  const e = data.event;
  const [locale, setLocale] = useState<Locale>(lang && e.locales.includes(lang) ? lang : e.defaultLocale);
  const text = useMemo(() => localeText(locale, ALBUM_GUEST[locale]), [locale]);
  const { t, dir, plural } = text;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  // the photos, with links refreshed before they expire
  const [items, setItems] = useState<AlbumPhoto[]>(data.items);
  const [expiresAt, setExpiresAt] = useState(data.expiresAt);
  useEffect(() => {
    if (data.state !== 'open' || !expiresAt) return;
    const wait = Math.max(30_000, expiresAt - ALBUM.urls.refreshBeforeSeconds * 1000 - Date.now());
    const timer = window.setTimeout(async () => {
      const res = await galleryApi<{ items: AlbumPhoto[]; expiresAt: number }>('/api/gallery/album', {
        a: token,
      });
      if (!res.ok || !res.body) return;
      const fresh = new Map(res.body.items.map((i) => [i.id, i]));
      setItems((list) => list.map((i) => fresh.get(i.id) ?? i));
      setExpiresAt(res.body.expiresAt);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [expiresAt, token, data.state]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const chapters = data.layout.chapters.filter((c) => c.ids.some((id) => byId.has(id)));
  // the viewer goes through the album in its order: chapter by chapter
  const order = useMemo(() => chapters.flatMap((c) => c.ids.filter((id) => byId.has(id))), [chapters, byId]);
  const [open, setOpen] = useState<number | null>(null);
  const openId = (id: string) => {
    const k = order.indexOf(id);
    if (k >= 0) setOpen(k);
  };
  const viewerItems = useMemo(() => order.map((id) => byId.get(id)!), [order, byId]);

  const names = e.names[locale] || e.names[e.defaultLocale] || '';
  const title = data.title[locale] || names;
  const phrase = e.phrase[locale] ?? e.phrase[e.defaultLocale] ?? '';
  const message = data.message[locale] || fill(t.message, { event: phrase });
  const photos = items.filter((i) => i.kind === 'image').length;
  const videos = items.length - photos;
  const cover = data.layout.cover ? byId.get(data.layout.cover) : undefined;
  const highlights = data.layout.highlights.map((id) => byId.get(id)).filter((i): i is AlbumPhoto => !!i);
  let date = '';
  try {
    date = formatDate(e.date, locale, DAY_MONTH_YEAR);
  } catch {
    date = e.date;
  }

  const style = {
    '--album-bg': e.palette.bg,
    '--album-surface': e.palette.surface,
    '--album-ink': e.palette.ink,
    '--album-muted': e.palette.inkMuted,
    '--album-accent': e.palette.accent,
    '--album-accent-ink': e.palette.accentInk,
    '--album-line': e.palette.line,
    '--album-display': e.fonts.display[locale] ?? e.fonts.display[e.defaultLocale] ?? 'serif',
    '--album-heading': e.fonts.heading[locale] ?? e.fonts.heading[e.defaultLocale] ?? 'system-ui',
  } as CSSProperties;

  // ── share and download ──
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const share = async () => {
    const url = window.location.href;
    const shareText = fill(t.shareText, { event: phrase });
    try {
      if (navigator.share) {
        await navigator.share({ title: title || t.eyebrow, text: shareText, url });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t.copied);
    } catch {
      setNotice(t.failed);
    }
  };
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);
  const downloadAlbum = async () => {
    const files = order
      .map((id) => byId.get(id)!)
      .map((p, k) => ({ p, k }))
      .filter(({ p }) => (p.kind === 'video' ? p.video : p.display));
    if (!files.length) return;
    setDownloading({ done: 0, total: files.length });
    try {
      await downloadAll({
        filename: (title || t.eyebrow).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-'),
        streamToDisk: false,
        signal: new AbortController().signal,
        missingListName: t.missingName,
        missingIntro: t.missingIntro,
        onProgress: (p) => setDownloading({ done: p.files, total: p.total }),
        page: async () => ({
          files: files.map(({ p, k }) => ({
            id: p.id,
            name: `${String(k + 1).padStart(4, '0')}_${p.id.slice(0, 8)}.${p.kind === 'video' ? 'mp4' : 'jpg'}`,
            url: (p.kind === 'video' ? p.video : p.display)!,
            size: 0,
            date: p.at,
            partial: false,
          })),
          next: null,
          total: files.length,
          bytes: 0,
        }),
      });
      setNotice(t.downloaded);
    } catch {
      setNotice(t.failed);
    } finally {
      setDownloading(null);
    }
  };
  const downloadOne = async (p: AlbumPhoto) => {
    const url = p.kind === 'video' ? p.video : p.display;
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${p.id.slice(0, 8)}.${p.kind === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

  const others = e.locales.filter((l) => l !== locale);
  const languageSwitch =
    others.length === 1 ? (
      <button type="button" className="album-chip" lang={others[0]} onClick={() => setLocale(others[0]!)}>
        <Globe aria-hidden className="size-4" />
        {nativeName(others[0]!)}
      </button>
    ) : others.length > 1 ? (
      <label className="album-chip">
        <Globe aria-hidden className="size-4" />
        <select
          aria-label={t.language}
          value={locale}
          onChange={(ev) => setLocale(ev.target.value as Locale)}
          className="cursor-pointer appearance-none bg-transparent font-semibold text-inherit outline-none"
        >
          {[locale, ...others].map((l) => (
            <option key={l} value={l} lang={l} className="text-black">
              {nativeName(l)}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  const stats = [
    photos ? plural(t.stats.photos, photos) : null,
    videos ? plural(t.stats.videos, videos) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="album" style={style} dir={dir} data-testid="album">
      <header className="album-cover" data-testid="album-cover">
        {cover?.display ? (
          <img className="album-cover-img" src={cover.display} alt="" fetchPriority="high" decoding="async" />
        ) : null}
        <div className="album-bar">
          {languageSwitch}
          {data.state === 'open' ? (
            <button
              type="button"
              className="album-chip"
              onClick={() => void share()}
              data-testid="album-share"
            >
              <Share2 aria-hidden className="size-4" />
              {t.share}
            </button>
          ) : null}
        </div>
        <div className="album-cover-inner">
          <p className="album-eyebrow album-rise">{[t.eyebrow, date].filter(Boolean).join(' · ')}</p>
          <h1 className="album-names album-display album-rise album-rise-2 mt-4">
            <bdi>{title}</bdi>
          </h1>
          {data.state === 'open' && stats ? (
            <p className="album-rise album-rise-3 mt-4 text-[14px] opacity-90">{stats}</p>
          ) : null}
          {data.state === 'open' && items.length ? (
            <a className="album-enter album-rise album-rise-3" href="#album-letter">
              {t.enter}
              <ArrowDown aria-hidden className="size-5 motion-safe:animate-bounce" />
            </a>
          ) : null}
        </div>
      </header>

      {data.state === 'soon' ? (
        <section className="album-notice" data-testid="album-soon">
          <span className="album-ornament" aria-hidden />
          <h2 className="album-display text-[30px] leading-tight">{t.soon.title}</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-[var(--album-muted)]">
            {fill(t.soon.body, {
              date: data.opensAt
                ? text.date(data.opensAt, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: e.timezone,
                  })
                : '',
            })}
          </p>
        </section>
      ) : (
        <main>
          <section className="album-letter" id="album-letter" aria-label={t.thanks}>
            <span className="album-ornament" aria-hidden />
            <p data-testid="album-message">{message}</p>
            {names ? (
              <p className="album-signature album-display">
                <span className="block text-[15px] font-normal text-[var(--album-muted)]">{t.love},</span>
                <bdi>{names}</bdi>
              </p>
            ) : null}
          </section>

          {!items.length ? (
            <section className="album-notice mt-0!" data-testid="album-empty">
              <h2 className="album-display text-[26px]">{t.empty.title}</h2>
              <p className="mt-2 text-[15px] text-[var(--album-muted)]">{t.empty.body}</p>
            </section>
          ) : null}

          {highlights.length ? (
            <section className="album-section" aria-labelledby="album-highlights">
              <div className="album-heading">
                <h2 id="album-highlights" className="album-display">
                  {t.highlights}
                </h2>
              </div>
              <div className="album-mosaic" data-testid="album-highlights">
                {highlights.map((p, k) => (
                  <Tile
                    key={p.id}
                    photo={p}
                    label={tileLabel(t, p, k + 1)}
                    onOpen={() => openId(p.id)}
                    large={k === 0}
                    aiLabel={t.ai}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {chapters.map((c) => (
            <Chapter
              key={c.key}
              chapter={c}
              title={chapterTitle(c, chapters.length, locale, e.defaultLocale, t.chapters)}
              time={chapterTime(c, locale, e.timezone)}
              photos={c.ids.map((id) => byId.get(id)).filter((p): p is AlbumPhoto => !!p)}
              onOpen={openId}
              text={text}
            />
          ))}

          {items.length ? (
            <section className="album-end" aria-labelledby="album-end">
              <span className="album-ornament" aria-hidden />
              <h2 id="album-end" className="album-display">
                {t.thanks}
              </h2>
              {names ? (
                <p className="album-display mt-4 text-[22px] text-[var(--album-accent)]">
                  <bdi>{names}</bdi>
                </p>
              ) : null}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button type="button" className="album-button" onClick={() => void share()}>
                  <Share2 aria-hidden className="size-[18px]" />
                  {t.share}
                </button>
                <button
                  type="button"
                  className="album-button"
                  data-variant="ghost"
                  disabled={!!downloading}
                  onClick={() => void downloadAlbum()}
                  data-testid="album-download"
                >
                  <Download aria-hidden className="size-[18px]" />
                  {downloading
                    ? fill(t.downloading, { done: downloading.done, total: downloading.total })
                    : t.downloadAll}
                </button>
              </div>
              <button
                type="button"
                className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--album-muted)]"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <ArrowUp aria-hidden className="size-4" />
                {t.top}
              </button>
            </section>
          ) : null}
        </main>
      )}

      <footer className="album-footer">
        <a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-2 no-underline!">
          <BrandLogo label={data.brand} className="text-[18px]" lazy />
        </a>
        <p className="mt-2">{fill(t.made, { brand: data.brand })}</p>
        <p className="mt-1">
          <a href="/" target="_blank" rel="noopener">
            {t.makeYours}
          </a>
        </p>
      </footer>

      {notice ? (
        <p
          role="status"
          className="fixed inset-x-4 bottom-[max(20px,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] items-center justify-center gap-2 rounded-full bg-black/80 px-4 py-3 text-center text-[14px] font-medium text-white shadow-lg"
        >
          <Check aria-hidden className="size-4" />
          {notice}
        </p>
      ) : null}

      {open !== null && viewerItems[open] ? (
        <MediaViewer
          items={viewerItems}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          dir={dir}
          labels={t.viewer}
          footer={(p) => (
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-white/90">
              <span className="flex items-center gap-2">
                {p.ai ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] font-semibold">
                    <Sparkles aria-hidden className="size-3" />
                    {t.ai}
                  </span>
                ) : null}
                {p.name ? <span>{fill(t.by, { name: p.name })}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => void downloadOne(p)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 font-semibold hover:bg-white/25"
              >
                <Download aria-hidden className="size-4" />
                {t.downloadOne}
              </button>
            </div>
          )}
        />
      ) : null}
    </div>
  );
}

type Text = ReturnType<typeof localeText<(typeof ALBUM_GUEST)['he']>>;

const tileLabel = (t: Text['t'], p: AlbumPhoto, n: number) =>
  fill(t.open, { kind: p.kind === 'video' ? t.video : t.photo, n });

/** A chapter's title in the page's language: the timeline's words, an automatic chapter's name. */
function chapterTitle(
  c: AlbumChapter,
  count: number,
  locale: Locale,
  fallback: Locale,
  names: Text['t']['chapters'],
): string | null {
  if (c.label) return c.label[locale] || c.label[fallback] || Object.values(c.label).find(Boolean) || null;
  if (c.auto) return names[c.auto];
  return count === 1 ? names.all : null;
}

/** The time a chapter starts, in the event's time zone: the timeline's, else its first photo's. */
function chapterTime(c: AlbumChapter, locale: Locale, timeZone: string): string | null {
  if (c.time) return c.time;
  if (!c.start) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).format(new Date(c.start));
  } catch {
    return null;
  }
}

function Tile({
  photo,
  label,
  onOpen,
  large = false,
  aiLabel,
  style,
}: {
  photo: AlbumPhoto;
  label: string;
  onOpen(): void;
  large?: boolean;
  aiLabel: string;
  style?: CSSProperties;
}) {
  const src = large ? (photo.display ?? photo.thumb) : (photo.thumb ?? photo.display);
  return (
    <button
      type="button"
      className="album-tile"
      onClick={onOpen}
      aria-label={label}
      style={style}
      data-album-item={photo.id}
    >
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : null}
      {photo.kind === 'video' ? (
        <span className="album-badge">
          <Play aria-hidden className="size-3 fill-current" />
          {photo.durationMs
            ? `${Math.floor(photo.durationMs / 60000)}:${String(Math.round((photo.durationMs % 60000) / 1000)).padStart(2, '0')}`
            : null}
        </span>
      ) : null}
      {photo.ai ? (
        <span className="album-badge album-badge-top">
          <Sparkles aria-hidden className="size-3" />
          {aiLabel}
        </span>
      ) : null}
    </button>
  );
}

/** The width of an element, followed as it changes (0 before the first layout). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Chapter({
  chapter,
  title,
  time,
  photos,
  onOpen,
  text,
}: {
  chapter: AlbumChapter;
  title: string | null;
  time: string | null;
  photos: AlbumPhoto[];
  onOpen(id: string): void;
  text: Text;
}) {
  const { t, plural } = text;
  const [ref, width] = useWidth<HTMLDivElement>();
  const [shown, setShown] = useState<number>(ALBUM.layout.pageSize);
  const visible = photos.slice(0, shown);
  const target = width < 640 ? ALBUM.layout.rowHeight.narrow : ALBUM.layout.rowHeight.wide;
  const rows = useMemo(
    () =>
      justifyRows(
        visible.map((p) => ({ id: p.id, aspect: aspectOf(p.width, p.height) })),
        width,
        target,
        ALBUM.layout.gap,
      ),
    [visible, width, target],
  );
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const onOpenCb = useCallback((id: string) => onOpen(id), [onOpen]);
  const counts = [
    plural(t.stats.photos, photos.filter((p) => p.kind === 'image').length),
    photos.some((p) => p.kind === 'video')
      ? plural(t.stats.videos, photos.filter((p) => p.kind === 'video').length)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const left = photos.length - visible.length;
  return (
    <section className="album-section" aria-label={title ?? undefined} data-album-chapter={chapter.key}>
      {title || time ? (
        <div className="album-heading">
          {time ? <span className="album-time">{time}</span> : null}
          {title ? <h2 className="album-display">{title}</h2> : null}
          <span className="album-count">{counts}</span>
        </div>
      ) : null}
      <div ref={ref} className="album-rows">
        {width > 0
          ? rows.map((row, k) => (
              <div key={k} className="album-row" style={{ height: row.height }}>
                {row.items.map((cell) => {
                  const p = byId.get(cell.id)!;
                  return (
                    <Tile
                      key={cell.id}
                      photo={p}
                      label={tileLabel(t, p, photos.indexOf(p) + 1)}
                      onOpen={() => onOpenCb(cell.id)}
                      aiLabel={t.ai}
                      style={
                        row.full
                          ? { flex: `${cell.width} 1 0px`, height: '100%' }
                          : { flex: 'none', width: cell.width, height: '100%' }
                      }
                    />
                  );
                })}
              </div>
            ))
          : null}
      </div>
      {left > 0 ? (
        <div className="album-more">
          <button
            type="button"
            className="album-button"
            data-variant="ghost"
            onClick={() => setShown((n) => n + ALBUM.layout.pageSize * 2)}
          >
            {plural(t.showAll, left)}
          </button>
        </div>
      ) : null}
    </section>
  );
}
