import { Play } from 'lucide-react';
import { LazyTemplatePoster } from '@/features/invitations/app/LazyTemplatePoster';
import type { TemplateManifest } from '@/features/invitations/contracts/types';
import type { UiLocale } from '@/lib/i18n/app';
import { Reveal } from '../Reveal';

/**
 * One design of the home page's grid: its poster (filled in as it nears the screen), its name and the
 * events it is for — a link to its live demo, as guests would get it. The page renders the first ones
 * (home/designs.ts INITIAL_DESIGNS); the rest are rendered with this same component at build time
 * (scripts/build-poster-art.tsx) and added by DesignsMore, so they weigh nothing in the page.
 */
export function DesignCard({
  manifest,
  locale,
  index,
  labels,
}: {
  manifest: TemplateManifest;
  locale: UiLocale;
  /** its place in the grid: the entrance of a row's cards is staggered */
  index: number;
  labels: { sample: string; liveDemo: string; eventTypes: Record<string, string> };
}) {
  const name = manifest.name[locale] ?? manifest.name.en;
  return (
    <Reveal as="li" delay={(index % 4) * 90}>
      <a
        href={`/i/demo-${manifest.id}?lang=${locale}`}
        target="_blank"
        rel="noopener"
        aria-label={`${name} · ${labels.liveDemo}`}
        className="group relative block rounded-[var(--radius-poster)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        <span className="site-lift block rounded-[var(--radius-poster)]">
          <LazyTemplatePoster
            template={manifest}
            locale={locale}
            className="shadow-[0_18px_36px_-18px_rgba(60,35,15,0.45)]"
          />
        </span>
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12.5px] font-semibold text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 [&_svg]:size-3.5"
        >
          <Play fill="currentColor" />
          {labels.sample}
        </span>
      </a>
      <p className="mt-3 text-[15px] font-semibold">{name}</p>
      <p className="text-[13px] text-muted">
        {manifest.categories
          .filter((c) => c !== 'save_the_date')
          .map((c) => labels.eventTypes[c])
          .join(' · ')}
      </p>
    </Reveal>
  );
}
