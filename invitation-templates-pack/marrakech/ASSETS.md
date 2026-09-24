# Marrakech Henna · מרקש (`marrakech`) · premium

ליל חינה מרוקאי — קשת בצורת חור מנעול, כוכב זליג׳ בן שמונה קצוות, חמסה מנוקדת, פנסי נחושת מחוררים ורימונים, על ירוק אמרלד וזהב.

A Moroccan henna night — a keyhole arch, an eight-point zellige star, a dotted hamsa, pierced brass lanterns and pomegranates on emerald and gold.

Cover: `gatefold` · overlay `medallion` · exit `lift` · categories: henna, engagement

Look: A Marrakech riad at night: green zellige, pierced brass, warm candlelight, gold. / ריאד במרקש בלילה: אריחי זליג׳ ירוקים, נחושת מחוררת, אור נרות חם, זהב.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/marrakech.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `marrakech/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `zellige-band.webp` | transparent WebP ≤120KB | template:zellige-band |
| [ ] `keyhole-panorama.webp` | transparent WebP ≤120KB | template:keyhole-panorama |
| [ ] `lanterns.webp` | transparent WebP ≤120KB | template:lanterns |
| [ ] `pomegranates.webp` | transparent WebP ≤120KB | template:pomegranates |
| [ ] `hamsa.webp` | transparent WebP ≤120KB | template:hamsa |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
