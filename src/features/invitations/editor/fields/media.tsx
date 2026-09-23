'use client';

import { Crosshair, ImageUp, Trash2, Upload } from 'lucide-react';
import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, cn } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { AssetRef, Media } from '../../contracts/types';
import { hostApi } from '../../app/api';
import { placeholderArt } from '../../renderer/placeholders';
import { getAt } from '../paths';
import { useEditor } from '../state/EditorProvider';
import { FieldFrame } from './fields';

export const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/avif';
export const VIDEO_TYPES = 'video/mp4';
export const AUDIO_TYPES = 'audio/mpeg';

export type UploadKind = 'image' | 'video' | 'audio';

export class UploadError extends Error {
  constructor(
    readonly code: 'too_large' | 'unsupported_type' | 'failed',
    readonly max?: number,
  ) {
    super(code);
  }
}

type UploadTicket =
  { ok: true; url: string; ref: AssetRef; kind: UploadKind } | { ok: false; code: string; max?: number };

/** PUT to the signed upload URL with progress events (fetch has none). */
function put(url: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new UploadError(
              xhr.status === 413 ? 'too_large' : xhr.status === 415 ? 'unsupported_type' : 'failed',
            ),
          );
    xhr.onerror = () => reject(new UploadError('failed'));
    xhr.send(file);
  });
}

/**
 * §4 uploads: the API checks type/size and returns a signed URL for `<user>/<invitation>/<uuid>.<ext>`
 * in the invitation-media bucket; the browser sends the file straight to storage.
 */
export function useUpload() {
  const { meta } = useEditor();
  return useCallback(
    async (file: File, onProgress?: (percent: number) => void) => {
      const res = await hostApi<UploadTicket>(`/api/invitations/${meta.id}/uploads`, {
        method: 'POST',
        body: { contentType: file.type, size: file.size },
      });
      const body = res.body;
      if (!res.ok || !body?.ok)
        throw new UploadError(
          res.status === 413 ? 'too_large' : res.status === 415 ? 'unsupported_type' : 'failed',
          body && !body.ok ? body.max : undefined,
        );
      await put(body.url, file, onProgress);
      return { ref: body.ref, kind: body.kind };
    },
    [meta.id],
  );
}

/** Upload state + the localized error of a failed upload. */
export function useUploader() {
  const upload = useUpload();
  const { t } = useUi();
  const u = t.editor.upload;
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (file: File) => {
      setError(null);
      setProgress(0);
      try {
        return await upload(file, setProgress);
      } catch (err) {
        const e = err instanceof UploadError ? err : new UploadError('failed');
        setError(
          e.code === 'too_large'
            ? fmt(u.tooLarge, { max: e.max ? fmt(u.mb, { n: Math.round(e.max / 1024 / 1024) }) : '' })
            : e.code === 'unsupported_type'
              ? u.badType
              : u.failed,
        );
        return null;
      } finally {
        setProgress(null);
      }
    },
    [upload, u],
  );
  return { run, progress, error };
}

/**
 * Opens the file picker: the dashed "upload" tile (app.html `.thumb.upload`, sized by `className`), or
 * a small secondary button (`variant="button"`, e.g. "replace").
 */
export function UploadTile({
  label,
  accept,
  multiple = false,
  onFiles,
  progress,
  variant = 'tile',
  disabled = false,
  className,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  progress: number | null;
  variant?: 'tile' | 'button';
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const busy = progress !== null;
  const text = busy ? fmt(t.editor.upload.uploading, { percent: progress }) : label;
  return (
    <>
      {variant === 'button' ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload />}
          onClick={() => input.current?.click()}
          loading={busy}
          disabled={disabled}
          className={className}
        >
          <span aria-live="polite">{text}</span>
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy || disabled}
          aria-busy={busy || undefined}
          className={cn(
            'grid place-items-center rounded-input border-[1.5px] border-dashed border-line-strong bg-surface p-2 text-center text-[12px] text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-60',
            busy && 'disabled:cursor-progress disabled:opacity-100',
            className,
          )}
        >
          <span className="flex flex-col items-center gap-1" aria-live="polite">
            <Upload aria-hidden size={18} strokeWidth={1.75} />
            {text}
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

function Thumb({
  selected,
  onClick,
  background,
  url,
  kind,
  caption,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  background?: string;
  url: string | null;
  kind: 'image' | 'video';
  caption?: string;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={label}
        onClick={onClick}
        className={cn(
          'relative block aspect-[9/16] w-full overflow-hidden rounded-input border-2',
          selected ? 'border-ink' : 'border-transparent hover:border-line-strong',
        )}
        style={{ background: background ?? '#EFEDEA' }}
      >
        {url && kind === 'image' ? (
          <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        {url && kind === 'video' ? (
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        {caption ? (
          <span className="absolute inset-x-0 bottom-0 bg-linear-to-b from-transparent to-black/55 p-1.5 text-start text-[11px] text-white">
            {caption}
          </span>
        ) : null}
      </button>
      {children}
    </div>
  );
}

/**
 * Hero background (§7.5): the template's options as 9:16 thumbnails + the host's upload (photo or
 * video) with a focal-point picker. `path` = the section's `data.media`.
 */
export function HeroMediaField({ path, label }: { path: string; label: string }) {
  const { doc, template, update, assetUrl, locale } = useEditor();
  const { t } = useUi();
  const u = t.editor.upload;
  const media = getAt(doc, path) as Media;
  const { run, progress, error } = useUploader();
  const [focal, setFocal] = useState(false);
  const art = placeholderArt(template.id);
  const isUpload = !template.hero.options.some((o) => o.media.src === media.src);

  const onFiles = async ([file]: File[]) => {
    if (!file) return;
    const res = await run(file);
    if (!res || res.kind === 'audio') return;
    update(path, { kind: res.kind, src: res.ref, poster: null, focalPoint: { x: 0.5, y: 0.5 } }, null);
    setFocal(true);
  };

  return (
    <FieldFrame path={path} label={label}>
      <div className="grid grid-cols-3 gap-2">
        {template.hero.options.map((o) => {
          const name = o.name[locale] ?? o.name.en ?? o.id;
          const poster =
            assetUrl(o.media.poster) ?? (o.media.kind === 'image' ? assetUrl(o.media.src) : null);
          return (
            <Thumb
              key={o.id}
              selected={o.media.src === media.src}
              onClick={() => update(path, structuredClone(o.media), null)}
              background={art.sky}
              url={poster}
              kind="image"
              caption={name}
              label={name}
            />
          );
        })}
        {isUpload ? (
          <Thumb
            selected
            onClick={() => setFocal(true)}
            url={assetUrl(media.kind === 'video' ? (media.poster ?? media.src) : media.src)}
            kind={media.kind === 'video' && !media.poster ? 'video' : 'image'}
            caption={u.uploaded}
            label={u.focal}
          >
            <button
              type="button"
              onClick={() => setFocal(true)}
              className="absolute start-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow-sm"
              aria-label={u.focal}
            >
              <Crosshair aria-hidden size={14} strokeWidth={1.75} />
            </button>
          </Thumb>
        ) : null}
        <UploadTile
          label={u.imageOrVideo}
          accept={`${IMAGE_TYPES},${VIDEO_TYPES}`}
          onFiles={(f) => void onFiles(f)}
          progress={progress}
          className="aspect-[9/16]"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
      {focal && isUpload ? (
        <FocalPointDialog
          url={assetUrl(media.src)}
          kind={media.kind}
          value={media.focalPoint}
          onChange={(p) => update(`${path}.focalPoint`, p, `${path}.focalPoint`)}
          onClose={() => setFocal(false)}
        />
      ) : null}
    </FieldFrame>
  );
}

/** Click the important part of the photo/video; it stays in frame (object-position) on every screen. */
export function FocalPointDialog({
  url,
  kind,
  value,
  onChange,
  onClose,
}: {
  url: string | null;
  kind: 'image' | 'video';
  value: { x: number; y: number };
  onChange: (p: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const { t } = useUi();
  const u = t.editor.upload;
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
    onChange({ x: round((e.clientX - r.left) / r.width), y: round((e.clientY - r.top) / r.height) });
  };
  const nudge = (e: React.KeyboardEvent) => {
    const step = 0.05;
    // Physical arrows move the point physically (the picture isn't mirrored in RTL).
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    const clamp = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
    onChange({ x: clamp(value.x + m[0]), y: clamp(value.y + m[1]) });
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={u.focalTitle}
      description={u.focalHelp}
      closeLabel={t.common.close}
      footer={<Button onClick={onClose}>{t.common.save}</Button>}
    >
      <div className="flex justify-center">
        <div
          role="group"
          tabIndex={0}
          aria-label={u.focal}
          onPointerDown={pick}
          onKeyDown={nudge}
          className="relative max-h-[60vh] cursor-crosshair overflow-hidden rounded-input bg-subtle outline-none focus-visible:shadow-ring"
          dir="ltr"
        >
          {url && kind === 'image' ? (
            <img src={url} alt="" draggable={false} className="block max-h-[60vh] w-auto select-none" />
          ) : url ? (
            <video src={url} muted playsInline preload="metadata" className="block max-h-[60vh] w-auto" />
          ) : (
            <div className="grid size-64 place-items-center text-muted">
              <ImageUp aria-hidden />
            </div>
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,.35)]"
            style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
          />
          <span className="sr-only" aria-live="polite">
            {`${Math.round(value.x * 100)}% · ${Math.round(value.y * 100)}%`}
          </span>
        </div>
      </div>
    </Dialog>
  );
}

/** A single optional image (section illustration, share image): thumbnail + replace/remove, or upload. */
export function ImageField({ path, label, help }: { path: string; label: string; help?: ReactNode }) {
  const { doc, update, assetUrl } = useEditor();
  const { t } = useUi();
  const u = t.editor.upload;
  const ref = getAt(doc, path) as AssetRef | null;
  const { run, progress, error } = useUploader();
  const id = useId();
  const url = assetUrl(ref);
  const onFiles = async ([file]: File[]) => {
    if (!file) return;
    const res = await run(file);
    if (res?.kind === 'image') update(path, res.ref, null);
  };
  return (
    <FieldFrame path={path} label={label}>
      <div className="mb-1.5 text-[13px] font-semibold" id={`${id}l`}>
        {label}
      </div>
      <div className="flex items-center gap-3" aria-labelledby={`${id}l`} role="group">
        {ref ? (
          <>
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-input border border-line bg-subtle">
              {url ? (
                <img src={url} alt="" className="size-full object-cover" />
              ) : (
                <ImageUp aria-hidden size={18} className="text-faint" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <UploadTile
                variant="button"
                label={u.replace}
                accept={IMAGE_TYPES}
                onFiles={(f) => void onFiles(f)}
                progress={progress}
              />
              <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => update(path, null, null)}>
                {u.remove}
              </Button>
            </div>
          </>
        ) : (
          <UploadTile
            label={u.image}
            accept={IMAGE_TYPES}
            onFiles={(f) => void onFiles(f)}
            progress={progress}
            className="h-16 w-full"
          />
        )}
      </div>
      {help ? <p className="mt-1.5 text-[12px] text-muted">{help}</p> : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </FieldFrame>
  );
}
