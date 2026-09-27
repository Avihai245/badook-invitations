import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TemplateManifestSchema } from '@/features/invitations/contracts/schemas';
import { SCENE_PROPS } from '@/features/invitations/contracts/types';
import { sceneModel } from '@/features/invitations/renderer/scene/model';
import { PROPS, lenPx, poseAt, propKeyframes, targetBox } from '@/features/invitations/renderer/scene/props';
import { SceneProp } from '@/features/invitations/renderer/scene/SceneProp';
import { demoDocument } from '@/features/invitations/templates/demo';
import { TEMPLATE_IDS, requireTemplate } from '@/features/invitations/templates/registry';

const bases = { templateMedia: '', uploads: 'https://storage.example/invitation-media' };
/** Phones small and large, and a tablet held upright: the backdrop is the screen. */
const SCREENS = [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
  { w: 430, h: 932 },
  { w: 768, h: 1024 },
];
const PHONE = SCREENS[0]!;

describe('scene props — the flight', () => {
  it.each(SCENE_PROPS)(
    '%s: starts at its first pose, ends at its last, and stays there past either end',
    (kind) => {
      const spec = PROPS[kind];
      const first = spec.keys[0]!;
      const last = spec.keys.at(-1)!;
      expect([first.t, last.t]).toEqual([0, 1]);
      expect(poseAt(spec, 0)).toEqual({ x: first.x, y: first.y, rotate: first.rotate, scale: first.scale });
      expect(poseAt(spec, 1)).toEqual({ x: last.x, y: last.y, rotate: last.rotate, scale: last.scale });
      expect(poseAt(spec, -0.5)).toEqual(poseAt(spec, 0));
      expect(poseAt(spec, 1.5)).toEqual(poseAt(spec, 1));
    },
  );

  it.each(SCENE_PROPS)('%s: passes through every key pose, with no jump between them', (kind) => {
    const spec = PROPS[kind];
    for (const k of spec.keys) {
      const p = poseAt(spec, k.t);
      expect(p.x[0]).toBeCloseTo(k.x[0], 6);
      expect(p.y[1]).toBeCloseTo(k.y[1], 6);
      expect(p.rotate).toBeCloseTo(k.rotate, 6);
      expect(p.scale).toBeCloseTo(k.scale, 6);
    }
    // 1/200 of the scroll never moves it more than 3% of the screen, nor shrinks it by more than 1%
    let prev = poseAt(spec, 0);
    for (let i = 1; i <= 200; i++) {
      const p = poseAt(spec, i / 200);
      const dx = lenPx(p.x, PHONE.w, PHONE.h) - lenPx(prev.x, PHONE.w, PHONE.h);
      const dy = lenPx(p.y, PHONE.w, PHONE.h) - lenPx(prev.y, PHONE.w, PHONE.h);
      expect(Math.hypot(dx, dy)).toBeLessThan(0.03 * PHONE.h);
      expect(Math.abs(p.scale - prev.scale)).toBeLessThan(0.01);
      prev = p;
    }
  });

  it.each(SCENE_PROPS)(
    '%s: arrives at its target, and stays on the screen all the way, on every screen',
    (kind) => {
      const spec = PROPS[kind];
      const end = poseAt(spec, 1);
      for (const s of SCREENS) {
        const w = (spec.target.width / 100) * s.w;
        const h = w * spec.target.aspect;
        const cx = lenPx(spec.target.x, s.w, s.h);
        const cy = lenPx(spec.target.y, s.w, s.h);
        // in it (the ball, the rocket) or beside it (the balloon by the moon)
        expect(Math.abs(lenPx(end.x, s.w, s.h) - cx), `${kind} ${s.w}×${s.h}`).toBeLessThan(w);
        expect(Math.abs(lenPx(end.y, s.w, s.h) - cy), `${kind} ${s.w}×${s.h}`).toBeLessThan(h / 2);
        for (let i = 0; i <= 50; i++) {
          const p = poseAt(spec, i / 50);
          const x = lenPx(p.x, s.w, s.h);
          const y = lenPx(p.y, s.w, s.h);
          expect(x, `${kind} x at ${i / 50}`).toBeGreaterThan(0);
          expect(x).toBeLessThan(s.w);
          expect(y, `${kind} y at ${i / 50}`).toBeGreaterThan(0);
          expect(y).toBeLessThan(s.h);
        }
      }
    },
  );

  it('the basketball ends on the rim’s centre — just above it, so the net takes it', () => {
    const spec = PROPS.basketball;
    const end = poseAt(spec, 1);
    const box = { w: spec.target.width, h: spec.target.width * spec.target.aspect };
    // the rim: (170, 230) of the hoop's 340 × 360
    const rim = { x: spec.target.x[0], y: spec.target.y[0] - box.h / 2 + (230 / 360) * box.h };
    expect(end.x[0]).toBeCloseTo(rim.x, 6);
    expect(end.y[1]).toBe(spec.target.y[1]);
    expect(rim.y - end.y[0]).toBeGreaterThan(0);
    expect(rim.y - end.y[0]).toBeLessThan(3);
    // smaller in the distance: the ball fits the hoop (at most 5/8 of the rim, 180 of the 340)
    expect(spec.size * end.scale).toBeLessThan(box.w * (180 / 340) * (5 / 8));
  });

  it('the football ends in the net’s top right corner, the goal standing on the goal line', () => {
    const spec = PROPS.football;
    const end = poseAt(spec, 1);
    const w = spec.target.width;
    const h = w * spec.target.aspect;
    // the corner inside the net: (560, 70) of the goal's 640 × 260
    expect(end.x[0]).toBeCloseTo(spec.target.x[0] - w / 2 + (560 / 640) * w, 6);
    expect(end.y[0]).toBeCloseTo(spec.target.y[0] - h / 2 + (70 / 260) * h, 6);
    // its foot on the last picture's goal line, 42% of the way down
    expect(spec.target.y[0] + h / 2).toBeCloseTo(0, 6);
    expect(spec.target.y[1]).toBe(42);
  });

  it('the rocket lands upright on the moon', () => {
    const spec = PROPS.rocket;
    const end = poseAt(spec, 1);
    expect(end.rotate).toBe(0);
    expect(end.x).toEqual(spec.target.x);
  });

  it('plays as CSS: 41 poses from 0% to 100%, in lengths of the backdrop', () => {
    const k = propKeyframes('basketball');
    expect(k.startsWith('@keyframes scProp-basketball{0%{translate:calc(18cqw + 0cqh - 50%)')).toBe(true);
    expect(k.match(/%\{/g)).toHaveLength(41);
    expect(
      k.endsWith(
        '100%{translate:calc(70cqw + 0cqh - 50%) calc(-1cqw + 30cqh - 50%);rotate:-600deg;scale:0.48}}',
      ),
    ).toBe(true);
    expect(targetBox('basketball')).toEqual({
      left: 'calc(53cqw + 0cqh)',
      top: 'calc(-23cqw + 30cqh)',
      width: '34cqw',
    });
  });
});

describe('scene props — drawn', () => {
  it.each(SCENE_PROPS)(
    '%s: the mover between its target’s halves, decorative, with its own flight',
    (kind) => {
      const html = renderToStaticMarkup(<SceneProp kind={kind} />);
      expect(html).toMatch(new RegExp(`^<div class="sc-prop" data-prop="${kind}" aria-hidden="true">`));
      expect(html).toContain(`@keyframes scProp-${kind}{`);
      expect(html).toContain('animation-timeline:scroll(nearest)');
      expect(html).toContain('prefers-reduced-motion:reduce');
      const at = (cls: string) => html.indexOf(`class="sc-target ${cls}"`);
      const mover = html.indexOf('class="sc-mover"');
      expect(mover).toBeGreaterThan(0);
      if (at('sc-target-back') >= 0) expect(at('sc-target-back')).toBeLessThan(mover);
      if (at('sc-target-front') >= 0) expect(at('sc-target-front')).toBeGreaterThan(mover);
      expect(at('sc-target-back') >= 0 || at('sc-target-front') >= 0).toBe(true);
      expect(html).not.toMatch(/<text/);
    },
  );

  it('the designs with a prop carry it into their scene; the others have none', () => {
    const withProp = TEMPLATE_IDS.filter((id) => requireTemplate(id).manifest.scene?.prop).map((id) => [
      id,
      requireTemplate(id).manifest.scene!.prop,
    ]);
    expect(withProp).toEqual([
      ['buzzer-beater', 'basketball'],
      ['golden-goal', 'football'],
      ['moonshot', 'rocket'],
      ['lullaby-sky', 'balloon'],
    ]);
    for (const [id, prop] of withProp) {
      const m = sceneModel({ doc: demoDocument(id!), template: requireTemplate(id!).manifest, bases });
      expect(m.prop).toBe(prop);
    }
    const celestial = requireTemplate('celestial').manifest;
    expect(sceneModel({ doc: demoDocument('celestial'), template: celestial, bases }).prop).toBeNull();
    const { prop: _prop, ...scene } = requireTemplate('buzzer-beater').manifest.scene!;
    expect(TemplateManifestSchema.parse({ ...celestial, scene }).scene!.prop).toBeNull();
  });
});
