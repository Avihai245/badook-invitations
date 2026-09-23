import { InvitationDocumentSchema } from './schemas';
import type { InvitationDocument } from './types';

export const LATEST_SCHEMA_VERSION = 1;

type RawDocument = Record<string, unknown>;

/**
 * `MIGRATIONS[n]` upgrades a document from schemaVersion n to n + 1.
 * Add an entry (and bump LATEST_SCHEMA_VERSION + the `schemaVersion` literal in §3) whenever the
 * document shape changes; never edit a published migration.
 */
const MIGRATIONS: Record<number, (doc: RawDocument) => RawDocument> = {};

/** Brings any stored document (draft, published or a version) up to the latest schema and validates it. */
export function migrateDocument(input: unknown): InvitationDocument {
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
  return InvitationDocumentSchema.parse({ ...doc, schemaVersion: LATEST_SCHEMA_VERSION });
}
