# Midnight Bloom · פריחת לילה (`midnight-bloom`) · premium

דרמה של טבע דומם הולנדי על רקע כמעט שחור — אדמוניות, צבעונים, נוריות ועלים מסתלסלים, עש לילה ומסגרת של רדיד זהב.

Dutch still-life drama on near-black — peonies, tulips, ranunculus and curling leaves, a night moth and a gilded foil frame.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: wedding, engagement, birthday

Look: 17th-century Dutch still life: saturated flowers on deep black, warm side light, gold foil. / טבע דומם הולנדי מהמאה ה־17: פרחים רוויים על שחור עמוק, אור צד חם, רדיד זהב.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/midnight-bloom.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `midnight-bloom/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `foil-band.webp` | transparent WebP ≤120KB | template:foil-band |
| [ ] `bloom-panorama.webp` | transparent WebP ≤120KB | template:bloom-panorama |
| [ ] `tulips.webp` | transparent WebP ≤120KB | template:tulips |
| [ ] `moth.webp` | transparent WebP ≤120KB | template:moth |
| [ ] `peony.webp` | transparent WebP ≤120KB | template:peony |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
