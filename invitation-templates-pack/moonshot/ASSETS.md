# Moonshot (טיסה לירח) — the film's pictures

A scroll scene (renderer/scene): the invitation is one film over a pinned backdrop, and these five
pictures are that backdrop. Each one belongs to the section that brings it
(`sectionDefaults.presentation` in `manifest.json`: its `media`, the picture's slow zoom `kenBurns`
and its `drift`); a section without a picture of its own keeps the one before it. The next picture
cross-fades in as its section's top crosses the middle of the screen.

| Key | File | Section | What it shows |
| --- | --- | --- | --- |
| `scene-pad` | `scene-pad.webp` | the first screen (the names) — also around the phone frame on a computer, blurred | The launch pad |
| `scene-clouds` | `scene-clouds.webp` | the opening words (and the parents after them) | Through the clouds |
| `scene-orbit` | `scene-orbit.webp` | the date (the countdown pins itself over it) | Above the Earth |
| `scene-stars` | `scene-stars.webp` | the venue (and the evening's order after it) | Deep space |
| `scene-moon` | `scene-moon.webp` | the RSVP (and the gifts and the end after it) | To the moon |

**Shape:** 9:16 portrait, at least 1080×1920 (the renderer serves each at the screen's width as AVIF
or WebP). **Tone:** one palette across all five, and a calm middle: the texts are white, over a
gradient in the design's shade (`scene.shade`, #070A1E) that is darker at the top and the
bottom, so no picture should be busy in the middle band. Consecutive pictures cross-fade into each
other: the same light, the same horizon height, and they read as one film. No writing, logos or
people.

**The prop.** The app draws the rocket itself: it lifts off at the bottom centre, flies up through all five pictures and lands on a moon it draws in the upper middle at the end. So no picture shows a rocket or a moon; the first keeps the bottom centre clear (the pad only) and the last keeps its upper middle dark and calm.

## Until the real pictures arrive

`node scripts/scene-art/moonshot.mjs` paints the five as illustrations (seeded: every run gives the same
files) into `public/templates/moonshot/` and lists them in
`src/features/invitations/templates/placeholder-media.json`.

## Swapping in the real pictures

1. Upload them to the Supabase bucket `template-media`, folder `moonshot/`, under the file names above
   (docs/template-media.md).
2. `npm run media:sync` (a file in the bucket wins over its placeholder), commit, deploy: the seed
   re-publishes the demos with them.
