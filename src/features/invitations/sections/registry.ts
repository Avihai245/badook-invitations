import type { ComponentType } from 'react';
import {
  CountdownSectionSchema,
  FaqSectionSchema,
  FooterSectionSchema,
  GallerySectionSchema,
  GiftsSectionSchema,
  HeroSectionSchema,
  RevealSectionSchema,
  RsvpSectionSchema,
  TextSectionSchema,
  TimelineSectionSchema,
  VenuesSectionSchema,
} from '../contracts/schemas';
import type { SectionOf, SectionType } from '../contracts/types';
import { CountdownView } from './countdown/CountdownView';
import { FaqView } from './faq/FaqView';
import { FooterView } from './footer/FooterView';
import { GiftsView } from './gifts/GiftsView';
import { HeroView } from './hero/HeroView';
import { GalleryView, RevealView } from './later/LaterViews';
import { RsvpView } from './rsvp/RsvpView';
import type { SectionViewProps } from './shared';
import { TextView } from './text/TextView';
import { TimelineView } from './timeline/TimelineView';
import { VenuesView } from './venues/VenuesView';

/**
 * Section registry (§5): one entry per section type. Adding a section type means adding an entry
 * here — the renderer never changes. `defaults` and the lazily-loaded `EditorForm` join in P2;
 * editor code must never be imported by the public renderer.
 */
export interface SectionDefinition<T extends SectionType> {
  type: T;
  schema: unknown;
  view: ComponentType<SectionViewProps<SectionOf<T>>>;
  /** section-level variants the view understands (template `sectionDefaults.variants`) */
  variants: readonly string[];
}

type Registry = { [T in SectionType]: SectionDefinition<T> };

export const SECTIONS: Registry = {
  hero: { type: 'hero', schema: HeroSectionSchema, view: HeroView, variants: [] },
  countdown: { type: 'countdown', schema: CountdownSectionSchema, view: CountdownView, variants: ['boxes'] },
  text: { type: 'text', schema: TextSectionSchema, view: TextView, variants: [] },
  venues: { type: 'venues', schema: VenuesSectionSchema, view: VenuesView, variants: ['stacked-with-map'] },
  timeline: {
    type: 'timeline',
    schema: TimelineSectionSchema,
    view: TimelineView,
    variants: ['horizontal-icons', 'vertical', 'flip-cards'],
  },
  faq: { type: 'faq', schema: FaqSectionSchema, view: FaqView, variants: [] },
  gallery: {
    type: 'gallery',
    schema: GallerySectionSchema,
    view: GalleryView,
    variants: ['carousel', 'grid'],
  },
  gifts: { type: 'gifts', schema: GiftsSectionSchema, view: GiftsView, variants: [] },
  reveal: {
    type: 'reveal',
    schema: RevealSectionSchema,
    view: RevealView,
    variants: ['scratch', 'tap', 'spin'],
  },
  rsvp: { type: 'rsvp', schema: RsvpSectionSchema, view: RsvpView, variants: [] },
  footer: { type: 'footer', schema: FooterSectionSchema, view: FooterView, variants: [] },
};
