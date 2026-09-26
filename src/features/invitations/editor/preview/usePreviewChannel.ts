'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { InvitationDocument, Locale } from '../../contracts/types';
import { isEnvelope, PREVIEW_CHANNEL, type FrameToParent, type ParentToFrame } from './protocol';

/**
 * Editor side of the preview iframe: posts the document (debounced, §9B.3-D: 150ms) once the frame is
 * ready and on every change, forwards clicks on editable nodes, and outlines the focused field's node.
 */
export function usePreviewChannel(
  iframe: RefObject<HTMLIFrameElement | null>,
  {
    doc,
    locale,
    cinematic = true,
    onSelect,
    debounceMs = 150,
  }: {
    doc: InvitationDocument | null;
    locale: Locale;
    /** the event has the `cinematic` feature: the preview shows what its guests will see */
    cinematic?: boolean;
    onSelect?: (path: string) => void;
    debounceMs?: number;
  },
) {
  const ready = useRef(false);
  const latest = useRef({ doc, locale, cinematic });
  latest.current = { doc, locale, cinematic };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const send = useCallback(
    (msg: ParentToFrame) => {
      const win = iframe.current?.contentWindow;
      if (win && ready.current) win.postMessage({ ...msg, channel: PREVIEW_CHANNEL }, window.location.origin);
    },
    [iframe],
  );

  const sendDoc = useCallback(() => {
    const { doc: d, locale: l, cinematic: c } = latest.current;
    if (d) send({ type: 'doc', doc: d, locale: l, cinematic: c });
  }, [send]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframe.current?.contentWindow) return;
      if (!isEnvelope<FrameToParent>(e.data)) return;
      if (e.data.type === 'ready') {
        ready.current = true;
        sendDoc();
      } else if (e.data.type === 'select') {
        onSelectRef.current?.(e.data.path);
      }
    };
    window.addEventListener('message', onMessage);
    // The frame may have announced itself before this listener existed (hydration is slower than a
    // cached frame): ask again, now and whenever the iframe (re)loads.
    const ping = () =>
      iframe.current?.contentWindow?.postMessage(
        { type: 'ping', channel: PREVIEW_CHANNEL },
        window.location.origin,
      );
    ping();
    const el = iframe.current;
    el?.addEventListener('load', ping);
    return () => {
      window.removeEventListener('message', onMessage);
      el?.removeEventListener('load', ping);
    };
  }, [iframe, sendDoc]);

  // (a reloaded iframe announces itself again with 'ready' and gets the current document)
  useEffect(() => {
    if (!ready.current) return;
    const t = window.setTimeout(sendDoc, debounceMs);
    return () => window.clearTimeout(t);
  }, [doc, locale, cinematic, debounceMs, sendDoc]);

  return {
    highlight: useCallback(
      (path: string | null, label?: string) => send({ type: 'highlight', path, label }),
      [send],
    ),
    replay: useCallback(() => send({ type: 'replay' }), [send]),
    reveal: useCallback((path: string) => send({ type: 'reveal', path }), [send]),
  };
}
