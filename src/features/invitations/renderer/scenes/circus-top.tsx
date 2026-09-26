import { Layer, Piece, cm, cmh, polar, r1, useIds, type SceneProps } from './kit';

/**
 * Circus Top — the big top on a sunny day: vintage sunburst rays, a string of bunting whose flags
 * flutter one after another, balloons drifting up at the sides, twinkling stars, a striped tent with
 * a scalloped valance, flags on its poles and a glowing entrance, and a seal in a ringmaster's top
 * hat juggling a beach ball on its nose. The tent's stripes follow the accent.
 */
const STRIPE = 'var(--inv-accent, #D7263D)';
const CREAM = '#FFF6E6';
const YELLOW = '#FFC83D';
const TEAL = '#1FA3A4';
const BLUE = '#3C78D8';
const PINK = '#FF6FA0';
const RED = '#E23744';
const PLUM = '#3B1320';

type Url = (name: string) => string;

const FLAG_COLORS = [RED, YELLOW, TEAL, BLUE, PINK];

/** A pennant hanging from its top edge (viewBox 0 0 40 50). */
function Pennant({ color }: { color: string }) {
  return (
    <g>
      <path d="M2 2H38L20 46Z" fill={color} />
      <path d="M2 2H38L36 6H4Z" fill="#fff" opacity=".35" />
      <circle cx="20" cy="15" r="4" fill="#fff" opacity=".5" />
    </g>
  );
}

/** A balloon with its string (viewBox 0 0 40 96). */
function Balloon({ color }: { color: string }) {
  return (
    <g>
      <path d="M20 54C16 64 26 70 20 80S22 92 18 96" fill="none" stroke="#9C7B6A" strokeWidth="1.2" />
      <path d="M20 2C9 2 2 11 2 22 2 36 13 48 20 50 27 48 38 36 38 22 38 11 31 2 20 2Z" fill={color} />
      <path d="M17 50 20 55 23 50Z" fill={color} />
      <ellipse cx="12.5" cy="16" rx="4" ry="7" fill="#fff" opacity=".45" transform="rotate(24 12.5 16)" />
    </g>
  );
}

/** Three balloons tied to a little weight (viewBox 0 0 80 150). */
function BalloonBunch() {
  const one = (cx: number, cy: number, color: string, tilt: number) => (
    <g transform={`rotate(${tilt} ${cx} ${cy + 26})`}>
      <path
        d={`M${cx} ${cy - 22}C${cx - 13} ${cy - 22} ${cx - 18} ${cy - 11} ${cx - 18} ${cy}C${cx - 18} ${cy + 14} ${cx - 6} ${cy + 24} ${cx} ${cy + 26}C${cx + 6} ${cy + 24} ${cx + 18} ${cy + 14} ${cx + 18} ${cy}C${cx + 18} ${cy - 11} ${cx + 13} ${cy - 22} ${cx} ${cy - 22}Z`}
        fill={color}
      />
      <ellipse
        cx={cx - 7}
        cy={cy - 8}
        rx="3.4"
        ry="6"
        fill="#fff"
        opacity=".45"
        transform={`rotate(24 ${cx - 7} ${cy - 8})`}
      />
    </g>
  );
  return (
    <g>
      <path
        d="M40 140C36 118 22 92 22 64M40 140C40 112 42 84 44 50M40 140C44 116 58 90 60 70"
        fill="none"
        stroke="#9C7B6A"
        strokeWidth="1.2"
      />
      {one(22, 40, BLUE, -10)}
      {one(60, 46, YELLOW, 10)}
      {one(42, 24, RED, 0)}
      <path d="M33 138H47L45 148H35Z" fill="#8A5A3C" />
    </g>
  );
}

/** A five-pointed star centred on (0, 0). */
function Star({ r, color, opacity = 1 }: { r: number; color: string; opacity?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => polar(0, 0, i % 2 ? r * 0.45 : r, -90 + i * 36).join(' '));
  return <path d={`M${pts.join('L')}Z`} fill={color} opacity={opacity} />;
}

/** The big top (viewBox 0 0 400 290): striped roof, scalloped valance, walls, entrance, poles. */
function Tent({ u }: { u: Url }) {
  const roof = 'M200 50C172 76 96 124 22 156H378C304 124 228 76 200 50Z';
  const wedges: string[] = [];
  for (let k = 0; k < 10; k += 2) {
    const x0 = -20 + k * 44;
    wedges.push(`M200 50L${x0} 160H${x0 + 44}Z`);
  }
  const walls: string[] = [];
  for (let x = 46; x < 354; x += 52) walls.push(`M${x} 156h26v124h-26Z`);
  let scallops = 'M22 156';
  const poms: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const x = 22 + i * 29.7;
    scallops += `q14.8 26 29.7 0`;
    poms.push([r1(x + 14.8), 176]);
  }
  return (
    <g>
      {/* guy ropes and stakes */}
      <path d="M24 158 2 284M376 158 398 284" stroke="#9C7B6A" strokeWidth="1.6" />
      {/* walls: stripes, the glowing entrance with its curtains tied back */}
      <path d="M40 156H360V284H40Z" fill={CREAM} />
      <path d={walls.join('')} style={{ fill: STRIPE }} />
      <path d="M40 156H360V284H40Z" fill={u('wallshade')} />
      <path d="M158 284V218A42 42 0 0 1 242 218V284Z" fill={u('door')} />
      <path
        d="M158 284V218A42 42 0 0 1 200 176C186 196 174 226 176 250 166 256 162 270 158 284Z"
        style={{ fill: STRIPE }}
      />
      <path
        d="M242 284V218A42 42 0 0 0 200 176C214 196 226 226 224 250 234 256 238 270 242 284Z"
        style={{ fill: STRIPE }}
      />
      <path d="M170 246 182 252M230 246 218 252" stroke={YELLOW} strokeWidth="5" strokeLinecap="round" />
      <path d="M158 284V218A42 42 0 0 1 242 218V284" fill="none" stroke={YELLOW} strokeWidth="4" />
      {/* roof: stripes from the peak, the valance with pom-poms */}
      <path d={roof} fill={CREAM} />
      <g clipPath={u('roof')}>
        <path d={wedges.join('')} style={{ fill: STRIPE }} />
      </g>
      <path d={roof} fill={u('roofshade')} />
      <path d={`${scallops}Z`} fill={YELLOW} />
      <path d={scallops} fill="none" stroke="#E6A21F" strokeWidth="2" />
      {poms.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3.6" fill={RED} />
      ))}
      <path d="M22 156H378" stroke="#E6A21F" strokeWidth="3" />
      {/* poles at the peak and the eaves */}
      <path d="M200 50V6M24 158V120M376 158V120" stroke="#8A5A3C" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="200" cy="5" r="4" fill={YELLOW} />
    </g>
  );
}

/** A flag on its pole, fluttering from the pole (viewBox 0 0 44 26). */
function PoleFlag({ color }: { color: string }) {
  return <path d="M2 2C14 -1 28 6 42 2 36 9 38 14 42 22 28 26 14 19 2 22Z" fill={color} />;
}

/** A seal in a top hat on a circus drum, its nose up (viewBox 0 0 120 150). */
function Seal({ u }: { u: Url }) {
  return (
    <g>
      {/* drum */}
      <path d="M22 118V142C22 148 98 148 98 142V118Z" fill={RED} />
      <path
        d="M22 124 34 136 46 124 58 136 70 124 82 136 94 124"
        fill="none"
        stroke={YELLOW}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <ellipse cx="60" cy="118" rx="38" ry="9" fill="#F46270" />
      <ellipse cx="60" cy="118" rx="38" ry="9" fill="none" stroke={YELLOW} strokeWidth="3" />
      {/* body, belly, flippers */}
      <path d="M36 116C28 96 34 70 52 56 62 48 76 50 82 60 88 72 86 96 80 116Z" fill={u('seal')} />
      <path d="M50 114C46 96 50 78 62 68 70 72 74 90 70 114Z" fill="#B9CFDD" />
      <path d="M40 90C28 88 18 94 14 102 26 104 38 100 44 96Z" fill="#5E7E98" />
      <path d="M80 88C92 84 104 88 108 96 96 100 84 98 78 94Z" fill="#5E7E98" />
      <path
        d="M40 114C30 116 26 122 28 124 38 124 46 120 48 116ZM78 114C88 114 94 120 92 122 82 124 74 120 72 116Z"
        fill="#5E7E98"
      />
      {/* head up, the nose to the sky */}
      <path
        d="M54 58C50 44 56 30 70 26 80 23 90 20 96 14 100 22 98 32 90 40 84 48 72 60 60 64Z"
        fill={u('seal')}
      />
      <ellipse cx="96.5" cy="13.5" rx="3.6" ry="3" fill={PLUM} />
      <circle cx="74" cy="36" r="3.4" fill={PLUM} />
      <circle cx="75.2" cy="34.9" r="1.1" fill="#fff" />
      <path d="M86 30 100 28M86 33 99 36M84 36 95 42" stroke={PLUM} strokeWidth=".9" opacity=".6" />
      <path d="M79 42C83 44 87 43 90 40" fill="none" stroke={PLUM} strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="80" cy="40" rx="4" ry="2.4" fill="#FF9DB0" opacity=".6" />
      {/* the ringmaster's top hat, at a jaunty angle */}
      <g transform="rotate(-24 58 34)">
        <path d="M44 36H74" stroke={PLUM} strokeWidth="5" strokeLinecap="round" />
        <path d="M49 35V14H69V35Z" fill={RED} />
        <path d="M49 28H69V33H49Z" fill={YELLOW} />
        <path d="M49 14H69" stroke="#B51F2C" strokeWidth="2" />
      </g>
    </g>
  );
}

/** A beach ball (viewBox -20 -20 40 40). */
function BeachBall() {
  return (
    <g>
      <circle r="18" fill="#FFFFFF" />
      <path d="M0-18C-9-10-9 10 0 18-4 10-4-10 0-18Z" fill={RED} />
      <path d="M0-18C9-10 9 10 0 18 4 10 4-10 0-18Z" fill={BLUE} />
      <path d="M0-18C-16-12-19 6-12 13-10 2-7-9 0-18Z" fill={YELLOW} />
      <path d="M0-18C16-12 19 6 12 13 10 2 7-9 0-18Z" fill={TEAL} />
      <circle r="18" fill="none" stroke="#E7D6C0" strokeWidth="1.2" />
      <circle cy="-16" r="3" fill="#fff" />
      <ellipse cx="-7" cy="-7" rx="4" ry="6" fill="#fff" opacity=".4" transform="rotate(35 -7 -7)" />
    </g>
  );
}

// the bunting: a string sagging across the top, flags hung from it (fractions of the scene)
const FLAGS = 15;
const sag = (t: number) => 0.2 + 2.6 * t * (1 - t); // the string's height at t, in fractions of its box

export default function CircusTop({ place }: SceneProps) {
  const { ref, url } = useIds();
  const card = place === 'card';
  const poster = place === 'poster';
  const small = card || poster;
  const unit = (n: number) => (small ? cm(n) : cmh(n));
  const buntingH = card ? 16 : poster ? 13 : 12; // cqh
  const tentW = card ? 64 : poster ? 88 : 76;
  const tentBottom = card ? '5cqh' : '1cqh';
  // the seal stands right of the tent where there is room, in front of its corner where there isn't
  const sealW = small ? 22 : 26;
  const ballW = small ? 8 : 9.4;
  const sealLeft = `min(calc(50% + ${unit(tentW / 2 + 1)}), calc(100% - ${unit(sealW + 1)}))`;
  const sealBottom = card ? '4cqh' : '1.6cqh';
  // and a bunch of balloons on the other side
  const bunchW = small ? 12 : 14;
  const bunchLeft = `max(calc(50% - ${unit(tentW / 2 + bunchW + 1)}), ${unit(0.5)})`;
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id={ref('roof')}>
            <path d="M200 50C172 76 96 124 22 156H378C304 124 228 76 200 50Z" />
          </clipPath>
          <linearGradient id={ref('roofshade')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7A1A28" stopOpacity=".22" />
            <stop offset=".45" stopColor="#fff" stopOpacity=".08" />
            <stop offset="1" stopColor="#7A1A28" stopOpacity=".26" />
          </linearGradient>
          <linearGradient id={ref('wallshade')} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7A1A28" stopOpacity=".26" />
            <stop offset=".5" stopColor="#7A1A28" stopOpacity="0" />
            <stop offset="1" stopColor="#7A1A28" stopOpacity=".3" />
          </linearGradient>
          <radialGradient id={ref('door')} cx=".5" cy=".85" r=".8">
            <stop offset="0" stopColor="#FFD98A" />
            <stop offset=".45" stopColor="#E8903A" />
            <stop offset="1" stopColor="#7A2A1E" />
          </radialGradient>
          <linearGradient id={ref('seal')} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#8FA9C0" />
            <stop offset="1" stopColor="#5F7F99" />
          </linearGradient>
          <filter id={ref('soft')} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#7A3A1E" floodOpacity=".22" />
          </filter>
        </defs>
      </svg>
      {/* a vintage sunburst from the tent, fading out toward the top */}
      <Layer
        style={{
          background:
            'radial-gradient(90cqw 60cqh at 50% 88%, rgba(255,214,140,.55), transparent 70%),' +
            'linear-gradient(180deg, #FFF3DD 0%, #FFF6E8 45%, #FFEBCC 100%)',
        }}
      />
      <Layer
        style={{
          background: `repeating-conic-gradient(from 0deg at 50% 86%, rgba(255,196,120,.34) 0deg 6deg, transparent 6deg 12deg)`,
          maskImage: 'linear-gradient(180deg, transparent 8%, rgba(0,0,0,.55) 45%, #000 80%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 8%, rgba(0,0,0,.55) 45%, #000 80%)',
        }}
      />
      {/* stars twinkling under the bunting and around the tent */}
      {[
        [8, 22, 3.2, YELLOW, 0],
        [86, 19, 2.6, TEAL, 1],
        [22, 31, 2, PINK, 2],
        [74, 29, 2.2, YELLOW, 1],
        [6, 60, 2.4, BLUE, 2],
        [93, 57, 2.8, YELLOW, 0],
        [50, 23, 1.8, RED, 2],
      ].map(([x, y, r, color, g], i) => (
        <Piece
          key={i}
          vb={[-10, -10, 20, 20]}
          anim="twinkle"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: unit((r as number) * 2),
            translate: '-50% -50%',
            animationDelay: `${-(g as number) * 0.9}s`,
          }}
        >
          <Star r={9} color={color as string} />
        </Piece>
      ))}
      {/* balloons drifting up at the sides (invitation.css brings each back from below) */}
      {[
        [3, 44, RED, 0],
        [11, 52, YELLOW, 3],
        [86, 46, TEAL, 1.5],
        [93, 55, PINK, 4.5],
      ].map(([x, y, color, delay], i) => (
        <Piece
          key={`b${i}`}
          vb={[0, 0, 40, 96]}
          anim="rise"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: unit(small ? 7 : 8.5),
            translate: '-50% 0',
            rotate: `${i % 2 ? 6 : -6}deg`,
            animationDelay: `${-(delay as number)}s`,
            animationDuration: `${9 + i}s`,
          }}
        >
          <Balloon color={color as string} />
        </Piece>
      ))}
      {/* the bunting: a sagging string, each flag fluttering in turn */}
      <Piece
        vb={[0, 0, 100, 100]}
        fit="none"
        style={{ left: 0, top: 0, width: '100%', height: `${buntingH}cqh` }}
      >
        <path
          d="M-2 20Q50 150 102 20"
          fill="none"
          stroke="#8A5A3C"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
      </Piece>
      {Array.from({ length: FLAGS }, (_, i) => {
        const t = (i + 0.5) / FLAGS;
        return (
          <Piece
            key={`f${i}`}
            vb={[0, 0, 40, 50]}
            anim="swing"
            style={{
              left: `${r1(t * 100)}%`,
              top: `${r1(buntingH * sag(t) * 0.965)}cqh`,
              width: `min(${small ? 5.4 : 5.8}cqw, ${card ? 6 : 8}cqmin)`,
              translate: '-50% 0',
              animationDelay: `${r1(-i * 0.35)}s`,
            }}
          >
            <Pennant color={FLAG_COLORS[i % FLAG_COLORS.length]!} />
          </Piece>
        );
      })}
      {/* the ground */}
      <Layer
        style={{
          inset: 'auto',
          left: 0,
          width: '100%',
          bottom: 0,
          height: card ? '12cqh' : '7cqh',
          background: 'linear-gradient(180deg, #9CCB6B, #7DB356)',
          borderRadius: '50% 50% 0 0 / 2.4cqh 2.4cqh 0 0',
        }}
      />
      {/* the big top, its flags fluttering from the poles */}
      <Piece
        vb={[0, 0, 400, 290]}
        style={{ left: '50%', bottom: tentBottom, width: unit(tentW), translate: '-50% 0' }}
      >
        <g filter={url('soft')}>
          <Tent u={url} />
        </g>
      </Piece>
      {(
        [
          [200, 11, RED, 1],
          [24, 122, TEAL, 0.8],
          [376, 122, BLUE, 0.8],
        ] as const
      ).map(([px, py, color, s], i) => (
        <Piece
          key={`p${i}`}
          vb={[0, 0, 44, 26]}
          anim="swing"
          style={{
            // (cmh is a min(): only ever given positive lengths, the sign goes in the calc)
            left: `calc(50% ${px < 200 ? '-' : '+'} ${unit(r1((Math.abs(px - 200) / 400) * tentW))})`,
            bottom: `calc(${tentBottom} + ${unit(r1(((290 - py) / 400) * tentW - (26 * s * tentW) / 400))})`,
            width: unit(r1((44 * s * tentW) / 400)),
            transformOrigin: '0 50%',
            // the flag of the left pole flies to the left
            ...(px < 200 ? { scale: '-1 1' } : null),
            animationDelay: `${-i * 0.8}s`,
          }}
        >
          <PoleFlag color={color} />
        </Piece>
      ))}
      {/* balloons tied beside the tent, swaying */}
      <Piece
        vb={[0, 0, 80, 150]}
        anim="sway"
        style={{ left: bunchLeft, bottom: sealBottom, width: unit(bunchW) }}
      >
        <BalloonBunch />
      </Piece>
      {/* the seal on its drum beside the tent (in front of it on a phone), juggling the ball */}
      <Piece vb={[0, 0, 120, 150]} style={{ left: sealLeft, bottom: sealBottom, width: unit(sealW) }}>
        <g filter={url('soft')}>
          <Seal u={url} />
        </g>
      </Piece>
      <Piece
        vb={[-20, -20, 40, 40]}
        anim="bounce"
        style={{
          left: `calc(${sealLeft} + ${unit(r1((96.5 / 120) * sealW - ballW / 2))})`,
          bottom: `calc(${sealBottom} + ${unit(r1((140 / 120) * sealW))})`,
          width: unit(ballW),
        }}
      >
        <BeachBall />
      </Piece>
    </>
  );
}
