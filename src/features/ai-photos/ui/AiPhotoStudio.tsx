'use client';
/* eslint-disable @next/next/no-img-element -- photos from the phone itself and short-lived signed URLs of private storage */

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Download,
  ImagePlus,
  Images,
  LoaderCircle,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { EventType, Locale } from '@/features/invitations/contracts/types';
import { galleryApi } from '@/features/live-gallery/client/api';
import { useGuestText } from '@/features/live-gallery/ui/guest-text';
import { AI_PHOTOS_GUEST } from '@/lib/i18n/ai-photos-guest';
import { fill } from '@/lib/i18n/guest';
import { AI_PHOTOS } from '../config';
import { STYLES, detectPeople, nameIn, type Style } from '../model';
import { shrinkPhoto, type ShrunkPhoto } from '../client/photo';
import type { GuestAiPerson, GuestAiPhoto, GuestAiState } from '../types';

type Ideas = keyof (typeof AI_PHOTOS_GUEST)['he']['ideas'];
const IDEAS_OF: Record<EventType, Ideas> = {
  wedding: 'couple',
  engagement: 'couple',
  henna: 'couple',
  bar_mitzvah: 'child',
  bat_mitzvah: 'child',
  birthday: 'birthday',
  brit: 'family',
  baby_shower: 'family',
  save_the_date: 'other',
  corporate: 'other',
  other: 'other',
};

/** How each style looks on its tile: a swatch and a sign. */
const STYLE_LOOK: Record<Style, { swatch: string; sign: string }> = {
  photo: { swatch: 'linear-gradient(135deg,#f6d8b8,#c98b6b 55%,#6b4a3a)', sign: '📸' },
  cartoon: { swatch: 'linear-gradient(135deg,#ffe36e,#ff8a65 50%,#7c6cff)', sign: '🎬' },
  watercolor: { swatch: 'linear-gradient(135deg,#bfe3f2,#d9c6f0 50%,#f7c9d4)', sign: '🖌️' },
  painting: { swatch: 'linear-gradient(135deg,#2f4858,#86624a 50%,#e0b25b)', sign: '🖼️' },
  poster: { swatch: 'linear-gradient(135deg,#111827,#7f1d1d 55%,#f59e0b)', sign: '🎞️' },
  vintage: { swatch: 'linear-gradient(135deg,#efe2c4,#c7a979 55%,#7a5c3a)', sign: '📻' },
};

const ACCENT_SOFT = 'bg-[color-mix(in_oklab,var(--gallery-accent)_12%,white)]';
const ON =
  'border-[var(--gallery-accent)] bg-[color-mix(in_oklab,var(--gallery-accent)_10%,white)] text-ink shadow-[0_0_0_1px_var(--gallery-accent)]';
const OFF = 'border-line bg-surface text-ink hover:border-line-strong';

const pending = (p: GuestAiPhoto | null | undefined) =>
  !!p && (p.status === 'queued' || p.status === 'running');

/** The people of honor's faces, side by side (their photo, else their initial). */
function Faces({
  people,
  locale,
  size = 44,
  className = '',
}: {
  people: GuestAiPerson[];
  locale: Locale;
  size?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={`flex shrink-0 -space-x-3 rtl:space-x-reverse ${className}`}>
      {people.slice(0, 4).map((p) => (
        <span
          key={p.id}
          className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--gallery-accent)] font-bold text-[var(--gallery-accent-ink)] ring-[3px] ring-white"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          {p.photo ? (
            <img src={p.photo} alt="" className="size-full object-cover" />
          ) : (
            nameIn(p.name, locale).trim().slice(0, 1)
          )}
        </span>
      ))}
    </span>
  );
}

/** One numbered step of the request. */
function Step({
  n,
  title,
  done,
  children,
  as: As = 'fieldset',
  labelFor,
}: {
  n: number;
  title: string;
  done: boolean;
  children: ReactNode;
  as?: 'fieldset' | 'div';
  labelFor?: string;
}) {
  const head = (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors ${
          done
            ? 'bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)]'
            : 'border-2 border-[color-mix(in_oklab,var(--gallery-accent)_45%,white)] text-[var(--gallery-accent)]'
        }`}
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <span className="text-[15.5px] font-bold">{title}</span>
    </span>
  );
  return (
    <As className="rounded-[20px] border border-line/70 bg-surface p-4 shadow-[0_6px_24px_-16px_rgba(28,25,23,0.35)]">
      {As === 'fieldset' ? (
        <legend className="float-start mb-3 w-full">{head}</legend>
      ) : (
        <label htmlFor={labelFor} className="mb-3 block">
          {head}
        </label>
      )}
      <div className="clear-both">{children}</div>
    </As>
  );
}

/**
 * "A photo with Aviv & Roni" on the gallery's guest page (feature ai_photos): a card with the people of
 * honor's faces that opens a studio — four numbered steps on a phone-sized page: a photo from the event
 * (the camera, the phone, or a new scene), who is in it (marked by itself from what the guest writes: a
 * name in any of the invitation's languages, "the groom", "the couple", "everyone"), what should happen
 * (free words, or an idea for this kind of event), and the style. The create button stays on the screen
 * (a bar under the steps, the keyboard or not) and says what is still missing. The photo is made in the
 * background (a minute or two; the page asks how it is doing, and keeps asking if the guest comes back
 * later). The result is downloaded, shared, or added to the event's gallery — which closes the studio
 * and takes the guest back to the feed. The phone's photo is made small and re-encoded on the phone;
 * the request is limited per phone.
 */
export function AiPhotoStudio({
  token,
  code,
  uploader,
  guest,
  name,
  eventType,
  theme,
  onShared,
}: {
  token: string;
  /** the gallery's access code, when the hosts set one */
  code(): string | null;
  /** this phone's random id (the gallery's) — null until it is known */
  uploader: string | null;
  /** the guest's personal link */
  guest: string | null;
  /** the name the guest gave the gallery */
  name: string;
  eventType: string;
  /** the gallery's colors (--gallery-accent…): the studio opens on top of the page, outside it */
  theme?: CSSProperties;
  /** a photo joined the gallery (or waits for the hosts): back to the feed */
  onShared(status: 'published' | 'pending'): void;
}) {
  const { locale, dir, plural } = useGuestText();
  const t = AI_PHOTOS_GUEST[locale];
  const [state, setState] = useState<GuestAiState | null>(null);
  const body = useCallback(
    (extra: Record<string, unknown> = {}) => {
      const c = code();
      return { t: token, ...(c ? { code: c } : {}), uploader, ...extra };
    },
    [token, code, uploader],
  );

  const load = useCallback(async () => {
    if (!uploader) return;
    const res = await galleryApi<{ ai: GuestAiState | null }>('/api/gallery/ai/state', body());
    if (res.ok && res.body) setState(res.body.ai);
  }, [uploader, body]);
  useEffect(() => {
    void load();
  }, [load]);

  // ── the studio ──
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<ShrunkPhoto | null>(null);
  const [scene, setScene] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [style, setStyle] = useState<Style>('photo');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'photo' | 'create' | 'share' | null>(null);
  const [active, setActive] = useState<GuestAiPhoto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const promptId = useId();

  const people = useMemo(() => state?.people ?? [], [state]);
  const typed = useMemo(() => detectPeople(prompt, people), [prompt, people]);
  // what the guest chose, else who their words name, else everyone
  const selected = chosen ?? (typed.length ? typed : people.map((p) => p.id));
  const names = (ids: readonly string[]) => {
    const list = people.filter((p) => ids.includes(p.id)).map((p) => nameIn(p.name, locale as Locale));
    return list.length > 1 ? `${list.slice(0, -1).join(', ')}${t.and}${list.at(-1)}` : (list[0] ?? '');
  };
  const allNames = names(people.map((p) => p.id));

  const reset = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setScene(false);
    setPrompt('');
    setChosen(null);
    setStyle('photo');
    setError(null);
    setActive(null);
  };
  const close = () => {
    setOpen(false);
    // a photo still being made stays in "your photos"
    if (!pending(active)) reset();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('photo');
    setError(null);
    try {
      const shrunk = await shrinkPhoto(file, {
        longSide: AI_PHOTOS.source.maxEdge,
        quality: AI_PHOTOS.source.quality,
        maxBytes: AI_PHOTOS.source.maxBytes,
      });
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto(shrunk);
      setScene(false);
    } catch {
      setError(t.photo.failed);
    } finally {
      setBusy(null);
    }
  };

  const errorText = (status: number, code?: string, limit?: number) => {
    if (status === 0) return t.errors.offline;
    const known = code && code in t.errors ? t.errors[code as keyof typeof t.errors] : null;
    if (code === 'guest_limit' && limit) return t.errors.guest_limit;
    return known ?? t.errors.generic;
  };

  const create = async () => {
    if (!uploader || !state) return;
    setBusy('create');
    setError(null);
    const res = await galleryApi<{ id?: string; left?: number; code?: string; limit?: number }>(
      '/api/gallery/ai/create',
      body({
        guest,
        name: name.trim() || null,
        prompt: prompt.trim(),
        people: selected,
        photo: photo?.base64 ?? null,
        style,
        lang: locale,
      }),
      { timeoutMs: 60_000 },
    );
    setBusy(null);
    if (!res.ok || !res.body?.id) {
      setError(errorText(res.status, res.body?.code, res.body?.limit));
      if (res.body?.code === 'guest_limit' || res.body?.code === 'event_limit') void load();
      return;
    }
    const made: GuestAiPhoto = {
      id: res.body.id,
      status: 'queued',
      prompt: prompt.trim(),
      thumb: null,
      result: null,
      width: null,
      height: null,
      shared: false,
      createdAt: new Date().toISOString(),
    };
    setActive(made);
    setState((s) =>
      s ? { ...s, left: res.body!.left ?? Math.max(0, s.left - 1), mine: [made, ...s.mine] } : s,
    );
  };

  // ── how the photo is doing ──
  const activeId = active?.id ?? null;
  const activePending = pending(active);
  useEffect(() => {
    if (!activeId || !activePending) return;
    let stopped = false;
    const timer = window.setInterval(async () => {
      const res = await galleryApi<{ photo?: GuestAiPhoto }>(
        '/api/gallery/ai/status',
        body({ id: activeId }),
      );
      if (stopped || !res.ok || !res.body?.photo) return;
      const p = res.body.photo;
      setActive((a) => (a?.id === p.id ? p : a));
      setState((s) => (s ? { ...s, mine: s.mine.map((m) => (m.id === p.id ? p : m)) } : s));
      if (p.status === 'failed' || p.status === 'blocked') {
        setError(p.status === 'blocked' ? t.errors.blocked : t.errors.failed);
        // it didn't count
        setState((s) => (s ? { ...s, left: Math.min(s.perGuest, s.left + 1) } : s));
      }
    }, AI_PHOTOS.pollMs);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeId, activePending, body, t.errors.blocked, t.errors.failed]);

  // back on the page while a photo is still being made: follow it
  useEffect(() => {
    if (!active && state?.mine.some(pending)) setActive(state.mine.find(pending) ?? null);
  }, [state, active]);

  // the working tips change every few seconds
  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (!activePending) return;
    const timer = window.setInterval(() => setTip((n) => n + 1), 3500);
    return () => window.clearInterval(timer);
  }, [activePending]);

  // into the gallery: the studio closes and the guest is back on the feed, where the photo is
  const share = async () => {
    if (!active) return;
    setBusy('share');
    const res = await galleryApi<{ status?: 'published' | 'pending'; code?: string }>(
      '/api/gallery/ai/share',
      body({ id: active.id }),
    );
    setBusy(null);
    if (!res.ok || !res.body?.status) {
      setError(errorText(res.status, res.body?.code));
      return;
    }
    const status = res.body.status;
    const id = active.id;
    setState((s) => (s ? { ...s, mine: s.mine.map((m) => (m.id === id ? { ...m, shared: true } : m)) } : s));
    setOpen(false);
    reset();
    setNotice(status === 'published' ? t.done.added : t.done.addedPending);
    onShared(status);
  };

  const download = async (p: GuestAiPhoto) => {
    if (!p.result) return;
    try {
      const blob = await (await fetch(p.result)).blob();
      const file = new File([blob], `ai-${p.id.slice(0, 8)}.jpg`, { type: 'image/jpeg' });
      return file;
    } catch {
      return null;
    }
  };
  const save = async (p: GuestAiPhoto) => {
    const file = await download(p);
    if (!file) return void window.open(p.result!, '_blank', 'noopener');
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const shareOut = async (p: GuestAiPhoto) => {
    const file = await download(p);
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fill(t.card.title, { names: allNames }) });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
    await save(p);
  };

  const remove = async (p: GuestAiPhoto) => {
    if (!window.confirm(t.mine.confirmDelete)) return;
    const res = await galleryApi('/api/gallery/ai/delete', body({ id: p.id }));
    if (!res.ok) return setNotice(t.errors.generic);
    setState((s) => (s ? { ...s, mine: s.mine.filter((m) => m.id !== p.id) } : s));
    if (active?.id === p.id) reset();
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // the studio: the page underneath doesn't scroll, Esc closes
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close reads the latest state when called
  }, [open]);

  if (!state || !people.length) return null;

  const loc = locale as Locale;
  const ideas = (t.ideas[IDEAS_OF[eventType as EventType] ?? 'other'] ?? t.ideas.other).map((idea) =>
    fill(idea, { names: names(selected), name: names(selected.slice(0, 1)) }),
  );
  const hasSource = !!photo || scene;
  const hasPrompt = prompt.trim().length >= 2;
  const out = state.left <= 0 || state.eventFull;
  const canCreate = !out && hasPrompt && selected.length > 0 && hasSource;
  // what is still missing, in the order of the steps
  const missing = !hasSource
    ? t.need.source
    : !selected.length
      ? t.need.who
      : !hasPrompt
        ? t.need.prompt
        : null;
  const leftText = state.eventFull
    ? t.card.full
    : state.left > 0
      ? plural(t.card.left, state.left)
      : t.card.none;
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const doneView = active?.status === 'done' && active.result;
  const title = fill(t.card.title, { names: allNames });

  const sourceTiles = [
    { key: 'take', Icon: Camera, hint: t.photo.takeHint, onClick: () => camera.current?.click() },
    { key: 'pick', Icon: ImagePlus, hint: t.photo.pickHint, onClick: () => files.current?.click() },
    { key: 'none', Icon: Wand2, hint: t.photo.noneHint, onClick: () => setScene(true) },
  ] as const;

  const studio = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-studio-title"
      style={theme}
      className="fixed inset-x-0 top-0 z-50 flex h-[100dvh] flex-col bg-[linear-gradient(180deg,color-mix(in_oklab,var(--gallery-accent)_10%,white),var(--color-canvas)_42%)] text-ink"
      dir={dir}
      data-testid="ai-studio"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 px-3">
        <button
          type="button"
          onClick={close}
          className="grid size-10 place-items-center rounded-full bg-white/70 shadow-sm backdrop-blur hover:bg-white"
          aria-label={t.close}
        >
          <Back aria-hidden className="size-5" />
        </button>
        <h2 id="ai-studio-title" className="min-w-0 flex-1 truncate text-[16px] font-bold">
          <bdi>{title}</bdi>
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gallery-accent)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--gallery-accent-ink)]">
          <Sparkles aria-hidden className="size-3" />
          {t.ai}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[560px] px-4 pt-1 pb-6">
          {doneView ? (
            // ── the result ──
            <div className="flex flex-col items-center gap-4 pt-2" data-testid="ai-result">
              <h3 className="flex items-center gap-2 text-[21px] font-bold">
                <Sparkles aria-hidden className="size-5 text-[var(--gallery-accent)]" />
                {t.done.title}
              </h3>
              <div className="relative rounded-[22px] bg-white p-2 shadow-[0_24px_60px_-24px_rgba(28,25,23,0.55)]">
                <img
                  src={active!.result!}
                  alt={active!.prompt}
                  className="max-h-[56dvh] w-auto max-w-full rounded-[16px] object-contain"
                />
              </div>
              {active!.prompt ? (
                <p className="max-w-[44ch] text-center text-[13.5px] text-muted">
                  “<bdi>{active!.prompt}</bdi>”
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="text-[13px] text-danger">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-center gap-1">
                {state.left > 0 && !state.eventFull ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-[var(--gallery-accent)] hover:bg-subtle"
                  >
                    <RefreshCw aria-hidden className="size-4" />
                    {t.done.again}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void remove(active!)}
                  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-muted hover:bg-subtle hover:text-danger"
                >
                  <Trash2 aria-hidden className="size-4" />
                  {t.mine.delete}
                </button>
              </div>
            </div>
          ) : pending(active) ? (
            // ── being made ──
            <div
              className="flex flex-col items-center gap-4 pt-6 text-center"
              role="status"
              aria-live="polite"
              data-testid="ai-working"
            >
              <div className="relative grid aspect-[4/5] w-[min(72vw,280px)] place-items-center overflow-hidden rounded-[28px] bg-[color-mix(in_oklab,var(--gallery-accent)_18%,white)] shadow-[0_24px_60px_-28px_rgba(28,25,23,0.6)]">
                {photo ? (
                  <img
                    src={photo.url}
                    alt=""
                    className="absolute inset-0 size-full object-cover opacity-60 blur-[3px]"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.55)_50%,transparent_70%)] bg-[length:250%_100%] motion-safe:animate-[ai-shimmer_2.2s_linear_infinite]"
                />
                <span className="relative flex flex-col items-center gap-3">
                  <Faces people={people} locale={loc} size={56} />
                  <span className="grid size-12 place-items-center rounded-full bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)] shadow-lg">
                    <Sparkles aria-hidden className="size-6 motion-safe:animate-pulse" />
                  </span>
                </span>
              </div>
              <h3 className="text-[20px] font-bold">{t.working.title}</h3>
              <p className="min-h-[1.5em] text-[14.5px] font-semibold text-[var(--gallery-accent)]">
                {t.working.tips[tip % t.working.tips.length]}
              </p>
              <p className="max-w-[40ch] text-[13px] text-muted">{t.working.body}</p>
              <button
                type="button"
                onClick={close}
                className="mt-1 max-w-[42ch] rounded-[16px] border border-line bg-surface px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-ink"
              >
                {t.working.close}
              </button>
            </div>
          ) : (
            // ── the request ──
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-3 rounded-[20px] bg-[var(--gallery-accent)] p-4 text-[var(--gallery-accent-ink)] shadow-[0_14px_36px_-20px_var(--gallery-accent)]">
                <Faces people={people} locale={loc} size={46} />
                <p className="min-w-0 flex-1 text-[14px] leading-snug font-medium">
                  <bdi>{fill(t.hero, { names: allNames })}</bdi>
                </p>
              </div>

              <Step n={1} title={t.steps.source} done={hasSource}>
                {photo ? (
                  <div className="relative overflow-hidden rounded-[16px] bg-subtle">
                    <img src={photo.url} alt="" className="max-h-[30dvh] w-full object-contain" />
                    <div className="absolute inset-x-2 bottom-2 flex justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => files.current?.click()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[12.5px] font-semibold text-white backdrop-blur"
                      >
                        <RefreshCw aria-hidden className="size-3.5" />
                        {t.photo.change}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(photo.url);
                          setPhoto(null);
                        }}
                        className="grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
                        aria-label={t.photo.remove}
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {sourceTiles.map(({ key, Icon, hint, onClick }) => {
                      const on = key === 'none' && scene;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={onClick}
                          aria-pressed={key === 'none' ? scene : undefined}
                          disabled={busy === 'photo'}
                          className={`flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-[16px] border px-1.5 py-3 text-center transition ${on ? ON : OFF}`}
                        >
                          <span
                            aria-hidden
                            className={`grid size-11 place-items-center rounded-full ${
                              on
                                ? 'bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)]'
                                : `${ACCENT_SOFT} text-[var(--gallery-accent)]`
                            }`}
                          >
                            {busy === 'photo' && key !== 'none' ? (
                              <LoaderCircle className="size-5 animate-spin" />
                            ) : (
                              <Icon className="size-5" />
                            )}
                          </span>
                          <span className="text-[13px] leading-tight font-bold">{t.photo[key]}</span>
                          <span className="text-[11px] leading-tight text-muted">{hint}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-[12.5px] text-muted">
                  {photo || !scene ? t.photo.help : t.photo.noneHelp}
                </p>
                <input
                  ref={camera}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={files}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </Step>

              <Step n={2} title={t.steps.who} done={selected.length > 0}>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setChosen(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])
                        }
                        className={`inline-flex min-h-12 items-center gap-2 rounded-full border py-1 ps-1 pe-3.5 text-start text-[13.5px] transition ${on ? ON : OFF}`}
                      >
                        <span className="relative">
                          <Faces people={[p]} locale={loc} size={38} />
                          {on ? (
                            <span
                              aria-hidden
                              className="absolute -end-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)] ring-2 ring-white"
                            >
                              <Check className="size-3" />
                            </span>
                          ) : null}
                        </span>
                        <span className="flex flex-col leading-tight">
                          <span className="font-bold">
                            <bdi>{nameIn(p.name, loc)}</bdi>
                          </span>
                          <span className="text-[11.5px] text-muted">{t.roles[p.role]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[12.5px] text-muted">{t.who.help}</p>
              </Step>

              <Step n={3} title={t.steps.what} done={hasPrompt} as="div" labelFor={promptId}>
                <textarea
                  id={promptId}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, AI_PHOTOS.prompt.max))}
                  rows={2}
                  maxLength={AI_PHOTOS.prompt.max}
                  placeholder={fill(t.what.placeholder, { name: nameIn(people[0]!.name, loc) })}
                  className="w-full resize-none rounded-[14px] border border-line bg-canvas px-3 py-2.5 text-[16px] outline-none focus:border-[var(--gallery-accent)] focus:bg-surface"
                  data-testid="ai-prompt"
                />
                <p className="mt-2.5 mb-1.5 flex items-center gap-1 text-[12px] font-semibold text-muted">
                  <Sparkles aria-hidden className="size-3.5 text-[var(--gallery-accent)]" />
                  {t.what.ideas}
                </p>
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {ideas.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setPrompt(idea)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-[12.5px] whitespace-nowrap transition ${
                        prompt === idea ? ON : OFF
                      }`}
                    >
                      <bdi>{idea}</bdi>
                    </button>
                  ))}
                </div>
              </Step>

              <Step n={4} title={t.steps.style} done>
                <div className="grid grid-cols-3 gap-2" data-testid="ai-styles">
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={style === s}
                      onClick={() => setStyle(s)}
                      className={`overflow-hidden rounded-[14px] border p-1 text-[12.5px] font-semibold transition ${
                        style === s ? ON : OFF
                      }`}
                    >
                      <span
                        aria-hidden
                        className="grid h-12 place-items-center rounded-[10px] text-[22px]"
                        style={{ background: STYLE_LOOK[s].swatch }}
                      >
                        {STYLE_LOOK[s].sign}
                      </span>
                      <span className="block px-0.5 py-1.5 leading-tight">{t.style[s]}</span>
                    </button>
                  ))}
                </div>
              </Step>

              {error ? (
                <p role="alert" className="rounded-[12px] bg-warning-bg px-3 py-2 text-[13px] text-warning">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* the bar under the steps: always on the screen. The left corner stays clear for the
          accessibility button (AccessibilityMenu place="corner"). */}
      {doneView ? (
        <div className="shrink-0 border-t border-line bg-surface/95 pt-3 pr-4 pb-[max(12px,env(safe-area-inset-bottom))] pl-[72px] backdrop-blur">
          <div className="mx-auto flex max-w-[560px] items-center gap-2">
            {state.toGallery && !active!.shared ? (
              <button
                type="button"
                onClick={() => void share()}
                disabled={busy === 'share'}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--gallery-accent)] px-5 text-[15px] font-bold text-[var(--gallery-accent-ink)] shadow-[0_10px_24px_-12px_var(--gallery-accent)] disabled:opacity-60"
                data-testid="ai-to-gallery"
              >
                {busy === 'share' ? (
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Images aria-hidden className="size-4" />
                )}
                {t.done.toGallery}
              </button>
            ) : active!.shared ? (
              <span className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 text-[14px] font-semibold text-success">
                <Check aria-hidden className="size-4" />
                {t.mine.inGallery}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void save(active!)}
              className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface"
              aria-label={t.done.download}
              title={t.done.download}
            >
              <Download aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => void shareOut(active!)}
              className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface"
              aria-label={t.done.share}
              title={t.done.share}
            >
              <Share2 aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      ) : !pending(active) ? (
        <div className="shrink-0 border-t border-line bg-surface/95 pt-2.5 pr-4 pb-[max(12px,env(safe-area-inset-bottom))] pl-[72px] backdrop-blur">
          <div className="mx-auto max-w-[560px]">
            <button
              type="button"
              onClick={() => void create()}
              disabled={!canCreate || busy === 'create'}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gallery-accent)] px-6 text-[15.5px] font-bold text-[var(--gallery-accent-ink)] shadow-[0_10px_24px_-12px_var(--gallery-accent)] transition disabled:opacity-45 disabled:shadow-none"
              data-testid="ai-create"
            >
              {busy === 'create' ? (
                <LoaderCircle aria-hidden className="size-5 animate-spin" />
              ) : (
                <Sparkles aria-hidden className="size-5" />
              )}
              {t.create}
            </button>
            <p className="mt-1.5 text-center text-[12px] text-muted" aria-live="polite">
              {out || !missing ? leftText : missing}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="mt-5" aria-labelledby="ai-photos-title" data-testid="ai-photos">
      <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,var(--gallery-accent),color-mix(in_oklab,var(--gallery-accent)_55%,#1c1917))] p-4 text-[var(--gallery-accent-ink)] shadow-[0_18px_44px_-22px_var(--gallery-accent)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -end-10 -top-12 size-40 rounded-full bg-white/15 blur-2xl"
        />
        <span aria-hidden className="pointer-events-none absolute end-4 top-3 text-[18px] opacity-80">
          ✨
        </span>
        <div className="relative flex items-center gap-3">
          <Faces people={people} locale={loc} size={52} />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase">
              <Sparkles aria-hidden className="size-3" />
              {t.ai}
            </span>
            <h2 id="ai-photos-title" className="mt-1 text-[17px] leading-snug font-bold">
              <bdi>{title}</bdi>
            </h2>
          </div>
        </div>
        <p className="relative mt-2 text-[13px] leading-relaxed opacity-90">
          {fill(t.card.body, { names: allNames })}
        </p>
        <button
          type="button"
          onClick={() => {
            if (!pending(active)) reset();
            setOpen(true);
          }}
          disabled={out && !active}
          className="relative mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-[var(--gallery-accent)] shadow-sm disabled:opacity-60"
          data-testid="ai-photos-open"
        >
          {pending(active) ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <Wand2 aria-hidden className="size-4" />
          )}
          {pending(active) ? t.working.title : t.card.cta}
        </button>
        <p className="relative mt-2 text-center text-[12px] opacity-85">{leftText}</p>
        {state.mine.length ? (
          <ul className="relative mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={t.mine.title}>
            {state.mine.map((p) => (
              <li key={p.id} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActive(p);
                    setOpen(true);
                  }}
                  className="grid size-16 place-items-center overflow-hidden rounded-[14px] bg-white/25 ring-2 ring-white/60"
                  aria-label={
                    p.status === 'done'
                      ? p.prompt
                      : t.mine[
                          p.status === 'blocked' ? 'blocked' : p.status === 'failed' ? 'failed' : 'waiting'
                        ]
                  }
                >
                  {p.thumb ? (
                    <img src={p.thumb} alt="" className="size-full object-cover" loading="lazy" />
                  ) : pending(p) ? (
                    <LoaderCircle aria-hidden className="size-5 animate-spin" />
                  ) : (
                    <X aria-hidden className="size-5" />
                  )}
                </button>
                {p.shared ? (
                  <span
                    className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-success text-white ring-2 ring-white"
                    title={t.mine.inGallery}
                  >
                    <Check aria-hidden className="size-3" />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {notice && !open ? (
        <p
          role="status"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-success-bg px-3 py-2 text-center text-[13px] font-semibold text-success"
          data-testid="ai-notice"
        >
          <Check aria-hidden className="size-4" />
          {notice}
        </p>
      ) : null}

      {open && typeof document !== 'undefined' ? createPortal(studio, document.body) : null}
    </section>
  );
}
