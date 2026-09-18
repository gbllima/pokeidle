#!/usr/bin/env node
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  loadRelease, loadChunk, listChunks, rasterChunk, rasterToPng, cropRaster, scaleRaster,
} from './raster.ts';
import type { CreaturePlacement } from './layout.ts';

/** Read the wild Pokemon a release ships, if it has any. */
function loadWildPlacements(dir: string): CreaturePlacement[] {
  const file = join(dir, 'spawns.json');
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8')) as {
    wild?: Array<{ x: number; y: number; z: number; look: number }>;
  };
  return (data.wild ?? []).map((w) => ({
    x: w.x,
    y: w.y,
    z: w.z,
    lookType: w.look,
  }));
}

/** Read the hub npc placements a release ships, if it has any. */
function loadNpcPlacements(dir: string): CreaturePlacement[] {
  const file = join(dir, 'npcs.json');
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8')) as {
    hub?: Array<{
      x: number; y: number; z: number; look: number;
      colors?: [number, number, number, number]; addons?: number;
    }>;
  };
  return (data.hub ?? []).map((n) => ({
    x: n.x,
    y: n.y,
    z: n.z,
    lookType: n.look,
    colors: n.colors,
    addons: n.addons,
  }));
}

const [dirArg, ...rest] = process.argv.slice(2);

if (!dirArg) {
  console.log(`pokeidle renderer

  <releaseDir>                    list the chunks in a release
  <releaseDir> <z/cx_cy> [--out f] [--phase n] [--margin px] [--no-npcs]
                         [--crop x,y,w,h] [--scale n] [--no-wild]
                                  rasterise one chunk to PNG
  <releaseDir> --all [--out dir]  rasterise every chunk`);
  process.exit(dirArg ? 1 : 0);
}

try {
  const dir = resolve(dirArg);
  const release = loadRelease(dir);
  const keys = listChunks(release);

  const all = rest.includes('--all');
  const key = rest.find((a) => !a.startsWith('--') && a.includes('/'));
  let out: string | undefined;
  let phase = 0;
  let margin = 64;
  let crop: [number, number, number, number] | undefined;
  let scale = 1;

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--out') out = resolve(rest[++i]!);
    else if (rest[i] === '--phase') phase = Number(rest[++i]);
    else if (rest[i] === '--margin') margin = Number(rest[++i]);
    else if (rest[i] === '--scale') scale = Number(rest[++i]);
    else if (rest[i] === '--crop') {
      const [cx, cy, cw, ch] = rest[++i]!.split(',').map(Number);
      crop = [cx!, cy!, cw!, ch!];
    }
  }

  const npcs = rest.includes('--no-npcs') ? [] : loadNpcPlacements(dir);
  const wild = rest.includes('--no-wild') ? [] : loadWildPlacements(dir);
  const creatures = [...npcs, ...wild];

  console.log(`release ${release.manifest.releaseId}`);
  console.log(
    `atlases ${release.atlases.length}  chunks ${keys.length}  ` +
      `npcs ${npcs.length}  wild ${wild.length}`,
  );

  if (!all && !key) {
    console.log('');
    for (const k of keys) console.log(`  ${k}`);
    console.log('');
    console.log('pass a chunk key to render it, or --all');
    process.exit(0);
  }

  const targets = all ? keys : [key!];
  const outDir = out && all ? out : undefined;
  if (outDir) mkdirSync(outDir, { recursive: true });

  for (const k of targets) {
    const chunk = loadChunk(release, k);
    const t = Date.now();
    let raster = rasterChunk(release, chunk, { phase, margin, creatures });
    if (crop) raster = cropRaster(raster, crop[0], crop[1], crop[2], crop[3]);
    if (scale > 1) raster = scaleRaster(raster, scale);
    const png = rasterToPng(raster);

    const file = outDir
      ? join(outDir, `chunk-${k.replace('/', '-')}.png`)
      : (out ?? resolve(dir, `chunk-${k.replace('/', '-')}.png`));
    writeFileSync(file, png);

    console.log(
      `  ${k.padEnd(10)} ${String(chunk.tiles.length).padStart(5)} tiles  ` +
        `${String(raster.drawn).padStart(6)} draws  ` +
        (raster.tinted ? `${String(raster.tinted).padStart(3)} tinted  ` : '') +
        (raster.missing ? `${raster.missing} MISSING  ` : '') +
        `${raster.width}x${raster.height}  ${Date.now() - t} ms  -> ${file}`,
    );
  }
} catch (err) {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
}
