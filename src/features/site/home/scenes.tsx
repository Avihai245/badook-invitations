import { Check, CheckCheck, MessageCircle, Play as PlayIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { AppDict } from '@/lib/i18n/app';

/**
 * The home page's little animated scenes (styles and motion: src/styles/site-home.css). They are
 * decorative — the text beside each one says what it shows — so they are hidden from screen readers
 * by their container (Play) and stand still, complete, with reduced motion.
 */
export type SceneText = AppDict['site']['scenes'];

const num = (n: number) => ({ '--hx-n': n }) as CSSProperties;

// ── how it works ────────────────────────────────────────────────────────────────────────────────

/** Step 1: designs fan out and one is chosen. */
export function DesignFan({ posters, s }: { posters: ReactNode[]; s: SceneText }) {
  return (
    <div className="hx-fan">
      {posters.map((poster, i) => (
        <div key={i} className="hx-fan-card">
          {poster}
        </div>
      ))}
      <span className="hx-pill hx-fan-pick">
        <Check strokeWidth={3} />
        {s.chosen}
      </span>
    </div>
  );
}

/** Step 2: the details type themselves in and the invitation changes with them. */
export function DetailsTyping({ s }: { s: SceneText }) {
  return (
    <>
      <div className="hx-phone">
        <div className="hx-phone-screen">
          <span className="hx-eyebrow">SAVE · THE · DATE</span>
          <span className="hx-names">
            <span className="hx-type">{s.names}</span>
          </span>
          <span className="hx-small hx-fade-late">{s.date}</span>
          <span className="hx-small hx-fade-late">{s.place}</span>
        </div>
      </div>
      <div className="hx-form">
        <div className="hx-field">
          <span>{s.fields.names}</span>
          <b>
            <span className="hx-type">{s.names}</span>
            <i className="hx-caret" />
          </b>
        </div>
        <div className="hx-field">
          <span>{s.fields.date}</span>
          <b className="hx-fade-late">{s.date}</b>
        </div>
        <div className="hx-dots">
          <i />
          <i />
          <i />
        </div>
      </div>
      <span className="hx-pill hx-saved">
        <Check strokeWidth={3} />
        {s.saved}
      </span>
    </>
  );
}

/** Step 3: sent on WhatsApp; the replies come in and the count goes up. */
export function RepliesChat({ s }: { s: SceneText }) {
  return (
    <div className="hx-chat">
      <div className="hx-bubble out">
        <div className="hx-link">
          <i />
          <span>
            <b>{s.linkTitle}</b>
            <small>{s.linkSite}</small>
          </span>
        </div>
        {s.invite}
        <span className="hx-ticks">✓✓</span>
      </div>
      <div className="hx-bubble in r1">{s.replies[0]}</div>
      <div className="hx-bubble in r2">{s.replies[1]}</div>
      <span className="hx-pill hx-count">
        <Check strokeWidth={3} />
        <span className="hx-num" style={num(49)} />
        {s.confirmed}
      </span>
    </div>
  );
}

// ── everything an invitation needs (inside the spotlight phone) ─────────────────────────────────

export type FeatureKey = 'opening' | 'rsvp' | 'share' | 'video' | 'languages' | 'saveTheDate';

export function FeatureScene({ feature, s }: { feature: FeatureKey; s: SceneText }) {
  switch (feature) {
    case 'opening':
      return (
        <div className="hx-scene">
          <div className="hx-env">
            <div className="hx-env-back" />
            <div className="hx-env-card">{s.names}</div>
            <div className="hx-env-front" />
            <div className="hx-env-flap" />
            <span className="hx-seal" />
          </div>
          <span className="hx-note" style={{ top: '38%', insetInlineStart: '22%' }}>
            ♪
          </span>
          <span className="hx-note" style={{ top: '34%', insetInlineEnd: '20%', animationDelay: '0.5s' }}>
            ♫
          </span>
          <span className="hx-tap">{s.tap}</span>
        </div>
      );
    case 'rsvp':
      return (
        <div className="hx-scene">
          <div className="hx-scene-title" style={{ fontSize: 20 }}>
            {s.names}
          </div>
          <div className="hx-rsvp">
            <div className="hx-row">
              {s.coming}
              <span className="hx-switch" />
            </div>
            <div className="hx-row">
              {s.adults}
              <span className="hx-stepper">
                <i>−</i>
                <span className="hx-num" style={num(2)} />
                <i>+</i>
              </span>
            </div>
            <span className="hx-send">{s.send}</span>
          </div>
          <span className="hx-pill hx-sent">
            <Check strokeWidth={3} />
            {s.sentOk}
          </span>
        </div>
      );
    case 'share':
      return (
        <div className="hx-wa">
          <div className="hx-wa-bar">
            <i />
            {s.names}
          </div>
          <div className="hx-wa-body">
            <div className="hx-bubble out">
              <div className="hx-link">
                <i />
                <span>
                  <b>{s.linkTitle}</b>
                  <small>{s.linkSite}</small>
                </span>
              </div>
              {s.invite}
              <span className="hx-ticks">✓✓</span>
            </div>
          </div>
          <span className="hx-qr" title={s.qr}>
            <span />
          </span>
        </div>
      );
    case 'video':
      return (
        <div className="hx-scene" style={{ color: '#fff' }}>
          <div className="hx-video">
            <i />
            <i />
            <i />
          </div>
          <span className="hx-pill hx-video-badge">
            <PlayIcon fill="currentColor" />
            {s.video}
          </span>
          <div className="hx-scene-title hx-video-names">{s.names}</div>
          <div className="hx-video-names" style={{ fontSize: 13 }}>
            {s.date}
          </div>
        </div>
      );
    case 'languages':
      return (
        <div className="hx-scene">
          <div className="hx-lang hx-scene-title">
            <span>{s.names}</span>
            <span>{s.namesOther}</span>
          </div>
          <div className="hx-seg">
            <span>{s.languages[0]}</span>
            <span>{s.languages[1]}</span>
          </div>
        </div>
      );
    case 'saveTheDate':
      return (
        <div className="hx-scene">
          <div className="hx-cal">
            <div className="hx-cal-head">{s.month}</div>
            <div className="hx-cal-grid">
              {s.weekdays.map((d, i) => (
                <b key={i}>{d}</b>
              ))}
              {/* June 2027 starts on a Tuesday */}
              {Array.from({ length: 2 }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: 30 }, (_, i) =>
                i + 1 === 17 ? (
                  <span key={i} className="hx-day">
                    17
                    <svg viewBox="0 0 36 36">
                      <circle className="hx-ring" cx="18" cy="18" r="12.5" pathLength={80} />
                    </svg>
                  </span>
                ) : (
                  <span key={i}>{i + 1}</span>
                ),
              )}
            </div>
          </div>
          <div className="hx-std">{s.saveTheDate}</div>
        </div>
      );
  }
}

// ── from the invitation to the big day ──────────────────────────────────────────────────────────

export type MomentKey = 'guests' | 'personal' | 'whatsapp' | 'statuses' | 'assistant' | 'help';

export function MomentScene({ moment, s }: { moment: MomentKey; s: SceneText }) {
  switch (moment) {
    case 'guests':
      return (
        <>
          <div className="hx-sheet">
            <span className="h c1">{s.sheet.name}</span>
            <span className="h c2">{s.sheet.phone}</span>
            <span className="h">{s.sheet.email}</span>
            {s.sheetRows.map(([name, phone], r) =>
              [name, phone, ''].map((cell, c) => (
                <span key={`${r}-${c}`} className="r" style={{ '--r': r } as CSSProperties}>
                  {cell}
                </span>
              )),
            )}
          </div>
          <span className="hx-pill hx-found">
            <Check strokeWidth={3} />
            {s.detected}
          </span>
        </>
      );
    case 'personal':
      return (
        <div className="hx-hello">
          <div className="hx-scene-title">
            <span className="hx-type">{s.hello}</span>
          </div>
          <p>{s.helloBody}</p>
          <div className="hx-field">
            <b>
              {s.prefilled}
              <Check strokeWidth={3} />
            </b>
          </div>
        </div>
      );
    case 'whatsapp':
      return (
        <div className="hx-blast">
          <span className="hx-blast-src">
            <MessageCircle />
          </span>
          <span className="hx-avatar" />
          <span className="hx-avatar" />
          <span className="hx-avatar" />
          <span className="hx-avatar" />
          {[
            [250, -62],
            [210, -26],
            [250, 12],
            [205, 44],
          ].map(([dx, dy], k) => (
            <i key={k} className="hx-fly" style={{ '--k': k, '--dx': dx, '--dy': dy } as CSSProperties} />
          ))}
          <span className="hx-pill hx-blast-count">
            {s.sentTo}
            <span className="hx-num" style={num(124)} />
            {` ${s.guests}`}
          </span>
        </div>
      );
    case 'statuses':
      return (
        <div className="hx-status">
          <div className="hx-guest">
            <span className="hx-avatar" />
            {s.statusGuest}
            <span className="hx-checks">✓✓</span>
            <span className="hx-chips">
              {s.statuses.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </span>
          </div>
          <div className="hx-guest" style={{ opacity: 0.55 }}>
            <span className="hx-avatar" />
            {s.sheetRows[1]?.[0]}
            <span className="hx-chips">
              <span style={{ opacity: 1, animation: 'none', background: 'rgba(255,255,255,.12)' }}>
                {s.statuses[1]}
              </span>
            </span>
          </div>
        </div>
      );
    case 'assistant':
      return (
        <div className="hx-ask">
          <span className="q">{s.question}</span>
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <span className="a">
            {s.answer.map((line, i) => (
              <span key={line}>
                <b>{i + 1}.</b>
                {line}
              </span>
            ))}
          </span>
        </div>
      );
    case 'help':
      return (
        <div className="hx-help">
          <div className="hx-toolbar">
            {s.helpButtons.map((label) => (
              <span key={label}>{label}</span>
            ))}
            <span className="hx-q">?</span>
          </div>
          <span className="hx-tip">
            <CheckCheck
              aria-hidden
              style={{ display: 'inline', width: 14, height: 14, marginInlineEnd: 4, color: '#15803d' }}
            />
            {s.helpTip}
          </span>
        </div>
      );
  }
}
