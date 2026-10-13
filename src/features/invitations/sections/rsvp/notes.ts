import type { Locale } from '../../contracts/types';

export interface RsvpNotes {
  privacy: string;
  privacyLink: string;
  /**
   * Once the legal documents' version 2 is in force, and the host's form asks for more than the name:
   * the answers are for the hosts, who chose the questions; what is voluntary; how to see, correct or
   * delete them (the hosts, or the privacy request form).
   */
  answers: string;
  answersLink: string;
  demo: string;
  /** on a draft's review page: the reply went nowhere */
  draft: string;
}

/**
 * The RSVP form's two small notes, in the invitation's language: where the reply goes (with the
 * privacy policy), and — on the site's sample invitations — that nothing was sent.
 */
export const RSVP_NOTES: Record<Locale, RsvpNotes> = {
  he: {
    privacy: 'הפרטים נשלחים למארחים ונשמרים עבורם לצורך האירוע בלבד.',
    privacyLink: 'מדיניות הפרטיות',
    answers:
      'התשובות מיועדות למארחים, והם שבחרו את השאלות. מסירתן אינה חובה, פרט לשדות המסומנים כשדות חובה. כדי לראות את התשובות, לתקן או למחוק אותן, אפשר לפנות למארחים או להשתמש בטופס בקשה בנושא פרטיות.',
    answersLink: 'טופס בקשה בנושא פרטיות',
    demo: 'זו הזמנה לדוגמה, כך שהתשובה לא נשמרה ולא נשלחה לאף אחד.',
    draft: 'זו טיוטה לעיון, כך שהתשובה לא נשלחה.',
  },
  en: {
    privacy: 'Your details go to the hosts and are kept for them for this event only.',
    privacyLink: 'Privacy policy',
    answers:
      'Your answers are for the hosts, who chose these questions. Answering is voluntary, except for the fields marked as required. To see, correct or delete your answers, ask the hosts or use the privacy request form.',
    answersLink: 'Privacy request form',
    demo: "This is a sample invitation, so your reply wasn't saved or sent to anyone.",
    draft: "This is a draft for review, so your reply wasn't sent.",
  },
  ru: {
    privacy: 'Ваши данные получат хозяева праздника; они хранятся только для этого мероприятия.',
    privacyLink: 'Политика конфиденциальности',
    answers:
      'Ваши ответы предназначены хозяевам праздника, которые сами выбрали эти вопросы. Отвечать необязательно, кроме полей, отмеченных как обязательные. Чтобы посмотреть, исправить или удалить свои ответы, обратитесь к хозяевам или воспользуйтесь формой запроса по вопросам конфиденциальности.',
    answersLink: 'Форма запроса по вопросам конфиденциальности',
    demo: 'Это пример приглашения, поэтому ваш ответ не сохранён и никому не отправлен.',
    draft: 'Это черновик для просмотра, поэтому ваш ответ не был отправлен.',
  },
  ar: {
    privacy: 'تصل بياناتكم إلى أصحاب الدعوة وتُحفظ لهم لأغراض هذه المناسبة فقط.',
    privacyLink: 'سياسة الخصوصية',
    answers:
      'إجاباتكم موجَّهة لأصحاب الدعوة، وهم الذين اختاروا هذه الأسئلة. الإجابة اختيارية، باستثناء الحقول المعلَّمة بأنها إلزامية. للاطّلاع على إجاباتكم أو تصحيحها أو حذفها، توجّهوا إلى أصحاب الدعوة أو استخدموا نموذج طلب الخصوصية.',
    answersLink: 'نموذج طلب الخصوصية',
    demo: 'هذه دعوة تجريبية، لذلك لم يُحفظ ردّكم ولم يُرسل إلى أحد.',
    draft: 'هذه مسودة للمراجعة، لذلك لم يُرسَل ردكم.',
  },
  fr: {
    privacy:
      'Vos informations sont transmises aux hôtes et conservées pour eux pour cet événement uniquement.',
    privacyLink: 'Politique de confidentialité',
    answers:
      'Vos réponses sont destinées aux hôtes, qui ont choisi ces questions. Y répondre est facultatif, sauf pour les champs marqués comme obligatoires. Pour consulter, corriger ou supprimer vos réponses, adressez-vous aux hôtes ou utilisez le formulaire de demande relative à la vie privée.',
    answersLink: 'Formulaire de demande relative à la vie privée',
    demo: 'Ceci est une invitation d’exemple : votre réponse n’a été ni enregistrée ni envoyée.',
    draft: 'Ceci est un brouillon à relire : votre réponse n’a donc pas été envoyée.',
  },
  es: {
    privacy: 'Tus datos se envían a los anfitriones y se guardan para ellos solo para este evento.',
    privacyLink: 'Política de privacidad',
    answers:
      'Tus respuestas son para los anfitriones, que son quienes eligieron estas preguntas. Responder es voluntario, salvo en los campos marcados como obligatorios. Para ver, corregir o eliminar tus respuestas, pídeselo a los anfitriones o usa el formulario de solicitud de privacidad.',
    answersLink: 'Formulario de solicitud de privacidad',
    demo: 'Esta es una invitación de ejemplo, así que tu respuesta no se ha guardado ni enviado a nadie.',
    draft: 'Esto es un borrador para revisar, así que tu respuesta no se ha enviado.',
  },
  am: {
    privacy: 'መረጃዎ ለጋባዦቹ ይላካል፤ ለዚህ ዝግጅት ብቻ ይቀመጣል።',
    privacyLink: 'የግላዊነት ፖሊሲ',
    answers:
      'መልሶችዎ ለጋባዦቹ ናቸው፤ እነዚህን ጥያቄዎች የመረጡት እነሱ ናቸው። የግዴታ ተብለው ምልክት ከተደረገባቸው መስኮች በስተቀር መልስ መስጠት በፈቃድ ነው። መልሶችዎን ለማየት፣ ለማስተካከል ወይም ለመሰረዝ ጋባዦቹን ይጠይቁ ወይም የግላዊነት ጥያቄ ቅጹን ይጠቀሙ።',
    answersLink: 'የግላዊነት ጥያቄ ቅጽ',
    demo: 'ይህ የናሙና ግብዣ ስለሆነ ምላሽዎ አልተቀመጠም፤ ለማንም አልተላከም።',
    draft: 'ይህ ለግምገማ የቀረበ ረቂቅ ስለሆነ መልስዎ አልተላከም።',
  },
};

/**
 * Whether the RSVP form shows the extra line on who sees the answers: the legal documents' version 2 is
 * in force, and the host's form asks more than a name and a required phone — questions of their own,
 * dietary needs, or an email or phone number the guest may leave out.
 */
export function showsAnswersNote(c: {
  legalNotice?: boolean;
  customQuestions: readonly unknown[];
  askEmail: boolean;
  requireEmail: boolean;
  requirePhone: boolean;
  dietary: { enabled: boolean };
}): boolean {
  return (
    !!c.legalNotice &&
    (c.customQuestions.length > 0 || c.dietary.enabled || (c.askEmail && !c.requireEmail) || !c.requirePhone)
  );
}
