'use client';
/* eslint-disable @next/next/no-img-element -- the picture is the host's own, from a short-lived signed URL of private storage (or the file just picked): nothing for the image optimizer to cache */

import { ImageIcon, ImagePlus, Link2, ListChecks, Plus, StickyNote, X } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import {
  Button,
  Checkbox,
  Drawer,
  Field,
  IconButton,
  Input,
  Segmented,
  Textarea,
  cn,
} from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { IDEA_COLORS, IDEA_TYPES, type IdeaColor, type IdeaType } from '../../model/categories';
import type { PlanIdea } from '../../model/plan';
import { ImageError } from './api';
import { ColorDot } from './IdeaCard';
import {
  addTags,
  draftHasContent,
  draftOf,
  draftPatch,
  emptyDraft,
  normalizeUrl,
  MAX_BODY,
  MAX_LINE,
  MAX_LINES,
  MAX_TAGS,
  MAX_TITLE,
  type IdeaDraft,
} from './model';
import type { IdeasApi } from './useIdeas';

const TYPE_ICON = { note: StickyNote, link: Link2, image: ImageIcon, list: ListChecks } as const;

/**
 * The card's full editor, in a side drawer: for a new card ("more options" of the composer, and the
 * header's button on a phone) and for an existing one. It stays open until the server has the card, so
 * what was typed is not lost when a save is refused. Mounted fresh for each card (see `key` in the screen).
 */
export function IdeaEditor({
  open,
  onOpenChange,
  idea,
  api,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** the card to edit; null for a new one */
  idea: PlanIdea | null;
  api: IdeasApi;
}) {
  const { t, fmt } = useUi();
  const T = t.planning.ideas;
  const E = T.editor;
  const [draft, setDraft] = useState<IdeaDraft>(() => (idea ? draftOf(idea) : emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [imageProblem, setImageProblem] = useState<string | null>(null);
  const [tagText, setTagText] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const lines = useRef<(HTMLInputElement | null)[]>([]);

  const set = <K extends keyof IdeaDraft>(key: K, value: IdeaDraft[K]) => {
    setProblem(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const urlBad = draft.type === 'link' && !!draft.url.trim() && !normalizeUrl(draft.url);

  const submit = async () => {
    if (urlBad) return;
    if (!draftHasContent(draft)) return setProblem(E.empty);
    setSaving(true);
    const patch = draftPatch(draft, idea ?? undefined);
    const ok = idea ? await api.edit(idea.id, patch) : await api.add(patch);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const pickImage = async (picked: File | undefined) => {
    if (!picked) return;
    setImageProblem(null);
    setUploading(true);
    try {
      const path = await api.uploadImage(picked);
      set('imagePath', path);
    } catch (err) {
      setImageProblem(E.imageErrors[err instanceof ImageError ? err.code : 'failed']);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };

  const commitTags = (typed: string) => {
    if (!typed.trim()) return;
    set('tags', addTags(draft.tags, typed));
    setTagText('');
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
      e.preventDefault();
      commitTags(tagText);
    } else if (e.key === 'Backspace' && !tagText && draft.tags.length) set('tags', draft.tags.slice(0, -1));
  };

  const setLine = (i: number, text: string) =>
    set(
      'items',
      draft.items.map((l, j) => (j === i ? { ...l, text } : l)),
    );
  const addLine = (after: number) => {
    if (draft.items.length >= MAX_LINES) return;
    const next = [...draft.items];
    next.splice(after + 1, 0, { text: '', done: false });
    set('items', next);
    requestAnimationFrame(() => lines.current[after + 1]?.focus());
  };

  const imageUrl = draft.imagePath ? api.imageUrls[draft.imagePath] : undefined;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={idea ? E.editTitle : E.newTitle}
      closeLabel={E.close}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.planning.common.cancel}
          </Button>
          <Button type="submit" form="idea-editor" loading={saving} disabled={uploading}>
            {idea ? E.save : E.create}
          </Button>
        </>
      }
    >
      <form
        id="idea-editor"
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Segmented<IdeaType>
          label={T.types.label}
          fullWidth
          value={draft.type}
          onValueChange={(type) => {
            setProblem(null);
            setDraft((d) => ({
              ...d,
              type,
              items: type === 'list' && d.items.length === 0 ? [{ text: '', done: false }] : d.items,
            }));
          }}
          options={IDEA_TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            return { value: type, label: T.types[type], icon: <Icon /> };
          })}
        />

        <Field label={E.title}>
          <Input
            value={draft.title}
            maxLength={MAX_TITLE}
            placeholder={E.titlePlaceholder[draft.type]}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        {draft.type === 'link' ? (
          <Field label={E.url} help={E.urlHint} error={urlBad ? E.urlInvalid : undefined}>
            <Input
              dir="ltr"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder={E.urlPlaceholder}
              value={draft.url}
              onChange={(e) => set('url', e.target.value)}
            />
          </Field>
        ) : null}

        {draft.type === 'image' ? (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">{E.image}</p>
            {draft.imagePath ? (
              <div className="mb-2 overflow-hidden rounded-input border border-line bg-subtle">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={draft.title || T.card.imageAlt}
                    className="max-h-56 w-full object-cover"
                  />
                ) : (
                  <div className="h-24" />
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={file}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => void pickImage(e.target.files?.[0])}
              />
              <Button
                variant="secondary"
                icon={<ImagePlus />}
                loading={uploading}
                onClick={() => file.current?.click()}
              >
                {uploading ? E.uploading : draft.imagePath ? E.replace : E.pick}
              </Button>
              {draft.imagePath && !uploading ? (
                <Button variant="ghost" onClick={() => set('imagePath', null)}>
                  {E.remove}
                </Button>
              ) : null}
            </div>
            <p
              className={cn('mt-1.5 text-[12px]', imageProblem ? 'text-danger' : 'text-muted')}
              role={imageProblem ? 'alert' : undefined}
            >
              {imageProblem ?? E.imageHint}
            </p>
          </div>
        ) : null}

        {draft.type === 'list' ? (
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-[13px] font-semibold">{E.lines}</legend>
            <ul className="flex flex-col gap-2">
              {draft.items.map((line, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <Input
                    ref={(el) => {
                      lines.current[i] = el;
                    }}
                    aria-label={fmt(E.lineLabel, { n: i + 1 })}
                    value={line.text}
                    maxLength={MAX_LINE}
                    placeholder={E.linePlaceholder}
                    onChange={(e) => setLine(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLine(i);
                      }
                    }}
                  />
                  <IconButton
                    label={fmt(E.removeLine, { n: i + 1 })}
                    onClick={() =>
                      set(
                        'items',
                        draft.items.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X />
                  </IconButton>
                </li>
              ))}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus />}
              className="mt-2"
              disabled={draft.items.length >= MAX_LINES}
              onClick={() => addLine(draft.items.length - 1)}
            >
              {E.addLine}
            </Button>
          </fieldset>
        ) : null}

        {draft.type !== 'list' ? (
          <Field label={draft.type === 'note' ? E.note : E.comment}>
            <Textarea
              rows={draft.type === 'note' ? 6 : 3}
              maxLength={MAX_BODY}
              placeholder={draft.type === 'note' ? E.notePlaceholder : E.commentPlaceholder}
              value={draft.body}
              onChange={(e) => set('body', e.target.value)}
            />
          </Field>
        ) : null}

        <div>
          <label htmlFor="idea-tag" className="mb-1.5 block text-[13px] font-semibold">
            {E.tags}
          </label>
          {draft.tags.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {draft.tags.map((tag) => (
                <li
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-subtle ps-3 pe-1 text-[13px]"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={fmt(E.removeTag, { tag })}
                    onClick={() =>
                      set(
                        'tags',
                        draft.tags.filter((x) => x !== tag),
                      )
                    }
                    className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            id="idea-tag"
            value={tagText}
            disabled={draft.tags.length >= MAX_TAGS}
            placeholder={E.tagsPlaceholder}
            onChange={(e) => setTagText(e.target.value)}
            onKeyDown={onTagKey}
            onBlur={() => commitTags(tagText)}
          />
          {draft.tags.length >= MAX_TAGS ? (
            <p className="mt-1.5 text-[12px] text-muted">{E.tagsMax}</p>
          ) : null}
        </div>

        <Field label={E.color}>
          <Segmented<IdeaColor>
            fullWidth
            value={draft.color}
            onValueChange={(color) => set('color', color)}
            options={IDEA_COLORS.map((c) => ({
              value: c,
              label: T.card.colors[c],
              icon: <ColorDot color={c} />,
            }))}
          />
        </Field>

        <Checkbox checked={draft.pinned} onCheckedChange={(v) => set('pinned', v)} label={E.pinned} />

        {problem ? (
          <p role="alert" className="text-[13px] text-danger">
            {problem}
          </p>
        ) : null}
      </form>
    </Drawer>
  );
}
