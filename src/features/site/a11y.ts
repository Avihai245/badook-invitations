/**
 * The accessibility menu's settings (AccessibilityMenu.client.tsx): each is a `data-a11y-*` attribute
 * on <html> (site.css styles them), kept in localStorage. Shared with the server layout, which puts
 * A11Y_BOOT in <head> so they apply before the first paint.
 */
export type A11yToggle = 'contrast' | 'links' | 'readable' | 'spacing' | 'motion' | 'cursor';
export interface A11yPrefs {
  text: 0 | 1 | 2 | 3;
  contrast: boolean;
  links: boolean;
  readable: boolean;
  spacing: boolean;
  motion: boolean;
  cursor: boolean;
}

export const A11Y_KEY = 'badook:a11y';
export const A11Y_EMPTY: A11yPrefs = {
  text: 0,
  contrast: false,
  links: false,
  readable: false,
  spacing: false,
  motion: false,
  cursor: false,
};
export const A11Y_TOGGLES: A11yToggle[] = ['contrast', 'links', 'readable', 'spacing', 'motion', 'cursor'];

/** "contrast" → the dataset key "a11yContrast" (data-a11y-contrast). */
export const a11yAttr = (k: A11yToggle) => `a11y${k[0]!.toUpperCase()}${k.slice(1)}`;

/** Runs in <head> before the page paints: the visitor's settings from the last visit. */
export const A11Y_BOOT = `try{var p=JSON.parse(localStorage.getItem('${A11Y_KEY}')||'{}'),d=document.documentElement;if(p.text)d.dataset.a11yText=String(p.text);${A11Y_TOGGLES.map((k) => `if(p.${k})d.dataset.${a11yAttr(k)}='';`).join('')}}catch(e){}`;
