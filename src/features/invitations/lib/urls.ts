/** An absolute https:// URL — the only kind of link a host may put on the invitation. */
export function isHttpsUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
