# Unicorn Dream · חד־קרן (`unicorn-dream`)

שמיים בצבעי סוכריות — קשת בענן פסטלית, עננים רכים, נצנצים וכוכבים, בלונים ולבבות, וחד־קרן עם רעמה בכל צבעי הקשת וקרן זהב נוצצת. קסם ורוד ומתוק.

A candy-coloured sky — a pastel rainbow, soft clouds, sparkles and stars, balloons and hearts, and a unicorn with a rainbow mane and a glittering golden horn. Sweet pink magic.

Cover: `ribbon` · overlay `wax_seal` · exit `crack` · categories: birthday, bat_mitzvah

Look: A dreamy pastel sky (lavender to pink to peach), a soft pastel rainbow, fluffy clouds, glitter and gold stars, a white unicorn with a rainbow mane and a golden horn — sweet and sparkly, candy colours, soft glow. / שמיים חלומיים בפסטל (לבנדר, ורוד, אפרסק), קשת בענן רכה, עננים תפוחים, נצנצים וכוכבי זהב, חד־קרן לבן עם רעמה בצבעי הקשת וקרן זהב — מתוק ונוצץ, צבעי סוכריות, זוהר רך.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/unicorn-dream.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `unicorn-dream/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `star-seal-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `cloud-band.webp` | transparent WebP ≤120KB | template:cloud-band |
| [ ] `rainbow-panorama.webp` | transparent WebP ≤120KB | template:rainbow-panorama |
| [ ] `unicorn.webp` | transparent WebP ≤120KB | template:unicorn |
| [ ] `balloons.webp` | transparent WebP ≤120KB | template:balloons |
| [ ] `rainbow.webp` | transparent WebP ≤120KB | template:rainbow |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
