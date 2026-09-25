import { motionAllowed, particleBudget } from './motion';
import { BALLOON_STRING, SHAPES, type Shape, type ShapeId } from './shapes';
import type { BurstKind } from './theme';

/**
 * One-shot particle bursts (the cover opening, an RSVP "yes"): a tiny canvas engine — a fixed,
 * full-screen, click-through <canvas aria-hidden> that exists only while particles fly (≈ 3s), with
 * real physics (launch, drag, gravity or buoyancy, sway, 3D flutter). Browser only, called from event
 * handlers and effects; nothing runs with reduced motion, and a hidden tab drops the burst at once.
 * At most 24 particles per burst on a phone (40 elsewhere).
 */

interface Spec {
  shapes: readonly ShapeId[];
  /** particles on a phone / elsewhere (particleBudget caps them) */
  count: readonly [number, number];
  /** px (the shape's 24-unit box) */
  size: readonly [number, number];
  /** launch speed, px/s */
  speed: readonly [number, number];
  /** launch directions, degrees (0 = right, -90 = up) */
  angle: readonly [number, number];
  /** px/s² (negative floats up) */
  gravity: number;
  /** velocity decay, 1/s */
  drag: number;
  /** life, s */
  ttl: readonly [number, number];
  /** spin, rad/s */
  spin: readonly [number, number];
  /** 3D flutter (the shape turns over), rad/s */
  flip: readonly [number, number];
  /** sideways sway, px/s² */
  sway: number;
  /** launched across this share of the screen width instead of from one point */
  spreadX?: number;
  twinkle?: boolean;
  glow?: boolean;
  /** bubbles: grow and vanish at the end */
  pop?: boolean;
  /** 8-bit: no rotation, stepped twinkle */
  pixel?: boolean;
}

const UP: readonly [number, number] = [-165, -15];
const ALL: readonly [number, number] = [-180, 180];

export const BURSTS: Record<BurstKind, Spec> = {
  petals: {
    shapes: ['petal', 'petal2', 'petal'],
    count: [22, 34],
    size: [12, 21],
    speed: [240, 620],
    angle: UP,
    gravity: 230,
    drag: 1.7,
    ttl: [2.9, 3.9],
    spin: [-2.4, 2.4],
    flip: [2.6, 6.5],
    sway: 95,
  },
  leaves: {
    shapes: ['leaf', 'leaf2'],
    count: [20, 32],
    size: [14, 23],
    speed: [240, 600],
    angle: UP,
    gravity: 250,
    drag: 1.7,
    ttl: [2.9, 3.9],
    spin: [-3, 3],
    flip: [2.5, 6],
    sway: 105,
  },
  confetti: {
    shapes: ['rect', 'rect', 'circle', 'tri', 'squiggle'],
    count: [24, 40],
    size: [8, 14],
    speed: [420, 980],
    angle: [-160, -20],
    gravity: 760,
    drag: 2.1,
    ttl: [2.4, 3.4],
    spin: [-8, 8],
    flip: [8, 17],
    sway: 70,
  },
  sparkles: {
    shapes: ['sparkle', 'sparkle', 'dot'],
    count: [20, 32],
    size: [8, 22],
    speed: [160, 600],
    angle: ALL,
    gravity: 40,
    drag: 2.6,
    ttl: [1.3, 2.3],
    spin: [-1.6, 1.6],
    flip: [0, 0],
    sway: 0,
    twinkle: true,
    glow: true,
  },
  stars: {
    shapes: ['star', 'sparkle', 'star', 'dot'],
    count: [20, 32],
    size: [9, 20],
    speed: [200, 640],
    angle: ALL,
    gravity: 70,
    drag: 2.4,
    ttl: [1.5, 2.5],
    spin: [-3, 3],
    flip: [0, 1.5],
    sway: 0,
    twinkle: true,
    glow: true,
  },
  bubbles: {
    shapes: ['bubble'],
    count: [16, 26],
    size: [12, 32],
    speed: [140, 440],
    angle: [-180, 0],
    gravity: -150,
    drag: 1.5,
    ttl: [2.2, 3.3],
    spin: [0, 0],
    flip: [0, 0],
    sway: 130,
    pop: true,
  },
  balloons: {
    shapes: ['balloon'],
    count: [9, 14],
    size: [26, 42],
    speed: [90, 240],
    angle: [-115, -65],
    gravity: -95,
    drag: 0.45,
    ttl: [3.6, 4.8],
    spin: [-0.35, 0.35],
    flip: [0, 0],
    sway: 75,
    spreadX: 0.34,
  },
  hearts: {
    shapes: ['heart'],
    count: [16, 26],
    size: [11, 23],
    speed: [200, 560],
    angle: [-170, -10],
    gravity: -70,
    drag: 2.2,
    ttl: [2.2, 3.2],
    spin: [-1, 1],
    flip: [0, 0],
    sway: 85,
  },
  fireflies: {
    shapes: ['dot'],
    count: [18, 28],
    size: [4, 9],
    speed: [90, 400],
    angle: ALL,
    gravity: -55,
    drag: 1.8,
    ttl: [1.9, 3.1],
    spin: [0, 0],
    flip: [0, 0],
    sway: 60,
    twinkle: true,
    glow: true,
  },
  embers: {
    shapes: ['dot'],
    count: [20, 32],
    size: [2.5, 6],
    speed: [130, 470],
    angle: [-150, -30],
    gravity: -130,
    drag: 1.5,
    ttl: [1.6, 2.7],
    spin: [0, 0],
    flip: [0, 0],
    sway: 95,
    twinkle: true,
    glow: true,
  },
  notes: {
    shapes: ['note', 'note2'],
    count: [12, 20],
    size: [15, 24],
    speed: [170, 480],
    angle: [-160, -20],
    gravity: -85,
    drag: 2,
    ttl: [2.3, 3.3],
    spin: [-1, 1],
    flip: [0, 0],
    sway: 80,
  },
  pixels: {
    shapes: ['pixel', 'pixel', 'plus'],
    count: [22, 36],
    size: [6, 12],
    speed: [320, 780],
    angle: UP,
    gravity: 640,
    drag: 2,
    ttl: [2, 3],
    spin: [0, 0],
    flip: [0, 0],
    sway: 0,
    twinkle: true,
    pixel: true,
  },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  flip: number;
  vf: number;
  phase: number;
  size: number;
  color: string;
  shape: Shape;
  age: number;
  ttl: number;
  spec: Spec;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;
let last = 0;
let dpr = 1;
const paths = new Map<string, Path2D>();
const glows = new Map<string, HTMLCanvasElement>();

const path = (d: string) => {
  let p = paths.get(d);
  if (!p) {
    p = new Path2D(d);
    paths.set(d, p);
  }
  return p;
};

/** A soft round glow sprite per color (drawn once, then scaled — no per-frame gradients or blurs). */
function glowSprite(color: string): HTMLCanvasElement {
  let g = glows.get(color);
  if (g) return g;
  g = document.createElement('canvas');
  g.width = g.height = 64;
  const c = g.getContext('2d');
  if (c) {
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = 0.55;
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
  }
  glows.set(color, g);
  return g;
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  particles = [];
  canvas?.remove();
  canvas = null;
  ctx = null;
  window.removeEventListener('resize', size);
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  if (document.hidden) stop();
}

function size() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

function ensureCanvas(): boolean {
  if (canvas && ctx) return true;
  const el = document.createElement('canvas');
  el.className = 'fx-burst';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'presentation');
  const c = el.getContext('2d');
  if (!c) return false;
  canvas = el;
  ctx = c;
  size();
  document.body.appendChild(el);
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', onVisibility);
  return true;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

function draw(p: Particle, alpha: number) {
  const c = ctx!;
  const k = p.age / p.ttl;
  let scale = p.size / 24;
  if (p.spec.twinkle) {
    const tw = p.spec.pixel
      ? Math.floor(((Math.sin(p.phase + p.age * 9) + 1) / 2) * 3) / 2 // 0, .5, 1 — stepped
      : (Math.sin(p.phase + p.age * 11) + 1) / 2;
    scale *= 0.62 + 0.38 * tw;
    alpha *= 0.55 + 0.45 * tw;
  }
  if (p.spec.pop && k > 0.86) {
    const e = (k - 0.86) / 0.14;
    scale *= 1 + 0.35 * e;
    alpha *= 1 - e;
  }
  // the flutter: the shape turns over around its own axis (its height shrinks through 0)
  const fy = p.spec.flip[1] > 0 ? Math.cos(p.flip) : 1;
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  const sx = scale * dpr;
  const sy = scale * dpr * (Math.abs(fy) < 0.08 ? 0.08 * Math.sign(fy || 1) : fy);
  if (p.spec.glow) {
    const g = glowSprite(p.color);
    const r = p.size * 1.9 * (scale / (p.size / 24)) * dpr;
    c.setTransform(1, 0, 0, 1, p.x * dpr, p.y * dpr);
    c.globalAlpha = alpha * 0.9;
    c.drawImage(g, -r, -r, r * 2, r * 2);
  }
  c.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, p.x * dpr, p.y * dpr);
  const h = p.shape.h ?? 24;
  c.translate(-12, -h / 2 + (h > 24 ? 5 : 0));
  // the back of a fluttering piece is a little darker
  c.globalAlpha = alpha * (fy < 0 ? 0.82 : 1);
  if (p.shape === SHAPES.balloon) {
    c.strokeStyle = 'rgba(120,110,100,.55)';
    c.lineWidth = 0.8;
    c.stroke(path(BALLOON_STRING));
  }
  if (p.shape.stroke) {
    c.strokeStyle = p.color;
    c.lineWidth = p.shape.stroke;
    c.lineCap = 'round';
    if (p.shape === SHAPES.bubble) {
      c.fillStyle = p.color;
      c.globalAlpha = alpha * 0.14;
      c.fill(path(p.shape.d));
      c.globalAlpha = alpha;
    }
    c.stroke(path(p.shape.d));
  } else {
    c.fillStyle = p.color;
    c.fill(path(p.shape.d));
  }
  const detail = p.shape.detail;
  if (detail) {
    c.globalAlpha = alpha * detail.opacity;
    c.strokeStyle = detail.color === 'light' ? '#FFFFFF' : p.color;
    c.lineWidth = detail.stroke;
    c.lineCap = 'round';
    c.stroke(path(detail.d));
  }
}

function frame(now: number) {
  if (!ctx || !canvas) return;
  const dt = Math.min(0.034, Math.max(0, (now - last) / 1000));
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const h = window.innerHeight;
  particles = particles.filter((p) => p.age < p.ttl && p.y < h + 80 && p.y > -160);
  for (const p of particles) {
    p.age += dt;
    if (p.age < 0) continue; // staggered launch
    const s = p.spec;
    const decay = Math.exp(-s.drag * dt);
    p.vx = p.vx * decay + Math.sin(p.phase + p.age * 2.3) * s.sway * dt;
    p.vy = p.vy * decay + s.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.flip += p.vf * dt;
    const k = p.age / p.ttl;
    const alpha = Math.min(1, p.age / 0.12) * (k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1);
    draw(p, alpha);
  }
  if (particles.length) raf = requestAnimationFrame(frame);
  else stop();
}

export interface BurstOptions {
  kind: BurstKind;
  colors: readonly string[];
  /** viewport coordinates, px */
  x: number;
  y: number;
  /** × the kind's particle count (still capped) */
  scale?: number;
}

/** Launches a burst; returns how many particles flew (0: motion off, no canvas, nothing to draw). */
export function burst({ kind, colors, x, y, scale = 1 }: BurstOptions): number {
  if (!motionAllowed() || !colors.length || document.hidden) return 0;
  const spec = BURSTS[kind];
  if (!spec) return 0;
  const n = Math.min(
    particleBudget(Math.round(spec.count[0] * scale), Math.round(spec.count[1] * scale)),
    particleBudget(24, 40),
  );
  if (n <= 0 || !ensureCanvas()) return 0;
  const w = window.innerWidth;
  for (let i = 0; i < n; i++) {
    const angle = (rand(spec.angle[0], spec.angle[1]) * Math.PI) / 180;
    const speed = rand(spec.speed[0], spec.speed[1]);
    const spread = spec.spreadX ? (Math.random() - 0.5) * w * spec.spreadX : 0;
    particles.push({
      x: x + spread + rand(-10, 10),
      y: y + rand(-8, 8) + (spec.spreadX ? rand(0, 60) : 0),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: rand(0, Math.PI * 2) * (spec.pixel || spec.shapes[0] === 'balloon' ? 0 : 1),
      vr: rand(spec.spin[0], spec.spin[1]),
      flip: rand(0, Math.PI * 2),
      vf: rand(spec.flip[0], spec.flip[1]),
      phase: rand(0, Math.PI * 2),
      size: rand(spec.size[0], spec.size[1]),
      color: colors[i % colors.length]!,
      shape: SHAPES[pick(spec.shapes)],
      // a few leave a beat later: a burst, not a block
      age: -Math.random() * 0.12,
      ttl: rand(spec.ttl[0], spec.ttl[1]),
      spec,
    });
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  return n;
}

/** A burst from an element: `at` is the point inside its box (0..1, from its top-left corner). */
export function burstFrom(
  el: Element | null,
  kind: BurstKind,
  colors: readonly string[],
  at: { x: number; y: number } = { x: 0.5, y: 0.5 },
  scale = 1,
): number {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return 0;
  return burst({ kind, colors, x: r.left + r.width * at.x, y: r.top + r.height * at.y, scale });
}

/** Drops every running burst (a replay in the editor, a page leaving). */
export function clearBursts() {
  if (canvas) stop();
}
