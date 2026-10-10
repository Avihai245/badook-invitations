'use client';
/* eslint-disable @next/next/no-img-element -- guests' photos come from short-lived signed URLs of private storage (or the phone itself): nothing for the image optimizer to cache */

import {
  CircleAlert,
  CircleCheck,
  Clock3,
  CloudOff,
  Hourglass,
  ImageIcon,
  LoaderCircle,
  RotateCcw,
  Video,
  X,
} from 'lucide-react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { progress, type QueueItem } from '../../queue';
import { isPermanent, type Snapshot } from '../../client/uploader';
import { fmt, useGuestText } from '../guest-text';

/**
 * The upload in progress, out of the way: a small pill floating above the share bar, as a social app
 * shows "posting…" — the photo going up, "1 of 2 uploaded", what is happening (offline, retrying,
 * paused by the hosts…) and a thin bar along its edge. When everything is up it says so and goes by
 * itself; while something needs the guest (a failed file) it stays. A tap opens the details: each
 * file with its state, a way to try again or take one off the list.
 */
export function QueuePanel({
  snapshot,
  items,
  thumbnail,
  onRetry,
  onRemove,
  onClear,
  raised,
}: {
  snapshot: Snapshot;
  /** this round's items */
  items: QueueItem[];
  thumbnail(localId: string): Promise<Blob | null>;
  onRetry(): void;
  onRemove(localId: string): void;
  onClear(): void;
  /** the share bar is under it */
  raised: boolean;
}) {
  const { t, plural, number, dir } = useGuestText();
  const [open, setOpen] = useState(false);
  const p = progress(items);
  const busy = items.some((i) => i.stage !== 'done' && i.stage !== 'failed' && i.stage !== 'skipped');
  const failed = items.some((i) => i.stage === 'failed');
  const retrying = items.some(
    (i) => i.attempts > 0 && i.error && !isPermanent(i.error) && i.stage !== 'failed',
  );
  const percent = p.bytesTotal ? Math.round((p.bytesSent / p.bytesTotal) * 100) : 0;
  const allDone = !busy && p.total > 0 && p.done === p.total;

  let status: { icon: ReactNode; text: string; tone: 'info' | 'warn' | 'ok' } | null = null;
  if (!snapshot.online && busy) status = { icon: <CloudOff />, text: t.progress.offline, tone: 'warn' };
  else if (snapshot.blocked === 'paused' || snapshot.blocked === 'scheduled')
    status = { icon: <Hourglass />, text: t.progress.paused, tone: 'warn' };
  else if (snapshot.blocked === 'ended' || snapshot.blocked === 'off')
    status = { icon: <CircleAlert />, text: t.progress.closed, tone: 'warn' };
  else if (snapshot.blocked === 'full')
    status = { icon: <CircleAlert />, text: t.progress.full, tone: 'warn' };
  else if (snapshot.blocked === 'code')
    status = { icon: <CircleAlert />, text: t.progress.codeNeeded, tone: 'warn' };
  else if (snapshot.passive) status = { icon: <Clock3 />, text: t.progress.passive, tone: 'info' };
  else if (retrying && busy) status = { icon: <RotateCcw />, text: t.progress.retrying, tone: 'warn' };
  else if (allDone) status = { icon: <CircleCheck />, text: t.progress.done, tone: 'ok' };

  // all up and nothing to fix: it says so, then leaves
  const onClearRef = useRef(onClear);
  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);
  useEffect(() => {
    if (!allDone || failed || open) return;
    const timer = setTimeout(() => onClearRef.current(), 4_000);
    return () => clearTimeout(timer);
  }, [allDone, failed, open]);

  // the photo on the pill: the one going up now, else the last one
  const current =
    items.find((i) => i.stage !== 'done' && i.stage !== 'failed' && i.stage !== 'skipped') ?? items.at(-1);
  const line =
    snapshot.preparing > 0 && !status
      ? plural(t.progress.preparing, snapshot.preparing)
      : (status?.text ?? (busy ? (snapshot.persistent ? t.progress.reopen : t.progress.keepOpen) : ''));
  const tone =
    failed || status?.tone === 'warn'
      ? 'text-warning'
      : status?.tone === 'ok'
        ? 'text-success'
        : 'text-muted';
  const width = allDone ? 100 : percent;

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 ${
          raised
            ? 'bottom-[calc(max(14px,env(safe-area-inset-bottom))+68px)]'
            : 'bottom-[max(14px,env(safe-area-inset-bottom))]'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-describedby="gallery-progress-line"
          data-testid="upload-progress"
          className="pointer-events-auto relative flex w-full max-w-[380px] items-center gap-3 overflow-hidden rounded-[18px] bg-surface/95 p-2 pe-3 text-start shadow-[0_16px_40px_-16px_rgba(0,0,0,0.45)] ring-1 ring-line backdrop-blur-xl motion-safe:animate-[gallery-in_400ms_cubic-bezier(0.22,1,0.36,1)_both] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Thumb item={current} thumbnail={thumbnail} size="size-10" />
          <span className="min-w-0 flex-1">
            <span
              id="gallery-progress"
              className="block text-[14px] leading-tight font-semibold"
              aria-live="polite"
            >
              {fmt(t.progress.uploaded, { done: number(p.done), total: number(p.total) })}
            </span>
            {line ? (
              <span
                id="gallery-progress-line"
                role="status"
                className={`mt-0.5 line-clamp-1 text-[12px] ${tone}`}
              >
                {line}
              </span>
            ) : null}
          </span>
          <span aria-hidden className={`shrink-0 [&_svg]:size-5 ${tone}`}>
            {failed ? (
              <CircleAlert />
            ) : allDone ? (
              <CircleCheck />
            ) : !snapshot.online || snapshot.blocked ? (
              (status?.icon ?? <Hourglass />)
            ) : (
              <LoaderCircle className="motion-safe:animate-spin" />
            )}
          </span>
          {/* how much is up, along the pill's edge */}
          <span
            className="absolute inset-x-0 bottom-0 h-[3px] bg-subtle"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={width}
            aria-labelledby="gallery-progress"
          >
            <span
              className={`block h-full transition-[width] duration-300 motion-reduce:transition-none ${
                allDone ? 'bg-success' : 'bg-[var(--gallery-accent)]'
              }`}
              style={{ width: `${width}%` }}
            />
          </span>
        </button>
      </div>

      {/* the details: each file and where it stands */}
      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay
            dir={dir}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-[3px] motion-safe:data-[state=open]:animate-app-fade-in sm:items-center sm:p-6"
          >
            <RadixDialog.Content
              data-testid="upload-details"
              className="relative max-h-[80svh] w-full max-w-[440px] overflow-y-auto rounded-t-[26px] bg-surface px-5 pt-2.5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl outline-none motion-safe:data-[state=open]:animate-app-dialog-in sm:rounded-[26px] sm:px-6 sm:pt-6"
            >
              <span
                aria-hidden
                className="mx-auto mb-4 block h-1 w-9 rounded-full bg-line-strong sm:hidden"
              />
              <div className="flex items-center justify-between gap-3">
                <RadixDialog.Title className="text-[18px] font-bold">
                  {fmt(t.progress.uploaded, { done: number(p.done), total: number(p.total) })}
                </RadixDialog.Title>
                <RadixDialog.Close
                  aria-label={t.viewer.close}
                  className="-me-2 grid size-10 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <X aria-hidden className="size-5" />
                </RadixDialog.Close>
              </div>
              <RadixDialog.Description className={`mt-1 text-[13px] ${tone}`}>
                {status?.text ??
                  (busy ? (snapshot.persistent ? t.progress.reopen : t.progress.keepOpen) : '')}
              </RadixDialog.Description>
              {items.length ? (
                <ul aria-label={t.progress.listLabel} className="mt-4 grid gap-2.5">
                  {items.map((item) => (
                    <QueueRow
                      key={item.localId}
                      item={item}
                      offline={!snapshot.online}
                      thumbnail={thumbnail}
                      onRetry={onRetry}
                      onRemove={onRemove}
                    />
                  ))}
                </ul>
              ) : null}
              {!busy && items.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onClear();
                  }}
                  className="mt-5 h-11 w-full rounded-full border border-line text-[14px] font-semibold text-ink hover:bg-subtle"
                >
                  {t.progress.clear}
                </button>
              ) : null}
            </RadixDialog.Content>
          </RadixDialog.Overlay>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  );
}

/** A file's picture from the phone (its thumbnail in the queue), or a photo / video mark. */
function Thumb({
  item,
  thumbnail,
  size,
}: {
  item: QueueItem | undefined;
  thumbnail(localId: string): Promise<Blob | null>;
  size: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const id = item?.localId;
  useEffect(() => {
    setSrc(null);
    if (!id) return;
    let url: string | null = null;
    let live = true;
    void thumbnail(id).then((blob) => {
      if (!live || !blob) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, thumbnail]);
  return (
    <span
      className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-[10px] bg-subtle text-muted`}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : item?.kind === 'video' ? (
        <Video aria-hidden className="size-5" />
      ) : (
        <ImageIcon aria-hidden className="size-5" />
      )}
    </span>
  );
}

function QueueRow({
  item,
  offline,
  thumbnail,
  onRetry,
  onRemove,
}: {
  item: QueueItem;
  /** the phone has no connection: what isn't sent waits for it */
  offline: boolean;
  thumbnail(localId: string): Promise<Blob | null>;
  onRetry(): void;
  onRemove(localId: string): void;
}) {
  const { t } = useGuestText();
  const total = Object.values(item.parts).reduce((s, part) => s + (part?.size ?? 0), 0);
  const pct = total ? Math.min(100, Math.round((item.sent / total) * 100)) : 0;
  const failed = item.stage === 'failed';
  const waiting = !failed && item.attempts > 0 && !!item.error;
  let label: string;
  let tone = 'text-muted';
  if (failed) {
    label = t.item.errors[item.error ?? ''] ?? t.item.failed;
    tone = 'text-danger';
  } else if (item.stage === 'done' || item.stage === 'visible') {
    const r = item.result;
    label =
      r?.status === 'pending'
        ? t.item.pending
        : r?.status === 'rejected'
          ? r.reason === 'duplicate'
            ? t.item.duplicate
            : t.item.rejected
          : t.item.published;
    tone =
      r?.status === 'published' || !r
        ? 'text-success'
        : r.status === 'pending'
          ? 'text-warning'
          : 'text-muted';
    if (item.stage === 'visible')
      label = `${label} · ${offline ? t.item.offline : fmt(t.item.sending, { percent: pct })}`;
  } else if (offline) label = t.item.offline;
  else if (waiting) label = t.item.waiting;
  else if (item.stage === 'queued') label = t.item.queued;
  else label = fmt(t.item.sending, { percent: pct });

  return (
    <li className="flex items-center gap-3" data-stage={item.stage}>
      <Thumb item={item} thumbnail={thumbnail} size="size-11" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">
          {item.kind === 'video' ? t.item.video : t.item.photo}
        </span>
        <span className={`block text-[12.5px] ${tone}`}>{label}</span>
      </span>
      {item.stage === 'done' && item.result?.status === 'published' ? (
        <CircleCheck aria-hidden className="size-5 shrink-0 text-success" />
      ) : null}
      {waiting && !offline ? (
        <button
          type="button"
          onClick={onRetry}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle"
          aria-label={t.item.retry}
          title={t.item.retry}
        >
          <RotateCcw aria-hidden className="size-4" />
        </button>
      ) : null}
      {failed ? (
        <button
          type="button"
          onClick={() => onRemove(item.localId)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-subtle"
          aria-label={t.item.remove}
          title={t.item.remove}
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </li>
  );
}
