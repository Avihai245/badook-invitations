/**
 * Template registry — the pack templates are imported straight from `invitation-templates-pack/`
 * (read, never retyped) and validated with the §3 schemas when this module loads.
 * `npm run build` runs scripts/validate-templates.ts first, so an invalid pack fails the build.
 */
import almondDefaults from '@pack/almond-blossom/defaults.json';
import almondManifest from '@pack/almond-blossom/manifest.json';
import ataraDefaults from '@pack/atara/defaults.json';
import ataraManifest from '@pack/atara/manifest.json';
import bukharaDefaults from '@pack/bukhara/defaults.json';
import bukharaManifest from '@pack/bukhara/manifest.json';
import caesareaDefaults from '@pack/caesarea-shore/defaults.json';
import caesareaManifest from '@pack/caesarea-shore/manifest.json';
import cloudArchDefaults from '@pack/cloud-arch/defaults.json';
import cloudArchManifest from '@pack/cloud-arch/manifest.json';
import cocoaDefaults from '@pack/cocoa-teddy/defaults.json';
import cocoaManifest from '@pack/cocoa-teddy/manifest.json';
import coquetteDefaults from '@pack/coquette-bow/defaults.json';
import coquetteManifest from '@pack/coquette-bow/manifest.json';
import decoDefaults from '@pack/deco-gatsby/defaults.json';
import decoManifest from '@pack/deco-gatsby/manifest.json';
import dinoDefaults from '@pack/dino-hatch/defaults.json';
import dinoManifest from '@pack/dino-hatch/manifest.json';
import honeyDefaults from '@pack/honey-meadow/defaults.json';
import honeyManifest from '@pack/honey-meadow/manifest.json';
import jasperDefaults from '@pack/jasper-cameo/defaults.json';
import jasperManifest from '@pack/jasper-cameo/manifest.json';
import jerusalemDefaults from '@pack/jerusalem-stone/defaults.json';
import jerusalemManifest from '@pack/jerusalem-stone/manifest.json';
import jetSetDefaults from '@pack/jet-set/defaults.json';
import jetSetManifest from '@pack/jet-set/manifest.json';
import kalanitDefaults from '@pack/kalanit/defaults.json';
import kalanitManifest from '@pack/kalanit/manifest.json';
import klafDefaults from '@pack/klaf/defaults.json';
import klafManifest from '@pack/klaf/manifest.json';
import majolicaDefaults from '@pack/majolica/defaults.json';
import majolicaManifest from '@pack/majolica/manifest.json';
import marrakechDefaults from '@pack/marrakech/defaults.json';
import marrakechManifest from '@pack/marrakech/manifest.json';
import martiniDefaults from '@pack/martini-olive/defaults.json';
import martiniManifest from '@pack/martini-olive/manifest.json';
import matchDayDefaults from '@pack/match-day/defaults.json';
import matchDayManifest from '@pack/match-day/manifest.json';
import midnightDefaults from '@pack/midnight-bloom/defaults.json';
import midnightManifest from '@pack/midnight-bloom/manifest.json';
import neonDefaults from '@pack/neon-night/defaults.json';
import neonManifest from '@pack/neon-night/manifest.json';
import nitzanDefaults from '@pack/nitzan/defaults.json';
import nitzanManifest from '@pack/nitzan/manifest.json';
import papercutDefaults from '@pack/papercut-gold/defaults.json';
import papercutManifest from '@pack/papercut-gold/manifest.json';
import ramonDefaults from '@pack/ramon-dusk/defaults.json';
import ramonManifest from '@pack/ramon-dusk/manifest.json';
import rooftopDefaults from '@pack/rooftop-dusk/defaults.json';
import rooftopManifest from '@pack/rooftop-dusk/manifest.json';
import saharDefaults from '@pack/sahar-bordeaux/defaults.json';
import saharManifest from '@pack/sahar-bordeaux/manifest.json';
import scribbleDefaults from '@pack/scribble-love/defaults.json';
import scribbleManifest from '@pack/scribble-love/manifest.json';
import whiteCityDefaults from '@pack/white-city/defaults.json';
import whiteCityManifest from '@pack/white-city/manifest.json';
import { TemplateDefaultsSchema, TemplateManifestSchema } from '../contracts/schemas';
import type { TemplateDefaults, TemplateManifest } from '../contracts/types';

export interface TemplateEntry {
  manifest: TemplateManifest;
  defaults: TemplateDefaults;
}

/**
 * Gallery order: the 8 originals as in design-reference/app.html, then the scene templates, their
 * event types mixed so every filter has something near the top.
 */
const PACK: readonly { manifest: unknown; defaults: unknown }[] = [
  { manifest: saharManifest, defaults: saharDefaults },
  { manifest: papercutManifest, defaults: papercutDefaults },
  { manifest: caesareaManifest, defaults: caesareaDefaults },
  { manifest: ramonManifest, defaults: ramonDefaults },
  { manifest: ataraManifest, defaults: ataraDefaults },
  { manifest: nitzanManifest, defaults: nitzanDefaults },
  { manifest: rooftopManifest, defaults: rooftopDefaults },
  { manifest: honeyManifest, defaults: honeyDefaults },
  { manifest: midnightManifest, defaults: midnightDefaults },
  { manifest: klafManifest, defaults: klafDefaults },
  { manifest: cocoaManifest, defaults: cocoaDefaults },
  { manifest: neonManifest, defaults: neonDefaults },
  { manifest: cloudArchManifest, defaults: cloudArchDefaults },
  { manifest: marrakechManifest, defaults: marrakechDefaults },
  { manifest: dinoManifest, defaults: dinoDefaults },
  { manifest: jasperManifest, defaults: jasperDefaults },
  { manifest: matchDayManifest, defaults: matchDayDefaults },
  { manifest: almondManifest, defaults: almondDefaults },
  { manifest: decoManifest, defaults: decoDefaults },
  { manifest: coquetteManifest, defaults: coquetteDefaults },
  { manifest: kalanitManifest, defaults: kalanitDefaults },
  { manifest: jetSetManifest, defaults: jetSetDefaults },
  { manifest: scribbleManifest, defaults: scribbleDefaults },
  { manifest: jerusalemManifest, defaults: jerusalemDefaults },
  { manifest: bukharaManifest, defaults: bukharaDefaults },
  { manifest: martiniManifest, defaults: martiniDefaults },
  { manifest: majolicaManifest, defaults: majolicaDefaults },
  { manifest: whiteCityManifest, defaults: whiteCityDefaults },
];

function loadTemplates(): Map<string, TemplateEntry> {
  const map = new Map<string, TemplateEntry>();
  for (const raw of PACK) {
    const manifest = TemplateManifestSchema.parse(raw.manifest);
    const defaults = TemplateDefaultsSchema.parse(raw.defaults);
    if (defaults.templateId !== manifest.id) {
      throw new Error(`defaults.json templateId "${defaults.templateId}" ≠ manifest id "${manifest.id}"`);
    }
    if (map.has(manifest.id)) throw new Error(`Duplicate template id "${manifest.id}"`);
    map.set(manifest.id, { manifest, defaults });
  }
  return map;
}

export const TEMPLATES: ReadonlyMap<string, TemplateEntry> = loadTemplates();
export const TEMPLATE_IDS: readonly string[] = [...TEMPLATES.keys()];

export function getTemplate(id: string): TemplateEntry | undefined {
  return TEMPLATES.get(id);
}

export function requireTemplate(id: string): TemplateEntry {
  const entry = TEMPLATES.get(id);
  if (!entry) throw new Error(`Unknown template "${id}"`);
  return entry;
}
