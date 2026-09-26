import { coverRect, rectAt, type Motion, type Rect } from '../motion';
import { shotsAt, visibleSpan, type FilmPlan, type Shot } from '../timeline';

/**
 * Painting one frame of the film on a 2D canvas — the same painter for the preview, the real-time
 * recording and the frame-by-frame encoding: the photo under its slow movement (what reaches past the
 * photo's edges filled with a soft, blurred copy of it), a clip's current frame, the title and end
 * cards in the invitation's palette and fonts, and the transitions — a cut, a dissolve, or a quick
 * whip with a motion blur.
 */

export interface Picture {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface CardStyle {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  /** the font families (loaded before painting) */
  display: string;
  heading: string;
  names: string;
  date: string;
  /** the end card's line ("thank you for celebrating with us") */
  thanks: string;
  rtl: boolean;
}

export interface Sources {
  /** what a shot shows now: the photo, the clip's current frame — or a stand-in while it loads */
  picture(shot: Shot): Picture | null;
  /** a small copy of it (the blur beyond a photo's edges) */
  backdrop(shot: Shot): Picture | null;
  /** a photo's movement, in the coordinates of `motionSize` */
  motion(shot: Shot): { motion: Motion; width: number; height: number } | null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

let scratch: HTMLCanvasElement | OffscreenCanvas | null = null;
function scratchCanvas(width: number, height: number) {
  if (!scratch || scratch.width !== width || scratch.height !== height) {
    scratch =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
  }
  return scratch;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Paints the frame at film time `t`. */
export function paintFrame(
  ctx: Ctx,
  t: number,
  plan: FilmPlan,
  width: number,
  height: number,
  sources: Sources,
  card: CardStyle,
): void {
  const now = shotsAt(plan, t);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = card.bg;
  ctx.fillRect(0, 0, width, height);
  if (!now) return void ctx.restore();
  const { shot, next, progress } = now;
  const paint = (c: Ctx, s: Shot) => paintShot(c, s, t, plan, width, height, sources, card);
  if (!next) {
    paint(ctx, shot);
  } else if (next.transition.type === 'dissolve') {
    paint(ctx, shot);
    ctx.globalAlpha = smooth(progress);
    paint(ctx, next);
    ctx.globalAlpha = 1;
  } else if (next.transition.type === 'whip') {
    // both shots slide past quickly (the next one in from the reading side), blurred along the way
    const e = smooth(progress);
    const dir = card.rtl ? -1 : 1;
    const layer = scratchCanvas(width, height);
    const lctx = layer.getContext('2d') as Ctx;
    lctx.save();
    lctx.fillStyle = card.bg;
    lctx.fillRect(0, 0, width, height);
    lctx.translate(-dir * width * e, 0);
    paint(lctx, shot);
    lctx.translate(dir * width, 0);
    paint(lctx, next);
    lctx.restore();
    const blur = Math.sin(Math.PI * clamp01(progress));
    ctx.drawImage(layer, 0, 0);
    if (blur > 0.05) {
      for (const k of [-3, -2, -1, 1, 2, 3]) {
        ctx.globalAlpha = 0.16 * blur;
        ctx.drawImage(layer, k * width * 0.018 * blur, 0);
      }
      ctx.globalAlpha = 1;
    }
  } else {
    paint(ctx, t >= next.start ? next : shot);
  }
  ctx.restore();
}

function paintShot(
  ctx: Ctx,
  shot: Shot,
  t: number,
  plan: FilmPlan,
  width: number,
  height: number,
  sources: Sources,
  card: CardStyle,
) {
  if (shot.kind !== 'item') return paintCard(ctx, shot, t - shot.start, width, height, card);
  const picture = sources.picture(shot);
  if (!picture) {
    ctx.fillStyle = card.bg;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const aspect = width / height;
  let rect: Rect;
  const m = shot.media === 'image' ? sources.motion(shot) : null;
  if (m) {
    const span = visibleSpan(plan, shot);
    const p = span.to > span.from ? (t - span.from) / (span.to - span.from) : 0;
    const r = rectAt(m.motion, p);
    const sx = picture.width / m.width;
    const sy = picture.height / m.height;
    rect = { x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy };
  } else {
    rect = coverRect(picture.width, picture.height, aspect);
  }
  paintPicture(ctx, picture, rect, width, height, sources.backdrop(shot));
}

/** The part of a picture inside `rect`, filling the frame; beyond the picture, its blurred copy. */
export function paintPicture(
  ctx: Ctx,
  picture: Picture,
  rect: Rect,
  width: number,
  height: number,
  backdrop: Picture | null,
) {
  const beyond =
    rect.x < -0.5 ||
    rect.y < -0.5 ||
    rect.x + rect.w > picture.width + 0.5 ||
    rect.y + rect.h > picture.height + 0.5;
  if (beyond) {
    const soft = backdrop ?? picture;
    const c = coverRect(soft.width, soft.height, width / height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(soft.source, c.x, c.y, c.w, c.h, 0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(0, 0, width, height);
  }
  const sx = Math.max(0, rect.x);
  const sy = Math.max(0, rect.y);
  const ex = Math.min(picture.width, rect.x + rect.w);
  const ey = Math.min(picture.height, rect.y + rect.h);
  if (ex <= sx || ey <= sy) return;
  const scale = width / rect.w;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    picture.source,
    sx,
    sy,
    ex - sx,
    ey - sy,
    (sx - rect.x) * scale,
    (sy - rect.y) * scale,
    (ex - sx) * scale,
    (ey - sy) * scale,
  );
}

// ─── the cards ──────────────────────────────────────────────────────────────────────────────────

const font = (weight: number, size: number, family: string) =>
  `${weight} ${Math.round(size)}px "${family}", serif`;

/** The names in as few lines as fit (one, else two split near the middle), and their size. */
function fitLines(ctx: Ctx, text: string, family: string, maxWidth: number, max: number, min: number) {
  const widest = (lines: string[], size: number) => {
    ctx.font = font(400, size, family);
    return Math.max(...lines.map((l) => ctx.measureText(l).width));
  };
  for (let size = max; size >= min; size *= 0.94)
    if (widest([text], size) <= maxWidth) return { lines: [text], size };
  const words = text.split(' ');
  let lines = [text];
  if (words.length > 1) {
    let best = 1;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ').length;
      const b = words.slice(i).join(' ').length;
      const cur = Math.abs(words.slice(0, best).join(' ').length - words.slice(best).join(' ').length);
      if (Math.abs(a - b) < cur) best = i;
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  let size = max;
  while (size > min * 0.6 && widest(lines, size) > maxWidth) size *= 0.94;
  return { lines, size };
}

function paintCard(ctx: Ctx, shot: Shot, local: number, width: number, height: number, card: CardStyle) {
  const unit = Math.min(width, height);
  ctx.fillStyle = card.bg;
  ctx.fillRect(0, 0, width, height);
  // a soft light in the middle
  const glow = ctx.createRadialGradient(
    width / 2,
    height * 0.46,
    0,
    width / 2,
    height * 0.46,
    Math.max(width, height) * 0.62,
  );
  glow.addColorStop(0, card.surface);
  glow.addColorStop(1, card.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const appear = smooth((local - 0.1) / 0.8);
  const rise = (1 - appear) * unit * 0.02;
  // within a dissolve the whole card fades with it
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.direction = card.rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = width / 2;
  const cy = height * 0.47;
  const title = shot.kind === 'title';
  const names = fitLines(
    ctx,
    card.names,
    card.display,
    width * 0.84,
    unit * (title ? 0.12 : 0.09),
    unit * 0.05,
  );
  const lineHeight = names.size * 1.18;
  const block = lineHeight * names.lines.length;

  ctx.globalAlpha = base * appear;
  // the accent rule above the names
  const ruleY = cy - block / 2 - unit * (title ? 0.07 : 0.1) + rise;
  ctx.fillStyle = card.accent;
  const ruleW = unit * 0.12 * (0.4 + 0.6 * appear);
  ctx.fillRect(cx - ruleW / 2, ruleY, ruleW, Math.max(2, unit * 0.003));

  if (!title && card.thanks) {
    ctx.fillStyle = card.muted;
    ctx.font = font(400, unit * 0.04, card.heading);
    ctx.fillText(card.thanks, cx, ruleY - unit * 0.06, width * 0.86);
  }
  ctx.fillStyle = card.ink;
  ctx.font = font(400, names.size, card.display);
  names.lines.forEach((line, i) => {
    ctx.fillText(line, cx, cy - block / 2 + lineHeight * (i + 0.5) + rise, width * 0.9);
  });
  if (card.date) {
    ctx.fillStyle = card.muted;
    ctx.font = font(400, unit * 0.036, card.heading);
    if ('letterSpacing' in ctx)
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${Math.round(unit * 0.004)}px`;
    ctx.fillText(card.date, cx, cy + block / 2 + unit * 0.075 + rise * 1.5, width * 0.86);
  }
  ctx.restore();
}
