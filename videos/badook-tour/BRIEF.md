---
workflow: product-launch-video
flow: automation
storyboard: no
mode: autonomous
message: "באדוק — כל האירוע במקום אחד, מהרעיון הראשון ועד הרגע האחרון. מתחילים בחינם."
destination: website
aspect: 1920x1080
aspects: [1920x1080, 1080x1920]
language: he
audience: hosts planning a wedding or a family event in Israel (Hebrew speakers)
length: 165s (fixed by the supplied voice-over)
angle: site tour — the system's own screens, in the order of an event (show it as it is)
narration: yes — supplied recording, verbatim (VO_MODE verbatim)
---

## Intent

An update to Badook's "full tour of the system" video (the one in the guide, in the help panel and behind
"watch with sound"). The user recorded the narration (17 segments of `video/NARRATION.he.md`, read
verbatim) and wants the video re-made around it: the voice and the captions in sync with the picture, the
system's real screens, and "beautiful elements during the video so customers really understand the
innovative features". The film ends on "שימוש חינם" (free to use).

User's words (Hebrew, verbatim): "תיצור עדכון לסרטון … 1. תשמש בהזמנה החדשה שיש באתר ולא בהזמנה שרשום
אביחי ורותם 2. תראה הזמנה עם סרטון. ההזמנה שיש עכשיו באתר 3. מוסיף לך קול רקע שיש לסנכרן לסרטון. זה קול
שילווה את הסרטון שאתה מכין כולל הכתוביות. תוסיף אלמנטים יפים במהלך הסרטון שבאמת הלקוחות יבינו את
הפיצרים החדשניים שיש למערכת. בסוף הסרטון יש לרשום שימוש חינם."

## Assets

- `/root/.claude/uploads/41873b19-9a73-5233-8555-ff616d06d6f8/14ac779a-badook_voice.mp3` — the
  narration (165.1s, mono 44.1 kHz). Reads `video/NARRATION.he.md` verbatim; the whole video is timed to it.
- The invitation's background video — **the user is uploading it** (the site's sample invitation plays
  it from YouTube, unreachable from this container). Until it arrives the invitation shows its design's
  own animated background; the video drops into the same slot.
- The site's sample invitation — "נועה & איתי", design "סהר בורדו" (`sahar-bordeaux`), Thursday
  17.06.2027, זכרון יעקב (`/i/noa-and-itay-video`, `/i/noa-and-itay-classic`).
- The system's real screens, captured from the running app (local production build) with a demo event
  for נועה & איתי: start wizard, event home, design gallery, design-from-photos, editor, share, guests &
  WhatsApp, RSVPs, tasks & vendors, budget gauge, seating, event-day check-in, live gallery & hall
  screen, film & insights, help panel.

## Customizations

- **One caption track only** — the captions are part of the picture; the site's player no longer adds a
  second captions track (it showed them twice).
- Callouts, highlights, zooms and small motion moments on the real screens, so each innovative feature
  reads at a glance (the budget gauge swinging green→amber→red on the words, the RSVP count, WhatsApp
  sending, drag-and-drop seating, the live gallery on the hall screen…).
- End card: "שימוש חינם" with the Badook logo and the site's address.
- Two formats: 1920×1080 (desktop) and 1080×1920 (phones — the site serves it on narrow screens).

## Notes

- Replace "אביחי & רותם" (the previous demo data) everywhere with the site's sample "נועה & איתי".
- The production site, YouTube and production storage are unreachable from this container; every
  capture comes from the local build of the same code.
- Brand: Badook (באדוק), brand brown `#a0703f`, deep `#7a5230`, warm cream canvas, Heebo, RTL Hebrew.
- Replaces `public/video/badook-tour.mp4`, `badook-tour-portrait.mp4` and `tour-poster.jpg` in the app.
