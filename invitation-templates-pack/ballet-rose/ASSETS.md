# Ballet Rose · בלט (`ballet-rose`) · premium

במה קטנה רגע לפני ההופעה — וילונות קטיפה ורודים עם חבלי זהב וציציות, זרקור חמים על רקע ורדרד, נעלי בלט תלויות בסרטים, טוטו על קולב, זר ורדים על הבמה ועלי כותרת שנושרים.

A little theatre just before the show — rose velvet curtains tied back with gold ropes and tassels, a warm spotlight on a blush backdrop, pointe shoes hanging by their ribbons, a tutu on a satin hanger, roses thrown on the stage and petals drifting down.

Cover: `ribbon` · overlay `wax_seal` · exit `crack` · categories: bat_mitzvah, birthday

Look: A jewel-box theatre in soft focus: deep rose velvet, antique gold, blush light and satin; pointe shoes swaying on their ribbons, petals falling through the spotlight. / תיאטרון קטן כמו קופסת תכשיטים בפוקוס רך: קטיפה ורודה עמוקה, זהב עתיק, אור ורדרד וסאטן; נעלי בלט מתנדנדות על הסרטים, עלי כותרת נושרים דרך הזרקור.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/ballet-rose.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `ballet-rose/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `fringe-band.webp` | transparent WebP ≤120KB | template:fringe-band |
| [ ] `stage-panorama.webp` | transparent WebP ≤120KB | template:stage-panorama |
| [ ] `slippers.webp` | transparent WebP ≤120KB | template:slippers |
| [ ] `tutu.webp` | transparent WebP ≤120KB | template:tutu |
| [ ] `roses.webp` | transparent WebP ≤120KB | template:roses |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
