/** Opens the support assistant from anywhere (the chat listens on window), optionally asking a question. */
export const SUPPORT_OPEN = 'support:open';

export interface SupportOpenDetail {
  question?: string;
}

export function openSupport(question?: string) {
  window.dispatchEvent(new CustomEvent<SupportOpenDetail>(SUPPORT_OPEN, { detail: { question } }));
}
