import type { DictKey } from '../../i18n/dictionary';
import type { Entry } from '../../i18n/format';

/**
 * The system strings the RSVP form shows — sent to it in the page's language (RsvpView), so the
 * browser never needs the dictionaries.
 */
export const RSVP_KEYS = [
  'rsvp.willAttend',
  'rsvp.yes',
  'rsvp.no',
  'rsvp.adults',
  'rsvp.children',
  'rsvp.decrease',
  'rsvp.increase',
  'rsvp.adultDetails',
  'rsvp.childDetails',
  'rsvp.primaryContact',
  'rsvp.person',
  'rsvp.child',
  'rsvp.firstName',
  'rsvp.lastName',
  'rsvp.fullName',
  'rsvp.age',
  'rsvp.phone',
  'rsvp.phonePlaceholder',
  'rsvp.email',
  'rsvp.dietary',
  'rsvp.dietaryNotes',
  'rsvp.message',
  'rsvp.submit',
  'rsvp.sending',
  'rsvp.editResponse',
  'rsvp.alreadyReplied',
  'rsvp.error.required',
  'rsvp.error.phone',
  'rsvp.error.email',
  'rsvp.error.contact',
  'rsvp.error.network',
  'diet.none',
  'diet.kosher',
  'diet.kosher_mehadrin',
  'diet.vegetarian',
  'diet.vegan',
  'diet.gluten_free',
  'diet.dairy_free',
  'diet.pescatarian',
  'diet.nut_allergy',
  'diet.other_allergy',
  'diet.kids_meal',
] as const satisfies readonly DictKey[];

export type RsvpKey = (typeof RSVP_KEYS)[number];
export type RsvpStrings = Record<RsvpKey, Entry>;
