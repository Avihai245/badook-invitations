# Dino Hatch · דינו (`dino-hatch`)

דינוזאורים עגלגלים והר געש — טי־רקס וסטגוזאורוס, ביצה מנוקדת שנסדקת, שרכים, עקבות וענן עשן. יום הולדת פרהיסטורי.

Chunky dinos and a volcano — a T-rex and a stegosaurus, a cracking spotted egg, ferns, footprints and a puff of smoke. A prehistoric birthday.

Cover: `envelope_seal` · overlay `wax_seal` · exit `crack` · categories: birthday

Look: Chunky, colourful dinosaur illustration, a smoking volcano, ferns — cheerful bright colours. / איור דינוזאורים עגלגל וצבעוני, הר געש מעשן, שרכים — צבעים עליזים ובהירים.

Until these files exist the invitation shows its scene (`src/features/invitations/renderer/scenes/dino-hatch.tsx`) — keep the media in the same palette and composition (calm centre for the names).

Put files in `public/templates/dino-hatch/`. Prompts: see invitation-templates-kit-he.md §5.

| file | spec | notes |
|---|---|---|
| [ ] `cover-poster.webp` | 1080×1920 WebP ≤200KB | = first frame of cover-open.mp4 |
| [ ] `cover-open.mp4` | 1080×1920 H.264 2.6–3.4s ≤2.5MB | first 0.5s static |
| [ ] `cover-poster-desktop.webp` | 1920×1080 (optional) | set cover.posterDesktop=null if skipped |
| [ ] `cover-open-desktop.mp4` | 1920×1080 (optional) | set cover.openVideoDesktop=null if skipped |
| [ ] `egg-blank.png` | 1024×1024 transparent PNG | BLANK, no letters · light warm-gray (recolored in code) |
| [ ] `hero.mp4` | 720×1280 H.264 loop ≤4MB | template:hero |
| [ ] `hero-poster.webp` | poster webp | template:hero-poster |
| [ ] `hero-desktop.mp4` | 1920×1080 H.264 loop ≤5MB | template:hero-desktop |
| [ ] `hero-desktop-poster.webp` | poster webp | template:hero-desktop-poster |
| [ ] `fern-band.webp` | transparent WebP ≤120KB | template:fern-band |
| [ ] `volcano-panorama.webp` | transparent WebP ≤120KB | template:volcano-panorama |
| [ ] `egg.webp` | transparent WebP ≤120KB | template:egg |
| [ ] `footprints.webp` | transparent WebP ≤120KB | template:footprints |
| [ ] `dino.webp` | transparent WebP ≤120KB | template:dino |
| [ ] `music.mp3` | MP3 160kbps 90–120s | + LICENSE-music.txt |
| [ ] `preview.webp / preview.mp4` | 780×1688 | generated from the live invitation (Playwright) |
