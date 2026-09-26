'use client';

import { Film, ImageUp, Images, Trash2 } from 'lucide-react';
import { useCallback, useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button, cn } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { AssetRef, InvitationDocument, SectionMedia, TemplateManifest } from '../../contracts/types';
import { patchSectionMedia, setSectionMedia } from '../presentation';
import { useEditor } from '../state/EditorProvider';
import { FieldFrame } from './fields';
import { IMAGE_TYPES, UploadTile, VIDEO_TYPES, captureVideoStill, useUpload, useUploader } from './media';

/** A picture (or a video, by its still) the invitation already has — the media picker's library. */
export interface InvitationPicture {
  kind: 'image' | 'video';
  src: AssetRef;
  poster: AssetRef | null;
  /** what the thumbnail shows (the picture, or the video's still) */
  thumb: string;
  focalPoint: { x: number; y: number };
}

const PHOTO_FILE = /\.(jpe?g|png|webp|avif)$/i;

/**
 * Every picture the invitation already uses or offers — the hero's, the sections', the gallery's,
 * then the template's own photos — once each, with a URL to show (a file not produced yet is left
 * out). Videos come with their still.
 */
export function invitationPictures(
  doc: InvitationDocument,
  template: Pick<TemplateManifest, 'hero' | 'assets'>,
  assetUrl: (ref: AssetRef | null | undefined) => string | null,
): InvitationPicture[] {
  const out: InvitationPicture[] = [];
  const seen = new Set<string>();
  const add = (
    kind: 'image' | 'video',
    src: AssetRef,
    poster: AssetRef | null,
    focalPoint = { x: 0.5, y: 0.5 },
  ) => {
    // a YouTube / Vimeo link can't be a section's video
    if (seen.has(src) || /^https:\/\/(www\.)?(youtube|youtu\.be|vimeo)/.test(src)) return;
    const thumb = assetUrl(kind === 'video' ? poster : src);
    if (!thumb) return;
    seen.add(src);
    out.push({ kind, src, poster, thumb, focalPoint });
  };
  for (const s of doc.sections) {
    if (s.type === 'hero') {
      const m = s.data.media;
      add(m.kind, m.src, m.poster, m.focalPoint);
    } else if (s.media) add(s.media.kind, s.media.src, s.media.poster, s.media.focalPoint);
    if (s.type === 'gallery') for (const img of s.data.images) add('image', img.src, null);
  }
  for (const o of template.hero.options) {
    const m = o.media;
    if (m.kind === 'image') add('image', m.src, null, m.focalPoint);
    else if (m.poster) add('image', m.poster, null, m.focalPoint);
  }
  // the template's own photographs (a photographic design's list of pictures)
  for (const [key, path] of Object.entries(template.assets))
    if (PHOTO_FILE.test(path)) add('image', `template:${key}`, null);
  return out;
}

const round2 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;

/**
 * The picture itself, where a tap sets its focal point (the part that stays in frame): the point is
 * drawn where it is; the arrow keys move it (physically — the picture isn't mirrored in RTL).
 */
export function FocalBox({
  url,
  kind,
  value,
  onChange,
  label,
  className,
}: {
  url: string | null;
  kind: 'image' | 'video';
  value: { x: number; y: number };
  onChange: (p: { x: number; y: number }) => void;
  label: string;
  className?: string;
}) {
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange({ x: round2((e.clientX - r.left) / r.width), y: round2((e.clientY - r.top) / r.height) });
  };
  const nudge = (e: KeyboardEvent) => {
    const step = 0.05;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    onChange({ x: round2(value.x + m[0]), y: round2(value.y + m[1]) });
  };
  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={label}
      onPointerDown={pick}
      onKeyDown={nudge}
      data-testid="focal-box"
      dir="ltr"
      className={cn(
        'relative mx-auto w-fit max-w-full cursor-crosshair touch-none overflow-hidden rounded-input bg-subtle outline-none focus-visible:shadow-ring',
        className,
      )}
    >
      {url && kind === 'image' ? (
        <img
          src={url}
          alt=""
          draggable={false}
          className="block max-h-[220px] w-auto max-w-full select-none"
        />
      ) : url ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="block max-h-[220px] w-auto max-w-full"
        />
      ) : (
        <div className="grid h-32 w-48 place-items-center text-muted">
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
  );
}

/** A thumbnail button of the invitation's pictures. */
function PictureChoice({
  picture,
  label,
  selected,
  onPick,
}: {
  picture: InvitationPicture;
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={onPick}
      className={cn(
        'relative size-16 shrink-0 overflow-hidden rounded-input border-2 bg-subtle',
        selected ? 'border-ink' : 'border-transparent hover:border-line-strong',
      )}
    >
      <img src={picture.thumb} alt="" className="size-full object-cover" />
      {picture.kind === 'video' ? (
        <Film aria-hidden size={14} className="absolute end-1 bottom-1 text-white drop-shadow" />
      ) : null}
    </button>
  );
}

/**
 * A section's picture or video (v2 `media`): upload one (a video gets its still read from the file
 * and uploaded beside it), or take one the invitation already has; a tap on it sets its focal point;
 * replace or remove it. `index`: the section's place in `doc.sections`.
 */
export function SectionMediaField({ index }: { index: number }) {
  const { doc, template, apply, assetUrl } = useEditor();
  const { t } = useUi();
  const c = t.editor.cine.media;
  const section = doc.sections[index]!;
  const media = section.type === 'hero' ? null : (section.media ?? null);
  const path = `sections.${index}.media`;
  const { run, progress, error } = useUploader();
  const uploadQuietly = useUpload();
  const [library, setLibrary] = useState(false);
  const listId = useId();
  const pictures = invitationPictures(doc, template, assetUrl);

  const set = useCallback(
    (next: SectionMedia | null) => apply((d) => setSectionMedia(d, index, next), null),
    [apply, index],
  );

  const onFiles = async ([file]: File[]) => {
    if (!file) return;
    const still = file.type.startsWith('video/') ? captureVideoStill(file) : Promise.resolve(null);
    const res = await run(file);
    if (!res || res.kind === 'audio') return;
    let poster: AssetRef | null = null;
    if (res.kind === 'video') {
      const frame = await still;
      if (frame)
        poster = await uploadQuietly(frame).then(
          (r) => r.ref,
          () => null,
        );
    }
    set({ kind: res.kind, src: res.ref, poster, focalPoint: { x: 0.5, y: 0.5 } });
    setLibrary(false);
  };

  const onStill = async ([file]: File[]) => {
    if (!file) return;
    const res = await run(file);
    if (res?.kind === 'image') apply((d) => patchSectionMedia(d, index, { poster: res.ref }), null);
  };

  const shown = media ? assetUrl(media.kind === 'video' ? (media.poster ?? media.src) : media.src) : null;
  const shownKind = media?.kind === 'video' && !media.poster ? 'video' : 'image';

  return (
    <FieldFrame path={path} label={t.editor.fieldLabels['section.media']}>
      <div className="flex flex-col gap-3">
        {media ? (
          <>
            <FocalBox
              url={shown}
              kind={shownKind}
              value={media.focalPoint}
              label={c.focalLabel}
              onChange={(focalPoint) =>
                apply((d) => patchSectionMedia(d, index, { focalPoint }), `${path}.focalPoint`)
              }
            />
            <p className="text-center text-[12px] text-muted">
              {media.kind === 'video' ? (
                <span className="me-1 inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 font-semibold text-ink">
                  <Film aria-hidden size={12} /> {c.video}
                </span>
              ) : null}
              {c.focalHint}
            </p>
            {media.kind === 'video' ? <p className="text-[12px] text-muted">{c.videoNote}</p> : null}
            {media.kind === 'video' && !media.poster ? (
              <div className="flex flex-wrap items-center gap-2 rounded-input bg-warning-bg px-3 py-2 text-[12px] text-warning">
                <span className="flex-1">{c.stillMissing}</span>
                <UploadTile
                  variant="button"
                  label={c.addStill}
                  accept={IMAGE_TYPES}
                  onFiles={(f) => void onStill(f)}
                  progress={progress}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <UploadTile
                variant="button"
                label={c.replace}
                accept={`${IMAGE_TYPES},${VIDEO_TYPES}`}
                onFiles={(f) => void onFiles(f)}
                progress={progress}
              />
              {pictures.length ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Images />}
                  aria-expanded={library}
                  aria-controls={listId}
                  onClick={() => setLibrary((o) => !o)}
                >
                  {c.fromInvitation}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => set(null)}>
                {c.remove}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <UploadTile
              label={c.upload}
              accept={`${IMAGE_TYPES},${VIDEO_TYPES}`}
              onFiles={(f) => void onFiles(f)}
              progress={progress}
              className="h-20 w-full"
            />
            {pictures.length ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Images />}
                aria-expanded={library}
                aria-controls={listId}
                onClick={() => setLibrary((o) => !o)}
                className="self-start"
              >
                {c.fromInvitation}
              </Button>
            ) : (
              <p className="text-[12px] text-muted">{c.noPictures}</p>
            )}
          </div>
        )}
        {library && pictures.length ? (
          <div id={listId} role="group" aria-label={c.fromInvitationTitle} className="flex flex-wrap gap-2">
            {pictures.map((p, n) => (
              <PictureChoice
                key={p.src}
                picture={p}
                label={fmt(c.pick, { n: n + 1 })}
                selected={media?.src === p.src}
                onPick={() => {
                  set({ kind: p.kind, src: p.src, poster: p.poster, focalPoint: p.focalPoint });
                  setLibrary(false);
                }}
              />
            ))}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FieldFrame>
  );
}
