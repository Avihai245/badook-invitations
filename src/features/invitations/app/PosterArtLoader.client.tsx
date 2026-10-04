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

let fontsAt: string | null = null;
let fontRules: Promise<Record<string, string>> | null = null;
const fontsAdded = new Set<string>();

/** A poster's families (`data-poster-fonts`): their @font-face rules, once each, into one sheet. */
async function addFonts(families: string[]) {
  if (!fontsAt) return;
  fontRules ??= fetchText(fontsAt).then((t) => (t ? (JSON.parse(t) as Record<string, string>) : {}));
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

function load(poster: HTMLElement) {
  const families = poster.dataset.posterFonts;
  if (families) void addFonts(families.split(','));
  const src = poster.dataset.poster;
  if (!src || poster.childElementCount) return;
  void fetchText(src).then((html) => {
    // markup this build drew from the app's own templates (a same-origin static file)
    if (html && !poster.childElementCount) poster.innerHTML = html;
  });
}

let observer: IntersectionObserver | null = null;

/**
 * Watches the posters under `root` (`[data-poster]`, LazyTemplatePoster): as each comes within a
 * screen of view it gets its fonts' rules and its pre-rendered contents. The page's own are found by
 * PosterArtLoader; a block added later (the home page's other designs) calls this for what it adds.
 */
export function observePosters(root: ParentNode) {
  const posters = root.querySelectorAll<HTMLElement>('[data-poster]');
  if (typeof IntersectionObserver === 'undefined') {
    posters.forEach(load);
    return;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        load(entry.target as HTMLElement);
      }
    },
    { rootMargin: '100% 0px' },
  );
  posters.forEach((el) => observer?.observe(el));
}

/**
 * The lazy posters' loader (LazyTemplatePoster, app/poster-art.ts): once per page that shows such
 * posters; the posters present at load are watched here.
 */
export function PosterArtLoader({ fontsUrl }: { fontsUrl: string | null }) {
  useEffect(() => {
    fontsAt = fontsUrl;
    observePosters(document);
    return () => {
      observer?.disconnect();
      observer = null;
    };
  }, [fontsUrl]);
  return null;
}
