'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hostApi } from '@/features/invitations/app/api';
import type { AssetRef, EventType, Locale } from '@/features/invitations/contracts/types';
import { ART_DIRECTION } from '../config';
import type { Concept } from '../model';
import { prepareFile, prepareRef, releasePhoto, type PreparedPhoto } from '../client/photos';
import type { ConceptPhoto } from '../apply';

export type StudioError = 'unreadable' | 'tooMany' | 'failed' | 'rate' | 'off';
export type ConceptsReason = 'no_ai' | 'limit' | 'error' | 'invalid' | null;

export interface ConceptsResult {
  concepts: Concept[];
  source: 'ai' | 'composer';
  reason: ConceptsReason;
}

/**
 * "Design it for me" — the photos chosen (read on the device), the mood, and asking for three
 * concepts (POST /api/art-direction; "three more" avoids the designs already shown).
 */
export function useStudio({
  invitationId,
  eventType,
  locales,
  uiLocale,
  current,
}: {
  invitationId: string | null;
  eventType: EventType;
  locales: Locale[];
  uiLocale: 'he' | 'en';
  current?: { templateId: string; fontPairId: string } | null;
}) {
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [reading, setReading] = useState(0);
  const [mood, setMood] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StudioError | null>(null);
  const [result, setResult] = useState<ConceptsResult | null>(null);
  const shown = useRef<{ templateId: string; fontPairId: string }[]>([]);
  const all = useRef<PreparedPhoto[]>([]);
  all.current = photos;

  // device photos' preview addresses go with the screen
  useEffect(() => () => all.current.forEach(releasePhoto), []);

  const room = ART_DIRECTION.maxPhotos - photos.length - reading;

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      setError(null);
      const take = files.slice(0, Math.max(0, room));
      if (files.length > take.length) setError('tooMany');
      if (!take.length) return;
      setReading((n) => n + take.length);
      const done = await Promise.allSettled(take.map((f) => prepareFile(f)));
      setReading((n) => n - take.length);
      const ok = done.flatMap((d) => (d.status === 'fulfilled' ? [d.value] : []));
      if (ok.length < take.length) setError('unreadable');
      setPhotos((prev) => [...prev, ...ok].slice(0, ART_DIRECTION.maxPhotos));
    },
    [room],
  );

  const toggleRef = useCallback(
    async (ref: AssetRef, url: string) => {
      setError(null);
      const key = `ref-${ref}`;
      if (all.current.some((p) => p.key === key)) {
        setPhotos((prev) => prev.filter((p) => p.key !== key));
        return;
      }
      if (room <= 0) {
        setError('tooMany');
        return;
      }
      setReading((n) => n + 1);
      try {
        const photo = await prepareRef(ref, url);
        setPhotos((prev) =>
          prev.some((p) => p.key === key) ? prev : [...prev, photo].slice(0, ART_DIRECTION.maxPhotos),
        );
      } catch {
        setError('unreadable');
      } finally {
        setReading((n) => n - 1);
      }
    },
    [room],
  );

  const remove = useCallback((key: string) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) releasePhoto(gone);
      return prev.filter((p) => p.key !== key);
    });
  }, []);

  /** The first photo is the opening's: another one moves there. */
  const makeFirst = useCallback((key: string) => {
    setPhotos((prev) => {
      const p = prev.find((x) => x.key === key);
      return p ? [p, ...prev.filter((x) => x.key !== key)] : prev;
    });
  }, []);

  const ask = useCallback(
    async (again = false) => {
      if (photos.length < ART_DIRECTION.minPhotos) return false;
      setBusy(true);
      setError(null);
      if (!again) shown.current = [];
      const res = await hostApi<{
        ok: boolean;
        code?: string;
        concepts?: Concept[];
        source?: 'ai' | 'composer';
        reason?: ConceptsReason;
      }>('/api/art-direction', {
        method: 'POST',
        body: {
          invitationId,
          eventType,
          locales,
          uiLocale,
          mood: mood.trim(),
          photos: photos.map((p) => ({ jpeg: p.jpeg, info: p.info })),
          current: current ?? null,
          ...(shown.current.length ? { avoid: shown.current.slice(-12) } : {}),
        },
      });
      setBusy(false);
      if (res.ok && res.body?.ok && res.body.concepts?.length) {
        const concepts = res.body.concepts;
        shown.current = [
          ...shown.current,
          ...concepts.map((c) => ({ templateId: c.templateId, fontPairId: c.fontPairId })),
        ];
        setResult({ concepts, source: res.body.source ?? 'composer', reason: res.body.reason ?? null });
        return true;
      }
      setError(res.status === 429 ? 'rate' : res.status === 403 ? 'off' : 'failed');
      return false;
    },
    [photos, invitationId, eventType, locales, uiLocale, mood, current],
  );

  /** The photos as a concept places them (a device photo by its preview address until uploaded). */
  const conceptPhotos = useCallback(
    (refs?: readonly (AssetRef | null)[]): ConceptPhoto[] =>
      photos.map((p, i) => ({
        ref: refs?.[i] ?? (p.origin.kind === 'ref' ? p.origin.ref : p.url),
        focal: p.info.focal,
        scrim: p.info.scrim,
      })),
    [photos],
  );

  return {
    photos,
    reading,
    room,
    mood,
    setMood,
    busy,
    error,
    setError,
    result,
    setResult,
    addFiles,
    toggleRef,
    remove,
    makeFirst,
    ask,
    conceptPhotos,
  };
}

export type Studio = ReturnType<typeof useStudio>;

/** The photos a concept puts on the invitation (the opening's, and with `cinematic` its placements). */
export function usedPhotos(concept: Concept, cinematic: boolean): Set<number> {
  return new Set([concept.heroPhoto, ...(cinematic ? concept.placements.map((p) => p.photo) : [])]);
}
