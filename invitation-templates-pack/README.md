# Invitation templates pack v2

28 templates: the 8 originals, then 20 whose placeholder art is a drawn scene (`src/features/invitations/renderer/scenes`) — the hero, the gallery poster and the cover's card draw it until the template's media exist. Each folder: `manifest.json` (TemplateManifest v2), `defaults.json` (TemplateDefaults — HE+EN seed copy per event type), `ASSETS.md` (checklist of media files to produce).

Install: the manifests and defaults are read from this folder by the app (src/features/invitations/templates/registry.ts). Media files are produced with `invitation-templates-kit-he.md` and uploaded to the Supabase Storage bucket `template-media` (docs/template-media.md); until they exist, the app renders its own art.

`tier` (optional, `standard` by default): `premium` designs carry a "Premium" badge in the gallery. Font pairs: a template's own pairs come first in the editor; the font library (`src/features/invitations/fonts/library.json`, ids `lib-…`, reserved) adds pairs any template can use.

| id | categories | tier |
|---|---|---|
| `sahar-bordeaux` | wedding, engagement, save_the_date | standard |
| `papercut-gold` | wedding, engagement | standard |
| `caesarea-shore` | wedding, engagement, save_the_date | standard |
| `ramon-dusk` | wedding, engagement, henna | standard |
| `atara` | bar_mitzvah, bat_mitzvah | standard |
| `nitzan` | brit, baby_shower | standard |
| `rooftop-dusk` | birthday, engagement, corporate | standard |
| `honey-meadow` | baby_shower, birthday, brit | standard |
| `midnight-bloom` | wedding, engagement, birthday | premium |
| `klaf` | bar_mitzvah, bat_mitzvah | premium |
| `cocoa-teddy` | brit, baby_shower, birthday | standard |
| `neon-night` | bar_mitzvah, bat_mitzvah, birthday, corporate | premium |
| `cloud-arch` | wedding, engagement, corporate | standard |
| `marrakech` | henna, engagement | premium |
| `dino-hatch` | birthday | standard |
| `jasper-cameo` | wedding, engagement, bat_mitzvah | premium |
| `match-day` | bar_mitzvah, birthday | standard |
| `almond-blossom` | wedding, baby_shower, other | standard |
| `deco-gatsby` | corporate, wedding, birthday, other | premium |
| `coquette-bow` | bat_mitzvah, baby_shower, engagement | premium |
| `kalanit` | wedding, engagement, birthday | standard |
| `jet-set` | wedding, save_the_date, corporate, bat_mitzvah | premium |
| `scribble-love` | engagement, birthday, other | standard |
| `jerusalem-stone` | bar_mitzvah, bat_mitzvah, wedding, brit | standard |
| `bukhara` | henna, engagement, wedding | premium |
| `martini-olive` | birthday, engagement, corporate | standard |
| `majolica` | wedding, engagement, baby_shower, other | standard |
| `white-city` | corporate, wedding, other | premium |
| `safari-pals` | birthday, brit, baby_shower | standard |
| `dig-it` | birthday | standard |
| `ocean-friends` | birthday, baby_shower, brit | standard |
| `rocket-launch` | birthday, bar_mitzvah | premium |
| `unicorn-dream` | birthday, bat_mitzvah | premium |
