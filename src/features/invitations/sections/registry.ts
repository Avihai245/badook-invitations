import type { ComponentType } from 'react';
import {
  CountdownSectionSchema,
  CustomSectionSchema,
  FaqSectionSchema,
  FooterSectionSchema,
  GallerySectionSchema,
  GiftsSectionSchema,
  HeroSectionSchema,
  ParentsSectionSchema,
  QuoteSectionSchema,
  RevealSectionSchema,
  RsvpSectionSchema,
  TextSectionSchema,
  TimelineSectionSchema,
  VenuesSectionSchema,
  WhenSectionSchema,
  WhereSectionSchema,
} from '../contracts/schemas';
import type { SectionOf, SectionType } from '../contracts/types';
import type { SectionViewProps } from './shared';
import { SECTION_VIEWS as V } from './views';

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
  hero: { type: 'hero', schema: HeroSectionSchema, view: V.hero, variants: [] },
  countdown: { type: 'countdown', schema: CountdownSectionSchema, view: V.countdown, variants: ['boxes'] },
  text: { type: 'text', schema: TextSectionSchema, view: V.text, variants: [] },
  venues: { type: 'venues', schema: VenuesSectionSchema, view: V.venues, variants: ['stacked-with-map'] },
  timeline: {
    type: 'timeline',
    schema: TimelineSectionSchema,
    view: V.timeline,
    variants: ['horizontal-icons', 'vertical', 'flip-cards'],
  },
  faq: { type: 'faq', schema: FaqSectionSchema, view: V.faq, variants: [] },
  gallery: {
    type: 'gallery',
    schema: GallerySectionSchema,
    view: V.gallery,
    variants: ['carousel', 'grid'],
  },
  gifts: { type: 'gifts', schema: GiftsSectionSchema, view: V.gifts, variants: [] },
  reveal: {
    type: 'reveal',
    schema: RevealSectionSchema,
    view: V.reveal,
    variants: ['scratch', 'tap', 'spin'],
  },
  rsvp: { type: 'rsvp', schema: RsvpSectionSchema, view: V.rsvp, variants: [] },
  footer: { type: 'footer', schema: FooterSectionSchema, view: V.footer, variants: [] },
  // schema v2
  parents: { type: 'parents', schema: ParentsSectionSchema, view: V.parents, variants: [] },
  when: { type: 'when', schema: WhenSectionSchema, view: V.when, variants: [] },
  where: { type: 'where', schema: WhereSectionSchema, view: V.where, variants: [] },
  quote: { type: 'quote', schema: QuoteSectionSchema, view: V.quote, variants: [] },
  custom: { type: 'custom', schema: CustomSectionSchema, view: V.custom, variants: [] },
};
