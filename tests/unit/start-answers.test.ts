import { describe, expect, it } from 'vitest';
import { parseWhole, planInit } from '@/features/invitations/app/onboarding/answers';
import { defaultTemplate, START_TYPES } from '@/features/invitations/app/onboarding/StartWizard';

describe('the start wizard (UX report §4.2)', () => {
  it('reads whole numbers the way hosts type them', () => {
    expect(parseWhole('', 10)).toBeNull();
    expect(parseWhole('1,200', 5000)).toBe(1200);
    expect(parseWhole('₪ 150 000', 1e9)).toBe(150000);
    expect(parseWhole('12.5', 100)).toBeUndefined();
    expect(parseWhole('900', 100)).toBeUndefined();
  });
  it('sets the plan up with the budget and the expected guests', () => {
    expect(planInit({ budget: 100000, guests: 146 }, 'wedding')).toEqual({
      op: 'init',
      template: 'wedding',
      totalBudget: 100000,
      guestBasis: 'manual',
      manualAdults: 146,
      manualChildren: 0,
      integrationsMode: 'recommended',
    });
    expect(planInit({ budget: null, guests: null }, 'blank')).not.toHaveProperty('manualAdults');
  });
  it('has a design to start "planning first" with for every kind of event it offers', () => {
    for (const type of START_TYPES) expect(defaultTemplate(type, 'he'), type).not.toBeNull();
  });
});
