/**
 * Marks <html data-framed> before the first paint when the invitation is shown inside another page
 * (FrameScrollCue.client.tsx; invitation.css hides the scrollbar). A plain module on purpose: a server
 * component that imported this string from the client module would pass the browser a reference to
 * load instead of the text, and the page could fail to hydrate while it loads.
 */
export const FRAMED_BOOT =
  "try{if(window.self!==window.top)document.documentElement.setAttribute('data-framed','')}catch(e){document.documentElement.setAttribute('data-framed','')}";
