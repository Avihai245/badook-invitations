import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GUIDE_ARTICLES } from '@/features/guide/articles';
import { GuideArticlePage } from '@/features/guide/GuidePage';
import { getUi } from '@/lib/i18n/server';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ slug }, { t, locale }] = await Promise.all([params, getUi()]);
  const article = GUIDE_ARTICLES.find((a) => a.slug === slug);
  return { title: article ? `${article.title[locale]} · ${t.helpCenter.pageTitle}` : t.helpCenter.pageTitle };
}

/** /app/guide/<slug> — one article of the guide. */
export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  if (!GUIDE_ARTICLES.some((a) => a.slug === slug)) notFound();
  return <GuideArticlePage slug={slug} />;
}
