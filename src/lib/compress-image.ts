/**
 * Uploads go through a Vercel function, which rejects request bodies over 4.5 MB.
 * Phone photos are often bigger, so they are scaled down and re-encoded in the
 * browser first. Anything already small (or not a still photo) is sent as is.
 */
export const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

const TARGET_BYTES = 3 * 1024 * 1024;
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function shrinkImage(file: File): Promise<File> {
  if (!RESIZABLE.has(file.type) || file.size <= TARGET_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  try {
    for (const [maxSide, quality] of [
      [2400, 0.85],
      [2000, 0.8],
      [1600, 0.75],
      [1280, 0.7],
    ] as const) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= TARGET_BYTES) {
        return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
      }
    }
  } finally {
    bitmap.close();
  }
  return file;
}

export const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
