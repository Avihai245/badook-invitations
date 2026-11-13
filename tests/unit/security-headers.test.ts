import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { homeBoot } from '@/features/site/home/home-boot';
import {
  SIGNED_IN_COOKIE,
  sessionCookieOptions,
  signedInChange,
  signedInCookie,
} from '@/lib/supabase/auth-paths';

/**
 * The security headers every response carries (next.config.ts headers()), the session cookies'
 * options, and the home page's "signed in?" check that no longer reads the (httpOnly) session cookie.
 */

type Rule = { source: string; headers: { key: string; value: string }[] };

/** The headers a path gets: every rule whose source matches, a later one overriding the same key. */
async function headersFor(path: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers!()) as Rule[];
  const out: Record<string, string> = {};
  for (const rule of rules) {
    // the few source shapes next.config.ts uses: '/x/:path*', '/:path*' and one regex group
    const pattern = rule.source.startsWith('/((?!')
      ? new RegExp(`^${rule.source}$`)
      : new RegExp(`^${rule.source.replace(':path*', '.*')}$`);
    if (pattern.test(path)) for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

describe('security headers', () => {
  it('every page: HSTS, nosniff, a referrer policy that keeps link tokens home, unused powers off', async () => {
    for (const path of ['/', '/i/noa-and-itay', '/app/invitations', '/e/x/table', '/api/invitations/rsvp']) {
      const h = await headersFor(path);
      expect(h['strict-transport-security']).toMatch(/max-age=\d{8}; includeSubDomains/);
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(h['permissions-policy']).toContain('microphone=()');
      expect(h['permissions-policy']).toContain('geolocation=()');
      expect(h['permissions-policy']).toContain('camera=(self)');
      // payment is left to its default: Tranzila's frame asks for it with allow="payment"
      expect(h['permissions-policy']).not.toContain('payment');
    }
  });

  it('no page can be framed by another site — except the payment frame’s return page', async () => {
    for (const path of ['/', '/i/noa-and-itay', '/app/admin', '/login', '/e/x/upload']) {
      const h = await headersFor(path);
      expect(h['x-frame-options']).toBe('SAMEORIGIN');
      expect(h['content-security-policy']).toContain("frame-ancestors 'self'");
      expect(h['content-security-policy']).toContain("object-src 'none'");
      expect(h['content-security-policy']).toContain("base-uri 'self'");
    }
    const ret = await headersFor('/api/billing/tranzila/return');
    expect(ret['x-frame-options']).toBeUndefined();
    expect(ret['content-security-policy']).toBeUndefined();
  });

  it('the draft review page still sends no referrer at all', async () => {
    expect((await headersFor('/review/abc'))['referrer-policy']).toBe('no-referrer');
  });
});

describe('session cookies', () => {
  it('are httpOnly and SameSite=Lax; Secure on an https deployment', () => {
    expect(sessionCookieOptions('https://invitations.badooks.com')).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(sessionCookieOptions('http://127.0.0.1:3100').secure).toBe(false);
    expect(sessionCookieOptions(undefined).httpOnly).toBe(true);
  });

  it('the home page sends a signed-in visitor on by the marker (or a session cookie from before)', () => {
    const run = (cookie: string) => {
      const replaced: string[] = [];
      new Function('document', 'location', homeBoot('he'))(
        { cookie },
        { replace: (to: string) => replaced.push(to) },
      );
      return replaced;
    };
    expect(run(`${SIGNED_IN_COOKIE}=1`)).toEqual(['/app/invitations']);
    expect(run(`a=b; ${SIGNED_IN_COOKIE}=1; c=d`)).toEqual(['/app/invitations']);
    expect(run('sb-abc-auth-token=x')).toEqual(['/app/invitations']);
    expect(run(`${SIGNED_IN_COOKIE}=0`)).toEqual([]);
    expect(run('')).toEqual([]);
  });

  it('the marker follows the session wherever Supabase writes it (a sign-in in a server action too)', () => {
    const set = { maxAge: 400 * 86400 };
    // a session written (in chunks, an old chunk removed beside it)
    expect(
      signedInChange([
        { name: 'sb-abc-auth-token.0', value: 'base64-…', options: set },
        { name: 'sb-abc-auth-token.1', value: '', options: { maxAge: 0 } },
      ]),
    ).toBe(true);
    // signed out: every chunk removed
    expect(signedInChange([{ name: 'sb-abc-auth-token', value: '', options: { maxAge: 0 } }])).toBe(false);
    // a PKCE verifier only: says nothing about the session
    expect(
      signedInChange([{ name: 'sb-abc-auth-token-code-verifier', value: 'v', options: set }]),
    ).toBeNull();
    expect(signedInChange([])).toBeNull();
    expect(signedInCookie(true, true)).toMatchObject({ value: '1', options: { secure: true, path: '/' } });
    expect(signedInCookie(false, true)).toEqual({ value: '', options: { path: '/', maxAge: 0 } });
  });
});
