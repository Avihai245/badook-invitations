export const FPS = 30;

/** Scene lengths in frames (45s total). Each scene overlaps the next by OVERLAP frames. */
export const SCENES = [
  { id: 'logo', dur: 120 },
  { id: 'design', dur: 150 },
  { id: 'edit', dur: 150 },
  { id: 'guests', dur: 150 },
  { id: 'rsvp', dur: 150 },
  { id: 'budget', dur: 150 },
  { id: 'seating', dur: 150 },
  { id: 'eventday', dur: 150 },
  { id: 'film', dur: 120 },
  { id: 'end', dur: 60 },
] as const;

export const OVERLAP = 10;
export const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0);

export const sceneStart = (i: number) => SCENES.slice(0, i).reduce((s, x) => s + x.dur, 0);
