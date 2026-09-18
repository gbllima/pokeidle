import { scanOtbm } from '../formats/otbm.ts';
import type { BoundingBox } from '../formats/otbm.ts';
import type { OtbFile } from '../formats/otb.ts';
import type { DatFile } from '../formats/dat.ts';
import { encodePng } from '../io/png.ts';

/**
 * Region minimaps.
 *
 * One pixel per tile, coloured the way the desktop client colours its own
 * minimap: the topmost thing on the tile that declares a `minimapColor` wins,
 * falling back to the ground. Rendering the whole world as one image would be
 * 25 megapixels, so each region gets its own crop sized to the zones it holds.
 */

/**
 * The dat stores a minimap colour as an index into a 6x6x6 cube.
 * `framework/util/color.h` resolves it as r/g/b = 51 * each digit, with 0 and
 * anything past 215 meaning "no colour".
 */
export function minimapRgb(index: number): [number, number, number] | null {
  if (index <= 0 || index >= 216) return null;
  return [
    (Math.floor(index / 36) % 6) * 51,
    (Math.floor(index / 6) % 6) * 51,
    (index % 6) * 51,
  ];
}

export type RegionRequest = {
  name: string;
  box: BoundingBox;
};

export type RegionMap = {
  name: string;
  /** Map coordinates of the image's top-left pixel. */
  originX: number;
  originY: number;
  z: number;
  width: number;
  height: number;
  png: Buffer;
  /** Tiles that contributed a pixel. */
  painted: number;
};

export type MinimapResult = {
  regions: RegionMap[];
  tilesVisited: number;
};

type Canvas = {
  request: RegionRequest;
  rgba: Buffer;
  /** Smallest z that has painted each pixel so far, for the top-down rule. */
  depth: Int16Array;
  painted: number;
};

export function renderRegionMinimaps(
  mapPath: string,
  requests: RegionRequest[],
  otb: OtbFile,
  dat: DatFile,
): MinimapResult {
  if (requests.length === 0) return { regions: [], tilesVisited: 0 };

  const items = dat.things.get('item')!;

  /** serverId -> minimap colour, resolved once and reused across millions of tiles. */
  const colorCache = new Map<number, [number, number, number] | null>();
  const colorOf = (serverId: number): [number, number, number] | null => {
    if (serverId === 0) return null;
    const hit = colorCache.get(serverId);
    if (hit !== undefined) return hit;

    const clientId = otb.serverToClient.get(serverId);
    const thing = clientId ? items.get(clientId) : undefined;
    const rgb = thing?.minimapColor !== undefined ? minimapRgb(thing.minimapColor) : null;
    colorCache.set(serverId, rgb);
    return rgb;
  };

  const canvases: Canvas[] = requests.map((request) => {
    const width = request.box.maxX - request.box.minX + 1;
    const height = request.box.maxY - request.box.minY + 1;
    return {
      request,
      rgba: Buffer.alloc(width * height * 4),
      depth: new Int16Array(width * height).fill(999),
      painted: 0,
    };
  });

  // One combined box keeps this to a single pass over the map, which matters:
  // the full otbm is eleven million tiles.
  const combined: BoundingBox = {
    minX: Math.min(...requests.map((r) => r.box.minX)),
    maxX: Math.max(...requests.map((r) => r.box.maxX)),
    minY: Math.min(...requests.map((r) => r.box.minY)),
    maxY: Math.max(...requests.map((r) => r.box.maxY)),
    minZ: 0,
    maxZ: 15,
  };

  const scan = scanOtbm(mapPath, { box: combined });

  for (const tile of scan.tiles) {
    // Topmost thing that declares a colour wins, ground last.
    let rgb: [number, number, number] | null = null;
    for (let i = tile.items.length - 1; i >= 0 && !rgb; i--) {
      rgb = colorOf(tile.items[i]!);
    }
    if (!rgb) rgb = colorOf(tile.ground);
    if (!rgb) continue;

    for (const canvas of canvases) {
      const { box } = canvas.request;
      if (tile.x < box.minX || tile.x > box.maxX) continue;
      if (tile.y < box.minY || tile.y > box.maxY) continue;

      const width = box.maxX - box.minX + 1;
      const cell = (tile.y - box.minY) * width + (tile.x - box.minX);

      // Looking down on the world, the smallest z is the highest floor and
      // therefore the one you see. Anchoring to a single floor instead leaves
      // whole regions blank when their spawns claim a floor with no ground.
      if (tile.z >= canvas.depth[cell]!) continue;
      if (canvas.depth[cell] === 999) canvas.painted++;
      canvas.depth[cell] = tile.z;

      const p = cell * 4;
      canvas.rgba[p] = rgb[0];
      canvas.rgba[p + 1] = rgb[1];
      canvas.rgba[p + 2] = rgb[2];
      canvas.rgba[p + 3] = 255;
    }
  }

  const regions = canvases.map(({ request, rgba, painted }) => {
    const width = request.box.maxX - request.box.minX + 1;
    const height = request.box.maxY - request.box.minY + 1;
    return {
      name: request.name,
      originX: request.box.minX,
      originY: request.box.minY,
      z: request.box.minZ,
      width,
      height,
      png: encodePng(width, height, rgba),
      painted,
    };
  });

  return { regions, tilesVisited: scan.tilesVisited };
}
