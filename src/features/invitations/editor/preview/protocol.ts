import type { InvitationDocument, Locale } from '../../contracts/types';

/**
 * Messages between the editor (parent) and the preview iframe (§9B.3-D "Preview wiring"). Same-origin
 * only; every message carries `channel` so unrelated postMessage traffic is ignored.
 */
export const PREVIEW_CHANNEL = 'badook-preview';

export type ParentToFrame =
  | { type: 'doc'; doc: InvitationDocument; locale: Locale }
  /** outline the node for this path (a field got focus), with a small label chip; null clears */
  | { type: 'highlight'; path: string | null; label?: string }
  /** scroll the node for this path into view (a section was selected), without outlining it */
  | { type: 'reveal'; path: string }
  /** play the cover opening again */
  | { type: 'replay' }
  /** the editor (re)attached its listener: answer with 'ready' (a 'ready' sent before that was lost) */
  | { type: 'ping' };

export type FrameToParent =
  | { type: 'ready' }
  /** the host clicked an element with data-edit-path */
  | { type: 'select'; path: string };

export type Envelope<T> = T & { channel: typeof PREVIEW_CHANNEL };

export function isEnvelope<T extends { type: string }>(data: unknown): data is Envelope<T> {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { channel?: unknown }).channel === PREVIEW_CHANNEL &&
    typeof (data as { type?: unknown }).type === 'string'
  );
}

/** The deepest rendered edit path that is `path` or one of its ancestors ('sections.3.data.items.1.label.he'
 * → 'sections.3.data.items.1.label' → … → 'sections.3'). */
export function closestRenderedPath(path: string, has: (p: string) => boolean): string | null {
  const parts = path.split('.');
  for (let n = parts.length; n > 0; n--) {
    const candidate = parts.slice(0, n).join('.');
    if (has(candidate)) return candidate;
  }
  return null;
}
