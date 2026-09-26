import { InvitationDocumentSchema } from './schemas';
import type { InvitationDocument } from './types';

export const LATEST_SCHEMA_VERSION = 2;

type RawDocument = Record<string, unknown>;

/**
 * `MIGRATIONS[n]` upgrades a document from schemaVersion n to n + 1 — pure (a new object, the input
 * untouched) and lossless. Add an entry (and bump LATEST_SCHEMA_VERSION + the `schemaVersion` literal in
 * §3) whenever the document shape changes; never edit a published migration. A new field with a schema
 * default (e.g. `music.videoSound`) needs none: parsing fills it in, and editors still open on the
 * previous release keep saving.
 */
const MIGRATIONS: Record<number, (doc: RawDocument) => RawDocument> = {
  /**
   * v1 → v2, the cinematic presentation: per-section `media` / `layout` / `animation` /
   * `themeOverrides`, the section types parents · when · where · quote · custom, and `cover.opening`.
   * All of it is optional and absent means "as in v1", so a v1 document is a v2 one as it is: nothing
   * is added, dropped or renamed, and it renders exactly as before.
   */
  1: (doc) => ({ ...doc, schemaVersion: 2 }),
};

/** The upgraded raw document (not validated yet). Throws on anything that isn't a known document. */
function upgrade(input: unknown): RawDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invitation document must be an object');
  }
  let doc = input as RawDocument;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
  if (!Number.isInteger(version) || version < 1 || version > LATEST_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported invitation schemaVersion: ${String(doc.schemaVersion)}`);
  }
  while (version < LATEST_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`Missing migration from schemaVersion ${version}`);
    doc = migrate(doc);
    version += 1;
  }
  return { ...doc, schemaVersion: LATEST_SCHEMA_VERSION };
}

/**
 * Brings any stored document (draft, published or a version — v1 or v2) up to the latest schema and
 * validates it. Idempotent: a latest document comes back equal to itself.
 */
export function migrateDocument(input: unknown): InvitationDocument {
  return InvitationDocumentSchema.parse(upgrade(input)) as InvitationDocument;
}

export type SafeMigrateResult =
  | { success: true; data: InvitationDocument }
  | { success: false; issues: { path: string; message: string }[] };

/**
 * `migrateDocument` without throwing — what the save and publish paths use: they accept a document of
 * any known version and store the latest one; the issues carry the path of each invalid value.
 */
export function safeMigrateDocument(input: unknown): SafeMigrateResult {
  let raw: RawDocument;
  try {
    raw = upgrade(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, issues: [{ path: err instanceof RangeError ? 'schemaVersion' : '', message }] };
  }
  const parsed = InvitationDocumentSchema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data as InvitationDocument };
  return {
    success: false,
    issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
  };
}
