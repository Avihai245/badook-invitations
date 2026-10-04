import type { TemplateManifest } from '@/features/invitations/contracts/types';
import { TEMPLATES } from '@/features/invitations/templates/registry';

/** How many designs the home page's HTML carries; the rest come as one pre-rendered fragment (DesignsMore). */
export const INITIAL_DESIGNS = 8;

/** The public designs (an unlisted one — manifest `listed: false` — isn't offered on the home page). */
export const listedDesigns = (): TemplateManifest[] =>
  [...TEMPLATES.values()].map(({ manifest }) => manifest).filter((m) => m.listed);
