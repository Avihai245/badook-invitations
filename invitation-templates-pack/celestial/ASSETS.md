# Celestial (שער השמיים) — the film's pictures

A scroll scene (renderer/scene): the invitation is one film over a pinned backdrop, and these
pictures are that backdrop — a journey from a gate among the clouds, up above them and down to the
venue. Each one belongs to the section that brings it (`sectionDefaults.presentation` in
`manifest.json`: its `media`, the picture's slow zoom `kenBurns` and its `drift`); a section without
a picture of its own keeps the one before it. The next picture cross-fades in as its section's top
crosses the middle of the screen.

| Key | File | Section | What it should show |
| --- | --- | --- | --- |
| `scene-gate` | `scene-gate.webp` | the first screen (the names) — also around the phone frame on a computer, blurred | a closed gate (or an arch, a doorway) in a blue sky, its foot in cloud; calm in the middle for the names |
| `scene-threshold` | `scene-threshold.webp` | the opening words | the same place, open, light pouring through |
| `scene-ascent` | `scene-ascent.webp` | the parents | rising into the clouds: cumulus towers, the sky clearing above |
| `scene-above` | `scene-above.webp` | the date (the countdown pins itself over it) | above the clouds: a sea of cloud to the horizon, quiet in the middle |
| `scene-descent` | `scene-descent.webp` | the venue | down through the clouds: the land appearing below |
| `scene-venue` | `scene-venue.webp` | the evening's order | the venue itself — its garden, its building |
| `scene-garden` | `scene-garden.webp` | the RSVP | the ceremony's place: the chuppah or the arch, flowers |
| `scene-dusk` | `scene-dusk.webp` | the gifts and the end | the evening sky over the venue, the first stars |

**Shape:** 9:16 portrait, at least 1080×1920 (the renderer serves each at the screen's width as AVIF
or WebP). **Tone:** one palette across all eight — sky blue, white, cream, a touch of champagne gold
— and light mid-tones: the texts are white, over a navy gradient that is darker at the top and the
bottom (`scene.shade`), so no picture should be dark or busy in the middle. Consecutive pictures
cross-fade into each other: the same light, the same horizon height, and they read as one film.

## Until the real pictures arrive

`node scripts/make-scene-placeholders.mjs` paints the eight as illustrations (seeded: every run gives
the same files) into `public/templates/celestial/` and lists them in
`src/features/invitations/templates/placeholder-media.json`.

## Swapping in the real pictures

1. Upload them to the Supabase bucket `template-media`, folder `celestial/`, under the file names
   above (docs/template-media.md).
2. `npm run media:sync` (a file in the bucket wins over its placeholder), commit, deploy: the seed
   re-publishes the demos with them.
