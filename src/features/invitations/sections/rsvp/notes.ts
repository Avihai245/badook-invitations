import type { Locale } from '../../contracts/types';

export interface RsvpNotes {
  privacy: string;
  privacyLink: string;
  demo: string;
}

/**
 * The RSVP form's two small notes, in the invitation's language: where the reply goes (with the
 * privacy policy), and — on the site's sample invitations — that nothing was sent.
 */
export const RSVP_NOTES: Record<Locale, RsvpNotes> = {
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
  ru: {
    privacy: 'Ваши данные получат хозяева праздника; они хранятся только для этого мероприятия.',
    privacyLink: 'Политика конфиденциальности',
    demo: 'Это пример приглашения, поэтому ваш ответ не сохранён и никому не отправлен.',
  },
  ar: {
    privacy: 'تصل بياناتكم إلى أصحاب الدعوة وتُحفظ لهم لأغراض هذه المناسبة فقط.',
    privacyLink: 'سياسة الخصوصية',
    demo: 'هذه دعوة تجريبية، لذلك لم يُحفظ ردّكم ولم يُرسل إلى أحد.',
  },
  fr: {
    privacy:
      'Vos informations sont transmises aux hôtes et conservées pour eux pour cet événement uniquement.',
    privacyLink: 'Politique de confidentialité',
    demo: 'Ceci est une invitation d’exemple : votre réponse n’a été ni enregistrée ni envoyée.',
  },
  es: {
    privacy: 'Tus datos se envían a los anfitriones y se guardan para ellos solo para este evento.',
    privacyLink: 'Política de privacidad',
    demo: 'Esta es una invitación de ejemplo, así que tu respuesta no se ha guardado ni enviado a nadie.',
  },
  am: {
    privacy: 'መረጃዎ ለጋባዦቹ ይላካል፤ ለዚህ ዝግጅት ብቻ ይቀመጣል።',
    privacyLink: 'የግላዊነት ፖሊሲ',
    demo: 'ይህ የናሙና ግብዣ ስለሆነ ምላሽዎ አልተቀመጠም፤ ለማንም አልተላከም።',
  },
};
