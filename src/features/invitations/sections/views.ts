import type { ComponentType } from 'react';
import type { SectionOf, SectionType } from '../contracts/types';
import { CountdownView } from './countdown/CountdownView';
import { FaqView } from './faq/FaqView';
import { FooterView } from './footer/FooterView';
import { GiftsView } from './gifts/GiftsView';
import { HeroView } from './hero/HeroView';
import { GalleryView } from './gallery/GalleryView';
import { RsvpView } from './rsvp/RsvpView';
import { RevealView } from './reveal/RevealView';
import type { SectionViewProps } from './shared';
import { TextView } from './text/TextView';
import { TimelineView } from './timeline/TimelineView';
import { VenuesView } from './venues/VenuesView';

/**
 * The view of each section type — the renderer's half of the registry, without the Zod schemas, so
 * the browser-side renderer (live language switch, editor preview) doesn't carry them.
 */
export const SECTION_VIEWS: { [T in SectionType]: ComponentType<SectionViewProps<SectionOf<T>>> } = {
  hero: HeroView,
  countdown: CountdownView,
  text: TextView,
  venues: VenuesView,
  timeline: TimelineView,
  faq: FaqView,
  gallery: GalleryView,
  gifts: GiftsView,
  reveal: RevealView,
  rsvp: RsvpView,
  footer: FooterView,
};
