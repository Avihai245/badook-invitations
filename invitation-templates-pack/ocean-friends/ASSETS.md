# Ocean Friends · מתחת לים (`ocean-friends`)

צוללים לחגוג — לוויתן מחייך שנושף בועות, מדוזה מרחפת, דגים צבעוניים, אצות מתנועעות, צדפים, סרטן חמוד ותיבת אוצר נוצצת על החול. עולם תת־ימי לקטנטנים.

Dive in to celebrate — a smiling whale blowing bubbles, a floating jellyfish, colourful fish, swaying seaweed, shells, a friendly crab and a sparkling treasure chest on the sand. An undersea world for little ones.

Cover: `pouch` · overlay `medallion` · exit `lift` · categories: birthday, baby_shower, brit

Look: A bright, shallow sea in aqua and turquoise, sunbeams slanting down from the surface, round friendly sea creatures (a blue whale, a pink jellyfish, coral-coloured fish), sand, shells and a treasure chest — soft and luminous, never dark or deep. / ים רדוד ובהיר בגווני אקווה וטורקיז, קרני שמש שיורדות מפני המים, יצורים ימיים עגלגלים וידידותיים (לוויתן כחול, מדוזה ורודה, דגים בצבע אלמוג), חול, צדפים ותיבת אוצר — רך ומואר, אף פעם לא כהה או עמוק.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/ocean-friends.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `ocean-friends/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `coin-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `wave-band.webp` | transparent WebP ≤120KB | template:wave-band |
| [ ] `reef-panorama.webp` | transparent WebP ≤120KB | template:reef-panorama |
| [ ] `whale.webp` | transparent WebP ≤120KB | template:whale |
| [ ] `shell.webp` | transparent WebP ≤120KB | template:shell |
| [ ] `treasure.webp` | transparent WebP ≤120KB | template:treasure |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
