import { readFileSync } from 'node:fs';
import { walkTree } from './node-tree.ts';
import type { BinaryReader } from '../io/reader.ts';

export const OTBM_NODE = {
  ROOTV1: 1,
  MAP_DATA: 2,
  ITEM_DEF: 3,
  TILE_AREA: 4,
  TILE: 5,
  ITEM: 6,
  TILE_SQUARE: 7,
  TILE_REF: 8,
  SPAWNS: 9,
  SPAWN_AREA: 10,
  MONSTER: 11,
  TOWNS: 12,
  TOWN: 13,
  HOUSETILE: 14,
  WAYPOINTS: 15,
  WAYPOINT: 16,
} as const;

export const OTBM_ATTR = {
  DESCRIPTION: 1,
  EXT_FILE: 2,
  TILE_FLAGS: 3,
  ACTION_ID: 4,
  UNIQUE_ID: 5,
  TEXT: 6,
  DESC: 7,
  TELE_DEST: 8,
  ITEM: 9,
  DEPOT_ID: 10,
  EXT_SPAWN_FILE: 11,
  RUNE_CHARGES: 12,
  EXT_HOUSE_FILE: 13,
  HOUSEDOORID: 14,
  COUNT: 15,
  DURATION: 16,
  DECAYING_STATE: 17,
  WRITTENDATE: 18,
  WRITTENBY: 19,
  SLEEPERGUID: 20,
  SLEEPSTART: 21,
  CHARGES: 22,
} as const;

export const TILE_FLAG = {
  PROTECTIONZONE: 1 << 0,
  NOPVPZONE: 1 << 2,
  NOLOGOUT: 1 << 3,
  PVPZONE: 1 << 4,
} as const;

export type MapHeader = {
  otbmVersion: number;
  width: number;
  height: number;
  majorVersionItems: number;
  minorVersionItems: number;
  description: string;
  spawnFile: string;
  houseFile: string;
};

export type MapTile = {
  x: number;
  y: number;
  z: number;
  flags: number;
  houseId: number | null;
  /** Ground item server id, 0 when the tile declares none. */
  ground: number;
  /** Stacked items in file order — this is the render stack order. */
  items: number[];
};

export type Town = {
  id: number;
  name: string;
  temple: { x: number; y: number; z: number };
};

export type Waypoint = {
  name: string;
  x: number;
  y: number;
  z: number;
};

export type BoundingBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type ScanResult = {
  header: MapHeader;
  tiles: MapTile[];
  /**
   * Tiles the scan actually walked. Equals every tile in the file when no box
   * is given; with a box it counts only tiles inside areas that overlap it,
   * because whole areas are rejected without being opened.
   */
  tilesVisited: number;
  /** True when a box narrowed the walk, so `tilesVisited` is not a file total. */
  boxed: boolean;
  /** Bounds of the tiles that were visited. */
  extent: BoundingBox;
  towns: Town[];
  waypoints: Waypoint[];
};

export type ScanOptions = {
  /** Only collect tiles inside this box. Non-overlapping areas are skipped whole. */
  box?: Partial<BoundingBox>;
  /**
   * Several disjoint boxes, for a release that covers a hub and the hunt
   * zones it can travel to. A tile is kept when it falls inside any of them,
   * and an area is opened when it overlaps any of them, so the cheap
   * whole-area rejection still applies. Ignored when `box` is given.
   */
  boxes?: BoundingBox[];
  /** Stop collecting after this many tiles (the scan still completes). */
  limit?: number;
  /** Read the root header and map metadata, then stop. */
  headerOnly?: boolean;
  /** Reject every tile area, so only towns and waypoints are collected. */
  skipTiles?: boolean;
};

/** Sentinel used to unwind the walk once `headerOnly` has what it needs. */
const STOP = Symbol('otbm-scan-stop');

const FULL_BOX: BoundingBox = {
  minX: 0, maxX: 0xffff,
  minY: 0, maxY: 0xffff,
  minZ: 0, maxZ: 15,
};

export function scanOtbm(path: string, opts: ScanOptions = {}): ScanResult {
  const buf = readFileSync(path);
  // One box or many: the walk only ever asks "any of these", so a single box
  // is a list of one rather than a second code path that can drift.
  const boxes: BoundingBox[] = opts.box
    ? [{ ...FULL_BOX, ...opts.box }]
    : opts.boxes?.length
      ? opts.boxes
      : [FULL_BOX];
  const limit = opts.limit ?? Infinity;

  const header: MapHeader = {
    otbmVersion: 0, width: 0, height: 0,
    majorVersionItems: 0, minorVersionItems: 0,
    description: '', spawnFile: '', houseFile: '',
  };

  const tiles: MapTile[] = [];
  const towns: Town[] = [];
  const waypoints: Waypoint[] = [];
  let tilesVisited = 0;
  const extent: BoundingBox = {
    minX: 0xffff, maxX: 0, minY: 0xffff, maxY: 0, minZ: 15, maxZ: 0,
  };

  // Area coordinates live on the parent node; tiles carry only an 8-bit offset.
  let areaX = 0, areaY = 0, areaZ = 0;
  let current: MapTile | null = null;

  try {
    walkTree(buf, {
    enter({ type, depth, props }) {
      // The root node carries type byte 0, not OTBM_ROOTV1 — depth is what
      // identifies it. Matching on the type here silently drops the whole tree.
      if (depth === 0) {
        const r = props();
        header.otbmVersion = r.u32();
        header.width = r.u16();
        header.height = r.u16();
        header.majorVersionItems = r.u32();
        header.minorVersionItems = r.u32();
        return;
      }

      switch (type) {
        case OTBM_NODE.MAP_DATA: {
          const r = props();
          while (!r.eof) {
            const attr = r.u8();
            if (r.eof) break;
            if (attr === OTBM_ATTR.DESCRIPTION) header.description += r.string();
            else if (attr === OTBM_ATTR.EXT_SPAWN_FILE) header.spawnFile = r.string();
            else if (attr === OTBM_ATTR.EXT_HOUSE_FILE) header.houseFile = r.string();
            else break; // unknown attribute: the rest is not safely walkable
          }
          if (opts.headerOnly) throw STOP;
          return;
        }

        case OTBM_NODE.TOWNS:
        case OTBM_NODE.WAYPOINTS:
          return; // descend so the entries below are visited

        case OTBM_NODE.TOWN: {
          const r = props();
          const id = r.u32();
          const name = r.string();
          towns.push({ id, name, temple: { x: r.u16(), y: r.u16(), z: r.u8() } });
          return false;
        }

        case OTBM_NODE.WAYPOINT: {
          const r = props();
          const name = r.string();
          waypoints.push({ name, x: r.u16(), y: r.u16(), z: r.u8() });
          return false;
        }

        case OTBM_NODE.TILE_AREA: {
          if (opts.skipTiles) return false;
          const r = props();
          areaX = r.u16();
          areaY = r.u16();
          areaZ = r.u8();
          // A whole area can be rejected in one comparison — this is what makes
          // scanning a 98 MB map with a small box cheap.
          if (
            !boxes.some(
              (b) =>
                areaZ >= b.minZ && areaZ <= b.maxZ &&
                areaX <= b.maxX && areaX + 255 >= b.minX &&
                areaY <= b.maxY && areaY + 255 >= b.minY,
            )
          ) {
            return false;
          }
          return;
        }

        case OTBM_NODE.TILE:
        case OTBM_NODE.HOUSETILE: {
          const r = props();
          const x = areaX + r.u8();
          const y = areaY + r.u8();
          const z = areaZ;

          tilesVisited++;
          if (x < extent.minX) extent.minX = x;
          if (x > extent.maxX) extent.maxX = x;
          if (y < extent.minY) extent.minY = y;
          if (y > extent.maxY) extent.maxY = y;
          if (z < extent.minZ) extent.minZ = z;
          if (z > extent.maxZ) extent.maxZ = z;

          const inBox = boxes.some(
            (b) =>
              x >= b.minX && x <= b.maxX &&
              y >= b.minY && y <= b.maxY &&
              z >= b.minZ && z <= b.maxZ,
          );

          if (!inBox || tiles.length >= limit) {
            current = null;
            return false; // skip child item nodes entirely
          }

          const tile: MapTile = {
            x, y, z,
            flags: 0,
            houseId: type === OTBM_NODE.HOUSETILE ? r.u32() : null,
            ground: 0,
            items: [],
          };

          while (!r.eof) {
            const attr = r.u8();
            if (r.eof) break;
            if (attr === OTBM_ATTR.TILE_FLAGS) tile.flags = r.u32();
            else if (attr === OTBM_ATTR.ITEM) tile.ground = r.u16();
            else break;
          }

          tiles.push(tile);
          current = tile;
          return;
        }

        case OTBM_NODE.ITEM: {
          if (!current) return false;
          const r = props();
          current.items.push(r.u16());
          return; // nested containers are walked but their contents are not rendered
        }

        default:
          return false; // spawns and anything unrecognised
      }
    },

    leave(type) {
      if (type === OTBM_NODE.TILE || type === OTBM_NODE.HOUSETILE) current = null;
    },
    });
  } catch (err) {
    if (err !== STOP) throw err;
  }

  if (tilesVisited === 0) {
    extent.minX = extent.minY = extent.minZ = 0;
    extent.maxZ = 0;
  }

  return {
    header,
    tiles,
    tilesVisited,
    boxed: opts.box !== undefined || Boolean(opts.boxes?.length),
    extent,
    towns: towns.sort((a, b) => a.id - b.id),
    waypoints,
  };
}

/** Read the header and stop. Milliseconds even on the full map. */
export function readOtbmHeader(path: string): MapHeader {
  return scanOtbm(path, { headerOnly: true }).header;
}

export function decodeTileFlags(flags: number): string[] {
  const out: string[] = [];
  if (flags & TILE_FLAG.PROTECTIONZONE) out.push('protection');
  if (flags & TILE_FLAG.NOPVPZONE) out.push('no-pvp');
  if (flags & TILE_FLAG.PVPZONE) out.push('pvp');
  if (flags & TILE_FLAG.NOLOGOUT) out.push('no-logout');
  return out;
}

export type { BinaryReader };
