'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '@/components/app';
import { fmt } from '@/lib/i18n/app';
import { useUi } from '@/lib/i18n/client';
import type { L10n, Locale } from '../contracts/types';
import { hostApi, loginUrl } from '../app/api';
import {
  docPathOf,
  pendingReview,
  stablePath,
  translationState,
  type TranslationRow,
} from '../translate/fields';
import { getAt, setAt } from './paths';
import { useEditor } from './state/EditorProvider';
import { TranslationReview } from './TranslationReview';

/**
 * The invitation's translations in the editor (translate/): the machine translation into a language
 * (its texts go into the draft as one undo step), the host's approvals, the glossary — and the review
 * window, opened from the languages panel, a field or the publish window.
 */
export interface TranslationsValue {
  loaded: boolean;
  /** the machine translation is on for this event (feature translate_ai and a model set up) */
  available: boolean;
  rows: TranslationRow[];
  glossary: string[];
  /** a language being translated now */
  busy: Locale | null;
  /** texts waiting for the host: the machine's, not approved, or gone stale */
  pending: (locale?: Locale) => TranslationRow[];
  translate: (locale: Locale, paths?: string[]) => Promise<void>;
  approve: (locale: Locale, paths: string[]) => Promise<void>;
  saveGlossary: (terms: string[]) => Promise<boolean>;
  /** opens the review window on a language (null closes it) */
  review: (locale: Locale | null) => void;
}

const TranslationsContext = createContext<TranslationsValue | null>(null);
type Flush = () => Promise<boolean>;
const FlushContext = createContext<{ current: Flush } | null>(null);

/** null outside the editor (the gallery's preview, tests). */
export const useTranslations = () => useContext(TranslationsContext);

/**
 * The machine's translation in a field's language, while it waits for the host: the field shows it,
 * with "approve" and the way to the review.
 */
export function useMachineText(
  docPath: string,
  locale: Locale,
): { state: 'machine' | 'stale'; approve: () => void; review: () => void } | null {
  const tr = useTranslations();
  const { doc } = useEditor();
  if (!tr?.rows.length) return null;
  const path = stablePath(doc, docPath);
  const row = tr.rows.find((r) => r.locale === locale && r.path === path);
  if (!row) return null;
  const state = translationState(doc, row);
  if (state !== 'machine' && state !== 'stale') return null;
  return { state, approve: () => void tr.approve(locale, [path]), review: () => tr.review(locale) };
}

/**
 * The editor's autosave hands its "save now" to the translations (the server translates and approves
 * what is saved).
 */
export function useTranslationsFlush(flush: Flush) {
  const ref = useContext(FlushContext);
  useEffect(() => {
    if (ref) ref.current = flush;
  }, [ref, flush]);
}

type State = { rows: TranslationRow[]; glossary: string[]; translate: boolean };

export function TranslationsProvider({ children }: { children: ReactNode }) {
  const { doc, meta, apply } = useEditor();
  const flushRef = useRef<Flush>(async () => true);
  const flush = useCallback(() => flushRef.current(), []);
  const { t, plural, number } = useUi();
  const { toast } = useToast();
  const l = t.editor.f.languages;
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<Locale | null>(null);
  const [reviewing, setReviewing] = useState<Locale | null>(null);
  const several = doc.locales.length > 1;
  const localesKey = doc.locales.join(',');

  // read once the invitation has another language (and again when its languages change)
  useEffect(() => {
    if (!several) return;
    let live = true;
    void hostApi<State & { ok: boolean }>(`/api/invitations/${meta.id}/translations`).then((res) => {
      if (live && res.ok && res.body)
        setState({ rows: res.body.rows, glossary: res.body.glossary, translate: res.body.translate });
    });
    return () => {
      live = false;
    };
  }, [meta.id, several, localesKey]);

  const rows = useMemo(() => state?.rows ?? [], [state]);
  const pending = useCallback(
    (locale?: Locale) => pendingReview(doc, rows).filter((r) => !locale || r.locale === locale),
    [doc, rows],
  );

  const failure = useCallback(
    (status: number, code: string | undefined) => {
      if (status === 401) return window.location.assign(loginUrl());
      const message =
        code === 'translate_ai'
          ? l.errors.translate_ai
          : code === 'rate_limited'
            ? l.errors.rate_limited
            : code === 'too_much'
              ? l.errors.too_much
              : l.errors.failed;
      toast({ title: message, variant: 'danger' });
    },
    [l, toast],
  );

  const translate = useCallback(
    async (locale: Locale, paths?: string[]) => {
      setBusy(locale);
      try {
        if (!(await flush())) return failure(0, undefined);
        const res = await hostApi<{
          ok: boolean;
          code?: string;
          texts: { path: string; text: string }[];
          rows: TranslationRow[];
          rejected: string[];
        }>(`/api/invitations/${meta.id}/translations`, { method: 'POST', body: { locale, paths } });
        if (!res.ok || !res.body?.ok) return failure(res.status, res.body?.code);
        const { texts, rejected } = res.body;
        const language = t.editor.languageIn[locale];
        if (!texts.length && !rejected.length) {
          toast({ title: fmt(l.nothingToTranslate, { language }) });
          return;
        }
        // into the draft as one undo step — never over what the host wrote meanwhile (unless asked to)
        apply((d) => {
          let next = d;
          for (const { path, text } of texts) {
            const at = docPathOf(next, path);
            if (at === null) continue;
            const value = (getAt(next, at) as L10n | null) ?? {};
            if (!paths && (value[locale] ?? '').trim()) continue;
            next = setAt(next, at, { ...value, [locale]: text });
          }
          return next;
        }, null);
        const fresh = res.body.rows;
        setState((s) => ({
          rows: [...(s?.rows ?? []).filter((r) => r.locale !== locale), ...fresh],
          glossary: s?.glossary ?? [],
          translate: s?.translate ?? true,
        }));
        if (texts.length)
          toast({
            title: plural(l.translated, texts.length, { n: number(texts.length), language }),
            description: rejected.length
              ? plural(l.rejected, rejected.length, { n: number(rejected.length) })
              : undefined,
            variant: 'success',
          });
        else
          toast({
            title: plural(l.rejected, rejected.length, { n: number(rejected.length) }),
            variant: 'danger',
          });
      } finally {
        setBusy(null);
      }
    },
    [apply, failure, flush, l, meta.id, number, plural, t.editor.languageIn, toast],
  );

  const approve = useCallback(
    async (locale: Locale, paths: string[]) => {
      if (!paths.length) return;
      if (!(await flush())) return failure(0, undefined);
      const res = await hostApi<{ ok: boolean; code?: string; approved: number; rows: TranslationRow[] }>(
        `/api/invitations/${meta.id}/translations`,
        { method: 'PATCH', body: { locale, paths } },
      );
      if (!res.ok || !res.body?.ok) return failure(res.status, res.body?.code);
      const { rows: saved, approved } = res.body;
      setState((s) => ({ rows: saved, glossary: s?.glossary ?? [], translate: s?.translate ?? false }));
      toast({
        title: plural(t.editor.translations.approved, approved, { n: number(approved) }),
        variant: 'success',
      });
    },
    [failure, flush, meta.id, number, plural, t.editor.translations.approved, toast],
  );

  const saveGlossary = useCallback(
    async (terms: string[]) => {
      const res = await hostApi<{ ok: boolean; glossary: string[] }>(
        `/api/invitations/${meta.id}/translations`,
        {
          method: 'PUT',
          body: { terms },
        },
      );
      if (!res.ok || !res.body?.ok) {
        failure(res.status, undefined);
        return false;
      }
      const glossary = res.body.glossary;
      setState((s) => ({ rows: s?.rows ?? [], glossary, translate: s?.translate ?? false }));
      return true;
    },
    [failure, meta.id],
  );

  const value = useMemo<TranslationsValue>(
    () => ({
      loaded: state !== null,
      available: !!state?.translate,
      rows,
      glossary: state?.glossary ?? [],
      busy,
      pending,
      translate,
      approve,
      saveGlossary,
      review: setReviewing,
    }),
    [state, rows, busy, pending, translate, approve, saveGlossary],
  );

  return (
    <FlushContext.Provider value={flushRef}>
      <TranslationsContext.Provider value={value}>
        {children}
        {reviewing && doc.locales.includes(reviewing) ? (
          <TranslationReview locale={reviewing} onLocale={setReviewing} onClose={() => setReviewing(null)} />
        ) : null}
      </TranslationsContext.Provider>
    </FlushContext.Provider>
  );
}
