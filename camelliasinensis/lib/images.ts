// Odabir AVIF/WebP derivata koje je izradio scripts/optimize-images.mjs.
import manifest from '../fixtures/image-manifest.json';

type Entry = { width: number; height: number; widths: number[] };
const M = manifest as Record<string, Entry>;

export type Sources = { avif: string; webp: string; src: string; width: number; height: number };

export function imageSources(src: string): Sources | null {
  const m = M[src];
  if (!m || !src.endsWith('.jpg')) return null;
  const base = src.slice(0, -4);
  const set = (fmt: string) => m.widths.map((w) => `${base}-${w}.${fmt} ${w}w`).join(', ');
  const max = Math.max(...m.widths);
  return { avif: set('avif'), webp: set('webp'), src: `${base}-${max}.webp`, width: m.width, height: m.height };
}
