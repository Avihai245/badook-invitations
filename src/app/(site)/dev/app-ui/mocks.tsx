import type { Copy } from './copy';

/** Static stand-in for the invitation hero inside the PhoneFrame (the real editor embeds an iframe). */
export function InvitationMock({ mock, lang }: { mock: Copy['editor']['mock']; lang: 'he' | 'en' }) {
  return (
    <div
      lang={lang}
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      className="relative flex size-full flex-col items-center justify-center text-center text-white"
      style={{ background: 'linear-gradient(180deg,#F8DCC4,#EFA995 45%,#9A5C6B 78%,#5E2F40)' }}
    >
      <svg
        aria-hidden
        viewBox="0 0 390 300"
        className="absolute inset-x-0 bottom-0 h-[300px] w-full"
        preserveAspectRatio="none"
      >
        <path d="M0 120 C70 80 140 90 200 115 S320 95 390 110 V300 H0Z" fill="#7E4452" opacity=".55" />
        <path d="M0 175 C90 140 170 150 240 170 S340 160 390 168 V300 H0Z" fill="#6A3445" opacity=".7" />
        <path d="M0 230 C110 205 250 210 390 225 V300 H0Z" fill="#5A2A3A" />
      </svg>
      <div className="relative -mt-20 px-8">
        <p className="text-[15px] font-light opacity-90">{mock.eyebrow}</p>
        <p className="mt-6 text-[64px] leading-[1.02] font-light">{mock.name1}</p>
        <p className="my-1 text-[26px] font-light opacity-90">{mock.amp}</p>
        <p className="text-[64px] leading-[1.02] font-light">{mock.name2}</p>
        <div className="mx-auto mt-6 h-px w-24 bg-white/50" />
        <p className="mt-5 text-[14px] opacity-90">{mock.date}</p>
        <p className="mt-1 text-[12px] opacity-80">{mock.hebrewDate}</p>
        <p className="mt-2 text-[14px] opacity-90">{mock.place}</p>
      </div>
    </div>
  );
}

/** 120px empty-state illustration: envelope + heart, drawn in the app neutrals. */
export function EnvelopeIllustration() {
  return (
    <svg viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="56" fill="#F5F5F4" />
      <rect x="25" y="42" width="70" height="46" rx="7" fill="#fff" stroke="#D6D3D1" strokeWidth="1.5" />
      <path
        d="M28 46.5 60 68l32-21.5"
        stroke="#D6D3D1"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M60 36.5s-9.5-5.3-9.5-11.2c0-3.2 2.5-5.3 5.2-5.3 1.9 0 3.4 1 4.3 2.6.9-1.6 2.4-2.6 4.3-2.6 2.7 0 5.2 2.1 5.2 5.3 0 5.9-9.5 11.2-9.5 11.2Z"
        fill="#1C1917"
      />
      <circle cx="90" cy="30" r="3" fill="#D6D3D1" />
      <circle cx="28" cy="96" r="2" fill="#D6D3D1" />
    </svg>
  );
}

/** WhatsApp link-preview bubble (app.html `.wa-bubble`), sample only. */
export function WhatsAppBubble({ copy }: { copy: Copy['share'] }) {
  return (
    <div className="mt-3 max-w-[320px] rounded-[10px] bg-[#E7FFDB] p-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
      <div className="overflow-hidden rounded-lg bg-[#F7F7F7]">
        <div
          className="grid aspect-[1.91] place-items-center text-center text-white"
          style={{ background: 'linear-gradient(180deg,#F8DCC4,#EFA995 50%,#9A5C6B)' }}
        >
          <div>
            <b className="block text-[26px] font-light">{copy.waNames}</b>
            <span className="text-[12px]">{copy.waLine}</span>
          </div>
        </div>
        <div className="px-2.5 py-2 text-[12px]">
          <div className="font-semibold">{copy.waTitle}</div>
          <div className="text-[#667]">{copy.waDescription}</div>
          <div dir="ltr" className="text-[11px] text-[#667] [:dir(rtl)>&:dir(ltr)]:text-end">
            {copy.waDomain}
          </div>
        </div>
      </div>
    </div>
  );
}

/** QR placeholder (app.html `.qr`). */
export function QrPlaceholder({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative grid aspect-square w-40 place-items-center rounded-input border border-line"
      style={{ background: 'repeating-conic-gradient(#1C1917 0 25%, #fff 0 50%) 0 0/20px 20px' }}
    >
      <span className="absolute inset-[34%] grid place-items-center rounded-lg bg-white text-[14px] font-bold text-ink">
        QR
      </span>
    </div>
  );
}
