import { describe, expect, it } from 'vitest';
import { formatPhone, toE164 } from '@/features/invitations/lib/phone';

describe('toE164', () => {
  it('normalizes Israeli numbers however they are typed', () => {
    for (const typed of [
      '050-123-4567',
      '0501234567',
      '050 123 4567',
      '+972 50-123-4567',
      '972501234567',
      '00972501234567',
    ])
      expect(toE164(typed)).toBe('+972501234567');
    expect(toE164('03-555-1234')).toBe('+97235551234');
  });
  it('keeps a foreign number with its country code', () => {
    expect(toE164('+1 (212) 555-0123')).toBe('+12125550123');
    expect(toE164('0044 20 7946 0958')).toBe('+442079460958');
  });
  it('leaves what does not parse as typed', () => {
    expect(toE164(' 12345 ')).toBe('12345');
  });
});

describe('formatPhone', () => {
  it('shows Israeli numbers nationally and others internationally', () => {
    expect(formatPhone('+972501234567')).toBe('050-123-4567');
    expect(formatPhone('+12125550123')).toBe('+1 212 555 0123');
    expect(formatPhone('12345')).toBe('12345');
  });
});
