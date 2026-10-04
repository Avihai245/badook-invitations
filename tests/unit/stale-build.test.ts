import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleBuildError, reloadForNewBuild, STALE_RELOAD_GAP_MS } from '@/lib/stale-build';

describe('a tab left open across a deployment', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recognizes only the errors a gone build causes', () => {
    for (const stale of [
      Object.assign(new Error('Loading chunk 4512 failed.'), { name: 'ChunkLoadError' }),
      new Error('Loading CSS chunk app-layout failed'),
      new TypeError('Failed to fetch dynamically imported module: https://x/_next/static/chunks/a.js'),
      new Error(
        'Failed to find Server Action "7f3a". This request might be from an older or newer deployment.',
      ),
      'ChunkLoadError: Loading chunk 12 failed.',
    ])
      expect(isStaleBuildError(stale)).toBe(true);
    for (const other of [
      new Error('Network request failed'),
      new TypeError('x is undefined'),
      null,
      undefined,
      '',
    ])
      expect(isStaleBuildError(other)).toBe(false);
  });

  it('reloads once a minute at most, so an outage never loops', () => {
    const store = new Map<string, string>();
    const reload = vi.fn();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
      location: { reload },
    });
    const t = 1_000_000_000;
    expect(reloadForNewBuild(t)).toBe(true);
    expect(reloadForNewBuild(t + 5_000)).toBe(false);
    expect(reloadForNewBuild(t + STALE_RELOAD_GAP_MS)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
