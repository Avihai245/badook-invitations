# Klaf · קלף (`klaf`) · premium

קלף, דיו של נוצה וקריאה בתורה — מגילה על שני עצי חיים, יד מכסף, פס טלית בכחול ונוצת סופר. חגיגי, עמוק ומרגש.

Parchment, quill ink and the Torah reading — a scroll on twin wooden rollers, a silver yad, a band of tallit stripes and a scribe’s quill. Festive, deep and moving.

Cover: `ribbon` · overlay `wax_seal` · exit `crack` · categories: bar_mitzvah, bat_mitzvah

Look: Real parchment in window light, polished wood, antique silver, tallit stripes — no crowns. / קלף אמיתי בתאורת חלון, עץ מלוטש, כסף עתיק, פסי טלית — בלי כתרים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/klaf.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/klaf/`. Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `tallit-band.webp` | transparent WebP ≤120KB | template:tallit-band |
| [ ] `jerusalem-panorama.webp` | transparent WebP ≤120KB | template:jerusalem-panorama |
| [ ] `quill.webp` | transparent WebP ≤120KB | template:quill |
| [ ] `yad.webp` | transparent WebP ≤120KB | template:yad |
| [ ] `torah-scroll.webp` | transparent WebP ≤120KB | template:torah-scroll |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
