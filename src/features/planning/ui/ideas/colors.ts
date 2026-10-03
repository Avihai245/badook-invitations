import type { IdeaColor } from '../../model/categories';

/** A card's colors: design tokens only (a card is the surface by default). */
export const CARD_COLOR: Record<IdeaColor, string> = {
  default: 'bg-surface border-line',
  brand: 'bg-brand-soft border-brand-line',
  success: 'bg-success-bg border-success-line',
  warning: 'bg-warning-bg border-warning-line',
  info: 'bg-info-bg border-info-line',
};
