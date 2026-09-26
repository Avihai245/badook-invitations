import type { EventDayGuideDict } from './event-day-guide';

/** A guest's table guide — Spanish. */
export const eventDayGuideEs: EventDayGuideDict = {
  language: 'Idioma',
  guide: {
    metaTitle: 'Tu mesa · {name}',
    metaDescription: 'El número de tu mesa y el camino hasta ella',
    hello: 'Hola, {name}',
    yourTable: 'Tu mesa',
    tableNumber: 'Mesa {number}',
    seats: { one: '{n} plaza', many: '{n} de plazas', other: '{n} plazas' },
    doors: 'La celebración empieza a las {time}',
    waiting: {
      title: 'Aquí aparecerá tu mesa',
      body: 'Los anfitriones todavía están organizando las mesas. Vuelve a abrir este enlace cuando se acerque la celebración: tu mesa y el camino hasta ella te esperarán aquí.',
    },
    declined: {
      title: 'Qué pena que no puedas venir',
      body: 'Según tu respuesta, no vienes. Si tus planes han cambiado, puedes actualizar tu confirmación.',
      change: 'Actualizar mi confirmación',
    },
    map: {
      title: 'El camino a tu mesa',
      label:
        'El plano del salón. Tu mesa, la número {number}, está marcada, y una línea muestra el camino desde la entrada.',
      labelNoRoute: 'El plano del salón. Tu mesa, la número {number}, está marcada.',
      entrance: 'Entrada',
      youAreHere: 'Estás aquí',
      distance: 'A unos {meters} m de la entrada',
      noRoute: 'Tu mesa está marcada en el plano. En la entrada te indicarán el camino con gusto.',
      noPlan: 'El plano muestra las mesas tal como están colocadas en el salón.',
      turn: 'El plano gira con tu teléfono',
      turnOn: 'Girar el plano con el teléfono',
      turnOff: 'Dejar de girar',
      turnHelp:
        'Ponte en la entrada mirando hacia el salón y sujeta el teléfono en horizontal. El plano girará contigo.',
      turnDenied: 'No obtuvimos acceso a la orientación del teléfono. El plano se queda como está.',
      turnUnavailable: 'Este teléfono no comparte su orientación. El plano se queda como está.',
      whole: 'Todo el salón',
      replay: 'Ver el camino otra vez',
      landmarks: {
        stage: 'Escenario',
        dance: 'Pista de baile',
        bar: 'Barra',
        buffet: 'Bufé',
        entrance: 'Entrada',
        exit: 'Salida',
      },
    },
    checkin: {
      title: 'Tu código de entrada',
      body: 'Muestra este código en la entrada y tu llegada quedará registrada en un segundo.',
      arrived: {
        one: 'Registrado en la entrada: {n} de {total}',
        many: 'Registrados en la entrada: {n} de {total}',
        other: 'Registrados en la entrada: {n} de {total}',
      },
      qrLabel: 'Código QR para la entrada a la celebración',
    },
    offline: {
      saving: 'Guardando la página en tu teléfono…',
      saved: 'La página está guardada en tu teléfono y funciona incluso sin cobertura.',
      offline: 'Ahora no hay cobertura. Esta es la página guardada en tu teléfono.',
    },
    changeRsvp: 'Tu confirmación de asistencia',
    unavailable: {
      title: 'Este enlace no funciona',
      body: 'Quizá no se copió entero. Ábrelo de nuevo desde el mensaje que recibiste o pídeselo a los anfitriones.',
    },
    rate: {
      title: 'Un momento',
      body: 'Llegaron muchas solicitudes desde esta red. Espera un minuto y vuelve a intentarlo.',
    },
  },
  footer: {
    privacy: 'Política de privacidad',
    accessibility: 'Declaración de accesibilidad',
    made: 'Hecho con {brand}',
  },
};
