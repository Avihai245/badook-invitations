import type { ComponentType, ReactNode } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { DesignScene } from '../scenes/Design';
import { EditScene } from '../scenes/Edit';
import { FilmScene } from '../scenes/Film';
import { GuestsScene } from '../scenes/Guests';
import { EndScene, LogoScene } from '../scenes/Intro';
import { RsvpScene } from '../scenes/Rsvp';
import { SeatingScene } from '../scenes/Seating';
import { Background } from '../Shell';
import { C, FONT } from '../theme';
import { useLayout } from '../ui';
import { SegmentContext, useSegment } from './context';
import { EVENT } from './data';
import { OVERLAP, type TourSchedule } from './schedule';
import { AiScene } from './scenes/Ai';
import { BudgetTourScene } from './scenes/BudgetTour';
import { CheckInScene } from './scenes/CheckIn';
import { DesignOverlay, EditOverlay, GuestsOverlay, RsvpOverlay, SeatingOverlay } from './scenes/Overlays';
import { GalleryScene } from './scenes/Gallery';
import { HelpScene } from './scenes/Help';
import { HomeScene } from './scenes/Home';
import { ShareScene } from './scenes/Share';
import { StartScene } from './scenes/Start';
import { TasksScene } from './scenes/Tasks';
import { Stretch, Subtitles, TourChrome, TourShell } from './TourShell';

export interface TourProps {
  schedule: TourSchedule;
  [key: string]: unknown;
}

/* ---------- the demo's scenes, stretched to the voice (+ the tour's additions on top) ---------- */

function Design() {
  const { dur } = useSegment();
  return (
    <>
      <Stretch content={150} target={dur - 16}>
        <DesignScene />
      </Stretch>
      <DesignOverlay />
    </>
  );
}

function Edit() {
  const { sentence } = useSegment();
  return (
    <>
      <Stretch content={135} target={sentence(1)}>
        <EditScene
          names={['דנה & יואב', EVENT.couple]}
          date={['12.06.2027', EVENT.date]}
          place={EVENT.venue}
        />
      </Stretch>
      <EditOverlay />
    </>
  );
}

function Guests() {
  const { spoken } = useSegment();
  return (
    <>
      <Stretch content={92} target={spoken('ושולחים', 8)}>
        <GuestsScene couple={EVENT.couple} />
      </Stretch>
      <GuestsOverlay />
    </>
  );
}

function Rsvp() {
  const { sentence } = useSegment();
  return (
    <>
      <Stretch content={130} target={sentence(1)}>
        <RsvpScene invited={EVENT.guests} />
      </Stretch>
      <RsvpOverlay />
    </>
  );
}

function Seating() {
  const { spoken } = useSegment();
  return (
    <>
      <Stretch content={125} target={spoken('ושולחים לכל אורח', -10)}>
        <SeatingScene />
      </Stretch>
      <SeatingOverlay />
    </>
  );
}

const FILM_STATS = [
  { v: '1,240', l: 'צפיות בהזמנה' },
  { v: '96%', l: 'הגיעו מתוך המאשרים' },
  { v: '318', l: 'תמונות בגלריה' },
];
const Film = () => <FilmScene stats={FILM_STATS} />;

const stretched = (View: ComponentType, content: number) =>
  function StretchedScene() {
    const { dur } = useSegment();
    return (
      <Stretch content={content} target={dur - 16}>
        <View />
      </Stretch>
    );
  };

/** The intro: the demo's logo scene, slower, sized to leave room for the subtitles. */
function Intro() {
  const { dur } = useSegment();
  const { portrait } = useLayout();
  const rate = 0.6;
  return (
    <AbsoluteFill style={{ transform: `scale(${portrait ? 0.8 : 0.82})`, transformOrigin: '50% 0%' }}>
      <Sequence layout="none" playbackRate={rate}>
        <LogoScene dur={Math.round(dur * rate)} />
      </Sequence>
    </AbsoluteFill>
  );
}

interface SceneDef {
  kicker?: string;
  title?: string;
  View: ComponentType;
  /** drawn on the whole frame, without the kicker/headline shell */
  full?: boolean;
}

const SCENES: Record<string, SceneDef> = {
  intro: { View: Intro, full: true },
  start: { kicker: '01 · מתחילים', title: 'אירוע חדש בפחות מדקה', View: StartScene },
  home: { kicker: '02 · בית האירוע', title: 'הכול במבט אחד', View: HomeScene },
  design: { kicker: '03 · בוחרים עיצוב', title: 'יותר מ־60 עיצובים מונפשים', View: Design },
  ai: { kicker: '04 · עצבו לי', title: 'עיצוב בהשראת התמונות שלכם', View: AiScene },
  edit: { kicker: '05 · עורכים', title: 'עורכים, מתייעצים ומפרסמים', View: Edit },
  share: { kicker: '06 · משתפים', title: 'קישור, QR וקישור אישי', View: ShareScene },
  guests: { kicker: '07 · מזמינים', title: 'מאקסל לוואטסאפ', View: Guests },
  rsvp: { kicker: '08 · אישורי הגעה', title: 'אישורי הגעה בזמן אמת', View: Rsvp },
  tasks: { kicker: '09 · מתכננים', title: 'משימות, ספקים ורעיונות', View: TasksScene },
  budget: { kicker: '10 · תקציב', title: 'התקציב תחת שליטה', View: BudgetTourScene },
  seating: { kicker: '11 · מושיבים', title: 'סידור שולחנות בגרירה', View: Seating },
  eventday: { kicker: '12 · ביום האירוע', title: 'צ׳ק־אין בכניסה', View: CheckInScene },
  gallery: { kicker: '13 · גלריה חיה', title: 'כל התמונות, על המסך באולם', View: GalleryScene },
  film: { kicker: '14 · אחרי האירוע', title: 'סרט רגעים ותובנות', View: stretched(Film, 115) },
  help: { kicker: '15 · עזרה', title: 'עזרה בכל שלב', View: HelpScene },
  end: { View: EndScene, full: true },
};

export function Tour({ schedule }: TourProps) {
  const last = schedule.segments.length - 1;
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl', color: C.ink }}>
      <Background />
      {schedule.segments.map((seg, i) => {
        const def = SCENES[seg.id];
        if (!def) throw new Error(`No scene for narration segment "${seg.id}" (src/tour/Tour.tsx)`);
        const body: ReactNode = def.full ? (
          <def.View />
        ) : (
          <TourShell kicker={def.kicker ?? ''} title={def.title ?? ''}>
            <def.View />
          </TourShell>
        );
        return (
          <Sequence
            key={seg.id}
            from={seg.start}
            durationInFrames={i === last ? seg.dur : seg.dur + OVERLAP}
            name={seg.id}
          >
            <SegmentContext.Provider value={seg}>{body}</SegmentContext.Provider>
          </Sequence>
        );
      })}
      {schedule.segments
        .filter((seg) => seg.audio)
        .map((seg) => (
          <Sequence
            key={`audio-${seg.id}`}
            from={seg.start + seg.narrFrom}
            durationInFrames={seg.dur - seg.narrFrom}
            name={`voice ${seg.id}`}
            layout="none"
          >
            <Audio src={staticFile(`narration/${seg.id}.mp3`)} />
          </Sequence>
        ))}
      <TourChrome schedule={schedule} />
      <Subtitles cues={schedule.cues} total={schedule.total} />
    </AbsoluteFill>
  );
}
