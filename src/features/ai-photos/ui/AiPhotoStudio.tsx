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
  Share2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { EventType, Locale } from '@/features/invitations/contracts/types';
import { galleryApi } from '@/features/live-gallery/client/api';
import { useGuestText } from '@/features/live-gallery/ui/guest-text';
import { AI_PHOTOS_GUEST } from '@/lib/i18n/ai-photos-guest';
import { fill } from '@/lib/i18n/guest';
import { AI_PHOTOS } from '../config';
import { detectPeople, nameIn } from '../model';
import { shrinkPhoto, type ShrunkPhoto } from '../client/photo';
import type { GuestAiPhoto, GuestAiState } from '../types';

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

const pending = (p: GuestAiPhoto | null | undefined) =>
  !!p && (p.status === 'queued' || p.status === 'running');

/**
 * "A photo with Aviv & Roni" on the gallery's guest page (feature ai_photos): a card that opens a
 * studio — a photo from the event (the camera, the phone, or a new scene), who is in it (marked by
 * itself from what the guest writes: a name in any of the invitation's languages, "the groom", "the
 * couple", "everyone"), what should happen (free words, or an idea for this kind of event) — then the
 * photo is made in the background (a minute or two; the page asks how it is doing, and keeps asking
 * if the guest comes back later). The result is downloaded, shared, or added to the event's gallery.
 * The phone's photo is made small and re-encoded on the phone; the request is limited per phone.
 */
export function AiPhotoStudio({
  token,
  code,
  uploader,
  guest,
  name,
  eventType,
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
  /** a photo joined the gallery: the feed refreshes */
  onShared(): void;
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
    const sharedPhoto = { ...active, shared: true };
    setActive(sharedPhoto);
    setState((s) => (s ? { ...s, mine: s.mine.map((m) => (m.id === active.id ? sharedPhoto : m)) } : s));
    setNotice(res.body.status === 'published' ? t.done.added : t.done.addedPending);
    onShared();
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
    const timer = window.setTimeout(() => setNotice(null), 4500);
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

  const ideas = (t.ideas[IDEAS_OF[eventType as EventType] ?? 'other'] ?? t.ideas.other).map((idea) =>
    fill(idea, { names: names(selected), name: names(selected.slice(0, 1)) }),
  );
  const canCreate =
    state.left > 0 &&
    !state.eventFull &&
    prompt.trim().length >= 2 &&
    selected.length > 0 &&
    (photo || scene);
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const doneView = active?.status === 'done' && active.result;

  return (
    <section className="mt-5" aria-labelledby="ai-photos-title" data-testid="ai-photos">
      <div className="relative overflow-hidden rounded-[20px] border border-[color-mix(in_oklab,var(--gallery-accent)_35%,transparent)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--gallery-accent)_14%,white),white_60%)] p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)]"
          >
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ai-photos-title" className="text-[16px] leading-snug font-bold">
              <bdi>{fill(t.card.title, { names: allNames })}</bdi>
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">{fill(t.card.body, { names: allNames })}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!pending(active)) reset();
              setOpen(true);
            }}
            disabled={(state.left <= 0 || state.eventFull) && !active}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--gallery-accent)] px-5 text-[14px] font-semibold text-[var(--gallery-accent-ink)] shadow-sm disabled:opacity-50"
            data-testid="ai-photos-open"
          >
            <Wand2 aria-hidden className="size-4" />
            {pending(active) ? t.working.title : t.card.cta}
          </button>
          <span className="text-[12.5px] text-muted">
            {state.eventFull ? t.card.full : state.left > 0 ? plural(t.card.left, state.left) : t.card.none}
          </span>
        </div>
        {state.mine.length ? (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={t.mine.title}>
            {state.mine.map((p) => (
              <li key={p.id} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActive(p);
                    setOpen(true);
                  }}
                  className="grid size-16 place-items-center overflow-hidden rounded-[12px] bg-subtle"
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
                    <LoaderCircle aria-hidden className="size-5 animate-spin text-muted" />
                  ) : (
                    <X aria-hidden className="size-5 text-muted" />
                  )}
                </button>
                {p.shared ? (
                  <span
                    className="absolute -top-1 -end-1 grid size-5 place-items-center rounded-full bg-success text-white"
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
        <p role="status" className="mt-2 text-center text-[13px] text-success">
          {notice}
        </p>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-studio-title"
          className="fixed inset-0 z-50 flex flex-col bg-canvas"
          dir={dir}
          data-testid="ai-studio"
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
            <button
              type="button"
              onClick={close}
              className="grid size-10 place-items-center rounded-full hover:bg-subtle"
              aria-label={t.close}
            >
              <Back aria-hidden className="size-5" />
            </button>
            <h2 id="ai-studio-title" className="min-w-0 flex-1 truncate text-[16px] font-bold">
              <bdi>{fill(t.card.title, { names: allNames })}</bdi>
            </h2>
            <span className="rounded-full bg-[color-mix(in_oklab,var(--gallery-accent)_14%,white)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--gallery-accent)]">
              {t.ai}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[560px] px-4 pt-4 pb-28">
              {doneView ? (
                // ── the result ──
                <div className="flex flex-col items-center gap-4" data-testid="ai-result">
                  <h3 className="text-[20px] font-bold">{t.done.title}</h3>
                  <img
                    src={active!.result!}
                    alt={active!.prompt}
                    className="max-h-[62svh] w-auto max-w-full rounded-[16px] object-contain shadow-lg"
                  />
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void save(active!)}
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold"
                    >
                      <Download aria-hidden className="size-4" />
                      {t.done.download}
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareOut(active!)}
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold"
                    >
                      <Share2 aria-hidden className="size-4" />
                      {t.done.share}
                    </button>
                    {state.toGallery && !active!.shared ? (
                      <button
                        type="button"
                        onClick={() => void share()}
                        disabled={busy === 'share'}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--gallery-accent)] px-4 text-[14px] font-semibold text-[var(--gallery-accent-ink)] disabled:opacity-60"
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
                      <span className="inline-flex h-11 items-center gap-1.5 px-2 text-[13.5px] font-semibold text-success">
                        <Check aria-hidden className="size-4" />
                        {t.mine.inGallery}
                      </span>
                    ) : null}
                  </div>
                  {notice ? (
                    <p role="status" className="text-[13px] text-success">
                      {notice}
                    </p>
                  ) : null}
                  {error ? (
                    <p role="alert" className="text-[13px] text-danger">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    {state.left > 0 && !state.eventFull ? (
                      <button
                        type="button"
                        onClick={reset}
                        className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-[var(--gallery-accent)] hover:bg-subtle"
                      >
                        <Sparkles aria-hidden className="size-4" />
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
                  <div className="relative grid size-56 place-items-center overflow-hidden rounded-[24px] bg-subtle">
                    {photo ? (
                      <img
                        src={photo.url}
                        alt=""
                        className="absolute inset-0 size-full object-cover opacity-50 blur-[2px]"
                      />
                    ) : null}
                    <span className="relative grid size-16 place-items-center rounded-full bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)] shadow-lg">
                      <Sparkles aria-hidden className="size-7 motion-safe:animate-pulse" />
                    </span>
                  </div>
                  <h3 className="text-[19px] font-bold">{t.working.title}</h3>
                  <p className="text-[14px] font-medium text-[var(--gallery-accent)]">
                    {t.working.tips[tip % t.working.tips.length]}
                  </p>
                  <p className="max-w-[40ch] text-[13px] text-muted">{t.working.body}</p>
                </div>
              ) : (
                // ── the request ──
                <div className="flex flex-col gap-6">
                  <fieldset>
                    <legend className="mb-2 text-[14px] font-bold">{t.photo.label}</legend>
                    {photo ? (
                      <div className="relative overflow-hidden rounded-[16px] bg-subtle">
                        <img src={photo.url} alt="" className="max-h-[42svh] w-full object-contain" />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(photo.url);
                            setPhoto(null);
                          }}
                          className="absolute top-2 end-2 grid size-9 place-items-center rounded-full bg-black/55 text-white"
                          aria-label={t.photo.remove}
                        >
                          <X aria-hidden className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ['take', Camera, () => camera.current?.click()],
                            ['pick', ImagePlus, () => files.current?.click()],
                            ['none', Wand2, () => setScene(true)],
                          ] as const
                        ).map(([key, Icon, onClick]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={onClick}
                            aria-pressed={key === 'none' ? scene : undefined}
                            disabled={busy === 'photo'}
                            className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-[16px] border text-[13px] font-semibold ${
                              key === 'none' && scene
                                ? 'border-[var(--gallery-accent)] bg-[color-mix(in_oklab,var(--gallery-accent)_10%,white)] text-[var(--gallery-accent)]'
                                : 'border-line bg-surface text-ink hover:border-line-strong'
                            }`}
                          >
                            {busy === 'photo' && key !== 'none' ? (
                              <LoaderCircle aria-hidden className="size-6 animate-spin" />
                            ) : (
                              <Icon aria-hidden className="size-6" />
                            )}
                            {t.photo[key]}
                          </button>
                        ))}
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
                  </fieldset>

                  <fieldset>
                    <legend className="mb-2 text-[14px] font-bold">{t.who.label}</legend>
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
                            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-start text-[13.5px] ${
                              on
                                ? 'border-[var(--gallery-accent)] bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)]'
                                : 'border-line bg-surface text-ink'
                            }`}
                          >
                            {on ? <Check aria-hidden className="size-4" /> : null}
                            <span className="font-semibold">
                              <bdi>{nameIn(p.name, locale as Locale)}</bdi>
                            </span>
                            <span className={on ? 'opacity-80' : 'text-muted'}>· {t.roles[p.role]}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[12.5px] text-muted">{t.who.help}</p>
                  </fieldset>

                  <div>
                    <label htmlFor={promptId} className="mb-2 block text-[14px] font-bold">
                      {t.what.label}
                    </label>
                    <textarea
                      id={promptId}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value.slice(0, AI_PHOTOS.prompt.max))}
                      rows={3}
                      maxLength={AI_PHOTOS.prompt.max}
                      placeholder={fill(t.what.placeholder, {
                        name: nameIn(people[0]!.name, locale as Locale),
                      })}
                      className="w-full resize-none rounded-[14px] border border-line bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-[var(--gallery-accent)]"
                      data-testid="ai-prompt"
                    />
                    <p className="mt-2 mb-1.5 text-[12.5px] font-semibold text-muted">{t.what.ideas}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ideas.map((idea) => (
                        <button
                          key={idea}
                          type="button"
                          onClick={() => setPrompt(idea)}
                          className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] hover:border-line-strong"
                        >
                          <bdi>{idea}</bdi>
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11.5px] leading-relaxed text-muted">
                    {t.consent}{' '}
                    <a href="/privacy" target="_blank" rel="noopener" className="underline">
                      {t.privacy}
                    </a>
                  </p>
                  {error ? (
                    <p
                      role="alert"
                      className="rounded-[12px] bg-warning-bg px-3 py-2 text-[13px] text-warning"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {!doneView && !pending(active) ? (
            <div className="shrink-0 border-t border-line bg-canvas/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
              <div className="mx-auto flex max-w-[560px] items-center gap-3">
                <span className="flex-1 text-[12.5px] text-muted">
                  {state.eventFull
                    ? t.card.full
                    : state.left > 0
                      ? plural(t.card.left, state.left)
                      : t.card.none}
                </span>
                <button
                  type="button"
                  onClick={() => void create()}
                  disabled={!canCreate || busy === 'create'}
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--gallery-accent)] px-6 text-[15px] font-semibold text-[var(--gallery-accent-ink)] shadow-sm disabled:opacity-50"
                  data-testid="ai-create"
                >
                  {busy === 'create' ? (
                    <LoaderCircle aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Sparkles aria-hidden className="size-4" />
                  )}
                  {t.create}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
