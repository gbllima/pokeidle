import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root = the folder holding `cliente/` and `servidor/`. */
export const REPO_ROOT = process.env.POKEIDLE_ROOT
  ? resolve(process.env.POKEIDLE_ROOT)
  : resolve(here, '../../../..');

export const PATHS = {
  dat: resolve(REPO_ROOT, 'cliente/data/things/1098/Tibia.dat'),
  spr: resolve(REPO_ROOT, 'cliente/data/things/1098/Tibia.spr'),
  otb: resolve(REPO_ROOT, 'servidor/data/items/items.otb'),
  itemsXml: resolve(REPO_ROOT, 'servidor/data/items/items.xml'),
  map: resolve(REPO_ROOT, 'servidor/data/world/map.otbm'),
  map2: resolve(REPO_ROOT, 'servidor/data/world/map2.otbm'),
  spawns: resolve(REPO_ROOT, 'servidor/data/world/map-spawn.xml'),
  monsters: resolve(REPO_ROOT, 'servidor/data/monster'),
  npcs: resolve(REPO_ROOT, 'servidor/data/npc'),
  /** Holds the `balls` table every capture is rolled against. */
  newFunctions: resolve(REPO_ROOT, 'servidor/data/lib/core/newfunctions.lua'),
  /** The cash shop: categories, prices and which currency each is paid in. */
  newShop: resolve(REPO_ROOT, 'servidor/data/lib/systems/newShop.lua'),
  spells: resolve(REPO_ROOT, 'servidor/data/scripts/spells'),
  effectsOtml: resolve(REPO_ROOT, 'cliente/data/things/1098/effects.otml'),
  portraits: resolve(REPO_ROOT, 'cliente/data/images/game/portrait'),
  artworks: resolve(REPO_ROOT, 'cliente/data/images/game/pokedex/pokemon'),
  out: resolve(REPO_ROOT, 'pokeidle/out'),
};

/**
 * Feature flags for this base, derived from
 * `cliente/modules/game_features/features.lua` at clientVersion 1098.
 *
 * These are NOT guesses and NOT read from Tibia.otfi — the client never
 * parses the .otfi, so features.lua is the only source of truth. Changing
 * the client version means re-deriving this block.
 */
export const CLIENT_VERSION = 1098;

export const FEATURES = {
  /** >= 960. Sprite count and sprite indices are u32 instead of u16. */
  spritesU32: true,
  /** Enabled unconditionally and again at >= 1098. Colored pixels carry alpha (4 bytes). */
  spritesAlphaChannel: true,
  /** >= 1050. Animation phase durations are serialised after the phase count. */
  enhancedAnimations: true,
  /** >= 1057. Creature appearances are split into frame groups (idle / moving). */
  idleAnimations: true,
  /** >= 1000. Attribute ids 16+ shifted to make room for "no move animation". */
  attributeShift1000: true,
} as const;

export const SPRITE_SIZE = 32;
export const SPRITE_DATA_SIZE = SPRITE_SIZE * SPRITE_SIZE * 4;
