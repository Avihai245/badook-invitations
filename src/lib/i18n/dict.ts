import { en } from './app.en';
import { he, type AppDict } from './app.he';
import type { UiLocale } from './app';

/** The host app's strings in a UI language — for the server and e-mails (the browser: provider.tsx). */
export const dictFor = (l: UiLocale): AppDict => (l === 'en' ? en : he);
