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

## After UI changes

The scenes are look-alikes, not the real components: when the app's look changes (tokens, cards, the
budget gauge's zones, wording), update `src/theme.ts` / the scene files, check with `run stills` or the
studio, then `run render` and commit the new files in `public/video/`.
