import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { QrCode } from '../../scenes/EventDay';
import { C, PHOTO_TILES, SHADOW } from '../../theme';
import { Card, CameraIcon, clamp, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { EVENT, FaceIcon, Ltr } from '../data';

const COLS = 5;
const TILE = 168;
const GAP = 14;

/** A photo tile with soft "people" shapes (no real photos in the video). */
function Photo({ i, size, style }: { i: number; size: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: Math.max(10, size * 0.1),
        background: PHOTO_TILES[i % PHOTO_TILES.length],
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '20%',
          bottom: -size * 0.12,
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.38)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -size * 0.16,
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.3)',
        }}
      />
    </div>
  );
}

/** The live gallery: guests' photos stream in, the screen in the hall, and "the photos I'm in". */
export function GalleryScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const tScreen = spoken('על המסך באולם', -8);
  const tFaces = spoken('וכל אחד יכול', -6);

  // a new photo every 9 frames, pushed in at the start of the grid (top right)
  const arrived = Math.max(0, Math.floor((frame - 6) / 9));
  const count = 236 + arrived * 3;
  const gridIn = sp(0, { damping: 16 });
  const newest = (frame - 6) % 9;
  const pushIn = interpolate(newest, [0, 8], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const screenIn = sp(tScreen, { damping: 16 });
  const facesIn = sp(tFaces, { damping: 16 });
  const scan = interpolate(frame, [tFaces + 6, tFaces + 30], [0, 1], clamp);
  const found = (i: number) => sp(tFaces + 26 + i * 4, { damping: 14 });
  const slide = Math.floor(frame / 36);
  const slideFade = interpolate(frame % 36, [0, 10], [0, 1], clamp);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the live grid */}
      <Card
        style={{
          left: 0,
          right: 0,
          top: 0,
          height: 470,
          opacity: gridIn,
          transform: `translateY(${(1 - gridIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 30,
            left: 30,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>גלריה חיה</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 21,
              fontWeight: 700,
              color: C.danger,
              background: C.dangerBg,
              padding: '6px 14px',
              borderRadius: 999,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: C.danger,
                opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 6)),
              }}
            />
            בשידור חי · <Ltr>{count}</Ltr> תמונות
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 86,
            right: 30,
            left: 30,
            height: TILE * 2 + GAP,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: COLS * 2 + 1 }, (_, k) => {
            // k = 0 is the newest; each arrival moves every photo one place along (RTL: right to left,
            // then down a row). A photo crossing the row's end is drawn twice: leaving, and coming in.
            const pos = k - 1 + pushIn;
            const row = Math.floor(pos / COLS);
            const col = pos - row * COLS;
            const copies =
              col > COLS - 1
                ? [
                    { row, col },
                    { row: row + 1, col: col - COLS },
                  ]
                : [{ row, col }];
            return copies.map((c, j) => (
              <div
                key={`${arrived - k}-${j}`}
                style={{ position: 'absolute', right: c.col * (TILE + GAP), top: c.row * (TILE + GAP) }}
              >
                <Photo i={(arrived - k + 120) * 5} size={TILE} />
              </div>
            ));
          })}
        </div>
      </Card>

      {/* the screen in the hall */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 500,
          width: 640,
          opacity: screenIn,
          transform: `translateY(${(1 - screenIn) * 60}px)`,
        }}
      >
        <div
          style={{ height: 380, borderRadius: 24, background: '#141210', padding: 14, boxShadow: SHADOW.xl }}
        >
          <div
            style={{
              position: 'relative',
              height: '100%',
              borderRadius: 14,
              overflow: 'hidden',
              background: '#000',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: PHOTO_TILES[(slide + 3) % PHOTO_TILES.length],
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: PHOTO_TILES[(slide + 4) % PHOTO_TILES.length],
                opacity: slideFade,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)',
              }}
            />
            <div style={{ position: 'absolute', right: 30, top: 34, color: '#fff' }}>
              <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.9 }}>החתונה של</div>
              <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.1 }}>{EVENT.couple}</div>
            </div>
            <div
              style={{
                position: 'absolute',
                left: 22,
                top: 22,
                bottom: 22,
                width: 200,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <QrCode size={140} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.ink,
                }}
              >
                <CameraIcon size={20} color={C.brand} />
                סרקו והעלו תמונות
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            margin: '0 auto',
            width: 110,
            height: 24,
            background: '#2a2522',
            borderRadius: '0 0 10px 10px',
          }}
        />
        <div
          style={{
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 800,
            color: C.brandDeep,
            marginTop: 8,
          }}
        >
          המסך באולם
        </div>
      </div>

      {/* the photos I'm in */}
      <Card
        style={{
          right: 0,
          top: 500,
          width: 330,
          height: 480,
          opacity: facesIn,
          transform: `translateY(${(1 - facesIn) * 60}px)`,
        }}
        radius={26}
      >
        <div
          style={{
            position: 'absolute',
            top: 22,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 24,
            fontWeight: 800,
            color: C.ink,
          }}
        >
          <FaceIcon size={30} color={C.brand} />
          התמונות שאני בהן
        </div>
        <div
          style={{
            position: 'absolute',
            top: 74,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 99,
                background: 'linear-gradient(135deg,#f6d365 0%,#c27c55 100%)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 38,
                  top: 26,
                  width: 44,
                  height: 44,
                  borderRadius: 99,
                  background: 'rgba(255,255,255,0.55)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 22,
                  top: 78,
                  width: 76,
                  height: 70,
                  borderRadius: 40,
                  background: 'rgba(255,255,255,0.45)',
                }}
              />
            </div>
            {scan > 0 && scan < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: -6,
                  right: -6,
                  top: scan * 120,
                  height: 4,
                  borderRadius: 4,
                  background: C.brand,
                  boxShadow: '0 0 14px 4px rgba(160,112,63,0.45)',
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: -8,
                borderRadius: 99,
                border: `3px dashed ${scan >= 1 ? C.success : C.brand}`,
              }}
            />
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 214,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 21,
            fontWeight: 700,
            color: scan >= 1 ? C.success : C.muted,
          }}
        >
          {scan >= 1 ? (
            <>
              מצאנו <Ltr>12</Ltr> תמונות שלך
            </>
          ) : (
            'מחפשים אותך בתמונות…'
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 256,
            right: 24,
            left: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
          }}
        >
          {Array.from({ length: 6 }, (_, i) => {
            const p = found(i);
            return (
              <div
                key={i}
                style={{ position: 'relative', transform: `scale(${p})`, opacity: Math.min(1, p * 1.4) }}
              >
                <Photo i={i * 3 + 1} size={86} />
                <div
                  style={{
                    position: 'absolute',
                    left: 22 + (i % 3) * 4,
                    top: 16 + (i % 2) * 6,
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: `2.5px solid ${C.success}`,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
                  }}
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
