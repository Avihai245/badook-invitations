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
  // T1: little ones
  'safari-pals',
  'dig-it',
  'ocean-friends',
  'rocket-launch',
  'unicorn-dream',
  // T4: grown-ups & golden years
  'tropical-tiki',
  'vineyard-harvest',
  'campfire-night',
  'golden-years',
  'grandma-garden',
] as const;

export type SceneId = (typeof SCENE_IDS)[number];
