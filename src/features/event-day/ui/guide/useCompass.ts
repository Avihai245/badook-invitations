'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The phone's compass heading, for a map that turns with the guest: degrees clockwise from north,
 * smoothed. iPhones ask for permission first (from the tap that turns it on); a phone that shares no
 * heading, or a guest who says no, leaves the map as it is ('unavailable' / 'denied').
 */

export type CompassState = 'off' | 'asking' | 'on' | 'denied' | 'unavailable';

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** The heading an orientation event carries (null: none — a relative-only sensor). */
export function headingOf(e: OrientationEvent, screenAngle = 0): number | null {
  let h: number | null = null;
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading))
    h = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
  if (h === null) return null;
  return (((h + screenAngle) % 360) + 360) % 360;
}

/** Angles average on the circle (359° and 1° make 0°, not 180°). */
function blend(prev: number | null, next: number, weight = 0.25): number {
  if (prev === null) return next;
  const d = ((next - prev + 540) % 360) - 180;
  return (((prev + d * weight) % 360) + 360) % 360;
}

export function useCompass() {
  const [state, setState] = useState<CompassState>('off');
  const [heading, setHeading] = useState<number | null>(null);
  const smooth = useRef<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  // known after the first render (the server's page has no window: the same first render on both)
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported('DeviceOrientationEvent' in window), []);

  const stop = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    smooth.current = null;
    setHeading(null);
    setState('off');
  }, []);

  const start = useCallback(async () => {
    if (!supported) {
      setState('unavailable');
      return;
    }
    setState('asking');
    const api = window.DeviceOrientationEvent as unknown as PermissionApi;
    if (typeof api.requestPermission === 'function') {
      try {
        if ((await api.requestPermission()) !== 'granted') {
          setState('denied');
          return;
        }
      } catch {
        setState('denied');
        return;
      }
    }
    const kind = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    let frame = 0;
    let latest: number | null = null;
    const onEvent = (e: Event) => {
      const angle = screen.orientation?.angle ?? 0;
      const h = headingOf(e as OrientationEvent, angle);
      if (h === null) return;
      latest = h;
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (latest === null) return;
          smooth.current = blend(smooth.current, latest);
          setHeading(smooth.current);
          setState('on');
        });
    };
    window.addEventListener(kind, onEvent);
    // a sensor that never gives a heading: give up after a moment
    const timer = window.setTimeout(() => {
      if (smooth.current === null) {
        cleanup.current?.();
        cleanup.current = null;
        setState('unavailable');
      }
    }, 2500);
    cleanup.current = () => {
      window.removeEventListener(kind, onEvent);
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [supported]);

  useEffect(() => () => cleanup.current?.(), []);

  return { state, heading, supported, start, stop };
}
