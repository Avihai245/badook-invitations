'use client';

import { Crown, LayoutGrid } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { cn, PageHeader, PaletteDots, Segmented } from '@/components/app';
import type { UiLocale } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import { EVENT_TYPES, type EventType, type Locale, type TemplateManifest } from '../../contracts/types';
import type { AssetBases } from '../../renderer/assets';
import { templateFileUrl } from '../../renderer/assets';
import { TEMPLATES } from '../../templates/registry';
import { posterImage, posterSample, type PosterText } from '../poster';
import { TemplatePoster, type PosterTemplate } from '../TemplatePoster';
import { CreateWizard, type WizardSeed } from './CreateWizard';
import { PreviewDialog } from './PreviewDialog';
import { usePreviewVideos } from './preview-videos';
import { EVENT_ICONS } from '../event-icons';
import { HelpFor } from '../HelpFor';

type Filter = EventType | 'all';

/**
 * The gallery's event-type chips: every type at least one design is made for, in the contract's
 * order (EVENT_TYPES), with how many designs each has. A design shows under each of its types.
 */
export function eventTypeFilters(
  manifests: readonly Pick<TemplateManifest, 'categories'>[],
): { type: EventType; count: number }[] {
  return EVENT_TYPES.map((type) => ({
    type,
    count: manifests.filter((m) => m.categories.includes(type)).length,
  })).filter((f) => f.count > 0);
}

/** The designs a chip shows. */
export const matchesFilter = (manifest: Pick<TemplateManifest, 'categories'>, filter: Filter) =>
  filter === 'all' || manifest.categories.includes(filter);

/** Dev/QA: the same fixture files on every card instead of the templates' own previews. */
export interface DevPreviews {
  image: string | null;
  video: string;
}

/**
 * Template gallery (§7.1, §9B.3-B): filter chips by event type, 9:16 posters (the preview video plays
 * muted on hover, or on touch screens when the card is in view), a preview dialog with a live phone,
 * then the 3-step wizard.
 */
export function TemplateGallery({
  bases,
  fontCss,
  devPreviews = null,
  admin = false,
}: {
  bases: AssetBases;
  fontCss: string;
  devPreviews?: DevPreviews | null;
  /** the platform's admins also see the unlisted designs (manifest `listed: false`), marked */
  admin?: boolean;
}) {
  const { t, locale, plural, number } = useUi();
  const videos = usePreviewVideos();
  const [filter, setFilter] = useState<Filter>('all');
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale);
  const [preview, setPreview] = useState<string | null>(null);
  const [wizard, setWizard] = useState<WizardSeed | null>(null);

  const templates = useMemo(
    () =>
      [...TEMPLATES.values()]
        .filter(({ manifest }) => manifest.listed || admin)
        .map(({ manifest }) => ({
          manifest,
          image: devPreviews ? devPreviews.image : posterImage(manifest, bases),
          video: devPreviews ? devPreviews.video : templateFileUrl(manifest.id, manifest.previewVideo, bases),
          // the poster speaks the preview language (the switch above the gallery)
          sample: posterSample(manifest.id, previewLocale),
        })),
    [bases, previewLocale, devPreviews, admin],
  );
  const visible = templates.filter(({ manifest }) => matchesFilter(manifest, filter));
  const chips = useMemo(
    () => [
      { type: 'all' as const, count: templates.length },
      ...eventTypeFilters(templates.map((x) => x.manifest)),
    ],
    [templates],
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      <style dangerouslySetInnerHTML={{ __html: fontCss }} />
      <PageHeader
        title={t.gallery.title}
        help={<HelpFor area="gallery" />}
        description={t.gallery.subtitle}
        actions={
          <Segmented<Locale>
            label={t.gallery.previewLanguage}
            value={previewLocale}
            onValueChange={setPreviewLocale}
            options={[
              { value: 'he', label: t.common.hebrew },
              { value: 'en', label: t.common.english },
            ]}
          />
        }
      />
      {/* phones: one row that scrolls sideways; wider screens: the chips wrap */}
      <div
        role="group"
        aria-label={t.gallery.filterLabel}
        className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {chips.map(({ type, count }) => {
          const Icon = type === 'all' ? LayoutGrid : EVENT_ICONS[type];
          const on = filter === type;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              data-filter={type}
              onClick={() => setFilter(type)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border ps-3 pe-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none',
                on
                  ? 'border-ink bg-ink text-white shadow-sm'
                  : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle',
              )}
            >
              <Icon aria-hidden className={cn('size-4 shrink-0', on ? 'text-white/85' : 'text-brand')} />
              {type === 'all' ? t.gallery.all : t.eventTypes[type]}
              <span
                aria-hidden
                className={cn(
                  'min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums',
                  on ? 'bg-white/20 text-white' : 'bg-subtle text-muted',
                )}
              >
                {number(count)}
              </span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {plural(t.gallery.results, visible.length, { n: number(visible.length) })}
      </p>
      {visible.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(({ manifest, image, video, sample }) => (
            <li key={manifest.id}>
              <GalleryCard
                name={manifest.name[locale as UiLocale] ?? manifest.name.en ?? manifest.id}
                premium={manifest.tier === 'premium'}
                unlisted={!manifest.listed}
                categories={manifest.categories.map((c) => t.eventTypes[c]).join(' · ')}
                palette={manifest.tokens.palette}
                template={manifest}
                locale={previewLocale}
                image={image}
                video={video}
                sample={sample}
                videos={videos}
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
              // the type the gallery was filtered by, when this design is made for it
              eventType:
                filter !== 'all' && TEMPLATES.get(preview)?.manifest.categories.includes(filter)
                  ? filter
                  : null,
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
  premium,
  unlisted = false,
  categories,
  palette,
  template,
  locale,
  image,
  video,
  sample,
  videos,
  onOpen,
}: {
  name: string;
  premium: boolean;
  unlisted?: boolean;
  categories: string;
  palette: { bg: string; accent: string; ink: string };
  template: PosterTemplate;
  locale: Locale;
  image: string | null;
  video: string | null;
  sample: PosterText;
  videos: ReturnType<typeof usePreviewVideos>;
  onOpen: () => void;
}) {
  const { t, fmt } = useUi();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // a preview that can't load (not produced yet, offline) leaves the poster
  const [failed, setFailed] = useState(false);
  const { register } = videos;
  // a stable ref callback: a new one each render would unregister and register the video every time
  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      ref.current = el;
      return register(el);
    },
    [register],
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => videos.hover(ref.current, true)}
      onMouseLeave={() => videos.hover(ref.current, false)}
      aria-label={fmt(t.gallery.playPreview, { name }) + (premium ? ` (${t.gallery.premium})` : '')}
      className="group block w-full text-start"
    >
      <TemplatePoster
        template={template}
        locale={locale}
        text={sample}
        image={image}
        play={!playing}
        badge={
          premium || unlisted ? (
            <span className="flex flex-wrap gap-[1.5cqw]">
              {premium ? <PremiumBadge label={t.gallery.premium} /> : null}
              {unlisted ? (
                <span className="inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {t.gallery.unlisted}
                </span>
              ) : null}
            </span>
          ) : null
        }
        className="transition-[transform,box-shadow] duration-250 group-hover:-translate-y-1 group-hover:shadow-lg motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      >
        {video && !failed ? (
          <video
            ref={attach}
            src={video}
            muted
            playsInline
            loop
            preload="none"
            aria-hidden
            data-playing={playing ? '' : undefined}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              setPlaying(false);
              setFailed(true);
            }}
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none',
              playing ? 'opacity-100' : 'opacity-0',
            )}
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

/** Premium designs wear a small tag on their poster. */
function PremiumBadge({ label }: { label: string }) {
  return (
    <span
      data-premium=""
      className="inline-flex h-[22px] items-center gap-1 rounded-full bg-black/60 px-2 text-[11px] font-semibold text-white shadow-sm backdrop-blur-[2px]"
    >
      <Crown aria-hidden size={12} className="text-[#F3D98B]" />
      {label}
    </span>
  );
}
