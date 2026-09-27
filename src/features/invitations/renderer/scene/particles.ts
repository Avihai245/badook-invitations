import type { SceneParticles as Kind } from '../../contracts/types';
import { seeded } from '../fx/motion';
import { SHAPES } from '../fx/shapes';

/**
 * The scroll scene's particles, drawn (renderer/scene): 8–15 butterflies, petals or motes of gold
 * drifting over the backdrop on one canvas — slowly, at random, for ever. No DOM: the same flight runs
 * in a worker on the canvas the page handed it (particles.worker.ts — off the page's thread, where the
 * browser can) or on the page itself (SceneParticles.client.tsx). Every shape is drawn once per color,
 * at the screen's density; a frame is then a drawImage or two per particle — no path, no shadow blur.
 */

export type ParticleKind = Exclude<Kind, 'none'>;

/** 8–15 on screen: fewer on a phone, a few more in the desktop's frame (particleBudget: ≤ 60% on a slow device). */
export const COUNT: Record<ParticleKind, readonly [number, number]> = {
  butterflies: [9, 12],
  petals: [10, 14],
  gold_dust: [12, 15],
};

export interface FlightOptions {
  kind: ParticleKind;
  colors: string[];
  seed: string;
  count: number;
  /** css px */
  width: number;
  height: number;
  dpr: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** px: a butterfly's half wingspan, a petal's length, a mote's radius */
  size: number;
  rot: number;
  spin: number;
  phase: number;
  /** wing beats / tumbles / twinkles per second */
  rate: number;
  color: string;
  alpha: number;
}

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A canvas to draw a sprite on: an OffscreenCanvas where there is one (a worker has nothing else). */
function surface(w: number, h: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function spawn(kind: ParticleKind, rnd: () => number, w: number, h: number, colors: string[]): Particle {
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const color = colors[Math.floor(rnd() * colors.length)] ?? '#FFFFFF';
  switch (kind) {
    case 'butterflies':
      return {
        x: r(0, w),
        y: r(h * 0.08, h * 0.92),
        vx: r(-16, 16) || 8,
        vy: r(-10, 4),
        size: r(7, 12),
        rot: 0,
        spin: 0,
        phase: r(0, Math.PI * 2),
        rate: r(4.5, 7),
        color,
        alpha: r(0.72, 0.95),
      };
    case 'petals':
      return {
        x: r(0, w),
        y: r(-h * 0.1, h),
        vx: r(-6, 10),
        vy: r(14, 28),
        size: r(9, 15),
        rot: r(0, Math.PI * 2),
        spin: r(-0.7, 0.7),
        phase: r(0, Math.PI * 2),
        rate: r(0.35, 0.8),
        color,
        alpha: r(0.7, 0.95),
      };
    case 'gold_dust':
      return {
        x: r(0, w),
        y: r(0, h),
        vx: r(-3, 3),
        vy: r(-10, -3),
        size: r(1.4, 3.2),
        rot: 0,
        spin: 0,
        phase: r(0, Math.PI * 2),
        rate: r(0.5, 1.4),
        color,
        alpha: r(0.55, 0.95),
      };
  }
}

/** One wing: an upper lobe and a smaller lower one, pointing away from the body (+x). */
function wing(g: Context, s: number) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(s * 0.3, -s * 1.15, s * 1.25, -s * 1.05, s * 1.05, -s * 0.2);
  g.bezierCurveTo(s * 0.95, s * 0.05, s * 0.45, s * 0.1, 0, 0);
  g.moveTo(0, 0);
  g.bezierCurveTo(s * 0.55, s * 0.1, s * 0.95, s * 0.35, s * 0.7, s * 0.85);
  g.bezierCurveTo(s * 0.45, s * 1.05, s * 0.15, s * 0.55, 0, 0);
  g.fill();
}

/** A shape drawn once, at the screen's density, in a box of `w`×`h` css px whose origin is (`x`, `y`) inside it. */
interface Sprite {
  img: Surface;
  x: number;
  y: number;
  w: number;
  h: number;
}
function sprite(w: number, h: number, x: number, y: number, dpr: number, draw: (g: Context) => void): Sprite {
  const img = surface(Math.ceil(w * dpr), Math.ceil(h * dpr));
  const g = img.getContext('2d') as Context;
  g.setTransform(dpr, 0, 0, dpr, x * dpr, y * dpr);
  draw(g);
  return { img, x, y, w, h };
}

/** The sprites' own scale: a butterfly's half wingspan, a petal's length (css px) — the largest drawn. */
const WING = 12;
const PETAL = 16;
/** Room around a wing for its soft shadow. */
const PAD = 4;

/** A wing in its color, with its soft shadow (both lobes; the other wing is its mirror image). */
const wingSprite = (color: string, dpr: number) =>
  sprite(WING * 1.3 + PAD * 2, WING * 2.3 + PAD * 2, PAD, WING * 1.2 + PAD, dpr, (g) => {
    g.fillStyle = color;
    g.shadowColor = 'rgba(16,24,42,.25)';
    g.shadowBlur = 3;
    wing(g, WING);
  });

/** A petal in its color. */
const petalSprite = (color: string, dpr: number) =>
  sprite(PETAL, PETAL, PETAL / 2, PETAL / 2, dpr, (g) => {
    g.scale(PETAL / 24, PETAL / 24);
    g.translate(-12, -12);
    g.fillStyle = color;
    g.fill(new Path2D(SHAPES.petal.d));
  });

/** A soft glowing mote, centred. */
const glowSprite = (color: string) =>
  sprite(16, 16, 8, 8, 2, (g) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 8);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, `${color}66`);
    grad.addColorStop(1, `${color}00`);
    g.fillStyle = grad;
    g.fillRect(-8, -8, 16, 16);
  });

const stamp = (g: Context, s: Sprite) => g.drawImage(s.img, -s.x, -s.y, s.w, s.h);

/** A frame of the flight, ms (30 a second). */
const FRAME_MS = 1000 / 30;

/**
 * The flight: `step` draws a frame (called every display frame, it draws every other one — 30 a
 * second; the time since the last one moves every particle, never more than 50 ms, so a pause doesn't
 * make them jump), `resize` follows the canvas, `restart` forgets the last frame's time (after a pause).
 */
export function particleFlight(o: FlightOptions) {
  const palette = o.colors.length ? o.colors : ['#FFFFFF'];
  const rnd = seeded(`${o.seed}:${o.kind}`);
  let w = o.width;
  let h = o.height;
  let dpr = o.dpr;
  const particles = Array.from({ length: o.count }, () => spawn(o.kind, rnd, w || 390, h || 844, palette));
  let sprites = new Map<string, Sprite>();
  let spriteDpr = 0;
  const draw = () => {
    if (spriteDpr === dpr) return;
    spriteDpr = dpr;
    sprites = new Map(
      palette.map((c) => [
        c,
        o.kind === 'gold_dust'
          ? glowSprite(c)
          : o.kind === 'petals'
            ? petalSprite(c, dpr)
            : wingSprite(c, dpr),
      ]),
    );
  };
  draw();
  let last = 0;
  let t = 0;

  const step = (g: Context, now: number) => {
    // 30 frames a second are plenty for particles this slow — the display's other frames are the scroll's
    if (last && now - last < FRAME_MS - 2) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    t += dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    for (const p of particles) {
      const m = p.size * 3;
      const shape = sprites.get(p.color);
      switch (o.kind) {
        case 'butterflies': {
          // a meandering flight: the heading wanders, the speed breathes with the wing beats
          const turn = Math.sin(t * 0.6 + p.phase) * 0.9 + Math.sin(t * 0.23 + p.phase * 2) * 0.6;
          const speed = 14 + Math.sin(t * p.rate + p.phase) * 4;
          const heading = Math.atan2(p.vy, p.vx) + turn * dt;
          p.vx = Math.cos(heading) * speed;
          p.vy = Math.sin(heading) * speed - 2;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const beat = 0.25 + 0.75 * Math.abs(Math.cos(t * p.rate * Math.PI + p.phase));
          const k = p.size / WING;
          g.save();
          g.translate(p.x, p.y);
          g.rotate(heading + Math.PI / 2);
          g.globalAlpha = p.alpha;
          // the two wings: one sprite and its mirror image, folding with the beat
          if (shape)
            for (const side of [-1, 1]) {
              g.save();
              g.scale(side * beat * k, k);
              stamp(g, shape);
              g.restore();
            }
          g.fillStyle = 'rgba(60,52,44,.7)';
          g.fillRect(-0.6, -p.size * 0.55, 1.2, p.size * 1.1);
          g.restore();
          break;
        }
        case 'petals': {
          p.x += (p.vx + Math.sin(t * 0.9 + p.phase) * 14) * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          const tumble = Math.cos(t * p.rate * Math.PI + p.phase);
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.scale((p.size / PETAL) * (0.35 + 0.65 * Math.abs(tumble)), p.size / PETAL);
          g.globalAlpha = p.alpha;
          if (shape) stamp(g, shape);
          g.restore();
          break;
        }
        case 'gold_dust': {
          p.x += (p.vx + Math.sin(t * 0.5 + p.phase) * 6) * dt;
          p.y += p.vy * dt;
          const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * p.rate * Math.PI + p.phase));
          const d = p.size * 6;
          g.globalAlpha = p.alpha * twinkle;
          if (shape) g.drawImage(shape.img, p.x - d / 2, p.y - d / 2, d, d);
          break;
        }
      }
      // past an edge: back in from the other side
      if (p.x < -m) p.x = w + m;
      else if (p.x > w + m) p.x = -m;
      if (p.y < -m) p.y = h + m;
      else if (p.y > h + m) p.y = -m;
    }
    g.globalAlpha = 1;
  };

  return {
    step,
    resize(width: number, height: number, density: number) {
      w = width;
      h = height;
      dpr = density;
      draw();
    },
    restart() {
      last = 0;
    },
  };
}
