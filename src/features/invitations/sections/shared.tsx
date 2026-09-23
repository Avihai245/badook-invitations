import type { CSSProperties, ReactNode } from 'react';
import type { DecorationSlot, Section } from '../contracts/types';
import type { RenderContext } from '../renderer/context';

/** Reveal stagger index (`--i`) — children reveal 80ms apart (§9A.6). */
export const iv = (i: number) => ({ '--i': i }) as CSSProperties;

export interface SectionViewProps<S extends Section = Section> {
  section: S;
  /** previous *enabled* section (text after text gets `.tight`) */
  prev: Section | undefined;
  ctx: RenderContext;
}

export const editPath = (ctx: RenderContext, section: Section, sub?: string) =>
  ctx.mode === 'editor' ? `sections.${ctx.indexOf(section)}${sub ? `.${sub}` : ''}` : undefined;

export function SecHead({ title, sub, path }: { title: string; sub?: string | null; path?: string }) {
  return (
    <>
      <h2 className="sec-title reveal" data-edit-path={path ? `${path}.title` : undefined}>
        {title}
      </h2>
      {sub ? (
        <p className="sec-sub reveal" style={iv(1)} data-edit-path={path ? `${path}.subtitle` : undefined}>
          {sub}
        </p>
      ) : null}
    </>
  );
}

/**
 * Line-art stand-ins for a missing panorama decoration (the reference's vineyard sketch for
 * sahar-bordeaux). Each viewBox hugs its drawing, so the band adds no empty space of its own.
 */
function PanoramaPlaceholder({ kind }: { kind: 'vineyard' | 'hills' }) {
  if (kind === 'vineyard') {
    return (
      <svg
        className="deco"
        viewBox="0 62 800 124"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M0 150 C120 110 220 120 320 135 S520 95 640 120 800 110 800 110" />
        <path d="M0 175 C150 150 300 160 420 170 S650 140 800 160" />
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={`M${10 + i * 36} ${178 - (i % 5)} q14 -26 30 -40`} opacity=".6" />
        ))}
        <path d="M560 118 v-22 h40 v22 M556 97 l24 -16 24 16 M575 118 v-10 h10 v10" />
        {[520, 612, 628].map((x) => (
          <path key={x} d={`M${x} 122 c-6 -10 -6 -34 0 -52 c6 18 6 42 0 52z`} />
        ))}
      </svg>
    );
  }
  return (
    <svg
      className="deco"
      viewBox="0 92 800 88"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M0 140 C140 100 260 130 380 128 S600 96 800 120" />
      <path d="M0 172 C160 150 320 164 470 166 S680 146 800 158" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${60 + i * 84} ${160 - (i % 3) * 6} c10 -8 20 -8 30 0`} opacity=".6" />
      ))}
    </svg>
  );
}

/**
 * A template decoration slot (§2.2.6 / §9A.1). Real media renders full-bleed; when the file hasn't been
 * produced yet, panorama slots show line-art and every other slot is skipped (§5 missing media).
 */
export function Decoration({ slot, ctx }: { slot: DecorationSlot; ctx: RenderContext }): ReactNode {
  const ref = ctx.template.decorations[slot];
  if (!ref) return null;
  const url = ctx.asset(ref);
  if (url) return <img className="deco" src={url} alt="" loading="lazy" decoding="async" />;
  if (slot === 'betweenVenues' || slot === 'afterHero')
    return <PanoramaPlaceholder kind={ctx.art.panorama} />;
  return null;
}
