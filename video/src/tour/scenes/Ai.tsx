import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, PHOTO_TILES, SHADOW } from '../../theme';
import { Card, clamp, Phone, Poster, SparkleIcon, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { AI_PALETTE, AI_POSTER, ImageIcon } from '../data';

const PHOTOS = [PHOTO_TILES[5], PHOTO_TILES[2], PHOTO_TILES[0], PHOTO_TILES[6]];
// where each photo flies in from (stage coordinates)
const FROM = [
  { x: 1080, y: 120, r: 18 },
  { x: 1100, y: 420, r: -14 },
  { x: 860, y: -140, r: 10 },
  { x: 1120, y: 700, r: -20 },
];

/** "עצבו לי": photos fly into the card → a palette, a mood and a style → a generated invitation. */
export function AiScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const inOut = Easing.inOut(Easing.cubic);

  const tPhotos = spoken('מעלים כמה תמונות', -6);
  const tGo = spoken('ועצבו לי', 0);
  const tBuild = spoken('בונה עיצוב', 4);
  const tColors = spoken('צבעים', -2);
  const tMood = spoken('אווירה', -2);
  const tStyle = spoken('וסגנון', -2);

  const cardIn = sp(0, { damping: 16 });
  const fly = (i: number) =>
    interpolate(frame, [tPhotos + i * 5, tPhotos + i * 5 + 16], [0, 1], { ...clamp, easing: inOut });
  const press = interpolate(frame, [tGo, tGo + 12], [0, 1], clamp);
  const working = frame >= tGo + 4 && frame < tBuild + 18;
  const shimmer = ((frame - tGo) % 30) / 30;
  const reveal = interpolate(frame, [tBuild, tBuild + 22], [0, 1], { ...clamp, easing: inOut });
  const palette = (i: number) => sp(tColors + i * 3, { damping: 12 });
  const mood = sp(tMood, { damping: 14 });
  const style = sp(tStyle, { damping: 14 });
  const phoneIn = sp(6, { damping: 16 });

  // the drop zone's 2×2 grid inside the card (card: left 470, top 40, width 530)
  const slot = (i: number) => ({ x: 470 + 40 + (1 - (i % 2)) * 232, y: 40 + 150 + Math.floor(i / 2) * 182 });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the phone with the result */}
      <Phone
        width={380}
        style={{ left: 30, top: 95, opacity: phoneIn, transform: `translateY(${(1 - phoneIn) * 60}px)` }}
      >
        <div style={{ position: 'absolute', inset: 0, background: '#efe9e2' }} />
        {/* skeleton while there is nothing yet */}
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - reveal }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 60 + (i % 2) * 40,
                right: 60 + (i % 2) * 40,
                top: 240 + i * 70,
                height: i === 1 ? 56 : 26,
                borderRadius: 12,
                background: `linear-gradient(90deg, #e5ddd3 ${shimmer * 100 - 30}%, #f4efe9 ${shimmer * 100}%, #e5ddd3 ${shimmer * 100 + 30}%)`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 5,
            clipPath: `circle(${reveal * 120}% at 50% 45%)`,
          }}
        >
          <Poster theme={AI_POSTER} width={343} t={frame} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 22,
            right: 22,
            bottom: 30,
            height: 60,
            borderRadius: 16,
            background: AI_PALETTE[3],
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 800,
            opacity: reveal,
          }}
        >
          אישור הגעה
        </div>
      </Phone>

      {/* the card */}
      <Card
        style={{
          left: 470,
          top: 40,
          width: 530,
          height: 560,
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 30, right: 34, display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <SparkleIcon size={34} color={C.brand} />
          <div style={{ fontSize: 34, fontWeight: 800, color: C.ink }}>עצבו לי</div>
        </div>
        <div
          style={{ position: 'absolute', top: 84, right: 34, fontSize: 22, fontWeight: 500, color: C.muted }}
        >
          העלו כמה תמונות שאתם אוהבים
        </div>
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: 30,
            right: 30,
            height: 380,
            borderRadius: 22,
            border: `3px dashed ${frame > tPhotos && frame < tPhotos + 40 ? C.brand : C.brandLine}`,
            background: C.brandSoft,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: C.brand,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              opacity: 1 - fly(0),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <ImageIcon size={56} color={C.brand} />
            גררו לכאן תמונות
          </div>
        </div>
      </Card>

      {/* the photos */}
      {PHOTOS.map((bg, i) => {
        const p = fly(i);
        const to = slot(i);
        const x = interpolate(p, [0, 1], [FROM[i].x, to.x]);
        const y = interpolate(p, [0, 1], [FROM[i].y, to.y]) - Math.sin(p * Math.PI) * 60;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 216,
              height: 166,
              borderRadius: 18,
              background: bg,
              boxShadow: SHADOW.lg,
              border: '5px solid #fff',
              transform: `rotate(${FROM[i].r * (1 - p) + (i % 2 ? 2 : -2) * p}deg)`,
              opacity: interpolate(p, [0, 0.15], [0, 1], clamp),
              overflow: 'hidden',
              zIndex: 5,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '18%',
                bottom: -24,
                width: 70,
                height: 70,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.35)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -34,
                width: 86,
                height: 86,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.28)',
              }}
            />
          </div>
        );
      })}

      {/* the button */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          right: 90,
          top: 630,
          height: 84,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${C.brandDeep}, ${C.brand})`,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          fontSize: 32,
          fontWeight: 800,
          boxShadow: '0 16px 36px rgba(122,82,48,0.35)',
          transform: `scale(${sp(tPhotos + 20) * (1 - 0.06 * Math.sin(press * Math.PI))})`,
          overflow: 'hidden',
        }}
      >
        <SparkleIcon size={34} color="#fff" />
        {working ? 'מעצבים…' : reveal > 0.9 ? 'העיצוב מוכן' : 'עצבו לי'}
        {working ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 140,
              left: `${shimmer * 130 - 20}%`,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))',
            }}
          />
        ) : null}
      </div>

      {/* what it took from the photos */}
      <Card
        style={{
          left: 470,
          top: 745,
          width: 530,
          height: 235,
          opacity: palette(0),
          transform: `translateY(${(1 - palette(0)) * 40}px)`,
        }}
        radius={24}
      >
        <div
          style={{ position: 'absolute', top: 22, right: 28, fontSize: 22, fontWeight: 700, color: C.muted }}
        >
          צבעים
        </div>
        <div style={{ position: 'absolute', top: 58, right: 28, display: 'flex', gap: 12 }}>
          {AI_PALETTE.map((c, i) => (
            <div
              key={c}
              style={{
                width: 70,
                height: 70,
                borderRadius: 18,
                background: c,
                boxShadow: `${SHADOW.sm}, inset 0 0 0 1px rgba(0,0,0,0.06)`,
                transform: `scale(${palette(i)})`,
              }}
            />
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 22, right: 28, display: 'flex', gap: 12 }}>
          {[
            { k: 'אווירה', v: 'חמימה ורומנטית', p: mood },
            { k: 'סגנון', v: 'בוהו טבעי', p: style },
          ].map((x) => (
            <div
              key={x.k}
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                background: C.brandSoft,
                fontSize: 22,
                fontWeight: 700,
                color: C.brandDeep,
                opacity: x.p,
                transform: `scale(${0.7 + 0.3 * x.p})`,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: C.muted, fontWeight: 600 }}>{x.k}:</span> {x.v}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
