import { AbsoluteFill, Sequence } from 'remotion';
import { Background, Chrome, SceneShell } from './Shell';
import { BudgetScene } from './scenes/Budget';
import { DesignScene } from './scenes/Design';
import { EditScene } from './scenes/Edit';
import { EventDayScene } from './scenes/EventDay';
import { FilmScene } from './scenes/Film';
import { GuestsScene } from './scenes/Guests';
import { EndScene, LogoScene } from './scenes/Intro';
import { RsvpScene } from './scenes/Rsvp';
import { SeatingScene } from './scenes/Seating';
import { FONT } from './theme';
import { OVERLAP, SCENES, sceneStart } from './timing';

/** Burned-in captions (kicker + headline) for the feature scenes, in order. */
const FEATURES = [
  { kicker: '01 · בוחרים עיצוב', caption: 'עיצובים מונפשים, עם מוזיקה', View: DesignScene },
  { kicker: '02 · עורכים', caption: 'עורכים בזמן אמת', View: EditScene },
  { kicker: '03 · מזמינים', caption: 'מזמינים בוואטסאפ, בקישור אישי', View: GuestsScene },
  { kicker: '04 · אישורי הגעה', caption: 'אישורי הגעה בזמן אמת', View: RsvpScene },
  { kicker: '05 · מתכננים', caption: 'תקציב ומשימות תחת שליטה', View: BudgetScene },
  { kicker: '06 · מושיבים', caption: 'סידור שולחנות בגרירה', View: SeatingScene },
  { kicker: '07 · ביום האירוע', caption: 'יום האירוע: צ׳ק־אין וגלריה חיה', View: EventDayScene },
  { kicker: '08 · אחרי', caption: 'סרט רגעים ותובנות', View: FilmScene },
];

export function Demo() {
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl', color: '#1c1917' }}>
      <Background />
      <Sequence durationInFrames={SCENES[0].dur + OVERLAP} name="Logo">
        <LogoScene dur={SCENES[0].dur} />
      </Sequence>
      {FEATURES.map(({ kicker, caption, View }, i) => {
        const idx = i + 1;
        return (
          <Sequence
            key={idx}
            from={sceneStart(idx)}
            durationInFrames={SCENES[idx].dur + OVERLAP}
            name={SCENES[idx].id}
          >
            <SceneShell kicker={kicker} caption={caption} dur={SCENES[idx].dur}>
              <View />
            </SceneShell>
          </Sequence>
        );
      })}
      <Sequence from={sceneStart(SCENES.length - 1)} name="End">
        <EndScene />
      </Sequence>
      <Chrome />
    </AbsoluteFill>
  );
}
