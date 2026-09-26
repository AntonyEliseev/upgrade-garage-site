import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

// Фото лежат в src/assets/img, а в данных записаны как «/img/имя.jpg» — так их пишет макет.
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/img/*.{jpg,jpeg,png,webp}', { eager: true });

export function photo(path: string | undefined | null): ImageMetadata | undefined {
  if (!path) return undefined;
  const name = path.split('/').pop();
  const hit = files[`/src/assets/img/${name}`];
  if (!hit && import.meta.env.DEV) console.warn(`[images] нет файла ${path}`);
  return hit?.default;
}

export function mustPhoto(path: string): ImageMetadata {
  const img = photo(path);
  if (!img) throw new Error(`[images] нет файла ${path}`);
  return img;
}

/** URL оптимизированной картинки — для островков и Open Graph. */
export async function photoUrl(path: string, width: number, format: 'webp' | 'avif' | 'jpg' = 'webp', height?: number) {
  const img = await getImage({ src: mustPhoto(path), width, height, format, fit: height ? 'cover' : undefined });
  return img.src;
}
