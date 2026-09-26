'use client';
/* eslint-disable @next/next/no-img-element -- photos still on the host's device (blob:) and the invitation's own, shown small while choosing: nothing for the image optimizer to do */

import { ImagePlus, Star, Upload, X } from 'lucide-react';
import { useId, useRef } from 'react';
import { Button, Field, Hint, Input, cn } from '@/components/app';
import type { AssetRef } from '@/features/invitations/contracts/types';
import { IMAGE_TYPES } from '@/features/invitations/editor/fields/media';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { ART_DIRECTION } from '../config';
import type { Studio } from './useStudio';

/**
 * The photos for "design it for me": the ones chosen (the first opens the invitation; another can be
 * moved there), the invitation's own to pick from, photos from the device, and the mood.
 */
export function PhotoPicker({
  studio,
  own = [],
}: {
  studio: Studio;
  /** the invitation's pictures (reference and address) */
  own?: readonly { ref: AssetRef; url: string }[];
}) {
  const { t } = useUi();
  const a = t.studio.art;
  const file = useRef<HTMLInputElement>(null);
  const listId = useId();
  const moodId = useId();
  const { photos, reading } = studio;
  const chosen = new Set(photos.map((p) => p.key));

  return (
    <div className="flex flex-col gap-4" data-testid="studio-photos">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 id={listId} className="text-[14px] font-bold">
            {a.photos}
          </h3>
          <span className="text-[12px] text-muted" aria-live="polite">
            {fmt(a.photosCount, { n: photos.length })}
          </span>
        </div>
        <ul aria-labelledby={listId} className="grid grid-cols-5 gap-2">
          {photos.map((p, i) => (
            <li key={p.key} className="relative">
              <img
                src={p.url}
                alt=""
                className={cn(
                  'aspect-square w-full rounded-[10px] border object-cover',
                  i === 0 ? 'border-ink ring-1 ring-ink' : 'border-line',
                )}
                style={{ objectPosition: `${p.info.focal.x * 100}% ${p.info.focal.y * 100}%` }}
              />
              {i === 0 ? (
                <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-ink/85 px-1.5 text-center text-[10.5px] font-semibold text-white">
                  {a.firstBadge}
                </span>
              ) : (
                <Hint text={a.makeFirstHint}>
                  <button
                    type="button"
                    onClick={() => studio.makeFirst(p.key)}
                    aria-label={fmt(a.makeFirst, { n: i + 1 })}
                    className="absolute bottom-1 start-1 grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow-sm hover:bg-white"
                  >
                    <Star aria-hidden className="size-3.5" />
                  </button>
                </Hint>
              )}
              <button
                type="button"
                onClick={() => studio.remove(p.key)}
                aria-label={fmt(a.remove, { n: i + 1 })}
                title={fmt(a.remove, { n: i + 1 })}
                className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-white/90 text-ink shadow-sm hover:bg-white"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
          {Array.from({ length: reading }, (_, i) => (
            <li
              key={`reading-${i}`}
              aria-hidden
              className="aspect-square animate-pulse rounded-[10px] bg-subtle motion-reduce:animate-none"
            />
          ))}
          {Array.from({ length: Math.max(0, ART_DIRECTION.minPhotos - photos.length - reading) }, (_, i) => (
            <li
              key={`empty-${i}`}
              aria-hidden
              className="grid aspect-square place-items-center rounded-[10px] border border-dashed border-line-strong text-faint"
            >
              <ImagePlus className="size-5" />
            </li>
          ))}
        </ul>
        {photos.length ? <p className="mt-2 text-[12px] text-muted">{a.first}</p> : null}
        {reading ? (
          <p role="status" className="mt-2 text-[12px] text-muted">
            {a.reading}
          </p>
        ) : null}
      </div>

      {own.length ? (
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">{a.fromInvitation}</legend>
          <p className="mb-2 text-[12px] text-muted">{a.fromInvitationHint}</p>
          <div className="grid grid-cols-5 gap-2">
            {own.map(({ ref, url }, i) => {
              const on = chosen.has(`ref-${ref}`);
              return (
                <button
                  key={ref}
                  type="button"
                  aria-pressed={on}
                  aria-label={fmt(on ? a.picked : a.pick, { n: i + 1 })}
                  onClick={() => void studio.toggleRef(ref, url)}
                  className={cn(
                    'relative overflow-hidden rounded-[10px] border outline-offset-2',
                    on ? 'border-ink ring-2 ring-ink' : 'border-line hover:opacity-90',
                  )}
                >
                  <img src={url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  {on ? (
                    <span className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div>
        <input
          ref={file}
          type="file"
          accept={IMAGE_TYPES}
          multiple
          hidden
          data-testid="studio-file"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            void studio.addFiles(files);
          }}
        />
        <Hint text={a.uploadHint}>
          <Button
            variant="secondary"
            icon={<Upload />}
            onClick={() => file.current?.click()}
            disabled={studio.room <= 0}
          >
            {a.upload}
          </Button>
        </Hint>
      </div>

      <Field label={a.mood} help={a.moodHelp} id={moodId}>
        <Input
          value={studio.mood}
          onChange={(e) => studio.setMood(e.target.value)}
          maxLength={ART_DIRECTION.moodMax}
          placeholder={a.moodPlaceholder}
          data-testid="studio-mood"
        />
      </Field>
    </div>
  );
}
