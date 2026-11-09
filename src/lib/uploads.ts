import 'server-only';
import { randomUUID } from 'crypto';
import { supabase } from './db';

const BUCKET = 'uploads';
const URL_PREFIX = '/api/uploads/';
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Maintenance paperwork: delivery notes, manual dockets, contractor invoices. */
export const DOCUMENT_TYPES: Record<string, string> = { ...IMAGE_TYPES, 'application/pdf': '.pdf' };
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(DOCUMENT_TYPES).map(([type, ext]) => [ext, type])
);

/** Join path segments into a storage key, rejecting anything that could escape its folder. */
function safeKey(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((s) => !s || s === '.' || s === '..' || /[\\/]/.test(s))) return null;
  return segments.join('/');
}

export async function saveImage(folder: string[], bytes: Buffer, mimeType: string): Promise<string> {
  if (!IMAGE_TYPES[mimeType]) throw new Error('Unsupported image type');
  return saveFile(folder, bytes, mimeType);
}

export async function saveFile(folder: string[], bytes: Buffer, mimeType: string): Promise<string> {
  const ext = DOCUMENT_TYPES[mimeType];
  if (!ext) throw new Error('Unsupported file type');
  const name = `${randomUUID()}${ext}`;
  const key = safeKey([...folder, name]);
  if (!key) throw new Error('Invalid upload folder');
  const { error } = await supabase().storage.from(BUCKET).upload(key, bytes, { contentType: mimeType });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return URL_PREFIX + [...folder, name].map(encodeURIComponent).join('/');
}

/** Delete a file previously returned by saveImage/saveFile. Ignores URLs outside the upload area. */
export async function deleteImage(url: string): Promise<void> {
  if (!url.startsWith(URL_PREFIX)) return;
  const key = safeKey(url.slice(URL_PREFIX.length).split('/').map(decodeURIComponent));
  if (key) await supabase().storage.from(BUCKET).remove([key]);
}

export async function readUpload(segments: string[]): Promise<{ body: Buffer; type: string } | null> {
  const key = safeKey(segments);
  const ext = key?.slice(key.lastIndexOf('.')).toLowerCase();
  const type = ext ? EXT_TO_TYPE[ext] : undefined;
  if (!key || !type) return null;
  const { data, error } = await supabase().storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return { body: Buffer.from(await data.arrayBuffer()), type };
}
