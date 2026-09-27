import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TemplateManifestSchema } from '@/features/invitations/contracts/schemas';
import { SCENE_PROPS } from '@/features/invitations/contracts/types';
import { sceneModel } from '@/features/invitations/renderer/scene/model';
import {
  PROPS,
  PROP_COLUMN,
  firstPose,
  flightCss,
  flightPhases,
  lastPose,
  lenPx,
  markAt,
  markCss,
  originBox,
  poseAt,
  propFades,
  propKeyframes,
  propPose,
  propRanges,
  targetBox,
} from '@/features/invitations/renderer/scene/props';
import { SceneProp } from '@/features/invitations/renderer/scene/SceneProp';
import { demoDocument } from '@/features/invitations/templates/demo';
import { TEMPLATE_IDS, requireTemplate } from '@/features/invitations/templates/registry';

const bases = { templateMedia: '', uploads: 'https://storage.example/invitation-media' };
/**
 * Phones small and large, a tablet held upright, a phone on its side: the prop's box — the screen, or on a
 * wide one a portrait column in its middle (PROP_COLUMN of its height wide).
 */
const SCREENS = [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
  { w: 430, h: 932 },
  { w: 768, h: 1024 },
  { w: 844, h: 390 },
].map((s) => ({ w: Math.min(s.w, PROP_COLUMN * s.h), h: s.h }));
const PHONE = SCREENS[0]!;
/** Invitations short and long: the scroll, in screens. */
const LENGTHS = [5, 9, 16, 30];

describe('scene props — the flight', () => {
  it.each(SCENE_PROPS)(
    '%s: starts at its first pose, ends at its last, and stays there past either end',
    (kind) => {
      const spec = PROPS[kind];
      const phases = flightPhases(spec);
      for (const p of phases) expect([p.keys[0]!.t, p.keys.at(-1)!.t]).toEqual([0, 1]);
      // each stretch begins where the one before it ends
      for (let i = 1; i < phases.length; i++) {
        const [a, b] = [phases[i - 1]!.keys.at(-1)!, phases[i]!.keys[0]!];
        expect({ ...a, t: 0 }).toEqual({ ...b, t: 0 });
        expect(phases[i - 1]!.range[1]).toEqual(phases[i]!.range[0]);
      }
      const first = phases[0]!.keys[0]!;
      const last = phases.at(-1)!.keys.at(-1)!;
      expect(firstPose(spec)).toEqual({ x: first.x, y: first.y, rotate: first.rotate, scale: first.scale });
      expect(lastPose(spec)).toEqual({ x: last.x, y: last.y, rotate: last.rotate, scale: last.scale });
      for (const n of LENGTHS) {
        expect(propPose(spec, 0, n)).toEqual(firstPose(spec));
        expect(propPose(spec, -0.5, n)).toEqual(firstPose(spec));
        expect(propPose(spec, 1, n)).toEqual(lastPose(spec));
        expect(propPose(spec, 1.5, n)).toEqual(lastPose(spec));
      }
      // a flight in one stretch: over the whole scroll, whatever its length
      if (phases.length === 1) expect(propPose(spec, 0.37, 5)).toEqual(poseAt(spec, 0.37));
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
    // a 30th of a screen of scroll never moves it more than 3% of the screen, nor shrinks it by more
    // than 1% — on an invitation of any length
    for (const n of LENGTHS) {
      const steps = n * 30;
      let prev = propPose(spec, 0, n);
      for (let i = 1; i <= steps; i++) {
        const p = propPose(spec, i / steps, n);
        const dx = lenPx(p.x, PHONE.w, PHONE.h) - lenPx(prev.x, PHONE.w, PHONE.h);
        const dy = lenPx(p.y, PHONE.w, PHONE.h) - lenPx(prev.y, PHONE.w, PHONE.h);
        expect(Math.hypot(dx, dy), `${kind} ${n} screens, ${i}/${steps}`).toBeLessThan(0.03 * PHONE.h);
        expect(Math.abs(p.scale - prev.scale)).toBeLessThan(0.01);
        prev = p;
      }
    }
  });

  it.each(SCENE_PROPS)(
    '%s: arrives at its target, and stays on the screen all the way, on every screen',
    (kind) => {
      const spec = PROPS[kind];
      const end = lastPose(spec);
      for (const s of SCREENS) {
        const w = (spec.target.width / 100) * s.w;
        const h = w * spec.target.aspect;
        const cx = lenPx(spec.target.x, s.w, s.h);
        const cy = lenPx(spec.target.y, s.w, s.h);
        // in it (the ball, the rocket) or beside it (the balloon by the moon)
        expect(Math.abs(lenPx(end.x, s.w, s.h) - cx), `${kind} ${s.w}×${s.h}`).toBeLessThan(w);
        expect(Math.abs(lenPx(end.y, s.w, s.h) - cy), `${kind} ${s.w}×${s.h}`).toBeLessThan(h / 2);
        for (const n of LENGTHS)
          for (let i = 0; i <= 100; i++) {
            const p = propPose(spec, i / 100, n);
            const x = lenPx(p.x, s.w, s.h);
            const y = lenPx(p.y, s.w, s.h);
            expect(x, `${kind} x at ${i / 100} of ${n} screens`).toBeGreaterThan(0);
            expect(x).toBeLessThan(s.w);
            expect(y, `${kind} y at ${i / 100} of ${n} screens`).toBeGreaterThan(0);
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

  describe('the head tefillin', () => {
    const spec = PROPS.tefillin;
    /** A point of the art (100 × 140) with the prop at `pose`: in lengths of the prop's box. */
    const onArt = (pose: ReturnType<typeof lastPose>, x: number, y: number) => {
      const unit = (spec.size / 100) * pose.scale;
      const [dx, dy] = [(x - 50) * unit, (y - 70) * unit];
      const a = (pose.rotate * Math.PI) / 180;
      return {
        x: [pose.x[0] + dx * Math.cos(a) - dy * Math.sin(a), pose.x[1]] as const,
        y: [pose.y[0] + dx * Math.sin(a) + dy * Math.cos(a), pose.y[1]] as const,
      };
    };
    /** A point of the boy (400 × 600): in lengths of the prop's box. */
    const onBoy = (x: number, y: number) => {
      const t = spec.target;
      const unit = t.width / 400;
      return {
        x: [t.x[0] + (x - 200) * unit, t.x[1]] as const,
        y: [t.y[0] + (y - 300) * unit, t.y[1]] as const,
      };
    };

    it('come to rest on his head: the base’s front edge on his hairline, on the line of his face', () => {
      const end = lastPose(spec);
      expect(end.rotate).toBe(0);
      // the base's front edge, centred (58, 68 of the art) on his hairline (226, 144 of the boy)
      const base = onArt(end, 58, 68);
      const hairline = onBoy(226, 144);
      expect(base.x[0]).toBeCloseTo(hairline.x[0], 1);
      expect(base.x[1]).toBe(hairline.x[1]);
      expect(base.y[0]).toBeCloseTo(hairline.y[0], 1);
      expect(base.y[1]).toBe(hairline.y[1]);
      // the box's front (40 of the art) a quarter of his head's width (140 of the boy), as on a boy of 13
      const front = (40 * spec.size * end.scale) / 100;
      const head = (140 * spec.target.width) / 400;
      expect(front / head).toBeGreaterThan(0.22);
      expect(front / head).toBeLessThan(0.27);
    });

    it('start in their bag: the base’s front edge on (70, 72) of it, the bag at the lower left', () => {
      const o = spec.origin!;
      const unit = o.width / 140;
      const inBag = onArt(firstPose(spec), 58, 68);
      expect(inBag.x[0]).toBeCloseTo(o.x[0] + (70 - 70) * unit, 1);
      expect(inBag.y[0]).toBeCloseTo(o.y[0] + (72 - 55) * unit, 1);
      expect(inBag.y[1]).toBe(o.y[1]);
      for (const s of SCREENS) {
        const left = lenPx([o.x[0] - o.width / 2, o.x[1]], s.w, s.h) / s.w;
        const right = lenPx([o.x[0] + o.width / 2, o.x[1]], s.w, s.h) / s.w;
        const bottom = lenPx([o.y[0] + (o.width * o.aspect) / 2, o.y[1]], s.w, s.h) / s.h;
        expect(left).toBeGreaterThan(0);
        expect(right).toBeLessThan(0.5);
        expect(bottom).toBeLessThan(1);
        expect(bottom).toBeGreaterThan(0.85);
      }
      expect(originBox('tefillin')).toEqual({
        left: 'calc(5cqw + 0cqh)',
        top: 'calc(-26.72cqw + 94cqh)',
        width: '34cqw',
      });
      expect(originBox('basketball')).toBeNull();
    });

    it('rise out of the bag in the first half screen, and the bag is gone before the first picture changes', () => {
      for (const n of LENGTHS) {
        const lifted = markAt(spec.lift!.range[1], n) * n;
        expect(lifted).toBeLessThanOrEqual(0.5);
        const [gone] = [markAt(spec.origin!.fade[1], n) * n];
        expect(gone).toBeLessThanOrEqual(0.5);
        // the strap comes out once the box is clear of the bag's bottom
        const strap = propFades(spec, markAt(spec.trail!.in[0], n), n);
        expect(strap.trailIn).toBe(0);
        const box = onArt(propPose(spec, markAt(spec.trail!.in[0], n), n), 58, 138);
        const bagBottom = spec.origin!.y[0] + (107 - 55) * (spec.origin!.width / 140);
        expect(box.y[0]).toBeLessThanOrEqual(bagBottom);
      }
    });

    it('come down on the film’s own last screen: the boy comes in, the strap goes, they land before the end', () => {
      expect(spec.stage).toBe(1);
      expect(spec.rest).toBe('end');
      for (const n of LENGTHS) {
        const stage = 1 - 1 / n;
        const [ta, tb] = [markAt(spec.target.reveal[0], n), markAt(spec.target.reveal[1], n)];
        const [la, lb] = [markAt(spec.land!.range[0], n), markAt(spec.land!.range[1], n)];
        const rb = markAt(spec.trail!.out[1], n);
        // the boy and the landing begin as the stage comes in, the box above his head
        expect(ta).toBeCloseTo(stage, 6);
        expect(la).toBeCloseTo(stage, 6);
        expect(tb).toBeLessThan(1);
        const above = propPose(spec, la, n);
        expect(lenPx(above.y, PHONE.w, PHONE.h)).toBeLessThan(
          lenPx(lastPose(spec).y, PHONE.w, PHONE.h) - 0.2 * PHONE.h,
        );
        // the strap is gone before the box reaches his head, and it has landed a little before the end
        expect(rb).toBeLessThan(lb);
        expect(lb).toBeLessThan(1);
        expect(propPose(spec, lb, n)).toEqual(lastPose(spec));
        // before the stage, nothing of the finale shows
        expect(propFades(spec, stage - 0.01, n).target).toBe(0);
        expect(propFades(spec, 1, n)).toEqual({ target: 1, origin: 1, trailIn: 1, trailOut: 1 });
      }
    });

    it('plays as CSS: a stretch each for the lift, the flight and the landing, measured in screens', () => {
      const k = propKeyframes('tefillin');
      for (const name of ['scProp-tefillin-lift{', 'scProp-tefillin{', 'scProp-tefillin-land{'])
        expect(k).toContain(`@keyframes ${name}`);
      expect(k.match(/%\{/g)).toHaveLength(3 * 41);
      expect(flightCss('tefillin')).toBe(
        'animation:scProp-tefillin-lift linear both,scProp-tefillin linear forwards,scProp-tefillin-land linear forwards;' +
          'animation-timeline:scroll(nearest),scroll(nearest),scroll(nearest);' +
          'animation-range:0% calc(0.42 * var(--sc-h, 100vh)),' +
          'calc(0.42 * var(--sc-h, 100vh)) calc(100% - 1 * var(--sc-h, 100vh)),' +
          'calc(100% - 1 * var(--sc-h, 100vh)) calc(100% - 0.06 * var(--sc-h, 100vh))',
      );
      expect(flightCss('basketball')).toBe(
        'animation:scProp-basketball linear both;animation-timeline:scroll(nearest)',
      );
      expect(propRanges('tefillin')).toEqual({
        '--sc-ta': 'calc(100% - 1 * var(--sc-h, 100vh))',
        '--sc-tb': 'calc(100% - 0.4 * var(--sc-h, 100vh))',
        '--sc-oa': 'calc(0.2 * var(--sc-h, 100vh))',
        '--sc-ob': 'calc(0.45 * var(--sc-h, 100vh))',
        '--sc-ia': 'calc(0.16 * var(--sc-h, 100vh))',
        '--sc-ib': 'calc(0.32 * var(--sc-h, 100vh))',
        '--sc-ra': 'calc(100% - 0.95 * var(--sc-h, 100vh))',
        '--sc-rb': 'calc(100% - 0.6 * var(--sc-h, 100vh))',
      });
      expect(propRanges('basketball')).toEqual({ '--sc-ta': '35%', '--sc-tb': '55%' });
      expect(markCss(0.5)).toBe('50%');
      expect(markAt({ after: 2 }, 8)).toBe(0.25);
      expect(markAt({ before: 2 }, 8)).toBe(0.75);
    });
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
      expect(html).toMatch(new RegExp(`^<div class="sc-prop" data-prop="${kind}"[^>]* aria-hidden="true"`));
      // the ranges its parts play over, on the prop
      expect(html).toContain(`--sc-ta:${propRanges(kind)['--sc-ta']}`);
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

  it('the tefillin: the boy behind, the box between the halves of its bag, its strap a layer of its own', () => {
    const html = renderToStaticMarkup(<SceneProp kind="tefillin" />);
    expect(html).toMatch(/^<div class="sc-prop" data-prop="tefillin" data-rest="end" aria-hidden="true"/);
    const at = (s: string) => html.indexOf(s);
    expect(at('class="sc-target sc-target-back"')).toBeLessThan(at('class="sc-origin"'));
    expect(at('class="sc-origin"')).toBeLessThan(at('class="sc-mover"'));
    expect(at('class="sc-mover"')).toBeLessThan(at('class="sc-origin sc-origin-front"'));
    // the strap travels under the box, in its own layer (it comes and goes)
    expect(at('class="sc-trail-in"')).toBeGreaterThan(at('class="sc-mover"'));
    expect(at('class="sc-trail"')).toBeGreaterThan(at('class="sc-trail-in"'));
    // the light behind him, and his straps — drawn on at the finale
    expect(html).toContain('class="sc-halo"');
    expect(html.match(/class="sc-strap" pathLength="1"/g)!.length).toBe(8);
    expect(html).toContain('class="sc-strap-hang"');
    // resting at the end (reduced motion): on his head
    const end = lastPose(PROPS.tefillin);
    expect(html).toContain(`rotate:${end.rotate}deg!important`);
    expect(html).not.toMatch(/<text/);
  });

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
      ['first-tefillin', 'tefillin'],
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
