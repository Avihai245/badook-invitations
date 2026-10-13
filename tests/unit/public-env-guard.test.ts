import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs build script
import { namesIn, parseDotenv, publicEnvProblems } from '../../scripts/check-public-env.mjs';
import { actAsSecret } from '../../src/lib/supabase/act-as-token';

// The build refuses a secret named like a public variable (scripts/check-public-env.mjs, run by `prebuild`).

describe('public env guard', () => {
  it('accepts the variables that are public by design', () => {
    expect(
      publicEnvProblems({
        NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc',
        NEXT_PUBLIC_TEMPLATE_MEDIA_BASE_URL: 'https://cdn.example.com/media',
        NEXT_PUBLIC_BUILD_COMMIT: 'abc1234',
        SUPABASE_SECRET_KEY: 'sb_secret_server_side_is_fine',
      }),
    ).toEqual([]);
  });

  it('rejects a NEXT_PUBLIC_ name that says secret, and says why — never the value', () => {
    const problems = publicEnvProblems({
      NEXT_PUBLIC_STRIPE_SECRET: 'x',
      NEXT_PUBLIC_OPENAI_API_KEY: 'x',
      NEXT_PUBLIC_ADMIN_PASSWORD: 'x',
      NEXT_PUBLIC_SERVICE_ROLE: 'x',
    });
    expect(problems.map((p: { name: string }) => p.name)).toEqual([
      'NEXT_PUBLIC_STRIPE_SECRET',
      'NEXT_PUBLIC_OPENAI_API_KEY',
      'NEXT_PUBLIC_ADMIN_PASSWORD',
      'NEXT_PUBLIC_SERVICE_ROLE',
    ]);
    expect(JSON.stringify(problems)).not.toContain('"x"');
  });

  it('rejects a NEXT_PUBLIC_ variable whose value looks like a secret, whatever its name', () => {
    expect(publicEnvProblems({ NEXT_PUBLIC_FOO: 'sb_secret_abcdef' })).toHaveLength(1);
    expect(publicEnvProblems({ NEXT_PUBLIC_FOO: 'sk-ant-api03-abcdef' })).toHaveLength(1);
    expect(
      publicEnvProblems({
        NEXT_PUBLIC_FOO: 'eyJhbGciOiJIUzI1NiIsInR5.eyJyb2xlIjoic2VydmljZV9yb2xl.c2lnbmF0dXJlMTIz',
      }),
    ).toHaveLength(1);
  });

  it('reads dotenv files', () => {
    expect(parseDotenv('A=1\n# B=2\nNEXT_PUBLIC_X="sb_secret_z"\n')).toEqual({
      A: '1',
      NEXT_PUBLIC_X: 'sb_secret_z',
    });
    expect(namesIn('# commented=1\n# NEXT_PUBLIC_A=\nB=\n')).toEqual(['NEXT_PUBLIC_A', 'B']);
  });
});

describe('act-as signing key', () => {
  it('uses its own key when set, else the Supabase secret key', () => {
    expect(actAsSecret({ INVITES_ACT_AS_SECRET: 'own', SUPABASE_SECRET_KEY: 'supabase' })).toBe('own');
    expect(actAsSecret({ INVITES_ACT_AS_SECRET: '', SUPABASE_SECRET_KEY: 'supabase' })).toBe('supabase');
  });
});
