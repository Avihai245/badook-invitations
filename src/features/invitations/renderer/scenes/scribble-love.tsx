import type { CSSProperties } from 'react';
import { Layer, Piece, cm, useIds, type SceneProps } from './kit';

/**
 * Scribble Love — a notes-app collage, imperfect on purpose: grid paper, washi tape at the corners,
 * a loop-scribbled heart in blue marker, wobbly arrows, star and heart stickers. (The marker circle
 * around the date and the highlighter under the opening line are the hero's own styles —
 * invitation.css.) The marker blue follows the accent.
 */
const PEN = 'var(--inv-accent, #2F5BEA)';
const YELLOW = '#FFF06A';
const CORAL = '#FF6B5B';
const SKY = '#BFD9FF';
const INK = '#1F1F1F';

type Url = (name: string) => string;

/** A strip of washi tape with torn zigzag ends. */
function Tape({ style, stripes }: { style: CSSProperties; stripes: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        height: '6.5cqmin',
        background: stripes,
        clipPath:
          'polygon(0 8%, 3% 0, 6% 10%, 9% 0, 91% 0, 94% 12%, 97% 0, 100% 10%, 100% 90%, 97% 100%, 94% 88%, 91% 100%, 9% 100%, 6% 90%, 3% 100%, 0 92%)',
        mixBlendMode: 'multiply',
        opacity: 0.9,
        ...style,
      }}
    />
  );
}

/** Loop-scribbled heart in marker (viewBox 0 0 200 170). */
function ScribbleHeart() {
  return (
    <g fill="none" style={{ stroke: PEN }} strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M100 160C52 124 14 96 16 58 18 26 48 12 72 20c14 5 24 18 28 30 5-14 16-27 32-31 26-6 52 10 52 40 0 38-42 70-84 101z"
        strokeWidth="7"
      />
      <path
        d="M96 150C56 120 26 94 28 60c2-24 26-36 46-28M110 44c8-12 22-18 36-14 18 6 28 22 24 42"
        strokeWidth="3.4"
        opacity=".75"
      />
      <path d="M100 160c-6 8-2 16 8 14 9-2 8-12 0-14-6-1-12 4-14 10" strokeWidth="4" />
    </g>
  );
}

/** A sticker star with its white die-cut rim (viewBox 0 0 100 100). */
function StarSticker({ fill, u }: { fill: string; u: Url }) {
  const star = 'M50 8l12 27 29 3-22 20 7 29-26-15-26 15 7-29-22-20 29-3z';
  return (
    <g filter={u('sticker')}>
      <path d={star} fill="#fff" stroke="#fff" strokeWidth="14" strokeLinejoin="round" />
      <path d={star} fill={fill} />
      <path d="M40 38l4-8" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
    </g>
  );
}

function HeartSticker({ u }: { u: Url }) {
  const heart = 'M50 86C24 66 8 50 10 32 12 16 30 8 42 16c4 3 7 7 8 11 1-4 4-8 8-11 12-8 30 0 32 16 2 18-14 34-40 54z';
  return (
    <g filter={u('sticker')}>
      <path d={heart} fill="#fff" stroke="#fff" strokeWidth="14" strokeLinejoin="round" />
      <path d={heart} fill={CORAL} />
      <circle cx="30" cy="30" r="5" fill="#fff" opacity=".6" />
    </g>
  );
}

/** A wobbly hand-drawn arrow (viewBox 0 0 160 120), pointing up-right. */
function Arrow() {
  return (
    <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.6">
      <path d="M8 110c18-6 30-20 34-38 4-16-8-24-16-14s4 26 22 26c30 0 54-30 90-68" />
      <path d="M118 12l20 4-6 20" />
    </g>
  );
}

export default function ScribbleLove({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const grid = card ? '5cqmin' : '6cqmin';
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={ref('sticker')} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1.5" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      <Layer
        style={{
          background:
            `linear-gradient(${SKY} 1px, transparent 1px) -1px -1px / ${grid} ${grid},` +
            `linear-gradient(90deg, ${SKY} 1px, transparent 1px) -1px -1px / ${grid} ${grid}`,
          opacity: 0.75,
        }}
      />
      <Layer style={{ background: 'radial-gradient(70cqw 45cqh at 50% 50%, rgba(251,250,246,.85), rgba(251,250,246,0) 75%)' }} />
      <Tape
        stripes={`repeating-linear-gradient(90deg, ${YELLOW} 0 1.6cqmin, #FFE44D 1.6cqmin 3.2cqmin)`}
        style={{ left: cm(-4), top: cm(7), width: cm(card ? 24 : 34), rotate: '-32deg' }}
      />
      <Tape
        stripes={`radial-gradient(circle at 50% 50%, #fff 0.5cqmin, transparent 0.6cqmin) 0 0 / 2.4cqmin 2.4cqmin, ${CORAL}`}
        style={{ right: cm(-5), top: cm(9), width: cm(card ? 22 : 30), rotate: '28deg', opacity: 0.75 }}
      />
      <Tape
        stripes={`repeating-linear-gradient(45deg, ${SKY} 0 1.2cqmin, #D8E8FF 1.2cqmin 2.4cqmin)`}
        style={{ left: cm(-3), bottom: cm(12), width: cm(card ? 18 : 26), rotate: '18deg' }}
      />
      <Piece vb={[0, 0, 200, 170]} style={{ left: '50%', top: card ? '6cqh' : '9cqh', width: cm(card ? 12 : 24), translate: '-50% 0', rotate: '-6deg' }}>
        <ScribbleHeart />
      </Piece>
      <Piece vb={[0, 0, 100, 100]} anim="float" style={{ right: cm(8), top: cm(card ? 16 : 26), width: cm(card ? 9 : 13), rotate: '14deg' }}>
        <StarSticker fill="#FFD84A" u={url} />
      </Piece>
      <Piece vb={[0, 0, 100, 100]} style={{ left: cm(10), bottom: cm(card ? 6 : 26), width: cm(card ? 8 : 11), rotate: '-12deg' }}>
        <StarSticker fill={SKY} u={url} />
      </Piece>
      <Piece vb={[0, 0, 100, 100]} anim="float" style={{ right: cm(10), bottom: cm(card ? 8 : 10), width: cm(card ? 9 : 14), rotate: '-10deg' }}>
        <HeartSticker u={url} />
      </Piece>
      <Piece vb={[0, 0, 160, 120]} style={{ left: cm(6), bottom: cm(card ? 14 : 40), width: cm(card ? 12 : 20), rotate: '-4deg', opacity: 0.8 }}>
        <Arrow />
      </Piece>
      <Piece vb={[0, 0, 160, 120]} style={{ right: cm(4), top: cm(card ? 24 : 46), width: cm(card ? 10 : 16), scale: '-1 -1', opacity: 0.8 }}>
        <Arrow />
      </Piece>
      <Piece vb={[0, 0, 120, 60]} style={{ left: cm(12), top: cm(card ? 6 : 22), width: cm(card ? 8 : 12) }}>
        <g fill="none" style={{ stroke: CORAL }} strokeWidth="4" strokeLinecap="round">
          <path d="M30 40c-10-8-24-6-24 4s16 12 24 4" />
          <path d="M60 10l6 14M84 22l-12 8M54 34l12-2" />
        </g>
      </Piece>
    </>
  );
}
