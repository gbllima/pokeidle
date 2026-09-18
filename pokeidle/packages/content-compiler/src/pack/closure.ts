import { scanOtbm } from '../formats/otbm.ts';
import type { MapTile, BoundingBox } from '../formats/otbm.ts';
import { loadOtb } from '../formats/otb.ts';
import type { OtbFile } from '../formats/otb.ts';
import { loadDat } from '../formats/dat.ts';
import type { DatFile, ThingCategory } from '../formats/dat.ts';

export type ClosureRequest = {
  mapPath: string;
  otbPath: string;
  datPath: string;
  /** Areas to include. A hub-only release passes one; a travelling one passes
   *  the hub plus every hunt zone it can reach. */
  boxes: BoundingBox[];
  /** Extra appearances to force in, e.g. NPC outfits the map cannot reveal. */
  extra?: Array<{ category: ThingCategory; id: number }>;
};

export type ClosureWarnings = {
  /** Server ids on tiles that items.otb does not know. */
  unknownServerIds: Map<number, number>;
  /** Server ids that map to clientId 0 — they exist but have no appearance. */
  noClientId: Map<number, number>;
  /** Client ids items.otb points at that the dat has no appearance for. */
  danglingClientIds: Map<number, number>;
};

export type Closure = {
  tiles: MapTile[];
  /** Appearances actually reachable from the cutout, per category. */
  appearances: Map<ThingCategory, Set<number>>;
  /** Every sprite id those appearances reference. */
  spriteIds: Set<number>;
  /** serverId -> clientId, restricted to what the cutout uses. */
  itemMap: Map<number, number>;
  warnings: ClosureWarnings;
  dat: DatFile;
  otb: OtbFile;
};

/**
 * Resolve what a cutout of the map actually needs.
 *
 * This is the whole point of the compiler: the sprite file holds 495,802
 * sprites and the map holds 11 million tiles, but a hub-sized box reaches
 * only a small fraction of either. Everything the closure does not reach
 * never enters a release.
 */
export function computeClosure(req: ClosureRequest): Closure {
  const otb = loadOtb(req.otbPath);
  const dat = loadDat(req.datPath);
  const scan = scanOtbm(req.mapPath, { boxes: req.boxes });

  const appearances = new Map<ThingCategory, Set<number>>([
    ['item', new Set<number>()],
    ['creature', new Set<number>()],
    ['effect', new Set<number>()],
    ['missile', new Set<number>()],
  ]);
  const spriteIds = new Set<number>();
  const itemMap = new Map<number, number>();

  const warnings: ClosureWarnings = {
    unknownServerIds: new Map(),
    noClientId: new Map(),
    danglingClientIds: new Map(),
  };

  const bump = (m: Map<number, number>, k: number) => m.set(k, (m.get(k) ?? 0) + 1);

  const addItem = (serverId: number): void => {
    if (serverId === 0) return;
    if (itemMap.has(serverId)) return;

    const clientId = otb.serverToClient.get(serverId);
    if (clientId === undefined) {
      bump(warnings.unknownServerIds, serverId);
      return;
    }
    if (clientId === 0) {
      bump(warnings.noClientId, serverId);
      return;
    }

    itemMap.set(serverId, clientId);
    addAppearance('item', clientId, warnings.danglingClientIds);
  };

  function addAppearance(category: ThingCategory, id: number, missing?: Map<number, number>): void {
    const set = appearances.get(category)!;
    if (set.has(id)) return;

    const thing = dat.things.get(category)?.get(id);
    if (!thing) {
      if (missing) bump(missing, id);
      return;
    }

    set.add(id);
    for (const s of thing.spriteIds) spriteIds.add(s);
  }

  for (const tile of scan.tiles) {
    addItem(tile.ground);
    for (const id of tile.items) addItem(id);
  }

  for (const e of req.extra ?? []) addAppearance(e.category, e.id);

  return { tiles: scan.tiles, appearances, spriteIds, itemMap, warnings, dat, otb };
}
