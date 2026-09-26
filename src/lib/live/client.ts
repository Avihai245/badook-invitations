'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeInfo } from './types';

/**
 * Live updates of a page (the live gallery's, the entrance stations', the host's live hall): a
 * Supabase Realtime broadcast channel (Phoenix protocol 1.0.0 over a WebSocket — a few lines instead of
 * the whole Supabase client on guests' phones) that only says "something changed"; the page then asks
 * its API what. It reconnects by itself with growing pauses; while the connection is down the page
 * polls instead, and stops polling once it is back.
 */

export const LIVE = {
  /** hints closer together than this make one refresh */
  hintThrottleMs: 1_500,
  heartbeatMs: 25_000,
  joinTimeoutMs: 10_000,
  /** a hidden page lets go of its connection after this */
  hiddenDisconnectMs: 60_000,
  reconnectMs: [1_000, 2_000, 5_000, 10_000, 20_000, 30_000],
} as const;

export type LiveStatus = 'connecting' | 'live' | 'polling';

interface Handlers {
  onHint(kind: string): void;
  onStatus(status: LiveStatus): void;
}

export interface LiveConnection {
  close(): void;
  /** the page came back to the front: reconnect now if the socket is down */
  wake(): void;
}

type Message = { topic?: string; event?: string; payload?: Record<string, unknown>; ref?: string | null };

export function connectLive(info: RealtimeInfo, h: Handlers): LiveConnection {
  const L = LIVE;
  const topic = `realtime:${info.channel}`;
  const url = `${info.url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(info.key)}&vsn=1.0.0`;
  let ws: WebSocket | null = null;
  let ref = 0;
  let joinRef = '';
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let joinTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingBeat: string | null = null;
  let failures = 0;
  let closed = false;
  let status: LiveStatus | null = null;

  const set = (s: LiveStatus) => {
    if (status === s) return;
    status = s;
    h.onStatus(s);
  };
  const send = (m: Message & { join_ref?: string }) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };
  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (joinTimer) clearTimeout(joinTimer);
    heartbeat = null;
    joinTimer = null;
    pendingBeat = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        // already closed
      }
    }
    ws = null;
  };
  const retry = () => {
    cleanup();
    if (closed) return;
    failures++;
    // down: the page polls until the channel is back
    set('polling');
    const steps = L.reconnectMs;
    retryTimer = setTimeout(open, steps[Math.min(failures, steps.length) - 1]);
  };
  function open() {
    retryTimer = null;
    if (closed) return;
    if (status === null) set('connecting');
    try {
      ws = new WebSocket(url);
    } catch {
      return retry();
    }
    ws.onopen = () => {
      joinRef = String(++ref);
      send({
        topic,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            postgres_changes: [],
            private: false,
          },
        },
        ref: joinRef,
        join_ref: joinRef,
      });
      joinTimer = setTimeout(retry, L.joinTimeoutMs);
      heartbeat = setInterval(() => {
        // no answer to the last heartbeat: the connection is dead even if the socket says otherwise
        if (pendingBeat) return retry();
        pendingBeat = String(++ref);
        send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: pendingBeat });
      }, L.heartbeatMs);
    };
    ws.onmessage = (e) => {
      let m: Message;
      try {
        m = JSON.parse(String(e.data)) as Message;
      } catch {
        return;
      }
      if (m.event === 'phx_reply') {
        if (m.ref === pendingBeat) pendingBeat = null;
        if (m.ref === joinRef) {
          if (joinTimer) clearTimeout(joinTimer);
          joinTimer = null;
          if ((m.payload as { status?: string } | undefined)?.status === 'ok') {
            const wasDown = failures > 0;
            failures = 0;
            set('live');
            // whatever happened while the channel was down
            if (wasDown) h.onHint('reconnected');
          } else retry();
        }
        return;
      }
      if (m.topic === topic && m.event === 'broadcast') {
        const event = (m.payload as { event?: string } | undefined)?.event;
        const kind = (m.payload as { payload?: { kind?: unknown } } | undefined)?.payload?.kind;
        if (event === 'refresh') h.onHint(typeof kind === 'string' ? kind : 'items');
        return;
      }
      if (m.topic === topic && (m.event === 'phx_error' || m.event === 'phx_close')) retry();
    };
    ws.onclose = () => retry();
    ws.onerror = () => retry();
  }
  open();
  return {
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      cleanup();
    },
    wake() {
      if (closed) return;
      if (!ws && retryTimer) {
        clearTimeout(retryTimer);
        open();
      }
    },
  };
}

/**
 * Keeps a page current: `refresh` runs on each hint (several close together make one), when the page
 * comes back to the front, and every `pollMs` while the live channel is down (or there is none).
 * A hidden page lets go of its connection after a minute (phones, batteries, connection quotas) and
 * takes it again when it is back. Returns the connection's state.
 */
export function useLiveRefresh(
  realtime: RealtimeInfo | null,
  refresh: (kind: string) => void,
  pollMs: number,
): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(realtime ? 'connecting' : 'polling');
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const key = realtime ? `${realtime.url}|${realtime.key}|${realtime.channel}` : '';

  useEffect(() => {
    let last = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let kinds = new Set<string>();
    const hint = (kind: string) => {
      kinds.add(kind);
      if (pending) return;
      const wait = Math.max(0, last + LIVE.hintThrottleMs - Date.now());
      pending = setTimeout(() => {
        pending = null;
        last = Date.now();
        const all = kinds;
        kinds = new Set();
        refreshRef.current(all.has('settings') ? 'settings' : ([...all][0] ?? 'items'));
      }, wait);
    };

    let conn: LiveConnection | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const setPolling = (on: boolean) => {
      if (on && !poll)
        poll = setInterval(() => document.visibilityState === 'visible' && hint('poll'), pollMs);
      if (!on && poll) {
        clearInterval(poll);
        poll = null;
      }
    };
    const onStatus = (s: LiveStatus) => {
      setStatus(s);
      setPolling(s === 'polling');
    };
    const connect = () => {
      if (!realtime || conn) return;
      conn = connectLive(realtime, { onHint: hint, onStatus });
    };
    if (realtime) connect();
    else onStatus('polling');

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        hiddenTimer = null;
        if (realtime && !conn) connect();
        conn?.wake();
        hint('visible');
      } else if (realtime && !hiddenTimer) {
        hiddenTimer = setTimeout(() => {
          hiddenTimer = null;
          conn?.close();
          conn = null;
        }, LIVE.hiddenDisconnectMs);
      }
    };
    const onOnline = () => {
      conn?.wake();
      hint('online');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      if (pending) clearTimeout(pending);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      setPolling(false);
      conn?.close();
    };
    // `key` stands for `realtime`'s content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pollMs]);

  return status;
}
