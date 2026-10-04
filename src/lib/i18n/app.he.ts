import { sectionHelpHe } from './section-help.he';
import { editorHe } from './editor.he';
import { billingHe } from './billing.he';
import { guestsHe } from './guests.he';
import { helpHe } from './help.he';
import { supportHe } from './support.he';
import { seatingHe } from './seating.he';
import { liveGalleryHe } from './live-gallery.he';
import { eventDayHe } from './event-day.he';
import { studioHe, studioHelpHe } from './studio.he';
import { insightsHe } from './insights.he';
import { galleryNotifyHe } from './gallery-notify.he';
import { facesHe } from './faces.he';
import { filmHe } from './film.he';
import { planningHe } from './planning.he';
import { heCore } from './app-core.he';

/**
 * The host app's whole dictionary, Hebrew: the site's (app-core.he.ts — what the public pages need)
 * and the app's own screens (the editor, guests, planning…), which only the app's pages load.
 */
export const he = {
  ...heCore,
  guests: guestsHe,
  help: { ...helpHe, ...studioHelpHe },
  support: supportHe,
  billing: billingHe,
  editor: editorHe,
  seating: seatingHe,
  liveGallery: liveGalleryHe,
  eventDay: eventDayHe,
  studio: studioHe,
  sectionHelp: sectionHelpHe,
  insights: insightsHe,
  galleryNotify: galleryNotifyHe,
  faces: facesHe,
  film: filmHe,
  planning: planningHe,
};

export type AppDict = typeof he;
/** The keys only the app's screens use (not in the public pages' dictionary). */
export type AppOnlyKey =
  | 'guests'
  | 'help'
  | 'support'
  | 'billing'
  | 'editor'
  | 'seating'
  | 'liveGallery'
  | 'eventDay'
  | 'studio'
  | 'sectionHelp'
  | 'insights'
  | 'galleryNotify'
  | 'faces'
  | 'film'
  | 'planning';
/** What the public pages' client components get (provider-lazy `site`). */
export type SiteDict = Omit<AppDict, AppOnlyKey>;
