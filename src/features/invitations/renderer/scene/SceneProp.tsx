import type { CSSProperties, ReactNode } from 'react';
import type { SceneProp as Kind } from '../../contracts/types';
import { PROPS, poseAt, poseCss, propKeyframes, targetBox } from './props';
import { PropFinale } from './PropFinale.client';

/**
 * The scene's prop (renderer/scene/props.ts), drawn: the mover (a basketball, a football, a rocket, a
 * hot-air balloon) between the two halves of its target — the part behind it (a backboard, the net's
 * far side, the moon) and the part in front of it (the hoop's near rim and net, the goal's frame) — so
 * it really goes in. The scroll plays its flight (the keyframes below, a scroll-driven animation) and
 * the target's fade-in; SceneDriver plays both where the browser can't; PropFinale plays the arrival.
 * Pinned with the backdrop, behind the texts; decorative (aria-hidden). With reduced motion the prop
 * rests at its target from the start.
 */
export function SceneProp({ kind }: { kind: Kind }) {
  const spec = PROPS[kind];
  const start = poseCss(poseAt(spec, 0));
  const end = poseCss(poseAt(spec, 1));
  const box = targetBox(kind);
  const target = {
    ...box,
    '--sc-ta': `${spec.target.reveal[0] * 100}%`,
    '--sc-tb': `${spec.target.reveal[1] * 100}%`,
  } as CSSProperties;
  const sel = `.sc-prop[data-prop='${kind}']`;
  // at rest (reduced motion, or the host's motion at 0): at its target from the start
  const rest = `${sel} .sc-mover{translate:${end.translate}!important;rotate:${end.rotate}!important;scale:${end.scale}!important}`;
  const css =
    propKeyframes(kind) +
    `@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:scroll()){:root:not([data-motion='none']) ${sel} .sc-mover{animation:scProp-${kind} linear both;animation-timeline:scroll(nearest)}}}` +
    `@media (prefers-reduced-motion:reduce){${rest}}:root[data-motion='none'] ${rest}`;
  const [back, mover, front] = ART[kind];
  return (
    <div className="sc-prop" data-prop={kind} aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {back ? (
        <div className="sc-target sc-target-back" style={target}>
          {back}
        </div>
      ) : null}
      <div className="sc-mover" style={{ width: `${spec.size}cqw`, ...start } as CSSProperties}>
        <div className="sc-inner">{mover}</div>
      </div>
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

const ART: Record<Kind, [ReactNode, ReactNode, ReactNode]> = { basketball, football, rocket, balloon };
