import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      '.next*/**',
      'out/**',
      'coverage/**',
      'tests/.artifacts/**',
      'node_modules/**',
      'public/**',
      'docs/**',
      'invitation-templates-pack/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Directional layout must use logical properties (MASTER_PROMPT §8); enforced in review + tests.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The guest invitation renderer: media is served straight from Supabase Storage (long cache
    // headers, §1.1 rule 6) with explicit loading/decoding/fetchpriority — no Next image optimizer on
    // the guest path; and its App Router root layout writes <head> itself (fonts, preloads).
    files: ['src/features/invitations/**/*.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
      '@next/next/no-head-element': 'off',
    },
  },
];

export default config;
