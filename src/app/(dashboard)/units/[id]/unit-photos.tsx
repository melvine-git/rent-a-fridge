'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Panel } from '@/components/app/panel';
import { addUnitPhotos, removeUnitPhoto } from '@/lib/actions';
import { ImagePlus, Images, Loader2, Trash2 } from 'lucide-react';

const MAX_BYTES = 8 * 1024 * 1024;

export function UnitPhotos({ unitId, photos }: { unitId: string; photos: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const tooBig = Array.from(files).find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error(`${tooBig.name} is larger than 8 MB`);
      return;
    }
    const data = new FormData();
    Array.from(files).forEach((f) => data.append('photos', f));
    startUpload(async () => {
      const result = await addUnitPhotos(unitId, data);
      if (result.success) {
        toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
        router.refresh();
      } else {
        toast.error('Upload failed', { description: result.error });
      }
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const remove = async (url: string) => {
    setRemoving(url);
    const result = await removeUnitPhoto(unitId, url);
    setRemoving(null);
    if (result.success) {
      if (viewing === url) setViewing(null);
      toast.success('Photo removed');
      router.refresh();
    } else {
      toast.error('Could not remove photo', { description: result.error });
    }
  };

  return (
    <Panel
      title="Photos"
      count={photos.length}
      action={
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(e) => upload(e.target.files)}
            aria-label="Upload unit photos"
          />
          <Button variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()} className="h-8 gap-1 px-2.5 text-xs">
            {isUploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {isUploading ? 'Uploading…' : 'Add photos'}
          </Button>
        </>
      }
    >
      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="m-4 flex w-[calc(100%-2rem)] flex-col items-center justify-center gap-2 rounded-md border border-dashed py-10 text-sm text-muted-foreground hover:bg-muted/40"
        >
          <Images className="size-6" />
          <span>Add photos of the unit</span>
          <span className="text-xs">JPG, PNG, WebP or GIF up to 8 MB each</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((url, i) => (
            <li key={url} className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
              <button type="button" onClick={() => setViewing(url)} className="block size-full" aria-label={`View photo ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served from the private uploads route */}
                <img src={url} alt={`Unit photo ${i + 1}`} className="size-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
              </button>
              <button
                type="button"
                onClick={() => remove(url)}
                disabled={removing === url}
                className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100"
                aria-label={`Delete photo ${i + 1}`}
              >
                {removing === url ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="p-2 sm:max-w-4xl">
          <DialogTitle className="sr-only">Unit photo</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- served from the private uploads route */}
          {viewing && <img src={viewing} alt="Unit photo" className="max-h-[80vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
