import { describe, expect, it } from 'vitest';
import { visualLine } from '@/features/invitations/lib/bidi';

describe('visualLine (UAX #9, one line)', () => {
  it('reverses Hebrew', () => {
    expect(visualLine('נועה & איתי', 'rtl')).toBe('יתיא & העונ');
  });
  it('keeps numbers left to right inside Hebrew', () => {
    expect(visualLine('יום חמישי, 17 ביוני 2027', 'rtl')).toBe('2027 ינויב 17 ,ישימח םוי');
    expect(visualLine('אנחנו מתחתנים · 17.06.2027', 'rtl')).toBe('17.06.2027 · םינתחתמ ונחנא');
  });
  it('keeps Latin words whole inside Hebrew', () => {
    expect(visualLine('נועה & Tom Lee', 'rtl')).toBe('Tom Lee & העונ');
  });
  it('mirrors brackets in right-to-left runs', () => {
    expect(visualLine('שלום (עולם)', 'rtl')).toBe('(םלוע) םולש');
  });
  it('keeps gershayim and emoji intact', () => {
    expect(visualLine('י״ב בסיון תשפ״ז', 'rtl')).toBe('ז״פשת ןויסב ב״י');
    expect(visualLine('נועה 💍', 'rtl')).toBe('💍 העונ');
  });
  it('leaves left-to-right text as it is (Hebrew inside it reversed)', () => {
    expect(visualLine('Thursday 17 June 2027', 'ltr')).toBe('Thursday 17 June 2027');
    expect(visualLine('Noa & נועה', 'ltr')).toBe('Noa & העונ');
  });
});
