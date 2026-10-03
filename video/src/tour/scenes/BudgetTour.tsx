import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { zoneOf } from '../../../../src/features/planning/model/gauge';
import { BudgetGauge, gaugeHeight, ZONE_BG, ZONE_COLOR, ZONE_TEXT } from '../../scenes/Budget';
import { C } from '../../theme';
import { Card, clamp, keyframes, useSpringAt } from '../../ui';
import { useSegment } from '../context';
import { EVENT, Ltr, money, PlusIcon, UsersIcon } from '../data';

const EXPENSES = [
  { label: 'אולם', amount: 42_000, paid: 10_000 },
  { label: 'קייטרינג', amount: 18_500, paid: 0 },
  { label: 'צלם', amount: 7_200, paid: 2_000 },
];
const PER_GUEST = 250;
const WHAT_IF = 220;

/**
 * The budget gauge through its three zones as the voice names them (green, amber, red), then real
 * expenses and payments, and a what-if on the number of guests.
 */
export function BudgetTourScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const { spoken } = useSegment();
  const inOut = Easing.inOut(Easing.cubic);

  const tGreen = spoken('ירוק', -10);
  const tAmber = spoken('צהוב', -8);
  const tRed = spoken('אדום', -8);
  const tAdd = spoken('מוסיפים הוצאות', -4);
  const tWhatIf = spoken('ובודקים', -4);

  const rowAt = (i: number) => tAdd + 4 + i * 9;
  const committed = EXPENSES.reduce(
    (s, e, i) => s + e.amount * interpolate(frame, [rowAt(i), rowAt(i) + 8], [0, 1], clamp),
    0,
  );
  const paid = EXPENSES.reduce(
    (s, e, i) => s + e.paid * interpolate(frame, [rowAt(i) + 6, rowAt(i) + 14], [0, 1], clamp),
    0,
  );
  const guests = Math.round(
    keyframes(
      frame,
      [
        [tWhatIf + 8, EVENT.guests],
        [tWhatIf + 30, WHAT_IF],
      ],
      inOut,
    ),
  );
  const extra = (guests - EVENT.guests) * PER_GUEST;

  // the demo of the zones, then the real numbers
  const demo = keyframes(
    frame,
    [
      [4, 0],
      [tGreen + 12, 0.55],
      [tAmber, 0.55],
      [tAmber + 14, 0.92],
      [tRed, 0.92],
      [tRed + 14, 1.12],
      [tAdd - 4, 1.12],
      [tAdd + 6, 0],
    ],
    inOut,
  );
  const real = (committed + extra) / EVENT.budget;
  const value = frame < tAdd + 6 ? demo : real;
  const zone = zoneOf(value);
  const color = ZONE_COLOR[zone];
  const used = value * EVENT.budget;
  const left = EVENT.budget - used;

  const cardIn = sp(0, { damping: 16 });
  const listIn = sp(tAdd - 6, { damping: 16 });
  const ifIn = sp(tWhatIf - 2, { damping: 16 });
  const w = 560;
  const h = gaugeHeight(600, 36) * (w / 600);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card
        style={{
          left: 40,
          right: 40,
          top: 0,
          height: 540,
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
          מתוך <Ltr style={{ color: C.ink, fontWeight: 800 }}>{money(EVENT.budget)}</Ltr>
        </div>
        <BudgetGauge
          value={value}
          ghost={0.82}
          displayWidth={w}
          style={{ position: 'absolute', top: 66, left: (920 - w) / 2 }}
        />
        <div
          style={{
            position: 'absolute',
            top: 66 + h + 8,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <Ltr style={{ fontSize: 60, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
              {Math.round(value * 100)}%
            </Ltr>
            <div style={{ fontSize: 26, fontWeight: 600, color: C.ink }}>
              {left >= 0 ? 'נשארו' : 'חריגה של'} <Ltr>{money(Math.abs(Math.round(left / 100) * 100))}</Ltr>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
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

      {/* expenses and payments */}
      <Card
        style={{
          right: 40,
          top: 570,
          width: 500,
          height: 410,
          opacity: listIn,
          transform: `translateY(${(1 - listIn) * 50}px)`,
        }}
        radius={28}
      >
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 28,
            left: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 800, color: C.ink }}>הוצאות ותשלומים</div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: C.brand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlusIcon size={26} color="#fff" />
          </div>
        </div>
        {EXPENSES.map((e, i) => {
          const p = sp(rowAt(i), { damping: 15 });
          const paidP = interpolate(frame, [rowAt(i) + 6, rowAt(i) + 14], [0, 1], clamp);
          return (
            <div
              key={e.label}
              style={{
                position: 'absolute',
                top: 84 + i * 88,
                right: 28,
                left: 28,
                height: 82,
                borderTop: `1px solid ${C.subtle}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: p,
                transform: `translateX(${(1 - p) * 50}px)`,
              }}
            >
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.ink }}>{e.label}</div>
                <div style={{ fontSize: 19, fontWeight: 600, color: e.paid ? C.success : C.muted }}>
                  {e.paid ? (
                    <>
                      שולם <Ltr>{money(e.paid * paidP)}</Ltr>
                    </>
                  ) : (
                    'טרם שולם'
                  )}
                </div>
              </div>
              <Ltr style={{ marginInlineStart: 'auto', fontSize: 28, fontWeight: 800, color: C.brandDeep }}>
                {money(e.amount)}
              </Ltr>
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            right: 28,
            left: 28,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 21,
            fontWeight: 700,
            color: C.muted,
          }}
        >
          <span>
            התחייבתם ל־<Ltr style={{ color: C.ink }}>{money(committed)}</Ltr>
          </span>
          <span>
            שולם <Ltr style={{ color: C.success }}>{money(paid)}</Ltr>
          </span>
        </div>
      </Card>

      {/* what if */}
      <Card
        style={{
          left: 40,
          top: 570,
          width: 360,
          height: 410,
          opacity: ifIn,
          transform: `translateY(${(1 - ifIn) * 50}px)`,
          background: C.brandSoft,
        }}
        radius={28}
      >
        <div
          style={{ position: 'absolute', top: 24, right: 28, fontSize: 28, fontWeight: 800, color: C.ink }}
        >
          מה אם…?
        </div>
        <div
          style={{
            position: 'absolute',
            top: 80,
            right: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 22,
            fontWeight: 700,
            color: C.brandDeep,
          }}
        >
          <UsersIcon size={26} color={C.brand} />
          מספר האורחים
        </div>
        <div style={{ position: 'absolute', top: 124, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{guests}</div>
        </div>
        {/* slider (RTL: grows to the left) */}
        <div
          style={{
            position: 'absolute',
            top: 228,
            right: 36,
            left: 36,
            height: 10,
            borderRadius: 99,
            background: '#fff',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: `${((guests - 100) / 140) * 100}%`,
              background: C.brand,
              borderRadius: 99,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -13,
              right: `calc(${((guests - 100) / 140) * 100}% - 18px)`,
              width: 36,
              height: 36,
              borderRadius: 99,
              background: '#fff',
              border: `4px solid ${C.brand}`,
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            right: 24,
            left: 24,
            padding: '14px 16px',
            borderRadius: 18,
            background: '#fff',
            fontSize: 21,
            fontWeight: 700,
            color: C.ink,
            textAlign: 'center',
            lineHeight: 1.35,
            opacity: interpolate(frame, [tWhatIf + 10, tWhatIf + 18], [0, 1], clamp),
          }}
        >
          עוד <Ltr>{guests - EVENT.guests}</Ltr> אורחים:{' '}
          <Ltr style={{ color: C.warning, fontWeight: 800 }}>+{money(extra)}</Ltr>
          <br />
          <span style={{ color, fontWeight: 800 }}>{ZONE_TEXT[zone]}</span>
        </div>
      </Card>
    </div>
  );
}
