import type { AppDict } from './app.he';
import { sectionHelpEn } from './section-help.en';
import { billingEn } from './billing.en';
import { guestsEn } from './guests.en';
import { helpEn } from './help.en';
import { supportEn } from './support.en';
import { editorEn } from './editor.en';
import { seatingEn } from './seating.en';
import { liveGalleryEn } from './live-gallery.en';
import { eventDayEn } from './event-day.en';
import { studioEn, studioHelpEn } from './studio.en';
import { insightsEn } from './insights.en';
import { galleryNotifyEn } from './gallery-notify.en';
import { facesEn } from './faces.en';
import { filmEn } from './film.en';
import { planningEn } from './planning.en';
import { enCore } from './app-core.en';
import { enMore } from './app-more.en';

/** Host-app UI strings, English: the site's (app-core.en.ts) and the app's screens (app-more.en.ts…). Same shape as app.he.ts. */
export const en: AppDict = {
  ...enCore,
  ...enMore,
  guests: guestsEn,
  help: { ...helpEn, ...studioHelpEn },
  support: supportEn,
  billing: billingEn,
  editor: editorEn,
  seating: seatingEn,
  liveGallery: liveGalleryEn,
  eventDay: eventDayEn,
  studio: studioEn,
  sectionHelp: sectionHelpEn,
  insights: insightsEn,
  galleryNotify: galleryNotifyEn,
  faces: facesEn,
  film: filmEn,
  planning: planningEn,
};
