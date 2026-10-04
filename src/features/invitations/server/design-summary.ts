import 'server-only';
import { getTemplate } from '../templates/registry';
import type { DesignSummary, InvitationSummary } from './host-db';

/**
 * What the host app's screens draw an invitation's design with (its poster, the events a save-the-date
 * leads to), taken from the registry here, on the server: the registry (every design with its copy in
 * every language) stays out of the browser's code on those screens.
 */
export function designSummary(templateId: string): DesignSummary | null {
  const m = getTemplate(templateId)?.manifest;
  return m ? { id: m.id, fontPairs: m.fontPairs, hero: m.hero, categories: m.categories } : null;
}

export const withDesign = (item: InvitationSummary): InvitationSummary => ({
  ...item,
  design: designSummary(item.templateId),
});
