# ערכת הפקה: 8 תבניות הזמנה מקוריות
**וידאו פתיחה, Hero מונפש, איורים ומוזיקה · עברית ואנגלית · מוכן להדבקה בכלי AI**

הערכה הזו מייצרת את **הנכסים הוויזואליים** של כל תבנית. את **הקוד** (manifest, טקסטי ברירת מחדל ומנוע) מקבל Claude Code מחבילת `invitation-templates-pack.zip` ומהפרומפט `claude-invitations-build-prompt.md` (v2).

> כל התבניות מקוריות. הן בנויות על ז'אנרים וטכניקות נפוצים (מעטפה עם חותם, צבעי מים, איורי דיו), לא על עיצוב מסוים של אף אחד. **אל תשתמשו בתמונות או בסרטונים של מתחרים כרפרנס בכלי ה-AI** (גם לא כ-image prompt), כי זה מכניס את העיצוב שלהם לתוצאה.

---

## 0. הקטלוג

| # | תבנית | `id` | אירועים | מעטפה (פתיחה) | Hero | אווירה |
|---|---|---|---|---|---|---|
| 1 | **סהר בורדו** | `sahar-bordeaux` | חתונה, אירוסין, Save the Date | מעטפת שנהב + חותם שעווה → הדש נפתח והכרטיס עולה | כרמים בשקיעה | קלאסי־רומנטי |
| 2 | **ניירת זהב** | `papercut-gold` | חתונה, אירוסין | שער ניירת כפול + מדליון זהב → הדלתות נפתחות | חצר אבן ועץ זית במסגרת ניירת | מסורתי, מוזהב |
| 3 | **חוף קיסריה** | `caesarea-shore` | חתונה, אירוסין, Save the Date | מעטפת פשתן בגוון חול + חותם טורקיז | קשתות אמת המים בשעת הזהב | ים־תיכוני, אוורירי |
| 4 | **רמון בשקיעה** | `ramon-dusk` | חתונה, אירוסין, חינה | מעטפת קראפט, חבל יוטה ותגית → החבל מותר | מכתש בשקיעה וכוכבים ראשונים | בוהו מדברי |
| 5 | **עטרה** | `atara` | בר מצווה, בת מצווה | שקית טלית מקטיפה + פאץ' רקום → הדש נפתח והטלית נפרשת | ספר תורה באור חלון / קשת אבן ובוגנוויליה | מכובד ומרגש |
| 6 | **ניצן** | `nitzan` | ברית, בריתה, בייבי שאוור | חיתול מוסלין, סרט סאטן ותגית עץ → נפרש | עץ זית צעיר וזרעי שן־ארי | רך ומואר |
| 7 | **גג בשקיעה** | `rooftop-dusk` | יום הולדת, מסיבת אירוסין, אירוע חברה | כרטיס כניסה וינטג' → נתלש, והמצלמה נכנסת לגג | גגות לבנים, שרשראות אורות וים | לילי ואנרגטי (תבנית כהה) |
| 8 | **אחו הדבש** | `honey-meadow` | בייבי שאוור, יום הולדת לילדים, ברית | מעטפת קראפט + חותם דבורים משושה | אחו חמניות ובלון פורח | מתוק ושמח |

**בכל תבנית:** 2–3 פלטות צבע מוכנות (למשל בר מצווה בכחול וכסף / בת מצווה בסגול ורד), 2 זוגות פונטים עם עברית, טקסטי ברירת מחדל מלאים בעברית ובאנגלית, ובדיקת ניגודיות AA שעברה.

---

## 1. איך מפיקים תבנית (Pipeline)

```
① תמונות מפתח (text-to-image)  →  ② וידאו פתיחה (image-to-video)  →  ③ לופ Hero (image-to-video)
→  ④ שכבת חותם/תגית ריקה  →  ⑤ איורים  →  ⑥ מוזיקה  →  ⑦ עיבוד ב-ffmpeg  →  ⑧ העלאה לתיקייה + QA
```

1. **תמונות מפתח:** מייצרים את `cover-poster` ואת `hero-poster` (‏9:16). אלה העוגנים של כל התבנית.
2. **וידאו פתיחה:** ב-image-to-video, **Start frame = `cover-poster`**. אם הכלי תומך גם ב-End frame, שמים **End frame = `hero-poster`**, וכך הסרטון נגמר בדיוק איפה שה-Hero מתחיל (מעבר חלק לגמרי).
3. **לופ Hero:** ב-image-to-video, **Start = End = `hero-poster`** (לופ בלי תפר). אם אין לכלי End frame, מייצרים 6–8 שניות ומתקנים את הלופ ב-ffmpeg (סעיף 7).
4. **שכבת חותם/מדליון/תגית:** מייצרים **ריקה, בלי אותיות**, על רקע לבן, ומסירים רקע. את ראשי התיבות מצייר הקוד מעליה, וכך כל משתמש עורך אותם בעצמו.
5. **איורים:** 5–6 לתבנית, על רקע לבן, ואז הסרת רקע (PNG/WebP שקוף).
6. **מוזיקה:** לפי הבריף. רק ממקור עם רישיון מסחרי.
7. **עיבוד:** פקודות ffmpeg מוכנות (נבדקו) בסעיף 7.
8. **העלאה:** לנתיבים שב-`ASSETS.md` של כל תבנית, ואז עוברים על ה-QA בסעיף 9.

**כלים:** כל כלי text-to-image ו-image-to-video שבשימושך. חשוב שהכלי יתמוך ב-**Start/End frame** ושהרישיון שלו יאפשר **שימוש מסחרי**.

---

## 2. מפרט נכסים אחיד (לכל תבנית)

| קובץ | מידות | פורמט | משך | תקציב משקל | הערות |
|---|---|---|---|---|---|
| `cover-poster.webp` | 1080×1920 | WebP q82 | — | ≤ 200KB | **הפריים הראשון של `cover-open.mp4`** (מחלצים מהווידאו, סעיף 7) |
| `cover-open.mp4` | 1080×1920 | H.264, בלי אודיו, faststart | 2.6–3.4s | ≤ 2.5MB | 0.5s ראשונות **סטטיות** |
| `cover-poster-desktop.webp` / `cover-open-desktop.mp4` | 1920×1080 | כנ"ל | כנ"ל | ≤ 250KB / 3MB | מומלץ. אם מדלגים — `null` ב-manifest (הקוד יציג 9:16 עם רקע מטושטש) |
| `hero.mp4` + `hero-poster.webp` | 720×1280 | H.264 CRF 24–26 | 5–8s לופ | ≤ 4MB / 150KB | מרכז־עליון רגוע (שם יושב הטקסט) |
| `hero-desktop.mp4` + `hero-desktop-poster.webp` | 1920×1080 (או 1280×720) | כנ"ל | כנ"ל | ≤ 5MB | מומלץ |
| `seal-blank.png` / `medallion-blank.png` / `tag-blank.png` וכו' | 1024×1024 | PNG שקוף | — | ≤ 300KB | **ריק, בלי אותיות**. חותמים ומדליונים שנצבעים בקוד — בגוון **אפור־חם בהיר** |
| איורים `*.webp` | 1200px בצלע הארוכה (פסים: 2400×400) | WebP שקוף q85 | — | ≤ 120KB | רקע שקוף |
| `music.mp3` | — | MP3 ‏160kbps | 90–120s | ≤ 2.5MB | נקודת לופ נקייה, בלי שירה |
| `preview.webp` / `preview.mp4` | 780×1688 | — | 8s | — | מייצרים בסוף, מצילום מסך של ההזמנה (Claude Code יעשה את זה עם Playwright) |

---

## 3. חוקי זהב לפרומפטים

1. **אין טקסט בשום נכס.** לא שמות, לא תאריכים ולא אותיות על החותם. כל הטקסט חי בקוד (עורכים אותו, מתרגמים אותו, והוא לא יוצא מעוות).
2. **המעטפה: נקודת החותם במרכז המדויק של הפריים וריקה.** הקוד ממקם את החותם במרכז המסך.
3. **חצי שנייה סטטית בתחילת וידאו הפתיחה.** בזמן הזה שכבת החותם עושה את היציאה שלה (נסדק / מתרומם), ורק אחר כך הווידאו זז.
4. **Hero: מרכז־עליון רגוע.** שמיים, קיר או אור, והפרטים בשליש התחתון ובשוליים.
5. **תנועה עדינה בלבד ב-Hero** ("living painting"): עננים, עלים, אור, חלקיקים. בלי אובייקטים חדשים, בלי תנועת מצלמה חזקה, ופריים ראשון = אחרון.
6. **עקביות:** מייצרים את כל נכסי התבנית באותה סשן, עם אותה שורת `STYLE`, ומשתמשים ב-`hero-poster` כ-style reference לאיורים.
7. **בלי פנים מזוהות, מותגים או לוגואים.** אנשים רק כצלליות או מרחוק.
8. **Negative prompt** (להוסיף לכל תמונה):
```
text, letters, words, numbers, typography, watermark, logo, signature, frame, border, UI, blurry, low quality, distorted hands, extra fingers, identifiable faces
```

---

## 4. איך הקוד משתמש בנכסים (כדי להבין למה הם בנויים ככה)

- **שכבת החותם** (`overlay`) היא תמונה ריקה שהקוד:
  - **צובע** אותה לפי הצבע שהמשתמש בחר (mask + multiply). לכן היא מיוצרת בגוון בהיר.
  - **מטביע** עליה את ראשי התיבות (SVG עם אפקט emboss / foil / print / deboss) בפונט המונוגרמה, בעברית או באנגלית.
  - מפעיל עליה **יציאה** בזמן ההשהיה: `crack` (נסדקת לשני חצאים), `lift` (מתרוממת ונעלמת), `fade`.
- **וידאו הפתיחה** מתחיל ברגע הנגיעה, יחד עם המוזיקה. 600ms לפני הסוף מתחיל Crossfade ל-Hero.
- **ב-Hero** הטקסט (שמות, תאריך, תאריך עברי) מרונדר מעל הווידאו, עם שכבת כהות שהמשתמש יכול לכוונן.
- **איורים** משמשים כמפרידים בין סקשנים (`decorations`) ובתוך סקשנים (סיפור, קוד לבוש וכו').

---

## 5. התבניות — פרומפטים מוכנים

> בכל תבנית: להדביק את שורת `STYLE` בסוף כל פרומפט תמונה של הסצנה, ואת `ILL` בסוף כל פרומפט איור. יחס: 9:16 אלא אם כתוב אחרת.

### 5.1 סהר בורדו · `sahar-bordeaux`
**קונספט:** ערב קיץ בכרם. מעטפת שנהב, חותם שעווה (בורדו / כחול לילה / זהב / ירוק), איורי דיו בגוון ספיה.
**פלטה:** ‏`#FBF8F4` רקע · `#FAF2EF` משטח · `#59141F` דיו · `#731F2E` אקסנט · פלטות: בורדו / כחול לילה / זית.
**פונטים:** Pinyon Script + Bellefair (תצוגה) · Cormorant Garamond + Frank Ruhl Libre · Lora + Assistant.
**מעטפה:** `envelope_seal` · שכבה: `seal-blank.png` (נצבע) · יציאה: `crack`.

```text
STYLE: romantic watercolor and gouache painting, warm golden-hour light, ivory, blush and bordeaux tones, visible cotton-paper texture, soft edges, luxury wedding stationery
ILL:   sepia ink drawing with a light bordeaux watercolor wash, loose elegant lines, isolated on pure white background, generous empty margins

[cover-poster · image]
Overhead photo of the back of a closed ivory cotton-paper envelope lying on soft ivory linen. The triangular flap points exactly to the center of the frame; the flap tip is clean and empty (a wax seal will be added later). Deckled paper edges, soft daylight from the upper left, gentle shadows, photorealistic luxury stationery photography.

[cover-open · image-to-video · 3s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the envelope flap lifts and folds back smoothly, an ivory card slides up out of the envelope toward the camera and fills the frame, revealing a watercolor vineyard at sunset. Slow, elegant, weightless motion, soft natural light.

[hero-poster · image]
Watercolor painting of rolling vineyard hills at sunset, neat rows of vines leading to a small stone farmhouse with tall cypress trees in the lower right, peach and rose sky with soft clouds. The upper middle is calm open sky; details concentrated in the bottom third. + STYLE

[hero · image-to-video · 6s · start = end = hero-poster]
Living painting: clouds drift slowly, warm light shimmers across the vines, leaves sway gently, two distant birds glide across the sky, almost static camera. Nothing new appears. Seamless loop.

[hero-desktop-poster · 16:9]  Same scene as a wide composition, farmhouse on the right third, open sky in the center. + STYLE

[seal-blank · 1:1]
Top-down studio photo of one blank round wax seal made of light warm-gray wax, smooth flat center with no imprint, organic melted irregular rim, soft even light, isolated on pure white background.

[rings-vine]          two interlocking wedding rings entwined with a small grapevine tendril + ILL
[bicycle]             a vintage bicycle with a basket full of grapes and wildflowers, side view + ILL
[harvest-table]       a long rustic harvest table with candles and a vine garland, three-quarter view + ILL
[vineyard-panorama · 4:1]  wide panorama of vineyard hills with a stone farmhouse and cypress trees + ILL
[grapes]              a cluster of grapes with two vine leaves + ILL
```
**מוזיקה:** רביעיית כלי קשת ופסנתר רך, 70 BPM, חם וקולנועי.

---

### 5.2 ניירת זהב · `papercut-gold`
**קונספט:** אמנות הניירת היהודית (כמו כתובה עתיקה). שער נייר חתוך מעל רדיד זהב, רימונים, גפנים ויונים. הדלתות נפתחות אל חצר אבן.
**פלטה:** ‏`#FBF7EE` · `#F3EAD6` · `#3A2A18` · `#8C6A1F` זהב עתיק · פלטות: זהב / רימון / זית.
**פונטים:** Cinzel Decorative + Bellefair · Cinzel + Frank Ruhl Libre · (חלופה: Great Vibes + David Libre).
**מעטפה:** `gatefold` · שכבה: `medallion-blank.png` (נצבע: זהב / כסף / רימון) · יציאה: `lift` · אפקט טקסט: `foil`.

```text
STYLE: intricate Jewish papercut art in the style of an antique ketubah, layered ivory laser-cut paper over antique gold foil, pomegranates, grapevines and doves, symmetrical ornamental design, warm soft light, heirloom luxury
ILL:   ivory papercut silhouette with fine lace-like cutouts and a thin antique-gold outline, symmetrical, isolated on pure white background

[cover-poster · image]
Front view of two closed tall arched paper doors forming a gate, made of intricate ivory papercut with pomegranate, vine and dove motifs over shimmering antique gold foil. The seam between the doors runs exactly down the vertical center; an empty round space sits at the exact center of the frame (a medallion will be added). Soft warm light, shallow depth of field, photorealistic papercraft.

[cover-open · image-to-video · 3s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the two paper doors swing open outward symmetrically like a gate, the gold foil catching the light, and the camera glides forward through the opening into a sunlit stone courtyard. Graceful and slow.

[hero-poster · image]
A sunlit stone courtyard with an old olive tree, painted in soft watercolor, framed around the edges by an ornate ivory-and-gold papercut arch border. Pale morning sky in the upper center (calm area). + STYLE

[hero · image-to-video · 6s · start = end = hero-poster]
Olive leaves sway gently, sunlight flickers across the stones, fine dust motes float, the gold foil of the frame glints softly. Static camera, seamless loop.

[medallion-blank · 1:1]
Top-down studio photo of a single round blank medallion of pale silver-gray metallic foil with a thin embossed ornamental rim and a smooth empty center, isolated on pure white background.

[pomegranate-branch]        a pomegranate branch with two fruits and leaves + ILL
[papercut-band · 6:1]       a horizontal ornamental band of vines and small pomegranates + ILL
[doves]                     two doves facing each other holding an olive branch + ILL
[chuppah]                   a wedding canopy on four poles decorated with vines + ILL
[olive-sprig]               a single olive sprig with small olives + ILL
[lantern]                   an ornate hanging lantern + ILL
```
**מוזיקה:** כינור סולו עם נבל וכלי קשת עדינים, 66 BPM, רך, עם נגיעה מודאלית ים־תיכונית.

---

### 5.3 חוף קיסריה · `caesarea-shore`
**קונספט:** חתונה על החוף בשעת הזהב. מעטפת פשתן בגוון חול, חותם טורקיז וענף לימוניום ים.
**פלטה:** ‏`#F7F2EA` · `#EEE5D6` · `#173F4A` · `#1E5A67` טורקיז · פלטות: טורקיז / חמר ואלמוג / ים עמוק.
**פונטים:** Italianno + Frank Ruhl Libre · Marcellus + Frank Ruhl Libre · (חלופה: Cormorant + Bona Nova).
**מעטפה:** `envelope_seal` · שכבה: `seal-blank.png` (נצבע) · יציאה: `crack`.

```text
STYLE: luminous watercolor, Mediterranean golden hour, sand, sea-glass teal and soft coral tones, light haze, airy and elegant, fine paper texture
ILL:   fine black ink line drawing with a light teal and sand watercolor wash, isolated on pure white background

[cover-poster · image]
Overhead photo of the back of a closed sand-colored linen-textured envelope lying on pale beach sand, a small sprig of sea lavender beside it. The flap tip points exactly to the center and is clean and empty (a wax seal will be added). Soft golden light, delicate shadows, photorealistic.

[cover-open · image-to-video · 3s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the flap opens, a card rises out of the envelope toward the camera, grains of sand slide gently and the sea lavender trembles in a light breeze; the card fills the frame revealing a watercolor seashore.

[hero-poster · image]
Watercolor of ancient stone aqueduct arches running along a golden beach at sunset, gentle waves rolling onto the sand, a few seagulls, warm glow on the stone. The arches sit in the bottom third; open luminous sky above. + STYLE

[hero · image-to-video · 6s · start = end = hero-poster]
Waves roll in and recede softly, sunlight sparkles on the water, seagulls glide slowly in the distance, the sky glows. Static camera, seamless loop.

[seal-blank · 1:1]  (same prompt as sahar-bordeaux)

[shells]                 a small cluster of seashells and a starfish + ILL
[arches-panorama · 4:1]  a panorama of ancient aqueduct arches along the shore + ILL
[sea-lavender]           a delicate sprig of sea lavender + ILL
[lantern-sand]           a rattan lantern with a lit candle standing on sand + ILL
[footprints]             two pairs of bare footprints side by side in the sand, top view + ILL
```
**מוזיקה:** גיטרה אקוסטית, כלי קשת רכים ושייקר, 80 BPM, קליל ורומנטי.

---

### 5.4 רמון בשקיעה · `ramon-dusk`
**קונספט:** חתונה במדבר, בוהו מודרני. מעטפת קראפט, חבל יוטה, פמפס ותגית נייר.
**פלטה:** ‏`#F6EFE6` · `#EEE0CF` · `#3D291F` · `#A04C27` טרקוטה · פלטות: טרקוטה / מרווה / לילה במדבר.
**פונטים:** Allura + Amatic SC · Fraunces + Frank Ruhl Libre · (חלופה: Fraunces + Suez One).
**מעטפה:** `envelope_seal` · שכבה: `tag-blank.png` (לא נצבעת) · יציאה: `lift` · אפקט: `print` (חותמת דיו).

```text
STYLE: textured gouache and watercolor, desert dusk, terracotta, sand, dusty rose and deep indigo tones, grainy paper, modern boho, calm and vast
ILL:   hand-drawn ink illustration with terracotta and sand gouache accents, modern boho, isolated on pure white background

[cover-poster · image]
Overhead photo of a closed kraft-paper envelope on natural linen, tied with rustic jute twine in a bow at the exact center, a small bundle of dried pampas grass tucked under the twine. The area just below the bow is empty (a paper tag will be added). Warm late-afternoon light, photorealistic.

[cover-open · image-to-video · 3s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the jute bow unties itself and the twine slips away, the flap opens and a card slides up out of the envelope, filling the frame with a painted desert crater at dusk. Slow, organic motion.

[hero-poster · image]
Gouache painting of a vast desert crater at dusk, layered terracotta and rose cliffs, a lone acacia tree in the lower left foreground, the first stars appearing in a deep indigo-to-peach sky. The upper center is open sky. + STYLE

[hero · image-to-video · 7s · start = end = hero-poster]
Stars slowly twinkle and appear, thin clouds drift, a subtle heat shimmer on the horizon, acacia leaves move slightly. Static camera, seamless loop.

[tag-blank · 1:1]
Top-down photo of a blank round kraft-paper gift tag with a small punched hole and a short loop of jute twine at the top, no writing, isolated on pure white background.

[pampas]                 a bundle of dried pampas grass tied with twine + ILL
[acacia]                 a lone flat-topped acacia tree + ILL
[ibex]                   a Nubian ibex standing on a rock, side view + ILL
[lanterns]               three metal lanterns with candles standing on sand + ILL
[stars-band · 6:1]       a horizontal band of small stars and constellations + ILL
[crater-panorama · 4:1]  a wide panorama of layered desert cliffs + ILL
```
**מוזיקה:** עוד וגיטרה ניילון עם תוף מסגרת רך, 85 BPM, ים־תיכוני מודרני וחם.

---

### 5.5 עטרה · `atara`
**קונספט:** בר/בת מצווה. שקית טלית מקטיפה רקומה נפתחת, והטלית נפרשת אל אור חלון.
**פלטות:** בר מצווה — ‏`#F5F7FA` · `#14233F` · `#1F3A68` (כחול וכסף). בת מצווה — ‏`#FBF6F6` · `#45202D` · `#8E4A5E` (סגול ורד).
**פונטים:** Cinzel + Suez One · Cinzel + Frank Ruhl Libre · (חלופה עדינה: Great Vibes + Bellefair).
**מעטפה:** `pouch` · שכבה: `patch-blank.png` (נצבע: כסף / זהב / ורד) · יציאה: `lift`.
**שני Hero לבחירה:** ספר תורה באור חלון (`hero`) · קשת אבן עם בוגנוויליה (`hero-bloom`, ניטרלי, מתאים גם לבת מצווה חילונית).

```text
STYLE: soft watercolor with gentle light rays, reverent and warm, navy, silver, ivory and warm wood tones, fine paper texture, dignified
ILL:   fine navy ink line illustration with a subtle silver-gray wash, elegant and simple, isolated on pure white background

[cover-poster · image]
Front view of a closed rectangular navy-blue velvet tallit bag on a warm wooden table, with a delicate silver-thread embroidered border of pomegranates and vines. The center of the flap is plain velvet with an empty round space at the exact center of the frame (a patch will be added). Soft window light, photorealistic.

[cover-open · image-to-video · 3.2s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the velvet flap opens gently and a folded white prayer shawl with blue stripes unfolds upward toward the camera, fringes swaying, soft rays of light, transitioning into a painted sunlit room.

[hero-poster · image]
Watercolor of an open Torah scroll resting on a wooden reading table beside a tall arched window, soft morning light rays and floating dust, a white prayer shawl with blue stripes draped over the table edge. The writing on the scroll is soft-focus and illegible. The upper center is a bright calm wall. + STYLE

[hero · image-to-video · 6s · start = end = hero-poster]
Light rays shift slowly, dust motes float, the prayer-shawl fringes sway slightly, a sheer curtain moves gently. Static camera, seamless loop.

[hero-bloom-poster · image]
Watercolor of an arched window in pale limestone overflowing with pink bougainvillea, soft afternoon light, pale sky visible through the arch in the upper center, blush and plum tones, fine paper texture.

[hero-bloom · image-to-video · 6s · start = end = hero-bloom-poster]
Bougainvillea petals flutter, a few petals drift down slowly, light shifts softly. Static camera, seamless loop.

[patch-blank · 1:1]
Top-down photo of a blank round embroidered patch with a pale silver-gray satin-stitched border and a smooth empty center, isolated on pure white background.

[tallit-stripes · 6:1]   a horizontal band of prayer-shawl stripes with fringes at both ends + ILL
[torah-crown]            an ornate Torah crown with small bells + ILL
[pomegranates]           three pomegranates with leaves + ILL
[stone-arch]             an arched stone window + ILL
[tefillin-bag-outline]   an embroidered velvet tefillin bag, simple outline + ILL
[flowers-spray]          a delicate spray of white flowers and greenery (for bat mitzvah) + ILL
```
**מוזיקה:** צ'לו ופסנתר, 72 BPM, מרומם ומרגש, אפשר עם מוטיב קלרינט עדין.

---

### 5.6 ניצן · `nitzan`
**קונספט:** ברית, בריתה ובייבי שאוור. חיתול מוסלין עטוף בסרט ונפרש אל חצר מוארת עם עץ זית צעיר.
**פלטה:** ‏`#F7F8F3` · `#ECEFE3` · `#2E382C` · `#5F7555` מרווה · פלטות: מרווה / תכלת / ורוד פודרה.
**פונטים:** Fraunces + Varela Round · Fraunces + Assistant · (חלופה שובבה: Atma + Playpen Sans Hebrew).
**מעטפה:** `swaddle` · שכבה: `wood-tag-blank.png` (לא נצבעת) · יציאה: `lift` · אפקט: `deboss` (צריבה בעץ).

```text
STYLE: soft pastel watercolor, morning sunlight, sage green, cream and pale sky tones, gentle and airy, fine paper texture, tender
ILL:   delicate watercolor illustration in sage, cream and soft sky tones, isolated on pure white background

[cover-poster · image]
Overhead photo of a soft cream muslin swaddle blanket neatly folded into an envelope shape on a light linen surface, tied with a sage-green satin ribbon in a bow at the exact center. The area just below the bow is empty (a wooden tag will be added). Soft morning light, photorealistic.

[cover-open · image-to-video · 3.2s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the satin ribbon unties and slides away and the muslin folds open softly one by one, revealing a watercolor sunlit courtyard with a young olive tree. Gentle, calm motion.

[hero-poster · image]
Watercolor of a young olive tree in a sunlit stone courtyard, two small sparrows on a low wall, dandelion seeds floating in the air, soft morning light. The upper center is pale bright sky. + STYLE

[hero · image-to-video · 7s · start = end = hero-poster]
Dandelion seeds drift slowly across the frame, olive leaves sway, the sparrows hop slightly, sunlight shimmers. Static camera, seamless loop.

[wood-tag-blank · 1:1]
Top-down photo of a blank round light-wood tag with a small hole and a short loop of sage ribbon at the top, smooth surface, no engraving, isolated on pure white background.

[olive-sprig]         a young olive sprig with a few leaves + ILL
[sparrows]            two small sparrows sitting on a branch + ILL
[dandelion]           a dandelion with seeds floating away + ILL
[booties]             a pair of knitted baby booties + ILL
[pomegranate-small]   a small pomegranate with a leaf + ILL
[cradle]              a simple wooden cradle with a soft blanket + ILL
```
**מוזיקה:** תיבת נגינה ופסנתר רך, 65 BPM, שיר ערש חם.

---

### 5.7 גג בשקיעה · `rooftop-dusk` (תבנית כהה)
**קונספט:** מסיבת גג בשקיעה. כרטיס כניסה שנתלש והמצלמה "נכנסת" אל הגגות.
**פלטה:** ‏`#1C1A2E` רקע כהה · `#262340` · `#F6EFE6` טקסט בהיר · `#FF8A5B` קורל · פלטות: קורל / טורקיז ניאון / זהב.
**פונטים:** Unbounded + Karantina · Syne + Rubik · (חלופה: Syne + Secular One).
**מעטפה:** `ticket` · שכבה: **טקסט בלבד** על הכרטיס (שם + גיל, עד 12 תווים, למשל `DANA 30` / `דנה 30`) · יציאה: `fade`.
**לו"ז:** קלפים שמתהפכים (flip-cards).

```text
STYLE: vibrant gouache illustration, Mediterranean city rooftops at dusk, violet, coral and warm gold light, glowing string lights, modern editorial poster feel, grainy texture
ILL:   flat modern illustration with grainy texture in coral, gold and violet, isolated on pure white background

[cover-poster · image]
Overhead photo of a single blank vintage admit-one ticket (cream paper, perforated stub on one side, no printing at all) lying at the exact center of a dark terrazzo table, a coral cocktail with ice and a rosemary sprig in the corner, warm bokeh lights. Moody evening light, photorealistic.

[cover-open · image-to-video · 3s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the ticket stub tears off along the perforation and flutters away, the camera tilts up and pushes forward past the table edge into a glowing city rooftop at dusk. Energetic but smooth.

[hero-poster · image]
Gouache illustration of white modernist rooftops at dusk with string lights, potted palms and a distant sea horizon, violet-to-coral sky. The upper center is open sky. + STYLE

[hero · image-to-video · 6s · start = end = hero-poster]
String lights twinkle, windows light up one by one, palm fronds sway, the sky slowly shifts color. Static camera, seamless loop.

[string-lights · 6:1]   a horizontal swag of glowing string lights + ILL
[cocktails]             two cocktail glasses clinking + ILL
[vinyl]                 a vinyl record on a turntable, top view + ILL
[disco-ball]            a sparkling disco ball + ILL
[palms]                 two palm tree silhouettes + ILL
[confetti]              scattered confetti and streamers + ILL
```
**הערה:** הרקע כהה, ולכן **חובה** להסיר רקע מהאיורים (בתבניות הבהירות אפשר להסתפק ב-multiply).
**מוזיקה:** Nu-disco / לאונג' האוס, 112 BPM, אנרגיית שקיעה, אינסטרומנטלי.

---

### 5.8 אחו הדבש · `honey-meadow`
**קונספט:** מתוק ושמח. מעטפת קראפט עם חותם שעוות דבורים משושה, אחו חמניות ובלון פורח.
**פלטה:** ‏`#FFFEF2` · `#FFF8DC` · `#292119` · `#E8B93C` דבש · פלטות: דבש / מנטה / אפרסק. (כותרות בצבע הדיו, והאקסנט רק למילויים.)
**פונטים:** Atma + Amatic SC · Artifika + Frank Ruhl Libre · (חלופה: Fraunces + Varela Round).
**מעטפה:** `envelope_seal` · שכבה: `seal-hex-blank.png` (נצבע) · יציאה: `crack`.

```text
STYLE: cheerful soft watercolor, sunny meadow, honey yellow, cream, soft sky blue and leaf green, whimsical children's-book feel, fine paper texture
ILL:   cute watercolor illustration, children's-book style, honey yellow and leaf green, isolated on pure white background

[cover-poster · image]
Overhead photo of the back of a closed kraft-paper envelope on cream linen with a few sunflower petals around it. The flap tip points exactly to the center and is clean and empty (a hexagonal wax seal will be added). Warm sunny light, photorealistic.

[cover-open · image-to-video · 3s · start = cover-poster · end = hero-poster]
Hold completely still for the first half second. Then the flap opens, a card slides up toward the camera and a few sunflower petals float upward, revealing a watercolor sunflower meadow. Playful and gentle.

[hero-poster · image]
Watercolor of a sunflower meadow under a soft blue sky with fluffy clouds, a small striped hot-air balloon floating in the upper right, a friendly cartoon bee near the flowers. The upper center is open sky. + STYLE

[hero · image-to-video · 6s · start = end = hero-poster]
Sunflowers sway gently, clouds drift, the balloon bobs slowly, the bee hovers in a small loop. Static camera, seamless loop.

[seal-hex-blank · 1:1]
Top-down studio photo of a single blank hexagon-shaped wax seal of light warm-gray wax with a subtle honeycomb texture on the rim and a smooth empty center, isolated on pure white background.

[daisy-bunch]           a small bunch of daisies tied with a ribbon + ILL
[bee-sunflower]         a cute bee sitting on a sunflower + ILL
[sunflowers]            three sunflowers of different heights + ILL
[balloon]               a striped hot-air balloon + ILL
[honeycomb-band · 6:1]  a horizontal band of honeycomb hexagons with a few honey drips + ILL
[clouds]                a few fluffy clouds + ILL
```
**מוזיקה:** יוקולילי וגלוקנשפיל עם מחיאות כפיים קלות, 96 BPM, מתוק ושובב.

---

## 6. בריף מוזיקה כללי
- 90–120 שניות, **בלי שירה**, פתיחה רכה (בלי "בום" בשנייה הראשונה, כי המוזיקה מתחילה יחד עם פתיחת המעטפה).
- נקודת לופ נקייה בסוף, נורמליזציה ל-‎-16 LUFS.
- **רק ממקור עם רישיון מסחרי** (ספריית Royalty-free או הפקה מקורית). שמרו את קובץ הרישיון ב-`/templates/<id>/LICENSE-music.txt`.

---

## 7. עיבוד ב-ffmpeg (נבדק)

```bash
# 1) וידאו פתיחה: חיתוך ל-9:16, 30fps, בלי אודיו, טעינה מהירה
ffmpeg -i raw_cover.mp4 -t 3.2 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 23 -preset slow -movflags +faststart -an cover-open.mp4

# 2) הפוסטר = הפריים הראשון של הווידאו (אחרת יש "קפיצה" בנגיעה)
ffmpeg -i cover-open.mp4 -frames:v 1 -c:v libwebp -quality 82 cover-poster.webp

# 3) לופ Hero בלי תפר (אם הכלי לא תמך ב-start=end): crossfade של הסוף לתחילה
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 raw_hero.mp4); X=1
ffmpeg -i raw_hero.mp4 -filter_complex \
 "[0:v]split[a][b];[a]trim=start=$X,setpts=PTS-STARTPTS[main];[b]trim=0:$X,setpts=PTS-STARTPTS[head];\
  [main][head]xfade=transition=fade:duration=$X:offset=$(echo "$D-2*$X" | bc)[v]" \
 -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 24 -preset slow -movflags +faststart -an hero-loop.mp4

#    חלופה: לופ "פינג־פונג" (קדימה ואחורה). טוב לתנועה איטית מאוד
ffmpeg -i raw_hero.mp4 -filter_complex "[0:v]split[f][r0];[r0]reverse[r];[f][r]concat=n=2:v=1:a=0[v]" \
 -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 24 -movflags +faststart -an hero-loop.mp4

# 4) גרסת מובייל 720×1280 + פוסטר
ffmpeg -i hero-loop.mp4 -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -crf 25 -preset slow -movflags +faststart -an hero.mp4
ffmpeg -i hero.mp4 -frames:v 1 -c:v libwebp -quality 80 hero-poster.webp

# 5) איור / חותם עם שקיפות (אחרי הסרת רקע) → WebP שקוף
ffmpeg -i illustration.png -c:v libwebp -pix_fmt yuva420p -quality 85 illustration.webp

# 6) בדיקת משקל ומשך
ffprobe -v error -show_entries format=duration,size -of csv=p=0 hero.mp4
```
**הסרת רקע:** כל כלי הסרת רקע (או `rembg`: ‏`pip install "rembg[cli]"` ואז `rembg i in.png out.png`). חותמים, מדליונים ותגיות: לשמור PNG שקוף ב-1024×1024.

---

## 8. מבנה תיקיות

```
public/templates/<id>/
  manifest.json            ← מהחבילה
  defaults.json            ← מהחבילה (טקסטים בעברית ובאנגלית)
  cover-poster.webp        cover-open.mp4
  cover-poster-desktop.webp cover-open-desktop.mp4     (אופציונלי)
  hero.mp4  hero-poster.webp  hero-desktop.mp4  hero-desktop-poster.webp
  <overlay>-blank.png      (seal / medallion / tag / patch / wood-tag / seal-hex)
  <illustration>.webp …
  music.mp3  LICENSE-music.txt
  preview.webp  preview.mp4
```
רשימת הקבצים המדויקת לכל תבנית: `ASSETS.md` בתוך תיקיית התבנית בחבילה.

---

## 9. QA לפני שתבנית עולה לאוויר
- [ ] הפוסטר זהה לפריים הראשון של `cover-open.mp4` (אין קפיצה בנגיעה).
- [ ] 0.5s ראשונות של וידאו הפתיחה סטטיות. נקודת החותם במרכז המדויק.
- [ ] החותם/התגית **ריקים**, ומונוגרמה של 3 תווים בעברית ובאנגלית נראית טוב עליהם.
- [ ] לופ ה-Hero בלי "קפיצה" (לצפות 3 סבבים ברצף).
- [ ] שמות ארוכים בעברית ובאנגלית קריאים מעל ה-Hero עם שכבת הכהות של ברירת המחדל.
- [ ] אין טקסט, אותיות או לוגו באף נכס. אין אותיות עבריות מעוותות (במיוחד בספר התורה).
- [ ] משקלים לפי סעיף 2. ‏iPhone ב-4G: המעטפה מוצגת תוך פחות מ-1.5 שניות.
- [ ] המוזיקה מתחילה בנגיעה, מושתקת בכפתור, ויש לה קובץ רישיון.
- [ ] כל הפלטות המוכנות נבדקו על המכשיר (הניגודיות כבר עברה בדיקה אוטומטית).
