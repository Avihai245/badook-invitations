/** Illustrations of the "not found" and "something went wrong" pages (decorative, 132×132). */

/** A letter that lost its way: an envelope with a "?" seal and a dotted trail. */
export function LostLetterArt() {
  return (
    <svg viewBox="0 0 132 132" fill="none">
      <circle cx="66" cy="66" r="58" fill="#F6EDE1" />
      <path
        d="M10 112c10-4 16-12 16-22s8-14 18-12"
        stroke="#D9BFA0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 6"
      />
      <g transform="rotate(-7 66 72)">
        <rect x="26" y="44" width="80" height="56" rx="10" fill="#fff" stroke="#EAD8C0" strokeWidth="2" />
        <path d="M28 48l38 29 38-29" stroke="#EAD8C0" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="66" cy="78" r="15" fill="#A0703F" />
        <circle cx="66" cy="78" r="11" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
        <path
          d="M61.6 73.4a4.6 4.6 0 0 1 8.9 1.5c0 3-4.5 3.6-4.5 6"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="66" cy="85.6" r="1.6" fill="#fff" />
      </g>
      <path d="M104 24l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" fill="#E7A977" />
      <path d="M20 36l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#A0703F" opacity=".6" />
    </svg>
  );
}

/** Something went wrong: an envelope whose seal cracked, a little spark of trouble beside it. */
export function BrokenSealArt() {
  return (
    <svg viewBox="0 0 132 132" fill="none">
      <circle cx="66" cy="66" r="58" fill="#F8EBE4" />
      <rect x="26" y="44" width="80" height="56" rx="10" fill="#fff" stroke="#EAD8C0" strokeWidth="2" />
      <path d="M28 48l38 29 38-29" stroke="#EAD8C0" strokeWidth="2" strokeLinejoin="round" />
      <path d="M52 78a14 14 0 0 1 14-14l-3 9 6 3-4 9 7-3 1 11a14 14 0 0 1-21-15z" fill="#B5523B" />
      <path d="M69 64a14 14 0 0 1 11 16l-8 4 2-6-5-3 3-7z" fill="#B5523B" opacity=".85" />
      <path
        d="M100 26l-6 12h7l-6 12"
        stroke="#E7A977"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#A0703F" opacity=".6" />
    </svg>
  );
}
