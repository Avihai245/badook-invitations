# First Tefillin (התפילין הראשונות) — the film's pictures

A scroll scene (renderer/scene): the invitation is one film over a pinned backdrop, and these five
pictures are that backdrop. Each one belongs to the section that brings it
(`sectionDefaults.presentation` in `manifest.json`: its `media`, the picture's slow zoom `kenBurns`
and its `drift`); a section without a picture of its own keeps the one before it. The next picture
cross-fades in as its section's top crosses the middle of the screen.

| Key | File | Section | What it shows |
| --- | --- | --- | --- |
| `scene-table` | `scene-table.webp` | the first screen (the names) — also around the phone frame on a computer, blurred; the app draws the tefillin in their velvet bag on it, at the lower left | Morning at home |
| `scene-shul` | `scene-shul.webp` | the opening words (and the parents after them) | The synagogue |
| `scene-torah` | `scene-torah.webp` | the tefillin verse (and the date after it: the countdown pins itself over it) | The Torah scroll |
| `scene-city` | `scene-city.webp` | the venue (and the evening's order after it) | Jerusalem at sunrise |
| `scene-dawn` | `scene-dawn.webp` | the RSVP, the gifts and the end — then the film's last screen, where the app draws the boy | Dawn light |

**Shape:** 9:16 portrait, at least 1080×1920 (the renderer serves each at the screen's width as AVIF
or WebP). **Tone:** one palette across all five — Jerusalem stone cream, warm gold, deep navy, a touch
of velvet burgundy, soft sky blue and dawn peach — and a calm middle: the texts are white, over a
gradient in the design's shade (`scene.shade`, #182238) that is darker at the top and the bottom,
so no picture should be busy in the middle band. Consecutive pictures cross-fade into each other: the
same light, the same horizon height, and they read as one film. No writing (not on books, curtains,
walls or the Torah's mantle), logos or people.

**The prop.** The app draws the head tefillin itself, and the story around them: on the first picture
their velvet bag stands on the table at the lower left (about 5–40% across, 72–95% down), and the box
rises out of it; it floats through all five pictures, and on the film's last screen — after the last
text, over `scene-dawn` — the bar mitzvah boy comes into the light from the shoulders up (his head about
45–67% down) and the tefillin come down onto his head, the straps wrapping around it. So no picture
shows tefillin, a tefillin bag, people or hands; `scene-table` keeps its lower left a plain, calm
tabletop, and `scene-dawn` is a soft, luminous dawn with its glow behind where his head will be and
nothing sharp in its lower 60%.

**The gallery's poster.** `preview.webp` (the manifest's `previewImage`) is the film's last shot — the
boy in the dawn light with the tefillin on — rendered by the app itself from the design's demo:
`node scripts/scene-art/first-tefillin-preview.mjs <base url>` (a running app with the dev routes on).
Render it again after replacing `scene-dawn`.

## Until the real pictures arrive

`node scripts/scene-art/first-tefillin.mjs` paints the five as illustrations (seeded: every run gives the
same files) into `public/templates/first-tefillin/` and lists them in
`src/features/invitations/templates/placeholder-media.json`.

## Swapping in the real pictures

1. Upload them to the Supabase bucket `template-media`, folder `first-tefillin/`, under the file names above
   (docs/template-media.md).
2. `npm run media:sync` (a file in the bucket wins over its placeholder), commit, deploy: the seed
   re-publishes the demos with them.
