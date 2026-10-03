'use client';

import { BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { openSupport } from '@/features/support/open';
import { GuideArticleView, GuideIndex, articleBySlug } from './GuideView';

/** /app/guide — the written guide as a page: its search, the stages' articles and the FAQ. */
export function GuidePage() {
  const { t } = useUi();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[980px] px-4 pt-6 pb-16 sm:px-6" data-testid="guide-page">
      <PageHeader
        size="section"
        title={
          <span className="inline-flex items-center gap-2">
            <BookOpen aria-hidden className="size-6 text-brand-deep" />
            {t.helpCenter.pageTitle}
          </span>
        }
        description={t.helpCenter.pageSubtitle}
      />
      <div className="mt-6">
        <GuideIndex onOpen={(slug) => router.push(`/app/guide/${slug}`)} onAsk={(q) => openSupport(q)} />
      </div>
    </div>
  );
}

/** /app/guide/<slug> — one article as a page. */
export function GuideArticlePage({ slug }: { slug: string }) {
  const router = useRouter();
  const article = articleBySlug(slug);
  if (!article) return null;
  return (
    <div className="mx-auto max-w-[760px] px-4 pt-6 pb-16 sm:px-6">
      <GuideArticleView
        article={article}
        onOpen={(next) => router.push(`/app/guide/${next}`)}
        onBack={() => router.push('/app/guide')}
      />
    </div>
  );
}
