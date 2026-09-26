import type { EventType, L10n } from '../contracts/types';

/**
 * Seed copy for sections that `defaults.json` does not cover (it is user content once seeded,
 * so it lives with the seeding logic rather than in the UI dictionaries) — in every invitation
 * language (the pack's own copy is Hebrew + English; templates/culture-copy.ts completes it).
 */
const EVENING_EVENTS: readonly EventType[] = ['wedding', 'engagement', 'henna', 'save_the_date'];

export const SEED_COPY = {
  timelineTitle: (eventType: EventType): L10n =>
    EVENING_EVENTS.includes(eventType)
      ? {
          he: 'סדר הערב',
          en: 'Timeline of the evening',
          ru: 'Программа вечера',
          ar: 'برنامج السهرة',
          fr: 'Déroulé de la soirée',
          es: 'Programa de la noche',
          am: 'የምሽቱ መርሐ ግብር',
        }
      : {
          he: 'סדר האירוע',
          en: 'Schedule',
          ru: 'Программа',
          ar: 'البرنامج',
          fr: 'Programme',
          es: 'Programa',
          am: 'መርሐ ግብር',
        },
  faqTitle: {
    he: 'שאלות נפוצות',
    en: 'FAQ',
    ru: 'Вопросы и ответы',
    ar: 'أسئلة شائعة',
    fr: 'Questions fréquentes',
    es: 'Preguntas frecuentes',
    am: 'ተደጋጋሚ ጥያቄዎች',
  } satisfies L10n,
  giftsTitle: {
    he: 'מתנות',
    en: 'Gifts',
    ru: 'Подарки',
    ar: 'الهدايا',
    fr: 'Cadeaux',
    es: 'Regalos',
    am: 'ስጦታዎች',
  } satisfies L10n,
  giftsBody: {
    he: 'הנוכחות שלכם היא המתנה הגדולה ביותר. למי שרוצה — אפשר גם כאן:',
    en: 'Your presence is the greatest gift. If you wish, you can also give here:',
    ru: 'Ваше присутствие — лучший подарок. Если захотите, можно также здесь:',
    ar: 'حضوركم هو أجمل هدية. ولمن يرغب، يمكن أيضًا هنا:',
    fr: 'Votre présence est le plus beau des cadeaux. Si vous le souhaitez, vous pouvez aussi participer ici :',
    es: 'Tu presencia es el mejor regalo. Si lo deseas, también puedes hacerlo aquí:',
    am: 'የእርስዎ መገኘት ትልቁ ስጦታ ነው። ከፈለጉ እዚህም መስጠት ይችላሉ፦',
  } satisfies L10n,
  galleryTitle: {
    he: 'גלריה',
    en: 'Gallery',
    ru: 'Галерея',
    ar: 'معرض الصور',
    fr: 'Galerie',
    es: 'Galería',
    am: 'ፎቶዎች',
  } satisfies L10n,
  revealTitle: {
    he: 'שמרו את התאריך',
    en: 'Save the Date',
    ru: 'Запомните дату',
    ar: 'احفظوا الموعد',
    fr: 'Réservez la date',
    es: 'Reserva la fecha',
    am: 'ቀኑን ያስታውሱ',
  } satisfies L10n,
  /** The reveal's prompt per mechanic (the editor swaps an untouched one when the mechanic changes). */
  revealPrompt: {
    scratch: {
      he: '(גרדו כדי לגלות)',
      en: '(scratch to reveal)',
      ru: '(сотрите, чтобы узнать)',
      ar: '(اخدشوا للكشف)',
      fr: '(grattez pour découvrir)',
      es: '(rasca para descubrir)',
      am: '(ለማየት ይፋቁ)',
    },
    tap: {
      he: '(הקישו כדי לגלות)',
      en: '(tap to reveal)',
      ru: '(нажмите, чтобы узнать)',
      ar: '(اضغطوا للكشف)',
      fr: '(touchez pour découvrir)',
      es: '(toca para descubrir)',
      am: '(ለማየት ይንኩ)',
    },
    spin: {
      he: '(הקישו לסיבוב)',
      en: '(tap to spin)',
      ru: '(нажмите, чтобы запустить)',
      ar: '(اضغطوا للتدوير)',
      fr: '(touchez pour lancer)',
      es: '(toca para girar)',
      am: '(ለማሽከርከር ይንኩ)',
    },
  } satisfies Record<'scratch' | 'tap' | 'spin', L10n>,
  /** A save-the-date (§10.3: hero → reveal → a short note → footer) in a template without its own copy. */
  saveTheDate: {
    eyebrow: {
      he: 'אנחנו מתחתנים!',
      en: 'We’re getting married!',
      ru: 'Мы женимся!',
      ar: 'سنتزوّج!',
      fr: 'Nous nous marions !',
      es: '¡Nos casamos!',
      am: 'ልንጋባ ነው!',
    },
    note: {
      he: 'פרק חדש עומד להתחיל, ואנחנו כל כך מתרגשים לחגוג אותו עם האנשים הכי חשובים לנו.\nהזמנה רשמית תישלח בהמשך.',
      en: 'A new chapter is about to begin, and we can’t wait to celebrate it with the people who matter most to us.\nA formal invitation will follow.',
      ru: 'Начинается новая глава, и нам не терпится отпраздновать её с самыми близкими людьми.\nОфициальное приглашение придёт позже.',
      ar: 'فصل جديد على وشك أن يبدأ، ولا نطيق صبرًا للاحتفال به مع أعزّ الناس على قلوبنا.\nستصلكم دعوة رسمية لاحقًا.',
      fr: 'Un nouveau chapitre commence, et nous avons hâte de le célébrer avec les personnes qui comptent le plus pour nous.\nUne invitation officielle suivra.',
      es: 'Un nuevo capítulo está a punto de empezar y estamos deseando celebrarlo con las personas más importantes para nosotros.\nPronto recibirás la invitación formal.',
      am: 'አዲስ ምዕራፍ ሊጀመር ነው፤ ከምንወዳቸው ሰዎች ጋር ለማክበር ጓጉተናል።\nይፋዊ ግብዣ በቅርቡ ይላካል።',
    },
    closing: {
      he: 'באהבה,',
      en: 'With love,',
      ru: 'С любовью,',
      ar: 'مع كل الحب،',
      fr: 'Avec amour,',
      es: 'Con cariño,',
      am: 'በፍቅር፣',
    },
  } satisfies Record<string, L10n>,
  joiner: { he: '&', en: '&', ru: '&', ar: '&', fr: '&', es: '&', am: '&' } satisfies L10n,
  /** Titles of text sections added in the editor when the template has no copy for that kind. */
  textTitles: {
    story: {
      he: 'הסיפור שלנו',
      en: 'Our story',
      ru: 'Наша история',
      ar: 'قصّتنا',
      fr: 'Notre histoire',
      es: 'Nuestra historia',
      am: 'የእኛ ታሪክ',
    },
    transport: {
      he: 'הסעות',
      en: 'Transportation',
      ru: 'Трансфер',
      ar: 'المواصلات',
      fr: 'Navettes',
      es: 'Traslados',
      am: 'ትራንስፖርት',
    },
    accommodation: {
      he: 'לינה',
      en: 'Accommodation',
      ru: 'Проживание',
      ar: 'الإقامة',
      fr: 'Hébergement',
      es: 'Alojamiento',
      am: 'ማረፊያ',
    },
    dress_code: {
      he: 'קוד לבוש',
      en: 'Dress code',
      ru: 'Дресс-код',
      ar: 'قواعد اللباس',
      fr: 'Tenue',
      es: 'Código de vestimenta',
      am: 'የአለባበስ ሥርዓት',
    },
    menu: { he: 'תפריט', en: 'Menu', ru: 'Меню', ar: 'قائمة الطعام', fr: 'Menu', es: 'Menú', am: 'የምግብ ዝርዝር' },
    activities: {
      he: 'פעילויות',
      en: 'Activities',
      ru: 'Развлечения',
      ar: 'الفعاليات',
      fr: 'Animations',
      es: 'Actividades',
      am: 'መዝናኛዎች',
    },
    custom: {
      he: 'חשוב לדעת',
      en: 'Good to know',
      ru: 'Полезно знать',
      ar: 'من المهم معرفته',
      fr: 'Bon à savoir',
      es: 'Conviene saber',
      am: 'ማወቅ ያለብዎት',
    },
  } satisfies Record<string, L10n>,
  venueLabel: {
    he: 'האירוע',
    en: 'The Celebration',
    ru: 'Праздник',
    ar: 'الاحتفال',
    fr: 'La fête',
    es: 'La celebración',
    am: 'በዓሉ',
  } satisfies L10n,
  timelineSample: {
    label: {
      he: 'קבלת פנים',
      en: 'Welcome',
      ru: 'Фуршет',
      ar: 'الاستقبال',
      fr: 'Accueil',
      es: 'Recepción',
      am: 'አቀባበል',
    } satisfies L10n,
  },
  faqSample: {
    he: 'יש חניה במקום?',
    en: 'Is there parking at the venue?',
    ru: 'Есть ли парковка на месте?',
    ar: 'هل توجد مواقف سيارات في المكان؟',
    fr: 'Y a-t-il un parking sur place ?',
    es: '¿Hay aparcamiento en el lugar?',
    am: 'በቦታው የመኪና ማቆሚያ አለ?',
  } satisfies L10n,
} as const;

/** Event types that naturally have two hosts joined by "&". */
export const COUPLE_EVENTS: readonly EventType[] = ['wedding', 'engagement', 'henna', 'save_the_date'];
