import { createContext, useContext } from 'react';
import { spokenAt, type SegmentTiming } from './schedule';

export const SegmentContext = createContext<SegmentTiming | null>(null);

/**
 * The current scene's timing, in frames local to the scene: its length, the narration window, the
 * sentences, and `spoken(word)`: when a word of the narration is heard. New scenes time their beats with
 * these, so they follow the voice when the real audio (and so the length) changes.
 */
export function useSegment() {
  const seg = useContext(SegmentContext);
  if (!seg) throw new Error('useSegment() outside a tour scene');
  return {
    seg,
    dur: seg.dur,
    /** a point of the narration: 0 = the voice starts, 1 = it ends */
    at: (fraction: number) => Math.round(seg.narrFrom + fraction * seg.narrFrames),
    spoken: (needle: string, offset = 0) => spokenAt(seg, needle, offset),
    /** the i-th sentence's start, local */
    sentence: (i: number) => seg.sentences[Math.min(i, seg.sentences.length - 1)].from - seg.start,
  };
}
