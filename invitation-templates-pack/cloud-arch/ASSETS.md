# Cloud Arch · קשת לבנה (`cloud-arch`)

מינימליזם שקט בלבן של גלריה — כרטיס בקשת רכה, שוליים קרועים ביד, חותם מובלט וקווים דקים כחוט. מאופק, אוורירי ומדויק.

Hushed gallery-white minimalism — an arch-topped card, a hand-torn deckle edge, an embossed roundel and hairline rules. Restrained, airy and precise.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: wedding, engagement, corporate

Look: White cotton paper, soft shadow, blind embossing. No colour but a touch of bronze. / נייר כותנה לבן, צל רך, הבלטה עיוורת. בלי צבע מלבד ברונזה עדינה.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/cloud-arch.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Upload them to the Supabase Storage bucket `template-media`, folder `cloud-arch/`, then run `npm run media:sync` (docs/template-media.md). Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `deckle-band.webp` | transparent WebP ≤120KB | template:deckle-band |
| [ ] `arch-panorama.webp` | transparent WebP ≤120KB | template:arch-panorama |
| [ ] `paper-leaf.webp` | transparent WebP ≤120KB | template:paper-leaf |
| [ ] `roundel.webp` | transparent WebP ≤120KB | template:roundel |
| [ ] `arch-mark.webp` | transparent WebP ≤120KB | template:arch-mark |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
