import type { UiLocale } from '@/lib/i18n/app';
import { auditEn } from './audit.en';
import { auditHe } from './audit.he';
import { coreEn } from './core.en';
import { coreHe } from './core.he';
import { financeEn } from './finance.en';
import { financeHe } from './finance.he';
import { invitationsEn } from './invitations.en';
import { invitationsHe } from './invitations.he';
import { messagesEn } from './messages.en';
import { messagesHe } from './messages.he';
import { overviewEn } from './overview.en';
import { overviewHe } from './overview.he';
import { partnersEn } from './partners.en';
import { partnersHe } from './partners.he';
import { staffEn } from './staff.en';
import { staffHe } from './staff.he';
import { supportEn } from './support.en';
import { supportHe } from './support.he';
import { systemEn } from './system.en';
import { systemHe } from './system.he';
import { usersEn } from './users.en';
import { usersHe } from './users.he';

/**
 * The admin console's strings, Hebrew and English (the host app's UI language, the `ui_lang` cookie):
 * the frame and shared words, and one dictionary per area. Only the console's pages load them.
 */
const adminHe = {
  ...coreHe,
  overview: overviewHe,
  users: usersHe,
  invitations: invitationsHe,
  messages: messagesHe,
  finance: financeHe,
  support: supportHe,
  partners: partnersHe,
  staff: staffHe,
  audit: auditHe,
  system: systemHe,
};

export type AdminDict = typeof adminHe;

const adminEn: AdminDict = {
  ...coreEn,
  overview: overviewEn,
  users: usersEn,
  invitations: invitationsEn,
  messages: messagesEn,
  finance: financeEn,
  support: supportEn,
  partners: partnersEn,
  staff: staffEn,
  audit: auditEn,
  system: systemEn,
};

export const adminDict = (locale: UiLocale): AdminDict => (locale === 'en' ? adminEn : adminHe);
