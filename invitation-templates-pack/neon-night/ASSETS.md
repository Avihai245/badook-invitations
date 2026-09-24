# Neon Night · ניאון (`neon-night`) · premium

זוהר של אחרי חצות — צינורות ניאון כפולים עם הילה, ברק, שלט לב, מניפות לייזר ורצפת רשת בפרספקטיבה. מסיבה שמתחילה עוד לפני שנכנסים.

An after-dark glow — double-stroke neon tubes with a halo, a lightning bolt, a heart sign, laser fans and a perspective grid floor. The party starts before you walk in.

Cover: `ticket` · overlay `ticket_text` · exit `fade` · categories: bar_mitzvah, bat_mitzvah, birthday, corporate

Look: Real neon signs in the dark, a soft halo, reflections on a glossy floor, light haze. / שלטי ניאון אמיתיים בחושך, הילה רכה, השתקפויות על רצפה מבריקה, עשן קל.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/neon-night.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/neon-night/`. Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `neon-band.webp` | transparent WebP ≤120KB | template:neon-band |
| [ ] `grid-panorama.webp` | transparent WebP ≤120KB | template:grid-panorama |
| [ ] `bolt.webp` | transparent WebP ≤120KB | template:bolt |
| [ ] `heart-sign.webp` | transparent WebP ≤120KB | template:heart-sign |
| [ ] `neon-star.webp` | transparent WebP ≤120KB | template:neon-star |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
