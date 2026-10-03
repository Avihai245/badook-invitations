import '@fontsource/heebo/400.css';
import '@fontsource/heebo/600.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import { continueRender, delayRender } from 'remotion';

/** Hold every frame until Heebo (Hebrew + Latin subsets, all four weights) has loaded. */
const handle = delayRender('Loading Heebo');
const sample = 'אבגדה Badook 0123 ₪·&';
Promise.all([400, 600, 700, 800].map((w) => document.fonts.load(`${w} 48px Heebo`, sample)))
  .then(() => document.fonts.ready)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    continueRender(handle);
  });
