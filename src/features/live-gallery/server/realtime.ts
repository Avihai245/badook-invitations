import 'server-only';
import { broadcastRefresh as broadcast } from '@/lib/live/broadcast';

/**
 * "Something changed" for a gallery's open pages — the guests' feed, the screen, the host's tab
 * (src/lib/live/broadcast.ts): new or removed items, or the gallery's settings.
 */
export type HintKind = 'items' | 'settings';

export const broadcastRefresh = (channel: string, kind: HintKind, fetchImpl: typeof fetch = fetch) =>
  broadcast(channel, kind, fetchImpl, 'gallery');
