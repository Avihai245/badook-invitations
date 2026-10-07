import 'server-only';
import { ask, type AiConfig, type Called } from '@/features/planning/server/ai';
import { WORDS_PROMPT, WORDS_SCHEMA, type WordsUnit } from './words';

/** The seating's AI (feature `seating_auto`): reads the host's wishes in words (words.ts). */
export interface SeatingAi {
  readWords(input: { text: string; units: WordsUnit[]; locale: 'he' | 'en' }): Promise<Called>;
}

const LANGUAGE = { he: 'Hebrew', en: 'English' } as const;

/** The seating's AI, or null when this deployment has none (the screen then doesn't offer it). */
export function seatingAi(config: AiConfig | null, fetchImpl: typeof fetch = fetch): SeatingAi | null {
  if (!config) return null;
  return {
    async readWords({ text, units, locale }) {
      const user = JSON.stringify({ language: LANGUAGE[locale], wishes: text, units });
      // a long list of units is a long prompt; the answer itself is short
      return ask(config, WORDS_PROMPT, user, WORDS_SCHEMA, 3_000, fetchImpl);
    },
  };
}
