import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng, encodePng } from '../../content-compiler/src/io/png.ts';
import { layoutChunk, TILE } from './layout.ts';
import type { AppearanceSet, Chunk, LayoutOptions } from './layout.ts';
import { tintOutfit } from './outfit.ts';

/**
 * Headless rasteriser.
 *
 * Draws a compiled chunk exactly the way the browser presenter is meant to,
 * but into a buffer instead of a canvas. That makes the render testable in
 * CI and gives the golden-image comparison against the desktop client
 * something to compare.
 */

export type Release = {
  dir: string;
  manifest: { releaseId: string; counts: Record<string, number> };
  set: AppearanceSet;
  atlases: Array<{ width: number; height: number; rgba: Buffer }>;
};

export function loadRelease(dir: string): Release {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const set: AppearanceSet = JSON.parse(readFileSync(join(dir, 'appearances.json'), 'utf8'));

  const atlases: Release['atlases'] = [];
  for (let i = 0; ; i++) {
    const file = join(dir, 'atlas', `atlas-${String(i).padStart(3, '0')}.png`);
    if (!existsSync(file)) break;
    atlases.push(decodePng(readFileSync(file)));
  }
  if (atlases.length === 0) throw new Error(`no atlases found in ${dir}`);

  return { dir, manifest, set, atlases };
}

export function loadChunk(release: Release, key: string): Chunk {
  const file = join(release.dir, 'chunks', `${key}.json`);
  if (!existsSync(file)) throw new Error(`chunk ${key} not in this release`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function listChunks(release: Release): string[] {
  const files: string[] = [];
  const root = join(release.dir, 'chunks');
  for (const z of readdirSync(root)) {
    const zdir = join(root, z);
    if (!statSync(zdir).isDirectory()) continue;
    for (const f of readdirSync(zdir)) {
      if (f.endsWith('.json')) files.push(`${z}/${f.slice(0, -5)}`);
    }
  }
  return files.sort();
}

export type RasterResult = {
  width: number;
  height: number;
  rgba: Buffer;
  drawn: number;
  /** Sprites the draw list wanted but no atlas holds. */
  missing: number;
  /** Draws that went through outfit colourisation. */
  tinted: number;
};

export function rasterChunk(
  release: Release,
  chunk: Chunk,
  opts: LayoutOptions & { margin?: number } = {},
): RasterResult {
  const margin = opts.margin ?? TILE * 2;
  const size = chunk.size * TILE;
  const width = size + margin * 2;
  const height = size + margin * 2;
  const rgba = Buffer.alloc(width * height * 4);

  const draws = layoutChunk(chunk, release.set, opts);
  let drawn = 0;
  let missing = 0;

  let tinted = 0;

  for (const draw of draws) {
    const slot = release.set.sprites[String(draw.spriteId)];
    if (!slot) {
      missing++;
      continue;
    }
    const [atlasIndex, sx, sy] = slot;
    const atlas = release.atlases[atlasIndex];
    if (!atlas) {
      missing++;
      continue;
    }

    // A colourable creature is composited from its base sprite tinted by the
    // mask, so it has to be built in a scratch buffer before it hits the canvas.
    if (draw.maskSpriteId && draw.colors) {
      const maskSlot = release.set.sprites[String(draw.maskSpriteId)];
      const maskAtlas = maskSlot ? release.atlases[maskSlot[0]] : undefined;
      if (maskSlot && maskAtlas) {
        const base = extract(atlas, sx, sy);
        const mask = extract(maskAtlas, maskSlot[1], maskSlot[2]);
        const shaded = tintOutfit(base, mask, draw.colors);
        blitBuffer(rgba, width, height, shaded, draw.dx + margin, draw.dy + margin);
        drawn++;
        tinted++;
        continue;
      }
    }

    blit(rgba, width, height, atlas, sx, sy, draw.dx + margin, draw.dy + margin);
    drawn++;
  }

  return { width, height, rgba, drawn, missing, tinted };
}

export function rasterToPng(result: RasterResult): Buffer {
  return encodePng(result.width, result.height, result.rgba);
}

/** Source-over alpha compositing of one 32x32 sprite, clipped to the target. */
function blit(
  dst: Buffer,
  dstW: number,
  dstH: number,
  atlas: { width: number; rgba: Buffer },
  sx: number,
  sy: number,
  dx: number,
  dy: number,
): void {
  for (let y = 0; y < TILE; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dstH) continue;

    for (let x = 0; x < TILE; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dstW) continue;

      const s = ((sy + y) * atlas.width + (sx + x)) * 4;
      const alpha = atlas.rgba[s + 3]!;
      if (alpha === 0) continue;

      const d = (ty * dstW + tx) * 4;
      if (alpha === 255) {
        dst[d] = atlas.rgba[s]!;
        dst[d + 1] = atlas.rgba[s + 1]!;
        dst[d + 2] = atlas.rgba[s + 2]!;
        dst[d + 3] = 255;
        continue;
      }

      const a = alpha / 255;
      const inv = 1 - a;
      dst[d] = Math.round(atlas.rgba[s]! * a + dst[d]! * inv);
      dst[d + 1] = Math.round(atlas.rgba[s + 1]! * a + dst[d + 1]! * inv);
      dst[d + 2] = Math.round(atlas.rgba[s + 2]! * a + dst[d + 2]! * inv);
      dst[d + 3] = Math.round(alpha + dst[d + 3]! * inv);
    }
  }
}

/** Copy one 32x32 sprite out of an atlas into a standalone RGBA buffer. */
function extract(atlas: { width: number; rgba: Buffer }, sx: number, sy: number): Buffer {
  const out = Buffer.alloc(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) {
    const src = ((sy + y) * atlas.width + sx) * 4;
    atlas.rgba.copy(out, y * TILE * 4, src, src + TILE * 4);
  }
  return out;
}

/** Same compositing as `blit`, but from a standalone sprite buffer. */
function blitBuffer(
  dst: Buffer,
  dstW: number,
  dstH: number,
  src: Buffer,
  dx: number,
  dy: number,
): void {
  for (let y = 0; y < TILE; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dstH) continue;

    for (let x = 0; x < TILE; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dstW) continue;

      const s = (y * TILE + x) * 4;
      const alpha = src[s + 3]!;
      if (alpha === 0) continue;

      const d = (ty * dstW + tx) * 4;
      if (alpha === 255) {
        dst[d] = src[s]!;
        dst[d + 1] = src[s + 1]!;
        dst[d + 2] = src[s + 2]!;
        dst[d + 3] = 255;
        continue;
      }

      const a = alpha / 255;
      const inv = 1 - a;
      dst[d] = Math.round(src[s]! * a + dst[d]! * inv);
      dst[d + 1] = Math.round(src[s + 1]! * a + dst[d + 1]! * inv);
      dst[d + 2] = Math.round(src[s + 2]! * a + dst[d + 2]! * inv);
      dst[d + 3] = Math.round(alpha + dst[d + 3]! * inv);
    }
  }
}

/** Cut a window out of a raster, for inspecting detail at real scale. */
export function cropRaster(
  result: RasterResult,
  x: number,
  y: number,
  w: number,
  h: number,
): RasterResult {
  const width = Math.max(1, Math.min(w, result.width - x));
  const height = Math.max(1, Math.min(h, result.height - y));
  const rgba = Buffer.alloc(width * height * 4);

  for (let row = 0; row < height; row++) {
    const src = ((y + row) * result.width + x) * 4;
    result.rgba.copy(rgba, row * width * 4, src, src + width * 4);
  }

  return { ...result, width, height, rgba };
}

/** Nearest-neighbour upscale, so pixel art stays crisp when inspected. */
export function scaleRaster(result: RasterResult, factor: number): RasterResult {
  const width = result.width * factor;
  const height = result.height * factor;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < width; x++) {
      const sx = Math.floor(x / factor);
      const s = (sy * result.width + sx) * 4;
      const d = (y * width + x) * 4;
      result.rgba.copy(rgba, d, s, s + 4);
    }
  }

  return { ...result, width, height, rgba };
}
