'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { LabeledPin } from '@/features/review/model';
import type { InvitationDocument, Locale } from '../../contracts/types';
import { isEnvelope, PREVIEW_CHANNEL, type FrameToParent, type ParentToFrame } from './protocol';

/**
 * Editor side of the preview iframe: posts the document (debounced, §9B.3-D: 150ms) once the frame is
 * ready and on every change, forwards clicks on editable nodes, and outlines the focused field's node.
 * The family's comment pins (features/review), when given, are drawn over it; a click on one comes back.
 */
export function usePreviewChannel(
  iframe: RefObject<HTMLIFrameElement | null>,
  {
    doc,
    locale,
    cinematic = true,
    onSelect,
    pins = null,
    onPin,
    debounceMs = 150,
  }: {
    doc: InvitationDocument | null;
    locale: Locale;
    /** the event has the `cinematic` feature: the preview shows what its guests will see */
    cinematic?: boolean;
    onSelect?: (path: string) => void;
    /** the review's comment pins to draw (null: none) and the layer's name */
    pins?: { pins: LabeledPin[]; label: string } | null;
    onPin?: (id: string) => void;
    debounceMs?: number;
  },
) {
  const ready = useRef(false);
  const latest = useRef({ doc, locale, cinematic, pins });
  latest.current = { doc, locale, cinematic, pins };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;

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

  const sendPins = useCallback(() => {
    const p = latest.current.pins;
    send({ type: 'pins', pins: p?.pins ?? [], label: p?.label ?? '' });
  }, [send]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframe.current?.contentWindow) return;
      if (!isEnvelope<FrameToParent>(e.data)) return;
      if (e.data.type === 'ready') {
        ready.current = true;
        sendDoc();
        sendPins();
      } else if (e.data.type === 'select') {
        onSelectRef.current?.(e.data.path);
      } else if (e.data.type === 'pin') {
        onPinRef.current?.(e.data.id);
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
  }, [iframe, sendDoc, sendPins]);

  // (a reloaded iframe announces itself again with 'ready' and gets the current document)
  useEffect(() => {
    if (!ready.current) return;
    const t = window.setTimeout(sendDoc, debounceMs);
    return () => window.clearTimeout(t);
  }, [doc, locale, cinematic, debounceMs, sendDoc]);

  // the pins after the document they sit on
  useEffect(() => {
    if (!ready.current) return;
    const t = window.setTimeout(sendPins, debounceMs);
    return () => window.clearTimeout(t);
  }, [pins, debounceMs, sendPins]);

  return {
    highlight: useCallback(
      (path: string | null, label?: string) => send({ type: 'highlight', path, label }),
      [send],
    ),
    replay: useCallback(() => send({ type: 'replay' }), [send]),
    reveal: useCallback((path: string) => send({ type: 'reveal', path }), [send]),
    // the document as it is now first (its debounced send may still be waiting): the section plays
    // the motion just chosen
    play: useCallback(
      (path: string, ms: number) => {
        sendDoc();
        send({ type: 'play', path, ms });
      },
      [send, sendDoc],
    ),
    /** scroll the preview to a comment's pin (after the section's own reveal) */
    revealPin: useCallback(
      (id: string) => window.setTimeout(() => send({ type: 'revealPin', id }), debounceMs + 150),
      [send, debounceMs],
    ),
  };
}
