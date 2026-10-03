import type { EventType } from '@/features/invitations/contracts/types';
import type { PlanTemplate } from '../model/types';
import { babyShower } from './baby-shower';
import { barMitzvah, batMitzvah } from './mitzvah';
import { birthday } from './birthday';
import { blank } from './blank';
import { brit } from './brit';
import { corporate } from './corporate';
import { engagement } from './engagement';
import { henna } from './henna';
import { wedding } from './wedding';

/**
 * The plans an event starts from, one per kind of event, kept in code (typed, reviewed, in Hebrew and
 * English) like the invitation designs. The host's own private templates (the Business plan) are
 * rows in plan_templates, in this same shape.
 */
export const TEMPLATES = {
  wedding,
  bar_mitzvah: barMitzvah,
  bat_mitzvah: batMitzvah,
  brit,
  engagement,
  henna,
  baby_shower: babyShower,
  birthday,
  corporate,
  blank,
} as const satisfies Record<string, PlanTemplate>;
export type TemplateKey = keyof typeof TEMPLATES;
export const isTemplateKey = (v: unknown): v is TemplateKey =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATES, v);

const BY_TYPE: Record<EventType, TemplateKey | null> = {
  wedding: 'wedding',
  bar_mitzvah: 'bar_mitzvah',
  bat_mitzvah: 'bat_mitzvah',
  brit: 'brit',
  engagement: 'engagement',
  henna: 'henna',
  baby_shower: 'baby_shower',
  birthday: 'birthday',
  corporate: 'corporate',
  other: 'blank',
  // a save-the-date has nothing to plan: the plan lives on the full invitation made from it
  save_the_date: null,
};

/** The template an event of this type starts from (null: the event has no plan). */
export function templateKeyFor(type: EventType): TemplateKey | null {
  return BY_TYPE[type];
}
export function templateFor(type: EventType): PlanTemplate | null {
  const key = BY_TYPE[type];
  return key ? TEMPLATES[key] : null;
}
