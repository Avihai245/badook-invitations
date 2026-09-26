# Fonts and their licences

Every font the invitations and the site use is self-hosted (generated from the `@fontsource` packages by
`scripts/build-fonts.mjs` into `public/fonts/`): nothing is loaded from Google at run time. All of them
allow embedding in websites and in images (the link previews) and commercial use.

| Package | Licence |
| --- | --- |
| `@fontsource/abril-fatface` | OFL-1.1 |
| `@fontsource/alef` | OFL-1.1 |
| `@fontsource/allura` | OFL-1.1 |
| `@fontsource/amatic-sc` | OFL-1.1 |
| `@fontsource/amiri` | OFL-1.1 |
| `@fontsource/aref-ruqaa` | OFL-1.1 |
| `@fontsource/artifika` | OFL-1.1 |
| `@fontsource/assistant` | OFL-1.1 |
| `@fontsource/atma` | OFL-1.1 |
| `@fontsource/ballet` | OFL-1.1 |
| `@fontsource/bebas-neue` | OFL-1.1 |
| `@fontsource/bellefair` | OFL-1.1 |
| `@fontsource/big-shoulders-display` | OFL-1.1 |
| `@fontsource/bodoni-moda` | OFL-1.1 |
| `@fontsource/bona-nova` | OFL-1.1 |
| `@fontsource/cairo` | OFL-1.1 |
| `@fontsource/caveat` | OFL-1.1 |
| `@fontsource/cinzel` | OFL-1.1 |
| `@fontsource/cinzel-decorative` | OFL-1.1 |
| `@fontsource/cormorant-garamond` | OFL-1.1 |
| `@fontsource/courier-prime` | OFL-1.1 |
| `@fontsource/cousine` | OFL-1.1 |
| `@fontsource/david-libre` | OFL-1.1 |
| `@fontsource/dm-serif-display` | OFL-1.1 |
| `@fontsource/eb-garamond` | OFL-1.1 |
| `@fontsource/frank-ruhl-libre` | OFL-1.1 |
| `@fontsource/fraunces` | OFL-1.1 |
| `@fontsource/fredoka` | OFL-1.1 |
| `@fontsource/gloock` | OFL-1.1 |
| `@fontsource/great-vibes` | OFL-1.1 |
| `@fontsource/heebo` | OFL-1.1 |
| `@fontsource/im-fell-english` | OFL-1.1 |
| `@fontsource/inter` | OFL-1.1 |
| `@fontsource/italiana` | OFL-1.1 |
| `@fontsource/italianno` | OFL-1.1 |
| `@fontsource/josefin-sans` | OFL-1.1 |
| `@fontsource/jost` | OFL-1.1 |
| `@fontsource/karantina` | OFL-1.1 |
| `@fontsource/limelight` | OFL-1.1 |
| `@fontsource/lora` | OFL-1.1 |
| `@fontsource/marcellus` | OFL-1.1 |
| `@fontsource/miriam-libre` | OFL-1.1 |
| `@fontsource/monoton` | OFL-1.1 |
| `@fontsource/noto-kufi-arabic` | OFL-1.1 |
| `@fontsource/noto-naskh-arabic` | OFL-1.1 |
| `@fontsource/noto-sans-ethiopic` | OFL-1.1 |
| `@fontsource/noto-serif-ethiopic` | OFL-1.1 |
| `@fontsource/noto-serif-hebrew` | OFL-1.1 |
| `@fontsource/nunito` | OFL-1.1 |
| `@fontsource/oswald` | OFL-1.1 |
| `@fontsource/outfit` | OFL-1.1 |
| `@fontsource/petit-formal-script` | OFL-1.1 |
| `@fontsource/pinyon-script` | OFL-1.1 |
| `@fontsource/playfair-display` | OFL-1.1 |
| `@fontsource/playpen-sans-hebrew` | OFL-1.1 |
| `@fontsource/quicksand` | OFL-1.1 |
| `@fontsource/righteous` | OFL-1.1 |
| `@fontsource/rubik` | OFL-1.1 |
| `@fontsource/secular-one` | OFL-1.1 |
| `@fontsource/shantell-sans` | OFL-1.1 |
| `@fontsource/space-mono` | OFL-1.1 |
| `@fontsource/special-elite` | Apache-2.0 |
| `@fontsource/suez-one` | OFL-1.1 |
| `@fontsource/syne` | OFL-1.1 |
| `@fontsource/titan-one` | OFL-1.1 |
| `@fontsource/unbounded` | OFL-1.1 |
| `@fontsource/varela-round` | OFL-1.1 |
| `@fontsource/yeseva-one` | OFL-1.1 |
| `@fontsource/young-serif` | OFL-1.1 |

## Scripts beyond Hebrew and Latin

An invitation can be in Russian, Arabic and Amharic too; every design writes them
(`src/features/invitations/fonts/scripts.json`, read by `scripts/build-fonts.mjs` and `fonts/index.ts`):

- **Cyrillic** — the pair's own Latin family when it has Cyrillic letters (Playfair Display, Lora, EB
  Garamond, Cormorant Garamond, Great Vibes, Inter, Jost, Rubik…); otherwise a Cyrillic-capable family in
  the same spirit (`cyrillic` in scripts.json: Allura → Great Vibes, Cinzel → Cormorant Garamond, DM Serif
  Display → Playfair Display, Josefin Sans → Jost…).
- **Arabic** — by the style of the pair's Latin family (`classes`): script designs set names in Aref Ruqaa
  and text in Noto Naskh Arabic; serif designs Amiri and Noto Naskh Arabic; sans designs Noto Kufi Arabic;
  playful designs Cairo.
- **Ethiopic** (Amharic) — Noto Serif Ethiopic for script and serif designs, Noto Sans Ethiopic for sans
  and playful ones.

A page declares only the faces its languages need, each behind its script's `unicode-range`, so a
Hebrew + English invitation downloads exactly what it did before; a Russian name inside Hebrew text keeps
a designed face. `npm run templates:validate` checks every supported script has a face in every role of
every font pair. A new Latin family needs a `classes` entry (and a `cyrillic` stand-in when it has no
Cyrillic letters). The link-preview image draws Arabic in its presentation forms (the image renderer has
no Arabic shaper), in Amiri or Noto Kufi Arabic when the design's face lacks them (Aref Ruqaa, Cairo).
The site itself (Heebo, Inter) writes Arabic in Cairo and Ethiopic in Noto Sans Ethiopic — the live
gallery's guest pages, guests' names in the guest list — likewise behind their `unicode-range`.

**OFL-1.1** (SIL Open Font License 1.1): free to use, embed and bundle, including commercially; the fonts
may not be sold on their own. **Apache-2.0**: free to use, including commercially, with the licence and
notices kept. The full texts ship inside each package (`node_modules/@fontsource/<name>/LICENSE`).
