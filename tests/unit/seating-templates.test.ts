import { describe, expect, it } from 'vitest';
import { bounds } from '@/features/seating/geometry';
import { DEFAULT_SETTINGS, LIMITS, type Plan } from '@/features/seating/model';
import { HALL_TEMPLATES, applyTemplate, tablesFor, templateItems } from '@/features/seating/templates';

const empty = (): Plan =>
  ({
    tables: [],
    assignments: {},
    rules: [],
    units: {},
    layout: {
      background: null,
      metersPerPixel: null,
      source: null,
      venuePlan: null,
      gridM: 0.5,
      landmarks: [],
      settings: DEFAULT_SETTINGS,
    },
  }) as unknown as Plan;

const overlap = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('hall templates — a ready-made room to dress up', () => {
  it('as many tables as the guests need, inside the room, never on the stage, the dance floor or a door', () => {
    for (const key of HALL_TEMPLATES) {
      const { landmarks, tables } = templateItems(key, 120);
      expect(landmarks.length).toBeGreaterThanOrEqual(3);
      expect(tables.length).toBeGreaterThanOrEqual(Math.min(tablesFor(key, 120), 6));
      for (const t of tables) {
        const b = bounds(t);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(LIMITS.roomW);
        expect(b.y + b.h).toBeLessThanOrEqual(LIMITS.roomH);
        for (const m of landmarks)
          expect(overlap(b, bounds(m)), `${key}: a table on the ${m.kind}`).toBe(false);
      }
      // tables don't overlap each other
      for (let i = 0; i < tables.length; i++)
        for (let j = i + 1; j < tables.length; j++)
          expect(overlap(bounds(tables[i]!), bounds(tables[j]!))).toBe(false);
    }
  });

  it('120 guests at a classic hall: twelve round tables of ten', () => {
    expect(tablesFor('classic', 120)).toBe(12);
    const { tables } = templateItems('classic', 120);
    expect(tables).toHaveLength(12);
    expect(new Set(tables.map((t) => `${t.shape}:${t.capacity}`))).toEqual(new Set(['round:10']));
  });

  it('a banquet hall has a head table before the stage, and long tables', () => {
    const { tables } = templateItems('banquet', 100);
    expect(tables[0]).toMatchObject({ shape: 'knights', capacity: 12 });
    expect(tables.slice(1).every((t) => t.shape === 'knights')).toBe(true);
  });

  it('applies to a plan: the landmarks replaced, the tables numbered, one plan to undo', () => {
    const plan = applyTemplate(empty(), 'garden', 60);
    expect(plan.layout.landmarks.map((m) => m.kind)).toContain('dance');
    expect(plan.tables.map((t) => t.number)).toEqual(plan.tables.map((_, i) => i + 1));
    expect(new Set(plan.tables.map((t) => t.id)).size).toBe(plan.tables.length);
  });
});
