/**
 * Realtime hints: where a page listens (Supabase Realtime's broadcast). The channel's name is random and
 * only given to pages that may see what it is about; its messages carry no data — "something changed"
 * — and the page then asks its own API what.
 */
export interface RealtimeInfo {
  url: string;
  key: string;
  channel: string;
}
