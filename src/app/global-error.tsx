'use client';

import { useEffect, type CSSProperties } from 'react';

/**
 * The last resort, when a root layout itself fails (the site's or an invitation's): it replaces the
 * whole document, so it brings its own <html> and inline styles (no stylesheet is certain to have
 * loaded), and speaks Hebrew and English at once — it can't know which the visitor reads.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="he" dir="rtl">
      <head>
        <title>Badook</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={S.body}>
        <main style={S.card}>
          <svg
            viewBox="0 0 64 64"
            width="64"
            height="64"
            aria-hidden
            style={{ display: 'block', margin: '0 auto' }}
          >
            <circle cx="32" cy="32" r="30" fill="#F6EDE1" />
            <rect
              x="13"
              y="21"
              width="38"
              height="26"
              rx="5"
              fill="#fff"
              stroke="#EAD8C0"
              strokeWidth="1.6"
            />
            <path
              d="M14 23l18 13 18-13"
              fill="none"
              stroke="#EAD8C0"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="37" r="6.5" fill="#B5523B" />
          </svg>
          <h1 style={S.title}>משהו השתבש</h1>
          <p style={S.text}>זו תקלה אצלנו, לא אצלכם. נסו שוב בעוד רגע.</p>
          <div lang="en" dir="ltr" style={S.en}>
            <p style={{ ...S.title, fontSize: 20, margin: 0 }}>Something went wrong</p>
            <p style={S.text}>It’s on our side, not yours. Please try again in a moment.</p>
          </div>
          <div style={S.actions}>
            <button type="button" onClick={() => reset()} style={S.primary}>
              ניסיון חוזר · Try again
            </button>
            {/* a full page load on purpose: the app around this page has failed */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={S.secondary}>
              לדף הבית · Home
            </a>
          </div>
          {error.digest ? (
            <p dir="ltr" style={S.code}>
              {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

const S: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
    background: 'linear-gradient(120deg, #fbf4ea 0%, #f6ede1 100%)',
    color: '#1c1917',
    fontFamily: "Heebo, Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 460,
    boxSizing: 'border-box',
    background: '#fff',
    border: '1px solid #ead8c0',
    borderRadius: 24,
    padding: '32px 24px',
    textAlign: 'center',
    boxShadow: '0 30px 80px -40px rgba(60,35,15,0.55)',
  },
  title: { fontSize: 26, fontWeight: 700, margin: '16px 0 0', letterSpacing: '-0.01em' },
  text: { fontSize: 15, lineHeight: 1.6, color: '#78716c', margin: '8px 0 0' },
  en: { marginTop: 18, paddingTop: 16, borderTop: '1px solid #f5f5f4' },
  actions: { marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  primary: {
    height: 44,
    padding: '0 20px',
    border: 0,
    borderRadius: 10,
    background: '#1c1917',
    color: '#fff',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondary: {
    height: 44,
    padding: '0 20px',
    borderRadius: 10,
    border: '1px solid #e7e5e4',
    color: '#1c1917',
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 600,
    textDecoration: 'none',
  },
  code: { marginTop: 20, fontSize: 12, color: '#a8a29e' },
};
