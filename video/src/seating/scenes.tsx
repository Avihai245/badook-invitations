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
import {
  AppButton,
  FAMILY_COLORS,
  FlagIcon,
  Floor,
  HallSketch,
  ImageUpIcon,
  PlusIcon,
  PrintIcon,
  SendIcon,
  Table,
  UploadIcon,
} from './parts';
import { beat } from './timing';

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

/** The map's toolbar, as the screen has it: "+ שולחן", "סימון", "תמונת האולם" (right to left). */
const TB = {
  table: { left: 806, width: 170 },
  mark: { left: 642, width: 150 },
  picture: { left: 398, width: 230 },
} as const;
const center = (b: { left: number; width: number }) => b.left + b.width / 2;

function MapToolbar({
  top,
  opacity = 1,
  press,
}: {
  top: number;
  opacity?: number;
  press?: { table?: number; picture?: number; pictureGlow?: number };
}) {
  return (
    <>
      <Card style={{ left: 0, right: 0, top, height: 92, opacity }} radius={22} />
      <div style={{ opacity }}>
        <AppButton
          variant="dark"
          icon={<PlusIcon size={26} color="#fff" />}
          pressed={press?.table}
          style={{ top: top + 14, left: TB.table.left, width: TB.table.width }}
        >
          שולחן
        </AppButton>
        <AppButton
          icon={<FlagIcon size={24} />}
          style={{ top: top + 14, left: TB.mark.left, width: TB.mark.width }}
        >
          סימון
        </AppButton>
        <AppButton
          icon={<ImageUpIcon size={26} color={C.brandDeep} />}
          pressed={press?.picture}
          glow={press?.pictureGlow}
          style={{ top: top + 14, left: TB.picture.left, width: TB.picture.width }}
        >
          תמונת האולם
        </AppButton>
      </div>
    </>
  );
}

/**
 * "מבקשים מהאולם תמונה של המפה ומעלים אותה, או בוחרים באפשרות 'תמונת האולם' ותראו מספר טמפלטים
 * מוכנים": the venue's picture asked for and uploaded — or the toolbar's "Hall picture", and the
 * ready-made halls it offers.
 */
export function HallScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const b1 = beat('hall', 2.88); // "מבקשים מהאולם…"
  const b2 = beat('hall', 6.12); // "או בוחרים באפשרות…"
  const ask = sp(b1);
  const reply = sp(b1 + 22, { damping: 14 });
  const uploaded = sp(b1 + 58, { damping: 14 });
  const or = sp(b2 - 8);
  const bar = sp(b2 - 4);
  const click = b2 + 18;
  const picker = sp(click + 8, { damping: 15 });
  const pick = b2 + 96;
  const chosen = sp(pick + 4, { damping: 12 });
  const cursorX = keyframes(
    frame,
    [
      [0, 760],
      [b2, 760],
      [click - 2, center(TB.picture)],
      [click + 30, center(TB.picture)],
      [pick - 2, cardLeft(0) + CARD_W / 2],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 960],
      [b2, 960],
      [click - 2, 516],
      [click + 30, 516],
      [pick - 2, 790],
    ],
    inOut,
  );
  const glow = interpolate(frame, [b2, b2 + 8, click, click + 10], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Card style={{ left: 0, right: 0, top: 0, height: 390, opacity: sp(0) }} radius={28}>
        <div style={{ position: 'absolute', top: 26, right: 32, ...heading }}>
          מבקשים מהאולם תמונה של המפה
        </div>
        <div
          style={{
            position: 'absolute',
            top: 88,
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
            top: 80,
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
            <HallSketch variant="classic" width={360} />
          </div>
        </div>
        <div style={{ position: 'absolute', top: 236, right: 32, opacity: uploaded }}>
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
            top: 314,
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
          top: 400,
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

      <MapToolbar top={470} opacity={bar} press={{ picture: pressAt(frame, click), pictureGlow: glow }} />

      <Card
        style={{
          left: 0,
          right: 0,
          top: 590,
          height: 410,
          opacity: picker,
          transform: `translateY(${(1 - picker) * 40}px)`,
        }}
        radius={28}
      >
        <div style={{ position: 'absolute', top: 24, right: 32, ...heading }}>מתחילים מאולם מוכן</div>
        <div
          style={{ position: 'absolute', top: 66, right: 32, fontSize: 21, fontWeight: 600, color: C.muted }}
        >
          במה, רחבה ושולחנות לפי מספר האורחים
        </div>
      </Card>
      {TEMPLATES.map((tpl, i) => {
        const inn = sp(click + 12 + i * 4);
        const sel = i === 0 ? chosen : 0;
        return (
          <div
            key={tpl.key}
            style={{
              position: 'absolute',
              left: cardLeft(i),
              top: 712,
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
          top: 940,
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
      <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, click, pick)} />
    </div>
  );
}

/* ------------------------------------------------------------------ 2. tables */

const SHAPES = [
  { name: 'עגול', seats: 10, x: 830, w: 130, h: 130, shape: 'round' as const, menu: 0 },
  { name: 'מרובע', seats: 8, x: 550, w: 130, h: 130, shape: 'square' as const, menu: 1 },
  { name: 'אבירים', seats: 16, x: 220, w: 300, h: 70, shape: 'knights' as const, menu: 3 },
];
/** "+ שולחן"'s menu, as the screen has it: each shape with what it seats. */
const MENU = [
  { name: 'עגול', hint: '10 מקומות (אפשר לשנות)' },
  { name: 'מרובע', hint: '8 מקומות — שניים בכל צד' },
  { name: 'מלבני', hint: '8 מקומות לאורך הצדדים' },
  { name: 'אבירים', hint: 'שולחן ארוך, 20 מקומות' },
];
const MENU_BOX = { left: 556, top: 104, width: 420, item: 72 };
const menuItemY = (i: number) => MENU_BOX.top + 12 + MENU_BOX.item / 2 + i * MENU_BOX.item;
const MENU_X = MENU_BOX.left + MENU_BOX.width / 2;
const TABLE_Y = 760;
const GUEST_COLORS = [
  FAMILY_COLORS[1],
  FAMILY_COLORS[1],
  FAMILY_COLORS[1],
  FAMILY_COLORS[2],
  FAMILY_COLORS[2],
  FAMILY_COLORS[4],
  FAMILY_COLORS[4],
  FAMILY_COLORS[4],
  FAMILY_COLORS[5],
  FAMILY_COLORS[5],
  FAMILY_COLORS[6],
  FAMILY_COLORS[6],
  FAMILY_COLORS[0],
  FAMILY_COLORS[0],
  FAMILY_COLORS[3],
  FAMILY_COLORS[3],
];

function ShapeGlyph({ shape }: { shape: 'round' | 'square' | 'rect' | 'knights' }) {
  const box = { round: [24, 24, 999], square: [22, 22, 4], rect: [32, 18, 4], knights: [36, 12, 3] }[shape];
  return (
    <div
      style={{
        width: box[0],
        height: box[1],
        borderRadius: box[2],
        border: `3px solid ${C.brandDeep}`,
        flexShrink: 0,
      }}
    />
  );
}

/**
 * "מוסיפים שולחנות: עגולים, מרובעים או אבירים, כל אורח עם הכיסא שלו": "+ שולחן" and its menu, a
 * table of each shape placed, then every chair taken by a guest.
 */
export function TablesScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const add = beat('tables', 11.26); // "מוסיפים שולחנות"
  const shapes = beat('tables', 12.73); // "עגולים, מרובעים או אבירים"
  const guests = beat('tables', 15.47); // "כל אורח עם הכיסא שלו"
  // three rounds of "+ שולחן" → a shape; the picks fall on the words
  const OPEN = [add + 2, shapes + 14, shapes + 40];
  const PICK = [shapes + 4, shapes + 30, shapes + 58];
  const SHAPE_FOR = [0, 1, 3];
  const menuOpen = OPEN.findIndex((o, i) => frame >= o + 2 && frame < PICK[i]! + 2);
  const menuIn =
    menuOpen >= 0 ? interpolate(frame, [OPEN[menuOpen]! + 2, OPEN[menuOpen]! + 8], [0, 1], clamp) : 0;
  const tb = center(TB.table);
  const pts: [number, number, number][] = [[0, 520, 520]];
  OPEN.forEach((o, i) => {
    pts.push(
      [o - 8, tb, 46],
      [o, tb, 46],
      [PICK[i]! - 4, MENU_X, menuItemY(SHAPE_FOR[i]!)],
      [PICK[i]!, MENU_X, menuItemY(SHAPE_FOR[i]!)],
    );
  });
  pts.push([PICK[2]! + 16, 520, 600]);
  const cursorX = keyframes(
    frame,
    pts.map(([t, x]) => [t, x]),
    inOut,
  );
  const cursorY = keyframes(
    frame,
    pts.map(([t, , y]) => [t, y]),
    inOut,
  );
  const cursorOut = interpolate(frame, [PICK[2]! + 18, PICK[2]! + 28], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Floor width={1000} height={880} style={{ top: 120, left: 0, opacity: sp(2) }} />
      <MapToolbar top={0} opacity={sp(0)} press={{ table: pressAt(frame, ...OPEN) }} />
      {SHAPES.map((s, i) => {
        const pop = sp(PICK[i]! + 3, { damping: 11, stiffness: 160 });
        const filled = Math.max(0, Math.min(s.seats, Math.floor((frame - guests - i * 4) * 0.6)));
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
              filled={filled}
              colors={GUEST_COLORS}
              highlight={
                interpolate(frame, [PICK[i]! + 3, PICK[i]! + 20], [1, 0], clamp) * (pop > 0.1 ? 1 : 0)
              }
            />
            <div
              style={{
                position: 'absolute',
                top: TABLE_Y + 130,
                left: s.x - 130,
                width: 260,
                textAlign: 'center',
                opacity: pop,
              }}
            >
              <Pill style={{ fontSize: 22 }}>
                {s.name} · {filled > 0 ? `${filled}/${s.seats}` : `${s.seats} מקומות`}
              </Pill>
            </div>
          </div>
        );
      })}
      {/* "+ שולחן"'s menu */}
      {menuIn > 0 ? (
        <Card
          style={{
            left: MENU_BOX.left,
            top: MENU_BOX.top,
            width: MENU_BOX.width,
            height: 24 + MENU.length * MENU_BOX.item,
            opacity: menuIn,
            transform: `translateY(${(1 - menuIn) * -10}px)`,
            boxShadow: SHADOW.lg,
            zIndex: 20,
          }}
          radius={18}
        >
          {MENU.map((m, i) => {
            const hot = SHAPE_FOR[menuOpen] === i && frame >= PICK[menuOpen]! - 6;
            return (
              <div
                key={m.name}
                style={{
                  position: 'absolute',
                  top: 12 + i * MENU_BOX.item,
                  left: 10,
                  right: 10,
                  height: MENU_BOX.item - 6,
                  borderRadius: 12,
                  background: hot ? C.brandSoft : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 18px',
                }}
              >
                <ShapeGlyph shape={(['round', 'square', 'rect', 'knights'] as const)[i]!} />
                <div style={{ lineHeight: 1.15 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.ink }}>{m.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: C.muted }}>{m.hint}</div>
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}
      <div style={{ opacity: cursorOut }}>
        <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, ...OPEN, ...PICK)} />
      </div>
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

const RULE_TEXT = 'סבתא ליד הבמה, החברים מהצבא ביחד, דוד משה לא עם דודה רחל';
const RULES = [
  { kind: 'ליד הבמה', who: 'סבתא רבקה', bg: C.brandSoft, color: C.brandDeep },
  { kind: 'ביחד', who: 'יוסי מהצבא ודני מהצבא (חובה)', bg: C.successBg, color: C.success },
  { kind: 'לא באותו שולחן', who: 'דוד משה ודודה רחל (חובה)', bg: C.dangerBg, color: C.danger },
];
const MINI = [
  { x: 150, y: 130 },
  { x: 850, y: 130 },
  { x: 150, y: 285 },
  { x: 850, y: 285 },
  { x: 390, y: 290 },
  { x: 610, y: 290 },
];
const FLOOR_TOP = 630;
const AUTO_BTN = { left: 676, width: 300 };
const READ_BTN = { left: 668, width: 300, top: 236 };
const ADD_BTN = { left: 808, width: 160, top: 498 };
const RUN_BTN = { left: 32, width: 180, top: 556 };

/**
 * "אופציה נוספת זה לתת למערכת שלנו לעזור: כותבים במילים מי יושב עם מי, מאשרים את הסידור, והמערכת
 * מושיבה את כולם": "סידור אוטומטי", its "ספרו במילים מי עם מי", the rules it understood (approved with
 * "להוסיף"), then "סידור" — and the tables fill.
 */
export function AutoScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const help = beat('auto', 21.81); // "אופציה נוספת…"
  const write = beat('auto', 25.06); // "כותבים במילים…"
  const approve = beat('auto', 27.45); // "מאשרים את הסידור, והמערכת מושיבה את כולם"
  const openAt = help + 46;
  const dialog = sp(openAt + 4, { damping: 16 });
  const chars = Array.from(RULE_TEXT);
  const typeFrom = write - 4;
  const typed = Math.max(0, Math.min(chars.length, Math.floor((frame - typeFrom) * (chars.length / 54))));
  const caret = Math.floor(frame / 8) % 2 === 0 && typed < chars.length && frame >= typeFrom;
  const readAt = write + 56;
  const addAt = approve + 8;
  const runAt = approve + 34;
  const understood = sp(readAt + 8, { damping: 15 });
  const added = sp(addAt + 4);
  const done = sp(runAt + 34, { damping: 13 });
  const headerOut = interpolate(frame, [openAt, openAt + 10], [1, 0], clamp);
  const cx = (b: { left: number; width: number }) => b.left + b.width / 2;
  const cursorX = keyframes(
    frame,
    [
      [0, 520],
      [help + 10, 520],
      [openAt - 2, cx(AUTO_BTN)],
      [openAt + 12, cx(AUTO_BTN)],
      [write, 760],
      [readAt - 2, cx(READ_BTN)],
      [readAt + 6, cx(READ_BTN)],
      [addAt - 2, cx(ADD_BTN)],
      [addAt + 6, cx(ADD_BTN)],
      [runAt - 2, cx(RUN_BTN)],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 520],
      [help + 10, 520],
      [openAt - 2, 36],
      [openAt + 12, 36],
      [write, 420],
      [readAt - 2, READ_BTN.top + 28],
      [readAt + 6, READ_BTN.top + 28],
      [addAt - 2, ADD_BTN.top + 26],
      [addAt + 6, ADD_BTN.top + 26],
      [runAt - 2, RUN_BTN.top + 28],
    ],
    inOut,
  );
  const cursorOut = interpolate(frame, [runAt + 12, runAt + 22], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Floor width={1000} height={1000 - FLOOR_TOP} style={{ left: 0, top: FLOOR_TOP, opacity: sp(2) }} />
      {MINI.map((m, i) => {
        const filled = Math.max(0, Math.min(8, Math.floor((frame - runAt - 6 - i * 3) * 0.55)));
        const colors = Array.from(
          { length: 8 },
          (_, k) => FAMILY_COLORS[(i + (k < 5 ? 0 : 3)) % FAMILY_COLORS.length],
        );
        return (
          <Table
            key={i}
            x={m.x}
            y={FLOOR_TOP + m.y}
            shape="round"
            seats={8}
            w={74}
            chairSize={20}
            filled={filled}
            colors={colors}
            pop={sp(4 + i * 2)}
          />
        );
      })}

      {/* the screen's header actions, before the dialog opens */}
      <div style={{ opacity: Math.min(sp(0), headerOut) }}>
        <AppButton
          variant="dark"
          icon={<SparkleIcon size={26} color="#fff" />}
          pressed={pressAt(frame, openAt)}
          glow={interpolate(frame, [help, help + 10, openAt, openAt + 6], [0, 1, 1, 0], clamp)}
          style={{ top: 4, left: AUTO_BTN.left, width: AUTO_BTN.width }}
        >
          סידור אוטומטי
        </AppButton>
        <AppButton icon={<PrintIcon size={24} />} style={{ top: 4, left: 492, width: 170 }}>
          הדפסה
        </AppButton>
      </div>

      {/* the dialog */}
      <Card
        style={{
          left: 0,
          right: 0,
          top: 0,
          height: 620,
          opacity: dialog,
          transform: `scale(${0.94 + 0.06 * dialog})`,
          transformOrigin: '80% 0',
          boxShadow: SHADOW.xl,
        }}
        radius={28}
      >
        <div
          style={{
            position: 'absolute',
            top: 22,
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
          style={{
            position: 'absolute',
            top: 74,
            left: 24,
            right: 24,
            height: 230,
            borderRadius: 18,
            border: `2px solid ${C.brandLine}`,
            background: 'rgba(246,237,225,0.45)',
          }}
        />
        <div
          style={{ position: 'absolute', top: 88, right: 44, fontSize: 23, fontWeight: 800, color: C.ink }}
        >
          ספרו במילים מי עם מי
        </div>
        <div
          style={{
            position: 'absolute',
            top: 128,
            left: 44,
            right: 44,
            height: 96,
            padding: '14px 18px',
            boxSizing: 'border-box',
            borderRadius: 14,
            background: '#fff',
            border: `2.5px solid ${frame >= typeFrom && frame < readAt ? C.brand : C.line}`,
            fontSize: 25,
            lineHeight: 1.45,
            fontWeight: 600,
            color: C.ink,
          }}
        >
          {chars.slice(0, typed).join('')}
          {caret ? <span style={{ color: C.brand }}>|</span> : null}
        </div>
        <AppButton
          icon={<SparkleIcon size={22} />}
          pressed={pressAt(frame, readAt)}
          style={{ top: READ_BTN.top, left: READ_BTN.left, width: READ_BTN.width, height: 56, fontSize: 22 }}
        >
          להבין את הכללים
        </AppButton>
        <div
          style={{
            position: 'absolute',
            top: 318,
            right: 32,
            fontSize: 22,
            fontWeight: 800,
            color: C.ink,
            opacity: understood,
          }}
        >
          הבנו 3 דברים. מה להוסיף?
        </div>
        {RULES.map((r, i) => {
          const inn = sp(readAt + 10 + i * 5, { damping: 14 });
          return (
            <div
              key={r.kind}
              style={{
                position: 'absolute',
                top: 356 + i * 46,
                right: 32,
                left: 32,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: inn,
                transform: `translateX(${(1 - inn) * -40}px)`,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: C.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckIcon size={20} color="#fff" />
              </div>
              <Pill bg={r.bg} color={r.color} style={{ fontSize: 20, padding: '6px 14px' }}>
                {r.kind}
              </Pill>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{r.who}</div>
            </div>
          );
        })}
        <div style={{ opacity: understood * (1 - added) }}>
          <AppButton
            variant="dark"
            pressed={pressAt(frame, addAt)}
            style={{ top: ADD_BTN.top, left: ADD_BTN.left, width: ADD_BTN.width, height: 52, fontSize: 22 }}
          >
            להוסיף 3
          </AppButton>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 510,
            right: 32,
            fontSize: 21,
            fontWeight: 700,
            color: C.success,
            opacity: added,
          }}
        >
          נוספו 3 כללים. עכשיו לוחצים "סידור"
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 540, height: 1.5, background: C.line }} />
        <AppButton
          variant="dark"
          icon={<SparkleIcon size={24} color="#fff" />}
          pressed={pressAt(frame, runAt)}
          glow={interpolate(frame, [addAt + 8, addAt + 14, runAt, runAt + 6], [0, 1, 1, 0], clamp)}
          style={{ top: RUN_BTN.top, left: RUN_BTN.left, width: RUN_BTN.width, height: 52, fontSize: 23 }}
        >
          סידור
        </AppButton>
      </Card>

      <div
        style={{
          position: 'absolute',
          top: FLOOR_TOP + 160,
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
          כל משפחה יושבת יחד · כל 3 הכללים נשמרו
        </Pill>
      </div>
      <div style={{ opacity: cursorOut }}>
        <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, openAt, readAt, addAt, runAt)} />
      </div>
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
const PRINT_BTN = { left: 30, width: 180 };
const SEND_BTN = { left: 560, width: 410 };

/**
 * "מדפיסים לאולם, ושולחים לכל אורח את מספר השולחן שלו בוואטסאפ": "הדפסה" (the map and the lists for
 * the hall), then "לשלוח לאורחים את השולחן" — and a guest's WhatsApp with their table.
 */
export function SendScene() {
  const frame = useCurrentFrame();
  const sp = useSpringAt();
  const say = beat('send', 31.21);
  const printAt = say + 4;
  const sendAt = say + 44;
  const sheet = sp(printAt + 6, { damping: 15 });
  const phone = sp(sendAt + 4, { damping: 16 });
  const msg = sp(sendAt + 16, { damping: 14 });
  const link = sp(sendAt + 40, { damping: 14 });
  const cursorX = keyframes(
    frame,
    [
      [0, 420],
      [printAt - 2, PRINT_BTN.left + PRINT_BTN.width / 2],
      [printAt + 14, PRINT_BTN.left + PRINT_BTN.width / 2],
      [sendAt - 2, SEND_BTN.left + SEND_BTN.width / 2],
    ],
    inOut,
  );
  const cursorY = keyframes(
    frame,
    [
      [0, 420],
      [printAt - 2, 36],
      [printAt + 14, 36],
      [sendAt - 2, 36],
    ],
    inOut,
  );
  const cursorOut = interpolate(frame, [sendAt + 20, sendAt + 30], [1, 0], clamp);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AppButton
        icon={<PrintIcon size={24} />}
        pressed={pressAt(frame, printAt)}
        style={{ top: 4, left: PRINT_BTN.left, width: PRINT_BTN.width, opacity: sp(0) }}
      >
        הדפסה
      </AppButton>
      <AppButton
        icon={<SendIcon size={24} />}
        pressed={pressAt(frame, sendAt)}
        glow={interpolate(frame, [sendAt - 14, sendAt - 6, sendAt, sendAt + 6], [0, 1, 1, 0], clamp)}
        style={{ top: 4, left: SEND_BTN.left, width: SEND_BTN.width, opacity: sp(2) }}
      >
        לשלוח לאורחים את השולחן
      </AppButton>
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 100,
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
                opacity: sp(printAt + 14 + i * 4),
              }}
            >
              <span style={{ fontWeight: 800, color: C.ink, width: 86 }}>{table}</span>
              <span style={{ color: C.muted, fontWeight: 600 }}>{who}</span>
            </div>
          ))}
        </div>
      </div>
      <Phone
        width={360}
        style={{ left: 600, top: 100, opacity: phone, transform: `translateY(${(1 - phone) * 40}px)` }}
      >
        <div
          style={{
            height: 116,
            background: C.waStrong,
            color: '#fff',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            padding: '0 22px 16px',
            fontSize: 23,
            fontWeight: 800,
          }}
        >
          <WhatsAppIcon size={26} />
          נועה ואיתי
        </div>
        <div
          style={{
            position: 'absolute',
            top: 146,
            right: 18,
            left: 36,
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
        <div style={{ position: 'absolute', top: 424, right: 18, opacity: link }}>
          <Pill bg={C.brandSoft} color={C.brandDeep} style={{ fontSize: 20 }}>
            איפה השולחן באולם ›
          </Pill>
        </div>
      </Phone>
      <div style={{ opacity: cursorOut }}>
        <Cursor x={cursorX} y={cursorY} pressed={pressAt(frame, printAt, sendAt)} />
      </div>
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
        <Pill bg={C.successBg} color={C.success} style={{ fontSize: 22 }}>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: C.success, opacity: blink }} />
          בזמן אמת
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
          <div style={{ fontSize: 24, fontWeight: 700, color: C.muted }}>אנשים הגיעו</div>
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
