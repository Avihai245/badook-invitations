import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '@/features/invitations/contracts/types';
import { CATEGORY_KEYS, COST_BASES } from '@/features/planning/model/categories';
import type { PlanTemplate } from '@/features/planning/model/types';
import { TEMPLATES, templateFor, templateKeyFor } from '@/features/planning/templates';

const HEBREW = /[֐-׿]/;
const all = Object.entries(TEMPLATES) as [string, PlanTemplate][];

describe('plan templates', () => {
  it('every event type but the save-the-date has one', () => {
    for (const type of EVENT_TYPES) {
      if (type === 'save_the_date') expect(templateFor(type)).toBeNull();
      else expect(templateFor(type), type).not.toBeNull();
    }
    expect(templateKeyFor('other')).toBe('blank');
  });

  it.each(all)('%s: the keys match and are unique, the offsets are sane', (key, tpl) => {
    expect(tpl.key).toBe(key);
    const keys = tpl.tasks.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of tpl.tasks) {
      expect(t.key, t.key).toMatch(/^[a-z][a-z0-9_]{1,40}$/);
      expect(Number.isInteger(t.offset), t.key).toBe(true);
      expect(t.offset, t.key).toBeGreaterThanOrEqual(-420);
      expect(t.offset, t.key).toBeLessThanOrEqual(30);
      if (t.minDays !== undefined) {
        expect(Number.isInteger(t.minDays), t.key).toBe(true);
        expect(t.minDays, t.key).toBeGreaterThanOrEqual(0);
      }
      if (t.category) expect(CATEGORY_KEYS, t.key).toContain(t.category);
    }
  });

  it.each(all)('%s: every text is in both languages, short, and in its own script', (_key, tpl) => {
    for (const t of tpl.tasks) {
      for (const [field, text] of [
        ['title', t.title],
        ['notes', t.notes],
      ] as const) {
        if (!text) continue;
        expect(text.he.trim().length, `${t.key}.${field}.he`).toBeGreaterThan(0);
        expect(text.en.trim().length, `${t.key}.${field}.en`).toBeGreaterThan(0);
        expect(HEBREW.test(text.he), `${t.key}.${field}.he is Hebrew`).toBe(true);
        expect(HEBREW.test(text.en), `${t.key}.${field}.en has no Hebrew`).toBe(false);
        const max = field === 'title' ? 70 : 170;
        expect(text.he.length, `${t.key}.${field}.he`).toBeLessThanOrEqual(max);
        expect(text.en.length, `${t.key}.${field}.en`).toBeLessThanOrEqual(max);
      }
    }
  });

  it.each(all)('%s: the budget shares add up to 100 and use known categories and bases', (_key, tpl) => {
    expect(tpl.categories.length).toBeGreaterThan(0);
    const keys = tpl.categories.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of tpl.categories) {
      expect(CATEGORY_KEYS).toContain(c.key);
      expect(COST_BASES).toContain(c.basis);
      expect(c.pct).toBeGreaterThan(0);
    }
    expect(tpl.categories.reduce((n, c) => n + c.pct, 0)).toBe(100);
    // every vendor the event needs has a budget line
    for (const v of tpl.requiredVendors) expect(keys, v).toContain(v);
    // every task's category has a budget line too
    for (const t of tpl.tasks) if (t.category) expect(keys, `${t.key} → ${t.category}`).toContain(t.category);
  });

  it('the full templates are full and the light ones are light', () => {
    expect(TEMPLATES.wedding.size).toBe('full');
    expect(TEMPLATES.wedding.tasks.length).toBeGreaterThanOrEqual(50);
    for (const k of ['bar_mitzvah', 'bat_mitzvah'] as const) {
      expect(TEMPLATES[k].size).toBe('full');
      expect(TEMPLATES[k].tasks.length).toBeGreaterThanOrEqual(35);
    }
    expect(TEMPLATES.brit.size).toBe('full');
    expect(TEMPLATES.brit.tasks.length).toBeGreaterThanOrEqual(25);
    for (const k of ['engagement', 'henna', 'baby_shower', 'birthday', 'corporate'] as const) {
      expect(TEMPLATES[k].size, k).toBe('light');
      expect(TEMPLATES[k].tasks.length, k).toBeGreaterThanOrEqual(10);
      expect(TEMPLATES[k].tasks.length, k).toBeLessThanOrEqual(20);
    }
  });

  it('a template starts from its own event types', () => {
    for (const [key, tpl] of all) {
      const types = key === 'blank' ? ['other'] : [key];
      expect([...tpl.eventTypes].sort(), key).toEqual([...types].sort());
    }
  });
});
