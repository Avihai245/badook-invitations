/**
 * What the database holds because of the code: a row per template (its manifest) and the published
 * demo invitations (the §10 examples, the home page's samples, one demo per template × event type),
 * owned by a non-login demo user. Shared by scripts/seed.ts (SQL for a fresh database) and the app's
 * startup sync (server/seed-sync.ts), which keeps a deployed database in step with the templates.
 *
 * Slugs: fixtures keep theirs (noa-and-itay, …); demos are demo-<template> for the template's first
 * event type and demo-<template>-<event-type> for the others (the gallery's "Live demo" links).
 */
import { createHash } from 'node:crypto';
import { InvitationDocumentSchema } from '../contracts/schemas';
import type { EventType, InvitationDocument, TemplateManifest } from '../contracts/types';
import { FIXTURES, SAMPLES, demoDocument, videoSampleDocument } from './demo';
import { TEMPLATES } from './registry';

export const DEMO_OWNER_ID = '00000000-0000-4000-8000-00000000d3e0';

/** Stable id per slug, so re-seeding updates rows in place. */
export function idFor(slug: string): string {
  const h = createHash('md5').update(`badook-invitations:${slug}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export interface SeedTemplate {
  id: string;
  manifest: TemplateManifest;
  sort: number;
}

export interface SeedInvitation {
  id: string;
  slug: string;
  templateId: string;
  eventType: EventType;
  doc: InvitationDocument;
}

export const seedTemplates = (): SeedTemplate[] =>
  [...TEMPLATES.values()].map(({ manifest }, sort) => ({ id: manifest.id, manifest, sort }));

export function demoInvitations(): { slug: string; doc: InvitationDocument }[] {
  const out: { slug: string; doc: InvitationDocument }[] = [];
  for (const doc of Object.values(FIXTURES)) out.push({ slug: doc.share.slug, doc: structuredClone(doc) });
  // the home page's second sample: the wedding example with a YouTube video behind the opening
  out.push({ slug: SAMPLES.video, doc: videoSampleDocument() });
  for (const { manifest, defaults } of TEMPLATES.values()) {
    (Object.keys(defaults.defaults) as EventType[]).forEach((type, i) => {
      const slug = i === 0 ? `demo-${manifest.id}` : `demo-${manifest.id}-${type.replace(/_/g, '-')}`;
      const doc = demoDocument(manifest.id, type);
      doc.share.slug = slug;
      out.push({ slug, doc });
    });
  }
  for (const { slug, doc } of out) {
    const parsed = InvitationDocumentSchema.safeParse(doc);
    if (!parsed.success) throw new Error(`seed document ${slug} is invalid: ${parsed.error.message}`);
  }
  return out;
}

export const seedInvitations = (): SeedInvitation[] =>
  demoInvitations().map(({ slug, doc }) => ({
    id: idFor(slug),
    slug,
    templateId: doc.templateId,
    eventType: doc.eventType,
    doc,
  }));

/** A fingerprint of everything above: the startup sync only writes when it changed. */
export function seedVersion(
  templates: SeedTemplate[] = seedTemplates(),
  invitations: SeedInvitation[] = seedInvitations(),
): string {
  return createHash('sha256').update(JSON.stringify({ templates, invitations })).digest('hex').slice(0, 32);
}
