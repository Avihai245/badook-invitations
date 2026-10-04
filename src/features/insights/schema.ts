import { z } from 'zod';
import { INSIGHTS } from './config';
import { DEVICES, SOURCES } from './model';

/**
 * What the server accepts of a beacon (model.ts BeaconState). Its own module: the page's beacon imports
 * model.ts for the types and the math, and a zod schema in it would put zod's 27 KB into every guest's
 * browser.
 */
export const BeaconSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  visit: z.uuid(),
  lang: z.string().regex(/^[a-z]{2}$/),
  device: z.enum(DEVICES),
  source: z.enum(SOURCES),
  opened: z.boolean(),
  depth: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  visibleMs: z.number().int().min(0).max(INSIGHTS.beacon.maxVisibleMs),
  rsvpStarted: z.boolean(),
  rsvpSent: z.boolean(),
  calendar: z.boolean(),
  map: z.boolean(),
  gallery: z.boolean(),
  langSwitch: z.boolean(),
});
