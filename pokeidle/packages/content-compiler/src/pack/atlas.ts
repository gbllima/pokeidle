import { SprFile } from '../formats/spr.ts';
import { encodePng } from '../io/png.ts';
import { SPRITE_SIZE } from '../config.ts';

export const ATLAS_SIZE = 2048;
export const SLOTS_PER_ROW = ATLAS_SIZE / SPRITE_SIZE; // 64
export const SLOTS_PER_ATLAS = SLOTS_PER_ROW * SLOTS_PER_ROW; // 4096

export type SpriteSlot = {
  /** Index into the atlas list. */
  a: number;
  /** Pixel offset inside that atlas. */
  x: number;
  y: number;
};

export type AtlasSet = {
  /** Encoded PNG per atlas, in index order. */
  images: Buffer[];
  /** spriteId -> where it landed. */
  slots: Map<number, SpriteSlot>;
  /** Sprites that were requested but hold no pixels; they get no slot. */
  blank: number[];
};

/**
 * Pack sprites into fixed grids.
 *
 * Every sprite in this base is exactly 32x32, so there is nothing to solve:
 * a 2048px atlas is a 64x64 grid of slots and placement is just an index.
 * A rectangle packer here would be pure overhead.
 */
export function packAtlases(sprPath: string, spriteIds: Iterable<number>): AtlasSet {
  const ids = [...spriteIds].sort((a, b) => a - b);
  const spr = SprFile.open(sprPath);

  const slots = new Map<number, SpriteSlot>();
  const blank: number[] = [];
  const canvases: Buffer[] = [];
  let placed = 0;

  try {
    for (const id of ids) {
      const pixels = spr.getSprite(id);
      if (!pixels) {
        blank.push(id);
        continue;
      }

      const atlasIndex = Math.floor(placed / SLOTS_PER_ATLAS);
      const withinAtlas = placed % SLOTS_PER_ATLAS;
      const col = withinAtlas % SLOTS_PER_ROW;
      const row = Math.floor(withinAtlas / SLOTS_PER_ROW);
      const x = col * SPRITE_SIZE;
      const y = row * SPRITE_SIZE;

      if (!canvases[atlasIndex]) {
        canvases[atlasIndex] = Buffer.alloc(ATLAS_SIZE * ATLAS_SIZE * 4);
      }
      blit(canvases[atlasIndex]!, pixels, x, y);

      slots.set(id, { a: atlasIndex, x, y });
      placed++;
    }
  } finally {
    spr.close();
  }

  // The last atlas is usually mostly empty; crop it to whole rows so the
  // release does not ship megabytes of transparent pixels.
  const images = canvases.map((canvas, i) => {
    const isLast = i === canvases.length - 1;
    if (!isLast) return encodePng(ATLAS_SIZE, ATLAS_SIZE, canvas);

    const used = placed - i * SLOTS_PER_ATLAS;
    const rows = Math.max(1, Math.ceil(used / SLOTS_PER_ROW));
    const height = rows * SPRITE_SIZE;
    return encodePng(ATLAS_SIZE, height, canvas.subarray(0, ATLAS_SIZE * height * 4));
  });

  return { images, slots, blank };
}

function blit(dst: Buffer, src: Buffer, dx: number, dy: number): void {
  const rowBytes = SPRITE_SIZE * 4;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    src.copy(dst, ((dy + y) * ATLAS_SIZE + dx) * 4, y * rowBytes, (y + 1) * rowBytes);
  }
}
