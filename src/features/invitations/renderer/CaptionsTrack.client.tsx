'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A video's captions in the page's language (lib/captions): the WebVTT the document carries, given to
 * the <video> as its <track kind="captions">, shown. The words come with the page (an address of this
 * page's own, made in the browser) — nothing else is fetched.
 */
export function CaptionsTrack({ vtt, lang, label }: { vtt: string; lang: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLTrackElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [vtt]);
  useEffect(() => {
    // a track added after the video: shown (the `default` choice is made when the video loads)
    if (src && ref.current?.track) ref.current.track.mode = 'showing';
  }, [src]);
  return src ? <track ref={ref} kind="captions" src={src} srcLang={lang} label={label} default /> : null;
}
