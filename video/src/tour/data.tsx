import type { CSSProperties, ReactNode } from 'react';
import { C } from '../theme';
import type { PosterTheme } from '../ui';

/** The tour's one event, used by every scene. Whole shekels only. */
export const EVENT = {
  couple: 'אביחי & רותם',
  date: '30.11.2026',
  venue: 'גני הדר, רחובות',
  guests: 146,
  budget: 100_000,
  /** 3.10.2026 → 30.11.2026 */
  daysLeft: 58,
  /** people who said yes (the RSVP and check-in scenes) */
  coming: 115,
} as const;

export const money = (n: number) => `₪${Math.round(n).toLocaleString('en-US')}`;

/** Numbers, dates, links and money inside Hebrew text: isolated, left to right. */
export const Ltr = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <bdi style={{ direction: 'ltr', unicodeBidi: 'isolate', ...style }}>{children}</bdi>
);

/** The invitation "עצבו לי" makes from the couple's photos (warm, boho). */
export const AI_POSTER: PosterTheme = {
  bg: 'linear-gradient(170deg,#f5e6d3 0%,#e9b98a 55%,#c27c55 120%)',
  ink: '#3d2a1c',
  accent: '#8a4f2c',
  kicker: 'מתחתנים',
  names: EVENT.couple,
  date: EVENT.date,
  motif: 'petals',
};
export const AI_PALETTE = ['#f5e6d3', '#e9b98a', '#c27c55', '#8a4f2c', '#5c6b4a'];

/* ---------- small line icons (SVG; no emoji fonts in headless Chromium) ---------- */

type IconProps = { size?: number; color?: string };
const line = (size: number, color: string, children: ReactNode, sw = 2) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const CalendarIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <rect x={3.5} y={5} width={17} height={15.5} rx={3} />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>,
  );
export const UsersIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <circle cx={9} cy={8.5} r={3.5} />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 5.2a3.3 3.3 0 010 6.5M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
    </>,
  );
export const WalletIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <path d="M4 7.5h15a1.5 1.5 0 011.5 1.5v9.5a1.5 1.5 0 01-1.5 1.5H5a2 2 0 01-2-2V6.5A2 2 0 015 4.5h11" />
      <circle cx={16.5} cy={13.8} r={1.3} fill={color} />
    </>,
  );
export const SearchIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <circle cx={10.5} cy={10.5} r={6.5} />
      <path d="M15.5 15.5L20.5 20.5" />
    </>,
  );
export const ChatIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(size, color, <path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z" />);
export const BookIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
      <path d="M12 6.5v13" />
    </>,
  );
export const MailIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <rect x={3} y={5.5} width={18} height={13} rx={2.5} />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>,
  );
export const SendIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(size, color, <path d="M20.5 3.5L3.5 10.5l7 3 3 7zM10.5 13.5l10-10" />);
export const ClockIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 7.5V12l3 2" />
    </>,
  );
export const PinIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx={12} cy={10} r={2.3} />
    </>,
  );
export const ScanIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16" />,
  );
export const ListIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(size, color, <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />, 2.4);
export const FlagIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(size, color, <path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5" />);
export const HeartIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" />,
  );
export const ImageIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <rect x={3.5} y={4.5} width={17} height={15} rx={3} />
      <circle cx={9} cy={10} r={1.8} />
      <path d="M20.5 16l-5-5-8 8.5" />
    </>,
  );
export const FaceIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16" />
      <circle cx={12} cy={10.5} r={2.6} />
      <path d="M7.8 17c.8-2 2.3-3 4.2-3s3.4 1 4.2 3" />
    </>,
  );
export const HelpIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.7-2.4 2.1-2.4 3.6" />
      <path d="M12 17h.01" strokeWidth={2.8} />
    </>,
  );
export const CopyIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(
    size,
    color,
    <>
      <rect x={8.5} y={8.5} width={11.5} height={11.5} rx={2.5} />
      <path d="M15.5 8.5V6A2 2 0 0013.5 4H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5" />
    </>,
  );
export const PlusIcon = ({ size = 26, color = 'currentColor' }: IconProps) =>
  line(size, color, <path d="M12 5v14M5 12h14" />, 2.6);

/** A round icon badge. */
export function IconDot({
  children,
  size = 56,
  bg = C.brandSoft,
  style,
}: {
  children: ReactNode;
  size?: number;
  bg?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A section title inside a card. */
export const CardTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, ...style }}>{children}</div>
);
