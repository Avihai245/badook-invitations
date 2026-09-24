'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/components/app';
import { FONT_LIBRARY } from '../../fonts/library';

/**
 * The font library after the template's own pairs ("More fonts"): each pair's name written in its
 * display faces — Hebrew and English.
 */
export function LibraryFontPairs({
  selected,
  onSelect,
  title,
  help,
  mode = 'radio',
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  title: string;
  help?: string;
  /** 'radio' inside a radiogroup (the editor), 'pressed' for toggle buttons (the gallery preview). */
  mode?: 'radio' | 'pressed';
}) {
  const heading = useId();
  return (
    <div role="group" aria-labelledby={heading} className="mt-3 flex flex-col gap-2">
      <div>
        <p id={heading} className="text-[13px] font-semibold">
          {title}
        </p>
        {help ? <p className="text-[12px] text-muted">{help}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {FONT_LIBRARY.map((pair) => {
          const on = selected === pair.id;
          return (
            <button
              key={pair.id}
              type="button"
              {...(mode === 'radio' ? { role: 'radio', 'aria-checked': on } : { 'aria-pressed': on })}
              onClick={() => onSelect(pair.id)}
              data-font-pair={pair.id}
              className={cn(
                'relative flex min-w-0 flex-col items-center gap-0.5 rounded-card border bg-surface px-2 py-2.5 text-center',
                on ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle',
              )}
            >
              <span
                lang="he"
                dir="rtl"
                className="max-w-full truncate text-[22px] leading-tight"
                style={{ fontFamily: `"${pair.display.hebrew}", serif` }}
              >
                {pair.name.he}
              </span>
              <span
                lang="en"
                dir="ltr"
                className="max-w-full truncate text-[19px] leading-tight"
                style={{ fontFamily: `"${pair.display.latin}", serif` }}
              >
                {pair.name.en}
              </span>
              {on ? <Check aria-hidden size={14} className="absolute end-1.5 top-1.5 text-ink" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
