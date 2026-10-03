'use client';

import { Plus, SlidersHorizontal } from 'lucide-react';
import { useState, type Ref } from 'react';
import { Button, Input } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { MAX_BODY, parseComposer } from './model';
import type { IdeasApi } from './useIdeas';

/**
 * The one-line composer at the top of the board: a pasted link becomes a link card (and its preview is
 * asked for), anything else a note; Enter adds it. "More options" opens the full editor. The line empties
 * at once and gets its text back if the card was refused.
 */
export function Composer({
  api,
  inputRef,
  onMore,
}: {
  api: IdeasApi;
  inputRef: Ref<HTMLInputElement>;
  onMore(): void;
}) {
  const { t } = useUi();
  const T = t.planning.ideas.composer;
  const [text, setText] = useState('');

  const submit = async () => {
    const composed = parseComposer(text);
    if (!composed) return;
    const typed = text;
    setText('');
    const ok = await api.addComposed(composed);
    if (!ok) setText((now) => now || typed);
  };

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input
        ref={inputRef}
        aria-label={T.label}
        placeholder={T.placeholder}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={MAX_BODY}
        value={text}
        onChange={(e) => setText(e.target.value)}
        icon={<Plus />}
        wrapperClassName="min-w-0 flex-1"
        className="h-12!"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="lg" disabled={!text.trim()} className="max-sm:flex-1">
          {T.add}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          icon={<SlidersHorizontal />}
          onClick={onMore}
          aria-haspopup="dialog"
          className="max-sm:flex-1"
        >
          {T.more}
        </Button>
      </div>
    </form>
  );
}
