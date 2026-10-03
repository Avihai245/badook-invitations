import { Easing, interpolate, useCurrentFrame } from 'remotion';
// The app's own gauge geometry (pure TS) — the speedometer is drawn exactly like the budget screen's.
import {
  GAUGE_MAX,
  GAUGE_ZONES,
  gaugeArc,
  gaugePoint,
  zoneOf,
  type GaugeZone,
} from '../../../src/features/planning/model/gauge';
import { C } from '../theme';
import { Card, CheckIcon, clamp, keyframes, useSpringAt } from '../ui';

const ZONE_COLOR: Record<GaugeZone, string> = { safe: C.success, close: C.warning, over: C.danger };
const ZONE_TINT: Record<GaugeZone, string> = { safe: '#cfe3d6', close: '#ecd9c4', over: '#efd0cd' };
const ZONE_BG: Record<GaugeZone, string> = { safe: C.successBg, close: C.warningBg, over: C.dangerBg };
// the app's strings (src/lib/i18n/planning-budget.he.ts)
const ZONE_TEXT: Record<GaugeZone, string> = {
  safe: 'אתם בטוחים בתקציב',
  close: 'מתקרבים לגבול — שווה לבדוק',
  over: 'חרגתם מהתקציב',
};

const TOTAL = 180000;
const TASKS = [
  { at: 30, text: 'לסגור אולם' },
  { at: 56, text: 'לבחור צלם' },
  { at: 98, text: 'לקבל הנחה מהקייטרינג' },
  { at: 120, text: 'לשלוח הזמנות' },
];

/** 24–29s: the budget speedometer (green → amber → back to green) and the checklist. */
export function BudgetScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const inOut = Easing.inOut(Easing.cubic);
  // needle: up into the safe zone, past 85% into amber, then the discount brings it back
  const value = keyframes(
    frame,
    [
      [8, 0],
      [40, 0.6],
      [62, 0.66],
      [86, 0.94],
      [100, 0.94],
      [124, 0.79],
    ],
    inOut,
  );
  const zone = zoneOf(value);
  const color = ZONE_COLOR[zone];

  // geometry like BudgetGauge 'lg' (w 360, stroke 22), drawn in a larger viewBox
  const w = 600;
  const stroke = 36;
  const pad = stroke / 2 + 24;
  const r = w / 2 - pad;
  const geo = { cx: w / 2, cy: w / 2, r };
  const h = w / 2 + stroke / 2 + 14;
  const rtl = true;
  const tip = gaugePoint(value, { ...geo, r: r - stroke / 2 - 10 }, rtl);
  const ghostTip = gaugePoint(0.88, { ...geo, r: r - stroke / 2 - 10 }, rtl);
  const tick = (v: number, inner: number, outer: number) => {
    const a = gaugePoint(v, { ...geo, r: inner }, rtl);
    const b = gaugePoint(v, { ...geo, r: outer }, rtl);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  };
  const ticks = Array.from({ length: 14 }, (_, i) => i / 10);
  const left = Math.round(TOTAL * (1 - value));
  const money = (n: number) => `₪${new Intl.NumberFormat('he-IL').format(Math.round(n / 100) * 100)}`;
  const cardIn = sp(0, { damping: 16 });
  const listIn = sp(10, { damping: 16 });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card
        style={{
          left: 60,
          right: 60,
          top: 0,
          height: 560,
          transform: `translateY(${(1 - cardIn) * 50}px)`,
          opacity: cardIn,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 28, right: 36, fontSize: 30, fontWeight: 800, color: C.ink }}
        >
          התקציב
        </div>
        <div
          style={{ position: 'absolute', top: 32, left: 36, fontSize: 22, fontWeight: 600, color: C.muted }}
        >
          מתוך <span style={{ color: C.ink, fontWeight: 800 }}>{money(TOTAL)}</span>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          style={{ position: 'absolute', top: 60, left: (880 - w) / 2, overflow: 'visible' }}
        >
          <path
            d={gaugeArc(0, GAUGE_ZONES.safe, geo, rtl)}
            stroke={ZONE_TINT.safe}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={gaugeArc(GAUGE_ZONES.safe, GAUGE_ZONES.close, geo, rtl)}
            stroke={ZONE_TINT.close}
            strokeWidth={stroke}
            fill="none"
          />
          <path
            d={gaugeArc(GAUGE_ZONES.close, GAUGE_MAX, geo, rtl)}
            stroke={ZONE_TINT.over}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
          {value > 0.002 ? (
            <path
              d={gaugeArc(0, value, geo, rtl)}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
          {ticks.map((v, i) => (
            <line
              key={i}
              {...tick(v, r + stroke / 2 + 5, r + stroke / 2 + (i % 5 === 0 ? 18 : 11))}
              stroke={C.lineStrong}
              strokeWidth={i % 5 === 0 ? 2.5 : 1.6}
            />
          ))}
          {[0, 0.5, 1].map((v) => {
            const p = gaugePoint(v, { ...geo, r: r + stroke / 2 + 36 }, rtl);
            return (
              <text
                key={v}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={C.muted}
                fontSize={18}
                fontWeight={600}
                fontFamily="Heebo"
              >
                {`${Math.round(v * 100)}%`}
              </text>
            );
          })}
          {/* the plan: a ghost needle */}
          <line
            x1={geo.cx}
            y1={geo.cy}
            x2={ghostTip.x}
            y2={ghostTip.y}
            stroke={C.ink}
            strokeOpacity={0.22}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray="7 7"
          />
          <line
            x1={geo.cx}
            y1={geo.cy}
            x2={tip.x}
            y2={tip.y}
            stroke={C.ink}
            strokeWidth={6}
            strokeLinecap="round"
          />
          <circle cx={geo.cx} cy={geo.cy} r={15} fill={C.ink} />
          <circle cx={geo.cx} cy={geo.cy} r={6} fill="#fff" />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 60 + h + 6,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
              {Math.round(value * 100)}%
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: C.ink }}>נשארו {money(left)}</div>
          </div>
          <div
            style={{
              marginTop: 14,
              padding: '8px 22px',
              borderRadius: 999,
              background: ZONE_BG[zone],
              color,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {ZONE_TEXT[zone]}
          </div>
        </div>
      </Card>

      <Card
        style={{
          left: 60,
          right: 60,
          top: 596,
          height: 396,
          transform: `translateY(${(1 - listIn) * 60}px)`,
          opacity: listIn,
        }}
        radius={28}
      >
        <div
          style={{
            padding: '26px 36px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>המשימות</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.brandDeep }}>
            {TASKS.filter((t) => frame >= t.at + 6).length}/{TASKS.length} הושלמו
          </div>
        </div>
        {TASKS.map((t) => {
          const p = interpolate(frame, [t.at, t.at + 12], [0, 1], {
            ...clamp,
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div
              key={t.text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '0 36px',
                height: 74,
                borderTop: `1px solid ${C.subtle}`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: `2.5px solid ${p > 0 ? C.success : C.lineStrong}`,
                  background: p > 0 ? C.success : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${1 + 0.2 * Math.sin(p * Math.PI)})`,
                }}
              >
                <CheckIcon size={28} color="#fff" progress={p} />
              </div>
              <div
                style={{
                  position: 'relative',
                  fontSize: 28,
                  fontWeight: 600,
                  color: p > 0.5 ? C.muted : C.ink,
                }}
              >
                {t.text}
                <div
                  style={{
                    position: 'absolute',
                    top: '55%',
                    right: 0,
                    height: 2.5,
                    width: `${p * 100}%`,
                    background: C.muted,
                  }}
                />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
