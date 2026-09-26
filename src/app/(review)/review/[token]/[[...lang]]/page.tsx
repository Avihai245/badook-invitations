import type { Metadata } from 'next';
import { assetBasesFromEnv } from '@/features/invitations/renderer/assets';
import { pageTitle } from '@/features/invitations/renderer/calendar-event';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { getTemplate } from '@/features/invitations/templates/registry';
import { goneLocale, loadReview, reviewLocale } from '@/features/review/server/page';
import { ReviewGone } from '@/features/review/ui/ReviewGone';
import { ReviewScreen } from '@/features/review/ui/ReviewScreen';
import { serverEnv } from '@/lib/env';
import { fill } from '@/lib/i18n/guest';
import { reviewGuestEn } from '@/lib/i18n/review-guest.en';
import { reviewGuestHe } from '@/lib/i18n/review-guest.he';

type Params = Promise<{ token: string; lang?: string[] }>;

export const dynamic = 'force-dynamic';

const ROBOTS = { index: false, follow: false, noarchive: true, nocache: true } satisfies Metadata['robots'];

function bases() {
  const env = serverEnv();
  return assetBasesFromEnv({
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    templateMediaBaseUrl: env.NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL,
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token, lang } = await params;
  const opened = await loadReview(token);
  const entry = opened?.status === 'ok' ? getTemplate(opened.state.templateId) : undefined;
  if (opened?.status !== 'ok' || !entry) {
    const t = goneLocale(lang) === 'en' ? reviewGuestEn : reviewGuestHe;
    return { title: t.metaTitlePlain, robots: ROBOTS };
  }
  const locale = reviewLocale(opened.state.draft, lang);
  const t = locale === 'en' ? reviewGuestEn : reviewGuestHe;
  const env = serverEnv();
  const name = pageTitle(
    buildRenderContext(opened.state.draft, entry.manifest, locale, {
      mode: 'live',
      review: true,
      brand: env.INVITES_BRAND_NAME,
      publicBaseUrl: env.INVITES_PUBLIC_BASE_URL,
      bases: bases(),
    }),
  );
  return { title: name ? fill(t.metaTitle, { name }) : t.metaTitlePlain, robots: ROBOTS };
}

/**
 * /review/<token>[/<lang>] — the host's draft for the family to comment on (ReviewScreen): no
 * account, nothing counted; the link can expire, be replaced or be revoked (then this says so).
 */
export default async function ReviewPage({ params }: { params: Params }) {
  const { token, lang } = await params;
  const opened = await loadReview(token);
  if (!opened) return <ReviewGone state="unavailable" locale={goneLocale(lang)} />;
  if (opened.status === 'rate') return <ReviewGone state="rate" locale={goneLocale(lang)} />;
  if (opened.status === 'gone') return <ReviewGone state={opened.state} locale={goneLocale(lang)} />;
  if (!getTemplate(opened.state.templateId))
    return <ReviewGone state="unavailable" locale={goneLocale(lang)} />;
  const env = serverEnv();
  return (
    <ReviewScreen
      token={token}
      initial={opened.state}
      lang={reviewLocale(opened.state.draft, lang)}
      brand={env.INVITES_BRAND_NAME}
      bases={bases()}
      publicBaseUrl={env.INVITES_PUBLIC_BASE_URL}
    />
  );
}
