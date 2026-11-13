/**
 * A URL as a CSS `url("…")` value. A host's https link may hold `"`, `\` or a line break (AssetRefSchema
 * only asks for https and no spaces): each is written as a CSS escape, so the value can never close the
 * string and carry on as more CSS (a style attribute or a custom property).
 */
export function cssUrl(url: string): string {
  return `url("${url.replace(/["\\\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}")`;
}
