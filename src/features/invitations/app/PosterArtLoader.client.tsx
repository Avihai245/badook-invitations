'use client';

import { useEffect } from 'react';

const loaded = new Map<string, Promise<string>>();
const fetchText = (url: string) => {
  let p = loaded.get(url);
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.text() : ''));
    loaded.set(url, p);
    p.catch(() => loaded.delete(url));
  }
  return p;
};

let fontRules: Promise<Record<string, string>> | null = null;
const fontsAdded = new Set<string>();

/** A poster's families (`data-poster-fonts`): their @font-face rules, once each, into one sheet. */
async function addFonts(fontsUrl: string, families: string[]) {
  fontRules ??= fetchText(fontsUrl).then((t) => (t ? (JSON.parse(t) as Record<string, string>) : {}));
  const rules = await fontRules;
  const css = families
    .filter((f) => !fontsAdded.has(f) && rules[f])
    .map((f) => (fontsAdded.add(f), rules[f]))
    .join('\n');
  if (!css) return;
  const style = document.createElement('style');
  style.dataset.posterFonts = '';
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * The lazy posters' loader (LazyTemplatePoster, app/poster-art.ts): one observer for the page's
 * posters; as each comes within a screen of view it gets its fonts' rules and its pre-rendered
 * contents. Once per page that shows such posters.
 */
export function PosterArtLoader({ fontsUrl }: { fontsUrl: string | null }) {
  useEffect(() => {
    const posters = document.querySelectorAll<HTMLElement>('[data-poster]');
    if (!posters.length) return;
    const load = (poster: HTMLElement) => {
      const families = poster.dataset.posterFonts;
      if (fontsUrl && families) void addFonts(fontsUrl, families.split(','));
      const src = poster.dataset.poster;
      if (!src || poster.childElementCount) return;
      void fetchText(src).then((html) => {
        // markup this build drew from the app's own templates (a same-origin static file)
        if (html && !poster.childElementCount) poster.innerHTML = html;
      });
    };
    if (typeof IntersectionObserver === 'undefined') {
      posters.forEach(load);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          load(entry.target as HTMLElement);
        }
      },
      { rootMargin: '100% 0px' },
    );
    posters.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [fontsUrl]);
  return null;
}
