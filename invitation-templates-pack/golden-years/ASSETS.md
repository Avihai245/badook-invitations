# Golden Years · שנים של זהב (`golden-years`) · premium

אלגנטיות על־זמנית על סאטן בצבע שמפניה — זר דפנה מוזהב סביב שתי כוסות שמפניה בהרמה, מסגרת כפולה של רדיד זהב, אורות זהב רכים ונצנוצים. חגיגה חמה, ברורה וקלה לקריאה לימי הולדת עגולים ולחתונות זהב.

Timeless elegance on champagne satin — a gilded laurel wreath around two raised champagne flutes, a double gold-foil frame, soft golden lights and sparkles. A warm, clear, easy-to-read celebration for milestone birthdays and golden anniversaries.

Cover: `gatefold` · overlay `medallion` · exit `lift` · categories: birthday, other

Look: Champagne satin and gold foil: a laurel wreath, champagne flutes, golden bokeh, large dark text in strong contrast. / סאטן שמפניה ורדיד זהב: זר דפנה, כוסות שמפניה, בוקה זהוב, טקסט כהה וגדול בניגודיות גבוהה.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/golden-years.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `golden-years/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `medallion-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `foil-band.webp` | transparent WebP ≤120KB | template:foil-band |
| [ ] `laurel-panorama.webp` | transparent WebP ≤120KB | template:laurel-panorama |
| [ ] `champagne-toast.webp` | transparent WebP ≤120KB | template:champagne-toast |
| [ ] `laurel.webp` | transparent WebP ≤120KB | template:laurel |
| [ ] `medallion-crest.webp` | transparent WebP ≤120KB | template:medallion-crest |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
