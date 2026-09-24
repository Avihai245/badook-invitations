import type { ReactNode } from 'react';
import type { PanoramaKind } from '../renderer/placeholders';

/**
 * Line-art bands of the scene templates, standing in for a missing panorama decoration (afterHero /
 * betweenVenues) like the originals' vineyard and hills: currentColor hairlines, each viewBox hugging
 * its drawing.
 */
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const r1 = (n: number) => Math.round(n * 10) / 10;

function Band({ vb, children }: { vb: string; children: ReactNode }) {
  return (
    <svg
      className="deco"
      viewBox={vb}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

const PANORAMAS: Partial<Record<PanoramaKind, () => ReactNode>> = {
  arches: () => (
    <Band vb="0 88 800 92">
      <path d="M0 176H800" />
      {range(9).map((i) => {
        const big = i === 4;
        const w = big ? 76 : 56;
        const h = big ? 58 : 44;
        const x = 400 + (i - 4) * 88 - w / 2;
        return (
          <g key={i} opacity={big ? 1 : 0.55 + (i % 2) * 0.15}>
            <path d={`M${x} 176V${176 - h}a${w / 2} ${w / 2} 0 0 1 ${w} 0V176`} />
            <path
              d={`M${x + 8} 176V${176 - h + 4}a${w / 2 - 8} ${w / 2 - 8} 0 0 1 ${w - 16} 0V176`}
              opacity=".5"
            />
          </g>
        );
      })}
    </Band>
  ),
  garden: () => (
    <Band vb="0 96 800 84">
      <path d="M0 172C180 162 320 168 400 166S640 160 800 170" />
      {range(15).map((i) => {
        const x = 30 + i * 53;
        const h = 34 + ((i * 7) % 5) * 7;
        const top = 168 - h;
        return (
          <g key={i} opacity={i % 3 === 1 ? 1 : 0.6}>
            <path d={`M${x} 168C${x - 3} ${top + h / 2} ${x + 3} ${top + 12} ${x} ${top + 6}`} />
            <path d={`M${x} ${168 - h / 3}c-7 -2 -11 -8 -12 -14 7 1 11 6 12 14z`} opacity=".7" />
            {i % 2 ? (
              <circle cx={x} cy={top} r="5" />
            ) : (
              [0, 72, 144, 216, 288].map((a) => {
                const rad = ((a - 90) * Math.PI) / 180;
                return (
                  <circle key={a} cx={r1(x + Math.cos(rad) * 5)} cy={r1(top + Math.sin(rad) * 5)} r="3.4" />
                );
              })
            )}
          </g>
        );
      })}
    </Band>
  ),
  swags: () => (
    <Band vb="0 96 800 76">
      {range(8).map((i) => {
        const x = i * 100;
        return (
          <g key={i}>
            <path d={`M${x} 106Q${x + 50} 158 ${x + 100} 106`} />
            <path d={`M${x + 6} 108Q${x + 50} 150 ${x + 94} 108`} opacity=".5" />
            <circle cx={x + 100} cy="104" r="4" />
            <path d={`M${x + 100} 108v18m-4 -2 4 6 4 -6`} opacity=".6" />
          </g>
        );
      })}
    </Band>
  ),
  waves: () => (
    <Band vb="0 92 800 84">
      <circle cx="640" cy="118" r="16" />
      <path d="M640 94v6M662 118h6M618 118h-6M656 102l4-4M624 102l-4-4" opacity=".6" />
      <path d="M210 150V104l30 40zM206 104v48M190 152h44l-6 8h-32z" />
      {[0, 1, 2].map((row) => (
        <path
          key={row}
          opacity={1 - row * 0.25}
          d={`M${row * 10} ${152 + row * 10}${'q10 -7 20 0t20 0'.repeat(20)}`}
        />
      ))}
    </Band>
  ),
  doodle: () => (
    <Band vb="0 92 800 84">
      <path d="M20 150c40-40 70 30 110 0s50-40 90-10 70 30 110-4 60-26 90 4 50 34 100 0 60-30 100-4 70 30 120 4" />
      <path d="M396 112c-9-9-22-2-18 9 3 8 18 18 18 18s15-10 18-18c4-11-9-18-18-9z" />
      <path d={sparkle(190, 118, 9)} />
      <path d={sparkle(620, 122, 7)} />
      <path d="M560 160l30-14m-10 2 10-2-4 10" opacity=".7" />
      <path d="M92 118l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" opacity=".8" />
    </Band>
  ),
  stars: () => (
    <Band vb="0 92 800 80">
      <path d="M0 162H800" opacity=".5" />
      {[
        [80, 130, 8],
        [190, 112, 5],
        [300, 140, 6],
        [400, 118, 11],
        [500, 142, 6],
        [610, 112, 5],
        [720, 132, 8],
      ].map(([x, y, s]) => (
        <path key={x} d={sparkle(x!, y!, s!)} />
      ))}
      {range(24).map((i) => (
        <circle
          key={i}
          cx={20 + i * 33}
          cy={100 + ((i * 17) % 50)}
          r=".9"
          fill="currentColor"
          stroke="none"
        />
      ))}
    </Band>
  ),
  pitch: () => (
    <Band vb="0 92 800 88">
      <path d="M40 100H760V176H40Z" />
      <path d="M400 100V176" />
      <circle cx="400" cy="138" r="24" />
      <path d="M40 116H110V160H40M760 116H690V160H760" />
      <path d="M40 128H66V148H40M760 128H734V148H760" opacity=".6" />
      <circle cx="400" cy="138" r="2" fill="currentColor" stroke="none" />
    </Band>
  ),
  flight: () => (
    <Band vb="0 84 800 96">
      <path d="M40 172Q400 50 700 132" strokeDasharray="6 9" />
      <path d="M704 134l26 6-9 5 5 11-6 1-8-9-11 3-2-4 9-6-11-7 4-2z" />
      <path d="M140 124c0-8 12-10 16-4 3-7 17-6 17 3 7 0 8 9 2 10h-32c-6 0-7-8-3-9z" opacity=".6" />
      <path d="M520 104c0-7 10-9 14-4 3-6 15-5 15 3 6 0 7 8 2 9h-28c-5 0-6-7-3-8z" opacity=".6" />
    </Band>
  ),
  deco: () => (
    <Band vb="0 90 800 82">
      {[140, 146, 152].map((y, i) => (
        <path key={y} d={`M0 ${y}H340M460 ${y}H800`} opacity={i === 1 ? 1 : 0.5} />
      ))}
      <path d="M340 152a60 60 0 0 1 120 0z" />
      <path d="M370 152a30 30 0 0 1 60 0" />
      {range(9).map((i) => {
        const a = Math.PI + (i * Math.PI) / 8;
        return (
          <path
            key={i}
            d={`M${r1(400 + Math.cos(a) * 30)} ${r1(152 + Math.sin(a) * 30)}L${r1(400 + Math.cos(a) * 60)} ${r1(152 + Math.sin(a) * 60)}`}
          />
        );
      })}
      {[170, 630].map((x) => (
        <path key={x} d={`M${x} 136l10 10-10 10-10-10z`} />
      ))}
    </Band>
  ),
  skyline: () => (
    <Band vb="0 84 800 96">
      <path d="M0 176H800" />
      <circle cx="660" cy="104" r="14" />
      <path d="M60 176V118H200V176M60 136H200M60 154H200" />
      <path d="M200 136h8a10 10 0 0 1 0 20h-8" />
      <path d="M250 176V100H300V176M275 106V168" opacity=".7" />
      <path d="M340 176V128H520V176M340 144H520M340 160H520M520 128h10a8 8 0 0 1 0 16h-10" />
      <path d="M560 176V112H640V176M580 176V160M620 176V160" />
      <path d="M680 176V136H760V176M680 152H760" opacity=".7" />
    </Band>
  ),
};

/** The band for `kind`, or null for the original kinds (drawn by shared.tsx). */
export function ScenePanorama({ kind }: { kind: PanoramaKind }): ReactNode {
  const draw = PANORAMAS[kind];
  return draw ? draw() : null;
}
