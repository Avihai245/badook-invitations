import { hexToRgb, mixHex } from '../../lib/contrast';
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
    count: [24, 36],
    size: [14, 26],
    speed: [260, 660],
    angle: UP,
    gravity: 230,
    drag: 1.7,
    ttl: [3, 4],
    spin: [-2.4, 2.4],
    flip: [2.6, 6.5],
    sway: 95,
  },
  leaves: {
    shapes: ['leaf', 'leaf2'],
    count: [22, 34],
    size: [15, 26],
    speed: [260, 640],
    angle: UP,
    gravity: 250,
    drag: 1.7,
    ttl: [3, 4],
    spin: [-3, 3],
    flip: [2.5, 6],
    sway: 105,
  },
  confetti: {
    shapes: ['rect', 'rect', 'circle', 'tri', 'squiggle'],
    count: [24, 40],
    size: [12, 20],
    speed: [380, 900],
    angle: [-160, -20],
    gravity: 700,
    drag: 2.4,
    ttl: [2.6, 3.6],
    spin: [-8, 8],
    flip: [8, 17],
    sway: 70,
  },
  sparkles: {
    shapes: ['sparkle', 'sparkle', 'dot'],
    count: [22, 34],
    size: [10, 24],
    speed: [180, 640],
    angle: ALL,
    gravity: 40,
    drag: 2.6,
    ttl: [1.4, 2.4],
    spin: [-1.6, 1.6],
    flip: [0, 0],
    sway: 0,
    twinkle: true,
    glow: true,
  },
  stars: {
    shapes: ['star', 'sparkle', 'star', 'dot'],
    count: [22, 34],
    size: [10, 22],
    speed: [200, 660],
    angle: ALL,
    gravity: 70,
    drag: 2.4,
    ttl: [1.6, 2.6],
    spin: [-3, 3],
    flip: [0, 1.5],
    sway: 0,
    twinkle: true,
    glow: true,
  },
  bubbles: {
    shapes: ['bubble'],
    count: [18, 28],
    size: [14, 34],
    speed: [150, 460],
    angle: [-180, 0],
    gravity: -150,
    drag: 1.5,
    ttl: [2.3, 3.4],
    spin: [0, 0],
    flip: [0, 0],
    sway: 130,
    pop: true,
  },
  balloons: {
    shapes: ['balloon'],
    count: [10, 14],
    size: [30, 46],
    speed: [90, 240],
    angle: [-115, -65],
    gravity: -95,
    drag: 0.45,
    ttl: [3.8, 5],
    spin: [-0.35, 0.35],
    flip: [0, 0],
    sway: 75,
    spreadX: 0.36,
  },
  hearts: {
    shapes: ['heart'],
    count: [18, 28],
    size: [13, 26],
    speed: [220, 580],
    angle: [-170, -10],
    gravity: -70,
    drag: 2.2,
    ttl: [2.3, 3.3],
    spin: [-1, 1],
    flip: [0, 0],
    sway: 85,
  },
  fireflies: {
    shapes: ['dot'],
    count: [20, 30],
    size: [5, 10],
    speed: [90, 420],
    angle: ALL,
    gravity: -55,
    drag: 1.8,
    ttl: [2, 3.2],
    spin: [0, 0],
    flip: [0, 0],
    sway: 60,
    twinkle: true,
    glow: true,
  },
  embers: {
    shapes: ['dot'],
    count: [22, 34],
    size: [3, 7],
    speed: [140, 480],
    angle: [-150, -30],
    gravity: -130,
    drag: 1.5,
    ttl: [1.7, 2.8],
    spin: [0, 0],
    flip: [0, 0],
    sway: 95,
    twinkle: true,
    glow: true,
  },
  notes: {
    shapes: ['note', 'note2'],
    count: [14, 22],
    size: [16, 26],
    speed: [180, 500],
    angle: [-160, -20],
    gravity: -85,
    drag: 2,
    ttl: [2.4, 3.4],
    spin: [-1, 1],
    flip: [0, 0],
    sway: 80,
  },
  pixels: {
    shapes: ['pixel', 'pixel', 'plus'],
    count: [24, 36],
    size: [7, 13],
    speed: [340, 800],
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
  sprite: Sprite;
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

/** Sprite pixels per shape unit (the 24-unit box → 96px: sharp up to ~48px on a 2× screen). */
const PX = 4;
interface Sprite {
  img: HTMLCanvasElement;
  /** margin around the 24 × h box, in shape units (a glow needs room) */
  pad: number;
  h: number;
}
const sprites = new Map<string, Sprite>();

const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/**
 * Each shape × color is painted once into a small offscreen canvas — shaded like the real thing (a
 * petal lighter at its tip, a glossy balloon, a bubble's rim, a glowing sparkle) — then every frame
 * only draws those images, turned and scaled: no gradients, paths or blurs per frame.
 */
function sprite(id: ShapeId, color: string, glow: boolean): Sprite {
  const key = `${id}|${color}|${glow ? 1 : 0}`;
  const cached = sprites.get(key);
  if (cached) return cached;
  const shape: Shape = SHAPES[id];
  const h = shape.h ?? 24;
  const pad = glow ? 16 : 2;
  const img = document.createElement('canvas');
  img.width = (24 + pad * 2) * PX;
  img.height = (h + pad * 2) * PX;
  const s: Sprite = { img, pad, h };
  sprites.set(key, s);
  const c = img.getContext('2d');
  if (!c) return s;
  c.scale(PX, PX);
  c.translate(pad, pad);
  const path = new Path2D(shape.d);
  if (glow) {
    const g = c.createRadialGradient(12, h / 2, 0, 12, h / 2, 12 + pad);
    g.addColorStop(0, rgba(color, 0.6));
    g.addColorStop(0.3, rgba(color, 0.22));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(-pad, -pad, 24 + pad * 2, h + pad * 2);
  }
  switch (id) {
    case 'petal':
    case 'petal2':
    case 'leaf':
    case 'leaf2':
    case 'heart': {
      const g = c.createLinearGradient(7, 2, 17, 22);
      g.addColorStop(0, mixHex(color, '#FFFFFF', 0.4));
      g.addColorStop(0.55, color);
      g.addColorStop(1, mixHex(color, '#000000', 0.16));
      c.fillStyle = g;
      c.fill(path);
      break;
    }
    case 'balloon': {
      c.strokeStyle = 'rgba(110,100,90,.55)';
      c.lineWidth = 0.7;
      c.stroke(new Path2D(BALLOON_STRING));
      const g = c.createRadialGradient(8.5, 7.5, 0.5, 12, 12, 14);
      g.addColorStop(0, mixHex(color, '#FFFFFF', 0.6));
      g.addColorStop(0.35, color);
      g.addColorStop(1, mixHex(color, '#000000', 0.3));
      c.fillStyle = g;
      c.fill(path);
      break;
    }
    case 'bubble': {
      const g = c.createRadialGradient(12, 12, 3, 12, 12, 9.4);
      g.addColorStop(0, rgba(color, 0.04));
      g.addColorStop(0.72, rgba(color, 0.13));
      g.addColorStop(1, rgba(color, 0.45));
      c.fillStyle = g;
      c.fill(path);
      c.strokeStyle = rgba(color, 0.9);
      c.lineWidth = shape.stroke ?? 1.3;
      c.stroke(path);
      break;
    }
    case 'sparkle':
    case 'star':
    case 'dot': {
      const g = c.createRadialGradient(12, 12, 0, 12, 12, id === 'dot' ? 4 : 11);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.45, mixHex(color, '#FFFFFF', 0.35));
      g.addColorStop(1, color);
      c.fillStyle = g;
      c.fill(path);
      break;
    }
    default:
      if (shape.stroke) {
        c.strokeStyle = color;
        c.lineWidth = shape.stroke;
        c.lineCap = 'round';
        c.stroke(path);
      } else {
        c.fillStyle = color;
        c.fill(path);
      }
  }
  const detail = shape.detail;
  if (detail) {
    c.globalAlpha = detail.opacity;
    c.strokeStyle = detail.color === 'light' ? '#FFFFFF' : color;
    c.lineWidth = detail.stroke;
    c.lineCap = 'round';
    c.stroke(new Path2D(detail.d));
  }
  return s;
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  particles = [];
  canvas?.remove();
  canvas = null;
  ctx = null;
  // the next burst (an RSVP) is usually far off: give the memory back
  sprites.clear();
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
  // the flutter: the piece turns over around its own axis (its height shrinks through 0), and its back
  // is a little darker
  const fy = p.spec.flip[1] > 0 ? Math.cos(p.flip) : 1;
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  const sx = scale * dpr;
  const sy = scale * dpr * (Math.abs(fy) < 0.06 ? 0.06 * Math.sign(fy || 1) : fy);
  c.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, p.x * dpr, p.y * dpr);
  c.globalAlpha = alpha * (fy < 0 ? 0.8 : 1);
  const { img, pad, h } = p.sprite;
  // a balloon hangs from its knot: centred on its body, not on its string
  const top = -h / 2 - pad + (h > 24 ? 5 : 0);
  c.drawImage(img, -12 - pad, top, 24 + pad * 2, h + pad * 2);
}

function frame(now: number) {
  if (!ctx || !canvas) return;
  // the physics steps at most 1/30s (smooth after a stall); lives run on the clock, so a slow device
  // never keeps the canvas up longer than the burst lasts
  const elapsed = Math.min(0.25, Math.max(0, (now - last) / 1000));
  const dt = Math.min(0.034, elapsed);
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const h = window.innerHeight;
  particles = particles.filter((p) => p.age < p.ttl && p.y < h + 80 && p.y > -200);
  for (const p of particles) {
    p.age += elapsed;
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
      sprite: sprite(pick(spec.shapes), colors[i % colors.length]!, !!spec.glow),
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
