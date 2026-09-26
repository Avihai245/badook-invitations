import { motionAllowed } from './motion';

/**
 * Light for the cinematic openings (renderer/cover/Openings.client.tsx): fireworks — shells that rise
 * on a trail and burst into falling sparks — and gold dust blown outward in a swirl. A tiny canvas
 * engine like burst.ts: a fixed, full-screen, click-through <canvas aria-hidden> over the cover and
 * the page, alive only while sparks fly (≈ 3s), additive light, a fixed budget (fewer on a phone and
 * on a low-end device). Browser only; nothing with reduced motion, and a hidden tab drops it at once.
 */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  color: string;
  drag: number;
  gravity: number;
  /** a shell: bursts into `burst` when it dies */
  burst?: { colors: readonly string[]; count: number };
  twinkle?: number;
  /** a point of dust (a soft glowing dot) rather than a streak */
  dot?: boolean;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let sparks: Spark[] = [];
let raf = 0;
let last = 0;
let dpr = 1;

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  sparks = [];
  window.removeEventListener('resize', size);
  document.removeEventListener('visibilitychange', onVisibility);
  canvas?.remove();
  canvas = null;
  ctx = null;
}
function onVisibility() {
  if (document.hidden) stop();
}
function size() {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}
function ensureCanvas(): boolean {
  if (canvas && ctx) return true;
  const el = document.createElement('canvas');
  el.className = 'fx-sparks';
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

/** A smaller budget on a phone-sized or low-end device. */
function budget(phone: number, desktop: number): number {
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const low = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
  return Math.round((small ? phone : desktop) * (low ? 0.6 : 1));
}

function explode(at: Spark) {
  const { colors, count } = at.burst!;
  const speed = rand(150, 230) * (window.innerWidth < 600 ? 0.8 : 1);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand(-0.08, 0.08);
    const v = speed * rand(0.55, 1);
    sparks.push({
      x: at.x,
      y: at.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      age: 0,
      ttl: rand(1.1, 1.7),
      size: rand(1.4, 2.4),
      color: colors[i % colors.length]!,
      drag: 1.6,
      gravity: 70,
      twinkle: Math.random() < 0.35 ? rand(0, 6) : undefined,
    });
  }
}

function frame(now: number) {
  if (!ctx || !canvas) return;
  const dt = Math.min(0.034, Math.max(0, (now - last) / 1000));
  last = now;
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  // the trails: what was drawn fades a little each frame (on a transparent canvas: erase, not paint)
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.globalCompositeOperation = 'lighter';
  const next: Spark[] = [];
  for (const s of sparks) {
    s.age += dt;
    if (s.age < 0) {
      next.push(s);
      continue;
    }
    const px = s.x;
    const py = s.y;
    const decay = Math.exp(-s.drag * dt);
    s.vx *= decay;
    s.vy = s.vy * decay + s.gravity * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const k = s.age / s.ttl;
    if (k >= 1) {
      if (s.burst) explode(s);
      continue;
    }
    let alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    if (s.twinkle !== undefined) alpha *= 0.55 + 0.45 * Math.sin(s.twinkle + s.age * 24);
    c.globalAlpha = Math.max(0, alpha);
    if (s.dot) {
      // a soft halo and a bright core
      c.fillStyle = s.color;
      c.globalAlpha = Math.max(0, alpha * 0.28);
      c.beginPath();
      c.arc(s.x * dpr, s.y * dpr, s.size * 2.6 * dpr, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = Math.max(0, alpha);
      c.beginPath();
      c.arc(s.x * dpr, s.y * dpr, s.size * dpr, 0, Math.PI * 2);
      c.fill();
    } else {
      c.strokeStyle = s.color;
      c.lineWidth = s.size * dpr;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(px * dpr, py * dpr);
      c.lineTo(s.x * dpr, s.y * dpr);
      c.stroke();
    }
    next.push(s);
  }
  sparks = next;
  if (sparks.length) raf = requestAnimationFrame(frame);
  else stop();
}

function run() {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

/**
 * Fireworks over the screen: `shells` rise from the bottom in turn and burst in the given colors.
 * Returns how many shells flew (0: motion off, no canvas).
 */
export function fireworks(colors: readonly string[], shells?: number): number {
  if (!motionAllowed() || document.hidden || !colors.length || !ensureCanvas()) return 0;
  const n = shells ?? budget(4, 6);
  const per = budget(34, 56);
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < n; i++) {
    const x = w * (0.18 + ((i * 0.37) % 0.64)) + rand(-20, 20);
    const top = h * rand(0.16, 0.42);
    const flight = rand(0.62, 0.8);
    sparks.push({
      x,
      y: h + 10,
      vx: rand(-18, 18),
      vy: -(h + 10 - top) / flight - 30,
      age: -i * 0.26,
      ttl: flight,
      size: 2.4,
      color: '#FFF4D6',
      drag: 0.4,
      gravity: 60,
      burst: {
        colors: [colors[i % colors.length]!, colors[(i + 1) % colors.length]!, '#FFFFFF'],
        count: per,
      },
    });
  }
  run();
  return n;
}

/** Gold dust blown outward from a point (viewport px), in a slow swirl. */
export function goldDust(colors: readonly string[], x: number, y: number): number {
  if (!motionAllowed() || document.hidden || !colors.length || !ensureCanvas()) return 0;
  const n = budget(90, 170);
  const reach = Math.min(window.innerWidth, window.innerHeight);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const v = reach * rand(0.12, 0.62);
    // a swirl: part of the velocity turns sideways
    const swirl = rand(0.35, 0.8);
    sparks.push({
      x: x + rand(-60, 60),
      y: y + rand(-30, 30),
      vx: Math.cos(a) * v - Math.sin(a) * v * swirl,
      vy: Math.sin(a) * v + Math.cos(a) * v * swirl,
      age: -rand(0, 0.3),
      ttl: rand(1.6, 2.6),
      size: rand(0.8, 2.1),
      color: colors[i % colors.length]!,
      drag: 1.5,
      gravity: -14,
      twinkle: rand(0, 6),
      dot: true,
    });
  }
  run();
  return n;
}

/** Drops whatever is flying (a replay in the editor, a page leaving). */
export function clearSparks() {
  if (canvas) stop();
}
