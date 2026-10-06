/** The seating tutorial (30s at 30fps): an opening, six steps and the end card. */
export const SEATING_SCENES = [
  { id: 'open', dur: 50 },
  { id: 'hall', dur: 130 },
  { id: 'tables', dur: 130 },
  { id: 'families', dur: 130 },
  { id: 'auto', dur: 150 },
  { id: 'send', dur: 110 },
  { id: 'live', dur: 140 },
  { id: 'end', dur: 60 },
] as const;

export const SEATING_TOTAL = SEATING_SCENES.reduce((s, x) => s + x.dur, 0);
export const seatingStart = (i: number) => SEATING_SCENES.slice(0, i).reduce((s, x) => s + x.dur, 0);
