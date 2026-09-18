#!/usr/bin/env node
import { writeFileSync, mkdirSync, statSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { PATHS, CLIENT_VERSION, FEATURES, SPRITE_SIZE } from './config.ts';
import { SprFile } from './formats/spr.ts';
import { loadDat, CATEGORIES } from './formats/dat.ts';
import type { ThingCategory, ThingType } from './formats/dat.ts';
import { loadOtb } from './formats/otb.ts';
import { scanOtbm, readOtbmHeader, decodeTileFlags } from './formats/otbm.ts';
import type { BoundingBox } from './formats/otbm.ts';
import { encodePng } from './io/png.ts';
import { loadSpecies } from './formats/species.ts';
import { loadSpawns } from './formats/spawns.ts';
import { loadNpcs } from './formats/npcs.ts';
import { loadSpells } from './formats/spells.ts';
import { loadThingOtml } from './formats/thing-otml.ts';
import { loadItemsXml } from './formats/items-xml.ts';
import { parseBalls } from './formats/balls.ts';
import { parsePremiumShop, DIAMOND_SID } from './formats/premium-shop.ts';
import { resolveLooks } from './tools/resolve-looks.ts';
import { buildHunts, resolveSpecies } from './pack/hunts.ts';
import type { HuntZone } from './pack/hunts.ts';
import { computeClosure } from './pack/closure.ts';
import { renderRegionMinimaps, type RegionRequest } from './pack/minimap.ts';
import { buildGyms } from './pack/gyms.ts';
import { packAtlases } from './pack/atlas.ts';
import { emitRelease } from './pack/release.ts';

const MB = 1024 * 1024;
const NL = String.fromCharCode(10);
const fmt = (n: number) => n.toLocaleString('en-US');
const mb = (n: number) => `${(n / MB).toFixed(1)} MB`;

function head(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  console.log('-'.repeat(Math.min(title.length + 12, 64)));
}

function ensureOut(): string {
  mkdirSync(PATHS.out, { recursive: true });
  return PATHS.out;
}

function requireFile(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(
      `${label} not found at ${path}\nSet POKEIDLE_ROOT to the folder holding cliente/ and servidor/.`,
    );
  }
}

// -- info ---------------------------------------------------------------------

function cmdInfo(): void {
  head('Compatibility matrix');
  console.log(`clientVersion        ${CLIENT_VERSION}`);
  for (const [k, v] of Object.entries(FEATURES)) {
    console.log(`${k.padEnd(21)}${v}`);
  }
  console.log('\nSource: cliente/modules/game_features/features.lua');
  console.log('The client never parses Tibia.otfi, so that file is not authoritative.');

  head('Tibia.dat');
  requireFile(PATHS.dat, 'Tibia.dat');
  const t0 = Date.now();
  const dat = loadDat(PATHS.dat);
  const datMs = Date.now() - t0;
  console.log(`signature            0x${dat.signature.toString(16).toUpperCase().padStart(8, '0')}`);

  let appearances = 0;
  let spriteRefs = 0;
  const referenced = new Set<number>();
  for (const cat of CATEGORIES) {
    const m = dat.things.get(cat)!;
    appearances += m.size;
    for (const th of m.values()) {
      spriteRefs += th.spriteIds.length;
      for (const s of th.spriteIds) referenced.add(s);
    }
    console.log(`${cat.padEnd(21)}${fmt(m.size)}`);
  }
  console.log(`total appearances    ${fmt(appearances)}`);
  console.log(`sprite references    ${fmt(spriteRefs)}`);
  console.log(`distinct sprites     ${fmt(referenced.size)}`);
  console.log(`parsed in            ${datMs} ms`);

  head('Tibia.spr');
  requireFile(PATHS.spr, 'Tibia.spr');
  const spr = SprFile.open(PATHS.spr);
  const nonEmpty = spr.countNonEmpty();
  console.log(`signature            0x${spr.signature.toString(16).toUpperCase().padStart(8, '0')}`);
  console.log(`file size            ${mb(spr.fileSize)}`);
  console.log(`sprites declared     ${fmt(spr.count)}`);
  console.log(`sprites with pixels  ${fmt(nonEmpty)}`);
  console.log(`sprite size          ${SPRITE_SIZE}x${SPRITE_SIZE} RGBA`);
  const unused = spr.count - referenced.size;
  console.log(`unreferenced by dat  ${fmt(unused)}  (${((unused / spr.count) * 100).toFixed(1)}%)`);
  spr.close();

  head('items.otb');
  requireFile(PATHS.otb, 'items.otb');
  const otb = loadOtb(PATHS.otb);
  console.log(`otb format version   ${otb.majorVersion}`);
  console.log(`built for client     ${otb.clientVersion ?? '?'} (clientVersion_t ordinal ${otb.minorVersion})`);
  console.log(`build number         ${otb.buildNumber}`);
  console.log(`item definitions     ${fmt(otb.items.length)}`);
  console.log(`serverId -> clientId ${fmt(otb.serverToClient.size)} mappings`);
  console.log(`without clientId     ${fmt(otb.items.filter((i) => i.clientId === 0).length)}`);

  head('Maps');
  for (const p of [PATHS.map2, PATHS.map]) {
    if (!existsSync(p)) continue;
    const size = statSync(p).size;
    const t = Date.now();
    const h = readOtbmHeader(p);
    console.log(
      `${basename(p).padEnd(12)} ${mb(size).padStart(10)}  ${h.width}x${h.height}  ` +
        `otbm v${h.otbmVersion}  items ${h.majorVersionItems}.${h.minorVersionItems}  ${Date.now() - t} ms`,
    );
    if (h.description) console.log(`${''.padEnd(12)} ${h.description.split(NL)[0]}`);
    if (h.spawnFile) console.log(`${''.padEnd(12)} spawns: ${h.spawnFile}   houses: ${h.houseFile}`);
  }

  head('Consistency');
  const agree = otb.clientVersion === CLIENT_VERSION;
  console.log(
    `${agree ? 'OK  ' : 'WARN'} items.otb targets client ${otb.clientVersion ?? '?'}, dat/spr are ${CLIENT_VERSION}`,
  );
  let dangling = 0;
  const items = dat.things.get('item')!;
  for (const cid of otb.serverToClient.values()) {
    if (cid !== 0 && !items.has(cid)) dangling++;
  }
  console.log(`${dangling === 0 ? 'OK  ' : 'WARN'} ${fmt(dangling)} otb clientIds missing from dat`);
}

// -- sprite -------------------------------------------------------------------

function cmdSprite(args: string[]): void {
  const ids = args.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) throw new Error('usage: sprite <id> [id...]');

  requireFile(PATHS.spr, 'Tibia.spr');
  const spr = SprFile.open(PATHS.spr);
  const out = ensureOut();

  for (const id of ids) {
    const px = spr.getSprite(id);
    if (!px) {
      console.log(`sprite ${id}: blank`);
      continue;
    }
    let opaque = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i]! > 0) opaque++;
    const file = resolve(out, `sprite-${id}.png`);
    writeFileSync(file, encodePng(SPRITE_SIZE, SPRITE_SIZE, px));
    console.log(`sprite ${id}: ${opaque}/${SPRITE_SIZE * SPRITE_SIZE} visible px -> ${file}`);
  }
  spr.close();
}

// -- thing --------------------------------------------------------------------

function cmdThing(args: string[]): void {
  const [catArg, idArg] = args;
  const category = catArg as ThingCategory;
  if (!CATEGORIES.includes(category)) {
    throw new Error(`usage: thing <${CATEGORIES.join('|')}> <id>`);
  }
  const id = Number(idArg);
  if (!Number.isInteger(id)) throw new Error('id must be an integer');

  requireFile(PATHS.dat, 'Tibia.dat');
  const dat = loadDat(PATHS.dat);
  const thing = dat.things.get(category)?.get(id);
  if (!thing) throw new Error(`${category} ${id} not found (max ${dat.counts[category]})`);

  head(`${category} ${id}`);
  console.log(`frame groups         ${thing.frameGroups.length}`);
  for (const [i, g] of thing.frameGroups.entries()) {
    console.log(
      `  group ${i} (${g.type === 1 ? 'moving' : 'idle'})  ${g.width}x${g.height} tiles  ` +
        `layers ${g.layers}  patterns ${g.patternX}/${g.patternY}/${g.patternZ}  ` +
        `phases ${g.phases}  sprites ${g.sprites.length}`,
    );
    if (g.animator) {
      const d = g.animator.durations;
      const lo = Math.min(...d.map((p) => p[0]));
      const hi = Math.max(...d.map((p) => p[0] + p[1]));
      console.log(
        `    animator: loop ${g.animator.loopCount}, start ${g.animator.startPhase}, ${lo}-${hi} ms/phase`,
      );
    }
  }
  console.log(`distinct sprites     ${new Set(thing.spriteIds).size}`);
  if (thing.market) console.log(`market name          ${thing.market.name}`);
  if (thing.groundSpeed !== undefined) console.log(`ground speed         ${thing.groundSpeed}`);
  if (thing.light) console.log(`light                ${thing.light.intensity}/${thing.light.color}`);
  if (thing.displacement) console.log(`displacement         ${thing.displacement.x},${thing.displacement.y}`);
  if (thing.elevation !== undefined) console.log(`elevation            ${thing.elevation}`);
  console.log(`flags                ${[...thing.flags].sort((a, b) => a - b).join(', ') || '(none)'}`);

  renderThing(thing, `${category}-${id}`);
}

/** Compose phase 0 of every pattern into one sheet so it can be eyeballed. */
function renderThing(thing: ThingType, name: string): void {
  const g = thing.frameGroups[0];
  if (!g || g.sprites.length === 0) {
    console.log('nothing to render');
    return;
  }

  requireFile(PATHS.spr, 'Tibia.spr');
  const spr = SprFile.open(PATHS.spr);

  const cols = g.patternX * g.width;
  const rows = g.patternY * g.height;
  const w = cols * SPRITE_SIZE;
  const h = rows * SPRITE_SIZE;
  const canvas = Buffer.alloc(w * h * 4);

  // Index order matches how the client walks m_spritesIndex.
  const idx = (layer: number, px: number, py: number, pz: number, phase: number, cx: number, cy: number) => {
    let i = phase;
    i = i * g.patternZ + pz;
    i = i * g.patternY + py;
    i = i * g.patternX + px;
    i = i * g.layers + layer;
    i = i * g.height + cy;
    i = i * g.width + cx;
    return i;
  };

  for (let py = 0; py < g.patternY; py++) {
    for (let px = 0; px < g.patternX; px++) {
      for (let cy = 0; cy < g.height; cy++) {
        for (let cx = 0; cx < g.width; cx++) {
          const sid = g.sprites[idx(0, px, py, 0, 0, cx, cy)];
          if (!sid) continue;
          const pixels = spr.getSprite(sid);
          if (!pixels) continue;
          // Multi-tile appearances anchor at the bottom-right block.
          const dx = (px * g.width + (g.width - 1 - cx)) * SPRITE_SIZE;
          const dy = (py * g.height + (g.height - 1 - cy)) * SPRITE_SIZE;
          blit(canvas, w, pixels, dx, dy);
        }
      }
    }
  }

  spr.close();
  const file = resolve(ensureOut(), `${name}.png`);
  writeFileSync(file, encodePng(w, h, canvas));
  console.log(`rendered             ${w}x${h} -> ${file}`);
}

function blit(dst: Buffer, dstW: number, src: Buffer, dx: number, dy: number): void {
  for (let y = 0; y < SPRITE_SIZE; y++) {
    const srcRow = y * SPRITE_SIZE * 4;
    const dstRow = ((dy + y) * dstW + dx) * 4;
    for (let x = 0; x < SPRITE_SIZE * 4; x += 4) {
      if (src[srcRow + x + 3] === 0) continue;
      src.copy(dst, dstRow + x, srcRow + x, srcRow + x + 4);
    }
  }
}

// -- otb ----------------------------------------------------------------------

function cmdOtb(args: string[]): void {
  requireFile(PATHS.otb, 'items.otb');
  const otb = loadOtb(PATHS.otb);

  if (args.length === 0) {
    head('items.otb');
    console.log(`format ${otb.majorVersion}, client ${otb.clientVersion ?? '?'}, build ${otb.buildNumber}`);
    console.log(`${fmt(otb.items.length)} definitions`);
    const byGroup = new Map<string, number>();
    for (const i of otb.items) byGroup.set(i.groupName, (byGroup.get(i.groupName) ?? 0) + 1);
    for (const [g, n] of [...byGroup].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${g.padEnd(12)} ${fmt(n).padStart(7)}`);
    }
    return;
  }

  for (const a of args) {
    const sid = Number(a);
    const item = otb.items.find((i) => i.serverId === sid);
    if (!item) {
      console.log(`serverId ${sid}: not found`);
      continue;
    }
    console.log(
      `serverId ${item.serverId} -> clientId ${item.clientId}  group ${item.groupName}  ` +
        `flags 0x${item.flags.toString(16)}` +
        (item.topOrder !== undefined ? `  topOrder ${item.topOrder}` : '') +
        (item.speed !== undefined ? `  speed ${item.speed}` : ''),
    );
  }
}

// -- map ----------------------------------------------------------------------

function cmdMap(args: string[]): void {
  let file = PATHS.map2;
  let box: Record<string, number> | undefined;
  let limit: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--full') file = PATHS.map;
    else if (a === '--file') file = resolve(args[++i]!);
    else if (a === '--limit') limit = Number(args[++i]);
    else if (a === '--box') {
      const [x1, y1, x2, y2, z1, z2] = args[++i]!.split(',').map(Number);
      box = {
        minX: x1!,
        minY: y1!,
        maxX: x2!,
        maxY: y2!,
        minZ: z1 ?? 0,
        maxZ: z2 ?? z1 ?? 15,
      };
    }
  }

  requireFile(file, 'map');
  head(basename(file));
  const t = Date.now();
  const r = scanOtbm(file, { box, limit });
  const ms = Date.now() - t;

  console.log(`otbm version         ${r.header.otbmVersion}`);
  console.log(`declared size        ${r.header.width} x ${r.header.height}`);
  console.log(`items version        ${r.header.majorVersionItems}.${r.header.minorVersionItems}`);
  if (r.header.description) console.log(`description          ${r.header.description.replace(/\n/g, ' | ')}`);
  if (r.header.spawnFile) console.log(`spawn file           ${r.header.spawnFile}`);
  if (r.header.houseFile) console.log(`house file           ${r.header.houseFile}`);
  console.log(
    `${r.boxed ? 'tiles visited        ' : 'tiles in file        '}${fmt(r.tilesVisited)}` +
      (r.boxed ? '   (areas outside the box were skipped whole)' : ''),
  );
  console.log(
    `extent               x ${r.extent.minX}..${r.extent.maxX}  y ${r.extent.minY}..${r.extent.maxY}  z ${r.extent.minZ}..${r.extent.maxZ}`,
  );
  console.log(`scanned in           ${ms} ms`);

  if (!box) return;

  console.log(`\ntiles collected      ${fmt(r.tiles.length)}`);
  let withGround = 0;
  let totalItems = 0;
  const flagged = new Map<string, number>();
  for (const tile of r.tiles) {
    if (tile.ground) withGround++;
    totalItems += tile.items.length;
    for (const f of decodeTileFlags(tile.flags)) flagged.set(f, (flagged.get(f) ?? 0) + 1);
  }
  console.log(`with ground          ${fmt(withGround)}`);
  console.log(`stacked items        ${fmt(totalItems)}`);
  for (const [f, n] of flagged) console.log(`  ${f.padEnd(12)} ${fmt(n)}`);

  for (const tile of r.tiles.slice(0, 8)) {
    console.log(
      `  [${tile.x},${tile.y},${tile.z}] ground ${tile.ground}` +
        (tile.items.length ? ` + ${tile.items.join(',')}` : '') +
        (tile.houseId ? ` house ${tile.houseId}` : ''),
    );
  }
}

// -- towns --------------------------------------------------------------------

function cmdTowns(args: string[]): void {
  const file = args.includes('--map2') ? PATHS.map2 : PATHS.map;
  const filter = args.find((a) => !a.startsWith('--'))?.toLowerCase();

  requireFile(file, 'map');
  head(`${basename(file)} - towns`);
  const t = Date.now();
  // Tile areas are rejected wholesale; only the town and waypoint nodes are read.
  const r = scanOtbm(file, { skipTiles: true });
  console.log(`${fmt(r.towns.length)} towns, ${fmt(r.waypoints.length)} waypoints, ${Date.now() - t} ms
`);

  const rows = filter ? r.towns.filter((x) => x.name.toLowerCase().includes(filter)) : r.towns;
  if (rows.length === 0) {
    console.log(filter ? `no town matching "${filter}"` : 'no towns in this map');
    return;
  }

  console.log(`${'id'.padStart(4)}  ${'name'.padEnd(24)} temple position`);
  for (const town of rows) {
    console.log(
      `${String(town.id).padStart(4)}  ${town.name.padEnd(24)} ` +
        `${town.temple.x}, ${town.temple.y}, ${town.temple.z}`,
    );
  }

  if (rows.length === 1) {
    const t1 = rows[0]!;
    const r64 = 32;
    console.log(
      `
suggested 64x64 cutout around ${t1.name}:
` +
        `  --box ${t1.temple.x - r64},${t1.temple.y - r64},${t1.temple.x + r64},${t1.temple.y + r64},${t1.temple.z}`,
    );
  }
}

// -- species ------------------------------------------------------------------

function cmdSpecies(args: string[]): void {
  const reg = loadSpecies(PATHS.monsters);
  const query = args.find((a) => !a.startsWith('--'));

  if (!query) {
    head('Species registry');
    const base = reg.all.filter((s) => s.variant === 'base').length;
    const shiny = reg.all.filter((s) => s.variant === 'shiny').length;
    const mega = reg.all.filter((s) => s.variant === 'mega').length;
    console.log(`scripts parsed       ${fmt(reg.all.length)}`);
    console.log(`base forms           ${fmt(base)}`);
    console.log(`shiny forms          ${fmt(shiny)}`);
    console.log(`mega forms           ${fmt(mega)}`);
    console.log(`unreadable           ${fmt(reg.unreadable.length)}`);
    console.log(`incomplete           ${fmt(reg.incomplete.length)}`);
    console.log('');
    for (const [r, n] of [...reg.regions].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${r.padEnd(10)} ${fmt(n).padStart(5)}`);
    }

    if (reg.collisions.length) {
      head('Name collisions');
      console.log(`${fmt(reg.collisions.length)} scripts register a name that disagrees with their folder.`);
      console.log('On the live server the later load wins, so these silently shadow each other.');
      console.log('');
      const kinds = new Map<string, number>();
      for (const c of reg.collisions) {
        const k = `${c.folderVariant} folder -> registers a ${c.nameVariant} name`;
        kinds.set(k, (kinds.get(k) ?? 0) + 1);
      }
      for (const [k, n] of kinds) console.log(`  ${String(n).padStart(3)}x  ${k}`);
      console.log('');
      for (const c of reg.collisions.slice(0, 6)) {
        console.log(`  ${basename(c.file).padEnd(28)} registers "${c.registeredName}"`);
      }
    }
    return;
  }

  const hit = resolveSpecies(reg, query);
  if (!hit) throw new Error(`no species matching "${query}"`);

  head(hit.name);
  console.log(`slug                 ${hit.slug}`);
  console.log(`variant / region     ${hit.variant} / ${hit.region}`);
  console.log(`lookType             ${hit.lookType}`);
  console.log(`types                ${[hit.type1, hit.type2].filter(Boolean).join(' / ')}`);
  console.log(`health               ${fmt(hit.health)}  (wild x${hit.wildHealthMultiplier} = ${fmt(Math.round(hit.health * hit.wildHealthMultiplier))})`);
  console.log(`experience           ${fmt(hit.experience)}`);
  console.log(`speed                ${hit.speed}`);
  console.log(`required level       ${hit.minimumLevel}`);
  console.log(`catch chance         ${hit.catchChance}`);
  console.log(`attack / defense     ${hit.attackBase} / ${hit.defenseBase}`);
  console.log(`has shiny / mega     ${hit.hasShiny} / ${hit.hasMega}`);
  console.log(`loot entries         ${hit.loot.length}`);
  for (const l of hit.loot.slice(0, 8)) {
    console.log(`  ${l.id.padEnd(28)} chance ${fmt(l.chance).padStart(9)}  max ${l.maxCount}`);
  }
  console.log(`file                 ${hit.file}`);
}

// -- hunts --------------------------------------------------------------------

function cmdHunts(args: string[]): void {
  let threshold = 30;
  let minPoints = 2;
  let query: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--threshold') threshold = Number(args[++i]);
    else if (a === '--min') minPoints = Number(args[++i]);
    else if (!a.startsWith('--')) query = a.toLowerCase();
  }

  const reg = loadSpecies(PATHS.monsters);
  const spawns = loadSpawns(PATHS.spawns);
  const t = Date.now();
  const build = buildHunts(spawns, reg, { threshold, minPoints });
  const ms = Date.now() - t;

  head('Hunt zones');
  console.log(`spawn points         ${fmt(spawns.points)}`);
  console.log(`monster placements   ${fmt(spawns.monsters.length)}`);
  if (spawns.repairedSpawntimes) {
    console.log(`WARN repaired        ${fmt(spawns.repairedSpawntimes)} nonsense spawntimes in the source xml`);
  }
  console.log(`zones built          ${fmt(build.zones.length)}`);
  console.log(`distinct species     ${fmt(new Set(build.zones.map((z) => z.species)).size)}`);
  console.log(`clustered in         ${ms} ms  (threshold ${threshold}, min ${minPoints} points)`);

  if (build.unresolved.size) {
    const total = [...build.unresolved.values()].reduce((a, b) => a + b, 0);
    console.log('');
    console.log(`WARN ${fmt(build.unresolved.size)} spawn names have no script (${fmt(total)} placements)`);
    for (const [name, n] of [...build.unresolved].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`  ${name.padEnd(28)} x${n}`);
    }
  }

  const rows = query ? build.zones.filter((z) => z.species.includes(query) || z.region.toLowerCase() === query) : build.zones;

  head(query ? `Zones matching "${query}"` : 'Lowest level zones');
  const show = query ? rows.slice(0, 30) : rows.slice(0, 20);
  console.log(`${'lvl'.padStart(4)}  ${'species'.padEnd(20)} ${'region'.padEnd(8)} ${'pop'.padStart(4)}  centre`);
  for (const z of show) {
    console.log(
      `${String(z.requiredLevel).padStart(4)}  ${z.displayName.padEnd(20)} ${z.region.padEnd(8)} ` +
        `${String(z.population).padStart(4)}  ${z.center.x},${z.center.y},${z.center.z}` +
        `  ${z.types.join('/')}`,
    );
  }
  if (rows.length > show.length) console.log(`  ... and ${fmt(rows.length - show.length)} more`);

  const levels = build.zones.map((z) => z.requiredLevel).sort((a, b) => a - b);
  head('Level curve');
  for (const p of [0, 25, 50, 75, 100]) {
    const v = levels[Math.min(levels.length - 1, Math.floor((levels.length - 1) * (p / 100)))];
    console.log(`  p${String(p).padStart(3)}  level ${v}`);
  }
}

// -- pack ---------------------------------------------------------------------

/**
 * Depot server ids, read from data/items/items.xml where they carry
 * `type="depot"`. The map stores server ids, so these match tiles directly.
 */
const DEPOT_SERVER_IDS = new Set([2589, 2590, 2591, 2592, 26699, 34295, 34296]);

/**
 * Player outfits: the two entries named "Trainer" in data/XML/outfits.xml,
 * type 1 (male, 1112) and type 0 (female, 1113).
 *
 * Not the maleOutfit/femaleOutfit in config.lua. Those say 510 and 511, and
 * 510 renders as Tyranitar — the config is stale. The outfits.xml pair is
 * the diagonal trainer pose the reference game shows in its profile panel.
 *
 * No tile or spawn references them, so they have to be named explicitly or
 * the player character has nothing to render as.
 */
const PLAYER_LOOKTYPES = [1112, 1113];

/**
 * Loot chances in this fork are out of ten million, not the hundred thousand
 * `MAX_LOOTCHANCE` in servidor/src/monsters.h suggests. That constant only
 * clamps the XML loader; Pokemon are defined in Lua, and
 * scripts/lib/register_monster_type.lua passes the value straight through
 * with `setChance`. data/lib/systems/pokedex.lua settles the scale when it
 * renders a percentage as `chance / 10000000 * 100`.
 *
 * So a chance of 8,000,000 is an 80% drop, not a guaranteed one.
 */
const LOOT_CHANCE_SCALE = 10_000_000;

/** What a player can do at a point on the map. */
function npcInteraction(def: { script: string; name: string; hasShop: boolean }): string | null {
  const script = def.script.toLowerCase();
  const name = def.name.toLowerCase();
  if (script.includes('heal') || name.startsWith('nurse') || name.includes('joy')) return 'heal';
  if (def.hasShop) return 'shop';
  return null;
}

/**
 * Everything derived from the spawn file, loaded once.
 *
 * The hub path and the hunt path both need species, spawns, npcs and the
 * clustered zones; parsing them twice would double the slowest part of a pack.
 */
function loadWorldData() {
  const reg = loadSpecies(PATHS.monsters);
  const spawns = loadSpawns(PATHS.spawns);
  const npcs = loadNpcs(PATHS.npcs);
  const hunts = buildHunts(spawns, reg);
  return { reg, spawns, npcs, hunts };
}

function parseBox(spec: string) {
  const [x1, y1, x2, y2, z1, z2] = spec.split(',').map(Number);
  if ([x1, y1, x2, y2].some((n) => !Number.isFinite(n))) {
    throw new Error('--box needs x1,y1,x2,y2,z1[,z2]');
  }
  return {
    minX: Math.min(x1!, x2!),
    maxX: Math.max(x1!, x2!),
    minY: Math.min(y1!, y2!),
    maxY: Math.max(y1!, y2!),
    minZ: z1 ?? 7,
    maxZ: z2 ?? z1 ?? 7,
  };
}

function cmdPack(args: string[]): void {
  const boxSpecs: string[] = [];
  const huntIds: string[] = [];
  let outDir = resolve(PATHS.out, 'release');
  let budgetMb = 25;
  let mapPath = PATHS.map;
  let withHunts = false;
  let pad = 8;
  let allSpecies = false;
  let withMinimaps = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--box') boxSpecs.push(args[++i]!);
    else if (a === '--out') outDir = resolve(args[++i]!);
    else if (a === '--budget') budgetMb = Number(args[++i]);
    else if (a === '--map2') mapPath = PATHS.map2;
    else if (a === '--with-hunts') withHunts = true;
    else if (a === '--hunt') huntIds.push(args[++i]!);
    else if (a === '--pad') pad = Number(args[++i]);
    else if (a === '--all-species') allSpecies = true;
    else if (a === '--minimaps') withMinimaps = true;
  }
  if (boxSpecs.length === 0 && huntIds.length === 0) {
    throw new Error(
      'usage: pack (--box x1,y1,x2,y2,z1[,z2] | --hunt <zoneId>)... [--out dir] [--budget mb]' + NL +
        'both flags repeat: one release can hold the hub and every hunt zone it travels to',
    );
  }

  // The spawn-derived data is needed by both the hub and the hunt paths, so
  // it is loaded once and shared rather than parsed twice.
  let world: ReturnType<typeof loadWorldData> | null = null;
  const getWorld = () => (world ??= loadWorldData());

  // Explicit boxes first, so the hub stays index 0 and a travelling release
  // knows where a new character starts.
  const boxes: BoundingBox[] = boxSpecs.map(parseBox);
  const packedZones: HuntZone[] = [];

  if (huntIds.length) {
    const { hunts } = getWorld();
    head('Hunt zones');
    for (const huntId of huntIds) {
      const zone = hunts.zones.find((z) => z.id === huntId);
      if (!zone) {
        const near = hunts.zones
          .filter((z) => z.id.includes(huntId) || z.species.includes(huntId))
          .slice(0, 8)
          .map((z) => `  ${z.id}`);
        throw new Error(
          `no hunt zone "${huntId}"` +
            (near.length ? NL + 'did you mean:' + NL + near.join(NL) : ''),
        );
      }
      // A zone box is the extent of its spawn points; padding gives the player
      // somewhere to stand and the renderer some scenery around the fight.
      const zbox: BoundingBox = {
        minX: zone.box.minX - pad,
        maxX: zone.box.maxX + pad,
        minY: zone.box.minY - pad,
        maxY: zone.box.maxY + pad,
        minZ: zone.z,
        maxZ: zone.z,
      };
      boxes.push(zbox);
      packedZones.push(zone);
      withHunts = true;

      console.log(
        `${zone.id.padEnd(30)} nv ${String(zone.requiredLevel).padStart(3)}  ` +
          `${String(zone.population).padStart(4)} spawns  ` +
          `${zbox.minX},${zbox.minY}..${zbox.maxX},${zbox.maxY} z${zone.z}`,
      );
    }
  }

  /** A tile, spawn or npc counts when it falls inside any packed area. */
  const inAnyBox = (x: number, y: number, z: number) =>
    boxes.some(
      (b) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ,
    );

  /*
   * Every zone whose Pokemon are inside the release, not only the ones named
   * on the command line.
   *
   * A hunt zone is playable when the player can stand in it and find something
   * to fight, and that is decided by the tiles and spawns that ended up in the
   * bundle — a zone sitting inside the hub's own box has both. Listing only
   * the requested ids is why the map answered "not part of this release" for
   * hunts whose ground was already packed.
   */
  const markPlayableZones = () => {
    const { hunts, spawns, reg: species } = getWorld();
    const already = new Set(packedZones.map((z) => z.id));

    // Spawns inside the release, counted per species so a zone can ask.
    const live = new Map<string, number>();
    for (const m of spawns.monsters) {
      if (!inAnyBox(m.x, m.y, m.z)) continue;
      const key = m.name.toLowerCase().trim();
      live.set(key, (live.get(key) ?? 0) + 1);
    }

    for (const zone of hunts.zones) {
      if (already.has(zone.id)) continue;
      if (!inAnyBox(zone.center.x, zone.center.y, zone.z)) continue;
      const sp = species.variants.get(`${zone.variant}:${zone.species}`);
      const name = (sp?.name ?? zone.displayName).toLowerCase().trim();
      if (!live.get(name)) continue;
      packedZones.push(zone);
    }
  };

  requireFile(mapPath, 'map');
  requireFile(PATHS.otb, 'items.otb');
  requireFile(PATHS.dat, 'Tibia.dat');
  requireFile(PATHS.spr, 'Tibia.spr');

  // Creature appearances are not reachable from tiles: the map stores items,
  // and every Pokemon or NPC on it is placed by the spawn file at runtime.
  // They have to be named explicitly or the world renders empty of life.
  const extra: Array<{ category: ThingCategory; id: number }> = [];
  const datasets: Record<string, unknown> = {};
  let minimapFiles: Array<{ name: string; png: Buffer; meta: Record<string, unknown> }> = [];
  // The minimap render needs the same otb/dat the closure will load; these
  // thunks keep it from parsing them a second time.
  let otbCache: ReturnType<typeof loadOtb> | null = null;
  let datCache: ReturnType<typeof loadDat> | null = null;
  const otbForMinimap = () => (otbCache ??= loadOtb(PATHS.otb));
  const datForMinimap = () => (datCache ??= loadDat(PATHS.dat));
  // items.xml is 10,000 entries; parsing it once per species would parse it
  // 595 times.
  let itemsXmlCache: ReturnType<typeof loadItemsXml> | null = null;
  const itemsXmlOnce = () => (itemsXmlCache ??= loadItemsXml(PATHS.itemsXml));
  let huntSummary = '';

  if (withHunts) {
    head('Hunts');
    const { reg, spawns, npcs, hunts: build } = getWorld();

    /*
     * Which creature in the sprite pack each species actually is.
     *
     * See tools/resolve-looks.ts. The monster scripts and this client's
     * Tibia.dat come from different builds, so `lookType = 1503` is a Torchic
     * to the server and a bird-headed humanoid to the pack — but the ids are
     * shifted in runs, not scrambled, and each species' own corpse ("a fainted
     * torchic") is a named sample of its colours to find the run by.
     *
     * A species that cannot be placed keeps its declared id and is marked
     * `spriteOk: false`; the client draws its artwork rather than a stranger.
     */
    const lookSpr = SprFile.open(PATHS.spr);
    const lookDat = loadDat(PATHS.dat);

    // Corpse sprites, by the name items.xml gives them.
    const corpseSprites = new Map<string, number[]>();
    {
      const xmlItems = itemsXmlOnce();
      const datItems = lookDat.things.get('item')!;
      for (const def of xmlItems.bySid.values()) {
        const fainted = /^(?:a |an )?fainted (.+)$/i.exec(def.name.trim());
        if (!fainted) continue;
        const cid = otbForMinimap().serverToClient.get(def.serverId);
        const group = cid ? datItems.get(cid)?.frameGroups[0] : undefined;
        if (group?.sprites.length) corpseSprites.set(fainted[1]!.toLowerCase().trim(), group.sprites);
      }
    }

    const looksFound = resolveLooks(
      reg.all
        .filter((sp) => sp.lookType && sp.variant === 'base')
        .map((sp) => ({ slug: sp.slug, variant: sp.variant, name: sp.name, look: sp.lookType })),
      lookDat.things.get('creature')!,
      corpseSprites,
      lookSpr,
    );
    lookSpr.close();

    const lookOf = (sp: { slug: string; variant: string; lookType: number }) =>
      looksFound.byKey.get(`${sp.slug}|${sp.variant}`)?.look ?? sp.lookType;
    const spriteOk = (sp: { slug: string; variant: string }) =>
      looksFound.byKey.get(`${sp.slug}|${sp.variant}`)?.resolved ?? false;

    console.log(
      `looktypes resolved   ${fmt(looksFound.resolved)} of ${fmt(looksFound.byKey.size)} species ` +
        `(${fmt(looksFound.anchors)} anchors, ${fmt(looksFound.moved)} moved off the declared id)`,
    );
    console.log(`corpse sprites       ${fmt(corpseSprites.size)} named in items.xml`);
    for (const run of looksFound.runs.slice(0, 24)) {
      console.log(
        `  from ${String(run.from).padStart(4)}  shift ${String(run.shift).padStart(6)}  (${run.name})`,
      );
    }

    const looks = new Set<number>(PLAYER_LOOKTYPES);

    // The pokedex needs a portrait for every species, not just the ones a
    // hunt zone spawns. That roughly triples the sprite count, so it is opt-in.
    if (allSpecies) {
      for (const sp of reg.all) if (sp.lookType && spriteOk(sp)) looks.add(lookOf(sp));
    }

    const huntSpecies = new Set(build.zones.map((z) => `${z.variant}:${z.species}`));
    for (const key of huntSpecies) {
      const sp = reg.variants.get(key);
      if (sp?.lookType && spriteOk(sp)) looks.add(lookOf(sp));
    }

    // NPCs standing inside the hub cutout.
    const hubNpcs = spawns.npcs.filter((n) => inAnyBox(n.x, n.y, n.z));
    const hubNpcDefs = new Map<string, ReturnType<typeof loadNpcs>['all'][number]>();
    const placements: Array<Record<string, unknown>> = [];
    for (const n of hubNpcs) {
      const def = npcs.byName.get(n.name.toLowerCase().trim());
      if (!def?.lookType) continue;
      looks.add(def.lookType);
      hubNpcDefs.set(def.slug, def);
      // Position matters as much as the outfit: without it the renderer
      // knows what an npc looks like but not where it stands.
      placements.push({
        slug: def.slug,
        name: def.name,
        x: n.x,
        y: n.y,
        z: n.z,
        look: def.lookType,
        colors: [def.head, def.body, def.legs, def.feet],
        addons: def.addons,
        shop: def.hasShop,
      });
    }

    for (const id of looks) extra.push({ category: 'creature', id });

    markPlayableZones();
    datasets.hunts = {
      generatedFrom: 'map-spawn.xml',
      zoneCount: build.zones.length,
      // Every zone the compiler knows about, so the browser can list and
      // search all of them...
      zones: build.zones,
      // ...and the subset whose tiles are actually in this release, which is
      // the subset the player can travel to and stand in. A pin for a zone
      // that is not here would walk the camera into empty space.
      packed: packedZones.map((z) => z.id),
    };
    datasets.species = {
      count: reg.all.length,
      lootChanceScale: LOOT_CHANCE_SCALE,
      collisions: reg.collisions.length,
      species: reg.all.map((sp) => ({
        slug: sp.slug,
        name: sp.name,
        variant: sp.variant,
        region: sp.region,
        /** The creature this species is in the pack, not what the script asks for. */
        look: lookOf(sp),
        /** What the monster script declares, kept so the shift stays visible. */
        declaredLook: sp.lookType,
        /*
         * Whether the pack could be shown to hold this species at all. False
         * means the client draws the artwork instead: nothing placed it, and a
         * stranger is worse than a picture.
         */
        spriteOk: spriteOk(sp),
        types: sp.type2 ? [sp.type1, sp.type2] : [sp.type1],
        hp: sp.health,
        wildHp: Math.round(sp.health * sp.wildHealthMultiplier),
        exp: sp.experience,
        speed: sp.speed,
        level: sp.minimumLevel,
        catch: sp.catchChance,
        icon: sp.iconOn,
        shiny: sp.hasShiny,
        mega: sp.hasMega,
        // The simulation rolls real drops, so the table travels with the species.
        loot: sp.loot.map((l) => [l.id, l.chance, l.maxCount]),
        // The player-facing list, not `pokemon.attacks`: same move names but
        // shorter cooldowns, and it is what the party actually fights with.
        moves: sp.moves.map((mv) => [mv.name, mv.power, mv.interval, mv.chance, mv.type ?? '']),
        // The body a defeated one leaves, and how long it lies there. This is
        // the window a player has to throw a ball: `catch.lua` only works on a
        // corpse, and the corpse decays on its own `duration`.
        ...(() => {
          if (!sp.corpse) return {};
          const cid = otbForMinimap().serverToClient.get(sp.corpse);
          if (!cid) return {};
          extra.push({ category: 'item', id: cid });
          const def = itemsXmlOnce().bySid.get(sp.corpse);
          return { corpse: cid, corpseSeconds: def?.duration ?? 30 };
        })(),
      })),
    };
    datasets.npcs = { hub: placements };

    // Moves, and what each one looks like when it goes off.
    //
    // A species script names a move and gives it a power and a cooldown; the
    // effect and missile ids live in data/scripts/spells, one file per move.
    // Both id spaces are the dat's own, so the ids are added to the closure
    // and their sprites ride along in the same atlases as everything else.
    const spells = loadSpells(PATHS.spells);
    const usedMoves = new Set<string>();
    for (const sp of reg.all) {
      for (const mv of sp.moves) usedMoves.add(mv.name.toLowerCase().trim());
      for (const mv of sp.attacks) usedMoves.add(mv.name.toLowerCase().trim());
    }

    /**
     * Whose effects are worth the sprites.
     *
     * Every move's ids ship as JSON — that is a few kilobytes. Their sprites
     * are not: effects are multi-phase animations, and packing all 431 of them
     * took the release from 13 MB to 30 MB and over budget.
     *
     * So the sprites are scoped to the Pokemon that can actually cast here:
     * the species of the packed hunt zones, which is everything the player can
     * fight or catch in this release, plus the nine starters, which is
     * everything they can begin with. Widen the zones and this widens with
     * them.
     */
    const STARTER_SLUGS = [
      'bulbasaur', 'charmander', 'squirtle',
      'chikorita', 'cyndaquil', 'totodile',
      'treecko', 'torchic', 'mudkip',
    ];
    const castable = new Set<string>();
    for (const zone of packedZones) {
      const sp = reg.variants.get(`${zone.variant}:${zone.species}`);
      if (sp) for (const mv of [...sp.moves, ...sp.attacks]) castable.add(mv.name.toLowerCase().trim());
    }
    for (const slug of STARTER_SLUGS) {
      const sp = reg.variants.get(`base:${slug}`);
      if (sp) for (const mv of [...sp.moves, ...sp.attacks]) castable.add(mv.name.toLowerCase().trim());
    }

    const moveVisuals: Record<string, Record<string, unknown>> = {};
    let withVisual = 0;
    for (const key of [...usedMoves].sort()) {
      const spell = spells.byKey.get(key);
      if (!spell) continue;

      const pack = castable.has(key);
      const entry: Record<string, unknown> = { name: spell.name, element: spell.element };
      if (spell.effect !== undefined) {
        entry.effect = spell.effect;
        if (pack) extra.push({ category: 'effect', id: spell.effect });
      }
      if (spell.missile !== undefined) {
        entry.missile = spell.missile;
        if (pack) extra.push({ category: 'missile', id: spell.missile });
      }
      if (spell.facing) {
        entry.facing = spell.facing;
        if (pack) for (const id of Object.values(spell.facing)) extra.push({ category: 'effect', id });
      }
      // Where the effect goes, and whether it walks. Without these a
      // directional move draws on the target, which is not where the script
      // puts it — Flamethrower's plume belongs beside the caster.
      if (spell.offsets) entry.offsets = spell.offsets;
      if (spell.wave) entry.wave = spell.wave;
      if (spell.sideEffect !== undefined) {
        entry.sideEffect = spell.sideEffect;
        if (pack) extra.push({ category: 'effect', id: spell.sideEffect });
      }
      if (spell.range !== undefined) entry.range = spell.range;
      entry.needTarget = spell.needTarget;

      moveVisuals[key] = entry;
      if (entry.effect || entry.missile || entry.facing) withVisual++;
    }

    // The ids of every move ship; only the castable ones' sprites do. The
    // client needs the difference so it can say "no animation packed" instead
    // of drawing nothing and looking broken.
    datasets.moves = {
      count: Object.keys(moveVisuals).length,
      drawable: [...castable].filter((k) => moveVisuals[k]).sort(),
      moves: moveVisuals,
    };

    const noVisual = [...usedMoves].filter((k) => {
      const v = moveVisuals[k];
      return !v || !(v.effect || v.missile || v.facing);
    });
    console.log(`move names in use    ${fmt(usedMoves.size)}`);
    console.log(`  with a visual      ${fmt(withVisual)}`);
    console.log(`  no spell script    ${fmt(noVisual.length)}  (${noVisual.slice(0, 6).join(', ')}...)`);
    console.log(`  sprites packed for ${fmt(castable.size)} moves castable in this release`);
    if (spells.unnamed.length) {
      console.log(`  unnamed spell files ${fmt(spells.unnamed.length)}`);
    }

    // Wild Pokemon standing inside the cutout. A hunt zone with no creatures
    // in it is just scenery, so these are placed the same way npcs are.
    const inBox = spawns.monsters.filter((m) => inAnyBox(m.x, m.y, m.z));

    const wild: Array<Record<string, unknown>> = [];
    const unresolvedWild = new Set<string>();
    for (const m of inBox) {
      const sp = resolveSpecies(reg, m.name);
      if (!sp?.lookType) {
        unresolvedWild.add(m.name);
        continue;
      }
      if (spriteOk(sp)) looks.add(lookOf(sp));
      wild.push({
        species: sp.slug,
        name: sp.name,
        variant: sp.variant,
        x: m.x,
        y: m.y,
        z: m.z,
        look: lookOf(sp),
        spriteOk: spriteOk(sp),
        respawn: m.spawntime,
        // How far it may stray from its point, from the spawn block. Almost
        // every spawn in this map is radius 1; a thousand of them are 5.
        radius: m.radius,
        // The wild speed, not the tame one: `pokemon.wild.speed` is what a
        // Pokemon roams at before anyone catches it, and it is usually higher.
        speed: sp.wildSpeed || sp.speed,
        level: sp.minimumLevel,
        types: sp.type2 ? [sp.type1, sp.type2] : [sp.type1],
        wildHp: Math.round(sp.health * sp.wildHealthMultiplier),
        exp: sp.experience,
      });
    }

    datasets.spawns = { wild };

    // Loot is referenced by name, so the bag needs a name index to show an
    // icon for anything a hunt drops.
    const itemsXml = itemsXmlOnce();
    const otb = otbForMinimap();
    const lootNames = new Set<string>();
    for (const sp of reg.all) for (const l of sp.loot) lootNames.add(l.id.toLowerCase().trim());

    const itemIndex: Record<string, { sid: number; cid: number }> = {};
    const phantom: string[] = [];
    for (const name of [...lootNames].sort()) {
      const def = itemsXml.byName.get(name);
      const cid = def ? otb.serverToClient.get(def.serverId) : undefined;
      if (!def || !cid) {
        phantom.push(name);
        continue;
      }
      itemIndex[name] = { sid: def.serverId, cid };
      extra.push({ category: 'item', id: cid });
    }

    // Shops, from the npcs standing in this cutout.
    //
    // The trade lists are the economy of the base written down: Mark sells the
    // balls a capture spends and buys back the loot a hunt drops, so the two
    // halves of the loop are the same npc.
    const shops: Record<string, unknown> = {};
    for (const def of hubNpcDefs.values()) {
      if (!def.shop.buy.length && !def.shop.sell.length) continue;

      const resolve = (rows: typeof def.shop.buy) =>
        rows.flatMap((row) => {
          const cid = otb.serverToClient.get(row.serverId);
          if (!cid) return [];
          extra.push({ category: 'item', id: cid });
          return [{ name: row.name, sid: row.serverId, cid, price: row.price }];
        });

      const buy = resolve(def.shop.buy);
      const sell = resolve(def.shop.sell);
      shops[def.slug] = { name: def.name, buy, sell };
      console.log(
        `shop ${def.name.padEnd(16)} sells ${String(buy.length).padStart(3)}` +
          `  buys ${String(sell.length).padStart(3)}` +
          `  (${def.shop.buy.length - buy.length} + ${def.shop.sell.length - sell.length} unresolved)`,
      );
    }
    /*
     * The cash shop, and the one currency in it that is real.
     *
     * `newShop.lua` prices everything in five currencies and only 2145, the
     * small diamond, is an item this base actually has — see formats/premium-shop.ts.
     * The rows travel with the release so the prices come from the server
     * rather than from somebody's taste, and the diamond goes into the item
     * index so the shop can draw the coin it charges.
     */
    /*
     * Items the interface itself draws.
     *
     * The dock used to wear the client's own 16 pixel interface icons blown up
     * to 28, which is where they lose their edges. These are real items from
     * the same sprite pack the world is drawn from — a pokedex, a bag, a
     * badge, a map — at their native size, and they are named here because
     * nothing in a hunt drops them and no shop sells them, so nothing else
     * would put them in the index.
     */
    const INTERFACE_ITEMS = ['pokedex', 'poke bag', 'boulder badge', 'map', 'small diamond'];
    let uiItems = 0;
    for (const name of INTERFACE_ITEMS) {
      if (itemIndex[name]) continue;
      const def = itemsXml.byName.get(name);
      const cid = def ? otb.serverToClient.get(def.serverId) : undefined;
      if (!def || !cid) continue;
      itemIndex[name] = { sid: def.serverId, cid };
      extra.push({ category: 'item', id: cid });
      uiItems++;
    }
    if (uiItems) console.log(`interface items      ${fmt(uiItems)} packed for the dock`);

    const premiumRows = parsePremiumShop(readFileSync(PATHS.newShop, 'utf8'));
    const diamondDef = itemsXml.bySid.get(DIAMOND_SID);
    const diamondCid = diamondDef ? otb.serverToClient.get(DIAMOND_SID) : undefined;
    if (diamondDef && diamondCid) {
      itemIndex[diamondDef.name] = { sid: DIAMOND_SID, cid: diamondCid };
      extra.push({ category: 'item', id: diamondCid });
    }

    const priced = premiumRows.filter((row) => row.currency === DIAMOND_SID);
    datasets.premium = {
      currency: diamondDef
        ? { sid: DIAMOND_SID, cid: diamondCid ?? 0, name: diamondDef.name }
        : null,
      rows: premiumRows.map((row) => {
        const def = row.itemId ? itemsXml.bySid.get(row.itemId) : undefined;
        const cid = row.itemId ? otb.serverToClient.get(row.itemId) : undefined;
        return {
          ...row,
          name: def?.name ?? row.note,
          cid: cid ?? 0,
          /** Whether this base can actually hand the thing over. */
          real: Boolean(def && cid),
        };
      }),
    };
    console.log(
      `cash shop            ${fmt(premiumRows.length)} live rows, ` +
        `${fmt(priced.length)} priced in ${diamondDef?.name ?? 'diamonds'} ` +
        `(${fmt(premiumRows.filter((r) => r.itemId && itemsXml.bySid.get(r.itemId)).length)} name a real item)`,
    );

    datasets.shops = { shops };

    // Everything a shop sells goes in the item index too. The index is what
    // the bag looks a name up in, and the bag holds whatever the player
    // bought — a Poke Ball with no entry here draws as a question mark while
    // the shop that sold it shows the icon perfectly well.
    let fromShops = 0;
    for (const def of hubNpcDefs.values()) {
      for (const row of [...def.shop.buy, ...def.shop.sell]) {
        if (itemIndex[row.name]) continue;
        const cid = otb.serverToClient.get(row.serverId);
        if (!cid) continue;
        itemIndex[row.name] = { sid: row.serverId, cid };
        fromShops++;
      }
    }
    if (fromShops) console.log(`item names from shops ${fmt(fromShops)}`);

    /**
     * Which Pokemon art files actually exist.
     *
     * The client resolves a picture by name and walks a fallback chain when a
     * variant has none of its own — `alolan dugtrio` down to `dugtrio`. Without
     * a list it discovers each miss by asking the server and getting a 404,
     * which on a full pokedex scroll is hundreds of pointless round trips. A
     * couple of directory listings costs a few kilobytes and removes all of
     * them.
     */
    const listArt = (dir: string): string[] => {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.png'))
        .map((f) => f.slice(0, -4).toLowerCase())
        .sort();
    };
    const portraits = listArt(PATHS.portraits);
    const artworks = listArt(PATHS.artworks);
    datasets.art = { portraits, artworks };
    console.log(`art files            ${fmt(portraits.length)} portraits, ${fmt(artworks.length)} artworks`);

    /*
     * Poke Balls, from the table `catch.lua` rolls against.
     *
     * `balls` in `data/lib/core/newfunctions.lua` is the only place the game
     * says what one ball is worth against another: the catch is
     * `random(0, 10000) <= catchChance * chanceMultiplier`, and everything
     * else in the entry is what the throw looks like.
     *
     * Most of the table is dead weight in this base. Twenty-four of its
     * twenty-eight entries name item ids that do not exist in items.xml, so
     * the server itself could never put one in a player's hand, and the one
     * that does resolve to something (`saffari`, 12617) resolves to a broken
     * slicer. Only an entry whose id is a real item, named like a ball, is
     * emitted as usable — the rest ride along marked `usable: false`, so the
     * client can say what the base has rather than pretending it works.
     */
    const ballDefs = parseBalls(readFileSync(PATHS.newFunctions, 'utf8'));
    // The bag is keyed by name, and the two sources spell these differently:
    // items.xml calls 26662 an "empty pokeball" while the shop Mark trades in
    // an "empty poke ball". The index is what the bag was filled from, so its
    // spelling is the one that matches what the player is holding.
    const nameBySid = new Map(Object.entries(itemIndex).map(([name, e]) => [e.sid, name]));
    const ballRows = ballDefs.map((ball) => {
      const def = itemsXml.bySid.get(ball.emptyId);
      const cid = def ? otb.serverToClient.get(def.serverId) : undefined;
      const named = def ? /ball$|\bball\b/i.test(def.name) : false;
      const usable = Boolean(def && cid && named);
      if (usable && cid) {
        extra.push({ category: 'item', id: cid });
        // A throw has three things to look at, and all three belong to
        // the ball: the missile that flies at the body, the effect where
        // it lands, and the one where the Pokemon comes back out. Without
        // these packed a capture is a ball that vanishes in mid-air.
        extra.push({ category: 'missile', id: ball.missile });
        for (const id of [ball.effectFail, ball.effectSucceed, ball.effectRelease]) {
          if (id > 0) extra.push({ category: 'effect', id });
        }
      }
      return {
        key: ball.key,
        // The shop and the bag speak in names, so the name the *shop* uses
        // wins where the two disagree: items.xml calls 26662 an "empty
        // pokeball" and Mark sells an "empty poke ball".
        item: nameBySid.get(ball.emptyId) ?? def?.name ?? '',
        sid: ball.emptyId,
        cid: cid ?? 0,
        multiplier: ball.chanceMultiplier,
        missile: ball.missile,
        succeed: ball.effectSucceed,
        fail: ball.effectFail,
        release: ball.effectRelease,
        usable,
      };
    });
    /*
     * The two effects catch.lua plays on the trainer when the ball settles,
     * 2.6 seconds after the throw:
     *
     *   doPlayerSendEffect(p:getId(), 179)  -- caught
     *   doPlayerSendEffect(p:getId(), 170)  -- escaped
     *
     * They belong to the script rather than to any one ball, so they are named
     * once here and packed like the rest of a throw.
     */
    const catchEffects = { caught: 179, escaped: 170 };
    for (const id of Object.values(catchEffects)) extra.push({ category: 'effect', id });

    datasets.items = { index: itemIndex, unresolved: phantom, balls: ballRows, catchEffects };
    const usableBalls = ballRows.filter((b) => b.usable);
    console.log(
      `poke balls           ${fmt(ballRows.length)} in the table, ` +
        `${fmt(usableBalls.length)} are real items ` +
        `(${usableBalls.map((b) => `${b.key} x${b.multiplier}`).join(', ')})`,
    );
    console.log(`loot item names      ${fmt(lootNames.size)}  resolved ${fmt(Object.keys(itemIndex).length)}`);
    if (phantom.length) {
      let affected = 0;
      for (const sp of reg.all) {
        for (const l of sp.loot) if (phantom.includes(l.id.toLowerCase().trim())) affected++;
      }
      console.log(`WARN phantom items   ${phantom.join(', ')}`);
      console.log(`                     ${fmt(affected)} loot entries reference an item that does not exist`);
    }

    // Interaction points: what the player can click, and what it does.
    // Depots come from tile contents, so they are filled in after the closure.
    const points: Array<Record<string, unknown>> = [];
    for (const n of hubNpcs) {
      const def = npcs.byName.get(n.name.toLowerCase().trim());
      if (!def) continue;
      const kind = npcInteraction(def);
      if (!kind) continue;
      points.push({ kind, name: def.name, x: n.x, y: n.y, z: n.z });
    }

    // Every shop npc on the map, so the client can travel to the nearest one
    // even when it sits outside the packed cutout.
    const markets: Array<Record<string, unknown>> = [];
    for (const n of spawns.npcs) {
      const def = npcs.byName.get(n.name.toLowerCase().trim());
      if (!def?.hasShop) continue;
      markets.push({ name: def.name, x: n.x, y: n.y, z: n.z });
    }

    if (withMinimaps) {
      head('Minimaps');
      const requests = regionBoxes(build.zones);
      const rendered = renderRegionMinimaps(PATHS.map, requests, otbForMinimap(), datForMinimap());
      minimapFiles = rendered.regions.map((r) => ({
        name: r.name,
        png: r.png,
        meta: {
          name: r.name,
          originX: r.originX,
          originY: r.originY,
          width: r.width,
          height: r.height,
          painted: r.painted,
        },
      }));
      for (const r of rendered.regions) {
        console.log(`${r.name.padEnd(10)} ${r.width}x${r.height}  ${mb(r.png.length).padStart(9)}`);
      }
      datasets.minimaps = { regions: minimapFiles.map((m) => m.meta) };
    }

    // Gyms: rosters read from the base where they exist, filled by rule where
    // they do not.
    const gymBuild = buildGyms(reg, npcs);
    datasets.gyms = { gyms: gymBuild.gyms };
    for (const g of gymBuild.gyms) {
      const tag = g.fromBase ? 'base' : 'gerado';
      console.log(
        `  ${String(g.order)}. ${g.city.padEnd(10)} ${g.leader.padEnd(10)} ` +
          `${g.type.padEnd(9)} ${g.team.length} pokémon (${tag})`,
      );
    }
    if (gymBuild.authored.length) {
      const total = gymBuild.authored.reduce((n, a) => n + a.count, 0);
      console.log(
        `WARN authored teams  ${fmt(total)} members generated for ` +
          gymBuild.authored.map((a) => `${a.leader} (${a.count})`).join(', '),
      );
    }
    if (gymBuild.unresolved.length) {
      console.log(`WARN gym npc species not in registry: ${gymBuild.unresolved.join(', ')}`);
    }

    datasets.interactions = { depots: [] as Array<Record<string, number>>, points, markets };
    datasets.player = { outfits: { male: PLAYER_LOOKTYPES[0], female: PLAYER_LOOKTYPES[1] } };
    console.log(`npc actions          ${points.map((p) => `${p.name}:${p.kind}`).join(', ') || 'none'}`);
    console.log(`markets map-wide     ${fmt(markets.length)}`);

    const speciesHere = new Set(wild.map((w) => w.species as string));
    console.log(`wild spawns in box   ${fmt(wild.length)} across ${fmt(speciesHere.size)} species`);
    if (spawns.repairedSpawntimes) {
      console.log(`repaired spawntimes  ${fmt(spawns.repairedSpawntimes)} (garbage in map-spawn.xml)`);
    }
    if (unresolvedWild.size) {
      console.log(`  WARN unresolved: ${[...unresolvedWild].join(', ')}`);
    }
    for (const sname of [...speciesHere].slice(0, 8)) {
      const n = wild.filter((w) => w.species === sname).length;
      console.log(`  ${sname.padEnd(22)} x${n}`);
    }

    console.log(`zones                ${fmt(build.zones.length)}`);
    console.log(`species in zones     ${fmt(new Set(build.zones.map((z) => z.species)).size)}`);
    console.log(`npcs inside the box  ${fmt(hubNpcDefs.size)} distinct, ${fmt(placements.length)} placements`);
    for (const d of hubNpcDefs.values()) {
      console.log(`  ${d.name.padEnd(22)} look ${String(d.lookType).padStart(5)}${d.shop ? '  shop' : ''}`);
    }
    console.log(`creature lookTypes   ${fmt(looks.size)}${allSpecies ? '  (every species)' : ''}`);
    huntSummary = `${build.zones.length} zones`;
  }

  head('Closure');
  let t = Date.now();
  const closure = computeClosure({
    mapPath,
    otbPath: PATHS.otb,
    datPath: PATHS.dat,
    boxes,
    extra,
  });
  for (const [i, b] of boxes.entries()) {
    const tag = i === 0 ? 'hub' : `zone ${i}`;
    console.log(
      `${tag.padEnd(20)} x ${b.minX}..${b.maxX}  y ${b.minY}..${b.maxY}  z ${b.minZ}..${b.maxZ}`,
    );
  }
  console.log(`tiles                ${fmt(closure.tiles.length)}`);
  console.log(`item appearances     ${fmt(closure.appearances.get('item')!.size)}`);
  console.log(`creature appearances ${fmt(closure.appearances.get('creature')!.size)}`);
  console.log(`sprites reachable    ${fmt(closure.spriteIds.size)}`);

  const interactions = datasets.interactions as
    | { depots: Array<Record<string, number>> }
    | undefined;
  if (interactions) {
    for (const tile of closure.tiles) {
      if ([tile.ground, ...tile.items].some((id) => DEPOT_SERVER_IDS.has(id))) {
        interactions.depots.push({ x: tile.x, y: tile.y, z: tile.z });
      }
    }
    console.log(`depots               ${fmt(interactions.depots.length)}`);
  }
  console.log(`resolved in          ${Date.now() - t} ms`);

  const w = closure.warnings;
  if (w.unknownServerIds.size || w.noClientId.size || w.danglingClientIds.size) {
    console.log('');
    if (w.unknownServerIds.size) console.log(`WARN ${fmt(w.unknownServerIds.size)} serverIds not in items.otb`);
    if (w.noClientId.size) console.log(`WARN ${fmt(w.noClientId.size)} serverIds with clientId 0`);
    if (w.danglingClientIds.size) console.log(`WARN ${fmt(w.danglingClientIds.size)} clientIds missing from dat`);
  }

  head('Atlases');
  t = Date.now();
  const atlases = packAtlases(PATHS.spr, closure.spriteIds);
  console.log(`atlases              ${atlases.images.length}`);
  console.log(`sprites packed       ${fmt(atlases.slots.size)}`);
  if (atlases.blank.length) console.log(`blank, skipped       ${fmt(atlases.blank.length)}`);
  console.log(`packed in            ${Date.now() - t} ms`);

  head('Release');
  t = Date.now();
  const rel = emitRelease(closure, atlases, {
    outDir,
    boxes,
    byteBudget: Math.round(budgetMb * MB),
    mapName: basename(mapPath),
    datasets,
    // `Effect::draw` adds this to the destination; without it Flamethrower's
    // plume lands a tile and a half from where the script puts it.
    thingMeta: { effect: loadThingOtml(PATHS.effectsOtml) },
    extraFiles: minimapFiles.map((m) => ({ path: `minimap/${m.name.toLowerCase()}.png`, data: m.png })),
  });
  console.log(`releaseId            ${rel.releaseId}`);
  console.log(`chunks               ${fmt(rel.chunkCount)}`);
  if (huntSummary) console.log(`datasets             ${Object.keys(datasets).join(', ')}  (${huntSummary})`);
  console.log(`files                ${fmt(rel.files.length)}`);
  console.log(`written in           ${Date.now() - t} ms`);
  console.log(`output               ${outDir}`);

  const biggest = [...rel.files].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  console.log('');
  for (const f of biggest) console.log(`  ${mb(f.bytes).padStart(9)}  ${f.path}`);

  head('Budget');
  const pct = ((rel.totalBytes / rel.byteBudget) * 100).toFixed(1);
  console.log(`total                ${mb(rel.totalBytes)}`);
  console.log(`limit                ${mb(rel.byteBudget)}`);
  console.log(`used                 ${pct}%`);
  if (!rel.withinBudget) {
    throw new Error(`release is ${mb(rel.totalBytes - rel.byteBudget)} over the ${budgetMb} MB budget`);
  }
  console.log(NL + 'OK   within budget');
}

// -- minimap ------------------------------------------------------------------

/** Bounding box per region, on whichever floor holds most of its zones. */
function regionBoxes(zones: HuntZone[], margin = 20): RegionRequest[] {
  const byRegion = new Map<string, HuntZone[]>();
  for (const z of zones) {
    const list = byRegion.get(z.region) ?? [];
    list.push(z);
    byRegion.set(z.region, list);
  }

  const out: RegionRequest[] = [];
  for (const [name, list] of byRegion) {
    // Every floor: the render is top-down, and zones of one region are spread
    // across many floors anyway.
    out.push({
      name,
      box: {
        minX: Math.min(...list.map((z) => z.box.minX)) - margin,
        maxX: Math.max(...list.map((z) => z.box.maxX)) + margin,
        minY: Math.min(...list.map((z) => z.box.minY)) - margin,
        maxY: Math.max(...list.map((z) => z.box.maxY)) + margin,
        minZ: 0,
        maxZ: 15,
      },
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function cmdMinimap(args: string[]): void {
  const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1]! : join(PATHS.out, 'minimap'));
  requireFile(PATHS.map, 'map');

  head('Region minimaps');
  const { reg, spawns, hunts } = loadWorldData();
  void reg;
  void spawns;

  const requests = regionBoxes(hunts.zones);
  for (const r of requests) {
    const w = r.box.maxX - r.box.minX + 1;
    const h = r.box.maxY - r.box.minY + 1;
    console.log(`${r.name.padEnd(10)} ${w}x${h}`);
  }

  const t = Date.now();
  const result = renderRegionMinimaps(PATHS.map, requests, loadOtb(PATHS.otb), loadDat(PATHS.dat));
  mkdirSync(outDir, { recursive: true });

  console.log('');
  let total = 0;
  for (const region of result.regions) {
    const file = join(outDir, `${region.name.toLowerCase()}.png`);
    writeFileSync(file, region.png);
    total += region.png.length;
    console.log(
      `${region.name.padEnd(10)} ${mb(region.png.length).padStart(9)}  ` +
        `${fmt(region.painted).padStart(9)} tiles painted  -> ${file}`,
    );
  }
  console.log('');
  console.log(`tiles visited        ${fmt(result.tilesVisited)}`);
  console.log(`total png            ${mb(total)}`);
  console.log(`rendered in          ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

// -- entry --------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'info':
      cmdInfo();
      break;
    case 'sprite':
      cmdSprite(rest);
      break;
    case 'thing':
      cmdThing(rest);
      break;
    case 'otb':
      cmdOtb(rest);
      break;
    case 'map':
      cmdMap(rest);
      break;
    case 'towns':
      cmdTowns(rest);
      break;
    case 'pack':
      cmdPack(rest);
      break;
    case 'species':
      cmdSpecies(rest);
      break;
    case 'hunts':
      cmdHunts(rest);
      break;
    case 'minimap':
      cmdMinimap(rest);
      break;
    default:
      console.log(`pokeidle content compiler

  info                     read all four formats and report the matrix
  sprite <id> [id...]      decode sprites to PNG
  thing <category> <id>    inspect an appearance and render it
  otb [serverId...]        items.otb summary or serverId lookup
  map [--full] [--box x1,y1,x2,y2,z1[,z2]] [--limit n]
  towns [name] [--map2]    list towns and their temple positions
  pack (--box x1,y1,x2,y2,z1[,z2] | --hunt <zoneId>)...  both repeat [--pad n]
       [--out dir] [--budget mb] [--map2] [--with-hunts] [--all-species] [--minimaps]
                           compile a content release for one cutout
  minimap [--out dir]      render one minimap per region from minimapColor
  species [name]           registry summary, or one species in detail
  hunts [species|region] [--threshold n] [--min n]
                           cluster spawns into hunt zones

Categories: ${CATEGORIES.join(', ')}
Output: ${PATHS.out}`);
      process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  console.error(`\x1b[31merror:\x1b[0m ${(err as Error).message}`);
  process.exit(1);
}
