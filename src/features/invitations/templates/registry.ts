/**
 * Template registry — the 8 pack templates are imported straight from `invitation-templates-pack/`
 * (read, never retyped) and validated with the §3 schemas when this module loads.
 * `npm run build` runs scripts/validate-templates.ts first, so an invalid pack fails the build.
 */
import ataraDefaults from '@pack/atara/defaults.json';
import ataraManifest from '@pack/atara/manifest.json';
import caesareaDefaults from '@pack/caesarea-shore/defaults.json';
import caesareaManifest from '@pack/caesarea-shore/manifest.json';
import honeyDefaults from '@pack/honey-meadow/defaults.json';
import honeyManifest from '@pack/honey-meadow/manifest.json';
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
import { TemplateDefaultsSchema, TemplateManifestSchema } from '../contracts/schemas';
import type { TemplateDefaults, TemplateManifest } from '../contracts/types';

export interface TemplateEntry {
  manifest: TemplateManifest;
  defaults: TemplateDefaults;
}

/** Gallery order (as in design-reference/app.html). */
const PACK: readonly { manifest: unknown; defaults: unknown }[] = [
  { manifest: saharManifest, defaults: saharDefaults },
  { manifest: papercutManifest, defaults: papercutDefaults },
  { manifest: caesareaManifest, defaults: caesareaDefaults },
  { manifest: ramonManifest, defaults: ramonDefaults },
  { manifest: ataraManifest, defaults: ataraDefaults },
  { manifest: nitzanManifest, defaults: nitzanDefaults },
  { manifest: rooftopManifest, defaults: rooftopDefaults },
  { manifest: honeyManifest, defaults: honeyDefaults },
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
