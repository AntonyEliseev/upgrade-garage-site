import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

// Фото лежат в src/assets/img (с подпапками works/, zones/), а в данных записаны как «/img/…» — так их пишет макет.
const files = import.meta.glob<{ default: ImageMetadata }>('/src/assets/img/**/*.{jpg,jpeg,png,webp}', { eager: true });

export function photo(path: string | undefined | null): ImageMetadata | undefined {
  if (!path) return undefined;
  const rel = path.replace(/^\/?img\//, '');
  const hit = files[`/src/assets/img/${rel}`];
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

export interface Srcset { src: string; srcset: string }

/** src + srcset в webp для <img> в островках */
export async function photoSrcset(path: string, widths: number[]): Promise<Srcset> {
  const src = mustPhoto(path);
  const ws = widths.filter((w) => w <= src.width);
  if (!ws.length) ws.push(src.width);
  const out = await Promise.all(ws.map((w) => getImage({ src, width: w, format: 'webp' })));
  const mid = out[Math.min(1, out.length - 1)];
  return { src: mid.src, srcset: out.map((o, i) => `${o.src} ${ws[i]}w`).join(', ') };
}
