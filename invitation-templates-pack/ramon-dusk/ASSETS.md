# Ramon at Dusk · רמון בשקיעה (`ramon-dusk`)

מעטפת קראפט קשורה בחבל יוטה עם פמפס מיובש ותגית נייר, מכתש בגווני טרקוטה וכוכבים ראשונים. בוהו מדברי, חם ומודרני.

Cover: `envelope_seal` · overlay `tag` · exit `lift` · categories: wedding, engagement, henna

Upload them to the Supabase Storage bucket `template-media`, folder `ramon-dusk/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `tag-blank.png` | 1024×1024 transparent PNG | BLANK, no letters |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `pampas.webp` | transparent WebP ≤120KB | template:pampas |
| [ ] `acacia.webp` | transparent WebP ≤120KB | template:acacia |
| [ ] `ibex.webp` | transparent WebP ≤120KB | template:ibex |
| [ ] `lanterns.webp` | transparent WebP ≤120KB | template:lanterns |
| [ ] `stars-band.webp` | transparent WebP ≤120KB | template:stars-band |
| [ ] `crater-panorama.webp` | transparent WebP ≤120KB | template:crater-panorama |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
