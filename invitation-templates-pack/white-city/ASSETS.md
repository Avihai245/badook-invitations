# White City · העיר הלבנה (`white-city`) · premium

באוהאוס תל אביבי — מרפסות סרט מעוגלות עם קווי צל, חלון מדרגות "מדחום", עמודי פילוטיס, עיגול, ריבוע ומשולש בצבעי יסוד וספרות ענק.

Tel Aviv Bauhaus — rounded ribbon balconies with shadow lines, a thermometer stair window, pilotis, a primary circle, square and triangle, and oversized numerals.

Cover: `envelope_seal` · overlay `wax_seal` · exit `lift` · categories: corporate, wedding, other

Look: White Tel Aviv Bauhaus buildings in strong sun, crisp shadows, touches of primary colour. / בנייני באוהאוס לבנים בתל אביב בשמש חזקה, צללים חדים, נגיעות של צבעי יסוד.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/white-city.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/white-city/`. Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `dot-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `balcony-band.webp` | transparent WebP ≤120KB | template:balcony-band |
| [ ] `boulevard-panorama.webp` | transparent WebP ≤120KB | template:boulevard-panorama |
| [ ] `primary-shapes.webp` | transparent WebP ≤120KB | template:primary-shapes |
| [ ] `stair-window.webp` | transparent WebP ≤120KB | template:stair-window |
| [ ] `bauhaus-mark.webp` | transparent WebP ≤120KB | template:bauhaus-mark |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
