import { interpolate, useCurrentFrame } from 'remotion';
import { C, PHOTO_TILES, SHADOW } from '../theme';
import { Card, CameraIcon, clamp, useSpringAt } from '../ui';

/** A deterministic QR-looking grid (decorative). */
export function QrCode({ size, color = C.ink }: { size: number; color?: string }) {
  const n = 21;
  const cell = size / n;
  const finder = (x: number, y: number) => x < 7 && y < 7;
  const isFinder = (x: number, y: number) => finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y);
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (isFinder(x, y)) continue;
      if (((x * 7 + y * 13 + x * y * 3) % 5) % 2 === 0) {
        cells.push(
          <rect
            key={`${x}-${y}`}
            x={x * cell}
            y={y * cell}
            width={cell + 0.4}
            height={cell + 0.4}
            fill={color}
          />,
        );
      }
    }
  }
  const fp = (x: number, y: number) => (
    <g key={`f${x}${y}`}>
      <rect x={x * cell} y={y * cell} width={7 * cell} height={7 * cell} fill={color} rx={cell} />
      <rect
        x={(x + 1) * cell}
        y={(y + 1) * cell}
        width={5 * cell}
        height={5 * cell}
        fill="#fff"
        rx={cell * 0.6}
      />
      <rect
        x={(x + 2) * cell}
        y={(y + 2) * cell}
        width={3 * cell}
        height={3 * cell}
        fill={color}
        rx={cell * 0.4}
      />
    </g>
  );
  return (
    <svg width={size} height={size}>
      {cells}
      {fp(0, 0)}
      {fp(n - 7, 0)}
      {fp(0, n - 7)}
    </svg>
  );
}

/** 34–39s: QR check-in counter, a live gallery filling up, and the screen in the hall. */
export function EventDayScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();

  // check-in: a scan every 13 frames
  const scans = Math.max(0, Math.floor((frame - 10) / 13));
  const sincScan = (frame - 10) % 13;
  const flash = frame > 10 ? interpolate(sincScan, [0, 3, 10], [0, 1, 0], clamp) : 0;
  const checkedIn = 64 + Math.min(scans, 10) * 3 + (scans > 0 ? 1 : 0);
  const scanLine = (frame % 30) / 30;

  const tiles = 12;
  const tileIn = (i: number) => sp(12 + i * 7, { damping: 13, stiffness: 150 });
  const photos = 236 + Math.round(Math.max(0, frame - 12) * 0.6);
  const slide = Math.floor(frame / 40) % 4;
  const slideFade = interpolate(frame % 40, [0, 10], [0, 1], clamp);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* check-in */}
      <Card
        style={{
          left: 0,
          top: 0,
          width: 380,
          height: 540,
          opacity: sp(0),
          transform: `translateY(${(1 - sp(0)) * 40}px)`,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 26, right: 30, fontSize: 28, fontWeight: 800, color: C.ink }}
        >
          צ׳ק־אין בכניסה
        </div>
        <div
          style={{
            position: 'absolute',
            top: 90,
            left: 70,
            width: 240,
            height: 240,
            borderRadius: 22,
            padding: 10,
            background: '#fff',
            boxShadow: `0 0 0 ${4 + flash * 6}px ${flash > 0.05 ? C.success : C.line}`,
          }}
        >
          <QrCode size={220} />
          <div
            style={{
              position: 'absolute',
              left: 6,
              right: 6,
              top: 10 + scanLine * 220,
              height: 4,
              borderRadius: 4,
              background: C.success,
              boxShadow: `0 0 16px 4px rgba(21,128,61,0.45)`,
            }}
          />
        </div>
        <div style={{ position: 'absolute', top: 360, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.muted }}>נכנסו לאולם</div>
          <div style={{ fontSize: 70, fontWeight: 800, color: C.ink, lineHeight: 1.05, direction: 'ltr' }}>
            {checkedIn}
            <span style={{ fontSize: 34, color: C.faint }}> / 142</span>
          </div>
          <div
            style={{
              margin: '14px 40px 0',
              height: 12,
              borderRadius: 99,
              background: C.subtle,
              overflow: 'hidden',
              direction: 'rtl',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(checkedIn / 142) * 100}%`,
                background: C.success,
                borderRadius: 99,
              }}
            />
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 140 - flash * 30,
            right: 24,
            fontSize: 30,
            fontWeight: 800,
            color: C.success,
            opacity: flash,
          }}
        >
          +3
        </div>
      </Card>

      {/* live gallery */}
      <Card
        style={{
          left: 410,
          top: 0,
          width: 590,
          height: 540,
          opacity: sp(4),
          transform: `translateY(${(1 - sp(4)) * 40}px)`,
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
          <div style={{ fontSize: 28, fontWeight: 800, color: C.ink }}>גלריה חיה</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 20,
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
            בשידור חי · {photos} תמונות
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 88,
            left: 26,
            right: 26,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          {Array.from({ length: tiles }, (_, i) => {
            const p = tileIn(i);
            return (
              <div
                key={i}
                style={{
                  height: 128,
                  borderRadius: 16,
                  background: PHOTO_TILES[i % PHOTO_TILES.length],
                  transform: `scale(${p})`,
                  opacity: Math.min(1, p * 1.5),
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '22%',
                    bottom: -18,
                    width: 46,
                    height: 46,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,0.35)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '52%',
                    bottom: -26,
                    width: 56,
                    height: 56,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,0.28)',
                  }}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* the screen in the hall */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 580,
          width: 840,
          opacity: sp(14),
          transform: `translateY(${(1 - sp(14)) * 60}px)`,
        }}
      >
        <div
          style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: C.brandDeep, marginBottom: 10 }}
        >
          המסך באולם
        </div>
        <div
          style={{ height: 340, borderRadius: 24, background: '#141210', padding: 14, boxShadow: SHADOW.xl }}
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
                background: 'linear-gradient(90deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.5) 100%)',
              }}
            />
            <div style={{ position: 'absolute', right: 34, top: 40, color: '#fff' }}>
              <div style={{ fontSize: 22, fontWeight: 600, opacity: 0.9 }}>החתונה של</div>
              <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.1 }}>נועה & איתי</div>
            </div>
            <div
              style={{
                position: 'absolute',
                left: 26,
                top: 26,
                bottom: 26,
                width: 210,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <QrCode size={130} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.ink,
                  textAlign: 'center',
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
            width: 120,
            height: 26,
            background: '#2a2623',
            borderRadius: '0 0 10px 10px',
          }}
        />
      </div>
    </div>
  );
}
