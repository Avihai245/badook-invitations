'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import type { OgPreview, PlanIdea } from '../../model/plan';
import type { ConvertKind, IdeaPatchInput } from '../../model/schemas-ideas';
import { usePlan } from '../PlanProvider';
import { readApi, uploadIdeaImage } from './api';
import { byBoard, hasPreview, localIdea, newId, restorePatch, type Composed } from './model';

/** The fields of a card the board changes (the same names as the API's). */
export type IdeaFields = Partial<
  Pick<
    PlanIdea,
    | 'type'
    | 'title'
    | 'body'
    | 'url'
    | 'ogPreview'
    | 'imagePath'
    | 'color'
    | 'tags'
    | 'pinned'
    | 'items'
    | 'sort'
  >
>;

export interface ConvertData {
  title?: string;
  dueDate?: string | null;
  category?: string | null;
  notes?: string | null;
  name?: string;
  url?: string | null;
  categoryId?: string;
  estimate?: number | null;
}

interface Answer {
  idea?: PlanIdea;
  code?: string;
  created?: { taskId?: string; vendorId?: string; itemId?: string };
}

/**
 * Everything the ideas board does to the plan: each change shows at once (an optimistic patch of the
 * plan's view), is sent to the API, and is taken back with a message when it did not go through. Link
 * previews and pictures are read quietly (they are not changes, so the "all changes saved" line stays).
 */
export function useIdeas() {
  const plan = usePlan();
  const { t } = useUi();
  const T = t.planning.ideas;
  const { toast } = useToast();
  const view = plan.view;

  const latest = useRef(view.ideas);
  useEffect(() => {
    latest.current = view.ideas;
  });
  const find = useCallback((id: string) => latest.current.find((i) => i.id === id), []);

  const ideas = useMemo(() => [...view.ideas].sort(byBoard), [view.ideas]);
  const [previewing, setPreviewing] = useState<ReadonlySet<string>>(new Set());
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  /** names of what a card became, until the plan is read again */
  const [names, setNames] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const retried = useRef(new Set<string>());
  /** link cards whose page was read (or tried) in this visit */
  const tried = useRef(new Set<string>());

  const put = useCallback(
    (idea: PlanIdea) =>
      plan.patch((v) => ({ ...v, ideas: v.ideas.map((i) => (i.id === idea.id ? idea : i)) })),
    [plan],
  );
  const insert = useCallback(
    (idea: PlanIdea) =>
      plan.patch((v) => ({ ...v, ideas: [idea, ...v.ideas.filter((i) => i.id !== idea.id)] })),
    [plan],
  );
  const drop = useCallback(
    (id: string) => plan.patch((v) => ({ ...v, ideas: v.ideas.filter((i) => i.id !== id) })),
    [plan],
  );

  const failed = useCallback(
    (code: string | undefined, fallback: string) =>
      toast({
        variant: 'danger',
        title:
          code === 'too_many'
            ? T.toast.tooMany
            : code === 'too_large'
              ? T.toast.tooLarge
              : code === 'invalid_image'
                ? T.toast.imageInvalid
                : code === 'empty'
                  ? T.editor.empty
                  : fallback,
      }),
    [T, toast],
  );

  /** The newest change sent for each card (an older answer must not undo a newer change still on its way). */
  const sent = useRef(new Map<string, number>());

  /** Changes a card: now on the board, then on the server; taken back with a message if refused. */
  const save = useCallback(
    async (id: string, fields: IdeaFields): Promise<boolean> => {
      const before = find(id);
      if (!before) return false;
      const n = (sent.current.get(id) ?? 0) + 1;
      sent.current.set(id, n);
      put({ ...before, ...fields });
      const res = await plan.call<Answer>('/ideas', { op: 'save', idea: { id, ...fields } });
      const newest = sent.current.get(id) === n;
      if (!res.ok || !res.body?.idea) {
        const now = find(id);
        // (a newer change is still on its way: its answer settles the card)
        if (now && newest) put({ ...now, ...pick(before, fields) });
        failed(res.body?.code, T.toast.saveFailed);
        return false;
      }
      if (newest) put(res.body.idea);
      return true;
    },
    [T.toast.saveFailed, failed, find, plan, put],
  );

  /** Reads the page of a link card and keeps what it offers on the card. */
  const loadPreview = useCallback(
    async (id: string, url: string, started?: Promise<{ preview?: OgPreview; code?: string } | null>) => {
      tried.current.add(id);
      setPreviewing((s) => new Set(s).add(id));
      try {
        const answer =
          (await started) ??
          (await readApi<{ preview?: OgPreview; code?: string }>(plan.id, '/ideas/preview', { url }).then(
            (r) => (r.ok ? r.body : { code: r.body?.code ?? 'failed' }),
          ));
        const preview = answer?.preview;
        if (hasPreview(preview ?? null)) {
          // only if the card is still there with this address
          if (find(id)?.url === url) await save(id, { ogPreview: preview });
        } else toast({ title: answer?.code === 'rate_limited' ? T.preview.limit : T.preview.failed });
      } finally {
        setPreviewing((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [T.preview.failed, T.preview.limit, find, plan.id, save, toast],
  );

  /** Adds a card (at the top, at once). Answers the saved card, or null when it was refused. */
  const create = useCallback(
    async (fields: IdeaFields, id: string = newId()): Promise<PlanIdea | null> => {
      insert(localIdea(fields, id, latest.current, Date.now()));
      const res = await plan.call<Answer>('/ideas', { op: 'save', idea: { id, ...fields } });
      if (!res.ok || !res.body?.idea) {
        drop(id);
        failed(res.body?.code, T.toast.saveFailed);
        return null;
      }
      put(res.body.idea);
      return res.body.idea;
    },
    [T.toast.saveFailed, drop, failed, insert, plan, put],
  );

  /** A new card with its fields; a link card also asks for its page's preview. */
  const add = useCallback(
    async (fields: IdeaFields): Promise<boolean> => {
      const id = newId();
      const url = fields.type === 'link' && fields.url ? fields.url : null;
      // the preview is read while the card is saved
      const started = url
        ? readApi<{ preview?: OgPreview; code?: string }>(plan.id, '/ideas/preview', { url }).then((r) =>
            r.ok ? r.body : { code: r.body?.code ?? 'failed' },
          )
        : undefined;
      if (url) {
        tried.current.add(id);
        setPreviewing((s) => new Set(s).add(id));
      }
      const idea = await create(fields, id);
      if (url) {
        if (idea) await loadPreview(id, url, started);
        else
          setPreviewing((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          });
      }
      return !!idea;
    },
    [create, loadPreview, plan.id],
  );

  /** The one-line composer's text: a pasted link becomes a link card, anything else a note. */
  const addComposed = useCallback(
    (c: Composed) => add(c.type === 'link' ? { type: 'link', url: c.url } : { type: 'note', body: c.body }),
    [add],
  );

  /** Saves the editor's changes to a card, and reads the page again when its address changed. */
  const edit = useCallback(
    async (id: string, patch: IdeaPatchInput): Promise<boolean> => {
      const { id: _ignored, ...fields } = patch;
      if (Object.keys(fields).length === 0) return true;
      const ok = await save(id, fields as IdeaFields);
      const url = typeof fields.url === 'string' ? fields.url : null;
      if (ok && url) void loadPreview(id, url);
      return ok;
    },
    [loadPreview, save],
  );

  /** Deletes a card, with a toast that puts it back (the same id and fields). */
  const remove = useCallback(
    async (idea: PlanIdea) => {
      drop(idea.id);
      const res = await plan.call('/ideas', { op: 'delete', ids: [idea.id] });
      if (!res.ok) {
        insert(idea);
        toast({ variant: 'danger', title: T.toast.deleteFailed });
        return;
      }
      toast({
        title: T.toast.deleted,
        action: {
          label: t.planning.common.undo,
          altText: T.toast.undoAlt,
          onClick: () => {
            void (async () => {
              insert(idea);
              const back = await plan.call<Answer>('/ideas', { op: 'save', idea: restorePatch(idea) });
              if (!back.ok || !back.body?.idea) {
                drop(idea.id);
                toast({ variant: 'danger', title: T.toast.restoreFailed });
                return;
              }
              put(back.body.idea);
              toast({ title: T.toast.restored, variant: 'success' });
            })();
          },
        },
      });
    },
    [T.toast, drop, insert, plan, put, t.planning.common.undo, toast],
  );

  /** Ticks (or unticks) one line of a checklist card. */
  const tick = useCallback(
    (id: string, index: number) => {
      const idea = find(id);
      if (!idea?.items[index]) return;
      void save(id, { items: idea.items.map((l, i) => (i === index ? { ...l, done: !l.done } : l)) });
    },
    [find, save],
  );

  /** Makes a task, vendor or budget line from a card; the card keeps a link to it (and it to the card). */
  const convert = useCallback(
    async (idea: PlanIdea, kind: ConvertKind, data: ConvertData): Promise<boolean> => {
      const res = await plan.call<Answer>('/ideas', { op: 'convert', id: idea.id, kind, data });
      const answer = res.body;
      if (!res.ok || !answer?.idea) {
        const code = answer?.code;
        toast({
          variant: 'danger',
          title:
            code === 'too_many'
              ? T.convert.errors.too_many
              : code === 'invalid_link'
                ? T.convert.errors.invalid_link
                : T.convert.errors.failed,
        });
        return false;
      }
      put(answer.idea);
      const made = answer.created?.taskId ?? answer.created?.vendorId ?? answer.created?.itemId;
      const name = data.title ?? data.name;
      if (made && name) setNames((n) => ({ ...n, [made]: name }));
      // the new row is the server's to describe (its place in the list, the budget's totals)
      void plan.refresh();
      toast({ title: T.convert[kind].done, variant: 'success' });
      return true;
    },
    [T.convert, plan, put, toast],
  );

  // the signed addresses of the pictures on the board (a card shows its picture from the files route)
  useEffect(() => {
    const need = view.ideas.map((i) => i.imagePath).filter((p): p is string => !!p && !asked.current.has(p));
    if (need.length === 0) return;
    const paths = [...new Set(need)];
    for (const p of paths) asked.current.add(p);
    void (async () => {
      for (let i = 0; i < paths.length; i += 60) {
        const res = await readApi<{ urls?: Record<string, string> }>(plan.id, '/files', {
          op: 'read',
          paths: paths.slice(i, i + 60),
        });
        const urls = res.body?.urls;
        if (res.ok && urls) setImageUrls((u) => ({ ...u, ...urls }));
      }
    })();
  }, [view.ideas, plan.id]);

  // a link added a moment ago somewhere else (the quick-add) has no preview yet: read its page once
  useEffect(() => {
    const recent = Date.now() - 10 * 60 * 1000;
    for (const i of view.ideas)
      if (
        i.type === 'link' &&
        i.url &&
        !i.ogPreview &&
        !tried.current.has(i.id) &&
        Date.parse(i.createdAt) > recent
      ) {
        tried.current.add(i.id);
        void loadPreview(i.id, i.url);
      }
  }, [view.ideas, loadPreview]);

  /** A picture that did not load (its signed address ran out): asks for a new address, once. */
  const imageFailed = useCallback(
    (path: string) => {
      if (retried.current.has(path)) return;
      retried.current.add(path);
      void readApi<{ urls?: Record<string, string> }>(plan.id, '/files', { op: 'read', paths: [path] }).then(
        (res) => {
          const urls = res.body?.urls;
          if (res.ok && urls) setImageUrls((u) => ({ ...u, ...urls }));
        },
      );
    },
    [plan.id],
  );

  /** Uploads the editor's picture; it shows from the file itself until a signed address is read. */
  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      const { path, blob } = await uploadIdeaImage(plan.call, file);
      asked.current.add(path);
      setImageUrls((u) => ({ ...u, [path]: URL.createObjectURL(blob) }));
      return path;
    },
    [plan.call],
  );

  return {
    ideas,
    previewing,
    imageUrls,
    names,
    save,
    add,
    addComposed,
    edit,
    remove,
    tick,
    convert,
    imageFailed,
    uploadImage,
  };
}

export type IdeasApi = ReturnType<typeof useIdeas>;

/** The previous values of the fields a change touched (to take it back). */
function pick(idea: PlanIdea, fields: IdeaFields): IdeaFields {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) out[key] = idea[key as keyof PlanIdea];
  return out as IdeaFields;
}
