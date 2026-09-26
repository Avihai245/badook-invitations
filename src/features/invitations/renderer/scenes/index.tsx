import type { ComponentType, CSSProperties } from 'react';
import AlmondBlossom from './almond-blossom';
import Bukhara from './bukhara';
import CloudArch from './cloud-arch';
import CocoaTeddy from './cocoa-teddy';
import CoquetteBow from './coquette-bow';
import DecoGatsby from './deco-gatsby';
import DinoHatch from './dino-hatch';
import type { SceneId } from './ids';
import JasperCameo from './jasper-cameo';
import JerusalemStone from './jerusalem-stone';
import JetSet from './jet-set';
import Kalanit from './kalanit';
import type { ScenePlace, SceneProps } from './kit';
import Klaf from './klaf';
import Majolica from './majolica';
import Marrakech from './marrakech';
import MartiniOlive from './martini-olive';
import MatchDay from './match-day';
import MidnightBloom from './midnight-bloom';
import NeonNight from './neon-night';
import ScribbleLove from './scribble-love';
import WhiteCity from './white-city';
// T1: little ones
import SafariPals from './safari-pals';
import DigIt from './dig-it';
import OceanFriends from './ocean-friends';
import RocketLaunch from './rocket-launch';

export type { SceneId } from './ids';
export type { ScenePlace } from './kit';

const SCENES: Record<SceneId, ComponentType<SceneProps>> = {
  'cloud-arch': CloudArch,
  'jasper-cameo': JasperCameo,
  'midnight-bloom': MidnightBloom,
  kalanit: Kalanit,
  majolica: Majolica,
  'jerusalem-stone': JerusalemStone,
  marrakech: Marrakech,
  bukhara: Bukhara,
  'scribble-love': ScribbleLove,
  'martini-olive': MartiniOlive,
  klaf: Klaf,
  'neon-night': NeonNight,
  'match-day': MatchDay,
  'jet-set': JetSet,
  'coquette-bow': CoquetteBow,
  'almond-blossom': AlmondBlossom,
  'cocoa-teddy': CocoaTeddy,
  'dino-hatch': DinoHatch,
  'deco-gatsby': DecoGatsby,
  'white-city': WhiteCity,
  // T1: little ones
  'safari-pals': SafariPals,
  'dig-it': DigIt,
  'ocean-friends': OceanFriends,
  'rocket-launch': RocketLaunch,
};

const ROOT: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  containerType: 'size',
  pointerEvents: 'none',
};

/**
 * A template's drawn scene (PlaceholderArt.scene) — the hero's placeholder art, the posters' scenery
 * and the cover's card. It fills its positioned parent; the parent paints the base sky under it.
 */
export function Scene({ id, place, date = null }: { id: SceneId; place: ScenePlace; date?: string | null }) {
  const Art = SCENES[id];
  return (
    <div className="scene" data-scene={id} data-place={place} aria-hidden="true" style={ROOT}>
      <Art place={place} date={date} />
    </div>
  );
}
