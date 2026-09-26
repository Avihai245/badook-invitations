'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BeatAnalysis } from '../beats';
import { analyzeTrack, decodeTrack } from '../client/audio';
import { FILM } from '../config';

/**
 * The film's music, read on this device: the invitation's song (fetched from its address) or a file
 * the host picks (never uploaded) — decoded, then its beat read. Each source is read once per page.
 */

export type MusicSource = 'invitation' | 'upload' | 'none';

export type TrackState =
  | { status: 'idle' }
  | { status: 'reading'; source: MusicSource }
  | { status: 'ready'; source: MusicSource; buffer: AudioBuffer; analysis: BeatAnalysis; name: string | null }
  | { status: 'failed'; source: MusicSource; reason: 'decode' | 'size' | 'fetch' };

interface Read {
  buffer: AudioBuffer;
  analysis: BeatAnalysis;
  name: string | null;
}

async function read(bytes: ArrayBuffer, name: string | null): Promise<Read> {
  const buffer = await decodeTrack(bytes);
  const analysis = await analyzeTrack(buffer);
  return { buffer, analysis, name };
}

export function useFilmTrack(source: MusicSource, invitationUrl: string | null) {
  const [state, setState] = useState<TrackState>({ status: 'idle' });
  const cache = useRef<{ invitation?: Read; upload?: Read }>({});
  const generation = useRef(0);

  useEffect(() => {
    const run = ++generation.current;
    const cached = source === 'none' ? undefined : cache.current[source];
    if (source === 'none') return setState({ status: 'idle' });
    if (cached) return setState({ status: 'ready', source, ...cached });
    if (source === 'upload') return setState({ status: 'idle' });
    if (!invitationUrl) return setState({ status: 'failed', source, reason: 'fetch' });
    setState({ status: 'reading', source });
    void (async () => {
      let bytes: ArrayBuffer;
      try {
        const res = await fetch(invitationUrl.split('#')[0]!, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(String(res.status));
        bytes = await res.arrayBuffer();
      } catch {
        if (run === generation.current) setState({ status: 'failed', source, reason: 'fetch' });
        return;
      }
      try {
        const done = await read(bytes, null);
        cache.current.invitation = done;
        if (run === generation.current) setState({ status: 'ready', source, ...done });
      } catch {
        if (run === generation.current) setState({ status: 'failed', source, reason: 'decode' });
      }
    })();
  }, [source, invitationUrl]);

  /** A file the host picked (it stays on this device). */
  const pick = useCallback(async (file: File) => {
    const run = ++generation.current;
    if (file.size > FILM.audio.uploadBytes)
      return setState({ status: 'failed', source: 'upload', reason: 'size' });
    setState({ status: 'reading', source: 'upload' });
    try {
      const done = await read(await file.arrayBuffer(), file.name);
      cache.current.upload = done;
      if (run === generation.current) setState({ status: 'ready', source: 'upload', ...done });
    } catch {
      if (run === generation.current) setState({ status: 'failed', source: 'upload', reason: 'decode' });
    }
  }, []);

  return { state, pick };
}
