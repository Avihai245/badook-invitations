'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CircleAlert,
  Globe,
  ImagePlus,
  LayoutGrid,
  Rows3,
  Lock,
  LoaderCircle,
  MapPin,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { BrandLogo } from '@/components/app/BrandLogo';
import { AccessibilityPanel } from '@/features/site/AccessibilityMenu.client';
import { RTL_LOCALES } from '@/features/invitations/contracts/types';
import { nativeName } from '@/features/invitations/lib/locales';
import { BADOOK_EVENTS_URL } from '@/features/site/links';
import { UploadFaceIndexer } from '@/features/faces/client/upload-indexer';
import { FaceSearch } from '@/features/faces/ui/FaceSearch';
import { GALLERY } from '../../config';
import { galleryApi } from '../../client/api';
import { openStore, type QueueStore } from '../../client/idb';
import { useLiveRefresh } from '@/lib/live/client';
import { Uploader, randomToken, type AddResult, type Snapshot } from '../../client/uploader';
import type {
  FeedItem,
  FeedResponse,
  GalleryState,
  Likes,
  MineItem,
  Placement,
  RealtimeInfo,
} from '../../types';
import type { GuestPageData } from '../../server/pages';
import { MediaViewer } from '../MediaViewer';
import { GuestTextProvider, fmt, formatBytes, useGuestText, type GuestLocale } from '../guest-text';
import { FeedGrid } from './FeedGrid';
import { FeedPost } from './FeedPost';
import { groupPosts, isStory, mergeLikes, toggled, type Post } from './posts';
import { QueuePanel } from './QueuePanel';
import { ShareSheet } from './ShareSheet';
import { StoriesTray } from './StoriesTray';
import { StoryViewer } from './StoryViewer';
import { groupStories, isUnseen, readSeen, writeSeen, type Story } from './stories';

/**
 * The guests' page of the live gallery (/e/<slug>/upload?t=…): no sign-up, no app. Pick photos and
 * videos (or take one), and they are prepared on the phone, saved in a queue that survives a lost
 * connection or a closed page, and uploaded in the background with a clear "3 of 7 uploaded". Below,
 * the event's feed — live — with a full-screen story view; and what this phone uploaded that isn't in
 * the feed (awaiting approval…), each deletable. An access code, the upload window and the hosts'
 * pause are respected.
 */
export function GuestGallery({
  data,
  token,
  guest,
  lang,
}: {
  data: GuestPageData;
  token: string;
  guest: string | null;
  lang: GuestLocale | null;
}) {
  const initial: GuestLocale =
    lang && data.event.locales.includes(lang) ? lang : (data.event.defaultLocale as GuestLocale);
  const [locale, setLocale] = useState<GuestLocale>(initial);
  // the page's language and direction (the layout set the invitation's default)
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);
  return (
    <GuestTextProvider locale={locale}>
      <GalleryBody
        data={data}
        token={token}
        guest={guest}
        others={data.event.locales.filter((l) => l !== locale)}
        onLocale={setLocale}
      />
    </GuestTextProvider>
  );
}

type Phase = 'code' | 'ready' | 'invalid' | 'off';

function GalleryBody({
  data,
  token,
  guest,
  others,
  onLocale,
}: {
  data: GuestPageData;
  token: string;
  guest: string | null;
  /** the invitation's other languages */
  others: GuestLocale[];
  onLocale(l: GuestLocale): void;
}) {
  const text = useGuestText();
  const { t, locale, dir, plural, number, date } = text;
  const title = data.event.titles[locale] || data.event.title;
  const accent = {
    '--gallery-accent': data.event.accent,
    '--gallery-accent-ink': data.event.accentInk,
  } as CSSProperties;

  const [phase, setPhase] = useState<Phase>(data.state === 'off' ? 'off' : data.needsCode ? 'code' : 'ready');
  const [state, setState] = useState<GalleryState>(data.state);
  const [mode, setMode] = useState(data.mode);
  const [opensAt, setOpensAt] = useState(data.opensAt);
  const [items, setItems] = useState<FeedItem[]>(data.initial?.items ?? []);
  const [next, setNext] = useState<FeedResponse['next']>(data.initial?.next ?? null);
  const [realtime, setRealtime] = useState<RealtimeInfo | null>(data.initial?.realtime ?? null);
  const [mine, setMine] = useState<MineItem[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  // the stories: which person's is open, and what this phone has already watched
  const [storyOpen, setStoryOpen] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>({});
  useEffect(() => setSeen(readSeen(token)), [token]);
  const [loadingMore, setLoadingMore] = useState(false);
  // the feed's posts and their likes; the feed as posts, or every photo in a grid
  const [likes, setLikes] = useState<Record<string, Likes>>(data.initial?.likes ?? {});
  const [view, setView] = useState<'feed' | 'grid'>('feed');
  const postKeys = useRef<string[]>([]);
  // sharing: the sheet, and where to (the story or the feed)
  const [sheet, setSheet] = useState(false);
  const [placement, setPlacement] = useState<Placement>('feed');
  const since = useRef<string | null>(data.initial?.now ?? null);
  const expires = useRef<number>(data.initial?.expiresAt ?? 0);
  // what the feed shows, for telling what a refresh brought that is new
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [store, setStore] = useState<QueueStore | null>(null);
  const [uploaderId, setUploaderId] = useState<string | null>(null);
  const code = useRef<string | null>(null);
  const codeOf = useCallback(() => code.current, []);
  const [name, setName] = useState('');
  const nameRef = useRef('');
  const uploader = useRef<Uploader | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [round, setRound] = useState<ReadonlySet<string>>(new Set());
  const [skipped, setSkipped] = useState<AddResult['errors']>([]);

  // ── this phone: its queue, its random uploader id, the code and name it used before ──
  useEffect(() => {
    let live = true;
    void (async () => {
      const s = await openStore();
      let id = await s.getMeta('uploader').catch(() => null);
      if (!id) {
        try {
          id = localStorage.getItem('badook-gallery:uploader');
        } catch {
          id = null;
        }
      }
      if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
        id = randomToken();
        await s.setMeta('uploader', id).catch(() => undefined);
        try {
          localStorage.setItem('badook-gallery:uploader', id);
        } catch {
          // private mode
        }
      }
      code.current = await s.getMeta(`code:${token}`).catch(() => null);
      try {
        const saved = localStorage.getItem('badook-gallery:name') ?? '';
        nameRef.current = saved;
        setName(saved);
      } catch {
        // private mode
      }
      if (!live) return;
      setStore(s);
      setUploaderId(id);
    })();
    return () => {
      live = false;
    };
  }, [token]);

  // ── the feed ──
  const apply = useCallback((body: FeedResponse, how: 'replace' | 'append' | 'merge') => {
    setState(body.state);
    setMode(body.mode);
    setOpensAt(body.opensAt);
    if (body.realtime) setRealtime(body.realtime);
    if (body.mine) setMine(body.mine);
    if (how !== 'append') since.current = body.now;
    if (how === 'replace') {
      expires.current = body.expiresAt;
      setItems(body.items);
      setNext(body.next);
    } else if (how === 'append') {
      setItems((cur) => [...cur, ...body.items.filter((i) => !cur.some((c) => c.id === i.id))]);
      setNext(body.next);
    } else {
      const removed = new Set(body.removed);
      const shown = new Set(itemsRef.current.map((c) => c.id));
      const added = body.items.filter((i) => !shown.has(i.id));
      if (added.length) setFresh(new Set(added.map((i) => i.id)));
      setItems((cur) => {
        const known = new Set(cur.map((c) => c.id));
        return [...body.items.filter((i) => !known.has(i.id)), ...cur.filter((c) => !removed.has(c.id))];
      });
    }
  }, []);

  const request = useCallback(
    async (extra: Record<string, unknown>) => {
      // the posts on the screen: their likes come back with the answer
      const asked = postKeys.current.slice(0, GALLERY.feed.likesPerAnswer);
      const res = await galleryApi<FeedResponse & { code?: string; state?: GalleryState }>(
        '/api/gallery/feed',
        {
          t: token,
          ...(code.current ? { code: code.current } : {}),
          ...(uploaderId ? { uploader: uploaderId } : {}),
          ...(asked.length ? { posts: asked } : {}),
          ...extra,
        },
      );
      if (res.ok && res.body?.likes) setLikes((cur) => mergeLikes(cur, asked, res.body!.likes));
      if (res.status === 404) setPhase('invalid');
      else if (res.status === 403 && res.body?.code === 'off') {
        setState('off');
        setPhase('off');
      } else if (res.status === 401) setPhase('code');
      return res.ok && res.body ? res.body : null;
    },
    [token, uploaderId],
  );

  const reload = useCallback(async () => {
    const body = await request({ mine: !!uploaderId });
    if (body) apply(body, 'replace');
    return !!body;
  }, [request, apply, uploaderId]);

  const refresh = useCallback(
    async (kind: string) => {
      if (phase !== 'ready') return;
      // the page's photo URLs run out after a few hours: a full reload brings fresh ones
      const stale = Date.now() > expires.current - GALLERY.urls.refreshBeforeSeconds * 1000;
      if (kind === 'settings' || stale || !since.current) return void reload();
      const body = await request({ since: since.current, mine: !!uploaderId });
      if (body) apply(body, 'merge');
    },
    [phase, reload, request, apply, uploaderId],
  );

  // the first answer with this phone's own uploads (and the feed when the page had none)
  useEffect(() => {
    if (phase === 'ready' && uploaderId) void reload();
  }, [phase, uploaderId, reload]);

  const live = useLiveRefresh(
    phase === 'ready' ? realtime : null,
    (kind) => void refresh(kind),
    GALLERY.live.pollGuestMs,
  );

  const more = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    const body = await request({ before: next });
    if (body) apply(body, 'append');
    setLoadingMore(false);
  }, [next, loadingMore, request, apply]);

  // ── the uploader ──
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  const faces = !!data.faces;
  useEffect(() => {
    if (!store || !uploaderId) return;
    // face search (feature face_albums): this phone looks for faces in its own photos once they are in
    let indexer: UploadFaceIndexer | null = null;
    const u = new Uploader({
      token,
      store,
      uploader: uploaderId,
      code: () => code.current,
      name: () => nameRef.current.trim() || null,
      guest,
      onChange: setSnapshot,
      onResult: (item) => {
        void refreshRef.current('items');
        if (indexer && item.kind === 'image' && item.remoteId) indexer.add(item.localId, item.remoteId);
      },
      keepPreviews: faces,
    });
    if (faces)
      indexer = new UploadFaceIndexer({
        token,
        uploader: uploaderId,
        code: () => code.current,
        preview: (id) => u.preview(id),
        drop: (id) => u.dropPreview(id),
      });
    uploader.current = u;
    void u.start().then(() => {
      // photos of an earlier visit still waiting to be looked at for faces
      if (indexer)
        for (const item of u.snapshot().items)
          if (item.kind === 'image' && item.remoteId && (item.stage === 'done' || item.stage === 'visible'))
            indexer.add(item.localId, item.remoteId);
      // what didn't finish last time belongs to this round
      setRound(
        new Set(
          u
            .snapshot()
            .items.filter((i) => i.stage !== 'done' && i.stage !== 'skipped')
            .map((i) => i.localId),
        ),
      );
    });
    return () => {
      u.stop();
      indexer?.stop();
      uploader.current = null;
    };
  }, [store, uploaderId, token, guest, faces]);
  // the hosts opened the gallery again: the queue goes on
  useEffect(() => {
    if (state === 'open' && snapshot?.blocked && snapshot.blocked !== 'code' && snapshot.blocked !== 'full')
      uploader.current?.unblock();
  }, [state, snapshot?.blocked]);

  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const onFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length || !uploader.current) return;
    setSkipped([]);
    const before = new Set(uploader.current.snapshot().items.map((i) => i.localId));
    const result = await uploader.current.add(files, placement);
    const added = uploader.current
      .snapshot()
      .items.filter((i) => !before.has(i.localId))
      .map((i) => i.localId);
    setRound((r) => new Set([...r, ...added]));
    setSkipped(result.errors);
  };

  const roundItems = useMemo(
    () => (snapshot?.items ?? []).filter((i) => round.has(i.localId)),
    [snapshot, round],
  );
  const clearRound = async () => {
    const u = uploader.current;
    if (!u) return;
    for (const item of roundItems)
      if (item.stage === 'done' || item.stage === 'failed') await u.remove(item.localId);
    setRound(new Set());
  };

  // ── this phone's own uploads that aren't in the feed ──
  const mineIds = useMemo(() => new Set(mine.map((m) => m.id)), [mine]);
  const stories = useMemo(() => groupStories(items.filter(isStory)), [items]);
  const posts = useMemo(() => groupPosts(items), [items]);
  useEffect(() => {
    postKeys.current = posts.map((p) => p.key);
  }, [posts]);
  // an unnamed guest's number, the same in the stories and the feed
  const people = useMemo(() => groupStories(items), [items]);
  const authorOf = (post: Post) => {
    if (post.by === 'host') return t.stories.host;
    if (post.name) return post.name;
    const person = people.find(
      (s) => !s.name && s.items.some((i) => i.post === post.key || i.id === post.key),
    );
    return fmt(t.stories.anonymous, { n: number(person?.anonymous ?? 1) });
  };
  const like = useCallback(
    async (post: string, on: boolean) => {
      if (!uploaderId) return;
      setLikes((cur) => ({ ...cur, [post]: toggled(cur[post], on) }));
      const res = await galleryApi<{ likes?: Likes }>('/api/gallery/like', {
        t: token,
        uploader: uploaderId,
        post,
        on,
        ...(code.current ? { code: code.current } : {}),
      });
      const answer = res.ok ? res.body?.likes : undefined;
      // the server's count (others liked meanwhile), or back to how it was
      setLikes((cur) => ({ ...cur, [post]: answer ?? toggled(cur[post], !on) }));
    },
    [token, uploaderId],
  );
  const share = (to: Placement) => {
    setPlacement(to);
    setSheet(true);
  };
  const storyName = (s: Story) =>
    s.host ? t.stories.host : (s.name ?? fmt(t.stories.anonymous, { n: number(s.anonymous ?? 1) }));
  const watched = useCallback(
    (story: Story) =>
      setSeen((cur) => {
        if (!isUnseen(story, cur)) return cur;
        const next = { ...cur, [story.key]: story.newestId };
        writeSeen(token, next);
        return next;
      }),
    [token],
  );
  const guests = people.filter((s) => !s.host).length;
  const waiting = mine.filter((m) => m.status !== 'published');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const remove = async (id: string) => {
    setConfirming(null);
    const res = await galleryApi('/api/gallery/remove', {
      t: token,
      uploader: uploaderId,
      id,
      ...(code.current ? { code: code.current } : {}),
    });
    if (!res.ok) return setNotice(t.mine.failed);
    setNotice(t.mine.deleted);
    setMine((m) => m.filter((x) => x.id !== id));
    setItems((cur) => cur.filter((x) => x.id !== id));
    setOpen(null);
    setStoryOpen(null);
  };

  const onName = (value: string) => {
    setName(value);
    nameRef.current = value;
    try {
      localStorage.setItem('badook-gallery:name', value.slice(0, GALLERY.limits.nameLength));
    } catch {
      // private mode
    }
  };

  const canUpload = phase === 'ready' && (state === 'open' || state === 'paused');
  // the floating "add" shows once the upload card has scrolled away, and hides at the footer
  const uploadRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [fab, setFab] = useState(false);
  useEffect(() => {
    if (!canUpload || typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      const card = uploadRef.current ? seen.get(uploadRef.current) : true;
      const foot = footerRef.current ? seen.get(footerRef.current) : false;
      setFab(card === false && !foot);
    });
    for (const el of [uploadRef.current, footerRef.current]) if (el) io.observe(el);
    return () => io.disconnect();
  }, [canUpload]);
  const showQueue = roundItems.length > 0 || (snapshot?.preparing ?? 0) > 0;

  return (
    <div style={accent} className="relative min-h-svh overflow-x-clip bg-canvas" dir={dir}>
      {/* the event's colour, washed over the top of the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(110%_90%_at_50%_0%,color-mix(in_oklab,var(--gallery-accent)_26%,transparent),transparent_72%)]"
      />
      <div className="relative mx-auto w-full max-w-[720px] px-4 pt-5 pb-10 sm:px-6 sm:pt-8">
        <header className={`relative text-center ${others.length ? 'pt-11 sm:pt-0' : ''}`}>
          {others.length === 1 ? (
            <button
              type="button"
              onClick={() => onLocale(others[0]!)}
              lang={others[0]}
              className="absolute end-0 top-0 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink shadow-sm"
            >
              <Globe aria-hidden className="size-3.5" />
              {nativeName(others[0]!)}
            </button>
          ) : others.length > 1 ? (
            // more languages: a menu of them, each by its own name
            <label className="absolute end-0 top-0 inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface ps-3 pe-2 text-[12.5px] font-semibold text-ink shadow-sm">
              <Globe aria-hidden className="size-3.5" />
              <select
                aria-label={t.language}
                value={locale}
                onChange={(e) => onLocale(e.target.value as GuestLocale)}
                className="cursor-pointer appearance-none bg-transparent font-semibold outline-none"
              >
                {[locale, ...others].map((l) => (
                  <option key={l} value={l} lang={l}>
                    {nativeName(l)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--gallery-accent)_14%,transparent)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--gallery-accent)]">
            <Sparkles aria-hidden className="size-3.5" />
            {t.eyebrow}
          </p>
          <h1 className="mt-3 font-display text-[34px] leading-[1.1] font-bold text-balance sm:text-[42px]">
            <bdi>{title}</bdi>
          </h1>
          {data.event.date ? (
            <p className="mt-2 text-[14.5px] text-muted">
              {date(`${data.event.date}T12:00:00Z`, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </p>
          ) : null}
          {phase === 'ready' && items.length ? (
            <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 shadow-sm ring-1 ring-line">
                <Camera aria-hidden className="size-4 text-[var(--gallery-accent)]" />
                {plural(t.feed.count, items.length, { n: `${number(items.length)}${next ? '+' : ''}` })}
              </span>
              {guests ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 shadow-sm ring-1 ring-line"
                  data-testid="gallery-people"
                >
                  <User aria-hidden className="size-4 text-[var(--gallery-accent)]" />
                  {plural(t.hero.people, guests, { n: `${number(guests)}${next ? '+' : ''}` })}
                </span>
              ) : null}
            </p>
          ) : null}
        </header>

        {phase === 'invalid' ? (
          <Notice icon={<CircleAlert />} title={t.invalid.title} body={t.invalid.body} />
        ) : phase === 'off' ? (
          <Notice icon={<Lock />} title={t.off.title} body={t.off.body} />
        ) : phase === 'code' ? (
          <CodeGate
            token={token}
            onAccepted={async (value) => {
              code.current = value;
              await store?.setMeta(`code:${token}`, value).catch(() => undefined);
              setPhase('ready');
              uploader.current?.unblock();
            }}
          />
        ) : (
          <>
            {state === 'scheduled' && opensAt ? (
              <Banner text={fmt(t.scheduled, { date: date(opensAt) })} />
            ) : state === 'paused' ? (
              <Banner text={t.paused} />
            ) : state === 'ended' ? (
              <Banner text={t.ended} />
            ) : null}

            {stories.length || canUpload ? (
              <StoriesTray
                stories={stories}
                seen={seen}
                nameOf={storyName}
                onOpen={setStoryOpen}
                onAdd={canUpload ? () => share('story') : undefined}
              />
            ) : null}

            {canUpload ? (
              // sharing, as a social app's composer: one tap opens the sheet (story or post, then the picker)
              <section
                ref={uploadRef}
                aria-label={t.upload.title}
                className="mt-5 flex items-center gap-2.5 rounded-[22px] border border-line bg-surface p-2.5 ps-3 shadow-[0_20px_44px_-32px_rgba(20,10,0,0.5)]"
              >
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--gallery-accent)_16%,white)] font-display text-[18px] font-bold text-[var(--gallery-accent)]"
                >
                  {(Array.from(name.trim())[0] ?? '').toLocaleUpperCase() || <User className="size-5" />}
                </span>
                <button
                  type="button"
                  onClick={() => share('feed')}
                  disabled={!snapshot}
                  data-testid="gallery-share"
                  className="h-12 min-w-0 flex-1 truncate rounded-full bg-subtle px-4 text-start text-[15px] text-muted transition-colors hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                >
                  {t.share.composer}
                </button>
                <button
                  type="button"
                  onClick={() => share('feed')}
                  disabled={!snapshot}
                  aria-label={t.upload.pick}
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)] shadow-[0_10px_22px_-12px_rgba(0,0,0,0.55)] transition-transform active:scale-95 disabled:opacity-60 motion-reduce:transition-none"
                >
                  <ImagePlus aria-hidden className="size-5" />
                </button>
              </section>
            ) : null}
            {canUpload && mode === 'approval' ? (
              <p className="mt-2 px-1 text-[12.5px] text-muted">{t.upload.approvalBody}</p>
            ) : null}
            {canUpload ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  data-testid="gallery-files"
                  onChange={(e) => {
                    void onFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={cameraInput}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void onFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <ShareSheet
                  open={sheet}
                  onOpenChange={setSheet}
                  placement={placement}
                  onPlacement={setPlacement}
                  name={name}
                  onName={onName}
                  approval={mode === 'approval'}
                  note={`${t.upload.resilient} ${fmt(t.upload.limits, {
                    image: formatBytes(data.limits.imageBytes, locale),
                    video: formatBytes(data.limits.videoBytes, locale),
                    minutes: number(data.limits.videoMinutes),
                  })}`}
                  disabled={!snapshot}
                  style={accent}
                  onPick={() => {
                    fileInput.current?.click();
                    setSheet(false);
                  }}
                  onCamera={() => {
                    cameraInput.current?.click();
                    setSheet(false);
                  }}
                />
              </>
            ) : null}
            {skipped.length ? (
              <p
                role="alert"
                className="mt-3 rounded-[10px] bg-warning-bg px-3 py-2 text-[13px] text-warning"
              >
                {plural(t.skipped, skipped.length, {
                  reasons: [...new Set(skipped.map((s) => t.item.errors[s.code] ?? s.code))].join(', '),
                })}
              </p>
            ) : null}

            {showQueue && snapshot ? (
              <div className="mt-4">
                <QueuePanel
                  snapshot={snapshot}
                  items={roundItems}
                  thumbnail={(id) => uploader.current?.thumbnail(id) ?? Promise.resolve(null)}
                  onRetry={() => uploader.current?.retryAll()}
                  onRemove={(id) => void uploader.current?.remove(id)}
                  onClear={() => void clearRound()}
                />
              </div>
            ) : null}

            {data.faces ? <FaceSearch token={token} code={codeOf} until={data.faces.until} /> : null}

            {waiting.length ? (
              <section className="mt-6" aria-labelledby="gallery-mine">
                <h2 id="gallery-mine" className="text-[16px] font-bold">
                  {t.mine.title}
                </h2>
                <p className="text-[13px] text-muted">{t.mine.help}</p>
                <ul className="mt-3 grid gap-2" data-testid="gallery-mine">
                  {waiting.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-[12px] border border-line bg-surface p-2 pe-3"
                    >
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-subtle">
                        {m.thumb ? (
                          <img src={m.thumb} alt="" className="size-full object-cover" loading="lazy" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px]">
                        <span className="block font-medium">
                          {m.kind === 'video' ? t.item.video : t.item.photo}
                        </span>
                        <span className={m.status === 'pending' ? 'text-warning' : 'text-muted'}>
                          {m.status === 'pending'
                            ? t.mine.pending
                            : m.status === 'hidden'
                              ? t.mine.hidden
                              : m.reason === 'duplicate'
                                ? t.mine.duplicate
                                : t.mine.rejected}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirming(m.id)}
                        aria-label={fmt(t.mine.deleteLabel, {
                          kind: m.kind === 'video' ? t.item.video : t.item.photo,
                        })}
                        className="grid size-9 place-items-center rounded-full text-muted hover:bg-subtle hover:text-danger"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {notice ? (
              <p role="status" className="mt-3 text-center text-[13px] text-muted">
                {notice}
              </p>
            ) : null}

            <section className="mt-8" aria-labelledby="gallery-feed">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="gallery-feed" className="text-[18px] font-bold">
                  {t.feed.title}
                </h2>
                <div className="flex items-center gap-3">
                  {live === 'live' ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success"
                      data-testid="gallery-live"
                    >
                      <span aria-hidden className="relative flex size-2">
                        <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                        <span className="relative inline-flex size-2 rounded-full bg-success" />
                      </span>
                      {t.feed.live}
                    </span>
                  ) : null}
                  {/* the feed's posts, or every photo and video (the stories' too) in a grid */}
                  <div
                    role="radiogroup"
                    aria-label={t.view.label}
                    className="flex rounded-full bg-subtle p-1"
                  >
                    {(
                      [
                        ['feed', t.view.feed, Rows3],
                        ['grid', t.view.grid, LayoutGrid],
                      ] as const
                    ).map(([value, label, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={view === value}
                        onClick={() => setView(value)}
                        data-view={value}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus ${
                          view === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                        }`}
                      >
                        <Icon aria-hidden className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {view === 'grid' ? (
                items.length ? (
                  <FeedGrid
                    items={items}
                    fresh={fresh}
                    onOpen={setOpen}
                    hasMore={!!next}
                    loadingMore={loadingMore}
                    onMore={() => void more()}
                  />
                ) : (
                  <Empty
                    text={t.feed.empty}
                    action={canUpload ? t.share.open : null}
                    onAction={() => share('feed')}
                  />
                )
              ) : posts.length ? (
                <>
                  <p className="mb-3 text-[12.5px] text-muted">{t.post.doubleTap}</p>
                  <ol className="mx-auto flex max-w-[560px] flex-col gap-5" data-testid="gallery-posts">
                    {posts.map((post) => (
                      <li key={post.key}>
                        <FeedPost
                          post={post}
                          author={authorOf(post)}
                          likes={likes[post.key]}
                          fresh={post.items.some((i) => fresh.has(i.id))}
                          onLike={(on) => void like(post.key, on)}
                          onOpen={(item) => {
                            const at = items.findIndex((i) => i.id === item.id);
                            if (at >= 0) setOpen(at);
                          }}
                        />
                      </li>
                    ))}
                  </ol>
                  {next ? <MoreButton loading={loadingMore} onMore={() => void more()} /> : null}
                </>
              ) : (
                <>
                  <Empty
                    text={t.view.empty}
                    action={canUpload ? t.share.open : null}
                    onAction={() => share('feed')}
                  />
                  {next ? <MoreButton loading={loadingMore} onMore={() => void more()} /> : null}
                </>
              )}
            </section>
          </>
        )}

        <footer ref={footerRef} className="mt-14 text-center text-[12px] leading-relaxed text-muted">
          {/* whose system this is: Badook, with the way to its site and to Badook Events */}
          <section
            aria-label={data.brand}
            data-testid="gallery-brand-card"
            className="mx-auto max-w-[460px] rounded-[24px] border border-line bg-surface px-5 pt-6 pb-5 shadow-[0_20px_50px_-30px_rgba(20,10,0,0.35)]"
          >
            <a
              href="/"
              target="_blank"
              rel="noopener"
              data-testid="gallery-brand"
              className="inline-flex flex-col items-center gap-2 rounded-[14px] px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <BrandLogo label={data.brand} className="text-[22px]" />
              <span className="text-[14px] font-bold text-ink">
                {fmt(t.footer.made, { brand: data.brand })}
              </span>
            </a>
            <p className="mt-0.5 text-[13px] text-muted">{t.footer.site}</p>
            <a
              href="/"
              target="_blank"
              rel="noopener"
              data-testid="gallery-brand-site"
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[14.5px] font-bold text-white shadow-sm transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
            >
              {fmt(t.footer.visit, { brand: data.brand })}
              {dir === 'rtl' ? (
                <ArrowLeft aria-hidden className="size-4" />
              ) : (
                <ArrowRight aria-hidden className="size-4" />
              )}
            </a>
            <a
              href={BADOOK_EVENTS_URL}
              target="_blank"
              rel="noopener"
              data-testid="gallery-brand-events"
              className="mt-3 flex items-center gap-3 rounded-[16px] border border-line bg-canvas px-4 py-3 text-start transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fdebe4] text-[#e0532b]"
              >
                <MapPin className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-ink">{t.footer.events}</span>
                <span className="block text-[12.5px] text-muted">{t.footer.eventsHint}</span>
              </span>
              {dir === 'rtl' ? (
                <ArrowLeft aria-hidden className="size-4 shrink-0 text-muted" />
              ) : (
                <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
              )}
            </a>
          </section>
          {canUpload ? <p className="mx-auto mt-6 max-w-[52ch]">{t.footer.consent}</p> : null}
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <a href="/privacy" target="_blank" rel="noopener" className="underline">
              {t.footer.privacy}
            </a>
            <a href="/accessibility" target="_blank" rel="noopener" className="underline">
              {t.footer.accessibility}
            </a>
          </p>
        </footer>
      </div>

      {/* past the upload card: a button to add photos stays at hand (not over the footer) */}
      {canUpload && fab ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => share('feed')}
            disabled={!snapshot}
            data-testid="gallery-fab"
            className="pointer-events-auto inline-flex h-13 items-center gap-2 rounded-full bg-[var(--gallery-accent)] px-6 text-[15.5px] font-bold text-[var(--gallery-accent-ink)] shadow-[0_16px_36px_-12px_rgba(0,0,0,0.55)] transition-transform active:scale-[0.97] disabled:opacity-60 motion-reduce:transition-none"
          >
            <ImagePlus aria-hidden className="size-5" />
            {t.share.open}
          </button>
        </div>
      ) : null}

      {/* the accessibility menu, on the side of the page, in the page's language */}
      <AccessibilityPanel a={t.a11y} newTab place="corner" />

      {storyOpen ? (
        <StoryViewer
          stories={stories}
          startKey={storyOpen}
          nameOf={storyName}
          onClose={() => setStoryOpen(null)}
          onWatched={watched}
          canDelete={(item) => mineIds.has(item.id)}
          onDelete={(item) => setConfirming(item.id)}
          suspended={!!confirming}
        />
      ) : null}

      {open !== null && items[open] ? (
        <MediaViewer
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          dir={dir}
          labels={t.viewer}
          onNearEnd={next ? () => void more() : undefined}
          footer={(item) => (
            <div className="flex items-center justify-between gap-3 text-[13px] text-white/80">
              <span className="min-w-0 truncate">
                {item.name ? fmt(t.feed.by, { name: item.name }) : null}
              </span>
              {mineIds.has(item.id) ? (
                <button
                  type="button"
                  onClick={() => setConfirming(item.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/12 px-3 font-semibold text-white"
                >
                  <Trash2 aria-hidden className="size-4" />
                  {t.mine.delete}
                </button>
              ) : null}
            </div>
          )}
        />
      ) : null}

      {confirming ? (
        <ConfirmSheet
          title={t.mine.confirmTitle}
          body={t.mine.confirmBody}
          confirm={t.mine.confirm}
          cancel={t.mine.cancel}
          onConfirm={() => void remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

/** Nothing here yet: an invitation to be the first, with the way to share. */
function Empty({ text, action, onAction }: { text: string; action: string | null; onAction(): void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line-strong px-4 py-10 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-full bg-[color-mix(in_oklab,var(--gallery-accent)_14%,transparent)] text-[var(--gallery-accent)]"
      >
        <Camera className="size-7" />
      </span>
      <p className="max-w-[34ch] text-[14.5px] text-muted">{text}</p>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--gallery-accent)] px-5 text-[14.5px] font-bold text-[var(--gallery-accent-ink)] shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
        >
          <ImagePlus aria-hidden className="size-4" />
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** Older posts: on their own near the bottom (and with the button, without IntersectionObserver). */
function MoreButton({ loading, onMore }: { loading: boolean; onMore(): void }) {
  const { t } = useGuestText();
  const ref = useRef<HTMLDivElement>(null);
  const onMoreRef = useRef(onMore);
  useEffect(() => {
    onMoreRef.current = onMore;
  }, [onMore]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && onMoreRef.current(),
      {
        rootMargin: '800px 0px',
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="mt-5 flex justify-center">
      <button
        type="button"
        onClick={onMore}
        disabled={loading}
        className="h-10 rounded-full border border-line bg-surface px-5 text-[14px] font-semibold text-ink shadow-sm disabled:opacity-60"
      >
        {loading ? t.feed.loading : t.feed.more}
      </button>
    </div>
  );
}

function Notice({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="mt-8 rounded-[20px] border border-line bg-surface px-5 py-8 text-center shadow-sm">
      <span
        aria-hidden
        className="mx-auto grid size-12 place-items-center rounded-full bg-subtle text-muted [&_svg]:size-6"
      >
        {icon}
      </span>
      <h2 className="mt-3 text-[18px] font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-[40ch] text-[14px] text-muted">{body}</p>
    </div>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="mt-6 rounded-[14px] border border-warning-line bg-warning-bg px-4 py-3 text-[14px] text-warning"
    >
      {text}
    </p>
  );
}

/** The access code: typed once on this phone (kept with its queue), checked by the server. */
function CodeGate({ token, onAccepted }: { token: string; onAccepted(code: string): void | Promise<void> }) {
  const { t } = useGuestText();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await galleryApi<{ code?: string }>('/api/gallery/feed', { t: token, code: value.trim() });
    setBusy(false);
    if (res.ok) return void onAccepted(value.trim());
    setError(res.status === 429 ? t.code.rate : res.status === 401 ? t.code.wrong : t.code.failed);
  };
  return (
    <form
      onSubmit={submit}
      className="mt-8 rounded-[20px] border border-line bg-surface p-5 shadow-sm sm:p-6"
      noValidate
    >
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-subtle text-muted">
        <Lock className="size-5" />
      </span>
      <h2 className="mt-3 text-[18px] font-bold">{t.code.title}</h2>
      <p className="mt-1 text-[14px] text-muted">{t.code.body}</p>
      <label htmlFor="gallery-code" className="mt-4 block text-[13px] font-semibold">
        {t.code.label}
      </label>
      <input
        id="gallery-code"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={64}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'gallery-code-error' : undefined}
        className="mt-1.5 h-12 w-full rounded-[10px] border border-line bg-surface px-3 text-[17px] tracking-[0.08em] focus:border-ink focus:shadow-ring focus:outline-hidden"
      />
      {error ? (
        <p id="gallery-code-error" role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--gallery-accent)] text-[16px] font-bold text-[var(--gallery-accent-ink)] disabled:opacity-60"
      >
        {busy ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
        {t.code.submit}
      </button>
    </form>
  );
}

/** A small confirmation (no big dialog library on guests' phones). */
function ConfirmSheet({
  title,
  body,
  confirm,
  cancel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[95] grid items-end bg-black/40 p-3 sm:place-items-center"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gallery-confirm-title"
        aria-describedby="gallery-confirm-body"
        className="w-full max-w-[420px] rounded-[18px] bg-surface p-5 text-ink shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="gallery-confirm-title" className="text-[17px] font-bold">
          {title}
        </h2>
        <p id="gallery-confirm-body" className="mt-1 text-[14px] text-muted">
          {body}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            ref={first}
            type="button"
            onClick={onCancel}
            className="h-11 rounded-[10px] border border-line font-semibold"
          >
            {cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-[10px] bg-danger-strong font-semibold text-white"
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
