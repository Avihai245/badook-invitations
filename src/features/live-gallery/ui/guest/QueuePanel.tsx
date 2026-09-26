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
import { useEffect, useState, type ReactNode } from 'react';
import { progress, type QueueItem } from '../../queue';
import { isPermanent, type Snapshot } from '../../client/uploader';
import { fmt, useGuestText } from '../guest-text';

/**
 * The upload in progress: "3 of 7 uploaded" with a bar, what's happening (preparing, offline,
 * retrying, paused by the hosts…), and each file with its state — waiting, uploading with a percentage,
 * in the gallery, awaiting approval, or failed with a way to try again or take it off the list.
 */
export function QueuePanel({
  snapshot,
  items,
  thumbnail,
  onRetry,
  onRemove,
  onClear,
}: {
  snapshot: Snapshot;
  /** this round's items */
  items: QueueItem[];
  thumbnail(localId: string): Promise<Blob | null>;
  onRetry(): void;
  onRemove(localId: string): void;
  onClear(): void;
}) {
  const { t, plural, number } = useGuestText();
  const p = progress(items);
  const busy = items.some((i) => i.stage !== 'done' && i.stage !== 'failed' && i.stage !== 'skipped');
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

  return (
    <section
      aria-labelledby="gallery-progress"
      className="rounded-[16px] border border-line bg-surface p-4 shadow-sm"
      data-testid="upload-progress"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="gallery-progress" className="text-[16px] font-bold" aria-live="polite">
          {fmt(t.progress.uploaded, { done: number(p.done), total: number(p.total) })}
        </h2>
        {!busy && items.length ? (
          <button type="button" onClick={onClear} className="text-[13px] font-semibold text-muted underline">
            {t.progress.clear}
          </button>
        ) : null}
      </div>
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={allDone ? 100 : percent}
        aria-labelledby="gallery-progress"
      >
        <div
          className="h-full rounded-full bg-[var(--gallery-accent)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${allDone ? 100 : percent}%` }}
        />
      </div>
      {snapshot.preparing > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
          <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" />
          {plural(t.progress.preparing, snapshot.preparing)}
        </p>
      ) : null}
      {status ? (
        <p
          role="status"
          className={`mt-2 flex items-start gap-1.5 text-[13px] [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0 ${
            status.tone === 'warn' ? 'text-warning' : status.tone === 'ok' ? 'text-success' : 'text-muted'
          }`}
        >
          {status.icon}
          <span>{status.text}</span>
        </p>
      ) : null}
      {busy ? (
        <p className="mt-1.5 text-[12px] text-muted">
          {snapshot.persistent ? t.progress.reopen : t.progress.keepOpen}
        </p>
      ) : null}
      {items.length ? (
        <ul aria-label={t.progress.listLabel} className="mt-3 grid gap-2">
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
    </section>
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
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    void thumbnail(item.localId).then((blob) => {
      if (!live || !blob) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
    // the thumbnail stays the same for an item; it is only fetched once
  }, [item.localId, thumbnail]);

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
      <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-subtle text-muted">
        {src ? (
          <img src={src} alt="" className="size-full object-cover" />
        ) : item.kind === 'video' ? (
          <Video aria-hidden className="size-5" />
        ) : (
          <ImageIcon aria-hidden className="size-5" />
        )}
      </span>
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
