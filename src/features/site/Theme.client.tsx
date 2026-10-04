'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Segmented } from '@/components/app/Segmented';
import { useUi } from '@/lib/i18n/client';
import {
  applyTheme,
  isThemePref,
  readThemePref,
  resolveTheme,
  saveThemePref,
  THEME_EVENT,
  THEME_KEY,
  type ThemePref,
} from './theme';

/** The chosen look, kept in step with every switch on the page and the browser's other tabs. */
export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  // "light" until mounted: the server doesn't know the choice (the page itself already shows it —
  // THEME_BOOT ran before the first paint)
  const [pref, setPref] = useState<ThemePref>('light');
  useEffect(() => {
    setPref(readThemePref());
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<unknown>).detail;
      if (isThemePref(next)) setPref(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setPref(readThemePref());
    };
    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const choose = useCallback((next: ThemePref) => {
    setPref(next);
    saveThemePref(next);
  }, []);
  return [pref, choose];
}

/**
 * Keeps <html data-theme> right as the visitor moves around (the public pages stay light), when the
 * choice changes here or in another tab, and — for "as the device" — when the device switches.
 */
export function ThemeSync() {
  const path = usePathname();
  const [pref] = useThemePref();
  useEffect(() => {
    // the choice as stored (the hook's first render is "light" until it has read it)
    const current = () => resolveTheme(readThemePref(), path);
    applyTheme(current());
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onDevice = () => applyTheme(current());
    media.addEventListener('change', onDevice);
    return () => media.removeEventListener('change', onDevice);
  }, [path, pref]);
  return null;
}

/** בהיר | כהה | לפי המכשיר — three icons, each named for screen readers and in a tooltip. */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useUi();
  const s = t.shell.theme;
  const [pref, choose] = useThemePref();
  return (
    <Segmented<ThemePref>
      className={className}
      label={s.label}
      value={pref}
      options={[
        { value: 'light', label: <Sun aria-hidden className="size-4" />, ariaLabel: s.light, title: s.light },
        { value: 'dark', label: <Moon aria-hidden className="size-4" />, ariaLabel: s.dark, title: s.dark },
        {
          value: 'system',
          label: <Monitor aria-hidden className="size-4" />,
          ariaLabel: s.system,
          title: s.system,
        },
      ]}
      onValueChange={choose}
    />
  );
}
