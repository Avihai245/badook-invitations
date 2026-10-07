import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Background, LogoImg } from '../Shell';
import { C, FONT } from '../theme';
import { OVERLAP } from '../timing';
import { NarratedShell, Subtitles } from '../tour/TourShell';
import { clamp, useLayout, useSpringAt } from '../ui';
import { AutoScene, FamiliesScene, HallScene, LiveScene, SendScene, TablesScene } from './scenes';
import { SEATING_CUES, SEATING_SCENES, SEATING_TOTAL, seatingStart } from './timing';

/** The six steps, in order: kicker + burned-in caption + the visual. */
const STEPS = [
  { kicker: '01 · האולם', caption: 'תמונה מהאולם, או אולם מוכן', View: HallScene },
  { kicker: '02 · שולחנות', caption: 'עגול, מרובע או אבירים', View: TablesScene },
  { kicker: '03 · משפחות', caption: 'גוררים משפחה שלמה לשולחן', View: FamiliesScene },
  { kicker: '04 · סידור אוטומטי', caption: 'המערכת מושיבה את כולם', View: AutoScene },
  { kicker: '05 · שולחים', caption: 'מדפיסים ושולחים בוואטסאפ', View: SendScene },
  { kicker: '06 · ביום האירוע', caption: 'רואים בלייב מי הגיע', View: LiveScene },
];

/**
 * "Seat like the pros" — the seating screen's tutorial, narrated (public/seating/narration.mp3, the
 * scenes timed to it in timing.ts) with its sentences as subtitles: the hall (a picture from the venue,
 * or a ready-made hall from "Hall picture"), the tables, families dragged in, auto-seating with rules
 * in words, printing and sending on WhatsApp, and the live map on the day — the app's own buttons.
 */
export function SeatingTutorial() {
  return (
    <AbsoluteFill style={{ fontFamily: FONT, direction: 'rtl', color: C.ink }}>
      <Background />
      <Sequence durationInFrames={SEATING_SCENES[0].dur + OVERLAP} name="Open">
        <OpenScene dur={SEATING_SCENES[0].dur} />
      </Sequence>
      {STEPS.map(({ kicker, caption, View }, i) => {
        const idx = i + 1;
        return (
          <Sequence
            key={idx}
            from={seatingStart(idx)}
            durationInFrames={SEATING_SCENES[idx].dur + OVERLAP}
            name={SEATING_SCENES[idx].id}
          >
            <NarratedShell kicker={kicker} title={caption} dur={SEATING_SCENES[idx].dur}>
              <View />
            </NarratedShell>
          </Sequence>
        );
      })}
      <Sequence from={seatingStart(SEATING_SCENES.length - 1)} name="End">
        <EndScene />
      </Sequence>
      <Audio src={staticFile('seating/narration.mp3')} name="narration" />
      <SeatingChrome />
      <Subtitles cues={SEATING_CUES} total={SEATING_TOTAL} />
    </AbsoluteFill>
  );
}

function OpenScene({ dur }: { dur: number }) {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { portrait } = useLayout();
  const exit = interpolate(frame, [dur - 6, dur + 4], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const a = sp(0, { damping: 14 });
  const b = sp(8, { damping: 14 });
  const c = sp(16, { damping: 14 });
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        textAlign: 'center',
        opacity: 1 - exit,
        transform: `scale(${1 + exit * 0.05})`,
      }}
    >
      <div style={{ opacity: a, transform: `scale(${0.7 + 0.3 * a})` }}>
        <LogoImg width={portrait ? 300 : 280} />
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: portrait ? 104 : 116,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: -2,
          maxWidth: portrait ? 940 : 1500,
          opacity: b,
          transform: `translateY(${(1 - b) * 30}px)`,
        }}
      >
        סידור שולחנות <span style={{ color: C.brand }}>כמו מקצוענים</span>
      </div>
      <div
        style={{
          marginTop: 34,
          fontSize: portrait ? 44 : 46,
          fontWeight: 700,
          color: C.brandDeep,
          opacity: c,
        }}
      >
        כל הדרך, צעד אחר צעד
      </div>
    </AbsoluteFill>
  );
}

function EndScene() {
  const sp = useSpringAt();
  const { portrait } = useLayout();
  const a = sp(0, { damping: 14 });
  const b = sp(8, { damping: 14 });
  // with the voice: "סידור שולחנות" then "לא היה פשוט כל כך"
  const c = sp(38, { damping: 14 });
  return (
    <AbsoluteFill
      style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}
    >
      <div style={{ opacity: a, transform: `scale(${0.7 + 0.3 * a})` }}>
        <LogoImg width={portrait ? 360 : 320} />
      </div>
      <div
        style={{
          marginTop: 46,
          fontSize: portrait ? 120 : 128,
          fontWeight: 800,
          letterSpacing: -3,
          lineHeight: 1,
          opacity: b,
          transform: `translateY(${(1 - b) * 40}px)`,
        }}
      >
        סידור שולחנות
      </div>
      <div
        style={{
          marginTop: 22,
          fontSize: portrait ? 96 : 104,
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.05,
          color: C.brand,
          opacity: c,
          transform: `translateY(${(1 - c) * 30}px)`,
        }}
      >
        לא היה פשוט כל כך
      </div>
    </AbsoluteFill>
  );
}

/** The logo and the six steps' progress, during the steps. */
function SeatingChrome() {
  const frame = useCurrentFrame();
  const { portrait } = useLayout();
  const first = seatingStart(1);
  const last = seatingStart(SEATING_SCENES.length - 1);
  const opacity = interpolate(frame, [first, first + 15, last, last + OVERLAP], [0, 1, 1, 0], clamp);
  const current = STEPS.findIndex((_, i) => frame >= seatingStart(i + 1) && frame < seatingStart(i + 2));
  const progress = (i: number) =>
    interpolate(frame, [seatingStart(i + 1), seatingStart(i + 2)], [0, 1], clamp);
  const dots = (
    <div style={{ display: 'flex', gap: 12, direction: 'rtl' }}>
      {STEPS.map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 64 : 22,
            height: 10,
            borderRadius: 999,
            background: 'rgba(122,82,48,0.18)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: `${progress(i) * 100}%`,
              background: C.brand,
              borderRadius: 999,
            }}
          />
        </div>
      ))}
    </div>
  );
  if (portrait)
    return (
      <AbsoluteFill style={{ opacity }}>
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <LogoImg width={200} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 1790,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {dots}
        </div>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: 'absolute', top: 64, right: 120 }}>
        <LogoImg width={200} />
      </div>
      <div style={{ position: 'absolute', top: 806, right: 120 }}>{dots}</div>
    </AbsoluteFill>
  );
}
