import 'server-only';
import { mkdirSync, writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join, resolve, sep, extname } from 'path';
import { randomUUID } from 'crypto';

export const UPLOAD_ROOT = resolve(process.cwd(), 'data', 'uploads');
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_TYPES).map(([type, ext]) => [ext, type])
);

/** Resolve a path under UPLOAD_ROOT, rejecting anything that escapes it. */
export function safeUploadPath(...segments: string[]): string | null {
  const full = resolve(UPLOAD_ROOT, ...segments);
  return full.startsWith(UPLOAD_ROOT + sep) ? full : null;
}

export function saveImage(folder: string[], bytes: Buffer, mimeType: string): string {
  const ext = IMAGE_TYPES[mimeType];
  if (!ext) throw new Error('Unsupported image type');
  const dir = safeUploadPath(...folder);
  if (!dir) throw new Error('Invalid upload folder');
  mkdirSync(dir, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  writeFileSync(join(dir, name), bytes);
  return ['/api/uploads', ...folder.map(encodeURIComponent), name].join('/');
}

/** Delete an image previously returned by saveImage. Ignores URLs outside the upload area. */
export function deleteImage(url: string) {
  const prefix = '/api/uploads/';
  if (!url.startsWith(prefix)) return;
  const file = safeUploadPath(...url.slice(prefix.length).split('/').map(decodeURIComponent));
  if (file && existsSync(file)) unlinkSync(file);
}

export function readImage(segments: string[]): { body: Buffer; type: string } | null {
  const file = safeUploadPath(...segments);
  const type = file ? EXT_TO_TYPE[extname(file).toLowerCase()] : undefined;
  if (!file || !type || !existsSync(file)) return null;
  return { body: readFileSync(file), type };
}
