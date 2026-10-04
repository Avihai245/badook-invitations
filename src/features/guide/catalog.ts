import type { NavKey } from '@/features/invitations/app/workspace/stages';

/**
 * The guide's addresses without its words, for code that is on every page (the help panel's links, the
 * "in the guide" button): the articles themselves (articles.ts) are loaded only when the guide is shown.
 * Kept in step with articles.ts by tests/unit/guide.test.ts.
 */
export const GUIDE_SLUGS = [
  'quick-start',
  'event-home',
  'navigation',
  'create-invitation',
  'design-from-photos',
  'publish-and-share',
  'import-guests',
  'personal-links',
  'whatsapp-sending',
  'rsvp-and-notifications',
  'tasks',
  'budget-gauge',
  'vendors',
  'ideas',
  'seating',
  'send-table',
  'event-day',
  'live-gallery',
  'hall-screen',
  'moments-film',
  'insights-privacy',
  'plans-billing',
  'event-settings',
] as const;

/** Each event screen's own article: the first of the articles that explain it. */
export const GUIDE_SCREEN_ARTICLE: Partial<Record<NavKey, string>> = {
  home: 'event-home',
  tasks: 'tasks',
  budget: 'budget-gauge',
  vendors: 'vendors',
  ideas: 'ideas',
  design: 'create-invitation',
  guests: 'import-guests',
  share: 'publish-and-share',
  responses: 'rsvp-and-notifications',
  seating: 'seating',
  live: 'send-table',
  gallery: 'live-gallery',
  film: 'moments-film',
  insights: 'insights-privacy',
  settings: 'event-settings',
};
