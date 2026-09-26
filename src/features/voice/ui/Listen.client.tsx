'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/features/invitations/ui/Icon';

/** One language of the invitation read aloud (features/voice): the audio, or the words for the device. */
export interface ListenTrack {
  src: string | null;
  text: string;
  /** BCP 47 */
  lang: string;
}

export interface ListenProps {
  track: ListenTrack;
  listenLabel: string;
  stopLabel: string;
}

/** The invitation's music says it starts; listening says it starts (each stops the other). */
export const LISTEN_EVENT = 'invitation:listen';
export const MUSIC_EVENT = 'invitation:music';

/** A voice of the device for the language ('he-IL' → a Hebrew voice; old Androids say 'iw'). */
function deviceVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const want = lang.toLowerCase();
  const base = want.split('-')[0]!;
  const alias = base === 'he' ? 'iw' : base;
  const voices = window.speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  return (
    voices.find((v) => norm(v) === want) ??
    voices.find((v) => norm(v).split('-')[0] === base || norm(v).split('-')[0] === alias) ??
    null
  );
}

/**
 * "Listen" on the guest's page (feature `voice`): the invitation read aloud in the page's language —
 * the audio made when it was published, or, until there is one, the device's own voice for the
 * language; with neither, nothing shows. Starting it pauses the music (and the music, started again,
 * stops it); leaving the page stops it. Nothing about the guest is kept or sent.
 */
export function ListenButton({ track, listenLabel, stopLabel }: ListenProps) {
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const speaking = useRef(false);

  // the device's voice, when there's no audio (voices arrive late on some browsers)
  useEffect(() => {
    if (track.src || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const pick = () => setVoice(deviceVoice(track.lang));
    pick();
    window.speechSynthesis.addEventListener?.('voiceschanged', pick);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', pick);
  }, [track.src, track.lang]);

  const stop = useCallback(() => {
    audio.current?.pause();
    if (speaking.current && typeof window !== 'undefined' && 'speechSynthesis' in window)
      window.speechSynthesis.cancel();
    speaking.current = false;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    window.dispatchEvent(new CustomEvent(LISTEN_EVENT));
    const a = audio.current;
    if (track.src && a) {
      try {
        if (a.ended) a.currentTime = 0;
      } catch {
        // it starts where it is
      }
      setPlaying(true);
      a.play()?.catch(() => {
        setPlaying(false);
        setFailed(true);
      });
      return;
    }
    const v = voice ?? deviceVoice(track.lang);
    if (!v) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    // a paragraph at a time: some browsers stop a long utterance midway
    const parts = track.text.split(/\n{2,}/).filter((p) => p.trim());
    speaking.current = true;
    setPlaying(true);
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = v.lang;
      u.voice = v;
      u.rate = 0.95;
      if (i === parts.length - 1) {
        u.onend = () => {
          speaking.current = false;
          setPlaying(false);
        };
      }
      u.onerror = () => {
        speaking.current = false;
        setPlaying(false);
      };
      synth.speak(u);
    });
  }, [track, voice]);

  // the music started: this stops; another language: this stops; the page hidden: this stops
  useEffect(() => {
    window.addEventListener(MUSIC_EVENT, stop);
    const onHidden = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener(MUSIC_EVENT, stop);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [stop]);
  useEffect(() => stop, [track, stop]);

  const available = !!track.src ? !failed : !!voice;
  if (!available) return null;
  return (
    <>
      {track.src ? (
        <audio
          ref={audio}
          src={track.src}
          preload="none"
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            setFailed(true);
          }}
        />
      ) : null}
      <button
        className="fab fab-listen"
        type="button"
        aria-pressed={playing}
        aria-label={playing ? stopLabel : listenLabel}
        title={playing ? stopLabel : listenLabel}
        data-source={track.src ? 'audio' : 'device'}
        data-testid="listen"
        onClick={() => (playing ? stop() : start())}
      >
        <Icon name={playing ? 'square' : 'headphones'} size={playing ? 16 : 20} />
      </button>
    </>
  );
}
