import 'server-only';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';

/**
 * The gallery's files in Supabase Storage: two private buckets, reached only through URLs the server
 * signs — upload URLs for one exact path each (no overwriting), and short-lived read URLs, made in
 * batches (one request per bucket, however many photos a page shows).
 */

export const BUCKETS = { originals: 'gallery-originals', media: 'gallery-media' } as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

export interface SignedUpload {
  path: string;
  token: string;
  /** PUT the file here */
  url: string;
}

export interface StoredFile {
  name: string;
  size: number | null;
  type: string | null;
}

export interface GalleryStorage {
  signUpload(bucket: Bucket, path: string): Promise<SignedUpload>;
  /** read URLs by path (paths it couldn't sign are missing) */
  signRead(bucket: Bucket, paths: string[], ttlSeconds: number): Promise<Map<string, string>>;
  /** the files in one item's folder */
  list(bucket: Bucket, folder: string): Promise<StoredFile[]>;
  download(bucket: Bucket, path: string): Promise<Uint8Array | null>;
  remove(bucket: Bucket, paths: string[]): Promise<void>;
  /** the resumable-upload (TUS) endpoint for signed uploads, and the key its requests carry */
  resumable(): { endpoint: string; apiKey: string };
}

export const galleryStorage: GalleryStorage = {
  async signUpload(bucket, path) {
    const { data, error } = await serviceDb().storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`signed upload: ${error?.message ?? 'no data'}`);
    return { path: data.path, token: data.token, url: data.signedUrl };
  },

  async signRead(bucket, paths, ttlSeconds) {
    const out = new Map<string, string>();
    const unique = [...new Set(paths.filter(Boolean))];
    for (let i = 0; i < unique.length; i += 500) {
      const batch = unique.slice(i, i + 500);
      const { data, error } = await serviceDb().storage.from(bucket).createSignedUrls(batch, ttlSeconds);
      if (error) throw new Error(`signed urls: ${error.message}`);
      for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) out.set(d.path, d.signedUrl);
    }
    return out;
  },

  async list(bucket, folder) {
    const { data, error } = await serviceDb().storage.from(bucket).list(folder, { limit: 100 });
    if (error) throw new Error(`storage list: ${error.message}`);
    return (data ?? [])
      .filter((f) => f.id !== null)
      .map((f) => {
        const meta = (f.metadata ?? {}) as { size?: unknown; mimetype?: unknown };
        return {
          name: f.name,
          size: typeof meta.size === 'number' ? meta.size : null,
          type: typeof meta.mimetype === 'string' ? meta.mimetype : null,
        };
      });
  },

  async download(bucket, path) {
    const { data, error } = await serviceDb().storage.from(bucket).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  },

  async remove(bucket, paths) {
    for (let i = 0; i < paths.length; i += 1000) {
      const { error } = await serviceDb()
        .storage.from(bucket)
        .remove(paths.slice(i, i + 1000));
      if (error) throw new Error(`storage remove: ${error.message}`);
    }
  },

  resumable() {
    const env = serverEnv();
    return {
      endpoint: `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/upload/resumable/sign`,
      apiKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };
  },
};
