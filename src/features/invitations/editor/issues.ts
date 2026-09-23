import type { InvitationDocument } from '../contracts/types';
import type { Issue } from '../contracts/validate';
import type { PanelId, Selection } from './state/EditorProvider';

/** Document-level paths → the settings/design panel that edits them. */
const PANEL_BY_PREFIX: readonly [string, PanelId][] = [
  ['hosts', 'event'],
  ['event', 'event'],
  ['timezone', 'event'],
  ['eventType', 'event'],
  ['locales', 'languages'],
  ['defaultLocale', 'languages'],
  ['theme.palette', 'palette'],
  ['theme.fontPairId', 'fonts'],
  ['cover', 'cover'],
  ['music', 'music'],
  ['share', 'share'],
];

/**
 * Where the editor takes the host for an issue (§7.7 "click to jump to field"): the section it is in,
 * or the panel of a document-level value. The RSVP deadline is edited in the RSVP section when there
 * is one.
 */
export function issueTarget(issue: Issue, doc: InvitationDocument): Selection | null {
  const byIndex = /^sections\.(\d+)/.exec(issue.path);
  const sectionId = issue.sectionId ?? (byIndex ? doc.sections[Number(byIndex[1])]?.id : undefined);
  if (sectionId && doc.sections.some((s) => s.id === sectionId)) return { kind: 'section', id: sectionId };
  if (issue.path.startsWith('event.rsvpDeadline')) {
    const rsvp = doc.sections.find((s) => s.type === 'rsvp');
    if (rsvp) return { kind: 'section', id: rsvp.id };
  }
  for (const [prefix, panel] of PANEL_BY_PREFIX)
    if (issue.path === prefix || issue.path.startsWith(`${prefix}.`)) return { kind: 'panel', panel };
  return null;
}
