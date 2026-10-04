import type { EventDayGuideDict } from './event-day-guide';

/** A guest's table guide — French. */
export const eventDayGuideFr: EventDayGuideDict = {
  language: 'Langue',
  guide: {
    metaTitle: 'Votre table · {name}',
    metaDescription: 'Le numéro de votre table et le chemin pour y aller',
    hello: 'Bonjour {name}',
    yourTable: 'Votre table',
    tableNumber: 'Table {number}',
    seats: { one: '{n} place', many: '{n} de places', other: '{n} places' },
    doors: 'La fête commence à {time}',
    waiting: {
      title: 'Votre table apparaîtra ici',
      body: 'Les hôtes placent encore les tables. Rouvrez ce lien à l’approche de la fête : votre table et le chemin pour y aller vous attendront ici.',
    },
    declined: {
      title: 'Dommage que vous ne puissiez pas venir',
      body: 'D’après votre réponse, vous ne venez pas. Si vos projets ont changé, vous pouvez modifier votre réponse.',
      change: 'Modifier ma réponse',
    },
    map: {
      title: 'Le chemin jusqu’à votre table',
      label:
        'Le plan de la salle. Votre table, numéro {number}, est indiquée, et une ligne montre le chemin depuis l’entrée.',
      labelNoRoute: 'Le plan de la salle. Votre table, numéro {number}, est indiquée.',
      entrance: 'Entrée',
      youAreHere: 'Vous êtes ici',
      distance: 'À environ {meters} m de l’entrée',
      noRoute: 'Votre table est indiquée sur le plan. À l’entrée, on se fera un plaisir de vous guider.',
      noPlan: 'Le plan montre les tables telles qu’elles sont disposées dans la salle.',
      turn: 'Le plan tourne avec votre téléphone',
      turnOn: 'Faire tourner le plan avec le téléphone',
      turnOff: 'Arrêter la rotation',
      turnHelp:
        'Placez-vous à l’entrée, face à la salle, et tenez le téléphone à plat. Le plan tournera avec vous.',
      turnDenied: 'Nous n’avons pas eu accès à l’orientation du téléphone. Le plan reste tel quel.',
      turnUnavailable: 'Ce téléphone ne partage pas son orientation. Le plan reste tel quel.',
      whole: 'Toute la salle',
      replay: 'Revoir le chemin',
      landmarks: {
        stage: 'Scène',
        dance: 'Piste de danse',
        bar: 'Bar',
        buffet: 'Buffet',
        entrance: 'Entrée',
        exit: 'Sortie',
      },
    },
    checkin: {
      title: 'Votre code d’entrée',
      body: 'Montrez ce code à l’entrée : votre arrivée est enregistrée en une seconde.',
      arrived: {
        one: 'Enregistré à l’entrée : {n} sur {total}',
        many: 'Enregistrés à l’entrée : {n} sur {total}',
        other: 'Enregistrés à l’entrée : {n} sur {total}',
      },
      qrLabel: 'Code QR pour l’entrée de la fête',
    },
    offline: {
      saving: 'Enregistrement de la page sur votre téléphone…',
      saved: 'La page est enregistrée sur votre téléphone et fonctionne même sans réseau.',
      offline: 'Pas de réseau pour l’instant. Voici la page enregistrée sur votre téléphone.',
    },
    changeRsvp: 'Votre réponse à l’invitation',
    unavailable: {
      title: 'Ce lien ne fonctionne pas',
      body: 'Il n’a peut-être pas été copié en entier. Rouvrez-le depuis le message reçu, ou demandez-le aux hôtes.',
    },
    rate: {
      title: 'Un instant',
      body: 'Beaucoup de demandes sont venues de ce réseau. Attendez une minute et réessayez.',
    },
  },
  footer: {
    privacy: 'Politique de confidentialité',
    accessibility: 'Déclaration d’accessibilité',
    made: 'Créé avec {brand}',
    site: 'Invitations numériques et organisation d’événements',
    visit: 'Découvrir {brand}',
    events: 'Badook Events',
    eventsHint: 'Trouver un lieu pour votre événement',
  },
};
