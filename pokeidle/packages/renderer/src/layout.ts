/**
 * Tile layout: turning a compiled chunk into an ordered list of sprite draws.
 *
 * Pure on purpose. Every rule that decides *what* appears *where* lives here
 * with no canvas, no WebGL and no DOM, so it can be unit tested and so the
 * same logic drives both the browser presenter and the headless golden-image
 * rasteriser. Swapping Canvas2D for PixiJS should not touch this file.
 */

export const TILE = 32;

export type FrameGroup = {
  t: number;
  w: number;
  h: number;
  l: number;
  px: number;
  py: number;
  pz: number;
  ph: number;
  d: number[] | null;
  s: number[];
};

export type Appearance = {
  groups: FrameGroup[];
  /** Stack priority: ground 0, border 1, bottom 2, top 3, everything else 5. */
  sp: number;
  off?: [number, number];
  elev?: number;
  mm?: number;
};

export type AppearanceSet = {
  spriteSize: number;
  atlasSize: number;
  /** spriteId -> [atlasIndex, x, y] */
  sprites: Record<string, [number, number, number]>;
  appearances: {
    item?: Record<string, Appearance>;
    creature?: Record<string, Appearance>;
    effect?: Record<string, Appearance>;
    missile?: Record<string, Appearance>;
  };
};

export type ChunkTile = {
  x: number;
  y: number;
  g?: number;
  i?: number[];
  f?: number;
};

export type Chunk = {
  cx: number;
  cy: number;
  z: number;
  size: number;
  tiles: ChunkTile[];
};

export type Draw = {
  spriteId: number;
  /** Destination in chunk-local pixels. May be negative for overhanging art. */
  dx: number;
  dy: number;
  /** Sort key, already applied to the returned order. */
  priority: number;
  /** Layer-1 mask sprite, when the appearance is colourable. */
  maskSpriteId?: number;
  /** head, body, legs, feet colour indices for the mask. */
  colors?: OutfitColors;
};

/** head, body, legs, feet — the four channels an outfit mask can tint. */
export type OutfitColors = [number, number, number, number];

/** North, east, south, west, matching the pattern order in the dat. */
export const DIRECTION = { north: 0, east: 1, south: 2, west: 3 } as const;

export type CreaturePlacement = {
  /** Absolute map position. */
  x: number;
  y: number;
  z: number;
  /** Appearance id from the creature category. */
  lookType: number;
  direction?: number;
  colors?: OutfitColors;
  addons?: number;
  /** Idle group by default; 1 selects the walking group when one exists. */
  group?: number;
  /**
   * Pixels to shift the sprite, for a creature part-way through a step.
   *
   * The client moves a walking creature's tile as the step begins and draws
   * it offset back towards where it came from, shrinking to nothing on
   * arrival. Without it a creature teleports one tile at a time.
   */
  ox?: number;
  oy?: number;
  /** Frame of this creature's own animation. Falls back to the shared phase. */
  phase?: number;
};

/**
 * Creatures sit above everything a tile stacks but below nothing else, so
 * they get a priority of their own between "on top" and loose items.
 */
export const CREATURE_PRIORITY = 4;

type OrderedDraw = Draw & { row: number; order: number };

/**
 * Creature draws for one chunk, separate from the terrain.
 *
 * Kept callable on its own because terrain is static enough to cache per
 * chunk while creatures move: the browser presenter bakes the tiles once and
 * redraws only this list each frame.
 */
export function layoutCreatures(
  chunk: Chunk,
  set: AppearanceSet,
  placements: CreaturePlacement[],
  phase = 0,
): OrderedDraw[] {
  const creatures = set.appearances.creature ?? {};
  const out: OrderedDraw[] = [];

  for (const creature of placements) {
    if (creature.z !== chunk.z) continue;

    const localX = creature.x - chunk.cx * chunk.size;
    const localY = creature.y - chunk.cy * chunk.size;
    if (localX < 0 || localX >= chunk.size || localY < 0 || localY >= chunk.size) continue;

    const appearance = creatures[String(creature.lookType)];
    if (!appearance) continue;

    const group = appearance.groups[creature.group ?? 0] ?? appearance.groups[0];
    if (!group) continue;

    // Unlike items, a creature's x pattern is its facing, not its position.
    const px = Math.min(creature.direction ?? DIRECTION.south, group.px - 1);
    const py = Math.min(creature.addons ?? 0, group.py - 1);
    // A walking creature runs its own cycle; everything else shares the
    // world's idle phase.
    const safePhase = (creature.phase ?? phase) % Math.max(1, group.ph);
    const [offX, offY] = appearance.off ?? [0, 0];

    for (let cy = 0; cy < group.h; cy++) {
      for (let cx = 0; cx < group.w; cx++) {
        const spriteId =
          group.s[spriteIndex(group, { layer: 0, px, py, pz: 0, phase: safePhase, cx, cy })];
        if (!spriteId) continue;

        // Layer 1 is the colour mask. Absent on creatures that are not tintable.
        const maskSpriteId =
          group.l > 1
            ? group.s[spriteIndex(group, { layer: 1, px, py, pz: 0, phase: safePhase, cx, cy })]
            : undefined;

        out.push({
          spriteId,
          dx: (localX - cx) * TILE - offX + (creature.ox ?? 0),
          dy: (localY - cy) * TILE - offY + (creature.oy ?? 0),
          priority: CREATURE_PRIORITY,
          row: localY,
          order: 0,
          ...(maskSpriteId ? { maskSpriteId, colors: creature.colors ?? [0, 0, 0, 0] } : {}),
        });
      }
    }
  }

  return out;
}

/**
 * Which pattern variant a thing shows at a given map position.
 *
 * This is what stops a field of grass from being one tile repeated: the
 * appearance carries several variants and the position picks between them.
 * It must use absolute map coordinates, not chunk-local ones, or the pattern
 * will visibly seam at every chunk boundary.
 */
export function patternFor(
  group: FrameGroup,
  absX: number,
  absY: number,
  absZ: number,
): { px: number; py: number; pz: number } {
  return {
    px: ((absX % group.px) + group.px) % group.px,
    py: ((absY % group.py) + group.py) % group.py,
    pz: ((absZ % group.pz) + group.pz) % group.pz,
  };
}

/** Index into a frame group's flat sprite list. Mirrors the client's walk. */
export function spriteIndex(
  group: FrameGroup,
  opts: { layer: number; px: number; py: number; pz: number; phase: number; cx: number; cy: number },
): number {
  let i = opts.phase;
  i = i * group.pz + opts.pz;
  i = i * group.py + opts.py;
  i = i * group.px + opts.px;
  i = i * group.l + opts.layer;
  i = i * group.h + opts.cy;
  i = i * group.w + opts.cx;
  return i;
}

export type LayoutOptions = {
  /** Animation phase to freeze on. */
  phase?: number;
  /** Draw only this layer of each appearance. */
  layer?: number;
  /** Creatures and npcs standing in this chunk. */
  creatures?: CreaturePlacement[];
};

type Pending = {
  appearance: Appearance;
  /** Order the thing appeared in the tile, used to break priority ties. */
  order: number;
};

/**
 * Build the ordered draw list for one chunk.
 *
 * Returned draws are already sorted: by tile row (so southern tiles overlap
 * northern ones), then by stack priority, then by the order things were
 * stored in the map.
 */
export function layoutChunk(chunk: Chunk, set: AppearanceSet, opts: LayoutOptions = {}): Draw[] {
  const phase = opts.phase ?? 0;
  const layer = opts.layer ?? 0;
  const items = set.appearances.item ?? {};
  const creatures = set.appearances.creature ?? {};
  const draws: OrderedDraw[] = [];

  for (const tile of chunk.tiles) {
    const absX = chunk.cx * chunk.size + tile.x;
    const absY = chunk.cy * chunk.size + tile.y;

    const pending: Pending[] = [];
    if (tile.g) {
      const a = items[String(tile.g)];
      if (a) pending.push({ appearance: a, order: 0 });
    }
    for (const [n, id] of (tile.i ?? []).entries()) {
      const a = items[String(id)];
      if (a) pending.push({ appearance: a, order: n + 1 });
    }

    pending.sort((p, q) => p.appearance.sp - q.appearance.sp || p.order - q.order);

    // Things that sit on top of others push everything after them upward.
    let elevation = 0;

    for (const { appearance, order } of pending) {
      const group = appearance.groups[0];
      if (!group) continue;

      const { px, py, pz } = patternFor(group, absX, absY, chunk.z);
      const [offX, offY] = appearance.off ?? [0, 0];

      for (let cy = 0; cy < group.h; cy++) {
        for (let cx = 0; cx < group.w; cx++) {
          const idx = spriteIndex(group, { layer, px, py, pz, phase, cx, cy });
          const spriteId = group.s[idx];
          if (!spriteId) continue;

          // A multi-tile appearance is anchored at its bottom-right cell, so
          // cell (0,0) is the south-east corner and higher cells extend back.
          draws.push({
            spriteId,
            dx: (tile.x - cx) * TILE - offX,
            dy: (tile.y - cy) * TILE - offY - elevation,
            priority: appearance.sp,
            row: tile.y,
            order,
          });
        }
      }

      elevation += appearance.elev ?? 0;
    }
  }

  draws.push(...layoutCreatures(chunk, set, opts.creatures ?? [], phase));

  draws.sort((a, b) => a.row - b.row || a.priority - b.priority || a.order - b.order);
  return draws.map(({ spriteId, dx, dy, priority, maskSpriteId, colors }) => ({
    spriteId,
    dx,
    dy,
    priority,
    ...(maskSpriteId ? { maskSpriteId, colors } : {}),
  }));
}
