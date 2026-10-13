import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Static checks over the migrations (the DB harness has no storage.objects): the buckets that hold guests'
// photos, AI pictures and planning files stay private, and no migration opens storage.objects to the
// browser's roles with a policy — media is reached only through the server's short-lived signed URLs.

const dir = 'supabase/migrations';
const sql = readdirSync(dir)
  .sort()
  .map((f) => ({ f, text: readFileSync(join(dir, f), 'utf8') }));
const all = sql.map((x) => x.text).join('\n');

describe('storage', () => {
  it('no migration creates a policy on storage.objects', () => {
    expect(all).not.toMatch(/create\s+policy[^;]*\bon\s+storage\.objects/i);
    expect(all).not.toMatch(/alter\s+table\s+storage\.objects\s+disable\s+row\s+level\s+security/i);
  });

  it('the buckets with guests’ and hosts’ private files are never public', () => {
    for (const bucket of ['gallery-originals', 'gallery-media', 'ai-photos', 'plan-files']) {
      const inserts = [
        ...all.matchAll(new RegExp(`\\(\\s*'${bucket}'\\s*,\\s*'${bucket}'\\s*,\\s*(true|false)`, 'g')),
      ];
      expect(inserts.length, bucket).toBeGreaterThan(0);
      for (const m of inserts) expect(m[1], bucket).toBe('false');
      expect(all, bucket).not.toMatch(
        new RegExp(`update\\s+storage\\.buckets\\s+set\\s+public\\s*=\\s*true[^;]*'${bucket}'`, 'i'),
      );
    }
  });

  it('the only public buckets are the ones that serve invitation pages and venue plans', () => {
    const pub = [...all.matchAll(/\(\s*'([a-z-]+)'\s*,\s*'\1'\s*,\s*true/g)].map((m) => m[1]).sort();
    expect(pub).toEqual(['invitation-media', 'template-media', 'venue-plans']);
  });
});
