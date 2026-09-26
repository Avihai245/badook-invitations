/**
 * Short headline copy for the design concepts the composer makes without the AI: the hero's eyebrow
 * and the footer's closing line, in three tones — classic, warm, playful — per kind of event, in the
 * seven languages the invitations can be in; a language the bank doesn't have keeps the invitation's
 * own text (the concept leaves that line as it is).
 */
import type { EventType, L10n, Locale } from '../invitations/contracts/types';

export type Tone = 'classic' | 'warm' | 'playful';
type Line = { he: string; en: string; ru: string; ar: string; fr: string; es: string; am: string };
type Lines = { eyebrow: Line; closing: Line };

type Group = 'couple' | 'mitzvah' | 'baby' | 'birthday' | 'general';

const GROUP: Record<EventType, Group> = {
  wedding: 'couple',
  engagement: 'couple',
  henna: 'couple',
  save_the_date: 'couple',
  bar_mitzvah: 'mitzvah',
  bat_mitzvah: 'mitzvah',
  brit: 'baby',
  baby_shower: 'baby',
  birthday: 'birthday',
  corporate: 'general',
  other: 'general',
};

const BANK: Record<Group, Record<Tone, Lines>> = {
  couple: {
    classic: {
      eyebrow: {
        he: 'בשמחה ובהתרגשות',
        en: 'With joy and love',
        ru: 'С радостью и любовью',
        ar: 'بكل الفرح والحب',
        fr: 'Avec joie et amour',
        es: 'Con alegría y amor',
        am: 'በደስታና በፍቅር',
      },
      closing: {
        he: 'נשמח לחגוג איתכם',
        en: 'We can’t wait to celebrate with you',
        ru: 'Будем рады отпраздновать вместе с вами',
        ar: 'يسعدنا أن نحتفل معكم',
        fr: 'Nous avons hâte de célébrer avec vous',
        es: 'Tenemos muchas ganas de celebrar con ustedes',
        am: 'ከእናንተ ጋር ለማክበር በጉጉት እንጠብቃለን',
      },
    },
    warm: {
      eyebrow: {
        he: 'אנחנו מתחתנים!',
        en: 'We’re getting married!',
        ru: 'Мы женимся!',
        ar: 'سنتزوج!',
        fr: 'Nous nous marions\u00a0!',
        es: '¡Nos casamos!',
        am: 'ልንጋባ ነው!',
      },
      closing: {
        he: 'מחכים לראות אתכם, באהבה',
        en: 'See you there, with all our love',
        ru: 'Ждём вас, с любовью',
        ar: 'بانتظاركم، مع كل حبنا',
        fr: 'À très vite, avec tout notre amour',
        es: 'Los esperamos con todo nuestro cariño',
        am: 'በፍቅር እንጠብቃችኋለን',
      },
    },
    playful: {
      eyebrow: {
        he: 'זה קורה!',
        en: 'It’s happening!',
        ru: 'Свершилось!',
        ar: 'لقد حان الوقت!',
        fr: 'Ça y est\u00a0!',
        es: '¡Llegó el día!',
        am: 'ቀኑ ደረሰ!',
      },
      closing: {
        he: 'בואו לרקוד איתנו',
        en: 'Come dance with us',
        ru: 'Приходите танцевать с нами',
        ar: 'تعالوا ارقصوا معنا',
        fr: 'Venez danser avec nous',
        es: 'Vengan a bailar con nosotros',
        am: 'ኑ አብራችሁን ጨፍሩ',
      },
    },
  },
  mitzvah: {
    classic: {
      eyebrow: {
        he: 'בשמחה רבה',
        en: 'With great joy',
        ru: 'С большой радостью',
        ar: 'بفرح عظيم',
        fr: 'Avec une grande joie',
        es: 'Con gran alegría',
        am: 'በታላቅ ደስታ',
      },
      closing: {
        he: 'נשמח לראותכם בשמחתנו',
        en: 'We would be honored by your presence',
        ru: 'Будем рады видеть вас на нашем празднике',
        ar: 'يشرفنا حضوركم',
        fr: 'Votre présence nous honorerait',
        es: 'Será un honor contar con su presencia',
        am: 'መገኘታችሁ ክብር ይሰጠናል',
      },
    },
    warm: {
      eyebrow: {
        he: 'מתרגשים להזמין אתכם',
        en: 'We’re delighted to invite you',
        ru: 'С радостью приглашаем вас',
        ar: 'يسعدنا أن ندعوكم',
        fr: 'Nous sommes ravis de vous inviter',
        es: 'Nos encanta invitarlos',
        am: 'ልንጋብዛችሁ ደስ ብሎናል',
      },
      closing: {
        he: 'מחכים לחגוג איתכם',
        en: 'We can’t wait to celebrate together',
        ru: 'Ждём праздника вместе с вами',
        ar: 'نتطلع للاحتفال معًا',
        fr: 'Nous avons hâte de fêter ça ensemble',
        es: 'Tenemos muchas ganas de celebrar juntos',
        am: 'አብረን ለማክበር በጉጉት እንጠብቃለን',
      },
    },
    playful: {
      eyebrow: {
        he: 'מגיעים לחגוג!',
        en: 'Come celebrate!',
        ru: 'Приходите праздновать!',
        ar: 'تعالوا نحتفل!',
        fr: 'Venez faire la fête\u00a0!',
        es: '¡Vengan a celebrar!',
        am: 'ኑ አብረን እናክብር!',
      },
      closing: {
        he: 'יהיה שמח!',
        en: 'It’s going to be a blast!',
        ru: 'Будет весело!',
        ar: 'ستكون حفلة رائعة!',
        fr: 'Ça va être génial\u00a0!',
        es: '¡Va a ser una gran fiesta!',
        am: 'አስደሳች ይሆናል!',
      },
    },
  },
  baby: {
    classic: {
      eyebrow: {
        he: 'בשמחה רבה',
        en: 'With joy',
        ru: 'С радостью',
        ar: 'بكل فرح',
        fr: 'Avec joie',
        es: 'Con alegría',
        am: 'በደስታ',
      },
      closing: {
        he: 'נשמח לחגוג איתכם',
        en: 'We’d love to celebrate with you',
        ru: 'Будем рады отпраздновать с вами',
        ar: 'يسعدنا الاحتفال معكم',
        fr: 'Nous serions heureux de fêter avec vous',
        es: 'Nos encantaría celebrar con ustedes',
        am: 'ከእናንተ ጋር ብናከብር ደስ ይለናል',
      },
    },
    warm: {
      eyebrow: {
        he: 'המשפחה גדלה!',
        en: 'Our family is growing!',
        ru: 'Наша семья растёт!',
        ar: 'عائلتنا تكبر!',
        fr: 'Notre famille s’agrandit\u00a0!',
        es: '¡Nuestra familia crece!',
        am: 'ቤተሰባችን እያደገ ነው!',
      },
      closing: {
        he: 'מחכים לחבק אתכם',
        en: 'With love and hugs',
        ru: 'С любовью и объятиями',
        ar: 'مع الحب والأحضان',
        fr: 'Avec amour et tendresse',
        es: 'Con amor y abrazos',
        am: 'በፍቅርና በእቅፍ',
      },
    },
    playful: {
      eyebrow: {
        he: 'הגיע הזמן לחגוג!',
        en: 'Time to celebrate!',
        ru: 'Пора праздновать!',
        ar: 'حان وقت الاحتفال!',
        fr: 'C’est l’heure de fêter\u00a0!',
        es: '¡Hora de celebrar!',
        am: 'የማክበሪያ ጊዜ ነው!',
      },
      closing: {
        he: 'בואו לחגוג איתנו',
        en: 'Come celebrate with us',
        ru: 'Приходите праздновать с нами',
        ar: 'تعالوا احتفلوا معنا',
        fr: 'Venez fêter avec nous',
        es: 'Vengan a celebrar con nosotros',
        am: 'ኑ አብራችሁን አክብሩ',
      },
    },
  },
  birthday: {
    classic: {
      eyebrow: {
        he: 'חוגגים יום הולדת',
        en: 'A birthday celebration',
        ru: 'Празднуем день рождения',
        ar: 'احتفال بعيد ميلاد',
        fr: 'Un anniversaire à fêter',
        es: 'Celebramos un cumpleaños',
        am: 'የልደት በዓል',
      },
      closing: {
        he: 'נשמח לראותכם',
        en: 'Hope to see you there',
        ru: 'Надеемся увидеть вас',
        ar: 'نأمل أن نراكم',
        fr: 'Au plaisir de vous y voir',
        es: 'Esperamos verlos allí',
        am: 'እንደምናያችሁ ተስፋ እናደርጋለን',
      },
    },
    warm: {
      eyebrow: {
        he: 'בואו לחגוג איתנו',
        en: 'Come celebrate with us',
        ru: 'Приходите праздновать с нами',
        ar: 'تعالوا احتفلوا معنا',
        fr: 'Venez fêter avec nous',
        es: 'Vengan a celebrar con nosotros',
        am: 'ኑ አብራችሁን አክብሩ',
      },
      closing: {
        he: 'יהיה שמח ומרגש',
        en: 'It will be a joy to see you',
        ru: 'Будем счастливы вас видеть',
        ar: 'سيسعدنا رؤيتكم',
        fr: 'Ce sera un bonheur de vous voir',
        es: 'Será una alegría verlos',
        am: 'እናንተን ማየት ደስታችን ነው',
      },
    },
    playful: {
      eyebrow: {
        he: 'מסיבה!',
        en: 'Party time!',
        ru: 'Время вечеринки!',
        ar: 'وقت الحفلة!',
        fr: 'C’est la fête\u00a0!',
        es: '¡Hora de fiesta!',
        am: 'የድግስ ጊዜ!',
      },
      closing: {
        he: 'מביאים מצב רוח!',
        en: 'Bring your dancing shoes!',
        ru: 'Приходите в танцевальном настроении!',
        ar: 'استعدوا للرقص!',
        fr: 'Prévoyez vos chaussures de danse\u00a0!',
        es: '¡Traigan sus ganas de bailar!',
        am: 'ለጭፈራ ተዘጋጁ!',
      },
    },
  },
  general: {
    classic: {
      eyebrow: {
        he: 'הזמנה',
        en: 'You’re invited',
        ru: 'Вы приглашены',
        ar: 'أنتم مدعوون',
        fr: 'Vous êtes invités',
        es: 'Están invitados',
        am: 'ተጋብዛችኋል',
      },
      closing: {
        he: 'נשמח לראותכם',
        en: 'We look forward to seeing you',
        ru: 'Будем рады вас видеть',
        ar: 'نتطلع لرؤيتكم',
        fr: 'Au plaisir de vous voir',
        es: 'Esperamos verlos',
        am: 'እናንተን ለማየት በጉጉት እንጠብቃለን',
      },
    },
    warm: {
      eyebrow: {
        he: 'מוזמנים לחגוג איתנו',
        en: 'Join us to celebrate',
        ru: 'Присоединяйтесь к празднику',
        ar: 'انضموا إلينا للاحتفال',
        fr: 'Rejoignez-nous pour célébrer',
        es: 'Acompáñennos a celebrar',
        am: 'ከእኛ ጋር ለማክበር ይቀላቀሉ',
      },
      closing: {
        he: 'מחכים לכם',
        en: 'See you there',
        ru: 'До встречи',
        ar: 'نراكم هناك',
        fr: 'À bientôt',
        es: 'Nos vemos allí',
        am: 'እዚያ እንገናኝ',
      },
    },
    playful: {
      eyebrow: {
        he: 'בואו!',
        en: 'Come along!',
        ru: 'Приходите!',
        ar: 'تعالوا!',
        fr: 'Venez nombreux\u00a0!',
        es: '¡Vengan!',
        am: 'ኑ!',
      },
      closing: {
        he: 'יהיה כיף!',
        en: 'It’s going to be fun!',
        ru: 'Будет весело!',
        ar: 'ستكون أوقاتًا ممتعة!',
        fr: 'Ça va être amusant\u00a0!',
        es: '¡Va a ser divertido!',
        am: 'አስደሳች ይሆናል!',
      },
    },
  },
};

/** The warm eyebrow says what the event is where the group's line would be wrong for it. */
const WARM_EYEBROW: Partial<Record<EventType, Line>> = {
  engagement: {
    he: 'התארסנו!',
    en: 'We’re engaged!',
    ru: 'Мы обручились!',
    ar: 'لقد تمت خطوبتنا!',
    fr: 'Nous sommes fiancés\u00a0!',
    es: '¡Nos comprometimos!',
    am: 'ታጭተናል!',
  },
  henna: {
    he: 'חוגגים חינה!',
    en: 'A henna celebration!',
    ru: 'Праздник хны!',
    ar: 'حفلة حناء!',
    fr: 'Une fête du henné\u00a0!',
    es: '¡Una fiesta de henna!',
    am: 'የሄና በዓል!',
  },
  save_the_date: {
    he: 'שמרו את התאריך',
    en: 'Save the date',
    ru: 'Запомните дату',
    ar: 'احفظوا التاريخ',
    fr: 'Réservez la date',
    es: 'Reserven la fecha',
    am: 'ቀኑን ያስታውሱ',
  },
  brit: {
    he: 'נולד לנו בן!',
    en: 'Our son is here!',
    ru: 'У нас родился сын!',
    ar: 'رُزقنا بمولود!',
    fr: 'Notre fils est né\u00a0!',
    es: '¡Nació nuestro hijo!',
    am: 'ወንድ ልጅ ተወለደልን!',
  },
  baby_shower: {
    he: 'תינוק בדרך!',
    en: 'A baby is on the way!',
    ru: 'Малыш уже в пути!',
    ar: 'مولود في الطريق!',
    fr: 'Un bébé est en route\u00a0!',
    es: '¡Viene un bebé en camino!',
    am: 'ልጅ በመንገድ ላይ ነው!',
  },
};

/** A line in every one of `locales`, or null when the bank lacks one of them. */
function l10n(line: Line, locales: readonly Locale[]): L10n | null {
  const out: L10n = {};
  for (const l of locales) {
    const text = (line as Partial<Record<Locale, string>>)[l];
    if (!text) return null;
    out[l] = text;
  }
  return out;
}

export function headlineCopy(
  eventType: EventType,
  tone: Tone,
  locales: readonly Locale[],
): { eyebrow: L10n | null; closing: L10n | null } {
  const lines = BANK[GROUP[eventType]][tone];
  const eyebrow = tone === 'warm' ? (WARM_EYEBROW[eventType] ?? lines.eyebrow) : lines.eyebrow;
  return { eyebrow: l10n(eyebrow, locales), closing: l10n(lines.closing, locales) };
}
