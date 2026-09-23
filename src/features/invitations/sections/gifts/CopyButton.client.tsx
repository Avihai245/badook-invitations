'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../../ui/Icon';

/**
 * The Clipboard API, or — where an in-app browser (WhatsApp, Instagram) withholds it — a selected
 * off-screen textarea and the copy command.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.readOnly = true;
    area.style.cssText = 'position:fixed;inset-block-start:0;opacity:0;font-size:16px';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length);
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

/** Copies a gift's details (bank account, Bit number…) — "Copied" for a moment after. */
export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={() => void copyText(text).then((ok) => ok && setCopied(true))}
    >
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
