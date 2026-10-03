import 'server-only';
import { intlLocale, type UiLocale } from '@/lib/i18n/app';
import type { InvitationSummary } from '../server/host-db';
import { TemplatePoster } from './TemplatePoster';

/**
 * An invitation's poster (its design with its names and date), drawn on the server and handed to the
 * screens as markup: the designs' scenery (renderer/scenes, every design's art) then never ships to
 * the browser for a thumbnail. `item.design` comes from server/design-summary.ts.
 */
export function ItemPoster({
  item,
  uiLocale,
  eyebrow = null,
  fallbackName = '',
  className,
}: {
  item: InvitationSummary;
  uiLocale: UiLocale;
  /** the line above the names (the list shows the event type) */
  eyebrow?: string | null;
  /** when the invitation has no names yet */
  fallbackName?: string;
  className?: string;
}) {
  const design = item.design;
  if (!design) return null;
  const loc = item.locales.includes(uiLocale) ? uiLocale : item.defaultLocale;
  const primary = item.hosts.primary[loc] ?? item.hosts.primary[item.defaultLocale] ?? '';
  const secondary = item.hosts.secondary?.[loc] ?? item.hosts.secondary?.[item.defaultLocale] ?? null;
  // as the screens' own date(): a bare day is noon UTC
  const date = item.date
    ? new Intl.DateTimeFormat(intlLocale(uiLocale), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${item.date}T12:00:00Z`))
    : null;
  return (
    <TemplatePoster
      template={design}
      locale={loc}
      text={{ eyebrow, primary: primary || fallbackName, secondary, date }}
      joiner={item.hosts.joiner?.[loc] || '&'}
      className={className}
    />
  );
}
