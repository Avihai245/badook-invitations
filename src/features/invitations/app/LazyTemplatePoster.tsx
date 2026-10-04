import type { UiLocale } from '@/lib/i18n/app';
import { posterSample } from './poster';
import { lazyPosterUrl } from './poster-art';
import { PosterBox, TemplatePoster, type PosterTemplate } from './TemplatePoster';

/**
 * A template's sample poster (what TemplatePoster draws with posterSample) whose contents come later:
 * the page carries its frame — the sky, the size, so nothing moves — and the address of the
 * pre-rendered rest (app/poster-art.ts), which PosterArtLoader (once on the page) fills in as it nears
 * the screen. For pages of many posters. Without a pre-rendered build (no version): drawn in the page.
 */
export function LazyTemplatePoster({
  template,
  locale,
  frameless = false,
  className,
}: {
  template: PosterTemplate;
  locale: UiLocale;
  frameless?: boolean;
  className?: string;
}) {
  const src = lazyPosterUrl(template.id, locale);
  if (!src)
    return (
      <TemplatePoster
        template={template}
        locale={locale}
        text={posterSample(template.id, locale)}
        frameless={frameless}
        className={className}
      />
    );
  const pair = template.fontPairs[0];
  const script = locale === 'he' ? 'hebrew' : 'latin';
  return (
    <PosterBox
      template={template}
      locale={locale}
      frameless={frameless}
      className={className}
      data-poster={src}
      data-poster-fonts={
        pair ? [...new Set([pair.display[script], pair.heading[script]])].join(',') : undefined
      }
    />
  );
}
