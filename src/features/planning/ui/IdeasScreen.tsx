'use client';

import { ListChecks, Pin, Plus, Search, StickyNote, Tag } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button, cn, EmptyState, Input, useMedia } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { PlanIdea } from '../model/plan';
import type { ConvertKind } from '../model/schemas-ideas';
import { Composer } from './ideas/Composer';
import { ConvertDialog } from './ideas/ConvertDialog';
import { IdeaAiDialog } from './ideas/IdeaAiDialog';
import { IdeaCard, type CardLink } from './ideas/IdeaCard';
import { IdeaEditor } from './ideas/IdeaEditor';
import { matchesIdea, tagCounts } from './ideas/model';
import { useIdeas } from './ideas/useIdeas';
import { PlanFrame, ToolHelp } from './PlanFrame';
import { usePlan } from './PlanProvider';

/**
 * Notes & ideas: a board of cards (a note, a link with its preview, a picture, a checklist), a one-line
 * composer, tags, colors, pinning and search, and every card can become a task, a vendor or a budget line
 * (the card keeps a link to it, and it to the card). Everything shows at once and is sent in the
 * background (see ideas/useIdeas.ts).
 * A card's menu also has the assistant's "summarize and suggest steps" (a Pro tool, a soft lock on the
 * free plan): a one-line summary and steps to tick that become tasks (ideas/IdeaAiDialog.tsx).
 */
export function IdeasScreen() {
  const { t, plural, number } = useUi();
  const T = t.planning.ideas;
  const plan = usePlan();
  const { view } = plan;
  const api = useIdeas();
  const desktop = useMedia('(min-width: 640px)');
  const composer = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ idea: PlanIdea | null; nonce: number; open: boolean } | null>(null);
  const [converting, setConverting] = useState<{ id: string; kind: ConvertKind } | null>(null);
  const [summarizing, setSummarizing] = useState<string | null>(null);

  const tags = useMemo(() => tagCounts(api.ideas), [api.ideas]);
  // a filter on a tag nothing has any more clears itself
  const activeTag = tag && tags.some((x) => x.tag === tag) ? tag : null;
  const shown = useMemo(
    () => api.ideas.filter((i) => matchesIdea(i, query, activeTag)),
    [api.ideas, query, activeTag],
  );
  const pinned = shown.filter((i) => i.pinned);
  const others = shown.filter((i) => !i.pinned);
  const filtering = !!query.trim() || !!activeTag;
  const base = `/app/invitations/${plan.id}/plan`;
  const canMakeItem = view.categories.length > 0;

  const openEditor = (idea: PlanIdea | null) =>
    setEditor((e) => ({ idea, nonce: (e?.nonce ?? 0) + 1, open: true }));
  // the header's action: the composer on a desktop, the full editor on a phone
  const startNew = () => {
    if (desktop && composer.current) composer.current.focus();
    else openEditor(null);
  };

  const linksOf = (idea: PlanIdea): CardLink[] => {
    const links: CardLink[] = [];
    if (idea.linkedTaskId) {
      const id = idea.linkedTaskId;
      links.push({
        kind: 'task',
        id,
        name: view.tasks.find((x) => x.id === id)?.title ?? api.names[id],
        href: `${base}/tasks`,
      });
    }
    if (idea.linkedVendorId) {
      const id = idea.linkedVendorId;
      links.push({
        kind: 'vendor',
        id,
        name: view.vendors.find((x) => x.id === id)?.name ?? api.names[id],
        href: `${base}/vendors`,
      });
    }
    if (idea.linkedBudgetItemId) {
      const id = idea.linkedBudgetItemId;
      links.push({
        kind: 'item',
        id,
        name: view.items.find((x) => x.id === id)?.title ?? api.names[id],
        href: `${base}/budget`,
      });
    }
    return links;
  };

  const board = (items: PlanIdea[]) => (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
      {items.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          imageUrl={idea.imagePath ? api.imageUrls[idea.imagePath] : undefined}
          previewing={api.previewing.has(idea.id)}
          links={linksOf(idea)}
          canMakeItem={canMakeItem}
          onEdit={() => openEditor(idea)}
          onTick={(i) => api.tick(idea.id, i)}
          onPin={() => void api.save(idea.id, { pinned: !idea.pinned })}
          onColor={(color) => void api.save(idea.id, { color })}
          onDelete={() => void api.remove(idea)}
          onConvert={(kind) => setConverting({ id: idea.id, kind })}
          onSummarize={() => setSummarizing(idea.id)}
          onImageError={api.imageFailed}
        />
      ))}
    </div>
  );

  const H = T.help.items;
  const help = (
    <ToolHelp
      title={T.help.title}
      items={[
        { icon: <Plus />, label: H.add.label, text: H.add.text },
        { icon: <StickyNote />, label: H.cards.label, text: H.cards.text },
        { icon: <Tag />, label: H.tags.label, text: H.tags.text },
        { icon: <Pin />, label: H.pin.label, text: H.pin.text },
        { icon: <ListChecks />, label: H.convert.label, text: H.convert.text },
      ]}
    />
  );

  const convertIdea = converting ? api.ideas.find((i) => i.id === converting.id) : undefined;
  const summaryIdea = summarizing ? api.ideas.find((i) => i.id === summarizing) : undefined;

  return (
    <PlanFrame
      tool="ideas"
      title={T.title}
      description={T.subtitle}
      help={help}
      actions={
        <Button icon={<Plus />} onClick={startNew}>
          {T.new}
        </Button>
      }
    >
      <Composer api={api} inputRef={composer} onMore={() => openEditor(null)} />

      {api.ideas.length > 0 ? (
        <div className="flex flex-col gap-3">
          <Input
            type="search"
            icon={<Search />}
            aria-label={T.search.label}
            placeholder={T.search.placeholder}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            wrapperClassName="sm:max-w-sm"
          />
          {tags.length > 0 ? (
            <div
              role="group"
              aria-label={T.filter.label}
              className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
            >
              <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
                <li>
                  <TagChip active={!activeTag} onClick={() => setTag(null)}>
                    {T.filter.all}
                  </TagChip>
                </li>
                {tags.map(({ tag: name, count }) => (
                  <li key={name}>
                    <TagChip
                      active={activeTag === name}
                      onClick={() => setTag(activeTag === name ? null : name)}
                    >
                      {name}
                      <span className="text-[12px] font-medium text-muted">{number(count)}</span>
                    </TagChip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <p role="status" className="sr-only">
        {filtering ? plural(T.filter.results, shown.length, { n: number(shown.length) }) : ''}
      </p>

      {api.ideas.length === 0 ? (
        <EmptyState
          title={T.empty.title}
          description={T.empty.body}
          action={
            <Button variant="secondary" icon={<Plus />} onClick={startNew}>
              {T.empty.cta}
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          title={T.empty.filtered}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setTag(null);
              }}
            >
              {T.empty.clear}
            </Button>
          }
        />
      ) : pinned.length > 0 && others.length > 0 ? (
        <>
          <section aria-labelledby="ideas-pinned">
            <h2 id="ideas-pinned" className="mb-2 text-[13px] font-semibold text-muted">
              {T.groups.pinned}
            </h2>
            {board(pinned)}
          </section>
          <section aria-labelledby="ideas-others">
            <h2 id="ideas-others" className="mb-2 text-[13px] font-semibold text-muted">
              {T.groups.others}
            </h2>
            {board(others)}
          </section>
        </>
      ) : (
        board(shown)
      )}

      {editor ? (
        <IdeaEditor
          key={editor.nonce}
          open={editor.open}
          onOpenChange={(open) => setEditor((e) => (e ? { ...e, open } : e))}
          idea={editor.idea}
          api={api}
        />
      ) : null}
      {converting && convertIdea ? (
        <ConvertDialog
          key={`${converting.id}-${converting.kind}`}
          idea={convertIdea}
          kind={converting.kind}
          onClose={() => setConverting(null)}
          api={api}
        />
      ) : null}
      {summarizing && summaryIdea ? (
        <IdeaAiDialog key={summarizing} idea={summaryIdea} onClose={() => setSummarizing(null)} />
      ) : null}
    </PlanFrame>
  );
}

/** A tag filter: a chip that is on or off (the same look as the plan's tool navigation). */
function TagChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap ring-1 transition-colors motion-reduce:transition-none sm:h-9',
        active
          ? 'bg-brand-soft text-brand-deep ring-brand-line'
          : 'bg-surface text-ink/75 ring-line hover:bg-subtle hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
