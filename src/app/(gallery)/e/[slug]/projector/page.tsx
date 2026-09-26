import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { TOKEN_RE } from '@/features/live-gallery/server/tokens';
import { projectorPage } from '@/features/live-gallery/server/pages';
import { GalleryUnavailable } from '@/features/live-gallery/ui/guest/GalleryUnavailable';
import { fmt } from '@/features/live-gallery/format';
import { Projector } from '@/features/live-gallery/ui/projector/Projector';
import { galleryGuestEn } from '@/lib/i18n/gallery-guest.en';
import { galleryGuestHe } from '@/lib/i18n/gallery-guest.he';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ t?: string | string[] }>;

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const load = cache(async (token: string | undefined) =>
  token && TOKEN_RE.test(token) ? projectorPage(token) : null,
);

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const data = await load(one((await searchParams).t));
  const t = data?.event.defaultLocale === 'en' ? galleryGuestEn : galleryGuestHe;
  return {
    title: data ? fmt(t.projector.title, { name: data.event.title }) : t.eyebrow,
    robots: { index: false, follow: false, noarchive: true },
  };
}

/**
 * /e/<slug>/projector?t=<projector token> — the live gallery on the venue's screen (feature
 * projector): full screen, no controls, only published photos, new ones arriving within seconds.
 */
export default async function GalleryProjectorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const token = one(q.t);
  const data = await load(token);
  if (!data || !token) return <GalleryUnavailable locale="he" projector />;
  if (data.slug !== slug) redirect(`/e/${data.slug}/projector?t=${token}`);
  return <Projector data={data} token={token} />;
}
