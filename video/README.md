# Badook demo video (Remotion)

A 45-second Hebrew (RTL) marketing/tutorial video, built with [Remotion](https://www.remotion.dev) 4.
It is a self-contained package; it does not touch the app's build.

- `DemoLandscape` 1920×1080 and `DemoPortrait` 1080×1920, 30 fps, 1350 frames, silent, burned-in captions.
- Font: Heebo 400/600/700/800 (`@fontsource/heebo`). Logo: `../public/brand/badook-logo.png` (imported).
- The budget speedometer uses the app's own geometry: `../src/features/planning/model/gauge.ts`.
- All other UI is light look-alike components with demo data in `src/scenes/*` (no Next.js / i18n imports).

## Install

```bash
npm --prefix video install
```

## Preview / edit

```bash
npm --prefix video run studio      # Remotion Studio in the browser
npm --prefix video run stills      # PNG previews of both layouts into video/out/stills
npm --prefix video run typecheck
```

Timing lives in `src/timing.ts`, captions in `src/Demo.tsx`, brand tokens in `src/theme.ts`, layout
(caption column + 1000×1000 stage, adapted for portrait) in `src/Shell.tsx`, one file per scene in
`src/scenes/`.

## Render

```bash
npm --prefix video run render
```

writes into `public/video/`:

| file                       | what                                               |
| -------------------------- | -------------------------------------------------- |
| `badook-demo.mp4`          | landscape, H.264, CRF 28                           |
| `badook-demo.webm`         | landscape, VP9, CRF 40                             |
| `badook-demo-portrait.mp4` | portrait, H.264, CRF 28                            |
| `poster.jpg`               | still of the landscape video at frame 765 (~25.5s) |

Each output also has its own script (`render:mp4`, `render:webm`, `render:portrait`, `render:poster`).
A full render takes a few minutes on 4 cores.

**Browser:** `remotion.config.ts` uses an existing Chromium headless shell when it finds one
(`REMOTION_BROWSER_EXECUTABLE`, or Playwright's under `$PLAYWRIGHT_BROWSERS_PATH` / `/opt/pw-browsers`);
otherwise Remotion downloads its own chrome-headless-shell on the first render. No system ffmpeg is
needed (Remotion ships its own).

## The guided tour (narrated)

A second, longer video: a ~2.5-minute Hebrew walkthrough of everything Badook does, one scene per
narration segment (intro, new-event wizard, event home, designs, "עצבו לי", editing, sharing, WhatsApp
invites, RSVPs, tasks/vendors/ideas, budget, seating, event-day check-in, live gallery, film & insights,
help, end card).

- `TourLandscape` 1920×1080 and `TourPortrait` 1080×1920, 30 fps, RTL, Heebo. The 45-second demo above is
  untouched (the tour reuses its scenes, slowed to the voice with `<Sequence playbackRate>`, plus tour-only
  overlays and new scenes in `src/tour/scenes/`).
- Burned-in subtitles: the sentence being read, white on a dark pill (bottom bar; portrait: lower third),
  plus a kicker + headline per scene. `badook-tour.he.vtt` has the same cues for the web player.
- Timing: `src/tour/schedule.ts`. Each scene = 0.2s lead-in + the narration + 0.8s tail; each sentence is
  on screen for a share of its segment proportional to its length. Scenes time their beats to the words
  (`useSegment().spoken('…')`), so they follow the voice when its length changes.
- Lengths come from `src/tour/durations.json` (`{ "<id>": { "seconds", "audio", "voice", "hash" } }`).
  The committed file holds text-length estimates (13 Hebrew characters a second, at least 4s, `audio:
false`); `npm run narrate` overwrites it with the measured MP3 lengths and `audio: true`, and the
  composition then plays `public/narration/<id>.mp3` under each scene.

### Edit the narration

The text is in `src/tour/narration.ts` (one `{ id, text }` per scene, in order; the ids map to scenes
in `src/tour/Tour.tsx`). Change it, then re-run the voice (only changed segments are re-synthesized) and
the render. Without audio, `npm --prefix video run narrate -- --estimate` refreshes the estimates.

### Add the voice (Azure AI Speech)

```bash
INVITES_TTS_AZURE_KEY=… INVITES_TTS_AZURE_REGION=westeurope npm run video:tour   # from the repo root
```

`video:tour` = `npm ci` + `narrate` + `render:tour`. `scripts/narrate.mjs` makes the same REST call as
the app (`src/features/voice/server/speech.ts`: SSML, `audio-24khz-48kbitrate-mono-mp3`), one MP3 per
segment into `video/public/narration/`, then writes `durations.json` (lengths read from the MP3 frames, no
ffmpeg needed). Without a key it prints a note and exits 0, so the same command renders a captions-only
video. The network must allow `https://<region>.tts.speech.microsoft.com` (or set
`INVITES_TTS_AZURE_ENDPOINT` to another base address instead of the region).

- Voice: `TOUR_VOICE=he-IL-AvriNeural` (default `he-IL-HilaNeural`).
- Pace: `TOUR_RATE=-8%` (SSML prosody rate; default `-4%`).
- `npm --prefix video run narrate -- --force` re-synthesizes every segment.

Commit `video/public/narration/*.mp3`, `src/tour/durations.json` and the outputs below together.

### Render the tour

```bash
npm --prefix video run render:tour     # vtt + landscape + portrait + poster
npm --prefix video run stills:tour     # PNGs of every scene, both layouts, into video/out/tour-stills
npm --prefix video run vtt             # captions only (also prints each scene's timing)
```

| file                       | what                                                     |
| -------------------------- | -------------------------------------------------------- |
| `badook-tour.mp4`          | landscape, H.264, CRF 30 (AAC 96k when there is a voice) |
| `badook-tour-portrait.mp4` | portrait, H.264, CRF 30                                  |
| `badook-tour.he.vtt`       | Hebrew WebVTT captions, same cues as the burned-in ones  |
| `tour-poster.jpg`          | a still of the event-home scene                          |

`npm run render` still renders only the demo.

## After UI changes

The scenes are look-alikes, not the real components: when the app's look changes (tokens, cards, the
budget gauge's zones, wording), update `src/theme.ts` / the scene files, check with `run stills` or the
studio, then `run render` and commit the new files in `public/video/`.

## A recorded voice-over (no speech service)

The full script, scene by scene with the file name for each, is in `NARRATION.he.md`. Record (or make
elsewhere) one MP3 per scene as `public/narration/<id>.mp3`, then from the repo root run
`npm run video:tour:recorded`: `narrate --files` measures each recording, times its scene and subtitles by
it, and the tour renders with the voice. A scene without its file stays silent with its subtitles.
