/** Opens the support assistant from anywhere (the chat listens on window), optionally asking a question. */
export const SUPPORT_OPEN = 'support:open';

export interface SupportOpenDetail {
  question?: string;
  /** which of the help panel's tabs: the guide (with an article), the assistant (default) or the team */
  tab?: 'guide' | 'assistant' | 'contact';
  /** the guide's article to open (its slug); none: the guide's index, with this screen's articles first */
  article?: string;
}

export function openSupport(question?: string) {
  window.dispatchEvent(new CustomEvent<SupportOpenDetail>(SUPPORT_OPEN, { detail: { question } }));
}

/** Opens the help panel on its guide (an article, or the index for this screen), or on another tab. */
export function openHelp(detail: Omit<SupportOpenDetail, 'question'> = {}) {
  window.dispatchEvent(
    new CustomEvent<SupportOpenDetail>(SUPPORT_OPEN, { detail: { tab: 'guide', ...detail } }),
  );
}
