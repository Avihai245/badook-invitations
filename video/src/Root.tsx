import './fonts';
import { Composition } from 'remotion';
import { Demo } from './Demo';
import { FPS, TOTAL } from './timing';
import { buildSchedule } from './tour/schedule';
import { Tour } from './tour/Tour';

/** The tour's timeline: narration + durations.json (see src/tour/schedule.ts). */
const schedule = buildSchedule();

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="DemoLandscape"
        component={Demo}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="DemoPortrait"
        component={Demo}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="TourLandscape"
        component={Tour}
        durationInFrames={schedule.total}
        fps={schedule.fps}
        width={1920}
        height={1080}
        defaultProps={{ schedule }}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.schedule.total,
          fps: props.schedule.fps,
        })}
      />
      <Composition
        id="TourPortrait"
        component={Tour}
        durationInFrames={schedule.total}
        fps={schedule.fps}
        width={1080}
        height={1920}
        defaultProps={{ schedule }}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.schedule.total,
          fps: props.schedule.fps,
        })}
      />
    </>
  );
}
