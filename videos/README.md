# The narrated tour (HyperFrames)

`badook-tour/` (16:9) and `badook-tour-portrait/` (9:16) are the "סיור מלא במערכת" video: 17 frames over the
user's own recording (`video/NARRATION.he.md`, read verbatim), the system's real screens with the site's sample
event נועה & איתי, one caption layer (phrases, in the picture), ending on "שימוש חינם".

Heavy inputs are not in git (`capture/`, `assets/`, `renders/`). To rebuild them on the local stack:

1. `scripts/seed-demo-event.sql` — the demo event as נועה & איתי (guests, replies, vendors, seating, check-ins…);
   gallery photos are uploaded through the guest upload page.
2. `scripts/capture-screens.mjs` (+ `capture-extra.mjs`) — desktop 2× / phone 3× screens and the measured element
   boxes (`capture/extracted/screen-boxes.json`); `record-invitation.mjs` — the invitation on a phone
   (`set-hero-media.sh` sets its background; drop the user's video there when it arrives).
3. `scripts/voice-align.py <recording.mp3>` — cuts the recording per frame at its pauses + word timings →
   `audio_meta.json`; `scripts/phrase-captions.py` — phrase-level captions (after `captions.mjs build`).
4. `scripts/assemble.sh` (never the assembler twice by hand: it hoists the frame video out of the frame file),
   then `transitions.mjs inject`, `npx hyperframes render --quality high --output renders/video.mp4`.
5. Site files: `node scripts/encode-site-video.mjs tour.landscape|tour.portrait <render>` (and `tour.poster`).
