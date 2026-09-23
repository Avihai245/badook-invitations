'use client';

import { useEffect } from 'react';

/**
 * Safety net for the CSS auto-fit of hero/footer names: once fonts are loaded, any name word that
 * still overflows its line is scaled down to fit (never up). Runs again on resize.
 */
export function FitNames() {
  useEffect(() => {
    const fit = () => {
      document.querySelectorAll<HTMLElement>('.names .n, .f-names').forEach((el) => {
        el.style.removeProperty('font-size');
        const overflow = el.scrollWidth - el.clientWidth;
        if (overflow > 1 && el.clientWidth > 0) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          el.style.fontSize = `${Math.floor(size * (el.clientWidth / el.scrollWidth) * 0.98)}px`;
        }
      });
    };
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    };
    document.fonts.ready.then(fit);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return null;
}
