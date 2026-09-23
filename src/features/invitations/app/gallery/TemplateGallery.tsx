'use client';

import { useMemo, useRef, useState } from 'react';
import { cn, PaletteDots, Segmented } from '@/components/app';
import type { UiLocale } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { EventType, Locale } from '../../contracts/types';
import type { AssetBases } from '../../renderer/assets';
import { templateFileUrl } from '../../renderer/assets';
import { TEMPLATES } from '../../templates/registry';
import { posterColors } from '../poster';
import { TemplatePoster } from '../TemplatePoster';
import { CreateWizard, type WizardSeed } from './CreateWizard';
import { PreviewDialog } from './PreviewDialog';

type Filter = 'all' | 'wedding' | 'barbat' | 'brit' | 'birthday' | 'baby_shower' | 'save_the_date';

const FILTERS: Record<Filter, readonly EventType[]> = {
  all: [],
  wedding: ['wedding'],
  barbat: ['bar_mitzvah', 'bat_mitzvah'],
  brit: ['brit'],
  birthday: ['birthday'],
  baby_shower: ['baby_shower'],
  save_the_date: ['save_the_date'],
};

/**
 * Template gallery (§7.1, §9B.3-B): filter chips by event type, 9:16 posters (the preview video plays
 * on hover when it exists), a preview dialog with a live phone, then the 3-step wizard.
 */
export function TemplateGallery({ bases, fontCss }: { bases: AssetBases; fontCss: string }) {
  const { t, locale } = useUi();
  const [filter, setFilter] = useState<Filter>('all');
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale);
  const [preview, setPreview] = useState<string | null>(null);
  const [wizard, setWizard] = useState<WizardSeed | null>(null);

  const templates = useMemo(
    () =>
      [...TEMPLATES.values()].map(({ manifest }) => ({
        manifest,
        colors: posterColors(manifest),
        image: templateFileUrl(manifest.id, manifest.previewImage, bases),
        video: templateFileUrl(manifest.id, manifest.previewVideo, bases),
        sample: manifest.cover.overlay.kind === 'ticket_text' ? '30' : locale === 'he' ? 'נ&א' : 'N&I',
      })),
    [bases, locale],
  );
  const visible = templates.filter(
    ({ manifest }) => filter === 'all' || manifest.categories.some((c) => FILTERS[filter].includes(c)),
  );
  const chipLabel = (f: Filter) =>
    f === 'all'
      ? t.gallery.all
      : f === 'barbat'
        ? t.gallery.barBat
        : t.eventTypes[f as Exclude<Filter, 'all' | 'barbat'>];

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-16">
      <style dangerouslySetInnerHTML={{ __html: fontCss }} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">{t.gallery.title}</h1>
          <p className="mt-1 text-muted">{t.gallery.subtitle}</p>
        </div>
        <Segmented<Locale>
          label={t.gallery.previewLanguage}
          value={previewLocale}
          onValueChange={setPreviewLocale}
          options={[
            { value: 'he', label: t.common.hebrew },
            { value: 'en', label: t.common.english },
          ]}
        />
      </div>
      <div role="group" aria-label={t.gallery.filterLabel} className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-[34px] rounded-full border px-3.5 text-[13px] font-medium transition-colors',
              filter === f ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-subtle',
            )}
          >
            {chipLabel(f)}
          </button>
        ))}
      </div>
      {visible.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(({ manifest, colors, image, video, sample }) => (
            <li key={manifest.id}>
              <GalleryCard
                name={manifest.name[locale as UiLocale] ?? manifest.name.en ?? manifest.id}
                categories={manifest.categories.map((c) => t.eventTypes[c]).join(' · ')}
                palette={manifest.tokens.palette}
                colors={colors}
                image={image}
                video={video}
                sample={sample}
                onOpen={() => setPreview(manifest.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-center text-muted">{t.gallery.noResults}</p>
      )}
      {preview ? (
        <PreviewDialog
          templateId={preview}
          locale={previewLocale}
          onLocaleChange={setPreviewLocale}
          onClose={() => setPreview(null)}
          onUse={(choice) => {
            setPreview(null);
            setWizard({
              templateId: preview,
              ...choice,
              eventType:
                FILTERS[filter].find((e) => TEMPLATES.get(preview)?.manifest.categories.includes(e)) ?? null,
            });
          }}
        />
      ) : null}
      {wizard ? <CreateWizard seed={wizard} onClose={() => setWizard(null)} /> : null}
    </div>
  );
}

function GalleryCard({
  name,
  categories,
  palette,
  colors,
  image,
  video,
  sample,
  onOpen,
}: {
  name: string;
  categories: string;
  palette: { bg: string; accent: string; ink: string };
  colors: ReturnType<typeof posterColors>;
  image: string | null;
  video: string | null;
  sample: string;
  onOpen: () => void;
}) {
  const { t, fmt } = useUi();
  const ref = useRef<HTMLVideoElement>(null);
  const play = (on: boolean) => {
    const v = ref.current;
    if (!v) return;
    if (on) v.play().catch(() => {});
    else v.pause();
  };
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => play(true)}
      onMouseLeave={() => play(false)}
      aria-label={fmt(t.gallery.playPreview, { name })}
      className="group block w-full text-start"
    >
      <TemplatePoster
        colors={colors}
        image={image}
        text={sample}
        play
        className="transition-[transform,box-shadow] duration-250 group-hover:-translate-y-1 group-hover:shadow-lg motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      >
        {video ? (
          <video
            ref={ref}
            src={video}
            muted
            playsInline
            loop
            preload="none"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
      </TemplatePoster>
      <div className="mt-2.5">
        <div className="flex items-center justify-between gap-2 text-[15px] font-bold">
          <span className="truncate">{name}</span>
          <PaletteDots palette={palette} />
        </div>
        <div className="mt-0.5 text-[12px] text-muted">{categories}</div>
      </div>
    </button>
  );
}
