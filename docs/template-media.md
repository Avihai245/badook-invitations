# Template media: videos, stills and music

Every template works without media: until its files exist, the invitation draws its own art (a sky,
hills or the template's scene), the cover uses its CSS envelope, and no music plays. Real media makes
a template richer — a hero video behind the names, a cover poster, a theme song, gallery previews.

## Where the files live

Not in the build (it would make every deploy heavy): in the Supabase Storage bucket
**`template-media`** (public), one folder per template:

```
template-media/
  sahar-bordeaux/
    hero.mp4              ← the names of the template's manifest `assets` (invitation-templates-pack/<id>/manifest.json)
    hero-poster.webp
    hero-desktop.mp4
    ...
  kalanit/
    ...
```

The file names are the last part of each path in the template's `assets` (for example
`"hero": "/templates/sahar-bordeaux/hero.mp4"` → upload `hero.mp4` into `sahar-bordeaux/`). What each
file should look like (sizes, length, loop, tone) is in the template's `ASSETS.md`.

## Preparing the files for the web

Guests open an invitation on a phone, often on mobile data: a picture should weigh well under 450 KB and
a video about 140 KB a second at most (a 15-second hero ≈ 2 MB). `npm run media:optimize` does what the
editor does for a host's uploads, for the team's own files:

```
npm run media:optimize -- <folder or file …> [--out <folder>] [--max 2560] [--mute]
```

- every picture → upright (EXIF), at most 2560 px on its long edge, WebP;
- every video → H.264 at most 1280 px on its long edge (720p), 30 fps, faststart, AAC audio (`--mute`
  drops the sound — a background hero usually has none) and a poster of it, as WebP;
- `media-info.json` next to the results lists each file's pixel size, length and bytes, and the command
  warns about anything still over the weights above.

It needs `ffmpeg` and `ffprobe` on the PATH for videos (pictures use `sharp`, already installed with Next).
The originals are left as they are; the results go to `<folder>/optimized` — upload those.

## Adding or replacing files

1. Supabase → Storage → `template-media` → the template's folder (create it if needed, named exactly
   like the template id) → upload the files (the optimized ones).
2. On a machine with the project: `npm run media:sync` with `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` set (the production values; never commit them). It lists the bucket and
   rewrites `src/features/invitations/templates/media-manifest.json`.
3. Commit the manifest and deploy. Only files the manifest lists are used, each with a hash in its URL,
   so a replaced file reaches guests right away instead of an old cached copy.

`npm run media:sync -- --check` only compares (exit code 1 when the manifest is out of date) — handy in CI.

## Placeholder photos (photographic designs)

A photographic design needs pictures to look like itself, so until its real photos are in the bucket it
ships small generated placeholders in the build — the only template files in `public/templates/`:
`npm run media:placeholders -- <id>` (`scripts/make-template-placeholders.mjs`) draws soft gradients,
light and film grain in the design's palette at the sizes of the real photos, one per `photo-*` entry of
its manifest's `assets`, writes them to `public/templates/<id>/` and lists them with a hash in
`src/features/invitations/templates/placeholder-media.json`. A file the bucket has always wins over its
placeholder (after `npm run media:sync`), so swapping in the real photos is: upload them under the same
names (or change the paths in `assets` — the one list), `npm run media:sync`, commit, deploy. Delete the
placeholders (and their entries) once the real ones are live.

## Music

A template's theme track needs a licence that allows use in invitations shared publicly
(royalty-free / commercial use). Until a track is there, hosts choose their own song in the editor
(upload, or a YouTube/Vimeo video's sound).
