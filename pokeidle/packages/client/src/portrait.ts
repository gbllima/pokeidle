import { DIRECTION, TILE, type AppearanceSet } from '../../renderer/src/layout.ts';

/**
 * Appearance portraits.
 *
 * Lives in its own module because two callers need it at different moments:
 * the onboarding screens draw starters before the game world exists, and the
 * running game draws party, pins and bag icons afterwards. One implementation
 * keeps a Bulbasaur looking the same in both.
 */

export type PortraitFn = (
  lookType: number,
  size: number,
  category?: 'creature' | 'item',
) => HTMLCanvasElement;

export function makePortrait(set: AppearanceSet, atlases: ImageBitmap[]): PortraitFn {
  return (lookType, size, category = 'creature') => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const group = set.appearances[category]?.[String(lookType)]?.groups[0];
    if (!group) return canvas;

    // Creatures have a facing; items do not, so they always use pattern 0.
    const px = category === 'creature' ? Math.min(DIRECTION.south, group.px - 1) : 0;
    const scale = size / (Math.max(group.w, group.h) * TILE);

    for (let cy = 0; cy < group.h; cy++) {
      for (let cx = 0; cx < group.w; cx++) {
        let i = 0;
        i = i * group.pz + 0;
        i = i * group.py + 0;
        i = i * group.px + px;
        i = i * group.l + 0;
        i = i * group.h + cy;
        i = i * group.w + cx;

        const spriteId = group.s[i];
        if (!spriteId) continue;
        const slot = set.sprites[String(spriteId)];
        const atlas = slot ? atlases[slot[0]] : undefined;
        if (!slot || !atlas) continue;

        // Multi-tile appearances anchor bottom-right, same as on the map.
        ctx.drawImage(
          atlas,
          slot[1],
          slot[2],
          TILE,
          TILE,
          (group.w - 1 - cx) * TILE * scale,
          (group.h - 1 - cy) * TILE * scale,
          TILE * scale,
          TILE * scale,
        );
      }
    }

    return canvas;
  };
}
