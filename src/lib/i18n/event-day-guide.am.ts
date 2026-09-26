import type { EventDayGuideDict } from './event-day-guide';

/** A guest's table guide — Amharic. */
export const eventDayGuideAm: EventDayGuideDict = {
  language: 'ቋንቋ',
  guide: {
    metaTitle: 'ጠረጴዛዎ · {name}',
    metaDescription: 'የጠረጴዛዎ ቁጥርና ወደ እሱ የሚወስደው መንገድ',
    hello: 'ሰላም {name}',
    yourTable: 'ጠረጴዛዎ',
    tableNumber: 'ጠረጴዛ {number}',
    seats: { one: '{n} ቦታ', other: '{n} ቦታዎች' },
    doors: 'በዓሉ በ{time} ይጀምራል',
    waiting: {
      title: 'ጠረጴዛዎ እዚህ ይታያል',
      body: 'አስተናጋጆቹ ጠረጴዛዎቹን ገና እያዘጋጁ ነው። ወደ በዓሉ ሲቀርብ ይህን ሊንክ እንደገና ይክፈቱ፤ ጠረጴዛዎና ወደ እሱ የሚወስደው መንገድ እዚህ ይጠብቅዎታል።',
    },
    declined: {
      title: 'ባለመምጣትዎ አዝነናል',
      body: 'እንደ መልስዎ፣ ወደ በዓሉ አይመጡም። ዕቅድዎ ከተቀየረ፣ የመገኘት ማረጋገጫዎን ማዘመን ይችላሉ።',
      change: 'የመገኘት ማረጋገጫን ማዘመን',
    },
    map: {
      title: 'ወደ ጠረጴዛዎ የሚወስደው መንገድ',
      label: 'የአዳራሹ ካርታ። ጠረጴዛዎ፣ ቁጥር {number}፣ ምልክት ተደርጎበታል፤ ከመግቢያው ያለውን መንገድ መስመር ያሳያል።',
      labelNoRoute: 'የአዳራሹ ካርታ። ጠረጴዛዎ፣ ቁጥር {number}፣ ምልክት ተደርጎበታል።',
      entrance: 'መግቢያ',
      youAreHere: 'እርስዎ እዚህ ነዎት',
      distance: 'ከመግቢያው {meters} ሜትር ገደማ',
      noRoute: 'ጠረጴዛዎ በካርታው ላይ ምልክት ተደርጎበታል። በመግቢያው ላይ በደስታ ይመሩዎታል።',
      noPlan: 'ካርታው ጠረጴዛዎቹን በአዳራሹ ውስጥ እንደተደረደሩ ያሳያል።',
      turn: 'ካርታው ከስልክዎ ጋር ይዞራል',
      turnOn: 'ካርታውን ከስልኩ ጋር ማዞር',
      turnOff: 'ማዞሩን ማቆም',
      turnHelp: 'በመግቢያው ላይ ፊትዎን ወደ አዳራሹ አዙረው ይቁሙ፣ ስልኩንም በአግድም ይያዙ። ካርታው ከእርስዎ ጋር ይዞራል።',
      turnDenied: 'የስልኩን አቅጣጫ የማወቅ ፈቃድ አላገኘንም። ካርታው እንዳለ ይቆያል።',
      turnUnavailable: 'ይህ ስልክ አቅጣጫውን አያጋራም። ካርታው እንዳለ ይቆያል።',
      whole: 'አዳራሹ በሙሉ',
      replay: 'መንገዱን እንደገና ማሳየት',
      landmarks: {
        stage: 'መድረክ',
        dance: 'የዳንስ ወለል',
        bar: 'ባር',
        buffet: 'ቡፌ',
        entrance: 'መግቢያ',
        exit: 'መውጫ',
      },
    },
    checkin: {
      title: 'የመግቢያ ኮድዎ',
      body: 'ይህን ኮድ በመግቢያው ላይ ያሳዩ፤ መድረስዎ በሰከንድ ይመዘገባል።',
      arrived: {
        one: 'በመግቢያው የተመዘገቡ፦ ከ{total} ውስጥ {n}',
        other: 'በመግቢያው የተመዘገቡ፦ ከ{total} ውስጥ {n}',
      },
      qrLabel: 'ወደ በዓሉ ለመግባት የQR ኮድ',
    },
    offline: {
      saving: 'ገጹን በስልክዎ ላይ በማስቀመጥ ላይ…',
      saved: 'ገጹ በስልክዎ ላይ ተቀምጧል፤ ያለ ኔትወርክም ይሠራል።',
      offline: 'አሁን ኔትወርክ የለም። ይህ በስልክዎ ላይ የተቀመጠው ገጽ ነው።',
    },
    changeRsvp: 'የመገኘት ማረጋገጫዎ',
    unavailable: {
      title: 'ሊንኩ አይሠራም',
      body: 'ምናልባት ሙሉ በሙሉ አልተቀዳ ይሆናል። ከደረስዎት መልእክት እንደገና ይክፈቱት፣ ወይም አስተናጋጆቹን ይጠይቁ።',
    },
    rate: {
      title: 'አንድ ደቂቃ',
      body: 'ከዚህ ኔትወርክ ብዙ ጥያቄዎች ደርሰዋል። አንድ ደቂቃ ቆይተው እንደገና ይሞክሩ።',
    },
  },
  footer: {
    privacy: 'የግላዊነት መመሪያ',
    accessibility: 'የተደራሽነት መግለጫ',
    made: 'በ{brand} የተሰራ',
  },
};
