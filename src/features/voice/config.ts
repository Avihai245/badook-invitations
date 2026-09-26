/**
 * The invitation read aloud (feature `voice`), isomorphic: which neural voice reads each language
 * (Azure AI Speech — one per language, chosen here), the audio format, and the limits of making it.
 * A language without a voice here has no audio; the guest's device may still read it (speechSynthesis).
 */
export const VOICE = {
  /** the Azure neural voice of each language the invitations can be in */
  voices: {
    he: 'he-IL-HilaNeural',
    en: 'en-US-JennyNeural',
    ru: 'ru-RU-SvetlanaNeural',
    ar: 'ar-SA-ZariyahNeural',
    fr: 'fr-FR-DeniseNeural',
    es: 'es-ES-ElviraNeural',
    am: 'am-ET-MekdesNeural',
  } as Readonly<Record<string, string>>,
  /** MP3, 24 kHz mono at 48 kbit/s: about 360 KB a minute */
  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  /** a little slower than the voice's default: an invitation, not the news */
  rate: '-4%',
  /** the text read (longer invitations are cut at a paragraph) */
  maxChars: 4_500,
  /** one request to the speech service */
  timeoutMs: 30_000,
  /** languages made per background run */
  perRun: 4,
  /** a failure is tried again after this (times the attempt), three attempts at most */
  retrySeconds: 600,
} as const;

/** The voice of a language (null: none configured). */
export const voiceFor = (locale: string): string | null => VOICE.voices[locale] ?? null;

/** The BCP 47 language of a voice ('he-IL-HilaNeural' → 'he-IL'). */
export const voiceLang = (voice: string): string => voice.split('-').slice(0, 2).join('-');
