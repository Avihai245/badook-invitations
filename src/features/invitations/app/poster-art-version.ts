/**
 * The pre-rendered posters' version (scripts/build-poster-art.tsx → public/poster-art/<v>/): a hash
 * of what draws them — the poster, its scenes and placeholder art, the templates and their sample
 * words, the fonts — so its files
 * are cached for good (immutable) and a change gets new addresses. Node only: read by next.config.ts
 * (which hands it to the pages as INVITES_POSTER_ART_VERSION) and by the build script, the same way.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCES = [
  'src/features/invitations/app/TemplatePoster.tsx',
  'src/features/invitations/app/poster.ts',
  'src/features/invitations/app/poster-art.ts',
  'src/features/invitations/app/LazyTemplatePoster.tsx',
  'src/features/site/home/DesignCard.tsx',
  'src/features/site/home/designs.ts',
  'src/features/site/Reveal.tsx',
  'src/lib/i18n',
  'src/features/invitations/renderer/scenes',
  'src/features/invitations/renderer/placeholders.ts',
  'src/features/invitations/templates',
  'src/features/invitations/lib/text.ts',
  'src/features/invitations/fonts/font-faces.generated.json',
  'invitation-templates-pack',
  'scripts/build-poster-art.tsx',
  'package-lock.json',
];
/** Source files only (the pack's pictures and docs don't draw a poster). */
const SOURCE_FILE = /\.(tsx?|json)$/;

function files(path: string): string[] {
  if (!statSync(path).isDirectory()) return SOURCE_FILE.test(path) ? [path] : [];
  return readdirSync(path)
    .sort()
    .flatMap((name) => files(join(path, name)));
}

export function posterArtVersion(root = process.cwd()): string {
  const hash = createHash('sha256');
  for (const source of SOURCES) {
    for (const file of files(join(root, source))) {
      hash.update(file.slice(root.length));
      hash.update(readFileSync(file));
    }
  }
  return hash.digest('hex').slice(0, 12);
}
