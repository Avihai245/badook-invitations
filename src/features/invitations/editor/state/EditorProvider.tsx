'use client';

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AssetRef,
  InvitationDocument,
  Locale,
  TemplateDefaults,
  TemplateManifest,
} from '../../contracts/types';
import { validateDocument, type ValidationResult } from '../../contracts/validate';
import { resolveAsset, type AssetBases } from '../../renderer/assets';
import { commit, createHistory, redo, replacePresent, undo, type History } from '../history';
import { setAt } from '../paths';

export type PanelId = 'cover' | 'palette' | 'fonts' | 'music' | 'event' | 'languages' | 'share';
export type Selection = { kind: 'section'; id: string } | { kind: 'panel'; panel: PanelId };
export type RailTab = 'sections' | 'design' | 'settings';

export const DESIGN_PANELS: readonly PanelId[] = ['palette', 'fonts', 'cover', 'music'];
export const SETTINGS_PANELS: readonly PanelId[] = ['event', 'languages', 'share'];

export interface InvitationMeta {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  publishedAt: string | null;
  /** the published document differs from the draft */
  unpublishedChanges: boolean;
}

type Action =
  | { type: 'update'; path: string; value: unknown; key: string | null }
  | { type: 'apply'; fn: (doc: InvitationDocument) => InvitationDocument; key: string | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; doc: InvitationDocument; clear: boolean };

function reducer(h: History<InvitationDocument>, a: Action): History<InvitationDocument> {
  switch (a.type) {
    case 'update':
      return commit(h, setAt(h.present, a.path, a.value), { key: a.key });
    case 'apply':
      return commit(h, a.fn(h.present), { key: a.key });
    case 'undo':
      return undo(h);
    case 'redo':
      return redo(h);
    case 'replace':
      return replacePresent(h, a.doc, { clear: a.clear });
  }
}

export interface EditorContextValue {
  doc: InvitationDocument;
  template: TemplateManifest;
  defaults: TemplateDefaults;
  bases: AssetBases;
  publicBaseUrl: string;
  meta: InvitationMeta;
  setMeta: (update: Partial<InvitationMeta>) => void;
  /** language being edited — also the preview language */
  locale: Locale;
  setLocale: (l: Locale) => void;
  selection: Selection;
  railTab: RailTab;
  setRailTab: (tab: RailTab) => void;
  /** select a section or panel; `focusPath` asks the panel to focus (and reveal) that field */
  select: (selection: Selection, focusPath?: string) => void;
  focusRequest: { path: string; nonce: number } | null;
  /** set a value by document path (one undo step per `key`, coalesced while typing) */
  update: (path: string, value: unknown, key?: string | null) => void;
  /** any other change, as a pure function of the current document */
  apply: (fn: (doc: InvitationDocument) => InvitationDocument, key?: string | null) => void;
  /** replace the document without an undo step (server conflict, restored version with `clear`) */
  replace: (doc: InvitationDocument, clear?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** live validation (edit mode) of a slightly deferred copy of the document */
  issues: ValidationResult;
  /** after a publish attempt: show issue messages next to the fields */
  showIssues: boolean;
  setShowIssues: (on: boolean) => void;
  assetUrl: (ref: AssetRef | null | undefined) => string | null;
}

/** The rail tab that lists a selection (the cover is listed under both Sections and Design). */
function railTabFor(selection: Selection, current: RailTab): RailTab {
  if (selection.kind === 'section') return 'sections';
  if (SETTINGS_PANELS.includes(selection.panel)) return 'settings';
  if (selection.panel === 'cover') return current === 'design' ? 'design' : 'sections';
  return 'design';
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor() outside <EditorProvider>');
  return value;
}

export function EditorProvider({
  initialDoc,
  initialMeta,
  template,
  defaults,
  bases,
  publicBaseUrl,
  initialLocale,
  children,
}: {
  initialDoc: InvitationDocument;
  initialMeta: InvitationMeta;
  template: TemplateManifest;
  defaults: TemplateDefaults;
  bases: AssetBases;
  publicBaseUrl: string;
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [history, dispatch] = useReducer(reducer, initialDoc, createHistory);
  const doc = history.present;
  const [meta, setMetaState] = useState(initialMeta);
  const [locale, setLocaleState] = useState<Locale>(
    initialDoc.locales.includes(initialLocale) ? initialLocale : initialDoc.defaultLocale,
  );
  const [selection, setSelection] = useState<Selection>(() => {
    const hero = initialDoc.sections.find((s) => s.type === 'hero');
    return hero ? { kind: 'section', id: hero.id } : { kind: 'panel', panel: 'event' };
  });
  const [railTab, setRailTab] = useState<RailTab>('sections');
  const [focusRequest, setFocusRequest] = useState<EditorContextValue['focusRequest']>(null);
  const [showIssues, setShowIssues] = useState(false);
  const nonce = useRef(0);

  // The editing language must stay one of the invitation's languages.
  const activeLocale = doc.locales.includes(locale) ? locale : doc.defaultLocale;

  const deferred = useDeferredValue(doc);
  const issues = useMemo(() => validateDocument(deferred, template, { mode: 'edit' }), [deferred, template]);

  const select = useCallback((next: Selection, focusPath?: string) => {
    setSelection(next);
    setRailTab((tab) => railTabFor(next, tab));
    setFocusRequest(focusPath ? { path: focusPath, nonce: ++nonce.current } : null);
  }, []);

  const value = useMemo<EditorContextValue>(
    () => ({
      doc,
      template,
      defaults,
      bases,
      publicBaseUrl,
      meta,
      setMeta: (update) => setMetaState((m) => ({ ...m, ...update })),
      locale: activeLocale,
      setLocale: setLocaleState,
      selection,
      railTab,
      setRailTab,
      select,
      focusRequest,
      update: (path, v, key = path) => dispatch({ type: 'update', path, value: v, key }),
      apply: (fn, key = null) => dispatch({ type: 'apply', fn, key }),
      replace: (next, clear = false) => dispatch({ type: 'replace', doc: next, clear }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      issues,
      showIssues,
      setShowIssues,
      assetUrl: (ref) => resolveAsset(ref, template, bases),
    }),
    [
      doc,
      template,
      defaults,
      bases,
      publicBaseUrl,
      meta,
      activeLocale,
      selection,
      railTab,
      select,
      focusRequest,
      history.past.length,
      history.future.length,
      issues,
      showIssues,
    ],
  );
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
