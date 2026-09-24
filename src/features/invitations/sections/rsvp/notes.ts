import type { Locale } from '../../contracts/types';

/**
 * The RSVP form's two small notes, in the invitation's language: where the reply goes (with the
 * privacy policy), and — on the site's sample invitations — that nothing was sent.
 */
export const RSVP_NOTES: Record<Locale, { privacy: string; privacyLink: string; demo: string }> = {
  he: {
    privacy: 'הפרטים נשלחים למארחים ונשמרים עבורם לצורך האירוע בלבד.',
    privacyLink: 'מדיניות הפרטיות',
    demo: 'זו הזמנה לדוגמה, כך שהתשובה לא נשמרה ולא נשלחה לאף אחד.',
  },
  en: {
    privacy: 'Your details go to the hosts and are kept for them for this event only.',
    privacyLink: 'Privacy policy',
    demo: "This is a sample invitation, so your reply wasn't saved or sent to anyone.",
  },
};
