'use client';

import { MessageCircleQuestion } from 'lucide-react';
import { useUi } from '@/lib/i18n/client';
import { openSupport } from './open';

/** Under an area's button explanations: "still not sure? ask the assistant". */
export function AskAssistant() {
  const { t } = useUi();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-muted">{t.support.askTitle}</span>
      <button
        type="button"
        onClick={() => openSupport()}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand-deep transition-colors hover:bg-brand hover:text-white"
      >
        <MessageCircleQuestion aria-hidden className="size-4" />
        {t.support.ask}
      </button>
    </div>
  );
}
