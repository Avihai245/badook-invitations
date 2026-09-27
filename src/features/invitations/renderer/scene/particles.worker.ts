import { particleFlight, type FlightOptions } from './particles';

/**
 * The scroll scene's particles off the page's thread (renderer/scene): the page hands over its canvas
 * (transferControlToOffscreen) and this worker draws every frame on it — the page's thread stays free
 * for the scroll and the texts, and the particles keep their pace however busy it gets.
 *
 *   { type: 'init', canvas, options }   the canvas and the flight (particles.ts)
 *   { type: 'size', width, height, dpr } the canvas's box changed
 *   { type: 'run' } / { type: 'stop' }   in play, or paused (a hidden tab, the guest's pause)
 *   { type: 'clear' }                    gone (reduced motion turned on)
 */
type Message =
  | { type: 'init'; canvas: OffscreenCanvas; options: FlightOptions }
  | { type: 'size'; width: number; height: number; dpr: number }
  | { type: 'run' }
  | { type: 'stop' }
  | { type: 'clear' };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Message>) => void) | null;
  requestAnimationFrame?: (cb: (now: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
};

let canvas: OffscreenCanvas | null = null;
let g: OffscreenCanvasRenderingContext2D | null = null;
let flight: ReturnType<typeof particleFlight> | null = null;
let running = false;
let handle = 0;

// the display's frames where a worker has them; a steady 60 a second elsewhere
const next = (cb: (now: number) => void) =>
  scope.requestAnimationFrame
    ? scope.requestAnimationFrame(cb)
    : self.setTimeout(() => cb(performance.now()), 16);
const cancel = (id: number) =>
  scope.cancelAnimationFrame ? scope.cancelAnimationFrame(id) : self.clearTimeout(id);

const frame = (now: number) => {
  if (!running || !g || !flight) return;
  handle = next(frame);
  flight.step(g, now);
};

const size = (width: number, height: number, dpr: number) => {
  if (!canvas) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  flight?.resize(width, height, dpr);
};

scope.onmessage = (e) => {
  const m = e.data;
  switch (m.type) {
    case 'init':
      canvas = m.canvas;
      g = canvas.getContext('2d');
      flight = particleFlight(m.options);
      size(m.options.width, m.options.height, m.options.dpr);
      break;
    case 'size':
      size(m.width, m.height, m.dpr);
      break;
    case 'run':
      if (running || !flight) break;
      running = true;
      flight.restart();
      handle = next(frame);
      break;
    case 'stop':
      running = false;
      cancel(handle);
      break;
    case 'clear':
      running = false;
      cancel(handle);
      g?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      break;
  }
};
