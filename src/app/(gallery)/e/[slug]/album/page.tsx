import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { albumPage } from '@/features/album/server/api';
import { albumDeps } from '@/features/album/server/deps';
import { AlbumUnavailable } from '@/features/album/ui/AlbumUnavailable';
import { AlbumView } from '@/features/album/ui/AlbumView';
import { isLocale } from '@/features/invitations/lib/locales';
import { TOKEN_RE } from '@/features/live-gallery/server/tokens';
import { fill } from '@/lib/i18n/guest';
import { ALBUM_GUEST } from '@/lib/i18n/album-guest';
import { serverEnv } from '@/lib/env';
import '@/features/album/ui/album.css';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ a?: string | string[]; lang?: string | string[] }>;

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const load = cache(async (token: string | undefined) =>
  token && TOKEN_RE.test(token) ? albumPage(token, albumDeps()) : null,
);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const data = await load(one(q.a));
  const asked = one(q.lang);
  const lang = asked && isLocale(asked) ? asked : (data?.event.defaultLocale ?? 'he');
  const t = ALBUM_GUEST[lang];
  const name =
    data?.title[lang] || data?.event.names[lang] || data?.event.names[data.event.defaultLocale] || '';
  const title = name ? fill(t.metaTitle, { name }) : t.eyebrow;
  // the link's preview: the invitation's own picture (stable, public — the photos' links expire)
  const image = data
    ? `${serverEnv().INVITES_PUBLIC_BASE_URL}/i/${data.slug ?? slug}/opengraph-image?lang=${lang}`
    : undefined;
  return {
    title,
    description: t.metaDescription,
    openGraph: { title, description: t.metaDescription, ...(image ? { images: [image] } : {}) },
    robots: { index: false, follow: false, noarchive: true },
  };
}

/**
 * /e/<slug>/album?a=<token> — the album (feature album): the morning after the event, the gallery's
 * photos and videos as one designed page in the invitation's colors and fonts, for everyone with the
 * link. The token opens it; the slug only makes the link readable (an old slug leads to the current
 * one).
 */
export default async function AlbumPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const token = one(q.a);
  const lang = one(q.lang);
  const locale = lang && isLocale(lang) ? lang : null;
  const data = await load(token);
  if (!data || !token) return <AlbumUnavailable locale={locale ?? 'he'} />;
  if (data.slug !== slug) {
    const rest = new URLSearchParams({ a: token });
    if (locale) rest.set('lang', locale);
    redirect(`/e/${data.slug}/album?${rest}`);
  }
  if (data.state === 'off') return <AlbumUnavailable locale={locale ?? data.event.defaultLocale} off />;
  const { fontCss, ...view } = data;
  return (
    <>
      {/* the design's fonts (the invitation's own) */}
      <style dangerouslySetInnerHTML={{ __html: fontCss ?? '' }} />
      <AlbumView data={view} token={token} lang={locale} />
    </>
  );
}
