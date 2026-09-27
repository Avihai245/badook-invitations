'use client';

import {
  Camera,
  Download,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  UserX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { galleryApi } from '@/features/live-gallery/client/api';
import { downloadAll } from '@/features/live-gallery/client/download';
import type { FeedItem } from '@/features/live-gallery/types';
import { MediaViewer } from '@/features/live-gallery/ui/MediaViewer';
import { FeedGrid } from '@/features/live-gallery/ui/guest/FeedGrid';
import { fmt, useGuestText } from '@/features/live-gallery/ui/guest-text';
import { FACES } from '../config';
import { largestFace, loadFaceEngine, pictureForFaces } from '../client/engine';

type Step = 'intro' | 'consent' | 'selfie' | 'working' | 'album';

/** This visit's own face code (never the selfie): kept in the tab's session only, and "forget me" wipes it. */
const storageKey = (token: string) => `badook-faces:${token}`;
function readStored(token: string): number[] | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(storageKey(token)) ?? 'null') as unknown;
    return Array.isArray(v) && v.length === 128 && v.every((x) => typeof x === 'number')
      ? (v as number[])
      : null;
  } catch {
    return null;
  }
}
function store(token: string, descriptor: number[] | null) {
  try {
    if (descriptor) sessionStorage.setItem(storageKey(token), JSON.stringify(descriptor));
    else sessionStorage.removeItem(storageKey(token));
  } catch {
    // private mode: the album lasts for this page only
  }
}

/**
 * "The photos I'm in" on the gallery's guest page (feature face_albums): an explicit consent first —
 * what is processed, that it happens on the phone, how long anything is kept, a link to the privacy
 * policy and a separate, unticked checkbox — then a selfie (the camera, or a photo from the phone),
 * turned into a face code on the phone; that code alone is sent once to find the photos. The album can
 * be viewed and downloaded; "forget me" erases the code from this phone and the guest's face from the
 * gallery's search at once, and a guest may ask not to appear in others' searches.
 */
export function FaceSearch({
  token,
  code,
  until,
}: {
  token: string;
  /** the gallery's access code, when the hosts set one */
  code(): string | null;
  /** the last day search is open (the face data's erasure) */
  until: string | null;
}) {
  const text = useGuestText();
  const { t, plural, number, date, dir } = text;
  const F = t.faces;
  const [step, setStep] = useState<Step>('intro');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<'forget' | 'leave' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);
  const descriptor = useRef<number[] | null>(null);
  const agreeId = useId();

  // the access code as it is when a request goes (the page may learn it later)
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  const body = useCallback(
    (extra: Record<string, unknown>) => {
      const c = codeRef.current();
      return { t: token, ...(c ? { code: c } : {}), ...extra };
    },
    [token],
  );
  const refused = useCallback(
    (status: number) =>
      status === 429
        ? F.selfie.rate
        : status === 410
          ? F.selfie.expired
          : status === 403
            ? F.selfie.off
            : F.selfie.failed,
    [F.selfie],
  );

  const search = useCallback(
    async (d: number[]) => {
      setStep('working');
      setStatus(F.selfie.searching);
      setError(null);
      const res = await galleryApi<{ items: FeedItem[]; code?: string }>(
        '/api/gallery/faces/search',
        body({ descriptor: d }),
      );
      if (!res.ok || !res.body) {
        setError(refused(res.status));
        setStep('selfie');
        return;
      }
      descriptor.current = d;
      store(token, d);
      setItems(res.body.items);
      setStep('album');
    },
    [token, body, refused, F.selfie.searching],
  );

  // back on the page in the same visit: the album again, without a new selfie
  useEffect(() => {
    const kept = readStored(token);
    if (kept) void search(kept);
  }, [token, search]);

  const fromPicture = async (source: Blob | HTMLCanvasElement) => {
    setError(null);
    setStep('working');
    setStatus(F.selfie.loading);
    let engine;
    try {
      engine = await loadFaceEngine();
    } catch {
      setError(F.selfie.unsupported);
      setStep('selfie');
      return;
    }
    try {
      const picture = source instanceof Blob ? await pictureForFaces(source) : source;
      const face = await largestFace(engine, picture);
      if (!face) {
        setError(F.selfie.noFace);
        setStep('selfie');
        return;
      }
      await search(face.descriptor);
    } catch {
      setError(F.selfie.failed);
      setStep('selfie');
    }
  };

  // ── the camera ──
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const stopCamera = useCallback(() => {
    setStream((s) => {
      s?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      void video.current.play().catch(() => undefined);
    }
  }, [stream]);
  const startCamera = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setStream(s);
    } catch {
      setError(F.selfie.cameraDenied);
      fileInput.current?.click();
    }
  };
  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, FACES.detect.longEdge / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    stopCamera();
    void fromPicture(canvas);
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const [canCamera, setCanCamera] = useState(false);
  useEffect(() => setCanCamera(typeof navigator.mediaDevices?.getUserMedia === 'function'), []);

  // ── forget, leave out ──
  const act = async (which: 'forget' | 'leave') => {
    setConfirm(null);
    const d = descriptor.current;
    if (!d) return;
    const res = await galleryApi(`/api/gallery/faces/${which}`, body({ descriptor: d }));
    if (!res.ok) {
      setNotice(refused(res.status));
      return;
    }
    descriptor.current = null;
    store(token, null);
    setItems([]);
    setOpen(null);
    setAgreed(false);
    setStep('intro');
    setNotice(which === 'forget' ? F.forgotten : F.leftOut);
  };

  const download = async () => {
    if (!items.length || downloading) return;
    setDownloading({ done: 0, total: items.length });
    const controller = new AbortController();
    try {
      await downloadAll({
        filename: `${F.album.title.replace(/\s+/g, '-')}`,
        streamToDisk: false,
        signal: controller.signal,
        missingListName: F.album.missingName,
        missingIntro: F.album.missingIntro,
        onProgress: (p) => setDownloading({ done: p.files, total: p.total }),
        page: async () => ({
          files: items
            .filter((i) => i.display)
            .map((i, k) => ({
              id: i.id,
              name: `${String(k + 1).padStart(3, '0')}_${i.id.slice(0, 8)}.jpg`,
              url: i.display!,
              size: 0,
              date: i.takenAt ?? i.at,
              partial: false,
            })),
          next: null,
          total: items.length,
          bytes: 0,
        }),
      });
      setNotice(F.album.downloaded);
    } catch {
      setNotice(F.selfie.failed);
    } finally {
      setDownloading(null);
    }
  };

  const button =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[12px] px-5 text-[15px] font-bold disabled:opacity-60';
  const primary = `${button} bg-[var(--gallery-accent)] text-[var(--gallery-accent-ink)]`;
  const secondary = `${button} border border-line bg-surface text-ink font-semibold`;

  return (
    <section
      className="mt-6 rounded-[20px] border border-line bg-surface p-5 shadow-sm sm:p-6"
      aria-labelledby="faces-title"
      data-testid="face-search"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-full bg-subtle text-[var(--gallery-accent)]"
        >
          <ScanFace className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 id="faces-title" className="text-[18px] font-bold">
            {step === 'album' ? F.album.title : F.title}
          </h2>
          {step !== 'album' ? <p className="mt-0.5 text-[14px] text-muted">{F.body}</p> : null}
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="mt-3 rounded-[10px] bg-subtle px-3 py-2 text-[13px]"
          data-testid="face-notice"
        >
          {notice}
        </p>
      ) : null}

      {step === 'intro' ? (
        <>
          <button
            type="button"
            className={`${primary} mt-4 w-full`}
            onClick={() => (setNotice(null), setStep('consent'))}
            data-testid="face-start"
          >
            <ScanFace aria-hidden className="size-5" />
            {F.start}
          </button>
          {until ? (
            <p className="mt-2 text-[12.5px] text-muted">
              {fmt(F.expiry, {
                date: date(`${until}T12:00:00Z`, { day: 'numeric', month: 'long', timeZone: 'UTC' }),
              })}
            </p>
          ) : null}
        </>
      ) : null}

      {step === 'consent' ? (
        <div className="mt-4 grid gap-3 text-[14px] leading-relaxed" data-testid="face-consent">
          <h3 className="text-[16px] font-bold">{F.consent.title}</h3>
          <Point icon={<ScanFace />}>{F.consent.what}</Point>
          <Point icon={<ShieldCheck />}>{F.consent.where}</Point>
          <Point icon={<ImagePlus />}>{F.consent.gallery}</Point>
          <Point icon={<Download />}>{fmt(F.consent.model, { mb: number(FACES.model.sizeMb) })}</Point>
          <Point icon={<UserX />}>{F.consent.forget}</Point>
          <a
            href="/privacy#faces"
            target="_blank"
            rel="noopener"
            className="text-[13px] font-semibold underline"
          >
            {F.consent.privacy}
          </a>
          <label
            htmlFor={agreeId}
            className="mt-1 flex items-start gap-3 rounded-[12px] border border-line p-3"
          >
            <input
              id={agreeId}
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-[var(--gallery-accent)]"
              aria-describedby={`${agreeId}-help`}
              data-testid="face-agree"
            />
            <span className="font-semibold">{F.consent.agree}</span>
          </label>
          <p id={`${agreeId}-help`} className="-mt-1 text-[12px] text-muted">
            {F.consent.agreeHelp}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={secondary} onClick={() => (setAgreed(false), setStep('intro'))}>
              {F.consent.cancel}
            </button>
            <button
              type="button"
              className={primary}
              disabled={!agreed}
              onClick={() => setStep('selfie')}
              data-testid="face-continue"
            >
              {F.consent.continue}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'selfie' ? (
        <div className="mt-4 grid gap-3" data-testid="face-selfie">
          <p className="text-[14px] text-muted">{F.selfie.body}</p>
          {error ? (
            <p
              role="alert"
              className="rounded-[10px] bg-warning-bg px-3 py-2 text-[13px] text-warning"
              data-testid="face-error"
            >
              {error}
            </p>
          ) : null}
          {stream ? (
            <div className="grid gap-2">
              <video
                ref={video}
                playsInline
                muted
                className="aspect-[3/4] w-full rounded-[14px] bg-black object-cover [transform:scaleX(-1)]"
              />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={secondary} onClick={stopCamera}>
                  <X aria-hidden className="size-4" />
                  {F.selfie.cancel}
                </button>
                <button type="button" className={primary} onClick={capture}>
                  <Camera aria-hidden className="size-5" />
                  {F.selfie.capture}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {canCamera ? (
                <button type="button" className={primary} onClick={() => void startCamera()}>
                  <Camera aria-hidden className="size-5" />
                  {F.selfie.camera}
                </button>
              ) : null}
              <button type="button" className={secondary} onClick={() => fileInput.current?.click()}>
                <ImagePlus aria-hidden className="size-5" />
                {F.selfie.file}
              </button>
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            data-testid="face-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void fromPicture(file);
            }}
          />
        </div>
      ) : null}

      {step === 'working' ? (
        <p
          role="status"
          className="mt-5 flex items-center justify-center gap-2 py-6 text-[14px] text-muted"
          data-testid="face-working"
        >
          <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" />
          {status}
        </p>
      ) : null}

      {step === 'album' ? (
        <div className="mt-4" data-testid="face-album">
          <p className="text-[14px] font-semibold" data-testid="face-count">
            {items.length ? plural(F.album.count, items.length, { n: number(items.length) }) : F.album.none}
          </p>
          {items.length ? (
            <div className="mt-3">
              <FeedGrid
                items={items}
                fresh={new Set()}
                onOpen={setOpen}
                hasMore={false}
                loadingMore={false}
                onMore={() => undefined}
                testId="face-album-grid"
              />
            </div>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {items.length ? (
              <button
                type="button"
                className={primary}
                onClick={() => void download()}
                disabled={!!downloading}
                data-testid="face-download"
              >
                <Download aria-hidden className="size-5" />
                {downloading
                  ? fmt(F.album.downloading, {
                      done: number(downloading.done),
                      total: number(downloading.total),
                    })
                  : F.album.download}
              </button>
            ) : null}
            <button type="button" className={secondary} onClick={() => (setError(null), setStep('selfie'))}>
              <RefreshCw aria-hidden className="size-4" />
              {F.album.again}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-[13px]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 font-semibold text-danger underline"
              onClick={() => setConfirm('forget')}
              data-testid="face-forget"
            >
              <UserX aria-hidden className="size-4" />
              {F.album.forget}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 font-semibold text-muted underline"
              onClick={() => setConfirm('leave')}
              data-testid="face-leave"
            >
              <EyeOff aria-hidden className="size-4" />
              {F.album.leave}
            </button>
          </div>
        </div>
      ) : null}

      {open !== null && items[open] ? (
        <MediaViewer
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          dir={dir}
          labels={t.viewer}
        />
      ) : null}

      {confirm ? (
        <Confirm
          title={confirm === 'forget' ? F.forgetConfirm.title : F.leaveConfirm.title}
          body={confirm === 'forget' ? F.forgetConfirm.body : F.leaveConfirm.body}
          confirm={confirm === 'forget' ? F.forgetConfirm.confirm : F.leaveConfirm.confirm}
          cancel={F.forgetConfirm.cancel}
          onConfirm={() => void act(confirm)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5">
      <span aria-hidden className="mt-0.5 shrink-0 text-muted [&_svg]:size-4">
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

/** A small confirmation (no dialog library on guests' phones). */
function Confirm({
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
        aria-labelledby="face-confirm-title"
        aria-describedby="face-confirm-body"
        className="w-full max-w-[440px] rounded-[18px] bg-surface p-5 text-ink shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="face-confirm"
      >
        <h2 id="face-confirm-title" className="text-[17px] font-bold">
          {title}
        </h2>
        <p id="face-confirm-body" className="mt-1 text-[14px] text-muted">
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
            data-testid="face-confirm-yes"
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
