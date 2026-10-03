import { describe, expect, it } from 'vitest';
import { GAUGE_MAX, gaugeArc, gaugePoint, readGauge, zoneOf } from '@/features/planning/model/gauge';

describe('readGauge — the budget speedometer (UX report §4.5)', () => {
  it('measures what is committed (or paid, when more) against the budget', () => {
    const r = readGauge({ total: 100_000, committed: 44_100, paid: 7_000, planned: 100_000 })!;
    expect(r.percent).toBe(44);
    expect(r.zone).toBe('safe');
    expect(r.left).toBe(55_900);
    expect(r.ghost).toBeCloseTo(1);
    expect(r.paidMark).toBeCloseTo(0.07);
    expect(readGauge({ total: 1000, committed: 0, paid: 300, planned: 0 })!.percent).toBe(30);
  });
  it('has three zones: safe below 85%, close to 100%, over past it', () => {
    expect(zoneOf(0.84)).toBe('safe');
    expect(zoneOf(0.85)).toBe('close');
    expect(zoneOf(1)).toBe('close');
    expect(zoneOf(1.01)).toBe('over');
  });
  it('pins the needle at the end of the scale and says by how much it is over', () => {
    const r = readGauge({ total: 100, committed: 200, paid: 0, planned: 100 })!;
    expect(r.needle).toBe(GAUGE_MAX);
    expect(r.pinned).toBe(true);
    expect(r.left).toBe(-100);
  });
  it('has nothing to say without a budget', () => {
    expect(readGauge({ total: null, committed: 5, paid: 0, planned: 0 })).toBeNull();
    expect(readGauge({ total: 0, committed: 5, paid: 0, planned: 0 })).toBeNull();
  });
});

describe('gauge geometry', () => {
  const geo = { cx: 100, cy: 100, r: 80 };
  it('starts on the start side (mirrored right-to-left) and ends on the other', () => {
    expect(gaugePoint(0, geo, false).x).toBeCloseTo(20);
    expect(gaugePoint(GAUGE_MAX, geo, false).x).toBeCloseTo(180);
    expect(gaugePoint(0, geo, true).x).toBeCloseTo(180);
    expect(gaugePoint(GAUGE_MAX / 2, geo, true).y).toBeCloseTo(20);
  });
  it('draws the arc over the top in both directions', () => {
    expect(gaugeArc(0, 1, geo, false)).toMatch(/A 80 80 0 0 1 /);
    expect(gaugeArc(0, 1, geo, true)).toMatch(/A 80 80 0 0 0 /);
  });
});
