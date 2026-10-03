'use client';

import { BookOpen, MessageCircleQuestion } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useUi } from '@/lib/i18n/client';
import { GUIDE_SCREEN_ARTICLE } from '@/features/guide/catalog';
import { navKeyOf } from '@/features/invitations/app/workspace/stages';
import { openHelp, openSupport } from './open';
import { currentInvitationId } from './pages';

/**
 * Under an area's button explanations: the guide's article for this screen (the help panel opens on it)
 * and "still not sure? ask the assistant".
 */
export function AskAssistant() {
  const { t } = useUi();
  const path = usePathname();
  const id = currentInvitationId(path);
  const key = id ? navKeyOf(path, id) : null;
  const article = key ? GUIDE_SCREEN_ARTICLE[key] : undefined;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12.5px] text-muted">{t.support.askTitle}</span>
      <span className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => openHelp({ article })}
          data-testid="area-help-guide"
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-[12.5px] font-semibold text-brand-deep transition-colors hover:bg-brand-soft"
        >
          <BookOpen aria-hidden className="size-4" />
          {t.helpCenter.readGuide}
        </button>
        <button
          type="button"
          onClick={() => openSupport()}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand-deep transition-colors hover:bg-brand hover:text-white"
        >
          <MessageCircleQuestion aria-hidden className="size-4" />
          {t.support.ask}
        </button>
      </span>
    </div>
  );
}
