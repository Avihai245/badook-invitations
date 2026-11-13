import { describe, expect, it } from 'vitest';
import { ipFromHeaders } from '@/lib/client-ip';

/** The visitor's address for rate limits: what the client can't write when the proxies are known. */

const h = (entries: Record<string, string>) => new Headers(entries);

describe('the visitor’s address', () => {
  it('CloudFront-Viewer-Address first, without its port', () => {
    expect(
      ipFromHeaders(h({ 'cloudfront-viewer-address': '203.0.113.7:51234', 'x-forwarded-for': '1.1.1.1' })),
    ).toBe('203.0.113.7');
    expect(ipFromHeaders(h({ 'cloudfront-viewer-address': '[2001:db8::1]:443' }))).toBe('2001:db8::1');
  });

  it('with the proxies counted, the client’s own X-Forwarded-For entries change nothing', () => {
    // the client wrote "6.6.6.6, 7.7.7.7"; CloudFront appended the real address
    const spoofed = h({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 198.51.100.4' });
    expect(ipFromHeaders(spoofed, 1)).toBe('198.51.100.4');
    // CloudFront, then a load balancer
    expect(ipFromHeaders(h({ 'x-forwarded-for': '6.6.6.6, 198.51.100.4, 10.0.0.9' }), 2)).toBe(
      '198.51.100.4',
    );
    // fewer entries than proxies: the first one
    expect(ipFromHeaders(h({ 'x-forwarded-for': '198.51.100.4' }), 2)).toBe('198.51.100.4');
  });

  it('unset: the first hop, as before; x-real-ip when there is none', () => {
    expect(ipFromHeaders(h({ 'x-forwarded-for': '198.51.100.4, 10.0.0.9' }), 0)).toBe('198.51.100.4');
    expect(ipFromHeaders(h({ 'x-real-ip': '198.51.100.5' }), 0)).toBe('198.51.100.5');
    expect(ipFromHeaders(h({}), 0)).toBeNull();
  });
});
