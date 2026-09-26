import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { TOKEN_RE } from '@/features/live-gallery/server/tokens';
import { guestPage } from '@/features/live-gallery/server/pages';
import { GalleryUnavailable } from '@/features/live-gallery/ui/guest/GalleryUnavailable';
import { GuestGallery } from '@/features/live-gallery/ui/guest/GuestGallery';
import { isLocale } from '@/features/invitations/lib/locales';
import { fmt } from '@/features/live-gallery/format';
import { GALLERY_GUEST } from '@/lib/i18n/gallery-guest';

type Params = Promise<{ slug: string }>;
type Search = Promise<{ t?: string | string[]; g?: string | string[]; lang?: string | string[] }>;

export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const load = cache(async (token: string | undefined) =>
  token && TOKEN_RE.test(token) ? guestPage(token) : null,
);

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const q = await searchParams;
  const data = await load(one(q.t));
  const asked = one(q.lang);
  const lang = asked && isLocale(asked) ? asked : (data?.event.defaultLocale ?? 'he');
  const t = GALLERY_GUEST[lang];
  const name = data?.event.titles[lang] || data?.event.title || '';
  return {
    title: name ? fmt(t.metaTitle, { name }) : t.eyebrow,
    description: t.metaDescription,
    openGraph: { title: name ? fmt(t.metaTitle, { name }) : t.eyebrow, description: t.metaDescription },
    robots: { index: false, follow: false, noarchive: true },
  };
}

/**
 * /e/<slug>/upload?t=<token> — the live gallery's page for guests: upload photos and videos (no
 * sign-up) and see the event's feed. The token opens it; the slug only makes the link readable (an
 * old slug leads to the current one).
 */
export default async function GalleryUploadPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const token = one(q.t);
  const lang = one(q.lang);
  const data = await load(token);
  if (!data || !token) return <GalleryUnavailable locale={lang && isLocale(lang) ? lang : 'he'} />;
  if (data.slug !== slug) {
    const rest = new URLSearchParams({ t: token });
    for (const key of ['g', 'lang'] as const) {
      const v = one(q[key]);
      if (v) rest.set(key, v);
    }
    redirect(`/e/${data.slug}/upload?${rest}`);
  }
  const guest = one(q.g);
  return (
    <GuestGallery
      data={data}
      token={token}
      guest={guest && /^[A-Za-z0-9_-]{16,64}$/.test(guest) ? guest : null}
      lang={lang && isLocale(lang) ? lang : null}
    />
  );
}
