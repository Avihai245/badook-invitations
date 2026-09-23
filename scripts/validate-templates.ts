/**
 * Build gate (runs in `prebuild`): every pack template must parse with the §3 schemas and pass
 * the cross-field template rules; the kit fixtures must parse as invitation documents.
 * Exits non-zero on any problem so `npm run build` (and the Amplify build) fails.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { migrateDocument } from '../src/features/invitations/contracts/migrate';
import { TEMPLATES } from '../src/features/invitations/templates/registry';
import { validateTemplate } from '../src/features/invitations/templates/validate-template';

const problems: string[] = [];

for (const entry of TEMPLATES.values()) problems.push(...validateTemplate(entry));

const fixturesDir = join(process.cwd(), 'docs/invitations/fixtures');
for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith('.json'))) {
  try {
    const doc = migrateDocument(JSON.parse(readFileSync(join(fixturesDir, file), 'utf8')));
    if (!TEMPLATES.has(doc.templateId)) problems.push(`${file}: unknown template "${doc.templateId}"`);
  } catch (err) {
    problems.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (problems.length) {
  console.error(`✖ Template pack validation failed (${problems.length}):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ ${TEMPLATES.size} templates and fixtures valid`);
