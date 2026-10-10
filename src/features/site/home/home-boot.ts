/**
 * The home page is one static page per language, so what the middleware used to decide per request is
 * decided here, in <head>, before the first paint:
 *  - a signed-in host (Supabase's session cookie, `sb-<project>-auth-token`) goes to their invitations —
 *    the page there checks the session itself and sends a stale one to sign-in;
 *  - a visitor who chose the other language (the `ui_lang` cookie, set by the language switch) goes to
 *    that language's address.
 */
export const homeBoot = (locale: 'he' | 'en') =>
  `try{var c=document.cookie;if(/(?:^|; )sb-[^=;]*-auth-token/.test(c))location.replace('/app/invitations');else{var m=/(?:^|; )ui_lang=([^;]*)/.exec(c);if(m&&m[1]!=='${locale}'&&(m[1]==='he'||m[1]==='en'))location.replace(m[1]==='en'?'/en':'/')}}catch(e){}`;
