'use client';

import type { NavKey } from '@/features/invitations/app/workspace/stages';
import { TourVideo } from '@/features/site/DemoVideo.client';
import { GuideArticleView, GuideIndex, articleBySlug } from './GuideView';

/**
 * The help panel's guide tab: an article, or the index with this screen's articles first (a slug that
 * isn't an article shows the index). Its own module so the panel, on every page, loads the guide's
 * words only when the tab is shown.
 */
export default function GuidePanel({
  article,
  screen,
  onOpen,
  onAsk,
}: {
  article: string | null;
  screen: NavKey | null;
  onOpen: (slug: string | null) => void;
  onAsk: (question: string) => void;
}) {
  const shown = articleBySlug(article);
  return shown ? (
    <GuideArticleView article={shown} onOpen={onOpen} onBack={() => onOpen(null)} full />
  ) : (
    <>
      {/* the full narrated tour, above the articles */}
      <TourVideo compact className="mb-4" />
      <GuideIndex compact screen={screen} onOpen={onOpen} onAsk={onAsk} />
    </>
  );
}
