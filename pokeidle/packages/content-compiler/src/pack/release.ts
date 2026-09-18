import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { Closure } from './closure.ts';
import type { AtlasSet } from './atlas.ts';
import { ATLAS_SIZE } from './atlas.ts';
import { CLIENT_VERSION, SPRITE_SIZE } from '../config.ts';
import type { BoundingBox } from '../formats/otbm.ts';
import { ATTR } from '../formats/dat.ts';
import type { ThingCategory, ThingType } from '../formats/dat.ts';

export const CHUNK_SIZE = 64;

/**
 * Draw order within a tile, mirroring how the desktop client layers things.
 * Emitted per appearance so the renderer needs one rule and no special cases.
 */
export function stackPriority(thing: ThingType): number {
  if (thing.flags.has(ATTR.ground)) return 0;
  if (thing.flags.has(ATTR.groundBorder)) return 1;
  if (thing.flags.has(ATTR.onBottom)) return 2;
  if (thing.flags.has(ATTR.onTop)) return 3;
  return 5;
}

export type ReleaseOptions = {
  outDir: string;
  /** Every area the release covers, in the order they were asked for. The
   *  first is the hub — where a new character starts. */
  boxes: BoundingBox[];
  /** Build fails when the release exceeds this many bytes. */
  byteBudget: number;
  mapName: string;
  /** Extra JSON documents to ship, keyed by filename without the extension. */
  datasets?: Record<string, unknown>;
  /** Already-encoded files to ship as-is, such as minimap images. */
  extraFiles?: Array<{ path: string; data: Buffer }>;
  /**
   * Per-thing metadata from the client's OTML files, keyed by category then
   * id. The dat does not carry it and `Effect::draw` cannot do without it.
   */
  thingMeta?: Partial<Record<ThingCategory, Map<number, { x: number; y: number; opacity: number; top: boolean }>>>;
};

export type ReleaseFile = {
  path: string;
  bytes: number;
  sha256: string;
};

export type ReleaseResult = {
  releaseId: string;
  files: ReleaseFile[];
  totalBytes: number;
  byteBudget: number;
  withinBudget: boolean;
  chunkCount: number;
  atlasCount: number;
  appearanceCount: number;
  spriteCount: number;
  tileCount: number;
};

export function emitRelease(closure: Closure, atlases: AtlasSet, opts: ReleaseOptions): ReleaseResult {
  const out = resolve(opts.outDir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'atlas'), { recursive: true });
  mkdirSync(join(out, 'chunks'), { recursive: true });

  const files: ReleaseFile[] = [];

  const write = (relPath: string, data: Buffer | string): void => {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const full = join(out, relPath);
    mkdirSync(resolve(full, '..'), { recursive: true });
    writeFileSync(full, buf);
    files.push({
      path: relPath.split('\\').join('/'),
      bytes: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
    });
  };

  // ── atlases ────────────────────────────────────────────────────────────────
  atlases.images.forEach((png, i) => {
    write(join('atlas', `atlas-${String(i).padStart(3, '0')}.png`), png);
  });

  // ── appearances ────────────────────────────────────────────────────────────
  // The browser gets geometry and animation timing only. Server-side flags
  // (walkability, stacking rules, light) stay on the server, which is what
  // makes the client unable to lie about them.
  const appearances: Record<string, unknown> = {};
  for (const [category, ids] of closure.appearances) {
    if (ids.size === 0) continue;
    const bucket: Record<string, unknown> = {};
    for (const id of [...ids].sort((a, b) => a - b)) {
      const thing = closure.dat.things.get(category)!.get(id)!;
      bucket[id] = {
        groups: thing.frameGroups.map((g) => ({
          t: g.type,
          w: g.width,
          h: g.height,
          l: g.layers,
          px: g.patternX,
          py: g.patternY,
          pz: g.patternZ,
          ph: g.phases,
          // Only the phase lower bound is used for playback; the client does
          // not roll random durations, the server owns anything that matters.
          d: g.animator ? g.animator.durations.map((p) => p[0]) : null,
          s: g.sprites,
        })),
        sp: stackPriority(thing),
        ...(thing.displacement ? { off: [thing.displacement.x, thing.displacement.y] } : {}),
        // `effects.otml` overrides where an effect lands and how solid it is.
        ...(() => {
          const meta = opts.thingMeta?.[category]?.get(id);
          if (!meta) return {};
          const extra: Record<string, unknown> = {};
          if (meta.x || meta.y) extra.eoff = [meta.x, meta.y];
          if (meta.opacity !== 1) extra.op = meta.opacity;
          if (meta.top) extra.top = 1;
          return extra;
        })(),
        ...(thing.elevation !== undefined ? { elev: thing.elevation } : {}),
        ...(thing.minimapColor !== undefined ? { mm: thing.minimapColor } : {}),
      };
    }
    appearances[category] = bucket;
  }

  const sprites: Record<string, [number, number, number]> = {};
  for (const [id, slot] of atlases.slots) sprites[id] = [slot.a, slot.x, slot.y];

  write(
    'appearances.json',
    JSON.stringify({
      clientVersion: CLIENT_VERSION,
      spriteSize: SPRITE_SIZE,
      atlasSize: ATLAS_SIZE,
      sprites,
      appearances,
    }),
  );

  // ── datasets ────────────────────────────────────────────────────────────────
  // Hunt zones and the species registry ride along with the world content so
  // one releaseId pins all of it: a client can never mix zones from one build
  // with appearances from another.
  for (const [name, payload] of Object.entries(opts.datasets ?? {})) {
    write(`${name}.json`, JSON.stringify(payload));
  }
  for (const file of opts.extraFiles ?? []) write(file.path, file.data);

  // ── chunks ─────────────────────────────────────────────────────────────────
  // Tiles carry clientIds, already resolved through items.otb. The browser
  // never receives the otb, and never needs it.
  type ChunkTile = {
    x: number;
    y: number;
    g?: number;
    i?: number[];
    f?: number;
    /** 1 when nothing can stand here. Absent means walkable. */
    b?: 1;
  };

  /**
   * Can something stand on this tile?
   *
   * The browser never sees items.otb or the dat, so it cannot answer this
   * itself, and without an answer a trainer walking to a Pokémon walks
   * straight across a lake. The dat already knows: `notWalkable` on any item
   * on the tile blocks it, and a tile with no ground at all is a hole.
   */
  const blocks = (clientId: number): boolean => {
    const thing = closure.dat.things.get('item')?.get(clientId);
    if (!thing) return false;
    return thing.flags.has(ATTR.notWalkable) || thing.flags.has(ATTR.notPathable);
  };
  const chunks = new Map<string, { cx: number; cy: number; z: number; tiles: ChunkTile[] }>();

  let tileCount = 0;
  for (const tile of closure.tiles) {
    const cx = Math.floor(tile.x / CHUNK_SIZE);
    const cy = Math.floor(tile.y / CHUNK_SIZE);
    const key = `${tile.z}/${cx}_${cy}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      chunk = { cx, cy, z: tile.z, tiles: [] };
      chunks.set(key, chunk);
    }

    const ground = tile.ground ? closure.itemMap.get(tile.ground) : undefined;
    const items = tile.items
      .map((sid) => closure.itemMap.get(sid))
      .filter((c): c is number => c !== undefined);

    const entry: ChunkTile = { x: tile.x - cx * CHUNK_SIZE, y: tile.y - cy * CHUNK_SIZE };
    if (ground) entry.g = ground;
    if (items.length) entry.i = items;
    if (tile.flags) entry.f = tile.flags;
    if (!ground || blocks(ground) || items.some(blocks)) entry.b = 1;

    chunk.tiles.push(entry);
    tileCount++;
  }

  for (const [key, chunk] of chunks) {
    write(join('chunks', `${key}.json`), JSON.stringify({ ...chunk, size: CHUNK_SIZE }));
  }

  // ── manifest ───────────────────────────────────────────────────────────────
  const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
  const releaseId = createHash('sha256')
    .update(files.map((f) => `${f.path}:${f.sha256}`).join('\n'))
    .digest('hex')
    .slice(0, 16);

  const manifest = {
    releaseId,
    createdAt: new Date().toISOString(),
    clientVersion: CLIENT_VERSION,
    source: { map: opts.mapName, box: opts.boxes[0], boxes: opts.boxes },
    counts: {
      tiles: tileCount,
      chunks: chunks.size,
      atlases: atlases.images.length,
      sprites: atlases.slots.size,
      appearances: [...closure.appearances.values()].reduce((n, s) => n + s.size, 0),
      creatures: closure.appearances.get('creature')?.size ?? 0,
    },
    datasets: Object.keys(opts.datasets ?? {}).sort(),
    budget: { bytes: totalBytes, limit: opts.byteBudget, ok: totalBytes <= opts.byteBudget },
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };

  // The manifest is written last and is deliberately not in its own file list.
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return {
    releaseId,
    files,
    totalBytes,
    byteBudget: opts.byteBudget,
    withinBudget: totalBytes <= opts.byteBudget,
    chunkCount: chunks.size,
    atlasCount: atlases.images.length,
    appearanceCount: manifest.counts.appearances,
    spriteCount: atlases.slots.size,
    tileCount,
  };
}

export function relOut(outDir: string, p: string): string {
  return relative(process.cwd(), join(outDir, p));
}

export type { ThingCategory };
