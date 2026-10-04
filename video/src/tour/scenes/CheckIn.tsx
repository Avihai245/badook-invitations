import { interpolate, useCurrentFrame } from 'remotion';
import { QrCode } from '../../scenes/EventDay';
import { C } from '../../theme';
import { Avatar, Card, CheckIcon, clamp, Cursor, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { EVENT, Ltr, ScanIcon, SearchIcon } from '../data';

const RESULTS = [
  { name: 'משפחת כהן', n: 4, color: '#2a78d6' },
  { name: 'יוסי כהנא', n: 2, color: '#b45309' },
];

const ARRIVALS = [
  { name: 'משפחת כהן', n: 4, time: '19:42', color: '#2a78d6' },
  { name: 'דנה כהן', n: 2, time: '19:42', color: '#a0703f' },
  { name: 'משפחת לוי', n: 4, time: '19:43', color: '#15803d' },
  { name: 'עומר ביטון', n: 2, time: '19:43', color: '#7a5230' },
  { name: 'שני פרץ', n: 2, time: '19:44', color: '#9b3a3f' },
];

/** Event day: the entrance desk checks guests in by search or by scanning, and arrivals show live. */
export function CheckInScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();

  const tSearch = spoken('בחיפוש', -10);
  const tScan = spoken('בסריקת קוד', -6);
  const tLive = spoken('ואתם רואים', -6);
  const deskIn = sp(0, { damping: 16 });
  const query = Array.from('כה')
    .slice(0, Math.max(0, Math.floor((frame - tSearch) / 5)))
    .join('');
  const results = sp(tSearch + 10, { damping: 16 });
  const tConfirm = tSearch + 26;
  const confirmed = sp(tConfirm + 4, { damping: 14 });
  const press =
    frame >= tConfirm && frame < tConfirm + 14 ? interpolate(frame, [tConfirm, tConfirm + 14], [0, 1]) : 0;
  const scanIn = sp(tScan - 6, { damping: 16 });
  const scanLine = ((frame - tScan) % 34) / 34;
  const scanned = frame >= tScan + 16;
  const flash = interpolate(frame, [tScan + 14, tScan + 18, tScan + 30], [0, 1, 0], clamp);
  const liveIn = sp(tLive - 10, { damping: 16 });
  const arrivals = Math.max(0, Math.min(ARRIVALS.length, Math.floor((frame - tLive + 8) / 8)));
  const base = 81;
  const checked = base + (confirmed > 0.5 ? 4 : 0) + (scanned ? 2 : 0) + Math.max(0, arrivals - 2) * 3;
  const cursorOpacity = interpolate(
    frame,
    [tConfirm - 20, tConfirm - 10, tConfirm + 18, tConfirm + 26],
    [0, 1, 1, 0],
    clamp,
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* the desk: search */}
      <Card
        style={{
          right: 0,
          top: 10,
          width: 560,
          height: 520,
          opacity: deskIn,
          transform: `translateY(${(1 - deskIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 26, right: 30, fontSize: 30, fontWeight: 800, color: C.ink }}
        >
          עמדת הכניסה
        </div>
        <div style={{ position: 'absolute', top: 30, left: 30, display: 'flex', gap: 8 }}>
          {[
            { l: 'חיפוש', on: frame < tScan - 4, Icon: SearchIcon },
            { l: 'סריקה', on: frame >= tScan - 4, Icon: ScanIcon },
          ].map((t) => (
            <div
              key={t.l}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 20,
                fontWeight: 700,
                background: t.on ? C.ink : C.subtle,
                color: t.on ? '#fff' : C.muted,
              }}
            >
              <t.Icon size={20} />
              {t.l}
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 96,
            right: 30,
            left: 30,
            height: 74,
            borderRadius: 18,
            border: `2px solid ${frame >= tSearch ? C.brand : C.line}`,
            boxShadow: frame >= tSearch && frame < tConfirm ? '0 0 0 6px rgba(160,112,63,0.14)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 20px',
          }}
        >
          <SearchIcon size={30} color={C.muted} />
          <div style={{ fontSize: 30, fontWeight: 700, color: query ? C.ink : C.faint }}>
            {query || 'שם או טלפון'}
          </div>
        </div>
        {RESULTS.map((r, i) => {
          const isFirst = i === 0;
          const ok = isFirst && confirmed > 0.5;
          return (
            <div
              key={r.name}
              style={{
                position: 'absolute',
                top: 196 + i * 110,
                right: 30,
                left: 30,
                height: 96,
                borderRadius: 20,
                border: `2px solid ${ok ? '#bbf7d0' : C.line}`,
                background: ok ? C.successBg : C.surface,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 16px',
                opacity: results,
                transform: `translateY(${(1 - results) * 20 * (i + 1)}px)`,
              }}
            >
              <Avatar label={r.name.split(' ').pop()![0]} color={r.color} size={52} />
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>{r.name}</div>
                <div style={{ fontSize: 19, fontWeight: 600, color: C.muted }}>
                  אישרו <Ltr>{r.n}</Ltr> · שולחן <Ltr>{i ? 9 : 4}</Ltr>
                </div>
              </div>
              {isFirst ? (
                <div
                  style={{
                    marginInlineStart: 'auto',
                    height: 58,
                    padding: '0 20px',
                    borderRadius: 14,
                    background: ok ? C.success : C.brand,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 22,
                    fontWeight: 800,
                    transform: `scale(${1 - 0.06 * Math.sin(press * Math.PI)})`,
                  }}
                >
                  {ok ? <CheckIcon size={24} color="#fff" progress={confirmed} /> : null}
                  {ok ? 'הגיעו' : 'אישור הגעה'}
                </div>
              ) : null}
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            bottom: 26,
            right: 30,
            left: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 20,
            fontWeight: 600,
            color: C.muted,
            opacity: results,
          }}
        >
          אפשר לאשר גם מספר אחר של אנשים, ולהוסיף אורח שלא ברשימה
        </div>
      </Card>

      {/* the desk: scan */}
      <Card
        style={{
          left: 0,
          top: 10,
          width: 410,
          height: 520,
          opacity: scanIn,
          transform: `translateY(${(1 - scanIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 26, right: 28, fontSize: 28, fontWeight: 800, color: C.ink }}
        >
          סריקת קוד
        </div>
        <div
          style={{
            position: 'absolute',
            top: 86,
            left: (410 - 270) / 2,
            width: 270,
            height: 270,
            borderRadius: 24,
            padding: 15,
            background: '#fff',
            boxShadow: `0 0 0 ${4 + flash * 6}px ${flash > 0.05 ? C.success : C.line}`,
          }}
        >
          <QrCode size={240} />
          {!scanned ? (
            <div
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                top: 14 + scanLine * 240,
                height: 4,
                borderRadius: 4,
                background: C.success,
                boxShadow: '0 0 16px 4px rgba(21,128,61,0.45)',
              }}
            />
          ) : null}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 24,
            right: 24,
            height: 92,
            borderRadius: 18,
            background: scanned ? C.successBg : C.subtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontSize: 24,
            fontWeight: 800,
            color: scanned ? C.success : C.muted,
          }}
        >
          {scanned ? <CheckIcon size={30} color={C.success} /> : <ScanIcon size={30} />}
          {scanned ? (
            <span>
              דנה כהן · <Ltr>2</Ltr> · נכנסו
            </span>
          ) : (
            'מכוונים את המצלמה לקוד'
          )}
        </div>
      </Card>

      {/* who arrived, live */}
      <Card
        style={{
          left: 0,
          right: 0,
          top: 560,
          height: 420,
          opacity: liveIn,
          transform: `translateY(${(1 - liveIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{
            position: 'absolute',
            top: 26,
            right: 30,
            left: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>מי הגיע</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 19,
                fontWeight: 700,
                color: C.danger,
                background: C.dangerBg,
                padding: '4px 12px',
                borderRadius: 999,
              }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 99,
                  background: C.danger,
                  opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 6)),
                }}
              />
              בזמן אמת
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.muted }}>
            <Ltr style={{ fontSize: 44, fontWeight: 800, color: C.ink }}>{checked}</Ltr> /{' '}
            <Ltr>{EVENT.coming}</Ltr> נכנסו
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 96,
            right: 30,
            left: 30,
            height: 14,
            borderRadius: 99,
            background: C.subtle,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: `${(checked / EVENT.coming) * 100}%`,
              background: C.success,
              borderRadius: 99,
            }}
          />
        </div>
        <div style={{ position: 'absolute', top: 136, right: 30, left: 30 }}>
          {ARRIVALS.slice(0, arrivals)
            .reverse()
            .slice(0, 4)
            .map((a, i) => {
              const at = tLive - 8 + (ARRIVALS.indexOf(a) + 1) * 8;
              const p = sp(at, { damping: 16 });
              return (
                <div
                  key={a.name}
                  style={{
                    height: 66,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    borderBottom: `1px solid ${C.subtle}`,
                    opacity: Math.min(1, p * 1.4) * (i === 3 ? 0.5 : 1),
                    transform: `translateY(${(1 - p) * -30}px)`,
                  }}
                >
                  <Avatar label={a.name.split(' ').pop()![0]} color={a.color} size={44} />
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>{a.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: C.muted }}>
                    <Ltr>{a.n}</Ltr> אנשים
                  </div>
                  <Ltr style={{ marginInlineStart: 'auto', fontSize: 20, fontWeight: 600, color: C.faint }}>
                    {a.time}
                  </Ltr>
                  <CheckIcon size={26} color={C.success} />
                </div>
              );
            })}
        </div>
      </Card>
      <div style={{ opacity: cursorOpacity }}>
        <Cursor x={560} y={268} pressed={press} />
      </div>
    </div>
  );
}
