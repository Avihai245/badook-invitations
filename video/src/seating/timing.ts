/**
 * The seating tutorial, timed to its recorded narration (public/seating/narration.mp3, 43.8 s): each
 * scene starts in the pause before its sentence, so the picture changes as the voice moves on. The
 * times below were measured from the recording's pauses (ffmpeg silencedetect, −35 dB, ≥ 0.35 s).
 */
export const SEATING_FPS = 30;
const f = (seconds: number) => Math.round(seconds * SEATING_FPS);

/** Where each scene starts, in seconds of the recording (the last entry is the video's end). */
const CUTS = {
  open: 0,
  hall: 2.55,
  tables: 10.95,
  families: 17.2,
  auto: 21.45,
  send: 30.9,
  live: 35.6,
  end: 40.9,
  done: 44.3,
} as const;

const ORDER = ['open', 'hall', 'tables', 'families', 'auto', 'send', 'live', 'end'] as const;
export const SEATING_SCENES = ORDER.map((id, i) => ({
  id,
  dur: f(CUTS[i + 1 < ORDER.length ? ORDER[i + 1]! : 'done']) - f(CUTS[id]),
}));

export const SEATING_TOTAL = SEATING_SCENES.reduce((s, x) => s + x.dur, 0);
export const seatingStart = (i: number) => SEATING_SCENES.slice(0, i).reduce((s, x) => s + x.dur, 0);

/** The narration's sentences, as heard (seconds from, to) — the subtitles, and the scenes' beats. */
export const NARRATION: { from: number; to: number; text: string }[] = [
  { from: 0.0, to: 2.3, text: 'סידור שולחנות — כמו מקצוענים.' },
  { from: 2.88, to: 5.74, text: 'מבקשים מהאולם תמונה של המפה ומעלים אותה,' },
  { from: 6.12, to: 10.69, text: 'או בוחרים באפשרות "תמונת האולם" ותראו מספר טמפלטים מוכנים.' },
  { from: 11.26, to: 15.05, text: 'מוסיפים שולחנות: עגולים, מרובעים או אבירים,' },
  { from: 15.47, to: 16.94, text: 'כל אורח עם הכיסא שלו.' },
  { from: 17.47, to: 21.13, text: 'גוררים משפחה שלמה לשולחן, וכולם יושבים יחד.' },
  { from: 21.81, to: 24.67, text: 'אופציה נוספת זה לתת למערכת שלנו לעזור:' },
  { from: 25.06, to: 30.57, text: 'כותבים במילים מי יושב עם מי, מאשרים את הסידור, והמערכת מושיבה את כולם.' },
  { from: 31.21, to: 35.38, text: 'מדפיסים לאולם, ושולחים לכל אורח את מספר השולחן שלו בוואטסאפ.' },
  { from: 35.86, to: 40.63, text: 'וביום האירוע רואים בלייב מי הגיע, לפי האולם ולפי כל שולחן.' },
  { from: 41.21, to: 43.81, text: 'סידור שולחנות לא היה פשוט כל כך' },
];

/**
 * The subtitle bar's cues, in frames: each sentence stays until the next begins (no flicker in the
 * pauses). Not the first and the last: the opening and the end card say them in big letters.
 */
export const SEATING_CUES = NARRATION.slice(1, -1).map((s, i, all) => ({
  from: f(s.from),
  to: i + 1 < all.length ? f(all[i + 1]!.from) : f(s.to + 0.3),
  text: s.text,
}));

/** A moment of the narration (seconds of the recording) as a frame local to a scene. */
export const beat = (scene: (typeof ORDER)[number], seconds: number) => f(seconds) - f(CUTS[scene]);
