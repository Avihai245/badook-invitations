# Safari Pals · ספארי (`safari-pals`)

בוקר חמים בסוואנה — גור אריות עם פפיון, ג׳ירפה סקרנית שמציצה, פיל קטן עם בלון, עלי דקל, עשב גבוה ושמש גדולה ומחייכת. לקטנטנים שלנו.

A warm morning on the savanna — a lion cub in a bow tie, a curious giraffe peeking in, a baby elephant with a balloon, palm fronds, tall grass and a big smiling sun. For our littlest ones.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: birthday, brit, baby_shower

Look: Soft, rounded storybook animals (a lion cub, a giraffe, a baby elephant) in tall golden grass, palm fronds in a corner, a big smiling sun — warm apricot morning light, no scary faces. / חיות עגלגלות כמו מספר ילדים (גור אריות, ג׳ירפה, פיל קטן) בעשב זהוב וגבוה, עלי דקל בפינה, שמש גדולה ומחייכת — אור בוקר משמשי וחמים, בלי פרצופים מפחידים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/safari-pals.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `safari-pals/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `paw-seal-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `grass-band.webp` | transparent WebP ≤120KB | template:grass-band |
| [ ] `savanna-panorama.webp` | transparent WebP ≤120KB | template:savanna-panorama |
| [ ] `lion.webp` | transparent WebP ≤120KB | template:lion |
| [ ] `elephant.webp` | transparent WebP ≤120KB | template:elephant |
| [ ] `giraffe.webp` | transparent WebP ≤120KB | template:giraffe |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
