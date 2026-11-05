import { useQuery } from '@tanstack/react-query';
import { supabase } from './client';

// Images live in the private `page-images` bucket under <user_id>/. Docs store the path;
// the app swaps it for a signed link when it renders.

const BUCKET = 'page-images';
const MAX_SIDE = 2000;
const LINK_TTL = 7 * 24 * 3600; // seconds

export const isImageFile = (f: File) => /^image\/(jpeg|png|webp|gif|heic|heif)$/.test(f.type);

interface Prepared {
  blob: Blob;
  ext: string;
  width: number;
  height: number;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Shrinks to at most 2000px a side and re-encodes, so phone photos land around 300–600 KB. GIFs stay as they are. */
async function prepare(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = bitmap;
  if (file.type === 'image/gif') {
    bitmap.close();
    return { blob: file, ext: 'gif', width, height };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Safari can't encode WebP and quietly hands back PNG, so check what came out.
  let blob = await toBlob(canvas, 'image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!blob) throw new Error('encode failed');
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';

  // A small, already-compressed original can beat the re-encode; keep whichever is smaller.
  const original = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : null;
  if (scale === 1 && original && file.size <= blob.size) return { blob: file, ext: original, width, height };
  return { blob, ext, width: canvas.width, height: canvas.height };
}

export async function uploadImage(file: File): Promise<{ path: string; width: number; height: number }> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
  const img = await prepare(file);
  const path = `${userId}/${crypto.randomUUID()}.${img.ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, img.blob, {
    contentType: img.blob.type || `image/${img.ext === 'jpg' ? 'jpeg' : img.ext}`,
    cacheControl: '31536000',
  });
  if (error) throw new Error(error.message);
  return { path, width: img.width, height: img.height };
}

/** A signed link for a stored image, reused until a day before it expires. */
export function useImageUrl(path: string | null) {
  return useQuery({
    queryKey: ['image', path],
    enabled: !!path,
    staleTime: (LINK_TTL - 24 * 3600) * 1000,
    gcTime: 24 * 3600 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, LINK_TTL);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
}
