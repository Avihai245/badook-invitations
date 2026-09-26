import type { EventDefaults, EventType, L10n, Locale, TimelineIcon } from '../contracts/types';

/**
 * The seed copy of the languages the template pack doesn't write (the pack is Hebrew + English):
 * native, event-specific texts in Russian, Arabic, French, Spanish and Amharic — the hero's line, the
 * countdown, the RSVP's messages, the timeline by its icons, the extra sections by their kind — so a
 * host who adds one of them (or starts in one) gets a complete invitation in it, and only their own
 * texts (names, places, their story) wait for a translation. The template's own copy always wins
 * where it has the language; this only fills what it lacks.
 */

type NewLocale = Exclude<Locale, 'he' | 'en'>;
type ExtraKind = EventDefaults['extraSections'][number]['kind'];
type Couple = 'couple' | 'one';

export interface CultureCopy {
  coverHint: string;
  eyebrow: Record<EventType, string>;
  /** a template's custom hero title, per event type ({primary} = the host's name) */
  heroTitle: Partial<Record<EventType, string>>;
  countdown: { title: string; subtitle: string; after: Record<EventType, string> };
  story: { title: string; body: string };
  /** venue labels by what the template's English label says (the rest: `celebration`) */
  venue: Record<VenueKind, string>;
  timeline: Record<TimelineIcon, string>;
  extra: Record<Exclude<ExtraKind, 'custom'>, { title: string; subtitle: string | null; body: string }>;
  rsvp: {
    title: string;
    subtitle: string;
    messageLabel: Record<Couple, string>;
    success: string;
    decline: string;
    closed: string;
    dietaryNote: string;
  };
  closingLine: string;
}

export type VenueKind =
  | 'celebration'
  | 'party'
  | 'evening'
  | 'synagogue'
  | 'torah'
  | 'engagement'
  | 'brit'
  | 'ceremonyParty'
  | 'henna'
  | 'brunch';

/** The English venue labels of the pack, by what they are. */
const VENUE_KINDS: Record<string, VenueKind> = {
  'the party': 'party',
  'the celebration': 'celebration',
  'the evening': 'evening',
  synagogue: 'synagogue',
  'engagement party': 'engagement',
  'engagement evening': 'engagement',
  'the engagement party': 'engagement',
  'the brit': 'brit',
  'ceremony & party': 'ceremonyParty',
  'ceremony & reception': 'ceremonyParty',
  'ceremony & celebration': 'ceremonyParty',
  'ceremony & ball': 'ceremonyParty',
  'torah reading': 'torah',
  'the henna night': 'henna',
  'the brunch': 'brunch',
};

const COUPLES: readonly EventType[] = ['wedding', 'engagement', 'henna', 'save_the_date'];

export const CULTURE_COPY: Record<NewLocale, CultureCopy> = {
  ru: {
    coverHint: 'Нажмите, чтобы открыть приглашение',
    eyebrow: {
      wedding: 'Мы женимся!',
      engagement: 'Мы обручились!',
      henna: 'Приглашаем на праздник хины',
      bar_mitzvah: 'С радостью приглашаем вас на бар-мицву',
      bat_mitzvah: 'С радостью приглашаем вас на бат-мицву',
      brit: 'С большой радостью приглашаем вас',
      baby_shower: 'Скоро нас станет больше',
      birthday: 'Приглашаем отпраздновать вместе',
      save_the_date: 'Запомните дату — мы женимся!',
      corporate: 'Приглашаем на наше мероприятие',
      other: 'Приглашаем вас на праздник',
    },
    heroTitle: {
      baby_shower: '{primary} ждёт малыша!',
      brit: 'Брит-мила нашего сына',
      birthday: '{primary} празднует день рождения!',
    },
    countdown: {
      title: 'Обратный отсчёт',
      subtitle: 'До нашего праздника',
      after: {
        wedding: 'Мазл тов! Спасибо, что праздновали с нами ♥',
        engagement: 'Мазл тов! Спасибо, что праздновали с нами ♥',
        henna: 'Мазл тов! Спасибо, что праздновали с нами ♥',
        bar_mitzvah: 'Мазл тов! Спасибо, что были с нами ♥',
        bat_mitzvah: 'Мазл тов! Спасибо, что были с нами ♥',
        brit: 'Мазл тов! Спасибо, что были с нами ♥',
        baby_shower: 'Ура! Спасибо, что были с нами ♥',
        birthday: 'Ура! Спасибо, что праздновали с нами ♥',
        save_the_date: 'Спасибо, что были с нами ♥',
        corporate: 'Спасибо, что были с нами!',
        other: 'Спасибо, что праздновали с нами ♥',
      },
    },
    story: {
      title: 'Наша история',
      body: '{date} мы празднуем,\nи для нас будет большой радостью разделить этот день с вами.',
    },
    venue: {
      celebration: 'Праздник',
      party: 'Вечеринка',
      evening: 'Вечер',
      synagogue: 'Синагога',
      torah: 'Чтение Торы',
      engagement: 'Праздник помолвки',
      brit: 'Брит-мила',
      ceremonyParty: 'Церемония и праздник',
      henna: 'Вечер хины',
      brunch: 'Бранч',
    },
    timeline: {
      glass: 'Фуршет',
      chuppah: 'Хупа',
      rings: 'Церемония',
      heart: 'Особый момент',
      walk: 'Сбор гостей',
      dinner: 'Ужин',
      music: 'Танцы',
      party: 'Вечеринка',
      cake: 'Торт',
      camera: 'Фото и пожелания',
      bus: 'Трансфер',
      toast: 'Тост',
      star: 'Сюрприз',
      gift: 'Подарки',
      baby: 'Брит-мила',
      torah: 'Благословения',
    },
    extra: {
      transport: {
        title: 'Трансфер',
        subtitle: null,
        body: 'Для гостей будет организован трансфер. Подробности — ближе к дате.',
      },
      accommodation: {
        title: 'Проживание',
        subtitle: null,
        body: 'Для гостей из других городов мы подобрали варианты проживания неподалёку.',
      },
      dress_code: {
        title: 'Дресс-код',
        subtitle: 'Праздничный',
        body: 'Будем рады видеть вас в праздничных нарядах — и в удобной обуви для танцев.',
      },
      menu: { title: 'Меню', subtitle: null, body: 'Вас ждёт праздничный ужин.' },
      activities: {
        title: 'Развлечения',
        subtitle: null,
        body: 'Для гостей всех возрастов будут игры и развлечения.',
      },
    },
    rsvp: {
      title: 'Подтверждение участия',
      subtitle: 'Просим ответить до {deadline}',
      messageLabel: { couple: 'Пожелание паре', one: 'Пожелание' },
      success: 'Спасибо! Ваш ответ получен ♥',
      decline: 'Спасибо, что сообщили, — будем скучать!',
      closed: 'Приём ответов завершён. С вопросами обращайтесь к нам напрямую.',
      dietaryNote: 'Всё угощение на празднике кошерное. Если вам нужно кошерное мехадрин, отметьте это.',
    },
    closingLine: 'Ждём вас с нетерпением',
  },
  ar: {
    coverHint: 'اضغطوا لفتح الدعوة',
    eyebrow: {
      wedding: 'ندعوكم لحضور حفل زفافنا',
      engagement: 'ندعوكم لمشاركتنا فرحة الخطوبة',
      henna: 'ندعوكم لحضور ليلة الحنّاء',
      bar_mitzvah: 'بكل فرح ندعوكم لحضور بار متسفا',
      bat_mitzvah: 'بكل فرح ندعوكم لحضور بات متسفا',
      brit: 'بفرح كبير ندعوكم',
      baby_shower: 'فرحة صغيرة في الطريق إلينا',
      birthday: 'ندعوكم للاحتفال معنا',
      save_the_date: 'احفظوا الموعد — سنتزوّج!',
      corporate: 'يسرّنا دعوتكم إلى مناسبتنا',
      other: 'ندعوكم للاحتفال مع',
    },
    heroTitle: {
      baby_shower: 'حفل استقبال مولود {primary}',
      brit: 'البريت ميلا لابننا',
      birthday: 'عيد ميلاد {primary}',
    },
    countdown: {
      title: 'العدّ التنازلي',
      subtitle: 'حتى يومنا الكبير',
      after: {
        wedding: 'مبروك! شكرًا لمشاركتكم فرحتنا ♥',
        engagement: 'مبروك! شكرًا لمشاركتكم فرحتنا ♥',
        henna: 'مبروك! شكرًا لمشاركتكم فرحتنا ♥',
        bar_mitzvah: 'مبروك! شكرًا لمشاركتكم فرحتنا ♥',
        bat_mitzvah: 'مبروك! شكرًا لمشاركتكم فرحتنا ♥',
        brit: 'مبروك! شكرًا لمشاركتكم فرحتنا ♥',
        baby_shower: 'مبروك! شكرًا لمشاركتكم فرحتنا ♥',
        birthday: 'شكرًا لاحتفالكم معنا ♥',
        save_the_date: 'شكرًا لمشاركتكم فرحتنا ♥',
        corporate: 'شكرًا لحضوركم!',
        other: 'شكرًا لاحتفالكم معنا ♥',
      },
    },
    story: {
      title: 'قصّتنا',
      body: 'في {date} نحتفل،\nوسيسعدنا كثيرًا أن نشارككم هذا اليوم.',
    },
    venue: {
      celebration: 'الاحتفال',
      party: 'الحفلة',
      evening: 'السهرة',
      synagogue: 'الكنيس',
      torah: 'قراءة التوراة',
      engagement: 'حفل الخطوبة',
      brit: 'البريت ميلا',
      ceremonyParty: 'المراسم والاحتفال',
      henna: 'ليلة الحنّاء',
      brunch: 'البرانش',
    },
    timeline: {
      glass: 'الاستقبال',
      chuppah: 'مراسم عقد القران',
      rings: 'المراسم',
      heart: 'لحظة خاصة',
      walk: 'وصول الضيوف',
      dinner: 'العشاء',
      music: 'الرقص',
      party: 'الحفلة',
      cake: 'الكعكة',
      camera: 'صور وتمنيات',
      bus: 'المواصلات',
      toast: 'نخب',
      star: 'مفاجأة',
      gift: 'الهدايا',
      baby: 'البريت ميلا',
      torah: 'البركات',
    },
    extra: {
      transport: {
        title: 'المواصلات',
        subtitle: null,
        body: 'ستتوفّر مواصلات للضيوف. سنرسل التفاصيل قبل الموعد.',
      },
      accommodation: {
        title: 'الإقامة',
        subtitle: null,
        body: 'للضيوف القادمين من بعيد اخترنا لكم خيارات إقامة قريبة.',
      },
      dress_code: {
        title: 'قواعد اللباس',
        subtitle: 'احتفالي',
        body: 'يسعدنا أن نراكم بلباس احتفالي — ومريح بما يكفي للرقص طوال الليل.',
      },
      menu: { title: 'قائمة الطعام', subtitle: null, body: 'بانتظاركم عشاء احتفالي.' },
      activities: {
        title: 'الفعاليات',
        subtitle: null,
        body: 'ألعاب وفعاليات للضيوف من كل الأعمار.',
      },
    },
    rsvp: {
      title: 'تأكيد الحضور',
      subtitle: 'نرجو الرد حتى {deadline}',
      messageLabel: { couple: 'تهنئة للعروسين', one: 'تهنئة' },
      success: 'شكرًا! وصلنا تأكيدكم ♥',
      decline: 'شكرًا لإبلاغنا، سنفتقدكم!',
      closed: 'انتهى موعد تأكيد الحضور. لأي سؤال يمكنكم التواصل معنا مباشرة.',
      dietaryNote: 'كل الطعام في المناسبة كوشير. من يحتاج إلى وجبة كوشير مهدرين يُرجى تحديد ذلك.',
    },
    closingLine: 'بانتظاركم بكل محبة',
  },
  fr: {
    coverHint: 'Touchez pour ouvrir l’invitation',
    eyebrow: {
      wedding: 'Nous nous marions !',
      engagement: 'Nous nous sommes fiancés !',
      henna: 'Venez fêter le henné avec nous',
      bar_mitzvah: 'Nous avons la joie de vous inviter à la bar-mitsva',
      bat_mitzvah: 'Nous avons la joie de vous inviter à la bat-mitsva',
      brit: 'Avec une immense joie, nous vous invitons',
      baby_shower: 'Un petit trésor est en route',
      birthday: 'Venez faire la fête avec',
      save_the_date: 'Réservez la date — nous nous marions !',
      corporate: 'Nous avons le plaisir de vous inviter',
      other: 'Venez célébrer avec',
    },
    heroTitle: {
      baby_shower: '{primary} attend un bébé !',
      brit: 'La brit-mila de notre fils',
      birthday: '{primary} fête son anniversaire !',
    },
    countdown: {
      title: 'Compte à rebours',
      subtitle: 'Jusqu’au grand jour',
      after: {
        wedding: 'Mazal tov ! Merci d’avoir célébré avec nous ♥',
        engagement: 'Mazal tov ! Merci d’avoir célébré avec nous ♥',
        henna: 'Mazal tov ! Merci d’avoir célébré avec nous ♥',
        bar_mitzvah: 'Mazal tov ! Merci d’avoir été là ♥',
        bat_mitzvah: 'Mazal tov ! Merci d’avoir été là ♥',
        brit: 'Mazal tov ! Merci d’avoir été là ♥',
        baby_shower: 'Merci d’avoir été là ♥',
        birthday: 'Merci d’avoir fait la fête avec nous ♥',
        save_the_date: 'Merci d’avoir été là ♥',
        corporate: 'Merci de votre présence !',
        other: 'Merci d’avoir célébré avec nous ♥',
      },
    },
    story: {
      title: 'Notre histoire',
      body: 'Le {date}, nous faisons la fête,\net ce serait une immense joie de partager ce jour avec vous.',
    },
    venue: {
      celebration: 'La fête',
      party: 'La soirée',
      evening: 'La soirée',
      synagogue: 'La synagogue',
      torah: 'La lecture de la Torah',
      engagement: 'La fête des fiançailles',
      brit: 'La brit-mila',
      ceremonyParty: 'Cérémonie et réception',
      henna: 'La soirée du henné',
      brunch: 'Le brunch',
    },
    timeline: {
      glass: 'Accueil',
      chuppah: 'Houppa',
      rings: 'Cérémonie',
      heart: 'Un moment à part',
      walk: 'Arrivée des invités',
      dinner: 'Dîner',
      music: 'Danse',
      party: 'La fête',
      cake: 'Gâteau',
      camera: 'Photos et vœux',
      bus: 'Navette',
      toast: 'Toast',
      star: 'Surprise',
      gift: 'Cadeaux',
      baby: 'Brit-mila',
      torah: 'Bénédictions',
    },
    extra: {
      transport: {
        title: 'Navettes',
        subtitle: null,
        body: 'Des navettes seront prévues pour les invités. Les détails suivront avant la date.',
      },
      accommodation: {
        title: 'Hébergement',
        subtitle: null,
        body: 'Pour les invités venus de loin, nous avons sélectionné des hébergements à proximité.',
      },
      dress_code: {
        title: 'Tenue',
        subtitle: 'Tenue de fête',
        body: 'Venez en tenue de fête — et assez à l’aise pour danser toute la nuit.',
      },
      menu: { title: 'Menu', subtitle: null, body: 'Un dîner de fête vous attend.' },
      activities: {
        title: 'Animations',
        subtitle: null,
        body: 'Des jeux et des animations pour les invités de tous âges.',
      },
    },
    rsvp: {
      title: 'Confirmation de présence',
      subtitle: 'Merci de répondre avant le {deadline}',
      messageLabel: { couple: 'Un mot pour les mariés', one: 'Un petit mot' },
      success: 'Merci ! Votre réponse a bien été reçue ♥',
      decline: 'Merci de nous avoir prévenus — vous nous manquerez !',
      closed: 'Les réponses sont closes. Pour toute question, contactez-nous directement.',
      dietaryNote: 'Tout le repas est casher. Si vous avez besoin d’un repas mehadrin, cochez-le.',
    },
    closingLine: 'Nous avons hâte de vous voir',
  },
  es: {
    coverHint: 'Toca para abrir la invitación',
    eyebrow: {
      wedding: '¡Nos casamos!',
      engagement: '¡Nos hemos comprometido!',
      henna: 'Te invitamos a la noche de henna',
      bar_mitzvah: 'Con alegría te invitamos al bar mitzvá de',
      bat_mitzvah: 'Con alegría te invitamos al bat mitzvá de',
      brit: 'Con gran alegría te invitamos',
      baby_shower: 'Algo pequeñito está en camino',
      birthday: 'Ven a celebrar con',
      save_the_date: 'Reserva la fecha — ¡nos casamos!',
      corporate: 'Tenemos el placer de invitarte',
      other: 'Ven a celebrar con',
    },
    heroTitle: {
      baby_shower: 'El baby shower de {primary}',
      brit: 'El brit milá de nuestro hijo',
      birthday: 'El cumpleaños de {primary}',
    },
    countdown: {
      title: 'Cuenta atrás',
      subtitle: 'Hasta nuestro gran día',
      after: {
        wedding: '¡Mazal tov! Gracias por celebrar con nosotros ♥',
        engagement: '¡Mazal tov! Gracias por celebrar con nosotros ♥',
        henna: '¡Mazal tov! Gracias por celebrar con nosotros ♥',
        bar_mitzvah: '¡Mazal tov! Gracias por acompañarnos ♥',
        bat_mitzvah: '¡Mazal tov! Gracias por acompañarnos ♥',
        brit: '¡Mazal tov! Gracias por acompañarnos ♥',
        baby_shower: '¡Gracias por acompañarnos! ♥',
        birthday: '¡Gracias por celebrar con nosotros! ♥',
        save_the_date: 'Gracias por acompañarnos ♥',
        corporate: '¡Gracias por venir!',
        other: 'Gracias por celebrar con nosotros ♥',
      },
    },
    story: {
      title: 'Nuestra historia',
      body: 'El {date} lo celebramos,\ny sería una gran alegría compartir ese día contigo.',
    },
    venue: {
      celebration: 'La celebración',
      party: 'La fiesta',
      evening: 'La velada',
      synagogue: 'La sinagoga',
      torah: 'La lectura de la Torá',
      engagement: 'La fiesta de compromiso',
      brit: 'El brit milá',
      ceremonyParty: 'Ceremonia y celebración',
      henna: 'La noche de henna',
      brunch: 'El brunch',
    },
    timeline: {
      glass: 'Recepción',
      chuppah: 'Jupá',
      rings: 'Ceremonia',
      heart: 'Un momento especial',
      walk: 'Llegada de los invitados',
      dinner: 'Cena',
      music: 'Baile',
      party: 'Fiesta',
      cake: 'Tarta',
      camera: 'Fotos y deseos',
      bus: 'Traslado',
      toast: 'Brindis',
      star: 'Sorpresa',
      gift: 'Regalos',
      baby: 'Brit milá',
      torah: 'Bendiciones',
    },
    extra: {
      transport: {
        title: 'Traslados',
        subtitle: null,
        body: 'Habrá traslados para los invitados. Enviaremos los detalles antes de la fecha.',
      },
      accommodation: {
        title: 'Alojamiento',
        subtitle: null,
        body: 'Para quienes vienen de lejos, hemos elegido opciones de alojamiento cercanas.',
      },
      dress_code: {
        title: 'Código de vestimenta',
        subtitle: 'De fiesta',
        body: 'Ven vestido de fiesta — y lo bastante cómodo para bailar toda la noche.',
      },
      menu: { title: 'Menú', subtitle: null, body: 'Te espera una cena de fiesta.' },
      activities: {
        title: 'Actividades',
        subtitle: null,
        body: 'Habrá juegos y actividades para invitados de todas las edades.',
      },
    },
    rsvp: {
      title: 'Confirmación de asistencia',
      subtitle: 'Por favor, responde antes del {deadline}',
      messageLabel: { couple: 'Un mensaje para los novios', one: 'Un mensaje' },
      success: '¡Gracias! Hemos recibido tu confirmación ♥',
      decline: 'Gracias por avisarnos, ¡te echaremos de menos!',
      closed: 'El plazo de confirmación ha terminado. Si tienes alguna pregunta, escríbenos directamente.',
      dietaryNote: 'Toda la comida es kosher. Si necesitas un menú kosher mehadrin, márcalo.',
    },
    closingLine: '¡Te esperamos con mucha ilusión!',
  },
  am: {
    coverHint: 'ግብዣውን ለመክፈት ይንኩ',
    eyebrow: {
      wedding: 'ልንጋባ ነው!',
      engagement: 'ቀለበት አስረናል!',
      henna: 'ለሄና ምሽታችን እንጋብዝዎታለን',
      bar_mitzvah: 'በታላቅ ደስታ ለባር ሚጽቫው እንጋብዝዎታለን',
      bat_mitzvah: 'በታላቅ ደስታ ለባት ሚጽቫው እንጋብዝዎታለን',
      brit: 'በታላቅ ደስታ እንጋብዝዎታለን',
      baby_shower: 'ትንሽ ደስታ በመንገድ ላይ ነው',
      birthday: 'አብረን እናክብር',
      save_the_date: 'ቀኑን ያስታውሱ — ልንጋባ ነው!',
      corporate: 'ወደ ዝግጅታችን ስንጋብዝዎ ደስ ይለናል',
      other: 'አብረን እናክብር',
    },
    heroTitle: {
      baby_shower: 'የ{primary} የሕፃን አቀባበል',
      brit: 'የልጃችን ብሪት ሚላ',
      birthday: 'የ{primary} ልደት',
    },
    countdown: {
      title: 'ቀሪ ጊዜ',
      subtitle: 'እስከ ትልቁ ቀናችን',
      after: {
        wedding: 'እንኳን ደስ አለን! ከእኛ ጋር ስላከበሩ እናመሰግናለን ♥',
        engagement: 'እንኳን ደስ አለን! ከእኛ ጋር ስላከበሩ እናመሰግናለን ♥',
        henna: 'እንኳን ደስ አለን! ከእኛ ጋር ስላከበሩ እናመሰግናለን ♥',
        bar_mitzvah: 'እንኳን ደስ አለን! ስለመጡ እናመሰግናለን ♥',
        bat_mitzvah: 'እንኳን ደስ አለን! ስለመጡ እናመሰግናለን ♥',
        brit: 'እንኳን ደስ አለን! ስለመጡ እናመሰግናለን ♥',
        baby_shower: 'ስለመጡ እናመሰግናለን ♥',
        birthday: 'ከእኛ ጋር ስላከበሩ እናመሰግናለን ♥',
        save_the_date: 'ስለመጡ እናመሰግናለን ♥',
        corporate: 'ስለመጡ እናመሰግናለን!',
        other: 'ከእኛ ጋር ስላከበሩ እናመሰግናለን ♥',
      },
    },
    story: {
      title: 'የእኛ ታሪክ',
      body: 'በ{date} እናከብራለን፤\nይህን ቀን ከእርስዎ ጋር ብናሳልፍ ታላቅ ደስታ ይሆንልናል።',
    },
    venue: {
      celebration: 'በዓሉ',
      party: 'ግብዣው',
      evening: 'ምሽቱ',
      synagogue: 'ምኩራብ',
      torah: 'የቶራ ንባብ',
      engagement: 'የቀለበት ሥነ ሥርዓት',
      brit: 'ብሪት ሚላ',
      ceremonyParty: 'ሥነ ሥርዓትና ግብዣ',
      henna: 'የሄና ምሽት',
      brunch: 'ቁርስ',
    },
    timeline: {
      glass: 'አቀባበል',
      chuppah: 'ሁፓ',
      rings: 'ሥነ ሥርዓት',
      heart: 'ልዩ ጊዜ',
      walk: 'የእንግዶች መድረስ',
      dinner: 'እራት',
      music: 'ጭፈራ',
      party: 'ግብዣ',
      cake: 'ኬክ',
      camera: 'ፎቶና መልካም ምኞቶች',
      bus: 'ትራንስፖርት',
      toast: 'የደስታ ንግግር',
      star: 'አስገራሚ ነገር',
      gift: 'ስጦታዎች',
      baby: 'ብሪት ሚላ',
      torah: 'ምርቃቶች',
    },
    extra: {
      transport: {
        title: 'ትራንስፖርት',
        subtitle: null,
        body: 'ለእንግዶች ትራንስፖርት ይዘጋጃል። ዝርዝሩን ከቀኑ በፊት እንልካለን።',
      },
      accommodation: {
        title: 'ማረፊያ',
        subtitle: null,
        body: 'ከሩቅ ለሚመጡ እንግዶች በአቅራቢያ ያሉ የማረፊያ አማራጮችን መርጠናል።',
      },
      dress_code: {
        title: 'የአለባበስ ሥርዓት',
        subtitle: 'የበዓል',
        body: 'በበዓል አለባበስ ቢመጡ ደስ ይለናል — ሌሊቱን ሙሉ ለመጨፈር በሚያመች።',
      },
      menu: { title: 'የምግብ ዝርዝር', subtitle: null, body: 'የበዓል እራት ይጠብቅዎታል።' },
      activities: {
        title: 'መዝናኛዎች',
        subtitle: null,
        body: 'ለሁሉም ዕድሜ እንግዶች ጨዋታዎችና መዝናኛዎች ይኖራሉ።',
      },
    },
    rsvp: {
      title: 'የመገኘት ማረጋገጫ',
      subtitle: 'እባክዎ እስከ {deadline} ድረስ ምላሽ ይስጡ',
      messageLabel: { couple: 'ለሙሽሮቹ መልእክት', one: 'መልእክት' },
      success: 'እናመሰግናለን! ምላሽዎ ደርሶናል ♥',
      decline: 'ስላሳወቁን እናመሰግናለን፤ እንናፍቅዎታለን!',
      closed: 'የመገኘት ማረጋገጫ ጊዜው አብቅቷል። ለጥያቄዎች በቀጥታ ያግኙን።',
      dietaryNote: 'በዝግጅቱ ላይ ያለው ምግብ በሙሉ ኮሸር ነው። መሃድሪን ኮሸር ከፈለጉ እባክዎ ምልክት ያድርጉ።',
    },
    closingLine: 'እርስዎን ለማየት በጉጉት እንጠብቃለን',
  },
};

const hasNew = (l: Locale): l is NewLocale => l in CULTURE_COPY;

/** `value` with `text` in each of `locales` it lacks (the template's own text always stays). */
function fill(value: L10n, locales: readonly NewLocale[], text: (c: CultureCopy) => string | null): L10n {
  let out = value;
  for (const l of locales) {
    if (value[l]?.trim()) continue;
    const t = text(CULTURE_COPY[l]);
    if (t) out = { ...out, [l]: t };
  }
  return out;
}

/**
 * A template's copy for `eventType`, completed in the languages it doesn't write (Russian, Arabic,
 * French, Spanish, Amharic) with CULTURE_COPY. Hebrew and English — which every template has — are
 * never touched, so their seeds stay exactly as the pack writes them.
 */
export function withCultureCopy(d: EventDefaults, eventType: EventType, locales: readonly Locale[]): EventDefaults {
  const langs = locales.filter(hasNew);
  if (!langs.length) return d;
  const who: Couple = COUPLES.includes(eventType) ? 'couple' : 'one';
  const f = (value: L10n, text: (c: CultureCopy) => string | null) => fill(value, langs, text);
  const fOrNull = (value: L10n | null, text: (c: CultureCopy) => string | null) =>
    value ? fill(value, langs, text) : null;
  return {
    ...d,
    coverHint: f(d.coverHint, (c) => c.coverHint),
    eyebrow: f(d.eyebrow, (c) => c.eyebrow[eventType]),
    heroTitle:
      d.heroTitle.mode === 'custom'
        ? { mode: 'custom', text: f(d.heroTitle.text, (c) => c.heroTitle[eventType] ?? c.eyebrow[eventType]) }
        : d.heroTitle,
    countdown: {
      title: f(d.countdown.title, (c) => c.countdown.title),
      subtitle: fOrNull(d.countdown.subtitle, (c) => c.countdown.subtitle),
      afterEvent: f(d.countdown.afterEvent, (c) => c.countdown.after[eventType]),
    },
    story: d.story
      ? { title: f(d.story.title, (c) => c.story.title), body: f(d.story.body, (c) => c.story.body) }
      : null,
    venueLabels: d.venueLabels.map((label) =>
      f(label, (c) => c.venue[VENUE_KINDS[(label.en ?? '').trim().toLowerCase()] ?? 'celebration']),
    ),
    timeline: d.timeline.map((item) => ({ ...item, label: f(item.label, (c) => c.timeline[item.icon]) })),
    // a template's own extra (kind `custom`: "a book instead of a card"…) has no generic wording
    extraSections: d.extraSections.map((x) =>
      x.kind === 'custom'
        ? x
        : {
            ...x,
            title: f(x.title, (c) => c.extra[x.kind as Exclude<ExtraKind, 'custom'>].title),
            subtitle: fOrNull(x.subtitle, (c) => c.extra[x.kind as Exclude<ExtraKind, 'custom'>].subtitle),
            body: f(x.body, (c) => c.extra[x.kind as Exclude<ExtraKind, 'custom'>].body),
          },
    ),
    rsvp: {
      ...d.rsvp,
      title: f(d.rsvp.title, (c) => c.rsvp.title),
      subtitle: fOrNull(d.rsvp.subtitle, (c) => c.rsvp.subtitle),
      messageLabel: f(d.rsvp.messageLabel, (c) => c.rsvp.messageLabel[who]),
      successMessage: f(d.rsvp.successMessage, (c) => c.rsvp.success),
      declineMessage: f(d.rsvp.declineMessage, (c) => c.rsvp.decline),
      closedMessage: f(d.rsvp.closedMessage, (c) => c.rsvp.closed),
      dietaryNote: fOrNull(d.rsvp.dietaryNote, (c) => c.rsvp.dietaryNote),
    },
    closingLine: f(d.closingLine, (c) => c.closingLine),
  };
}
