'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { dirOf, type InvitationDocument, type Locale, type TemplateManifest } from '../../contracts/types';
import type { AssetBases } from '../../renderer/assets';
import { buildRenderContext } from '../../renderer/context';
import { InvitationBody } from '../../renderer/InvitationBody';
import { themeMode, themeVars } from '../../renderer/theme';
import {
  closestRenderedPath,
  isEnvelope,
  PREVIEW_CHANNEL,
  type FrameToParent,
  type ParentToFrame,
} from './protocol';

/**
 * Inside the editor's phone iframe (/app/preview-frame/<template>): renders the same InvitationBody
 * as the public page, from the document the parent posts (§9B.3-D preview wiring). Clicking an element
 * with data-edit-path selects it in the editor; a focused field outlines its node here.
 */
export function PreviewFrame({
  template,
  brand,
  bases,
  publicBaseUrl,
  standalone = null,
}: {
  template: TemplateManifest;
  brand: string;
  bases: AssetBases;
  publicBaseUrl: string;
  /**
   * "Open in a new tab": a saved draft (or published version) rendered full-page like the public
   * invitation — cover included, the language switch as links — instead of waiting for the editor.
   */
  standalone?: { doc: InvitationDocument; locale: Locale; langHref: string | null } | null;
}) {
  const [state, setState] = useState<{ doc: InvitationDocument; locale: Locale } | null>(standalone);
  const [replay, setReplay] = useState(0);
  const highlight = useRef<{ path: string | null; label?: string }>({ path: null });

  const post = useCallback((msg: FrameToParent) => {
    window.parent.postMessage({ ...msg, channel: PREVIEW_CHANNEL }, window.location.origin);
  }, []);

  const applyHighlight = useCallback((scroll: boolean) => {
    document.querySelectorAll('.edit-highlight').forEach((el) => el.classList.remove('edit-highlight'));
    document.querySelector('.edit-chip')?.remove();
    const { path, label } = highlight.current;
    if (!path) return;
    const found = closestRenderedPath(
      path,
      (p) => !!document.querySelector(`[data-edit-path="${CSS.escape(p)}"]`),
    );
    const el = found ? document.querySelector<HTMLElement>(`[data-edit-path="${CSS.escape(found)}"]`) : null;
    if (!el) return;
    el.classList.add('edit-highlight');
    if (label) {
      // an overlay chip at the node's start corner (physical coordinates: it tracks a box on screen)
      const rect = el.getBoundingClientRect();
      const chip = document.createElement('div');
      chip.className = 'edit-chip';
      chip.textContent = label;
      document.body.appendChild(chip);
      const rtl = getComputedStyle(el).direction === 'rtl';
      const left = rtl ? rect.right - chip.offsetWidth : rect.left;
      chip.style.top = `${Math.max(0, rect.top + window.scrollY - chip.offsetHeight - 6)}px`;
      chip.style.left = `${Math.min(Math.max(4, left + window.scrollX), window.innerWidth - chip.offsetWidth - 4)}px`;
    }
    if (scroll) {
      const r = el.getBoundingClientRect();
      if (r.top < 40 || r.bottom > window.innerHeight - 40)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  // messages from the editor
  useEffect(() => {
    if (standalone) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      if (!isEnvelope<ParentToFrame>(e.data)) return;
      const msg = e.data;
      if (msg.type === 'ping') post({ type: 'ready' });
      else if (msg.type === 'reveal') {
        const found = closestRenderedPath(
          msg.path,
          (p) => !!document.querySelector(`[data-edit-path="${CSS.escape(p)}"]`),
        );
        const el = found
          ? document.querySelector<HTMLElement>(`[data-edit-path="${CSS.escape(found)}"]`)
          : null;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      } else if (msg.type === 'doc') setState({ doc: msg.doc, locale: msg.locale });
      else if (msg.type === 'highlight') {
        highlight.current = { path: msg.path, label: msg.label };
        applyHighlight(true);
      } else if (msg.type === 'replay') {
        delete document.documentElement.dataset.opened;
        delete document.documentElement.dataset.coverSkipped;
        window.scrollTo(0, 0);
        setReplay((n) => n + 1);
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, [post, applyHighlight, standalone]);

  // replay: live mode with the cover until the opening has played
  useEffect(() => {
    if (!replay) return;
    let t = 0;
    const onOpen = () => {
      t = window.setTimeout(() => setReplay(0), 3000);
    };
    window.addEventListener('invitation:open', onOpen);
    return () => {
      window.removeEventListener('invitation:open', onOpen);
      window.clearTimeout(t);
    };
  }, [replay]);

  // click an editable node → select it in the editor (links and buttons don't navigate or submit)
  useEffect(() => {
    if (standalone) return;
    const onClick = (e: MouseEvent) => {
      if (replay) return;
      const target = e.target as Element | null;
      if (target?.closest('a[href], button[type="submit"], form button:not([type])')) e.preventDefault();
      const node = target?.closest('[data-edit-path]');
      const path = node?.getAttribute('data-edit-path');
      if (path) post({ type: 'select', path });
    };
    const onSubmit = (e: Event) => e.preventDefault();
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [post, replay, standalone]);

  const ctx = useMemo(
    () =>
      state
        ? buildRenderContext(state.doc, template, state.locale, {
            mode: replay ? 'live' : 'editor',
            brand,
            bases,
            publicBaseUrl,
          })
        : null,
    [state, template, replay, brand, bases, publicBaseUrl],
  );

  // <html> carries lang/dir/theme exactly like the public page's root layout
  useLayoutEffect(() => {
    if (!state || standalone) return;
    const root = document.documentElement;
    root.lang = state.locale;
    root.dir = dirOf(state.locale);
    root.dataset.theme = themeMode(template, state.doc);
    root.dataset.template = template.id;
    if (!replay) root.dataset.opened = '1';
    root.classList.remove('no-js');
    const vars = themeVars(template, state.doc, state.locale) as CSSProperties & Record<string, string>;
    for (const [key, value] of Object.entries(vars)) {
      if (key.startsWith('--')) root.style.setProperty(key, String(value));
    }
    applyHighlight(false);
  }, [state, template, replay, applyHighlight, standalone]);

  if (standalone)
    return (
      <StandalonePreview
        {...standalone}
        template={template}
        brand={brand}
        bases={bases}
        publicBaseUrl={publicBaseUrl}
      />
    );
  if (!ctx) return null;
  return <InvitationBody key={replay} ctx={ctx} showCover={replay > 0} langSwitchHref={null} />;
}

function StandalonePreview({
  doc,
  locale,
  langHref,
  template,
  brand,
  bases,
  publicBaseUrl,
}: {
  doc: InvitationDocument;
  locale: Locale;
  langHref: string | null;
  template: TemplateManifest;
  brand: string;
  bases: AssetBases;
  publicBaseUrl: string;
}) {
  const ctx = useMemo(
    () => buildRenderContext(doc, template, locale, { mode: 'live', brand, bases, publicBaseUrl }),
    [doc, template, locale, brand, bases, publicBaseUrl],
  );
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dirOf(locale);
    root.dataset.theme = themeMode(template, doc);
    delete root.dataset.opened;
    root.classList.remove('no-js');
    const vars = themeVars(template, doc, locale) as CSSProperties & Record<string, string>;
    for (const [key, value] of Object.entries(vars)) {
      if (key.startsWith('--')) root.style.setProperty(key, String(value));
    }
  }, [doc, template, locale]);
  return <InvitationBody ctx={ctx} showCover langSwitchHref={langHref} />;
}
