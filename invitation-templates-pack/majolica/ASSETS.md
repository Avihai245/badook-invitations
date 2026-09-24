# Majolica Summer · מיוליקה (`majolica`)

קיץ על חוף אמלפי — אריחי מיוליקה בכחול קובלט, לימונים עם עלים, פרוסות הדרים וגגון מפוספס עם שוליים מסולסלים.

Summer on the Amalfi coast — cobalt majolica tiles, lemons with their leaves, citrus slices and a striped awning with a scalloped edge.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: wedding, engagement, baby_shower, other

Look: Hand-painted ceramic tiles, lemons with glossy leaves, bright seaside midday. / אריחי קרמיקה מצוירים ביד, לימונים עם עלים מבריקים, צהריים בהירים ליד הים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/majolica.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/majolica/`. Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `seal-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `tile-band.webp` | transparent WebP ≤120KB | template:tile-band |
| [ ] `coast-panorama.webp` | transparent WebP ≤120KB | template:coast-panorama |
| [ ] `lemon-branch.webp` | transparent WebP ≤120KB | template:lemon-branch |
| [ ] `citrus-slices.webp` | transparent WebP ≤120KB | template:citrus-slices |
| [ ] `lemon.webp` | transparent WebP ≤120KB | template:lemon |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
