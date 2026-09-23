/** Anywhere in the editor: open the publish dialog (EditorShell listens). */
export const OPEN_PUBLISH_EVENT = 'editor:open-publish';

export const openPublishDialog = () => window.dispatchEvent(new Event(OPEN_PUBLISH_EVENT));
