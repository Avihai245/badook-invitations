import type { PlanTemplate } from '../model/types';

/**
 * "Other": nothing assumed. The plan starts with the system tasks only (and whatever the wizard's
 * suggestion — or a copied list — adds); the host builds the rest.
 */
export const blank: PlanTemplate = {
  key: 'blank',
  eventTypes: ['other'],
  size: 'light',
  tasks: [],
  categories: [
    { key: 'venue', pct: 30, basis: 'fixed' },
    { key: 'catering', pct: 35, basis: 'per_guest' },
    { key: 'production', pct: 20, basis: 'fixed' },
    { key: 'other', pct: 15, basis: 'fixed' },
  ],
  requiredVendors: [],
};
