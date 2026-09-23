import 'server-only';
import { cache } from 'react';
import {
  EVENT_TYPES,
  LOCALES,
  type EventType,
  type InvitationDocument,
  type Locale,
} from '../contracts/types';
import { FIXTURES, demoDocument, stressDocument, type FixtureId } from '../templates/demo';
import { getTemplate, type TemplateEntry } from '../templates/registry';

export const DEV_DOCS = ['demo', 'stress', ...(Object.keys(FIXTURES) as FixtureId[])] as const;

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/**
 * Kitchen-sink documents: `demo` (seeded from the template defaults), `demo-<eventType>`, `stress`
 * (longest allowed strings) or one of the §10 fixtures rendered with any template.
 */
export const loadDevDocument = cache(
  (templateId: string, docKey: string): { doc: InvitationDocument; entry: TemplateEntry } | null => {
    const entry = getTemplate(templateId);
    if (!entry) return null;
    let doc: InvitationDocument;
    if (docKey in FIXTURES) {
      doc = { ...structuredClone(FIXTURES[docKey as FixtureId]), templateId };
    } else if (docKey === 'demo') {
      doc = demoDocument(templateId);
    } else if (docKey === 'stress') {
      doc = stressDocument(templateId);
    } else if (docKey.startsWith('demo-') && (EVENT_TYPES as readonly string[]).includes(docKey.slice(5))) {
      doc = demoDocument(templateId, docKey.slice(5) as EventType);
    } else {
      return null;
    }
    return { doc, entry };
  },
);
