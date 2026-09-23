import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/': r('./src/'),
      '@kit/': r('./docs/invitations/'),
      '@pack/': r('./invitation-templates-pack/'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Dates in tests must not depend on the machine's zone.
    env: { TZ: 'UTC' },
  },
});
