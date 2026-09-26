'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InvitationDocument } from '../../contracts/types';
import { hostApi } from '../../app/api';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'failed' | 'offline' | 'invalid' | 'conflict';

/** §7.6: the draft is saved 800ms after the last change. */
export const AUTOSAVE_DEBOUNCE_MS = 800;

type SaveResponse =
  | { ok: true; updatedAt: string }
  | { ok: false; code: 'conflict'; updatedAt: string; draft: InvitationDocument }
  | { ok: false; code: string };

export interface Conflict {
  draft: InvitationDocument;
  updatedAt: string;
}

/**
 * Autosave of the draft (§7.6): debounced, one request at a time, optimistic (the editor never waits),
 * conflict-safe — every save sends the `updated_at` it started from and the server refuses to
 * overwrite a newer draft (409 → the host picks a version). Retries when the connection comes back.
 */
export function useAutosave({
  id,
  doc,
  initialDoc,
  initialUpdatedAt,
  onSaved,
  onUnauthorized,
}: {
  id: string;
  doc: InvitationDocument;
  initialDoc: InvitationDocument;
  initialUpdatedAt: string;
  onSaved?: (doc: InvitationDocument) => void;
  onUnauthorized: () => void;
}) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<Conflict | null>(null);
  // why the last save was refused, when the server said (`feature_off`: a cinematic value without the feature)
  const [refused, setRefused] = useState<'feature_off' | null>(null);
  const latest = useRef(doc);
  const saved = useRef(initialDoc);
  const updatedAt = useRef(initialUpdatedAt);
  const timer = useRef<number | undefined>(undefined);
  const running = useRef<Promise<boolean> | null>(null);
  const blocked = useRef(false); // an unresolved conflict pauses saving
  const callbacks = useRef({ onSaved, onUnauthorized });
  callbacks.current = { onSaved, onUnauthorized };

  const save = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (running.current) await running.current;
    const snapshot = latest.current;
    if (snapshot === saved.current) {
      setStatus('saved');
      return true;
    }
    if (blocked.current) return false;
    if (!navigator.onLine) {
      setStatus('offline');
      return false;
    }
    setStatus('saving');
    const run = (async () => {
      const res = await hostApi<SaveResponse>(`/api/invitations/${id}`, {
        method: 'PATCH',
        body: { draft: snapshot, updatedAt: updatedAt.current },
      });
      const body = res.body;
      if (res.ok && body?.ok) {
        setRefused(null);
        updatedAt.current = body.updatedAt;
        saved.current = snapshot;
        callbacks.current.onSaved?.(snapshot);
        if (latest.current === snapshot) setStatus('saved');
        else {
          setStatus('dirty');
          timer.current = window.setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
        }
        return true;
      }
      if (res.status === 409 && body && 'draft' in body) {
        blocked.current = true;
        setConflict({ draft: body.draft, updatedAt: body.updatedAt });
        setStatus('conflict');
        return false;
      }
      if (res.status === 401) {
        callbacks.current.onUnauthorized();
        setStatus('failed');
        return false;
      }
      // 403 feature_off: a value the event's features don't allow (the cinematic controls without it)
      const featureOff = res.status === 403 && !!body && !body.ok && body.code === 'feature_off';
      setRefused(featureOff ? 'feature_off' : null);
      setStatus(res.status === 422 || featureOff ? 'invalid' : !navigator.onLine ? 'offline' : 'failed');
      return false;
    })();
    running.current = run;
    try {
      return await run;
    } finally {
      if (running.current === run) running.current = null;
    }
  }, [id]);

  useEffect(() => {
    latest.current = doc;
    if (doc === saved.current) {
      window.clearTimeout(timer.current);
      setStatus((s) => (s === 'dirty' ? 'saved' : s));
      return;
    }
    if (blocked.current) return;
    setStatus((s) => (s === 'saving' ? s : 'dirty'));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
  }, [doc, save]);

  useEffect(() => {
    const online = () => {
      if (latest.current !== saved.current) void save();
    };
    const offline = () => {
      if (latest.current !== saved.current) setStatus('offline');
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current === saved.current) return;
      void save();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeunload', beforeUnload);
      window.clearTimeout(timer.current);
    };
  }, [save]);

  /** Keep the saved copy (another tab's) — the caller puts `conflict.draft` into the editor. */
  const acceptTheirs = useCallback((c: Conflict) => {
    saved.current = c.draft;
    latest.current = c.draft;
    updatedAt.current = c.updatedAt;
    blocked.current = false;
    setConflict(null);
    setStatus('saved');
  }, []);

  /** Overwrite the saved copy with this editor's draft. */
  const keepMine = useCallback(
    (c: Conflict) => {
      updatedAt.current = c.updatedAt;
      blocked.current = false;
      setConflict(null);
      void save();
    },
    [save],
  );

  /** After a server-side change of the draft (restore): the new baseline, without saving it again. */
  const rebase = useCallback((next: InvitationDocument, nextUpdatedAt: string) => {
    saved.current = next;
    latest.current = next;
    updatedAt.current = nextUpdatedAt;
  }, []);

  return {
    status,
    conflict,
    refused,
    /** save now (before publishing); resolves true when the server has the current draft */
    flush: save,
    acceptTheirs,
    keepMine,
    rebase,
    isSaved: () => latest.current === saved.current,
  };
}
