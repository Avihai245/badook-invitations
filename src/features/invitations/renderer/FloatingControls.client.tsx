'use client';

import { useState } from 'react';
import type { Locale } from '../contracts/types';
import { Icon } from '../ui/Icon';

/**
 * Floating music toggle + language pill (§2.2 Global, §9A.4). Both appear once the cover opens
 * (CSS reacts to <html data-opened>). P3 wires real audio and the live, reload-free locale switch.
 */
export function FloatingControls({
  langSwitch,
  music,
}: {
  langSwitch: { href: string; label: string; targetLocale: Locale } | null;
  music: { playLabel: string; pauseLabel: string } | null;
}) {
  const [playing, setPlaying] = useState(true);
  return (
    <>
      {langSwitch ? (
        <a className="fab fab-lang" href={langSwitch.href} hrefLang={langSwitch.targetLocale}>
          <Icon name="languages" size={16} />
          <span lang={langSwitch.targetLocale}>{langSwitch.label}</span>
        </a>
      ) : null}
      {music ? (
        <button
          className="fab fab-music"
          type="button"
          aria-pressed={playing}
          aria-label={playing ? music.pauseLabel : music.playLabel}
          onClick={() => setPlaying((p) => !p)}
        >
          <Icon name={playing ? 'volume-2' : 'volume-x'} size={20} />
        </button>
      ) : null}
    </>
  );
}
