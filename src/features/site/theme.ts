/**
 * The system's look — light, dark, or as the device is set — chosen in the app (the sidebar, or the
 * account menu on phones), kept in this browser (localStorage) and applied as `data-theme` on <html>
 * (app.css holds the dark tokens). Only the signed-in system follows it: /app — the app, the editor and
 * the admin console. The public pages (home, sign-in, legal) keep their own design, and the guests'
 * pages (invitations, galleries, the event day) never load this at all.
 */

export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'badook:theme';
export const THEME_PREFS: readonly ThemePref[] = ['light', 'dark', 'system'];
/** Fired on window when this tab changes the choice (every switch on the page follows it). */
export const THEME_EVENT = 'badook:theme';

export const isThemePref = (v: unknown): v is ThemePref =>
  typeof v === 'string' && (THEME_PREFS as readonly string[]).includes(v);

/** Whether a path is part of the system that follows the choice. */
export const followsTheme = (path: string) => path === '/app' || path.startsWith('/app/');

/**
 * Runs in <head> before the page paints (and again on every navigation, ThemeSync): the choice from
 * the last visit, the device's setting for "system", light outside /app.
 */
export const THEME_BOOT = `try{var d=document.documentElement,p=localStorage.getItem('${THEME_KEY}'),l=location.pathname,a=l==='/app'||l.indexOf('/app/')===0,t=a&&(p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light';d.dataset.theme=t;d.style.colorScheme=t}catch(e){}`;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemePref(v) ? v : 'light';
  } catch {
    return 'light';
  }
}

/** The look a page shows for a choice (on the server, and for "system" without a device: light). */
export function resolveTheme(pref: ThemePref, path: string): Theme {
  if (!followsTheme(path)) return 'light';
  if (pref === 'system') {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

/** Puts the look on <html> (and the browser's own controls and scrollbars with it). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function saveThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // not kept in this browser: it still applies until the page closes
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: pref }));
}
