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

## Adding or replacing files

1. Supabase → Storage → `template-media` → the template's folder (create it if needed, named exactly
   like the template id) → upload the files.
2. On a machine with the project: `npm run media:sync` with `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` set (the production values; never commit them). It lists the bucket and
   rewrites `src/features/invitations/templates/media-manifest.json`.
3. Commit the manifest and deploy. Only files the manifest lists are used, each with a hash in its URL,
   so a replaced file reaches guests right away instead of an old cached copy.

`npm run media:sync -- --check` only compares (exit code 1 when the manifest is out of date) — handy in CI.

## Music

A template's theme track needs a licence that allows use in invitations shared publicly
(royalty-free / commercial use). Until a track is there, hosts choose their own song in the editor
(upload, or a YouTube/Vimeo video's sound).
