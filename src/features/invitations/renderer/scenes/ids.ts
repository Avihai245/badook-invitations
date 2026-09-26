/** The drawn scenes (one per scene template) — ids only, so the placeholder table stays light. */
export const SCENE_IDS = [
  'cloud-arch',
  'jasper-cameo',
  'midnight-bloom',
  'kalanit',
  'majolica',
  'jerusalem-stone',
  'marrakech',
  'bukhara',
  'scribble-love',
  'martini-olive',
  'klaf',
  'neon-night',
  'match-day',
  'jet-set',
  'coquette-bow',
  'almond-blossom',
  'cocoa-teddy',
  'dino-hatch',
  'deco-gatsby',
  'white-city',
  // T3: teens & music
  'pixel-quest',
  'disco-ball',
  'ballet-rose',
  'vinyl-groove',
  'retro-80s',
] as const;

export type SceneId = (typeof SCENE_IDS)[number];
