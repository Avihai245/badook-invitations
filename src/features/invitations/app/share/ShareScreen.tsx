'use client';

import { Copy, Download, ExternalLink, ListChecks, MessageCircle, PencilLine } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, Field, Input, Segmented, Textarea, useToast } from '@/components/app';
import { useUi } from '@/lib/i18n/client';
import { dirOf, type Locale } from '../../contracts/types';
import type { ShareData } from '../../server/share';

/**
 * The share screen (§7.7, §9B.3-F, app-share.png): the link + copy, the message (prefilled in the
 * invitation's default language, editable, per language when bilingual) → WhatsApp / copy, the
 * WhatsApp bubble as guests will see it (the real OG image), and the QR code with PNG/SVG downloads.
 */
export function ShareScreen({ id, slug, data }: { id: string; slug: string; data: ShareData }) {
  const { t } = useUi();
  const s = t.share;
  const { toast } = useToast();
  const [lang, setLang] = useState<Locale>(data.locales[0]!.locale);
  const [messages, setMessages] = useState<Partial<Record<Locale, string>>>(() =>
    Object.fromEntries(data.locales.map((l) => [l.locale, l.message])),
  );
  const current = data.locales.find((l) => l.locale === lang) ?? data.locales[0]!;
  const message = messages[lang] ?? current.message;
  const dir = dirOf(lang);

  const copy = (text: string, done: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast({ title: done, variant: 'success' }),
      () => toast({ title: s.copyFailed, variant: 'danger' }),
    );

  return (
    <div className="mx-auto max-w-[1000px] px-4 pt-8 pb-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-.01em]">{s.title}</h1>
          <p className="mt-1 text-muted">{s.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<PencilLine />} asChild>
            <Link href={`/app/invitations/${id}/edit`}>{s.edit}</Link>
          </Button>
          <Button variant="secondary" size="sm" icon={<ListChecks />} asChild>
            <Link href={`/app/invitations/${id}/responses`}>{t.responses.title}</Link>
          </Button>
          <Button variant="secondary" size="sm" icon={<ExternalLink className="icon-dir" />} asChild>
            <a href={data.url} target="_blank" rel="noreferrer">
              {s.open}
            </a>
          </Button>
        </div>
      </div>

      {data.unpublishedChanges ? (
        <p className="mt-4 rounded-card border border-[#fde68a] bg-warning-bg px-4 py-3 text-[13px] text-warning">
          {s.unpublishedChanges}
        </p>
      ) : null}

      <div className="mt-6 grid items-start gap-5 min-[900px]:grid-cols-[1.2fr_1fr]">
        <Card padding="lg" className="flex flex-col gap-5">
          <Field label={s.link}>
            <div className="flex gap-2">
              <Input
                readOnly
                value={data.url}
                dir="ltr"
                textAlign="start"
                onFocus={(e) => e.target.select()}
              />
              <Button variant="secondary" icon={<Copy />} onClick={() => void copy(data.url, s.linkCopied)}>
                {s.copyLink}
              </Button>
            </div>
          </Field>

          <Field
            label={s.message}
            labelAside={
              data.locales.length > 1 ? (
                <Segmented
                  label={s.messageLanguage}
                  value={lang}
                  onValueChange={setLang}
                  options={data.locales.map((l) => ({
                    value: l.locale,
                    label: l.locale === 'he' ? t.common.hebrew : t.common.english,
                  }))}
                />
              ) : null
            }
          >
            <Textarea
              rows={6}
              value={message}
              dir={dir}
              lang={lang}
              onChange={(e) => setMessages((m) => ({ ...m, [lang]: e.target.value }))}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button variant="whatsapp" size="lg" icon={<MessageCircle />} asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                {s.whatsapp}
              </a>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Copy />}
              onClick={() => void copy(message, s.messageCopied)}
            >
              {s.copyMessage}
            </Button>
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col gap-5">
          <section>
            <h2 className="mb-1.5 text-[13px] font-semibold">{s.preview}</h2>
            <WhatsAppBubble card={current.card} domain={data.domain} message={message} lang={lang} />
          </section>

          <section>
            <h2 className="mb-1.5 text-[13px] font-semibold">{s.qr}</h2>
            <div className="flex items-center gap-4">
              <div
                role="img"
                aria-label={s.qrLabel}
                className="size-40 shrink-0 overflow-hidden rounded-input border border-line bg-white p-1.5 [&>svg]:size-full"
                // generated on the server from the link (no user markup)
                dangerouslySetInnerHTML={{ __html: data.qr.svg }}
              />
              <div className="grid gap-2">
                <Button variant="secondary" size="sm" icon={<Download />} asChild>
                  <a href={data.qr.png} download={`${slug}-qr.png`} aria-label={s.downloadPng}>
                    PNG
                  </a>
                </Button>
                <Button variant="secondary" size="sm" icon={<Download />} asChild>
                  <a
                    href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.qr.svg)}`}
                    download={`${slug}-qr.svg`}
                    aria-label={s.downloadSvg}
                  >
                    SVG
                  </a>
                </Button>
              </div>
            </div>
          </section>
        </Card>
      </div>
    </div>
  );
}

/** WhatsApp's link preview (app.html `.wa-bubble`): the OG image, title, description and domain. */
function WhatsAppBubble({
  card,
  domain,
  message,
  lang,
}: {
  card: ShareData['locales'][number]['card'];
  domain: string;
  message: string;
  lang: Locale;
}) {
  const { t } = useUi();
  const dir = dirOf(lang);
  return (
    <div
      className="max-w-[320px] rounded-[10px] bg-[#E7FFDB] p-1.5 shadow-[0_1px_1px_rgba(0,0,0,.1)]"
      dir={dir}
      lang={lang}
    >
      <div className="overflow-hidden rounded-[8px] bg-[#F7F7F7]">
        <img
          src={card.image}
          alt={t.share.previewImage}
          width={1200}
          height={630}
          className="block aspect-[1.91] w-full bg-subtle object-cover"
        />
        <div className="px-2.5 py-2 text-[12px]">
          <div className="truncate font-semibold text-[#111]">{card.title}</div>
          <div className="line-clamp-2 text-[#667]">{card.description}</div>
          <div
            className={dir === 'rtl' ? 'text-right text-[11px] text-[#667]' : 'text-[11px] text-[#667]'}
            dir="ltr"
          >
            {domain}
          </div>
        </div>
      </div>
      <p className="px-1.5 pt-1.5 pb-0.5 text-[13px] leading-snug whitespace-pre-line break-words text-[#111]">
        {message}
      </p>
    </div>
  );
}
