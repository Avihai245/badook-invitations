import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, SHADOW } from '../theme';
import {
  Avatar,
  Card,
  CheckIcon,
  clamp,
  Cursor,
  DoubleCheck,
  keyframes,
  Phone,
  Pill,
  SparkleIcon,
  useSpringAt,
  WhatsAppIcon,
} from '../ui';
import { FAMILY_COLORS, Floor, HallSketch, PrintIcon, Table, UploadIcon } from './parts';

const inOut = Easing.inOut(Easing.cubic);

/** A click's ring: 0→1 over the ten frames after `at`, else 0. */
const pressAt = (frame: number, ...at: number[]) => {
  for (const a of at) if (frame >= a && frame < a + 10) return interpolate(frame, [a, a + 10], [0, 1]);
  return 0;
};

const heading = { fontSize: 28, fontWeight: 800, color: C.ink } as const;

/* ------------------------------------------------------------------ 1. the hall */

const TEMPLATES = [
  { key: 'classic', name: 'אולם קלאסי' },
  { key: 'wide', name: 'אולם רחב' },
  { key: 'garden', name: 'גן אירועים' },
  { key: 'banquet', name: 'שולחנות אבירים' },
] as const;
const CARD_W = 215;
const cardLeft = (i: number) => 40 + (3 - i) * (CARD_W + 20);

/** Ask the venue for a picture of the hall and upload it — or pick a ready-made hall. */
export function HallScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const ask = sp(6);
  const reply = sp(24, { damping: 14 });
  const uploaded = sp(50, { damping: 14 });
  const or = sp(62);
  const picker = sp(66);
  const chosen = sp(100, { damping: 12 });
  const cursorX = keyframes(
    frame,
    [
      [0, 760],
      [70, 760],
      [92, cardLeft(0) + CARD_W / 2],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 980],
      [70, 980],
      [92, 700],
    ],
    inOut,
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card style={{ left: 0, right: 0, top: 0, height: 430, opacity: sp(0) }} radius={28}>
        <div style={{ position: 'absolute', top: 26, right: 32, ...heading }}>
          מבקשים מהאולם תמונה של המפה
        </div>
        <div
          style={{
            position: 'absolute',
            top: 92,
            right: 32,
            maxWidth: 440,
            padding: '16px 22px',
            borderRadius: '22px 22px 6px 22px',
            background: C.waSoft,
            color: C.waInk,
            fontSize: 26,
            fontWeight: 600,
            opacity: ask,
            transform: `translateY(${(1 - ask) * 20}px)`,
          }}
        >
          היי, אפשר תמונה של מפת האולם?
        </div>
        <div
          style={{
            position: 'absolute',
            top: 90,
            left: 36,
            padding: 12,
            borderRadius: '22px 22px 22px 6px',
            background: C.subtle,
            opacity: reply,
            transform: `scale(${0.85 + 0.15 * reply}) rotate(${(1 - reply) * -4}deg)`,
            boxShadow: `0 0 0 ${uploaded * 5}px ${C.brand}`,
          }}
        >
          <div style={{ filter: 'sepia(0.25) contrast(0.95)', borderRadius: 10, overflow: 'hidden' }}>
            <HallSketch variant="classic" width={400} />
          </div>
        </div>
        <div style={{ position: 'absolute', top: 250, right: 32, opacity: uploaded }}>
          <Pill
            bg={C.brand}
            color="#fff"
            style={{ fontSize: 24, padding: '12px 22px', transform: `scale(${0.8 + 0.2 * uploaded})` }}
          >
            <UploadIcon size={26} color="#fff" />
            מעלים כרקע למפה
          </Pill>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 330,
            right: 32,
            fontSize: 21,
            color: C.muted,
            fontWeight: 600,
            opacity: uploaded,
          }}
        >
          תמונה, צילום מסך או PDF — כל מה שהאולם שולח
        </div>
      </Card>

      <div
        style={{
          position: 'absolute',
          top: 446,
          left: '50%',
          marginLeft: -36,
          width: 72,
          height: 56,
          borderRadius: 999,
          background: C.ink,
          color: '#fff',
          fontSize: 26,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: or,
          transform: `scale(${0.6 + 0.4 * or})`,
        }}
      >
        או
      </div>

      <Card
        style={{
          left: 0,
          right: 0,
          top: 520,
          height: 360,
          opacity: picker,
          transform: `translateY(${(1 - picker) * 40}px)`,
        }}
        radius={28}
      >
        <div style={{ position: 'absolute', top: 24, right: 32, ...heading }}>בוחרים אולם מוכן</div>
      </Card>
      {TEMPLATES.map((tpl, i) => {
        const inn = sp(70 + i * 4);
        const sel = i === 0 ? chosen : 0;
        return (
          <div
            key={tpl.key}
            style={{
              position: 'absolute',
              left: cardLeft(i),
              top: 600,
              width: CARD_W,
              padding: 10,
              boxSizing: 'border-box',
              borderRadius: 18,
              background: C.surface,
              boxShadow: `${SHADOW.sm}, 0 0 0 ${2 + sel * 3}px ${sel > 0.05 ? C.brand : C.line}`,
              opacity: inn,
              transform: `translateY(${(1 - inn) * 30}px) scale(${1 + sel * 0.05})`,
            }}
          >
            <HallSketch variant={tpl.key} width={CARD_W - 20} />
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800, color: C.ink }}>{tpl.name}</div>
            {sel > 0.05 ? (
              <div
                style={{
                  position: 'absolute',
                  top: -14,
                  left: -14,
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: C.success,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${sel})`,
                }}
              >
                <CheckIcon size={26} color="#fff" />
              </div>
            ) : null}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: 900,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 24,
          fontWeight: 700,
          color: C.brandDeep,
          opacity: chosen,
        }}
      >
        השולחנות כבר במקום, לפי מספר האורחים
      </div>
      <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, 92)} />
    </div>
  );
}

/* ------------------------------------------------------------------ 2. tables */

const SHAPES = [
  { name: 'עגול', seats: 10, x: 830, w: 130, h: 130, shape: 'round' as const },
  { name: 'מרובע', seats: 8, x: 550, w: 130, h: 130, shape: 'square' as const },
  { name: 'אבירים', seats: 16, x: 220, w: 300, h: 70, shape: 'knights' as const },
];
const BTN_W = 190;
const btnCenter = (i: number) => 1000 - 30 - BTN_W / 2 - i * (BTN_W + 16);
const TABLE_Y = 720;

function ShapeIcon({ shape, active }: { shape: 'round' | 'square' | 'knights'; active: boolean }) {
  const color = active ? '#fff' : C.brandDeep;
  const box = { round: [30, 30, 999], square: [28, 28, 5], knights: [44, 16, 4] }[shape];
  return (
    <div style={{ width: box[0], height: box[1], borderRadius: box[2], border: `3.5px solid ${color}` }} />
  );
}

/** Round, square or knights — each table comes with its chairs. */
export function TablesScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const PICK = [14, 52, 90];
  const DROP = [32, 70, 108];
  const active = frame < PICK[1] ? 0 : frame < PICK[2] ? 1 : 2;
  const cursorX = keyframes(
    frame,
    [
      [0, 520],
      [12, btnCenter(0)],
      [16, btnCenter(0)],
      [30, SHAPES[0].x],
      [36, SHAPES[0].x],
      [50, btnCenter(1)],
      [54, btnCenter(1)],
      [68, SHAPES[1].x],
      [74, SHAPES[1].x],
      [88, btnCenter(2)],
      [92, btnCenter(2)],
      [106, SHAPES[2].x],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 500],
      [12, 55],
      [16, 55],
      [30, TABLE_Y],
      [36, TABLE_Y],
      [50, 55],
      [54, 55],
      [68, TABLE_Y],
      [74, TABLE_Y],
      [88, 55],
      [92, 55],
      [106, TABLE_Y],
    ],
    inOut,
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card style={{ left: 0, right: 0, top: 0, height: 110, opacity: sp(0) }} radius={24}>
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            fontSize: 22,
            fontWeight: 600,
            color: C.muted,
          }}
        >
          בוחרים צורה ומניחים
        </div>
      </Card>
      {SHAPES.map((s, i) => {
        const on = i === active && frame >= PICK[0];
        return (
          <div
            key={s.name}
            style={{
              position: 'absolute',
              top: 20,
              left: btnCenter(i) - BTN_W / 2,
              width: BTN_W,
              height: 70,
              borderRadius: 16,
              background: on ? C.brandDeep : C.brandSoft,
              color: on ? '#fff' : C.brandDeep,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              fontSize: 27,
              fontWeight: 800,
              opacity: sp(4 + i * 3),
            }}
          >
            <ShapeIcon shape={s.shape} active={on} />
            {s.name}
          </div>
        );
      })}
      <Floor width={1000} height={860} style={{ top: 140, left: 0, opacity: sp(2) }} />
      {SHAPES.map((s, i) => {
        const pop = sp(DROP[i] + 2, { damping: 11, stiffness: 160 });
        return (
          <div key={s.name}>
            <Table
              x={s.x}
              y={TABLE_Y}
              shape={s.shape}
              seats={s.seats}
              w={s.w}
              h={s.h}
              pop={pop}
              highlight={interpolate(frame, [DROP[i] + 2, DROP[i] + 20], [1, 0], clamp) * (pop > 0.1 ? 1 : 0)}
            />
            <div
              style={{
                position: 'absolute',
                top: TABLE_Y + 130,
                left: s.x - 120,
                width: 240,
                textAlign: 'center',
                opacity: pop,
              }}
            >
              <Pill style={{ fontSize: 22 }}>
                {s.name} · {s.seats} מקומות
              </Pill>
            </div>
          </div>
        );
      })}
      <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, ...PICK, ...DROP)} />
    </div>
  );
}

/* ------------------------------------------------------------------ 3. families */

const FAMILIES = [
  { name: 'משפחת כהן', n: 4, color: FAMILY_COLORS[1] },
  { name: 'משפחת לוי', n: 3, color: FAMILY_COLORS[2] },
  { name: 'החברים מהצבא', n: 6, color: FAMILY_COLORS[4] },
  { name: 'השכנים', n: 2, color: FAMILY_COLORS[5] },
];
const FAM_TABLES = [
  { x: 165, y: 560, base: [FAMILY_COLORS[0], FAMILY_COLORS[0], FAMILY_COLORS[0]] },
  { x: 445, y: 560, base: [FAMILY_COLORS[3], FAMILY_COLORS[3], FAMILY_COLORS[3], FAMILY_COLORS[3]] },
  { x: 305, y: 830, base: [FAMILY_COLORS[6], FAMILY_COLORS[6]] },
];
const rowY = (i: number) => 150 + i * 118;
const ROW_X = 820;

function FamilyChip({ family, lifted = 0 }: { family: (typeof FAMILIES)[number]; lifted?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 18px',
        borderRadius: 18,
        background: C.surface,
        boxShadow: lifted > 0 ? '0 18px 34px rgba(28,25,23,0.25)' : `0 0 0 2px ${C.line}`,
        width: 320,
        boxSizing: 'border-box',
        transform: `scale(${1 + lifted * 0.05}) rotate(${lifted * -2}deg)`,
      }}
    >
      <div style={{ display: 'flex' }}>
        {Array.from({ length: Math.min(family.n, 3) }, (_, k) => (
          <Avatar
            key={k}
            label=""
            color={family.color}
            size={40}
            style={{ border: '3px solid #fff', marginInlineStart: k ? -14 : 0 }}
          />
        ))}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 25, fontWeight: 800, color: C.ink }}>{family.name}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: C.muted }}>{family.n} אורחים</div>
      </div>
    </div>
  );
}

/** A whole family dragged to a table — they all sit together. */
export function FamiliesScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const drag = (from: number, to: number) =>
    interpolate(frame, [from, to], [0, 1], { ...clamp, easing: inOut });
  const moves = [
    { fam: 0, table: 0, p: drag(22, 54) },
    { fam: 1, table: 1, p: drag(74, 104) },
  ];
  const seatedAt = (ti: number) => {
    const base = FAM_TABLES[ti].base;
    const m = moves.find((x) => x.table === ti);
    if (!m || m.p < 0.98) return { filled: base.length, colors: base };
    const start = m.table === 0 ? 54 : 104;
    const fam = FAMILIES[m.fam];
    const shown = Math.min(fam.n, Math.floor((frame - start) / 2) + 1);
    return { filled: base.length + shown, colors: [...base, ...Array(fam.n).fill(fam.color)] };
  };
  const cursorX = keyframes(
    frame,
    [
      [0, 520],
      [18, ROW_X],
      [22, ROW_X],
      [54, FAM_TABLES[0].x],
      [60, FAM_TABLES[0].x],
      [70, ROW_X],
      [74, ROW_X],
      [104, FAM_TABLES[1].x],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 900],
      [18, rowY(0)],
      [22, rowY(0)],
      [54, FAM_TABLES[0].y],
      [60, FAM_TABLES[0].y],
      [70, rowY(0)],
      [74, rowY(0)],
      [104, FAM_TABLES[1].y],
    ],
    inOut,
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Floor
        width={610}
        height={1000}
        style={{ left: 0, top: 0, opacity: sp(0) }}
        stage={{ x: 0.22, y: 0.03, w: 0.56, h: 0.1 }}
        dance={{ x: 0.26, y: 0.17, w: 0.48, h: 0.18 }}
      />
      {FAM_TABLES.map((t, ti) => {
        const { filled, colors } = seatedAt(ti);
        return (
          <Table
            key={ti}
            x={t.x}
            y={t.y}
            shape="round"
            seats={10}
            w={130}
            filled={filled}
            colors={colors}
            pop={sp(4 + ti * 3)}
            label={`${filled}/10`}
            highlight={moves.some((m) => m.table === ti && m.p > 0.6 && m.p < 0.98) ? 1 : 0}
          />
        );
      })}
      <Card style={{ left: 640, right: 0, top: 0, bottom: 0, opacity: sp(2) }} radius={28}>
        <div style={{ position: 'absolute', top: 28, right: 24, ...heading }}>ממתינים לשיבוץ</div>
      </Card>
      {FAMILIES.map((fam, i) => {
        const m = moves.find((x) => x.fam === i);
        const p = m?.p ?? 0;
        // the rows below a seated family move up into its place
        const shift = moves
          .filter((x) => x.fam < i)
          .reduce((sum, x) => sum + sp(x.table === 0 ? 58 : 108, { damping: 16 }) * 118, 0);
        const y0 = rowY(i) - shift;
        const left = m ? interpolate(p, [0, 1], [ROW_X, FAM_TABLES[m.table].x]) : ROW_X;
        const top = m ? interpolate(p, [0, 1], [y0, FAM_TABLES[m.table].y]) : y0;
        const moving = p > 0.01 && p < 0.98;
        return (
          <div key={fam.name}>
            {/* the row stays as a faint slot while its family moves */}
            {moving || p >= 0.98 ? (
              <div
                style={{
                  position: 'absolute',
                  left: ROW_X - 160,
                  top: y0 - 42,
                  width: 320,
                  height: 84,
                  borderRadius: 18,
                  border: `2.5px dashed ${C.lineStrong}`,
                  boxSizing: 'border-box',
                  opacity: 1 - interpolate(p, [0.98, 1], [0, 1], clamp),
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: left - 160,
                top: top - 42,
                zIndex: moving ? 30 : 2,
                opacity: (p >= 0.98 ? 0 : 1) * sp(6 + i * 3),
              }}
            >
              <FamilyChip family={fam} lifted={moving ? Math.sin(p * Math.PI) : 0} />
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: 660,
          left: 660,
          right: 20,
          fontSize: 22,
          fontWeight: 600,
          color: C.muted,
          lineHeight: 1.35,
          opacity: sp(10),
        }}
      >
        כל משפחה נגררת יחד, ולא אחד־אחד
      </div>
      <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, 18, 54, 70, 104)} />
    </div>
  );
}

/* ------------------------------------------------------------------ 4. auto */

const RULE_TEXT = 'סבתא ליד הבמה, החברים מהצבא ביחד, ודוד משה לא באותו שולחן עם דודה רחל';
const RULES = [
  { kind: 'ליד הבמה', who: 'סבתא רבקה', bg: C.brandSoft, color: C.brandDeep },
  { kind: 'ביחד', who: 'החברים מהצבא (6)', bg: C.successBg, color: C.success },
  { kind: 'לא באותו שולחן', who: 'דוד משה · דודה רחל', bg: C.dangerBg, color: C.danger },
];
const MINI = [
  { x: 150, y: 150 },
  { x: 850, y: 150 },
  { x: 150, y: 320 },
  { x: 850, y: 320 },
  { x: 390, y: 325 },
  { x: 610, y: 325 },
];

/** Rules in words → rules to confirm → everyone seated. */
export function AutoScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const chars = Array.from(RULE_TEXT);
  const typed = Math.max(0, Math.min(chars.length, Math.floor((frame - 8) * 1.4)));
  const caret = Math.floor(frame / 8) % 2 === 0 && typed < chars.length;
  const go = 94;
  const cursorX = keyframes(
    frame,
    [
      [0, 700],
      [80, 700],
      [go, 830],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 260],
      [80, 400],
      [go, 505],
    ],
    inOut,
  );
  const done = sp(130, { damping: 13 });
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card style={{ left: 0, right: 0, top: 0, height: 560, opacity: sp(0) }} radius={28}>
        <div
          style={{
            position: 'absolute',
            top: 26,
            right: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            ...heading,
          }}
        >
          <SparkleIcon size={30} color={C.brand} />
          סידור אוטומטי
        </div>
        <div
          style={{ position: 'absolute', top: 80, right: 32, fontSize: 22, fontWeight: 600, color: C.muted }}
        >
          ספרו במילים מי עם מי
        </div>
        <div
          style={{
            position: 'absolute',
            top: 120,
            left: 32,
            right: 32,
            height: 120,
            padding: '16px 20px',
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `2.5px solid ${frame < 70 ? C.brand : C.line}`,
            fontSize: 26,
            lineHeight: 1.45,
            fontWeight: 600,
            color: C.ink,
          }}
        >
          {chars.slice(0, typed).join('')}
          {caret ? <span style={{ color: C.brand }}>|</span> : null}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 262,
            right: 32,
            fontSize: 22,
            fontWeight: 700,
            color: C.ink,
            opacity: sp(64),
          }}
        >
          הבנו 3 כללים — מאשרים?
        </div>
        {RULES.map((r, i) => {
          const inn = sp(66 + i * 6, { damping: 14 });
          return (
            <div
              key={r.kind}
              style={{
                position: 'absolute',
                top: 304 + i * 58,
                right: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: inn,
                transform: `translateX(${(1 - inn) * -40}px)`,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: C.success,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckIcon
                  size={22}
                  color="#fff"
                  progress={interpolate(frame, [72 + i * 6, 82 + i * 6], [0, 1], clamp)}
                />
              </div>
              <Pill bg={r.bg} color={r.color} style={{ fontSize: 22 }}>
                {r.kind}
              </Pill>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>{r.who}</div>
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            top: 470,
            left: 32,
            height: 66,
            padding: '0 30px',
            borderRadius: 16,
            background: `linear-gradient(90deg, ${C.brandDeep}, ${C.brand})`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 26,
            fontWeight: 800,
            opacity: sp(84),
            transform: `scale(${1 - 0.07 * Math.sin(pressAt(frame, go) * Math.PI)})`,
            boxShadow: '0 12px 26px rgba(122,82,48,0.3)',
          }}
        >
          <SparkleIcon size={26} color="#fff" />
          להושיב את כולם
        </div>
      </Card>
      <Floor width={1000} height={410} style={{ left: 0, top: 590, opacity: sp(4) }} />
      {MINI.map((m, i) => {
        const filled = Math.max(0, Math.min(8, Math.floor((frame - go - 4 - i * 3) * 0.55)));
        const colors = Array.from(
          { length: 8 },
          (_, k) => FAMILY_COLORS[(i + (k < 5 ? 0 : 3)) % FAMILY_COLORS.length],
        );
        return (
          <Table
            key={i}
            x={m.x}
            y={590 + m.y}
            shape="round"
            seats={8}
            w={74}
            chairSize={20}
            filled={filled}
            colors={colors}
            pop={sp(8 + i * 2)}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: 590 + 200,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: done,
          transform: `scale(${0.8 + 0.2 * done})`,
        }}
      >
        <Pill
          bg={C.success}
          color="#fff"
          style={{ fontSize: 24, padding: '14px 26px', boxShadow: SHADOW.lg }}
        >
          <CheckIcon size={26} color="#fff" />
          כל המשפחות יחד · 3 כללים נשמרו
        </Pill>
      </div>
      <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, go)} />
    </div>
  );
}

/* ------------------------------------------------------------------ 5. print and send */

const SHEET = [
  ['שולחן 1', 'משפחת כהן · משפחת אברהם'],
  ['שולחן 2', 'משפחת לוי · השכנים'],
  ['שולחן 3', 'החברים מהצבא'],
  ['שולחן 4', 'החברים מהעבודה'],
  ['שולחן 5', 'משפחת מזרחי'],
];

/** The printed map for the hall — and every guest gets their table number. */
export function SendScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const sheet = sp(6, { damping: 15 });
  const send = 46;
  const msg = sp(send + 10, { damping: 14 });
  const link = sp(send + 26, { damping: 14 });
  const cursorX = keyframes(
    frame,
    [
      [0, 300],
      [send - 12, 300],
      [send, 260],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 500],
      [send - 12, 800],
      [send, 905],
    ],
    inOut,
  );
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 30, top: 0, opacity: sp(0) }}>
        <Pill bg={C.ink} color="#fff" style={{ fontSize: 24, padding: '12px 22px' }}>
          <PrintIcon size={26} color="#fff" />
          הדפסה לאולם
        </Pill>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 90,
          width: 470,
          height: 740,
          background: '#fff',
          borderRadius: 10,
          boxShadow: SHADOW.lg,
          padding: 28,
          boxSizing: 'border-box',
          transform: `translateY(${(1 - sheet) * -60}px) rotate(${-2.5 * sheet}deg)`,
          opacity: sheet,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, color: C.ink }}>סידור הושבה</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.muted, marginBottom: 14 }}>
          החתונה של נועה ואיתי
        </div>
        <HallSketch variant="classic" width={414} />
        <div style={{ marginTop: 16 }}>
          {SHEET.map(([table, who], i) => (
            <div
              key={table}
              style={{
                display: 'flex',
                gap: 12,
                padding: '9px 0',
                borderBottom: `1.5px solid ${C.line}`,
                fontSize: 20,
                opacity: sp(14 + i * 4),
              }}
            >
              <span style={{ fontWeight: 800, color: C.ink, width: 86 }}>{table}</span>
              <span style={{ color: C.muted, fontWeight: 600 }}>{who}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 870,
          height: 72,
          width: 470,
          borderRadius: 18,
          background: C.waStrong,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: 25,
          fontWeight: 800,
          opacity: sp(30),
          transform: `scale(${1 - 0.06 * Math.sin(pressAt(frame, send) * Math.PI)})`,
        }}
      >
        <WhatsAppIcon size={30} />
        שולחים לכל אורח את השולחן שלו
      </div>
      <Phone width={380} style={{ left: 580, top: 90, opacity: sp(2) }}>
        <div
          style={{
            height: 120,
            background: C.waStrong,
            color: '#fff',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '0 22px 16px',
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          נועה ואיתי
        </div>
        <div
          style={{
            position: 'absolute',
            top: 150,
            right: 18,
            left: 40,
            background: '#fff',
            borderRadius: '18px 4px 18px 18px',
            padding: '16px 18px',
            boxShadow: SHADOW.sm,
            opacity: msg,
            transform: `translateY(${(1 - msg) * 30}px)`,
          }}
        >
          <div style={{ fontSize: 21, color: C.ink, fontWeight: 600, lineHeight: 1.4 }}>
            שלום דנה, מחכים לכם הערב!
          </div>
          <div style={{ fontSize: 21, color: C.muted, fontWeight: 600, marginTop: 6 }}>השולחן שלכם:</div>
          <div style={{ fontSize: 96, fontWeight: 800, color: C.brandDeep, lineHeight: 1 }}>7</div>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
            <DoubleCheck size={20} color="#34b7f1" />
          </div>
        </div>
        <div style={{ position: 'absolute', top: 430, right: 18, opacity: link }}>
          <Pill bg={C.brandSoft} color={C.brandDeep} style={{ fontSize: 20 }}>
            איפה השולחן באולם ›
          </Pill>
        </div>
      </Phone>
      <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, send)} />
    </div>
  );
}

/* ------------------------------------------------------------------ 6. live on the day */

const LIVE = [
  { x: 130, y: 160, seats: 10, final: 10, rate: 1.3 },
  { x: 870, y: 160, seats: 10, final: 9, rate: 1.0 },
  { x: 130, y: 420, seats: 10, final: 8, rate: 0.8 },
  { x: 870, y: 420, seats: 10, final: 10, rate: 1.1 },
  { x: 320, y: 500, seats: 10, final: 6, rate: 0.6 },
  { x: 500, y: 400, seats: 12, final: 12, rate: 1.4 },
  { x: 680, y: 500, seats: 10, final: 7, rate: 0.7 },
];
const LIVE_TOTAL = LIVE.reduce((s, t) => s + t.seats, 0);

/** On the day: who has arrived, live — by the hall and by table. */
export function LiveScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const arrived = (i: number) =>
    Math.max(0, Math.min(LIVE[i].final, Math.floor(Math.max(0, frame - 12 - i * 4) * LIVE[i].rate * 0.1)));
  const total = LIVE.reduce((s, _, i) => s + arrived(i), 0);
  const blink = 0.45 + 0.55 * Math.abs(Math.sin(frame / 7));
  const toast = interpolate(frame, [64, 74, 110, 120], [0, 1, 1, 0], clamp);
  const rows = [0, 5, 3, 4];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Floor width={1000} height={620} style={{ left: 0, top: 0, opacity: sp(0) }} />
      <div style={{ position: 'absolute', left: 26, top: 22, opacity: sp(2) }}>
        <Pill bg={C.dangerBg} color={C.danger} style={{ fontSize: 22 }}>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: C.danger, opacity: blink }} />
          בלייב
        </Pill>
      </div>
      {LIVE.map((t, i) => {
        const a = arrived(i);
        return (
          <Table
            key={i}
            x={t.x}
            y={t.y}
            shape="round"
            seats={t.seats}
            w={92}
            chairSize={20}
            filled={a}
            colors={Array(t.seats).fill('#22a35a')}
            pop={sp(3 + i * 2)}
            ring={a / t.seats}
            label={`${a}/${t.seats}`}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: 552,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: toast,
          transform: `translateY(${(1 - toast) * 20}px)`,
        }}
      >
        <Pill bg={C.ink} color="#fff" style={{ fontSize: 22, padding: '10px 22px', boxShadow: SHADOW.lg }}>
          משפחת כהן הגיעה · שולחן 1
        </Pill>
      </div>
      <Card style={{ left: 0, top: 650, width: 360, height: 350, opacity: sp(8) }} radius={26}>
        <div style={{ position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.muted }}>נכנסו לאולם</div>
          <div style={{ fontSize: 96, fontWeight: 800, color: C.ink, lineHeight: 1.05, direction: 'ltr' }}>
            {total}
            <span style={{ fontSize: 40, color: C.faint }}> / {LIVE_TOTAL}</span>
          </div>
          <div
            style={{
              margin: '18px 40px 0',
              height: 14,
              borderRadius: 99,
              background: C.subtle,
              overflow: 'hidden',
              direction: 'rtl',
            }}
          >
            <div
              style={{
                width: `${(total / LIVE_TOTAL) * 100}%`,
                height: '100%',
                background: C.success,
                borderRadius: 99,
              }}
            />
          </div>
        </div>
      </Card>
      <Card style={{ left: 390, right: 0, top: 650, height: 350, opacity: sp(12) }} radius={26}>
        <div style={{ position: 'absolute', top: 24, right: 28, ...heading, fontSize: 26 }}>לפי שולחן</div>
        {rows.map((ti, r) => {
          const a = arrived(ti);
          const full = a >= LIVE[ti].seats;
          return (
            <div
              key={ti}
              style={{
                position: 'absolute',
                top: 84 + r * 64,
                left: 28,
                right: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: 23,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 100, color: C.ink }}>שולחן {ti + 1}</span>
              <div
                style={{ flex: 1, height: 12, borderRadius: 99, background: C.subtle, overflow: 'hidden' }}
              >
                <div
                  style={{
                    width: `${(a / LIVE[ti].seats) * 100}%`,
                    height: '100%',
                    borderRadius: 99,
                    background: full ? C.success : '#22a35a',
                  }}
                />
              </div>
              <span
                style={{ width: 70, color: full ? C.success : C.muted, direction: 'ltr', textAlign: 'end' }}
              >
                {a}/{LIVE[ti].seats}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
