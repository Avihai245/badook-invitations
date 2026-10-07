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
  Plus,
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
import { GuestTextProvider, fmt, useGuestText, type GuestLocale } from '../guest-text';
import { FeedGrid } from './FeedGrid';
import { FeedPost } from './FeedPost';
import { groupPosts, isStory, mergeLikes, toggled, type Post } from './posts';
import { QueuePanel } from './QueuePanel';
import { NameSheet } from './NameSheet';
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
  // sharing: where the files being picked go (the story or the feed), and the name sheet — asked once,
  // before the first share, then opened from the top bar
  const placement = useRef<Placement>('feed');
  const [nameSheet, setNameSheet] = useState<{ mode: 'first' | 'edit'; to: Placement } | null>(null);
  const [instagram, setInstagram] = useState('');
  const instagramRef = useRef('');
  const asked = useRef(false);
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
        const handle = localStorage.getItem('badook-gallery:instagram') ?? '';
        instagramRef.current = handle;
        setInstagram(handle);
        asked.current = !!saved || localStorage.getItem('badook-gallery:asked') === '1';
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
      instagram: () => instagramRef.current || null,
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
  const onFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length || !uploader.current) return;
    setSkipped([]);
    const before = new Set(uploader.current.snapshot().items.map((i) => i.localId));
    const result = await uploader.current.add(files, placement.current);
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
  // one tap: the phone's own picker (it offers the camera too); the first time, the name first
  const pick = (to: Placement) => {
    placement.current = to;
    fileInput.current?.click();
  };
  const share = (to: Placement) => {
    if (asked.current) pick(to);
    else setNameSheet({ mode: 'first', to });
  };
  const onNameDone = (value: { name: string; instagram: string }) => {
    const sheet = nameSheet;
    onName(value.name);
    instagramRef.current = value.instagram;
    setInstagram(value.instagram);
    asked.current = true;
    try {
      localStorage.setItem('badook-gallery:asked', '1');
      if (value.instagram) localStorage.setItem('badook-gallery:instagram', value.instagram);
      else localStorage.removeItem('badook-gallery:instagram');
    } catch {
      // private mode: asked again next visit
    }
    setNameSheet(null);
    // still the tap that opened the sheet's button: the picker may open
    if (sheet?.mode === 'first') pick(sheet.to);
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
  const showQueue = roundItems.length > 0 || (snapshot?.preparing ?? 0) > 0;
  // stable: the pill's photo is fetched once per file
  const thumbnail = useCallback((id: string) => uploader.current?.thumbnail(id) ?? Promise.resolve(null), []);
  const initial = (Array.from(name.trim())[0] ?? '').toLocaleUpperCase();
  // the event's picture is its name: the hosts' initials ("נ&א")
  const monogram = title
    .split(/\s*&\s*/)
    .map((w) => Array.from(w.trim())[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('&');
  const eventDate = data.event.date
    ? date(`${data.event.date}T12:00:00Z`, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;
  const more_ = next ? '+' : '';
  const stat = (n: number, label: string, testId?: string) => (
    <div className="text-center sm:text-start" data-testid={testId}>
      <p className="text-[17px] leading-none font-bold tabular-nums">
        {number(n)}
        {more_}
      </p>
      <p className="mt-1 text-[12.5px] text-muted">{label}</p>
    </div>
  );

  return (
    <div style={accent} className="relative min-h-svh overflow-x-clip bg-canvas" dir={dir}>
      {/* the top bar: the event, live, the language and "you" (the name on what you share) */}
      <div className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 w-full max-w-[640px] items-center gap-2 px-4">
          <p className="min-w-0 flex-1 truncate font-display text-[19px] font-bold" aria-hidden>
            <bdi>{title}</bdi>
          </p>
          {live === 'live' ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-[11.5px] font-semibold text-success"
              data-testid="gallery-live"
            >
              <span aria-hidden className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              {t.feed.live}
            </span>
          ) : null}
          {others.length === 1 ? (
            <button
              type="button"
              onClick={() => onLocale(others[0]!)}
              lang={others[0]}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold text-ink hover:bg-subtle"
            >
              <Globe aria-hidden className="size-4" />
              {nativeName(others[0]!)}
            </button>
          ) : others.length > 1 ? (
            // more languages: a menu of them, each by its own name
            <label className="inline-flex h-9 items-center gap-1.5 rounded-full ps-2.5 pe-1.5 text-[12.5px] font-semibold text-ink hover:bg-subtle">
              <Globe aria-hidden className="size-4" />
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
          {canUpload && asked.current ? (
            <button
              type="button"
              onClick={() => setNameSheet({ mode: 'edit', to: 'feed' })}
              aria-label={`${name.trim() ? fmt(t.name.as, { name: name.trim() }) : t.name.anonymous}. ${t.name.edit}`}
              title={t.name.edit}
              data-testid="name-edit"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface font-display text-[15px] font-bold text-ink hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {initial || <User aria-hidden className="size-4 text-muted" />}
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[640px] px-4 pt-5 pb-32 sm:px-6">
        {/* the event, like a profile: its picture in a ring, its name, its numbers */}
        <header className="flex items-center gap-5 sm:gap-7">
          <span
            aria-hidden
            className="gallery-ring grid size-[86px] shrink-0 place-items-center rounded-full p-[3px] sm:size-[104px]"
          >
            <span className="relative grid size-full place-items-center overflow-hidden rounded-full border-[3px] border-canvas bg-[color-mix(in_oklab,var(--gallery-accent)_14%,white)] font-display text-[26px] font-bold text-[var(--gallery-accent)]">
              {monogram || <Sparkles className="size-8" />}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[24px] leading-[1.1] font-bold text-balance sm:text-[30px]">
              <bdi>{title}</bdi>
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              {[t.eyebrow, eventDate].filter(Boolean).join(' · ')}
            </p>
            {phase === 'ready' ? (
              <div className="mt-3.5 flex gap-6">
                {stat(posts.length, t.stats.posts)}
                {stat(items.length, t.stats.media)}
                {stat(guests, t.stats.people, 'gallery-people')}
              </div>
            ) : null}
          </div>
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
                me={initial}
              />
            ) : null}
            {canUpload && mode === 'approval' ? (
              <p className="mt-1 text-[12.5px] text-muted">{t.upload.approvalBody}</p>
            ) : null}
            {canUpload ? (
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
            ) : null}
            {skipped.length ? (
              <p
                role="alert"
                className="mt-3 rounded-[12px] bg-warning-bg px-3 py-2 text-[13px] text-warning"
              >
                {plural(t.skipped, skipped.length, {
                  reasons: [...new Set(skipped.map((s) => t.item.errors[s.code] ?? s.code))].join(', '),
                })}
              </p>
            ) : null}

            {data.faces ? <FaceSearch token={token} code={codeOf} until={data.faces.until} /> : null}

            {waiting.length ? (
              <section className="mt-6" aria-labelledby="gallery-mine">
                <h2 id="gallery-mine" className="text-[15px] font-bold">
                  {t.mine.title}
                </h2>
                <p className="text-[13px] text-muted">{t.mine.help}</p>
                <ul className="mt-3 grid gap-2" data-testid="gallery-mine">
                  {waiting.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-2 pe-3"
                    >
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-subtle">
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

            <section className="mt-5" aria-labelledby="gallery-feed">
              <h2 id="gallery-feed" className="sr-only">
                {t.feed.title}
              </h2>
              {/* the feed's posts, or every photo and video (the stories' too) in a grid: a profile's tabs */}
              <div
                role="tablist"
                aria-label={t.view.label}
                className="-mx-4 grid grid-cols-2 border-b border-line sm:mx-0"
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
                    role="tab"
                    aria-selected={view === value}
                    aria-controls="gallery-view"
                    onClick={() => setView(value)}
                    data-view={value}
                    className={`relative inline-flex h-12 items-center justify-center gap-2 text-[13.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                      view === value ? 'text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Icon aria-hidden className="size-[18px]" />
                    {label}
                    {view === value ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-6 -bottom-px h-[2px] rounded-full bg-ink"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
              <div id="gallery-view" role="tabpanel" className="pt-4">
                {view === 'grid' ? (
                  items.length ? (
                    <div className="-mx-4 sm:mx-0">
                      <FeedGrid
                        items={items}
                        fresh={fresh}
                        onOpen={setOpen}
                        hasMore={!!next}
                        loadingMore={loadingMore}
                        onMore={() => void more()}
                      />
                    </div>
                  ) : (
                    <Empty
                      text={t.feed.empty}
                      action={canUpload ? t.share.postLabel : null}
                      onAction={() => share('feed')}
                    />
                  )
                ) : posts.length ? (
                  <>
                    <ol className="-mx-4 flex flex-col gap-3 sm:mx-0 sm:gap-6" data-testid="gallery-posts">
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
                      action={canUpload ? t.share.postLabel : null}
                      onAction={() => share('feed')}
                    />
                    {next ? <MoreButton loading={loadingMore} onMore={() => void more()} /> : null}
                  </>
                )}
              </div>
            </section>
          </>
        )}

        <footer className="mt-16 text-center text-[12px] leading-relaxed text-muted">
          {/* whose system this is: Badook, with the way to its site and to Badook Events */}
          <section
            aria-label={data.brand}
            data-testid="gallery-brand-card"
            className="mx-auto max-w-[420px] border-t border-line pt-8"
          >
            <a
              href="/"
              target="_blank"
              rel="noopener"
              data-testid="gallery-brand"
              className="inline-flex flex-col items-center gap-1.5 rounded-[14px] px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <BrandLogo label={data.brand} className="text-[20px]" />
              <span className="text-[13.5px] font-semibold text-ink">
                {fmt(t.footer.made, { brand: data.brand })}
              </span>
            </a>
            <p className="text-[12.5px] text-muted">{t.footer.site}</p>
            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
              <a
                href="/"
                target="_blank"
                rel="noopener"
                data-testid="gallery-brand-site"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none dark:text-[#1c1917]"
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
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <MapPin aria-hidden className="size-4 text-[#e0532b]" />
                <span>
                  {t.footer.events}
                  <span className="sr-only"> · </span>
                  <span className="ms-1.5 font-normal text-muted">{t.footer.eventsHint}</span>
                </span>
              </a>
            </div>
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

      {/* sharing, always at hand: the story, or a post (one tap to the phone's picker) */}
      {canUpload ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
          <nav
            aria-label={t.share.dock}
            data-testid="gallery-dock"
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#141210]/92 p-1.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => share('story')}
              disabled={!snapshot}
              aria-label={t.share.storyLabel}
              data-testid="share-story"
              className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-50"
            >
              <span
                aria-hidden
                className="gallery-ring grid size-6 place-items-center rounded-full p-[1.5px]"
              >
                <span className="grid size-full place-items-center rounded-full bg-[#141210]">
                  <Plus className="size-3" strokeWidth={3} />
                </span>
              </span>
              {t.share.story}
            </button>
            <button
              type="button"
              onClick={() => share('feed')}
              disabled={!snapshot}
              aria-label={t.share.postLabel}
              data-testid="gallery-share"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--gallery-accent)] px-5 text-[14.5px] font-bold text-[var(--gallery-accent-ink)] transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-50 motion-reduce:transition-none"
            >
              <ImagePlus aria-hidden className="size-[18px]" />
              {t.share.post}
            </button>
          </nav>
        </div>
      ) : null}

      {/* the upload going on: a small pill above the share bar, out of the way */}
      {showQueue && snapshot ? (
        <QueuePanel
          snapshot={snapshot}
          items={roundItems}
          thumbnail={thumbnail}
          onRetry={() => uploader.current?.retryAll()}
          onRemove={(id) => void uploader.current?.remove(id)}
          onClear={() => void clearRound()}
          raised={canUpload}
        />
      ) : null}

      <NameSheet
        open={!!nameSheet}
        mode={nameSheet?.mode ?? 'edit'}
        name={name}
        instagram={instagram}
        onClose={() => setNameSheet(null)}
        onDone={onNameDone}
        style={accent}
      />

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
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span
        aria-hidden
        className="grid size-[72px] place-items-center rounded-full border-2 border-ink text-ink"
      >
        <Camera className="size-8" strokeWidth={1.6} />
      </span>
      <p className="max-w-[30ch] text-[15px] text-muted">{text}</p>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-[var(--gallery-accent)] transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
