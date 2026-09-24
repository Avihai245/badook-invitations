import { describe, expect, it } from 'vitest';
import { preferredBaseUrl } from '../../src/lib/public-url';

// Which address people are shown and sent to (lib/public-url.ts): the configured one, unless it is a
// placeholder or Amplify's default address while the site is used on its own domain.

const AMPLIFY = 'https://main.d37gyv50nh14s3.amplifyapp.com';
const DOMAIN = 'https://invitations.badooks.com';

describe('preferredBaseUrl', () => {
  it('keeps a configured domain, whatever host the request names', () => {
    expect(preferredBaseUrl(DOMAIN, 'invitations.badooks.com', 'https')).toBe(DOMAIN);
    expect(preferredBaseUrl(DOMAIN, 'main.d37gyv50nh14s3.amplifyapp.com', 'https')).toBe(DOMAIN);
    expect(preferredBaseUrl(DOMAIN, 'evil.example', 'https')).toBe(DOMAIN);
  });

  it('Amplify’s default address gives way to the domain the site is used on', () => {
    expect(preferredBaseUrl(AMPLIFY, 'invitations.badooks.com', 'https')).toBe(DOMAIN);
    // …but not to another amplifyapp address, a local one, or plain http
    expect(preferredBaseUrl(AMPLIFY, 'dev.d37gyv50nh14s3.amplifyapp.com', 'https')).toBe(AMPLIFY);
    expect(preferredBaseUrl(AMPLIFY, 'localhost:3000', 'https')).toBe(AMPLIFY);
    expect(preferredBaseUrl(AMPLIFY, 'invitations.badooks.com', 'http')).toBe(AMPLIFY);
  });

  it('an unset address (the localhost default) gives way to any real https host', () => {
    expect(preferredBaseUrl('http://localhost:3000', 'main.d37gyv50nh14s3.amplifyapp.com', 'https')).toBe(
      AMPLIFY,
    );
    expect(preferredBaseUrl('http://localhost:3000', 'localhost:3000', 'http')).toBe('http://localhost:3000');
    expect(preferredBaseUrl('http://127.0.0.1:3200', '127.0.0.1:3200', 'http')).toBe('http://127.0.0.1:3200');
  });

  it('ignores hosts that are not a plain hostname, and the first of a forwarded list wins', () => {
    for (const host of ['evil.example/path', 'a b', 'evil.example@x', '', null])
      expect(preferredBaseUrl(AMPLIFY, host, 'https')).toBe(AMPLIFY);
    expect(preferredBaseUrl(AMPLIFY, 'invitations.badooks.com, main.x.amplifyapp.com', 'https,http')).toBe(
      DOMAIN,
    );
  });
});
