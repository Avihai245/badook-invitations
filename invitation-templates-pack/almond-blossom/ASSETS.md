# Almond Blossom · שקדייה (`almond-blossom`)

הפריחה הראשונה בשמי חורף — ענפי שקדייה כהים, פרחים בחמישה עלי כותרת, ניצנים, עלים נושרים ועיגול דק כמו ירח.

The first bloom against a winter sky — dark almond branches, five-petal blossoms, buds, drifting petals and a thin moon-circle frame.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: wedding, baby_shower, other

Look: An almond tree blooming at Tu BiShvat: dark branches, white-pink flowers, a pale winter sky. / שקדייה פורחת בט״ו בשבט: ענפים כהים, פרחים לבנים־ורודים, שמיים חורפיים בהירים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/almond-blossom.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/almond-blossom/`. Prompts: see invitation-templates-kit-he.md §5.

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
| [ ] `branch-band.webp` | transparent WebP ≤120KB | template:branch-band |
| [ ] `orchard-panorama.webp` | transparent WebP ≤120KB | template:orchard-panorama |
| [ ] `blossom-sprig.webp` | transparent WebP ≤120KB | template:blossom-sprig |
| [ ] `petals.webp` | transparent WebP ≤120KB | template:petals |
| [ ] `blossom.webp` | transparent WebP ≤120KB | template:blossom |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
