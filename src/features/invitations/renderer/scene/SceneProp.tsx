import type { CSSProperties, ReactNode } from 'react';
import type { SceneProp as Kind } from '../../contracts/types';
import {
  PROPS,
  firstPose,
  flightCss,
  lastPose,
  originBox,
  poseCss,
  propKeyframes,
  propRanges,
  targetBox,
} from './props';
import { PropFinale } from './PropFinale.client';

/**
 * The scene's prop (renderer/scene/props.ts), drawn: the mover (a basketball, a football, a rocket, a
 * hot-air balloon, the head tefillin) between the two halves of its target — the part behind it (a
 * backboard, the net's far side, the moon, the bar mitzvah boy) and the part in front of it (the hoop's
 * near rim and net, the goal's frame) — so it really goes in; and, where it starts in something (the
 * tefillin's velvet bag), between that one's halves too. The scroll plays its flight (the keyframes
 * below, scroll-driven animations — a stretch each for its lift, its flight and its landing) and the
 * fades of its parts (the ranges on `.sc-prop`); SceneDriver plays them where the browser can't;
 * PropFinale plays the arrival. Pinned with the backdrop, behind the texts; decorative (aria-hidden).
 * With reduced motion the prop rests at its target — from the start, or (`rest: 'end'`) coming in with
 * it at the end.
 */
export function SceneProp({ kind }: { kind: Kind }) {
  const spec = PROPS[kind];
  const start = poseCss(firstPose(spec));
  const end = poseCss(lastPose(spec));
  const target = targetBox(kind) as CSSProperties;
  const from = originBox(kind) as CSSProperties | null;
  const sel = `.sc-prop[data-prop='${kind}']`;
  // at rest (reduced motion, or the host's motion at 0): at its target
  const rest = `${sel} .sc-mover{translate:${end.translate}!important;rotate:${end.rotate}!important;scale:${end.scale}!important}`;
  const css =
    propKeyframes(kind) +
    `@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:scroll()){:root:not([data-motion='none']) ${sel} .sc-mover{${flightCss(kind)}}}}` +
    `@media (prefers-reduced-motion:reduce){${rest}}:root[data-motion='none'] ${rest}`;
  const [back, mover, front] = ART[kind];
  const origin = ORIGIN[kind];
  return (
    <div
      className="sc-prop"
      data-prop={kind}
      data-rest={spec.rest === 'end' ? 'end' : undefined}
      aria-hidden="true"
      style={propRanges(kind) as CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {back ? (
        <div className="sc-target sc-target-back" style={target}>
          {back}
        </div>
      ) : null}
      {origin && from ? (
        <div className="sc-origin" style={from}>
          {origin[0]}
        </div>
      ) : null}
      <div className="sc-mover" style={{ width: `${spec.size}cqw`, ...start } as CSSProperties}>
        <div className="sc-inner">{mover}</div>
      </div>
      {origin && from ? (
        <div className="sc-origin sc-origin-front" style={from}>
          {origin[1]}
        </div>
      ) : null}
      {front ? (
        <div className="sc-target sc-target-front" style={target}>
          {front}
        </div>
      ) : null}
      <PropFinale kind={kind} />
    </div>
  );
}

// ─── the art (SVG; the ids are the page's own — one prop per page) ───────────────────────────────────

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A net between two rings (an ellipse's half: the near one, or the far one), woven in diamonds. */
function net(
  top: { cx: number; cy: number; rx: number; ry: number },
  bottom: { cx: number; cy: number; rx: number; ry: number },
  near: boolean,
  strands = 10,
): string {
  const at = (ring: typeof top, i: number) => {
    const a = (Math.PI * i) / strands + (near ? 0 : Math.PI);
    return [ring.cx + ring.rx * Math.cos(a), ring.cy + ring.ry * Math.sin(a)] as const;
  };
  const mid = {
    cx: (top.cx + bottom.cx) / 2,
    cy: (top.cy + bottom.cy) / 2,
    rx: (top.rx + bottom.rx) / 2,
    ry: (top.ry + bottom.ry) / 2,
  };
  let d = '';
  for (let i = 0; i <= strands; i++) {
    const [tx, ty] = at(top, i);
    const [mx, my] = at(mid, Math.min(strands, i + 0.5));
    const [bx, by] = at(bottom, i);
    const [mx2, my2] = at(mid, Math.max(0, i - 0.5));
    // two diagonals from each knot of the rim, crossing at the middle ring, down to the bottom ring
    d += `M${r1(tx)} ${r1(ty)}L${r1(mx)} ${r1(my)}L${r1(bx)} ${r1(by)}`;
    d += `M${r1(tx)} ${r1(ty)}L${r1(mx2)} ${r1(my2)}L${r1(bx)} ${r1(by)}`;
  }
  return d;
}

/** A regular pentagon's points (a football's patch). */
const pentagon = (cx: number, cy: number, r: number, turn = -90) =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((turn + 72 * k) * Math.PI) / 180;
    return `${r1(cx + r * Math.cos(a))},${r1(cy + r * Math.sin(a))}`;
  }).join(' ');

const RIM = { cx: 170, cy: 230, rx: 90, ry: 17 };
const NET_BOTTOM = { cx: 170, cy: 336, rx: 54, ry: 10 };

const basketball: [ReactNode, ReactNode, ReactNode] = [
  // the backboard (glass, as in an arena — the texts that pass over it stay legible), the rim's far
  // half and the net's far side
  <svg key="back" viewBox="0 0 340 360">
    <rect
      x="25"
      y="12"
      width="290"
      height="196"
      rx="10"
      fill="#DCEBFF"
      fillOpacity=".14"
      stroke="#F8FBFF"
      strokeOpacity=".85"
      strokeWidth="5"
    />
    <rect x="118" y="104" width="104" height="84" fill="none" stroke="#F26B1D" strokeWidth="7" />
    <rect x="158" y="206" width="24" height="18" rx="2" fill="#C94A0C" />
    <path d="M80 230A90 17 0 0 1 260 230" fill="none" stroke="#B8430B" strokeWidth="7" />
    <path
      className="sc-net"
      d={net(RIM, NET_BOTTOM, false)}
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity=".5"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
  </svg>,
  <svg key="ball" viewBox="0 0 100 100">
    <defs>
      <radialGradient id="scp-bb" cx="36%" cy="30%" r="75%">
        <stop offset="0" stopColor="#FFB47A" />
        <stop offset=".42" stopColor="#F26B1D" />
        <stop offset="1" stopColor="#9C3A0B" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="47" fill="url(#scp-bb)" />
    <g fill="none" stroke="#3A1A0A" strokeWidth="2.4" strokeLinecap="round" opacity=".8">
      <path d="M4 53C30 45 70 45 96 53" />
      <path d="M52 3C44 30 44 70 52 97" />
      <path d="M20 13C38 35 38 65 20 87" />
      <path d="M82 12C63 35 63 66 82 88" />
    </g>
    <ellipse cx="36" cy="28" rx="16" ry="10" fill="#FFFFFF" opacity=".16" />
  </svg>,
  // the net's near side and the rim's near half, over the ball
  <svg key="front" viewBox="0 0 340 360">
    <path
      className="sc-net"
      d={net(RIM, NET_BOTTOM, true)}
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M80 230A90 17 0 0 0 260 230"
      fill="none"
      stroke="#FF6A1A"
      strokeWidth="8"
      strokeLinecap="round"
    />
  </svg>,
];

/** The goal's net: a back panel and two sides in a slight perspective, woven in squares. */
function goalNet(): string {
  let d = '';
  const [x0, x1, y0, y1] = [86, 554, 52, 238];
  for (let x = x0; x <= x1; x += 26) d += `M${x} ${y0}L${x} ${y1}`;
  for (let y = y0; y <= y1; y += 23) d += `M${x0} ${y}L${x1} ${y}`;
  // the sides, from the posts to the back panel
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const y = 24 + (250 - 24) * t;
    const yb = y0 + (y1 - y0) * t;
    d += `M40 ${r1(y)}L${x0} ${r1(yb)}M600 ${r1(y)}L${x1} ${r1(yb)}`;
  }
  d += `M40 24L${x0} ${y0}L${x1} ${y0}L600 24`;
  return d;
}

const football: [ReactNode, ReactNode, ReactNode] = [
  <svg key="back" viewBox="0 0 640 260">
    <g className="sc-net">
      <path d="M40 24L86 52L554 52L600 24L600 252L554 238L86 238L40 252Z" fill="#FFFFFF" fillOpacity=".07" />
      <path d={goalNet()} fill="none" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="2.2" />
    </g>
  </svg>,
  <svg key="ball" viewBox="0 0 100 100">
    <defs>
      <radialGradient id="scp-fb" cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset=".62" stopColor="#E8ECF1" />
        <stop offset="1" stopColor="#A9B2BD" />
      </radialGradient>
      <clipPath id="scp-fbc">
        <circle cx="50" cy="50" r="47" />
      </clipPath>
    </defs>
    <circle cx="50" cy="50" r="47" fill="url(#scp-fb)" />
    <g clipPath="url(#scp-fbc)" fill="#1B1F24">
      <polygon points={pentagon(50, 50, 14)} />
      {[0, 1, 2, 3, 4].map((k) => {
        const a = ((-90 + 36 + 72 * k) * Math.PI) / 180;
        return (
          <polygon
            key={k}
            points={pentagon(50 + 41 * Math.cos(a), 50 + 41 * Math.sin(a), 13, -90 + 36 + 72 * k + 180)}
          />
        );
      })}
    </g>
    <g stroke="#3A4048" strokeWidth="1.6" strokeOpacity=".6" clipPath="url(#scp-fbc)">
      {[0, 1, 2, 3, 4].map((k) => {
        const a = ((-90 + 72 * k) * Math.PI) / 180;
        return (
          <line
            key={k}
            x1={r1(50 + 14 * Math.cos(a))}
            y1={r1(50 + 14 * Math.sin(a))}
            x2={r1(50 + 30 * Math.cos(a))}
            y2={r1(50 + 30 * Math.sin(a))}
          />
        );
      })}
    </g>
    <ellipse cx="37" cy="29" rx="15" ry="9" fill="#FFFFFF" opacity=".5" />
  </svg>,
  // the frame: the posts and the crossbar, in front of the ball
  <svg key="front" viewBox="0 0 640 260">
    <defs>
      <linearGradient id="scp-post" x1="0" x2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#D5DCE4" />
      </linearGradient>
    </defs>
    <rect x="33" y="17" width="14" height="236" rx="5" fill="url(#scp-post)" />
    <rect x="593" y="17" width="14" height="236" rx="5" fill="url(#scp-post)" />
    <rect x="33" y="17" width="574" height="14" rx="5" fill="url(#scp-post)" />
  </svg>,
];

const rocket: [ReactNode, ReactNode, ReactNode] = [
  // the moon, and the flag planted at the landing
  <svg key="back" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="scp-glow">
        <stop offset=".72" stopColor="#FFFFFF" stopOpacity=".28" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="scp-moon" cx="38%" cy="32%" r="80%">
        <stop offset="0" stopColor="#F7F8FB" />
        <stop offset=".55" stopColor="#CDD3DD" />
        <stop offset="1" stopColor="#8F98A8" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="99" fill="url(#scp-glow)" />
    <circle cx="100" cy="100" r="80" fill="url(#scp-moon)" />
    <g fill="#9EA7B6" fillOpacity=".55">
      <circle cx="72" cy="78" r="13" />
      <circle cx="126" cy="64" r="8" />
      <circle cx="118" cy="122" r="17" />
      <circle cx="78" cy="136" r="9" />
      <circle cx="146" cy="100" r="6" />
    </g>
    <g className="sc-flag">
      <line x1="128" y1="26" x2="128" y2="-8" stroke="#E6EAF0" strokeWidth="2.5" />
      <path d="M128 -8L150 -3L128 3Z" fill="#FF8A3D" />
    </g>
  </svg>,
  <svg key="rocket" viewBox="0 0 60 150">
    <defs>
      <linearGradient id="scp-body" x1="0" x2="1">
        <stop offset="0" stopColor="#C9D3E0" />
        <stop offset=".45" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#B7C2D2" />
      </linearGradient>
    </defs>
    <g className="sc-flame">
      <path d="M18 112Q30 160 42 112Z" fill="#FF8A3D" />
      <path d="M23 112Q30 144 37 112Z" fill="#FFE066" />
    </g>
    <path d="M14 78L2 112L16 108Z" fill="#E4473C" />
    <path d="M46 78L58 112L44 108Z" fill="#E4473C" />
    <path d="M30 6C44 20 48 48 46 88L44 110L16 110L14 88C12 48 16 20 30 6Z" fill="url(#scp-body)" />
    <path d="M30 6C38 13 42 24 43 32L17 32C18 24 22 13 30 6Z" fill="#E4473C" />
    <circle cx="30" cy="54" r="8" fill="#5FD4F4" stroke="#FFFFFF" strokeWidth="3" />
    <circle cx="27" cy="51" r="2.5" fill="#FFFFFF" opacity=".7" />
    <rect x="20" y="108" width="20" height="6" rx="1.5" fill="#8A94A6" />
    <path d="M28 84L32 84L33 112L27 112Z" fill="#C73A30" />
  </svg>,
  null,
];

const balloon: [ReactNode, ReactNode, ReactNode] = [
  // the crescent moon and a few stars
  <svg key="back" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="scp-cglow">
        <stop offset=".4" stopColor="#FFF3CF" stopOpacity=".35" />
        <stop offset="1" stopColor="#FFF3CF" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="96" fill="url(#scp-cglow)" />
    <path d="M122 34A68 68 0 1 0 158 150A54 54 0 1 1 122 34Z" fill="#FFF3CF" />
    <g fill="#FFF6DA">
      {[
        [40, 40, 7],
        [168, 58, 5],
        [30, 150, 5],
        [176, 170, 6],
      ].map(([x, y, s]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${y! - s!}Q${x} ${y} ${x! + s!} ${y}Q${x} ${y} ${x} ${y! + s!}Q${x} ${y} ${x! - s!} ${y}Q${x} ${y} ${x} ${y! - s!}Z`}
        />
      ))}
    </g>
  </svg>,
  <svg key="balloon" viewBox="0 0 100 140">
    <defs>
      <clipPath id="scp-env">
        <path d="M50 4C80 4 96 30 92 56C88 80 66 92 60 100L40 100C34 92 12 80 8 56C4 30 20 4 50 4Z" />
      </clipPath>
      <radialGradient id="scp-shade" cx="35%" cy="30%" r="80%">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity=".35" />
        <stop offset="1" stopColor="#3A2F55" stopOpacity=".3" />
      </radialGradient>
    </defs>
    <g clipPath="url(#scp-env)">
      {['#F4B6C2', '#FBF3E6', '#A9CCEB', '#FBF3E6', '#F4B6C2', '#FBF3E6', '#A9CCEB'].map((c, i) => (
        <rect key={i} x={i * 14.3} y="0" width="14.4" height="104" fill={c} />
      ))}
      <rect x="0" y="0" width="100" height="104" fill="url(#scp-shade)" />
    </g>
    <path d="M41 100L43 117M59 100L57 117" stroke="#8B6A4F" strokeWidth="1.4" />
    <rect x="40" y="116" width="20" height="14" rx="2.5" fill="#B0764A" />
    <path d="M40 121H60M40 125H60" stroke="#8E5C38" strokeWidth="1" />
  </svg>,
  null,
];

/** A Magen David: two triangles, centred on (cx, cy), `r` from the centre to a point. */
const magenDavid = (cx: number, cy: number, r: number) =>
  [-90, 90].map((a0) =>
    [0, 1, 2]
      .map((k) => {
        const a = ((a0 + 120 * k) * Math.PI) / 180;
        return `${r1(cx + r * Math.cos(a))},${r1(cy + r * Math.sin(a))}`;
      })
      .join(' '),
  );

/**
 * The head tefillin (the shel rosh), turned as the boy's face is (three-quarters, towards his left): a
 * black box of four compartments (the three grooves down its face) on its wider base (the titura), and
 * on the side that shows — the wearer's right — the three-headed shin; and, hanging from the base while
 * they travel, the strap: its loop (the size of his head), the knot (the dalet) at its foot and its two
 * ends. On his head the strap is the boy's own art: around his head, and down over his shoulders.
 */
const tefillinStrap = (
  <svg key="strap" viewBox="0 0 100 140">
    <g fill="none" strokeLinejoin="round">
      <path
        d="M36 64C28 80 34 100 52 108C56 110 60 110 64 108C82 100 88 80 80 64"
        stroke="#0E0E11"
        strokeWidth="5.5"
      />
      <path
        d="M35 66C29 80 35 98 51 106M81 66C87 80 81 98 65 106"
        stroke="#4A4A54"
        strokeWidth=".8"
        opacity=".7"
      />
      <path d="M55 110C51 118 47 126 44 138" stroke="#0E0E11" strokeWidth="5.5" />
      <path d="M61 110C64 119 68 128 74 136" stroke="#0E0E11" strokeWidth="5.5" />
      <rect x="52" y="103" width="12" height="9" rx="1.5" fill="#0E0E11" stroke="#4A4A54" strokeWidth=".7" />
    </g>
  </svg>
);

const SHIN = 'M1.4 1.2C1.5 6.2 2 9.6 4.2 12.4C6.2 14.2 8.6 13 9.1 10.2L9.3 1.2M5.3 1.6L5.4 9.6';

const tefillinBox = (
  <svg key="box" viewBox="0 0 100 140">
    <defs>
      <linearGradient id="scp-tf-front" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2A2A30" />
        <stop offset=".45" stopColor="#151518" />
        <stop offset="1" stopColor="#0A0A0C" />
      </linearGradient>
      <linearGradient id="scp-tf-side" x1="0" x2="1">
        <stop offset="0" stopColor="#070708" />
        <stop offset="1" stopColor="#18181C" />
      </linearGradient>
      <linearGradient id="scp-tf-base" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#232328" />
        <stop offset="1" stopColor="#0B0B0D" />
      </linearGradient>
    </defs>
    {/* the base: its side, its front, the light on its edges */}
    <path d="M20 58.5L32 60L32 68L20 66.2Z" fill="#08080A" />
    <rect x="32" y="60" width="52" height="8" fill="url(#scp-tf-base)" />
    <path d="M32 60.4H84" stroke="#55555E" strokeWidth="1" />
    <path d="M20 58.8L32 60.4" stroke="#3A3A42" strokeWidth=".9" />
    {/* the box's side, and the shin on it */}
    <path d="M24 25.5L38 22L38 60L24 58Z" fill="url(#scp-tf-side)" />
    <g transform="translate(26.6 33.5) skewY(-14) scale(.86 1)" fill="none" strokeLinecap="round">
      <path d={SHIN} stroke="#4C4C56" strokeWidth="2" transform="translate(-.45 -.45)" />
      <path d={SHIN} stroke="#050506" strokeWidth="1.9" />
      <g fill="#050506" stroke="#4C4C56" strokeWidth=".35">
        <circle cx="1.4" cy="1.1" r="1.05" />
        <circle cx="5.3" cy="1.5" r="1.05" />
        <circle cx="9.3" cy="1.1" r="1.05" />
      </g>
    </g>
    {/* the box's face: four compartments, three grooves */}
    <rect x="38" y="22" width="40" height="38" fill="url(#scp-tf-front)" />
    <path d="M48 22.6V59.4M58 22.6V59.4M68 22.6V59.4" stroke="#030304" strokeWidth="1.5" />
    <path d="M49.1 23V59M59.1 23V59M69.1 23V59" stroke="#3C3C44" strokeWidth=".7" opacity=".9" />
    <path d="M38 22.3H78" stroke="#62626C" strokeWidth="1.3" />
    <path d="M38.4 22V60" stroke="#474750" strokeWidth="1" />
    <path d="M24 25.6L38 22.2" stroke="#3C3C44" strokeWidth="1" />
  </svg>
);

/**
 * The bar mitzvah boy, from the shoulders up, his eyes closed: a white shirt, a navy kippah on his
 * crown behind the tefillin's box, and the straps (drawn on at the finale) — the head strap around his
 * head from the box, and its ends down over his shoulders, black side out: the one on his right to his
 * waist (off the screen), the one on his left to his chest. The light behind him is its own layer.
 */
const tefillinBoy = (
  <>
    <div className="sc-halo" />
    <svg key="boy" viewBox="0 0 400 600">
      <defs>
        <linearGradient id="scp-boy-skin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E2AE8C" />
          <stop offset=".45" stopColor="#F2CCAE" />
          <stop offset="1" stopColor="#E9BC9C" />
        </linearGradient>
        <linearGradient id="scp-boy-neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D59E7D" />
          <stop offset="1" stopColor="#E7B999" />
        </linearGradient>
        <linearGradient id="scp-boy-shirt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".6" stopColor="#F1F3F6" />
          <stop offset="1" stopColor="#D9DFE8" />
        </linearGradient>
        <linearGradient id="scp-boy-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A2F1D" />
          <stop offset="1" stopColor="#2C1A10" />
        </linearGradient>
        <radialGradient id="scp-boy-kip" cx="45%" cy="30%" r="80%">
          <stop offset="0" stopColor="#34487A" />
          <stop offset="1" stopColor="#16213F" />
        </radialGradient>
      </defs>
      {/* the shoulders and the shirt (past the sides of the box: off the screen's edges) */}
      <path
        d="M-70 560C-44 500 -12 440 36 414C80 390 118 378 150 368L176 356L252 352L284 364C346 380 390 404 420 446C446 482 462 520 470 560V600H-70Z"
        fill="url(#scp-boy-shirt)"
      />
      <g fill="none" strokeWidth="3" opacity=".8">
        <path
          d="M-44 500C-12 440 36 414 80 396C104 386 128 376 150 368"
          stroke="#C9D1DC"
          strokeWidth="2"
          opacity=".9"
        />
        <path d="M112 600C118 520 124 460 132 420" stroke="#D5DCE5" />
        <path d="M318 600C312 530 306 470 298 424" stroke="#CDD5DF" />
      </g>
      {/* the neck */}
      <path
        d="M178 262C182 300 180 332 174 360L214 392L254 356C248 330 246 300 250 262Z"
        fill="url(#scp-boy-neck)"
      />
      <path d="M180 318C200 330 228 330 248 316" fill="none" stroke="#C88E6E" strokeWidth="2" opacity=".35" />
      {/* the collar, the placket and its buttons */}
      <g stroke="#D3DAE3" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M174 356L200 408L214 392Z" fill="#FFFFFF" />
        <path d="M254 352L228 406L214 392Z" fill="#FAFBFC" />
      </g>
      <path d="M214 394V600" stroke="#DCE2EA" strokeWidth="2" />
      <g fill="#E6EAF0" stroke="#C8D0DA" strokeWidth=".8">
        <circle cx="214" cy="440" r="3.2" />
        <circle cx="214" cy="500" r="3.2" />
        <circle cx="214" cy="560" r="3.2" />
      </g>
      {/* his right ear */}
      <path
        d="M152 196C140 190 128 196 128 212C128 230 136 246 150 250C156 251 160 246 160 240Z"
        fill="#E2AA88"
      />
      <path
        d="M150 204C142 202 137 208 138 216C139 226 144 236 151 239"
        fill="none"
        stroke="#C4876A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* the head, its shading (the near side of the face, under the hairline, the jaw's shadow on the
          neck) and the light from behind on the far cheek */}
      <path
        d="M150 150C150 104 186 78 226 80C268 82 292 116 290 158C289 184 286 206 282 226C278 250 266 274 246 290C236 298 224 302 212 300C196 298 180 288 170 272C162 258 157 246 154 232C150 210 150 186 150 150Z"
        fill="url(#scp-boy-skin)"
      />
      <path
        d="M156 170C152 196 154 226 164 252C170 268 180 284 196 294C184 280 176 262 172 240C168 216 168 190 172 168Z"
        fill="#C98C6C"
        opacity=".22"
      />
      <path
        d="M176 162C196 152 214 148 232 148C250 148 266 152 284 162C266 156 250 154 232 154C212 154 194 158 176 166Z"
        fill="#B97E5E"
        opacity=".25"
      />
      <path
        d="M180 286C196 302 228 306 250 290C246 304 236 314 222 318C204 318 190 302 180 286Z"
        fill="#B97E5E"
        opacity=".35"
      />
      <path
        d="M287 158C289 186 286 214 280 238"
        fill="none"
        stroke="#FFE6BF"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity=".32"
      />
      <ellipse cx="184" cy="244" rx="20" ry="13" fill="#E88A70" opacity=".22" />
      <ellipse cx="264" cy="240" rx="14" ry="11" fill="#E88A70" opacity=".18" />
      {/* the hair: short and dark, its line across the forehead */}
      <path
        d="M146 214C140 176 140 140 156 112C174 82 208 66 240 70C276 74 298 102 296 142C295 152 292 160 288 166C282 150 272 142 258 140C246 139 236 141 226 142C210 143 190 150 176 162C168 170 164 184 162 206Z"
        fill="url(#scp-boy-hair)"
      />
      <path
        d="M176 100C196 86 222 80 248 84M168 120C188 104 214 98 240 98M244 104C262 108 278 118 286 134"
        fill="none"
        stroke="#6B4630"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".55"
      />
      {/* the kippah, on his crown */}
      <path
        d="M172 84C180 70 200 62 222 62C244 62 260 70 266 82C254 89 238 92 219 92C200 92 184 90 172 84Z"
        fill="url(#scp-boy-kip)"
      />
      <path
        d="M175 83.5C188 88 202 90 219 90C236 90 250 87 263 82"
        fill="none"
        stroke="#D4B06A"
        strokeWidth="1.8"
      />
      {/* the face: eyebrows, closed eyes and their lashes, the nose, a quiet smile */}
      <g fill="none" strokeLinecap="round">
        <path d="M170 192C178 186 190 185 200 188" stroke="#4A2E1E" strokeWidth="4.2" />
        <path d="M238 188C246 185 256 186 264 191" stroke="#4A2E1E" strokeWidth="3.6" />
        <path d="M172 210C180 216 192 216 200 210" stroke="#5A3A2A" strokeWidth="2.6" />
        <path d="M240 208C247 213 256 213 262 208" stroke="#5A3A2A" strokeWidth="2.3" />
        <path
          d="M176 213L174 218M183 215L182 220M191 215L191 220M197 213L199 217"
          stroke="#5A3A2A"
          strokeWidth="1.4"
        />
        <path d="M244 211L243 215M251 212L251 216M257 211L259 214" stroke="#5A3A2A" strokeWidth="1.2" />
        <path
          d="M226 206C229 222 234 236 240 246C236 252 228 254 222 250"
          stroke="#C48A6C"
          strokeWidth="2.4"
        />
        <path d="M206 270C216 276 230 276 240 268" stroke="#B5675A" strokeWidth="3" />
        <path d="M214 281C220 284 228 284 234 280" stroke="#C98876" strokeWidth="2" opacity=".6" />
      </g>
      {/* the straps: from the box around his head, then down over his shoulders */}
      <g fill="none">
        <path
          className="sc-strap"
          pathLength={1}
          d="M204 146C184 148 167 154 155 162C151 165 148 168 145 171"
          stroke="#0D0D10"
          strokeWidth="9"
        />
        <path
          className="sc-strap"
          pathLength={1}
          d="M250 144C262 145 274 148 286 152"
          stroke="#0D0D10"
          strokeWidth="9"
        />
        {/* the light along the head strap's upper edge, over the dark hair */}
        <path
          className="sc-strap"
          pathLength={1}
          d="M204 142.6C184 144.6 166.2 150.6 153.6 158.8C149.6 161.8 146.4 164.8 143.4 168"
          stroke="#5A5A64"
          strokeWidth="1.2"
          opacity=".8"
        />
        <path
          className="sc-strap"
          pathLength={1}
          d="M250 140.6C262 141.6 274.4 144.6 286.8 148.6"
          stroke="#5A5A64"
          strokeWidth="1.2"
          opacity=".8"
        />
        <g className="sc-strap-hang">
          <path
            className="sc-strap"
            pathLength={1}
            d="M168 352C160 360 154 372 152 390C149 440 147 520 146 600"
            stroke="#0D0D10"
            strokeWidth="10"
          />
          <path
            className="sc-strap"
            pathLength={1}
            d="M260 348C268 356 274 368 276 386C279 420 281 458 281 498"
            stroke="#0D0D10"
            strokeWidth="10"
          />
          <path
            className="sc-strap"
            pathLength={1}
            d="M155 392C152 440 150 520 149 600"
            stroke="#55555F"
            strokeWidth="1.2"
            opacity=".75"
          />
          <path
            className="sc-strap"
            pathLength={1}
            d="M278.6 388C281 420 283 458 283 494"
            stroke="#55555F"
            strokeWidth="1.2"
            opacity=".75"
          />
        </g>
      </g>
    </svg>
  </>
);

const tefillin: [ReactNode, ReactNode, ReactNode] = [
  tefillinBoy,
  // the strap under the box, in a layer of its own (it comes and goes as the box travels)
  <>
    <div className="sc-trail-in">
      <div className="sc-trail">{tefillinStrap}</div>
    </div>
    {tefillinBox}
  </>,
  null,
];

/**
 * The velvet tefillin bag (140 × 110), open on the table: its back and its dark inside behind the box,
 * its front — a gold zipper along the opening, a gold frame and a Magen David — in front of it.
 */
const tefillinBag: [ReactNode, ReactNode] = [
  <svg key="bag-back" viewBox="0 0 140 110">
    <defs>
      <linearGradient id="scp-bag-back" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2B3F6E" />
        <stop offset=".55" stopColor="#1A2A52" />
        <stop offset="1" stopColor="#101A36" />
      </linearGradient>
    </defs>
    <ellipse cx="70" cy="106" rx="62" ry="4" fill="#000000" opacity=".28" />
    <path
      d="M14 30C14 20 20 14 30 14H110C120 14 126 20 126 30V96C126 102 122 105 116 105H24C18 105 14 102 14 96Z"
      fill="url(#scp-bag-back)"
    />
    <path
      d="M18 46C40 38 100 38 122 46V30C122 22 117 18 110 18H30C23 18 18 22 18 30Z"
      fill="#0A1024"
      opacity=".9"
    />
  </svg>,
  <svg key="bag-front" viewBox="0 0 140 110">
    <defs>
      <linearGradient id="scp-bag-front" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2B3F6E" />
        <stop offset=".55" stopColor="#1A2A52" />
        <stop offset="1" stopColor="#101A36" />
      </linearGradient>
      <radialGradient id="scp-bag-sheen" cx="38%" cy="30%" r="70%">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity=".16" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path
      d="M10 48C38 40 102 40 130 48L130 97C130 103 126 107 120 107H20C14 107 10 103 10 97Z"
      fill="url(#scp-bag-front)"
    />
    <path
      d="M10 48C38 40 102 40 130 48L130 97C130 103 126 107 120 107H20C14 107 10 103 10 97Z"
      fill="url(#scp-bag-sheen)"
    />
    <path d="M10 48.6C38 40.6 102 40.6 130 48.6" fill="none" stroke="#D9B86C" strokeWidth="2.4" />
    <path
      d="M12 51.8C40 44 100 44 128 51.8"
      fill="none"
      stroke="#8C7440"
      strokeWidth="1"
      strokeDasharray="1.6 1.4"
    />
    <path d="M122 47L127 58L123 60L119 49Z" fill="#D9B86C" />
    <path
      d="M18 60C44 54 96 54 122 60V94C122 98 120 100 116 100H24C20 100 18 98 18 94Z"
      fill="none"
      stroke="#D4B06A"
      strokeWidth="1.5"
    />
    <g fill="none" stroke="#E2C37E" strokeWidth="1.9" strokeLinejoin="round">
      {magenDavid(70, 78, 12).map((points) => (
        <polygon key={points} points={points} />
      ))}
    </g>
    <g fill="#E2C37E">
      <circle cx="30" cy="78" r="1.6" />
      <circle cx="110" cy="78" r="1.6" />
    </g>
  </svg>,
];

const ART: Record<Kind, [ReactNode, ReactNode, ReactNode]> = {
  basketball,
  football,
  rocket,
  balloon,
  tefillin,
};

/** What a prop starts in, behind it and in front of it. */
const ORIGIN: Partial<Record<Kind, [ReactNode, ReactNode]>> = { tefillin: tefillinBag };
