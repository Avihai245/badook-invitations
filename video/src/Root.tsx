import './fonts';
import { Composition } from 'remotion';
import { Demo } from './Demo';
import { FPS, TOTAL } from './timing';

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
    </>
  );
}
