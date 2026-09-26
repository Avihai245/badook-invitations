# Vineyard Harvest · בציר (`vineyard-harvest`) · premium

שעת זהב בכרם, מבט מתחת לפרגולה — שורות גפנים עד האופק, ברושים ובית אבן, אשכולות ענבים ועלי גפן שמתחילים להזהיב, שתי כוסות יין על חבית עץ וגחליליות באוויר החם.

Golden hour in the vineyard, seen from under a pergola — vine rows to the horizon, cypresses and a stone farmhouse, grape clusters and vine leaves turning gold, two glasses of wine on an oak barrel and fireflies in the warm air.

Cover: `ribbon` · overlay `wax_seal` · exit `crack` · categories: birthday, wedding, engagement, corporate

Look: A late-summer vineyard at golden hour: low honey light, hazy hills, olive greens, oak and deep red wine. / כרם בסוף הקיץ בשעת זהב: אור דבש נמוך, גבעות מעורפלות, ירוק זית, עץ אלון ויין אדום עמוק.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/vineyard-harvest.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `vineyard-harvest/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `vine-band.webp` | transparent WebP ≤120KB | template:vine-band |
| [ ] `vineyard-panorama.webp` | transparent WebP ≤120KB | template:vineyard-panorama |
| [ ] `grapes.webp` | transparent WebP ≤120KB | template:grapes |
| [ ] `wine-glasses.webp` | transparent WebP ≤120KB | template:wine-glasses |
| [ ] `barrel.webp` | transparent WebP ≤120KB | template:barrel |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
