import type { HelpArea } from '../app/HelpFor';
import type { PanelId } from './state/EditorProvider';

/** Each design and settings panel's "?" (what each of its controls does). */
export const PANEL_HELP: Record<PanelId, HelpArea> = {
  studio: 'studio',
  template: 'designTemplate',
  palette: 'designPalette',
  fonts: 'designFonts',
  style: 'designStyle',
  cover: 'designCover',
  music: 'designMusic',
  event: 'settingsEvent',
  languages: 'settingsLanguages',
  share: 'settingsShare',
};
