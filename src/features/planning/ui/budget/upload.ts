/** PUTs a file to a signed upload URL of the plan-files bucket (the files route made it). */
export async function putFile(url: string, file: Blob, type: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': type, 'x-upsert': 'false' },
      body: file,
    });
    return res.ok;
  } catch {
    return false;
  }
}
