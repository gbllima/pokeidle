import {
  layoutChunk,
  layoutCreatures,
  DIRECTION,
  TILE,
  type AppearanceSet,
  type Chunk,
  type CreaturePlacement,
  type Draw,
} from '../../renderer/src/layout.ts';
import { tintOutfit } from '../../renderer/src/outfit.ts';
import {
  HuntController,
  partyDps,
  DEFAULT_POLICY,
  type LogLine,
  type MoveRow,
  type ZoneRow,
} from './hunt.ts';
import { makePortrait } from './portrait.ts';
import { pokemonImage, knownArt, bestArtUrl } from './art.ts';
import { HuntField, encounterProgress, landingSpot, FLOAT_MS, type WildSpawn } from './field.ts';
import {
  WalkGrid,
  findPath,
  Trail,
  Walker,
  stepDurationMs,
  strideOffset,
  strideDone,
  walkPhase,
  type Stride,
} from './walk.ts';
import {
  Caster,
  missileProgress,
  effectPhase,
  effectDuration,
  effectSpritePos,
  waveTiles,
  CAST_MS,
  ENGAGE_RANGE,
  MISSILE_MS,
  type Cast,
  type MoveVisual,
} from './casting.ts';
import { ensureAccount, type Account } from './onboarding.ts';
import { expToNext, gainInto, levelFromExp, progressAt } from './trainer.ts';
import { catchChanceOf, formatChance, isCatchable, rollCatch } from './catching.ts';
import { Floaters, floaterAt, hitDamage } from './damage.ts';
import {
  DIAMONDS_PER_LEVEL,
  DIAMOND_ITEM,
  SUPPLIES,
  balanceOf,
  buy,
  levelsAway,
  priceOfSpecies,
  type Offer,
} from './premium.ts';
import {
  POTIONS,
  POTION_EXHAUST_MS,
  POTION_TICKS,
  REVIVE_ITEM,
  cleanSettings,
  needsPotion,
  pickPotion,
  potionTickHeal,
  shouldCatch,
} from './helper.ts';
import {
  IV_COUNT,
  IV_MAX,
  IV_TOTAL,
  PARTY_LIMIT,
  RARITIES,
  addCaught,
  boxMons,
  ivTotal,
  matches,
  partyMons,
  rarityOf,
  rollIvs,
  sendOut,
  toBox,
  toParty,
  type OwnedMon,
  type Rarity,
  type Roster,
  type RosterFilter,
} from './roster.ts';

/**
 * Browser presenter.
 *
 * Imports the very same layout module the headless rasteriser uses — the dev
 * server strips the types on the way out — so exactly one place decides draw
 * order, patterns and anchoring. This file turns the resulting draw list into
 * canvas calls, runs the camera, and hangs the interface off world positions.
 *
 * Terrain is baked once per chunk into an offscreen canvas; re-issuing seven
 * thousand drawImage calls per frame would not hold sixty. Actors are drawn
 * live on top so they can move.
 */

// Overhanging art can reach this far outside its own chunk.
const BAKE_MARGIN = 128;
/** The map renders at native sprite scale and stays there. No zoom. */
const SCALE = 1;
/** Wild creatures further than this from the player get no name tag. */
const LABEL_RANGE = 14;
/** Mirrors DEFAULT_OFFLINE.efficiency in the sim package, for display only. */
const DEFAULT_OFFLINE_EFFICIENCY = 0.5;

type Manifest = {
  releaseId: string;
  source: { box: { minX: number; maxX: number; minY: number; maxY: number; minZ: number } };
  files: Array<{ path: string }>;
};

type SpeciesRow = {
  slug: string;
  name: string;
  variant: string;
  region: string;
  look: number;
  types: string[];
  hp: number;
  exp: number;
  level: number;
  speed?: number;
  /**
   * Whether `look` really draws this species in this client's sprite pack.
   * False means the map draws its artwork instead.
   */
  spriteOk?: boolean;
  shiny?: boolean;
  mega?: boolean;
  dex?: number;
  loot?: Array<[string, number, number]>;
  moves?: MoveRow[];
  /** Out of ten thousand, before the ball's multiplier. */
  catch?: number;
  /** Client id of the `fainted <name>` body it leaves behind. */
  corpse?: number;
  /** How long that body lies there, from the corpse item's own duration. */
  corpseSeconds?: number;
};

type Interactions = {
  depots: Array<{ x: number; y: number; z: number }>;
  points: Array<{ kind: 'heal' | 'shop'; name: string; x: number; y: number; z: number }>;
  markets: Array<{ name: string; x: number; y: number; z: number }>;
};

type Hotspot = {
  kind: 'depot' | 'heal' | 'shop';
  name: string;
  action: string;
  x: number;
  y: number;
  z: number;
};

/** Anything drawn above the terrain and optionally labelled. */
type Actor = CreaturePlacement & {
  label?: string;
  labelKind?: 'npc' | 'mine' | 'wild' | 'party';
  /**
   * Species name to draw from artwork instead of from the sprite pack.
   *
   * Set when the compiler could not verify that this species' looktype draws
   * this species — see tools/verify-looks.ts. The number in the monster script
   * belongs to a different build of the sprite pack, so the name is the only
   * identifier left that resolves to the right Pokemon.
   */
  art?: string;
  /** Spawn point of a wild one, stable while it roams. */
  key?: string;
};

/**
 * One Pokemon the trainer owns, whether it is out or in the box.
 *
 * `OwnedMon` carries the identity and the numbers the depot cares about — its
 * own id, level, health and individual values. The two fields added here are
 * what the map needs and the depot does not: the moves it casts and the speed
 * it walks a tile at, both read fresh from the packed species row.
 */
type PartyMon = OwnedMon & {
  moves: MoveRow[];
  /** `pokemon.speed`, which sets how fast the line crosses a tile. */
  speed: number;
};

type BakedChunk = { canvas: HTMLCanvasElement; originX: number; originY: number };

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const stage = $<HTMLCanvasElement>('stage');
const ctx = stage.getContext('2d', { alpha: false })!;
const boot = $('boot');
const bootMsg = $('boot-msg');
const bootBar = $('boot-bar');
const bootErr = $('boot-err');
const labelsLayer = $('labels');

const progress = (pct: number, msg?: string) => {
  bootBar.style.width = `${Math.round(pct * 100)}%`;
  if (msg) bootMsg.textContent = msg;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function main(): Promise<void> {
  progress(0.05, 'manifest…');
  const manifest = await getJson<Manifest>('/release/manifest.json');

  progress(0.15, 'aparências…');
  const set = await getJson<AppearanceSet>('/release/appearances.json');

  progress(0.3, 'atlas…');
  const atlases = await Promise.all(
    manifest.files
      .filter((f) => f.path.startsWith('atlas/'))
      .map((f) => f.path)
      .sort()
      // Versioned by releaseId: atlases are big and worth caching, but a
      // cached atlas paired with a newer appearances.json maps every sprite
      // id to the wrong slot, and the world renders as confetti. The query
      // makes a stale pair impossible instead of trusting cache headers.
      .map(async (p) =>
        createImageBitmap(
          await fetch(`/release/${p}?v=${manifest.releaseId}`).then((r) => r.blob()),
        ),
      ),
  );

  progress(0.55, 'chunks…');
  const chunks = await Promise.all(
    manifest.files
      .filter((f) => f.path.startsWith('chunks/'))
      .map((f) => f.path.slice('chunks/'.length, -'.json'.length))
      .map((k) => getJson<Chunk>(`/release/chunks/${k}.json`)),
  );

  progress(0.8, 'criaturas…');
  const actors: Actor[] = [];

  type NpcRow = {
    name: string;
    x: number;
    y: number;
    z: number;
    look: number;
    colors?: [number, number, number, number];
    addons?: number;
  };
  const npcs = await getJson<{ hub: NpcRow[] }>('/release/npcs.json').catch(() => ({
    hub: [] as NpcRow[],
  }));
  for (const n of npcs.hub) {
    actors.push({
      x: n.x,
      y: n.y,
      z: n.z,
      lookType: n.look,
      colors: n.colors,
      addons: n.addons,
      label: n.name,
      labelKind: 'npc',
    });
  }

  const wildData = await getJson<{ wild: WildSpawn[] }>('/release/spawns.json').catch(() => ({
    wild: [] as WildSpawn[],
  }));
  for (const w of wildData.wild) {
    actors.push({
      x: w.x,
      y: w.y,
      z: w.z,
      lookType: w.look,
      ...(w.spriteOk === false ? { art: w.name } : {}),
      label: w.name,
      labelKind: 'wild',
      // The spawn point, which is what a roaming Pokemon is still identified
      // by once it has walked off it.
      key: `${w.x},${w.y},${w.z}`,
    });
  }

  progress(0.92, 'interações…');
  const interactions = await getJson<Interactions>('/release/interactions.json').catch(
    () => ({ depots: [], points: [], markets: [] }) as Interactions,
  );
  const speciesData = await getJson<{ species: SpeciesRow[] }>('/release/species.json').catch(
    () => ({ species: [] as SpeciesRow[] }),
  );
  const huntData = await getJson<{ zones: ZoneRow[]; packed?: string[] }>(
    '/release/hunts.json',
  ).catch(() => ({ zones: [] as ZoneRow[], packed: [] as string[] }));
  const minimapData = await getJson<{ regions: RegionRow[] }>('/release/minimaps.json').catch(
    () => ({ regions: [] as RegionRow[] }),
  );
  const itemData = await getJson<{
    index: ItemIndex;
    balls?: BallRow[];
    catchEffects?: CatchEffects;
  }>('/release/items.json').catch(
    () => ({ index: {} as ItemIndex }),
  );
  const gymData = await getJson<{ gyms: GymRow[] }>('/release/gyms.json').catch(
    () => ({ gyms: [] as GymRow[] }),
  );
  // What each move looks like when it goes off, read out of the base's own
  // spell scripts by the compiler.
  const moveData = await getJson<{ moves: Record<string, MoveVisual>; drawable: string[] }>(
    '/release/moves.json',
  ).catch(() => ({ moves: {} as Record<string, MoveVisual>, drawable: [] as string[] }));
  // Trade lists, read from the npcs' own `shop_buyable` / `shop_sellable`.
  const shopData = await getJson<{ shops: Record<string, ShopDef> }>('/release/shops.json').catch(
    () => ({ shops: {} as Record<string, ShopDef> }),
  );
  // Which Pokemon pictures the release has, so a name is resolved to a file
  // that exists rather than by trying and being told 404.
  const artData = await getJson<{ portraits: string[]; artworks: string[] }>(
    '/release/art.json',
  ).catch(() => ({ portraits: [] as string[], artworks: [] as string[] }));
  if (artData.portraits.length || artData.artworks.length) {
    knownArt(artData.portraits, artData.artworks);
  }

  // Sprites are needed to draw outfits and starters, so the gate opens here
  // rather than before the release loads.
  progress(1, 'conta…');
  const account = await ensureAccount(speciesData.species, makePortrait(set, atlases));

  progress(1, 'pronto');
  start({
    account,
    manifest,
    set,
    atlases,
    chunks,
    actors,
    interactions,
    species: speciesData.species,
    zones: huntData.zones,
    packedZones: new Set(huntData.packed ?? []),
    wild: wildData.wild,
    minimaps: minimapData.regions,
    itemIndex: itemData.index,
    ballRows: itemData.balls ?? [],
    catchEffects: itemData.catchEffects ?? { caught: 179, escaped: 170 },
    gymData: gymData.gyms,
    moveVisuals: moveData.moves,
    shops: shopData.shops,
  });
}

type World = {
  account: Account;
  manifest: Manifest;
  set: AppearanceSet;
  atlases: ImageBitmap[];
  chunks: Chunk[];
  actors: Actor[];
  interactions: Interactions;
  species: SpeciesRow[];
  zones: ZoneRow[];
  /** Zones whose tiles are in this release, so the player can stand in them. */
  packedZones: Set<string>;
  wild: WildSpawn[];
  minimaps: RegionRow[];
  itemIndex: ItemIndex;
  /** The base's own `balls` table, as the compiler read it. */
  ballRows: BallRow[];
  /** What catch.lua plays on the trainer when the ball settles. */
  catchEffects: CatchEffects;
  gymData: GymRow[];
  moveVisuals: Record<string, MoveVisual>;
  shops: Record<string, ShopDef>;
};

/** One npc's trade lists, priced in the base's own gold. */
type ShopRow = { name: string; sid: number; cid: number; price: number };
type ShopDef = { name: string; buy: ShopRow[]; sell: ShopRow[] };

/** A gym as the release ships it: leader, badge and the roster to beat. */
type GymRow = {
  order: number;
  city: string;
  leader: string;
  type: string;
  badge: string;
  /** False when the roster was generated rather than read from the base. */
  fromBase: boolean;
  team: Array<{
    slug: string;
    name: string;
    look: number;
    types: string[];
    hp: number;
    level: number;
    dps: number;
    moves: Array<[string, number, number, string]>;
  }>;
};

/** Loot item name to the ids that let it be drawn. */
type ItemIndex = Record<string, { sid: number; cid: number }>;

/**
 * One row of `balls` from `data/lib/core/newfunctions.lua`.
 *
 * `usable` is false for the entries whose item id does not exist in this
 * base's items.xml — twenty-four of the twenty-eight, which the server itself
 * could never hand to a player.
 */
type CatchEffects = { caught: number; escaped: number };

type BallRow = {
  key: string;
  item: string;
  sid: number;
  cid: number;
  multiplier: number;
  missile: number;
  succeed: number;
  fail: number;
  release: number;
  usable: boolean;
};

/** One compiled region minimap: where its top-left pixel sits on the map. */
type RegionRow = {
  name: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

function start(world: World): void {
  const {
    account, manifest, set, atlases, chunks, interactions,
    species, zones, packedZones, wild, minimaps, itemIndex, ballRows, catchEffects,
    gymData, moveVisuals, shops,
  } = world;
  const floor = manifest.source.box.minZ;
  const box = manifest.source.box;
  const onFloor = chunks.filter((c) => c.z === floor);
  const CHUNK_PX = TILE * 64;

  // ── sprite plumbing ────────────────────────────────────────────────────────

  const atlasPixels = new Map<number, ImageData>();
  const tintCache = new Map<string, HTMLCanvasElement>();

  const pixelsOf = (index: number): ImageData | null => {
    const cached = atlasPixels.get(index);
    if (cached) return cached;
    const atlas = atlases[index];
    if (!atlas) return null;
    const scratch = document.createElement('canvas');
    scratch.width = atlas.width;
    scratch.height = atlas.height;
    const sctx = scratch.getContext('2d', { willReadFrequently: true })!;
    sctx.drawImage(atlas, 0, 0);
    const data = sctx.getImageData(0, 0, atlas.width, atlas.height);
    atlasPixels.set(index, data);
    return data;
  };

  const cut = (index: number, sx: number, sy: number): Uint8ClampedArray | null => {
    const src = pixelsOf(index);
    if (!src) return null;
    const out = new Uint8ClampedArray(TILE * TILE * 4);
    for (let y = 0; y < TILE; y++) {
      const from = ((sy + y) * src.width + sx) * 4;
      out.set(src.data.subarray(from, from + TILE * 4), y * TILE * 4);
    }
    return out;
  };

  const tintedSprite = (
    spriteId: number,
    maskId: number,
    colors: [number, number, number, number],
  ): HTMLCanvasElement | null => {
    const key = `${spriteId}:${maskId}:${colors.join(',')}`;
    const hit = tintCache.get(key);
    if (hit) return hit;

    const baseSlot = set.sprites[String(spriteId)];
    const maskSlot = set.sprites[String(maskId)];
    if (!baseSlot || !maskSlot) return null;
    const base = cut(baseSlot[0], baseSlot[1], baseSlot[2]);
    const mask = cut(maskSlot[0], maskSlot[1], maskSlot[2]);
    if (!base || !mask) return null;

    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    canvas
      .getContext('2d')!
      .putImageData(new ImageData(tintOutfit(base, mask, colors), TILE, TILE), 0, 0);
    tintCache.set(key, canvas);
    return canvas;
  };

  const drawSprite = (target: CanvasRenderingContext2D, draw: Draw, ox: number, oy: number) => {
    const slot = set.sprites[String(draw.spriteId)];
    if (!slot) return;
    const [index, sx, sy] = slot;
    const atlas = atlases[index];
    if (!atlas) return;

    if (draw.maskSpriteId && draw.colors) {
      const tinted = tintedSprite(draw.spriteId, draw.maskSpriteId, draw.colors);
      if (tinted) {
        target.drawImage(tinted, draw.dx + ox, draw.dy + oy);
        return;
      }
    }
    target.drawImage(atlas, sx, sy, TILE, TILE, draw.dx + ox, draw.dy + oy, TILE, TILE);
  };

  /**
   * Draw one frame of an effect or missile at a world pixel position.
   *
   * Effects and missiles are ordinary dat appearances, so they come out of the
   * same atlases as everything else. A missile's four-by-four pattern grid is
   * its facing; an effect's `ph` frames are its animation.
   */
  /** Move names take their type's colour, the way the pokedex chips do. */
  const ELEMENT_INK: Record<string, string> = {
    fire: '#ff8a4c',
    water: '#5aa9f0',
    grass: '#6fcf6f',
    electric: '#f2d24b',
    ice: '#7fd8e8',
    poison: '#c07ad8',
    ground: '#d8b06a',
    rock: '#c3ac7a',
    psychic: '#f078a8',
    fighting: '#e06a52',
    normal: '#dcdcdc',
    energy: '#a6e0ff',
    death: '#a98cc0',
    earth: '#c9b07a',
    holy: '#ffe9a8',
  };

  /**
   * Draw one frame of an effect or missile on a tile.
   *
   * This follows `Effect::draw` in the client rather than approximating it:
   *
   *   - the pattern is the tile's own coordinate modulo the pattern count,
   *     not the direction and not zero, so a tiled effect varies across the
   *     ground the way it does in game;
   *   - `effects.otml` displacement is added to the destination, which is what
   *     puts Flamethrower's plume on its mark instead of a tile and a half off;
   *   - that file's opacity is applied too, so a half-transparent effect stays
   *     half transparent.
   *
   * Missiles are the exception on patterns: theirs is a three-by-three compass
   * of facings, so those come from the direction of travel.
   */
  const drawEffectAt = (
    category: 'effect' | 'missile',
    id: number,
    tile: { x: number; y: number },
    phase: number,
    facing?: { x: number; y: number },
    pixelOffset?: { x: number; y: number },
  ): void => {
    const appearance = set.appearances[category]?.[String(id)];
    const group = appearance?.groups[0];
    if (!group) return;

    const meta = appearance as {
      eoff?: [number, number];
      off?: [number, number];
      op?: number;
    };
    const frame = Math.min(Math.max(0, phase), Math.max(0, group.ph - 1));

    // `Effect::draw`: the pattern is the tile's own coordinate modulo the
    // pattern count. Missiles are the exception — theirs is a three-by-three
    // compass of facings, picked by the direction of travel.
    const patternX = facing
      ? group.px > 1
        ? Math.min(group.px - 1, Math.sign(facing.x) + 1)
        : 0
      : ((tile.x % group.px) + group.px) % group.px;
    const patternY = facing
      ? group.py > 1
        ? Math.min(group.py - 1, Math.sign(facing.y) + 1)
        : 0
      : ((tile.y % group.py) + group.py) % group.py;

    // `ThingType::draw` puts the composed image at
    //   dest - (size - 1) * 32 - displacement
    // and inside it sprite (cx, cy) sits at (size - cx - 1, size - cy - 1) * 32.
    // The two cancel to `dest - cx * 32`: sprite zero lands on the anchor tile
    // and the rest of a multi-tile appearance extends up and to the left.
    //
    // Getting that backwards mirrored every large effect about its own anchor,
    // which is why Flamethrower's plume came out on the wrong side of the
    // Charmander. `dest` is the tile's top-left corner, not its centre —
    // half a tile of error on each axis on top of the mirroring.
    const opacity = meta.op ?? 1;
    if (opacity !== 1) {
      ctx.save();
      ctx.globalAlpha *= opacity;
    }

    for (let cy = 0; cy < group.h; cy++) {
      for (let cx = 0; cx < group.w; cx++) {
        let i = frame;
        i = i * group.pz + 0;
        i = i * group.py + patternY;
        i = i * group.px + patternX;
        i = i * group.l + 0;
        i = i * group.h + cy;
        i = i * group.w + cx;

        const spriteId = group.s[i];
        if (!spriteId) continue;
        const slot = set.sprites[String(spriteId)];
        const atlas = slot ? atlases[slot[0]] : undefined;
        if (!slot || !atlas) continue;

        const at = effectSpritePos(tile, cx, cy, meta, TILE, pixelOffset ?? { x: 0, y: 0 });
        ctx.drawImage(atlas, slot[1], slot[2], TILE, TILE, at.x, at.y, TILE, TILE);
      }
    }

    if (opacity !== 1) ctx.restore();
  };

  const portrait = makePortrait(set, atlases);

  // ── player and party ───────────────────────────────────────────────────────

  const playerOutfit = set.appearances.creature?.[String(account.trainer.outfit)]
    ? account.trainer.outfit
    : 510;
  const player = {
    name: account.trainer.name,
    x: Math.round((box.minX + box.maxX) / 2),
    y: Math.round((box.minY + box.maxY) / 2),
    z: floor,
    coins: 12_480,
  };

  // Stand the trainer just south of the healer when the release has one.
  const healer = interactions.points.find((p) => p.kind === 'heal');
  /** Where a new character starts, and where the CP button brings them back to. */
  const home = healer ? { x: healer.x, y: healer.y + 4 } : { x: player.x, y: player.y };
  player.x = home.x;
  player.y = home.y;

  /** Level a starter is handed over at, matching the reference game. */
  const STARTER_LEVEL = 5;

  /** A fresh identity: two Bellsprout caught in the same hunt are not one. */
  let monSeq = 0;
  const newMonId = () => `m${Date.now().toString(36)}${(monSeq++).toString(36)}`;

  const cleanIvs = (raw: unknown): number[] =>
    Array.isArray(raw) && raw.length === IV_COUNT
      ? raw.map((v) => Math.min(IV_MAX, Math.max(0, Math.round(Number(v) || 0))))
      : rollIvs();

  type MonSave = {
    id?: string;
    name?: string;
    level?: number;
    exp?: number;
    hp?: number;
    ivs?: unknown;
    caughtAt?: number;
  };

  /**
   * Build a live Pokemon from the packed species row.
   *
   * Only what actually changes is ever stored - level, experience, wounds,
   * individual values. Everything else is looked up fresh, so a recompiled
   * release corrects a species' stats rather than being overridden by a stale
   * copy sitting in a save.
   */
  const speciesRow = (slug: string) =>
    species.find((sp) => sp.slug === slug && sp.variant === 'base');

  /** Health a species has at a level it was not written at. */
  const hpAtLevel = (row: { hp: number; level: number }, level: number) =>
    Math.max(1, Math.round(row.hp * (level / Math.max(1, row.level))));

  /**
   * Experience earned since reaching the current level.
   *
   * Saves written before the curve landed kept a 0..1 share of the level here
   * instead of points. Experience is always whole, so a value between zero and
   * one can only be one of those, and is converted rather than thrown away.
   */
  const expIntoLevel = (raw: number | undefined, level: number): number => {
    const need = expToNext(level);
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return 0;
    if (raw < 1) return Math.floor(raw * need);
    return Math.min(Math.max(0, need - 1), Math.floor(raw));
  };

  const makeMon = (slug: string, over: MonSave = {}): PartyMon | null => {
    const row = speciesRow(slug);
    if (!row) return null;

    const level = Math.max(1, Math.round(over.level ?? row.level));
    const maxHp = hpAtLevel(row, level);

    return {
      id: over.id ?? newMonId(),
      slug: row.slug,
      name: over.name ?? row.name,
      look: row.look,
      level,
      maxHp,
      hp: over.hp === undefined ? maxHp : Math.min(maxHp, Math.max(0, over.hp)),
      exp: expIntoLevel(over.exp, level),
      ivs: cleanIvs(over.ivs),
      caughtAt: over.caughtAt ?? Date.now(),
      moves: row.moves ?? [],
      speed: row.speed ?? 180,
    };
  };

  /**
   * The starting roster is the starter, alone, and out.
   *
   * It used to be padded out with a demo team of four so the party panel had
   * something to show. That reads as a bug now that the player picks a partner
   * on the way in: a trainer who chose Charmander and finds Gengar in their
   * team has been handed someone else's save.
   */
  const startingRoster = (): Roster<PartyMon> => {
    const starter = makeMon(account.starter.slug, { level: STARTER_LEVEL });
    if (!starter) {
      // The release is packed per-cutout, so a starter can be missing from a
      // release that did not include all species. Say so rather than starting
      // the player with an empty team and no explanation.
      throw new Error(`starter ${account.starter.slug} is not in this release`);
    }
    return { mons: [starter], party: [starter.id] };
  };

  /**
   * Every Pokemon the trainer owns, remembered between sessions.
   *
   * This replaces three disconnected stores: the team, the captures piled into
   * the bag beside the potions, and whatever had been dropped in the depot. It
   * is one list with the team as an ordered handful of ids drawn from it, so a
   * Pokemon caught in a hunt can actually be put out to fight.
   */
  const ROSTER_KEY = 'pokeidle.roster.v1';
  type SavedRoster = { mons: Array<MonSave & { slug: string }>; party: string[] };

  const buildRoster = (saved: SavedRoster | null): Roster<PartyMon> | null => {
    if (!saved || !Array.isArray(saved.mons) || saved.mons.length === 0) return null;

    const mons: PartyMon[] = [];
    for (const entry of saved.mons) {
      const mon = makeMon(entry.slug, entry);
      // A species the current release no longer packs is skipped rather than
      // faked: it would have no sprite, no moves and no speed to walk with.
      if (mon) mons.push(mon);
    }
    if (!mons.length) return null;

    const owned = new Set(mons.map((m) => m.id));
    const party = (Array.isArray(saved.party) ? saved.party : [])
      .filter((id) => owned.has(id))
      .slice(0, PARTY_LIMIT);

    // A save whose whole team was somehow dropped still needs someone out.
    if (!party.length) party.push(mons[0]!.id);
    return { mons, party };
  };

  const readJson = <T>(key: string): T | null => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
    } catch {
      return null;
    }
  };

  /**
   * Fold the old three-store layout into one roster, once.
   *
   * The Pokemon are lifted out of the bag and the depot and the old team key;
   * the items in those stores are left exactly where they are, since they are
   * still the player's. Individual values did not exist before, so a migrated
   * Pokemon is rolled a set now rather than being left blank.
   */
  const migrateRoster = (): Roster<PartyMon> | null => {
    type OldMon = { slug?: string; name?: string; level?: number; exp?: number; hp?: number };
    type OldStore = { items?: Record<string, number>; mons?: OldMon[] };

    const team = readJson<OldMon[]>('pokeidle.party.v1') ?? [];
    const stores: Array<[string, OldStore | null]> = [
      ['pokeidle.bag.v1', readJson<OldStore>('pokeidle.bag.v1')],
      ['pokeidle.depot.v1', readJson<OldStore>('pokeidle.depot.v1')],
    ];
    const boxed = stores.flatMap(([, store]) => store?.mons ?? []);
    if (!team.length && !boxed.length) return null;

    const mons: PartyMon[] = [];
    const party: string[] = [];
    for (const entry of team) {
      const mon = entry.slug ? makeMon(entry.slug, entry) : null;
      if (!mon) continue;
      mons.push(mon);
      if (party.length < PARTY_LIMIT) party.push(mon.id);
    }
    for (const entry of boxed) {
      const mon = entry.slug ? makeMon(entry.slug, { level: entry.level }) : null;
      if (mon) mons.push(mon);
    }
    if (!mons.length) return null;
    if (!party.length) party.push(mons[0]!.id);

    // Take the Pokemon out of the stores they no longer belong in, so a later
    // load of the bag does not show the same capture a second time.
    for (const [key, store] of stores) {
      if (!store?.mons?.length) continue;
      try {
        localStorage.setItem(key, JSON.stringify({ items: store.items ?? {} }));
      } catch {
        /* storage may be unavailable; the session still works */
      }
    }

    return { mons, party };
  };

  const roster: Roster<PartyMon> =
    buildRoster(readJson<SavedRoster>(ROSTER_KEY)) ?? migrateRoster() ?? startingRoster();

  const saveRoster = () => {
    try {
      const out: SavedRoster = {
        mons: roster.mons.map((m) => ({
          id: m.id,
          slug: m.slug,
          level: m.level,
          exp: m.exp,
          hp: m.hp,
          ivs: m.ivs,
          caughtAt: m.caughtAt,
        })),
        party: roster.party,
      };
      localStorage.setItem(ROSTER_KEY, JSON.stringify(out));
    } catch {
      /* storage may be unavailable; the session still works */
    }
  };

  // A roster that came from a migration or from picking a starter is written
  // out at once, so the old keys stop being the source of truth from the very
  // next load rather than whenever something happens to change.
  if (!readJson<SavedRoster>(ROSTER_KEY)) saveRoster();

  /** Kept under its old name so the rest of the game still reads plainly. */
  const saveParty = saveRoster;

  /**
   * The Pokemon that are out, in the order they walk.
   *
   * Re-derived rather than held, because the depot can change who is out
   * between one frame and the next. Everything downstream keeps a reference to
   * the same Pokemon objects, so a wound taken in a hunt is still the same
   * wound after a swap.
   */
  let party: PartyMon[] = partyMons(roster);
  const refreshParty = () => {
    party = partyMons(roster);
  };

  // ── the trainer's own level ────────────────────────────────────────────────

  const STATS_KEY = 'pokeidle.stats.v1';

  type Stats = { createdAt: number; huntMs: number; kills: number; experience: number };

  const stats: Stats = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null') as Stats | null;
      if (raw?.createdAt) return raw;
    } catch {
      /* fall through to a fresh profile */
    }
    return { createdAt: Date.now(), huntMs: 0, kills: 0, experience: 0 };
  })();

  const saveStats = () => {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      /* storage may be unavailable */
    }
  };

  /**
   * The trainer's level is read off the experience already being tracked.
   *
   * `stats.experience` is every point the hunts have paid out since the
   * character was made, so the level is a function of it rather than a second
   * number that could drift away from it.
   */
  const trainerProgress = () => progressAt(stats.experience);
  const trainerLevel = () => levelFromExp(stats.experience);

  /**
   * Party members stand around the trainer, two tiles apart: most creature
   * appearances are 2x2, so adjacent tiles would overlap them into a smear.
   */
  // Where the trainer can put their feet, and the line their party walks in.
  const grid = new WalkGrid(chunks, floor);
  const trail = new Trail(player);

  /**
   * Steps in progress for the trainer's line.
   *
   * One per place in the line — index 0 is whoever is out front, and the rest
   * are the followers behind. They each start their step when the tile under
   * them changes, which for a follower is one step after the leader's.
   */
  const strides: Array<Stride | null> = [];
  const walker = new Walker(party[0]?.speed ?? 180);
  let facing = DIRECTION.south;

  const faceToward = (to: { x: number; y: number }): number => {
    const dx = to.x - player.x;
    const dy = to.y - player.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? DIRECTION.east : DIRECTION.west;
    if (dy !== 0) return dy > 0 ? DIRECTION.south : DIRECTION.north;
    return facing;
  };

  /**
   * The name to draw a Pokemon by when its sprite cannot be trusted.
   *
   * Null when the sprite pack really does hold this species at the looktype
   * its monster script asks for, which is the case for Kanto and for a
   * scattering of later ids.
   */
  const artNameOf = (mon: { slug: string; name: string }): string | null => {
    const row = species.find((sp) => sp.slug === mon.slug && sp.variant === 'base');
    return row && row.spriteOk === false ? row.name : null;
  };

  const buildActors = (): Actor[] => {
    const out: Actor[] = world.actors.filter((a) => a.z === floor);
    const now = Date.now();

    /**
     * Slide and animate one member of the line.
     *
     * A creature part-way through a step is drawn offset back towards where
     * it came from, and runs its walking frames rather than standing still.
     * Group 1 is the moving group where the appearance has one.
     */
    const striding = (index: number, lookType: number) => {
      const stride = strides[index] ?? null;
      if (!stride || strideDone(stride, now)) return {};
      const offset = strideOffset(stride, now, TILE);
      const groups = set.appearances.creature?.[String(lookType)]?.groups;
      const moving = groups && groups.length > 1 ? 1 : 0;
      return {
        ox: offset.x,
        oy: offset.y,
        group: moving,
        phase: walkPhase(stride, now, groups?.[moving]?.ph ?? 1),
      };
    };

    // The line walks Pokemon first, trainer behind: the Pokemon is the one
    // doing the fighting, so it is the one that should arrive at the wild
    // Pokemon. `player` is the head of the line rather than the trainer's own
    // sprite — everything else (camera, distances, what is being fought) is
    // measured from the head, which is where the fight is.
    const lead = party.find((m) => m.hp > 0) ?? party[0];

    if (lead) {
      out.push({
        x: player.x,
        y: player.y,
        z: player.z,
        lookType: lead.look,
        ...(artNameOf(lead) ? { art: artNameOf(lead)! } : {}),
        direction: facing,
        label: lead.name,
        labelKind: 'party',
        ...striding(0, lead.look),
      });
    }

    // Followers step where the head already stepped, so every one of these
    // positions is walkable by construction.
    const trainerAt = lead ? trail.follower(0) : player;
    out.push({
      x: trainerAt.x,
      y: trainerAt.y,
      z: player.z,
      lookType: playerOutfit,
      direction: facing,
      label: player.name,
      labelKind: 'mine',
      ...striding(1, playerOutfit),
    });

    // The rest of the team is inside its pokeballs. One Pokemon is out at a
    // time — the one the player sent out — so the others are not on the map at
    // all. They used to trail behind the trainer, which is why a Pokemon
    // nobody had chosen walked around back there with no health bar of its own.

    return out;
  };

  let actors = buildActors();

  /**
   * Wild actors by spawn point.
   *
   * Built once: `buildActors` rebuilds the array on travel, but these entries
   * come from `world.actors` and are the same objects each time, so moving one
   * here moves what is drawn.
   */
  const wildByKey = new Map<string, Actor>();
  for (const actor of world.actors) {
    if (actor.labelKind === 'wild' && actor.key) wildByKey.set(actor.key, actor);
  }

  // ── hotspots ───────────────────────────────────────────────────────────────

  const ACTION_LABEL: Record<Hotspot['kind'], string> = {
    depot: 'Abrir Depot',
    heal: 'Curar',
    shop: 'Conversar',
  };

  const hotspots: Hotspot[] = [
    ...interactions.depots.map((d) => ({
      kind: 'depot' as const,
      name: 'Depot',
      action: ACTION_LABEL.depot,
      ...d,
    })),
    ...interactions.points.map((p) => ({
      kind: p.kind,
      name: p.name,
      action: ACTION_LABEL[p.kind],
      x: p.x,
      y: p.y,
      z: p.z,
    })),
  ].filter((h) => h.z === floor);

  // ── camera ─────────────────────────────────────────────────────────────────

  const camera = { x: 0, y: 0 };
  const centreOnPlayer = () => {
    camera.x = player.x * TILE + TILE / 2;
    camera.y = player.y * TILE + TILE / 2;
  };
  centreOnPlayer();

  /**
   * Device pixels per CSS pixel, kept for the text drawn on the canvas.
   *
   * The world is drawn one world unit to one device pixel, so a font sized in
   * world units comes out `dpr` times smaller than the same number of CSS
   * pixels. Names sized 11 looked right beside the DOM chips they replaced and
   * then shrank by a third on a 1.5x display.
   */
  let pixelRatio = 1;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pixelRatio = dpr;
    stage.width = Math.floor(window.innerWidth * dpr);
    stage.height = Math.floor(window.innerHeight * dpr);
    stage.style.width = `${window.innerWidth}px`;
    stage.style.height = `${window.innerHeight}px`;
    ctx.imageSmoothingEnabled = false;
  };
  window.addEventListener('resize', resize);
  resize();

  const toScreen = (worldX: number, worldY: number) => {
    const dpr = stage.width / window.innerWidth;
    return {
      left: ((worldX - camera.x) * SCALE + stage.width / 2) / dpr,
      top: ((worldY - camera.y) * SCALE + stage.height / 2) / dpr,
    };
  };

  // ── drawer ─────────────────────────────────────────────────────────────────

  const drawer = { root: $('drawer'), kind: $('d-kind'), body: $('d-body'), close: $('d-close') };
  drawer.close.addEventListener('click', () => (drawer.root.hidden = true));

  const openDrawer = (kind: string, html: string) => {
    drawer.kind.textContent = kind;
    drawer.body.innerHTML = html;
    drawer.root.hidden = false;
  };

  // Assigned once the depot panel exists further down. Declared here because
  // `act` is wired to the world labels before that point.
  let openDepot: (() => void) | null = null;

  const act = (spot: Hotspot) => {
    if (spot.kind === 'depot') {
      if (openDepot) openDepot();
      else openDrawer('Depot', `<b>Armazém do treinador</b><br>Ainda carregando.`);
      return;
    }
    if (spot.kind === 'heal') {
      const hurt = party.filter((m) => m.hp < m.maxHp);
      for (const mon of party) mon.hp = mon.maxHp;
      saveParty();
      // A run owns party health while it lasts and would write the wounds
      // straight back on the next tick, so coming home to heal ends the hunt.
      if (hunts.current) {
        hunts.stop();
        field.disarm();
        caster.disarm();
        throws = [];
        paintRun();
        renderCapture();
      }
      renderParty();
      openDrawer(
        'Curar',
        hurt.length
          ? `<b>${spot.name}</b> curou ${hurt.length} pokémon.<br>${hurt.map((m) => m.name).join(', ')}.`
          : `<b>${spot.name}</b>: sua equipe já está com a vida cheia.`,
      );
      return;
    }
    openShop(spot.name);
  };

  // ── floating labels ────────────────────────────────────────────────────────

  type LabelEl = { root: HTMLDivElement; tag: HTMLSpanElement; button?: HTMLButtonElement };
  const labelPool: LabelEl[] = [];

  const takeLabel = (index: number, withButton: boolean): LabelEl => {
    let el = labelPool[index];
    if (!el) {
      const root = document.createElement('div');
      root.className = 'label';
      const tag = document.createElement('span');
      tag.className = 'tag';
      root.append(tag);
      labelsLayer.append(root);
      el = { root, tag };
      labelPool[index] = el;
    }
    if (withButton && !el.button) {
      el.button = document.createElement('button');
      el.button.type = 'button';
      el.root.append(el.button);
    }
    if (el.button) el.button.hidden = !withButton;
    el.root.hidden = false;
    return el;
  };

  const onScreen = (at: { left: number; top: number }) =>
    at.left > -180 && at.left < window.innerWidth + 180 && at.top > -80 && at.top < window.innerHeight + 80;

  /**
   * Spawn points whose creature the run has just felled, keyed by tile.
   * Recomputed once a frame and read by both the sprite pass and the labels:
   * a name tag left hovering over an empty tile is the same bug as a sprite
   * left standing there.
   */
  let downTiles = new Set<string>();

  /**
   * Names, drawn on the canvas rather than as floating chips.
   *
   * The chips were a dark rounded box per creature, which at three or four
   * creatures on a tile turned into a wall of boxes, and their DOM stacking
   * order had nothing to do with the world's. Outlined text sits on the map
   * the way the reference client draws it: no background, a black rim so it
   * reads over grass and over snow alike, and the health bar right under the
   * name instead of somewhere else in the stack.
   *
   * The hotspot buttons stay in the DOM — those are clickable.
   */
  const nameFont = () =>
    `bold ${Math.round(11 * pixelRatio)}px ui-monospace, "JetBrains Mono", Consolas, monospace`;

  /** Green while healthy, amber when hurt, red when nearly out. */
  const healthInk = (fraction: number): string =>
    fraction > 0.5 ? '#5fdc72' : fraction > 0.2 ? '#e8c34a' : '#e2564a';

  const drawName = (
    tile: { x: number; y: number; ox?: number; oy?: number },
    text: string,
    lookType: number | undefined,
    health: number | null,
  ): void => {
    // Lifted clear of the creature's own sprite: a two-by-two Pokemon reaches
    // a tile higher than its anchor, and a name inside the artwork is unreadable.
    const group = lookType ? set.appearances.creature?.[String(lookType)]?.groups[0] : undefined;
    const above = (group ? group.h - 1 : 0) * TILE;

    // The same offset the sprite is drawn with, so the name travels with the
    // creature instead of jumping a tile ahead of it.
    const cx = tile.x * TILE + TILE / 2 + (tile.ox ?? 0);
    const baseline = tile.y * TILE - 10 - above + (tile.oy ?? 0);

    ctx.save();
    ctx.font = nameFont();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (health !== null) {
      // A thin rule under the name, as wide as the name, so the two read as
      // one label rather than a bar that happens to be nearby.
      const thickness = Math.max(2, Math.round(2 * pixelRatio));
      const width = Math.max(26, Math.ceil(ctx.measureText(text).width));
      const x = cx - width / 2;
      const y = baseline + Math.round(3 * pixelRatio);

      ctx.fillStyle = 'rgba(0, 0, 0, .78)';
      ctx.fillRect(x - 1, y - 1, width + 2, thickness + 2);
      ctx.fillStyle = 'rgba(255, 255, 255, .14)';
      ctx.fillRect(x, y, width, thickness);
      ctx.fillStyle = healthInk(health);
      ctx.fillRect(
        x,
        y,
        Math.max(0, Math.round(width * Math.min(1, Math.max(0, health)))),
        thickness,
      );
    }

    ctx.lineWidth = Math.max(3, Math.round(3 * pixelRatio));
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, .92)';
    ctx.strokeText(text, cx, baseline);
    ctx.fillStyle = health === null ? '#f2f6f4' : healthInk(health);
    ctx.fillText(text, cx, baseline);
    ctx.restore();
  };

  const paintLabels = () => {
    let n = 0;

    for (const spot of hotspots) {
      const at = toScreen(spot.x * TILE + TILE / 2, spot.y * TILE - 6);
      if (!onScreen(at)) continue;

      const el = takeLabel(n++, true);
      el.tag.className = 'tag npc';
      el.tag.textContent = spot.name;
      el.button!.textContent = spot.action;
      el.button!.onclick = () => act(spot);
      el.root.style.left = `${at.left}px`;
      el.root.style.top = `${at.top}px`;
    }

    for (let i = n; i < labelPool.length; i++) labelPool[i]!.root.hidden = true;
  };

  /**
   * Walk the trainer to whatever the run is currently fighting.
   *
   * The simulation does not care where anyone stands — it pays out on its own
   * clock either way. This is here so the screen agrees with the log: the
   * party really does cross the field to the Pokemon whose name is about to
   * appear in it, instead of felling things twenty tiles away without moving.
   *
   * A target with no way through, behind a cliff or across water, is skipped
   * rather than walked at: the run keeps paying, and the party waits where it
   * is for the next one to respawn closer.
   */
  let pathTarget: string | null = null;
  let stuckTargets = new Set<string>();
  let nextSearchAt = 0;

  /** Never more than this many path searches a second, however many targets. */
  const SEARCH_INTERVAL_MS = 250;

  const stepHunt = (now: number): void => {
    if (!hunts.current || !field.armed) {
      if (walker.walking) walker.stop();
      return;
    }

    const target = field.focus(player, stuckTargets);

    if (target && pathTarget !== target.key && !walker.walking) {
      // Searching is the expensive part of this loop, so it is rationed. An
      // unrationed search ran once per frame and took the whole page down to
      // a frame a second.
      if (now < nextSearchAt) return;
      nextSearchAt = now + SEARCH_INTERVAL_MS;

      const path = findPath(player, target, grid);
      if (path === null) {
        // No way through from here — across water, or behind a cliff. Remember
        // it so focus moves on instead of retrying the same failed search.
        stuckTargets.add(target.key);
        return;
      }
      pathTarget = target.key;
      walker.follow(path, now, { x: player.x, y: player.y });
      facing = faceToward(target);
    }

    const step = walker.step(now);
    if (!step) return;

    // Where everyone stood before the line shuffled forward. A follower's own
    // step starts when the tile under it changes, which is one leader-step
    // later — record them from the same snapshot so the whole line slides in
    // sequence rather than snapping together.
    const before = [
      { x: player.x, y: player.y },
      ...party.map((_, i) => ({ ...trail.follower(i) })),
    ];

    facing = faceToward(step);
    const ms = stepDurationMs(
      (party.find((m) => m.hp > 0) ?? party[0])?.speed ?? 180,
      step.x !== player.x && step.y !== player.y,
    );

    player.x = step.x;
    player.y = step.y;
    trail.push(player);

    const after = [
      { x: player.x, y: player.y },
      ...party.map((_, i) => ({ ...trail.follower(i) })),
    ];
    for (let i = 0; i < after.length; i++) {
      const from = before[i]!;
      const to = after[i]!;
      strides[i] =
        from.x === to.x && from.y === to.y
          ? null
          : { dx: Math.sign(to.x - from.x), dy: Math.sign(to.y - from.y), startedAt: now, ms };
    }

    actors = buildActors();
    centreOnPlayer();
  };

  /**
   * The fight itself: moves going off, balls in the air, numbers floating up.
   *
   * Names and health used to live here too. They moved to `paintNames`, which
   * runs over the actor list rather than over the run — a wild Pokemon has a
   * name whether or not it is the one being fought.
   */
  /**
   * Pokemon the sprite pack cannot draw, drawn from their artwork.
   *
   * One picture rather than four facings and an animation, so the walk is
   * carried by a mirror when it heads west and a small bob while it is
   * mid-step. That is less than a real sprite gives, and it is the right
   * Pokemon, which the sprite would not have been.
   */
  const artImages = new Map<string, HTMLImageElement | null>();
  const artImage = (name: string): HTMLImageElement | null => {
    const key = name.toLowerCase().trim();
    const known = artImages.get(key);
    if (known !== undefined) return known;

    const url = bestArtUrl(name, 'portrait');
    if (!url) {
      artImages.set(key, null);
      return null;
    }
    const img = new Image();
    img.src = url;
    artImages.set(key, img);
    return img;
  };

  /** A shade taller than a tile, standing on it rather than inside it. */
  const ART_TILES = 1.4;

  const paintArtActors = (list: Actor[], now: number): void => {
    const drawable = list.filter((a) => a.art && a.z === floor);
    if (!drawable.length) return;

    // The one that is out stands in front of the line, and at the centre — or
    // any time the line is stacked on one tile — it has to be the one on top.
    // Painted after the sprite pass, a follower would otherwise cover a lead
    // whose own sprite the pack can draw.
    const lead = list.find((a) => a.labelKind === 'party');
    const ordered = drawable
      .filter((a) => a === lead || !(lead && a.x === lead.x && a.y === lead.y && !a.labelKind))
      .sort((a, b) => a.y - b.y || (a === lead ? 1 : 0) - (b === lead ? 1 : 0));

    for (const actor of ordered) {
      if (!actor.art || actor.z !== floor) continue;
      const img = artImage(actor.art);
      if (!img || !img.complete || img.naturalWidth === 0) continue;

      const size = TILE * ART_TILES;
      // Mid-step, it lifts a little: without it a picture slides across the
      // grass like a sticker.
      const bob = actor.group === 1 ? Math.round(Math.abs(Math.sin(now / 90)) * 2) : 0;
      const x = actor.x * TILE + TILE / 2 - size / 2 + (actor.ox ?? 0);
      const y = actor.y * TILE + TILE - size + (actor.oy ?? 0) - bob;

      if (actor.direction === DIRECTION.west) {
        ctx.save();
        ctx.translate(x + size, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, size, size);
        ctx.restore();
        continue;
      }
      ctx.drawImage(img, x, y, size, size);
    }
  };

  /**
   * Damage numbers, drawn in the world so they stay over whoever was hit.
   *
   * Same trick the names use: the world draws one unit to one device pixel, so
   * everything here is scaled by `pixelRatio` or it comes out microscopic on a
   * sharp screen.
   */
  const paintFloaters = (now: number): void => {
    floaters.update(now);
    if (!floaters.all.length) return;

    ctx.save();
    ctx.font = `bold ${Math.round(12 * pixelRatio)}px ui-monospace, "JetBrains Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, Math.round(3 * pixelRatio));

    for (const floater of floaters.all) {
      const { dx, dy, alpha } = floaterAt(floater, now);
      if (alpha <= 0) continue;

      const x = floater.x * TILE + TILE / 2 + dx * pixelRatio;
      const y = floater.y * TILE - 14 * pixelRatio + dy * pixelRatio;
      const text = floater.kind === 'taken' ? `-${floater.amount}` : String(floater.amount);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(0, 0, 0, .92)';
      ctx.strokeText(text, x, y);
      // Red for what the trainer's Pokemon lost, white for what it dealt: the
      // two happen a tile apart and have to be told apart at a glance.
      ctx.fillStyle = floater.kind === 'taken' ? '#ff6b5e' : '#fff3cf';
      ctx.fillText(text, x, y);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  };

  const paintField = (): void => {
    const now = Date.now();

    for (const cast of caster.casts) {
      const fx = cast.from.x * TILE + TILE / 2;
      const fy = cast.from.y * TILE + TILE / 2;
      const tx = cast.to.x * TILE + TILE / 2;
      const ty = cast.to.y * TILE + TILE / 2;

      if (cast.missile !== undefined) {
        const t = missileProgress(cast, now);
        if (t < 1) {
          // Placed by pixel along the flight line, so the tile is the caster's
          // and the rest of the distance is an offset.
          drawEffectAt(
            'missile',
            cast.missile,
            cast.from,
            0,
            { x: cast.to.x - cast.from.x, y: cast.to.y - cast.from.y },
            { x: (tx - fx) * t, y: (ty - fy) * t },
          );
        }
      }

      // Effects play where the script puts them, which for a directional move
      // is beside the caster rather than on the target.
      const play = (id: number, tile: { x: number; y: number }, since: number) => {
        const group = set.appearances.effect?.[String(id)]?.groups[0];
        if (!group) return;
        const start = cast.missile !== undefined ? MISSILE_MS : 0;
        const phase = effectPhase(now - since - start, group.ph, group.d);
        if (phase < 0) return;
        drawEffectAt('effect', id, tile, phase);
      };

      if (cast.wave) {
        // Each step lights up in turn and keeps burning, the way the script's
        // chain of delayed events reads on screen.
        waveTiles(cast, now).forEach((tile, i) => {
          const lit = cast.at + i * cast.wave!.intervalMs;
          if (cast.sideEffect !== undefined) play(cast.sideEffect, tile, lit);
          if (cast.effect !== undefined) play(cast.effect, tile, lit);
        });
      } else if (cast.effect !== undefined) {
        play(cast.effect, cast.origin, cast.at);
      }

      // The move's name, over the caster, in its type's colour.
      const age = now - cast.at;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.round(10 * pixelRatio)}px ui-monospace, Consolas, monospace`;
      ctx.globalAlpha = Math.max(0, 1 - age / CAST_MS);
      ctx.fillStyle = ELEMENT_INK[cast.element] ?? '#e6ece9';
      ctx.strokeStyle = 'rgba(0, 0, 0, .85)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      const ly = cast.from.y * TILE - 30 - (age / CAST_MS) * 10;
      ctx.strokeText(cast.move, fx, ly);
      ctx.fillText(cast.move, fx, ly);
      ctx.restore();
    }

    if (releases.length) {
      releases = releases.filter((r) => now - r.at < 1200);
      for (const r of releases) {
        const group = set.appearances.effect?.[String(r.effect)]?.groups[0];
        if (!group) continue;
        const phase = effectPhase(now - r.at, group.ph, group.d);
        if (phase >= 0) drawEffectAt('effect', r.effect, { x: r.x, y: r.y }, phase);
      }
    }

    // Balls in flight, then the ball's own effect where it lands.
    if (throws.length) {
      throws = throws.filter((t) => now - t.at < BALL_FLIGHT_MS + BALL_SETTLE_MS + BALL_ANSWER_MS);
      for (const t of throws) {
        const age = now - t.at;
        if (age < BALL_FLIGHT_MS) {
          const k = age / BALL_FLIGHT_MS;
          const fx = t.from.x * TILE + TILE / 2;
          const fy = t.from.y * TILE + TILE / 2;
          const tx = t.to.x * TILE + TILE / 2;
          const ty = t.to.y * TILE + TILE / 2;
          // A ball arcs; a magic missile does not. Lifting it off the straight
          // line is the one liberty taken here, and it is what makes a throw
          // read as a throw.
          const arc = Math.sin(k * Math.PI) * 18;
          drawEffectAt(
            'missile',
            t.missile,
            t.from,
            0,
            { x: t.to.x - t.from.x, y: t.to.y - t.from.y },
            { x: (tx - fx) * k, y: (ty - fy) * k - arc },
          );
          continue;
        }

        // When the ball settles the answer arrives, and the server marks it on
        // the trainer wherever they are standing by then — not where they threw
        // from, which is why this reads the live position.
        const settled = age - BALL_FLIGHT_MS - BALL_SETTLE_MS;
        if (settled >= 0) {
          const own = set.appearances.effect?.[String(t.onPlayer)]?.groups[0];
          if (!own) continue;
          const phase = effectPhase(settled, own.ph, own.d);
          if (phase >= 0) drawEffectAt('effect', t.onPlayer, player, phase);
          continue;
        }

        const group = set.appearances.effect?.[String(t.effect)]?.groups[0];
        if (!group) continue;
        const phase = effectPhase(age - BALL_FLIGHT_MS, group.ph, group.d);
        if (phase >= 0) drawEffectAt('effect', t.effect, t.to, phase);
      }
    }

    if (!field.texts.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(11 * pixelRatio)}px ui-monospace, Consolas, monospace`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, Math.round(3 * pixelRatio));
    ctx.strokeStyle = 'rgba(0, 0, 0, .85)';
    for (const t of field.texts) {
      const age = now - t.bornAt;
      if (age < 0) continue;
      const life = age / FLOAT_MS;
      ctx.globalAlpha = Math.max(0, 1 - life);
      ctx.fillStyle = t.kind === 'catch' ? '#4fbcab' : '#d8a13d';
      const y = t.y * TILE - 26 - life * 22;
      ctx.strokeText(t.text, t.x * TILE + TILE / 2, y);
      ctx.fillText(t.text, t.x * TILE + TILE / 2, y);
    }
    ctx.restore();
  };

  /**
   * Creature names and health, over the world.
   *
   * The trainer gets a name and nothing else: they have no health of their
   * own here, and a bar under them would claim they did.
   */
  const paintNames = (): void => {
    const current = hunts.current;
    const target = current && field.armed ? field.focus(player, stuckTargets) : null;

    // The trainer walks a tile behind their Pokemon and stands on the same
    // tile as it at rest. Only that last case is a real conflict — two names
    // on one tile land exactly on top of each other — and there the trainer
    // wins, since the party panel already names the Pokemon.
    //
    // Suppressing the trainer for the whole hunt, which is what this used to
    // do, was a fix for the old DOM chips: those were boxes that collided
    // whenever the two were merely side by side. Outlined text at different
    // heights does not have that problem, and hiding the player's own name
    // for the entire hunt cost more than it saved.
    const lead = actors.find((a) => a.labelKind === 'party');
    const trainer = actors.find((a) => a.labelKind === 'mine');
    const stacked =
      lead !== undefined &&
      trainer !== undefined &&
      lead.x === trainer.x &&
      lead.y === trainer.y;

    /*
     * A name is wider than the tile it sits on, so the trainer and the Pokemon
     * standing next to each other overlap into one unreadable word — the
     * screenshot read "DeveAlxorout". One tile apart is exactly the distance
     * they walk at, so the trainer's name goes up a line whenever they are
     * that close.
     */
    const crowded =
      !stacked &&
      lead !== undefined &&
      trainer !== undefined &&
      Math.abs(lead.x - trainer.x) <= 1 &&
      Math.abs(lead.y - trainer.y) <= 1;

    for (const actor of actors) {
      if (!actor.label || actor.labelKind === 'npc') continue;
      if (actor.labelKind === 'party' && stacked) continue;

      if (actor.labelKind === 'wild') {
        const far = Math.max(Math.abs(actor.x - player.x), Math.abs(actor.y - player.y));
        if (far > LABEL_RANGE) continue;
        if (downTiles.has(`${actor.x},${actor.y}`)) continue;
      }

      let health: number | null = null;
      if (actor.labelKind === 'party') {
        const lead = party.find((m) => m.hp > 0) ?? party[0];
        health = lead && lead.maxHp > 0 ? lead.hp / lead.maxHp : 0;
      } else if (actor.labelKind === 'wild' && current) {
        // The one being fought drains at the run's own cadence; the rest of
        // the field is untouched and shows full.
        const engaged = target && target.x === actor.x && target.y === actor.y;
        health = engaged
          ? 1 - encounterProgress(current.run.activeMs, hunts.encounterSeconds(current.zone) * 1000)
          : 1;
      }

      const lift = crowded && actor.labelKind === 'mine' ? Math.round(13 * pixelRatio) : 0;
      drawName(
        lift ? { ...actor, oy: (actor.oy ?? 0) - lift } : actor,
        actor.label,
        actor.lookType,
        health,
      );
    }
  };

  // ── party panel ────────────────────────────────────────────────────────────

  const monsRoot = $('p-mons');

  /**
   * Send a Pokemon of the team out of its ball.
   *
   * The one in front is the one that fights — it leads the line, it is what
   * the caster arms with, and it is the seat the run deals damage to — so
   * choosing who is out is a reordering of the team. A hunt in progress is
   * told to move its health the same way, which is what lets a trainer swap
   * mid-hunt without handing the newcomer someone else's wounds.
   */
  const sendOutMon = (mon: PartyMon): void => {
    if (mon.hp <= 0) {
      openDrawer(
        'Equipe',
        `<b>${mon.name}</b> está desmaiado e não pode sair da pokébola. ` +
          `Use um <b>Revive</b> ou vá ao centro pokémon.`,
      );
      return;
    }

    // Where the one already out is standing, since that is where it is
    // recalled from.
    const outgoing = party[0];
    const recallAt = { x: player.x, y: player.y };

    const moved = sendOut(roster, mon.id);
    if (!moved.ok) return;

    // The run keeps health by seat, so it moves with them.
    if (moved.order) hunts.reorder(moved.order, Date.now());

    refreshParty();
    syncParty();
    armCaster();
    // The line re-forms behind whoever is now in front.
    strides.length = 0;
    actors = buildActors();
    saveRoster();
    renderParty();
    if (!depotPanel.hidden) renderDepot();

    /*
     * The ball's own effect, twice: once where the outgoing Pokemon is taken
     * back and once where the new one lands. `doRemoveSummon` in the base
     * plays `balls[key].effectRelease` for a recall as well, so both ends of
     * the swap look the same there and here.
     */
    const ball = currentBall() ?? BALLS[0];
    if (ball?.release) {
      const now = Date.now();
      if (outgoing && outgoing !== mon) {
        releases.push({ at: now, x: recallAt.x, y: recallAt.y, effect: ball.release });
      }
      releases.push({ at: now, x: player.x, y: player.y, effect: ball.release });
    }
  };

  const renderParty = () => {
    const at = trainerProgress();

    $('p-name').textContent = player.name;
    $('p-cash').textContent = `${player.coins.toLocaleString('pt-BR')} ¢`;
    $('p-avatar').replaceChildren(portrait(playerOutfit, 34));
    $('p-level').textContent = `Nv. ${at.level}`;
    $('p-xp').style.width = `${at.share * 100}%`;
    $('p-xptext').textContent =
      `${at.into.toLocaleString('pt-BR')} / ${at.need.toLocaleString('pt-BR')} exp` +
      `   ·   faltam ${at.left.toLocaleString('pt-BR')}`;

    monsRoot.replaceChildren();

    party.forEach((mon, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = i === 0 ? 'mon lead-mon' : 'mon';
      row.style.marginTop = i ? '6px' : '0';
      row.title =
        i === 0
          ? `${mon.name} está fora da pokébola`
          : mon.hp > 0
            ? `Enviar ${mon.name} para lutar`
            : `${mon.name} está desmaiado`;
      row.onclick = () => sendOutMon(mon);
      row.append(pokemonImage(mon.name, 'portrait', 34));

      const info = document.createElement('div');
      info.className = 'info';

      const top = document.createElement('div');
      top.className = 'top';
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = mon.name;
      const lv = document.createElement('span');
      lv.className = 'lv';
      // The one out of its ball says so; the rest read as what a click does.
      lv.textContent = i === 0 ? `Lv. ${mon.level} · em campo` : `Lv. ${mon.level}`;
      top.append(nm, lv);

      const hp = document.createElement('div');
      hp.className = 'bar hp';
      const hpFill = document.createElement('i');
      hpFill.style.width = `${(mon.hp / mon.maxHp) * 100}%`;
      hp.append(hpFill);

      const need = expToNext(mon.level);
      const exp = document.createElement('div');
      exp.className = 'bar exp';
      const expFill = document.createElement('i');
      expFill.style.width = `${Math.min(100, (mon.exp / Math.max(1, need)) * 100)}%`;
      exp.append(expFill);

      const nums = document.createElement('div');
      nums.className = 'nums';
      nums.textContent =
        `${mon.hp.toLocaleString('pt-BR')} / ${mon.maxHp.toLocaleString('pt-BR')}` +
        `   ·   EXP ${mon.exp.toLocaleString('pt-BR')} / ${need.toLocaleString('pt-BR')}`;

      info.append(top, hp, exp, nums);
      row.append(info);
      monsRoot.append(row);
    });
  };

  // ── market ─────────────────────────────────────────────────────────────────

  const marketRoot = $('market');

  const nearestMarket = () => {
    const inRelease = interactions.markets.filter(
      (m) =>
        m.z === floor &&
        m.x >= box.minX && m.x <= box.maxX &&
        m.y >= box.minY && m.y <= box.maxY,
    );
    const pool = inRelease.length ? inRelease : interactions.markets;
    let best: (typeof pool)[number] | undefined;
    let bestDist = Infinity;
    for (const m of pool) {
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d < bestDist) {
        best = m;
        bestDist = d;
      }
    }
    return best ? { market: best, dist: Math.round(bestDist) } : null;
  };

  const refreshMarket = () => {
    const near = nearestMarket();
    marketRoot.hidden = !near;
    if (!near) return;
    $('market-where').textContent = `${near.market.name} · ${near.dist} tiles`;
  };

  /**
   * Back to the Pokemon Center.
   *
   * The counterpart to a hunt pin: hunting walks the trainer out across the
   * map with no way home short of reloading. Coming home ends the run for the
   * same reason healing does — a run owns party health while it lasts, and it
   * would write the wounds back on the next tick.
   */
  $<HTMLButtonElement>('cp-open').addEventListener('click', () => {
    if (hunts.current) {
      hunts.stop();
      field.disarm();
      caster.disarm();
      throws = [];
      paintRun();
      renderCapture();
    }
    player.x = home.x;
    player.y = home.y;
    trail.reset(player);
    walker.stop();
    actors = buildActors();
    centreOnPlayer();
    refreshMarket();
    openDrawer('Centro Pokémon', 'Você voltou ao centro pokémon da cidade.');
  });

  $<HTMLButtonElement>('market-go').addEventListener('click', () => {
    const near = nearestMarket();
    if (!near) return;
    // Walking there is the server's job; for now the trainer simply arrives.
    player.x = near.market.x;
    player.y = near.market.y + 1;
    actors = buildActors();
    centreOnPlayer();
    refreshMarket();
    openDrawer('Mercado', `Você foi até <b>${near.market.name}</b>.`);
  });

  // ── hunts ──────────────────────────────────────────────────────────────────

  const lootBySpecies: Record<string, Array<[string, number, number]>> = {};
  for (const row of species) if (row.loot?.length) lootBySpecies[row.slug] = row.loot;

  const hunts = new HuntController(zones, lootBySpecies, manifest.releaseId);
  const syncParty = () =>
    hunts.setParty({
      dps: partyDps(party.map((m) => ({ level: m.level, moves: m.moves }))),
      catchRateBonus: 0,
      members: party.map((m) => ({ maxHp: m.maxHp })),
    });
  syncParty();

  const runPanel = $('run');
  const logPanel = $('log');
  const logLines = $('log-lines');
  const browser = $('browser');
  const huntOpen = $('hunt-open');

  // ── the hunt on the map ────────────────────────────────────────────────────

  const field = new HuntField({ stepDuration: (speed) => stepDurationMs(speed) });

  /**
   * Damage numbers in the air.
   *
   * What a hit is worth and what a wound cost both come from the simulation —
   * see damage.ts. These are a picture of the fight the log is already
   * recording, the same way the walk to the target is.
   */
  const floaters = new Floaters();

  /**
   * Balls in the air.
   *
   * `catch.lua` throws the ball as a distance shot from the player to the
   * corpse, removes the corpse, then plays the ball's own success or failure
   * effect there and waits 2.6 seconds before telling the player. This mirrors
   * that sequence: the throw is the only part of a capture that has anything
   * to look at, and without it a catch is just a line in a log.
   */
  const BALL_FLIGHT_MS = 320;
  const BALL_SETTLE_MS = 2600;
  /** How long the trainer's own effect stays up after the answer lands. */
  const BALL_ANSWER_MS = 900;
  type BallThrow = {
    at: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    missile: number;
    effect: number;
    /** Effect played on the trainer when the ball settles. */
    onPlayer: number;
    caught: boolean;
    name: string;
  };
  let throws: BallThrow[] = [];

  /**
   * Pokemon coming out of a ball.
   *
   * `balls[key].effectRelease` is the effect the base plays where a Pokemon is
   * let out — 189 for a Poke Ball, one per kind. Sending someone out with no
   * puff at all reads as a Pokemon that teleported.
   */
  type Release = { at: number; x: number; y: number; effect: number };
  let releases: Release[] = [];
  const caster = new Caster(moveVisuals, Math.random, (effectId) => {
    const group = set.appearances.effect?.[String(effectId)]?.groups[0];
    return group ? effectDuration(group.ph, group.d) : CAST_MS;
  });

  /**
   * Go to a zone and start hunting it.
   *
   * Travel is instant on purpose: this is an idle game, and the reference
   * game teleports too. What matters is that the trainer really is standing
   * in the zone afterwards — same coordinates the compiler packed, same tiles,
   * the zone's own wild Pokémon around them — rather than watching numbers
   * tick from a city they never left.
   */
  /** Give the caster whoever is leading now: a hunt starts and restarts with it. */
  const armCaster = (): void => {
    const lead = party.find((m) => m.hp > 0) ?? party[0];
    if (!lead) return;
    caster.arm(
      lead.moves.map(([name, power, interval, chance, element]) => ({
        name,
        power,
        interval,
        chance,
        element,
      })),
      Date.now(),
    );
  };

  const travelToHunt = (zone: ZoneRow): void => {
    const level = trainerLevel();
    if (zone.requiredLevel > level) {
      // The rule of the game, checked before the limits of the release: every
      // zone in every region opens up at its own level.
      const at = trainerProgress();
      openDrawer(
        'Nível insuficiente',
        `<b>${zone.displayName}</b> exige nível ${zone.requiredLevel}. ` +
          `Você é nível ${level} — faltam ${at.left.toLocaleString('pt-BR')} de ` +
          `experiência para o próximo nível. Cace em zonas mais fracas para subir.`,
      );
      return;
    }

    if (!packedZones.has(zone.id)) {
      // Every zone is listed and searchable, but only the packed ones have
      // tiles in this release. Walking the camera into unpacked space would
      // show a black screen and look like a crash.
      openDrawer(
        'Fora do alcance',
        `<b>${zone.displayName}</b> em ${zone.region} ainda não faz parte deste release. ` +
          `Zonas disponíveis: ${packedZones.size}.`,
      );
      return;
    }

    // Beside a real spawn point, not the middle of the bounding box — and on
    // a tile that is actually walkable, since the tile south of a spawn can be
    // a tree or the water's edge.
    const wanted = landingSpot(wild, zone) ?? { x: zone.center.x, y: zone.center.y };
    const spot = grid.nearestOpen(wanted) ?? wanted;
    player.x = spot.x;
    player.y = spot.y;
    actors = buildActors();
    centreOnPlayer();
    refreshMarket();

    field.arm(wild, zone, player);
    armCaster();
    trail.reset(player);
    walker.stop();
    pathTarget = null;
    stuckTargets = new Set<string>();
    renderCapture();

    // The run never catches on its own. In this base a capture is an action:
    // a ball thrown at a body that is lying on the ground. Leaving `ball` null
    // is what stopped every kill from also being a free capture.
    hunts.setPolicy({ ...DEFAULT_POLICY, ball: null });

    // Wounds travel: the party arrives as it left the last zone.
    hunts.start(zone.id, Date.now(), party.map((m) => m.hp));
    seenActiveMs = 0;
    logLines.replaceChildren();
    browser.hidden = true;
    paintRun();

    openDrawer(
      'Hunt',
      `Você viajou até <b>${zone.displayName}</b> em ${zone.region}. ` +
        `${field.all.length} selvagens por perto.`,
    );
  };

  const fmtDuration = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
  };

  const pushLog = (lines: LogLine[]) => {
    for (const line of lines) {
      const el = document.createElement('div');
      el.className = 'kill';

      const drops = line.loot.map((d) => `${d.id} x${d.count}`).join(", ");
      el.innerHTML =
        `<span class="who">${line.species}</span> derrotado ` +
        `<span class="gain">+${line.experience.toLocaleString('pt-BR')} exp</span>` +
        (line.caught ? ' <span class="catch">· capturado</span>' : '') +
        (drops ? `<br><span class="drop">${drops}</span>` : '');

      logLines.prepend(el);
    }
    // The log is a tail, not an archive: old lines are dropped.
    while (logLines.childElementCount > 40) logLines.lastElementChild?.remove();
  };

  /**
   * Note a move going off in the combat log.
   *
   * The animation over the Pokemon lasts under a second and is easy to miss;
   * the log is where the player can actually read what their team is doing.
   * It also says plainly when a move has no animation in this release, rather
   * than leaving a silent gap that looks like a bug.
   */
  const pushCasts = (casts: readonly Cast[]) => {
    for (const cast of casts) {
      const el = document.createElement('div');
      el.className = 'cast';
      const ink = ELEMENT_INK[cast.element] ?? 'var(--ink)';
      const silent = cast.effect === undefined && cast.missile === undefined;
      el.innerHTML =
        `<span class="move" style="color:${ink}">${cast.move}</span>` +
        (silent ? ' <span class="quiet">sem animação</span>' : '');
      logLines.prepend(el);
    }
    while (logLines.childElementCount > 40) logLines.lastElementChild?.remove();
  };

  const paintRun = () => {
    const current = hunts.current;
    runPanel.hidden = !current;
    logPanel.hidden = !current;
    if (!current) return;

    const { run, zone } = current;
    $('r-zone').textContent = `${zone.displayName} · nv ${zone.requiredLevel}`;
    $('r-time').textContent = fmtDuration(run.activeMs);
    $('r-kills').textContent = run.rewards.encounters.toLocaleString('pt-BR');
    $('r-exp').textContent = run.rewards.experience.toLocaleString('pt-BR');
    $('r-catch').textContent = run.rewards.catches.toLocaleString('pt-BR');
    $('r-rate').textContent = `${hunts.encounterSeconds(zone).toFixed(1)}s`;

    const drops = Object.entries(run.rewards.loot).sort((a, b) => b[1] - a[1]);
    $('r-drops').textContent = drops.length
      ? drops.map(([id, n]) => `${id} x${n.toLocaleString('pt-BR')}`).join('  ·  ')
      : 'nenhum drop ainda';
  };

  /**
   * Hunt experience, paid to the whole team.
   *
   * Every Pokemon that is out earns the full amount rather than a split share,
   * and so does the trainer — same hunt, same experience. The trainer's half is
   * `stats.experience`, credited from these very lines by `noteProgress`, so
   * it is not added again here.
   */
  const applyExperience = (gained: number) => {
    if (gained <= 0 || party.length === 0) return;

    const grown: string[] = [];
    for (const mon of party) {
      const after = gainInto(mon.level, mon.exp, gained);
      mon.exp = after.into;
      if (after.levels <= 0) continue;

      mon.level = after.level;
      const row = speciesRow(mon.slug);
      if (row) {
        // Health comes off the species row at the new level. The extra is a
        // gift rather than a wound, so the Pokemon keeps the difference.
        const maxHp = hpAtLevel(row, mon.level);
        mon.hp = Math.min(maxHp, mon.hp + Math.max(0, maxHp - mon.maxHp));
        mon.maxHp = maxHp;
      }
      grown.push(`<b>${mon.name}</b> chegou ao nível ${mon.level}`);
    }

    syncParty();
    saveParty();
    renderParty();
    if (grown.length) openDrawer('Subiu de nível', grown.join('<br>'));
  };

  // The zone browser is a region map. Pins land where the species actually
  // spawns because the minimap and the zone centres come out of the same
  // compiled release and therefore share one coordinate space.
  const regionMeta = new Map<string, RegionRow>(minimaps.map((m) => [m.name, m]));

  /**
   * How far the hunt map is magnified past the fit-to-dialog size.
   *
   * One, and the whole region is on screen with pins too small to tell apart;
   * four, and a pin is a readable portrait you can aim at.
   */
  let mapZoom = 1;
  const MAP_ZOOM_MIN = 1;
  const MAP_ZOOM_MAX = 6;

  /**
   * How many pins the map has room for at this size.
   *
   * A pin is 54px across and carries a name under it, so it needs far more
   * than its own width to stay readable — about 150px of map to itself. Below
   * that they tile over the coastline they are supposed to be marking, and no
   * amount of nudging helps because there is nowhere to nudge to.
   *
   * The count follows the area, so zooming in reveals the rest. That is the
   * same reason to zoom in that any map has.
   */
  const PIN_ROOM = 150;

  const pinBudget = (meta: RegionRow, scale: number): number => {
    const area = meta.width * scale * meta.height * scale;
    return Math.max(10, Math.floor(area / (PIN_ROOM * PIN_ROOM)));
  };

  const setZoom = (next: number, anchor?: { x: number; y: number }) => {
    const clamped = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, next));
    if (clamped === mapZoom) return;

    // Keep whatever is under the cursor under the cursor: without this,
    // zooming always pulls towards the top-left corner and you lose the place
    // you were looking at.
    const wrap = $('map-wrap');
    const ratio = clamped / mapZoom;
    const focusX = anchor ? anchor.x : wrap.clientWidth / 2;
    const focusY = anchor ? anchor.y : wrap.clientHeight / 2;
    const beforeX = wrap.scrollLeft + focusX;
    const beforeY = wrap.scrollTop + focusY;

    mapZoom = clamped;
    renderZones();

    wrap.scrollLeft = beforeX * ratio - focusX;
    wrap.scrollTop = beforeY * ratio - focusY;
  };
  const zonesIn = (region: string) => zones.filter((z) => z.region === region).length;
  const regionNames = [...new Set(zones.map((z) => z.region))]
    .filter((r) => regionMeta.has(r))
    .sort((a, b) => zonesIn(b) - zonesIn(a));

  let activeRegion = regionNames[0] ?? '';
  const activeTypes = new Set<string>();
  const zoneTypes = [...new Set(zones.flatMap((z) => z.types))].filter(Boolean).sort();

  const regionsRoot = $('regions');
  const typesRoot = $('types');
  const pinsRoot = $('pins');
  const mapImg = $<HTMLImageElement>('map-img');

  const buildRegionTabs = () => {
    regionsRoot.replaceChildren();
    for (const name of regionNames) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = name === activeRegion ? 'on' : '';
      btn.innerHTML = `${name}<span class="count">${zonesIn(name)}</span>`;
      btn.onclick = () => {
        activeRegion = name;
        buildRegionTabs();
        renderZones();
      };
      regionsRoot.append(btn);
    }
  };

  const buildTypeChips = () => {
    typesRoot.replaceChildren();
    for (const type of zoneTypes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = type;
      btn.className = activeTypes.has(type) ? 'on' : '';
      btn.onclick = () => {
        if (activeTypes.has(type)) activeTypes.delete(type);
        else activeTypes.add(type);
        buildTypeChips();
        renderZones();
      };
      typesRoot.append(btn);
    }
  };

  const renderZones = () => {
    const meta = regionMeta.get(activeRegion);
    const q = $<HTMLInputElement>('z-q').value.trim().toLowerCase();
    const min = Number($<HTMLInputElement>('z-min').value) || 0;
    const max = Number($<HTMLInputElement>('z-max').value) || Infinity;

    const rows = zones.filter((z) => {
      if (z.region !== activeRegion) return false;
      if (z.requiredLevel < min || z.requiredLevel > max) return false;
      if (activeTypes.size && !z.types.some((t) => activeTypes.has(t))) return false;
      if (q && !z.displayName.toLowerCase().includes(q)) return false;
      return true;
    });

    const level = trainerLevel();
    const open = rows.filter((z) => z.requiredLevel <= level).length;
    $('z-count').textContent =
      `${rows.length.toLocaleString('pt-BR')} zonas · ` +
      `${open.toLocaleString('pt-BR')} liberadas no nível ${level}`;
    pinsRoot.replaceChildren();
    $('map-empty').hidden = rows.length > 0;

    if (!meta) {
      mapImg.removeAttribute('src');
      return;
    }

    // Kanto is 2,000 tiles across in a dialog a thousand wide, so fitting it
    // makes every pin a speck. The fit is the floor, not the ceiling: zooming
    // past it magnifies, and `image-rendering: pixelated` keeps a one-pixel-
    // per-tile minimap crisp rather than blurring the coastline.
    const wrap = $('map-wrap');
    const fit = Math.min(1, (wrap.clientWidth - 4) / meta.width);
    const scale = fit * mapZoom;

    mapImg.src = `/release/minimap/${activeRegion.toLowerCase()}.png?v=${manifest.releaseId}`;
    mapImg.style.width = `${Math.round(meta.width * scale)}px`;
    pinsRoot.style.width = `${Math.round(meta.width * scale)}px`;
    pinsRoot.style.height = `${Math.round(meta.height * scale)}px`;
    $('z-zoom').textContent = `${Math.round(mapZoom * 100)}%`;

    // Overlapping pins are unclickable, so only one zone per species gets one.
    // A zone this release can actually be played in wins that slot outright —
    // picking the busiest instead would hide the playable Weedle zone behind a
    // bigger one whose tiles were never packed. The rest stay reachable
    // through the search box.
    const seen = new Set<string>();
    const pinned = rows
      .slice()
      .sort(
        (a, b) =>
          Number(packedZones.has(b.id)) - Number(packedZones.has(a.id)) ||
          b.population - a.population,
      )
      .filter((z) => {
        if (seen.has(z.species)) return false;
        seen.add(z.species);
        return true;
      })
      // Only as many as the map has room for.
      //
      // A hundred and eight pins on a region drawn a thousand pixels wide
      // tile the whole thing over: they cover the coastline they are supposed
      // to be marking and no amount of nudging them apart helps, because
      // there is nowhere to nudge to. So the count follows the area, and
      // zooming in is what reveals the rest — which is the same reason to
      // zoom in that a real map has.
      .slice(0, pinBudget(meta, scale));

    // Where each pin wants to be, before anything is pushed apart.
    const placed = pinned.map((zone) => ({
      zone,
      x: (zone.center.x - meta.originX) * scale,
      y: (zone.center.y - meta.originY) * scale,
    }));

    /**
     * Nudge overlapping pins apart.
     *
     * Zones cluster — a dozen species share one forest — and at fit-to-dialog
     * size their pins land on top of each other, which makes the ones
     * underneath unclickable however pretty they are. A few relaxation passes
     * push any pair closer than a pin's width apart, along the line between
     * them, so the cluster opens up without anyone moving far from the place
     * they actually mark.
     */
    const SPREAD = 58;
    for (let pass = 0; pass < 40; pass++) {
      let moved = false;
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!;
          const b = placed[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          if (distance >= SPREAD) continue;

          // Two pins on exactly the same spot have no line to separate along,
          // so the pass index picks an arbitrary but stable direction.
          const angle = distance < 0.01 ? (i * 2.399) : Math.atan2(dy, dx);
          const push = (SPREAD - distance) / 2;
          const ox = Math.cos(angle) * push;
          const oy = Math.sin(angle) * push;

          a.x -= ox;
          a.y -= oy;
          b.x += ox;
          b.y += oy;
          moved = true;
        }
      }
      if (!moved) break;
    }

    for (const { zone, x, y } of placed) {
      const sp = species.find((s) => s.slug === zone.species && s.variant === zone.variant);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin';
      pin.style.left = `${x}px`;
      pin.style.top = `${y}px`;
      pin.title =
        `${zone.displayName} · nv ${zone.requiredLevel} · ${zone.types.join('/')} · ` +
        `${zone.population} spawns · z${zone.z}`;

      if (sp) pin.append(pokemonImage(sp.name, 'portrait', 42));

      const locked = zone.requiredLevel > level;
      const cap = document.createElement('span');
      cap.className = 'cap';
      cap.innerHTML =
        `<b>${zone.displayName}</b><i>${locked ? '🔒 ' : ''}Nv ${zone.requiredLevel}</i>`;
      pin.append(cap);

      // Locked reads at a glance: the picture greys out and the level turns
      // red. The pin still answers a click, with the reason.
      if (locked) pin.classList.add('locked');
      const reachable = packedZones.has(zone.id);
      if (!reachable) pin.classList.add('far');

      pin.onclick = () => travelToHunt(zone);
      pinsRoot.append(pin);
    }
  };

  /**
   * Drag the map with the mouse.
   *
   * A region is several times the dialog at any useful zoom, and hunting for
   * the scrollbar to see the next island is not how anyone reads a map. The
   * drag only takes over after a few pixels of movement, so a click that
   * happens to wobble still lands on the pin under it.
   */
  {
    const wrap = $('map-wrap');
    let panning = false;
    let startX = 0;
    let startY = 0;
    let fromLeft = 0;
    let fromTop = 0;

    wrap.addEventListener('pointerdown', (event) => {
      const pointer = event as PointerEvent;
      if (pointer.button !== 0) return;
      panning = true;
      startX = pointer.clientX;
      startY = pointer.clientY;
      fromLeft = wrap.scrollLeft;
      fromTop = wrap.scrollTop;
    });

    wrap.addEventListener('pointermove', (event) => {
      if (!panning) return;
      const pointer = event as PointerEvent;
      const dx = pointer.clientX - startX;
      const dy = pointer.clientY - startY;
      if (!wrap.classList.contains('panning')) {
        if (Math.hypot(dx, dy) < 4) return;
        wrap.classList.add('panning');
        wrap.setPointerCapture(pointer.pointerId);
      }
      wrap.scrollLeft = fromLeft - dx;
      wrap.scrollTop = fromTop - dy;
    });

    const endPan = (event: Event) => {
      if (!panning) return;
      panning = false;
      const pointer = event as PointerEvent;
      // A drag that moved the map must not also count as a click on whatever
      // pin happened to be under the cursor when it started.
      if (wrap.classList.contains('panning')) {
        wrap.classList.remove('panning');
        if (pointer.pointerId !== undefined && wrap.hasPointerCapture?.(pointer.pointerId)) {
          wrap.releasePointerCapture(pointer.pointerId);
        }
        wrap.addEventListener('click', (click) => click.stopPropagation(), {
          capture: true,
          once: true,
        });
      }
    };
    wrap.addEventListener('pointerup', endPan);
    wrap.addEventListener('pointercancel', endPan);
    wrap.addEventListener('pointerleave', endPan);
  }

  huntOpen.addEventListener('click', () => {
    browser.hidden = !browser.hidden;
    if (!browser.hidden) {
      buildRegionTabs();
      buildTypeChips();
      renderZones();
    }
  });
  $('z-close').addEventListener('click', () => (browser.hidden = true));
  $('z-clear').addEventListener('click', () => {
    $<HTMLInputElement>('z-q').value = '';
    $<HTMLInputElement>('z-min').value = '';
    $<HTMLInputElement>('z-max').value = '';
    activeTypes.clear();
    buildTypeChips();
    renderZones();
  });
  for (const id of ['z-q', 'z-min', 'z-max']) {
    $(id).addEventListener('input', renderZones);
  }

  $('z-in').addEventListener('click', () => setZoom(mapZoom * 1.5));
  $('z-out').addEventListener('click', () => setZoom(mapZoom / 1.5));
  $('z-fit').addEventListener('click', () => setZoom(1));

  // The wheel zooms rather than scrolls, anchored where the cursor is, which
  // is what every map behaves like. Shift-wheel is left alone so the pane can
  // still be scrolled by hand.
  $('map-wrap').addEventListener(
    'wheel',
    (event) => {
      const wheel = event as WheelEvent;
      if (wheel.shiftKey) return;
      wheel.preventDefault();

      const wrap = $('map-wrap');
      const box = wrap.getBoundingClientRect();
      setZoom(mapZoom * (wheel.deltaY < 0 ? 1.2 : 1 / 1.2), {
        x: wheel.clientX - box.left,
        y: wheel.clientY - box.top,
      });
    },
    { passive: false },
  );
  $('r-stop').addEventListener('click', () => {
    const finished = hunts.stop();
    field.disarm();
    caster.disarm();
    throws = [];
    paintRun();
    renderCapture();
    if (finished) {
      openDrawer(
        'Hunt encerrada',
        `<b>${finished.rewards.encounters.toLocaleString('pt-BR')}</b> derrotados · ` +
          `<b>${finished.rewards.experience.toLocaleString('pt-BR')}</b> exp · ` +
          `<b>${finished.rewards.catches}</b> capturas.`,
      );
    }
  });


  // ── capture ────────────────────────────────────────────────────────────────

  /**
   * Throwing a ball at a body.
   *
   * `data/actions/scripts/poke/catch.lua` is the whole mechanic: you use a
   * ball on a corpse, the ball is removed whether or not it works, a distance
   * shot flies from you to the body, and the roll is
   *
   *     math.random(0, 10000) <= catchChance * ball.chanceMultiplier
   *
   * A plain Poke Ball multiplies by 100, so against an ordinary species the
   * roll is close to a formality — what is actually scarce is the ball. That
   * is the economy, and it is why this is a button and not something a hunt
   * does on its own.
   */
  const capturePanel = $('capture');
  const capRows = $('cap-rows');

  const throwBall = (corpseId: number): void => {
    const now = Date.now();
    const ball = currentBall();
    if (!ball) return;

    const body = field.corpses.find((c) => c.id === corpseId);
    const row = body ? species.find((r) => r.name === body.name && r.variant === 'base') : undefined;

    // `catch.lua` checks this before it takes the ball: a species written with
    // `catchChance = 0` answers "impossible to catch this monster" and the
    // throw never happens. Sixty-six of this base's species are that.
    if (body && !isCatchable(row?.catch ?? 0)) {
      openDrawer(
        'Captura',
        `<b>${body.name}</b> não pode ser capturado. A ficha dele no servidor traz ` +
          `<i>catchChance = 0</i>, e nenhuma pokébola muda isso. Sua bola não foi gasta.`,
      );
      return;
    }

    const corpse = field.claim(corpseId, now);
    if (!corpse) return;

    // The ball goes whether or not it lands.
    const held = bag.items[ball.item] ?? 0;
    if (held <= 1) delete bag.items[ball.item];
    else bag.items[ball.item] = held - 1;

    const caught = rollCatch(row?.catch ?? 0, ball.multiplier);

    throws.push({
      at: now,
      from: { ...player },
      to: { x: corpse.x, y: corpse.y },
      missile: ball.missile,
      effect: caught ? ball.succeed : ball.fail,
      // The server plays one more effect on the trainer when the ball settles,
      // and which one is the answer.
      onPlayer: caught ? catchEffects.caught : catchEffects.escaped,
      caught,
      name: corpse.name,
    });

    // The base waits 2.6 seconds before telling the player, which is the ball
    // rocking on the ground. Same here: the answer arrives when it settles.
    window.setTimeout(() => {
      field.clear(corpse.id);
      if (caught) {
        const slug = row?.slug ?? corpse.name.toLowerCase();
        const mon = makeMon(slug, { level: corpse.level });
        if (mon) {
          // Straight to the box. The player decides at the depot whether it
          // goes out; a capture never displaces someone already fighting.
          addCaught(roster, mon);
          saveRoster();
          if (!depotPanel.hidden) renderDepot();
        }
        recordCatch(slug, 'base');
        const rare = mon ? ` · ${rarityOf(ivTotal(mon)).label}` : '';
        openDrawer('Captura', `Você pegou um <b>${corpse.name}</b>${rare}! Ele está no depot.`);
      } else {
        openDrawer('Captura', `O <b>${corpse.name}</b> escapou.`);
      }
      saveBag();
      renderCapture();
      if (!bagPanel.hidden) renderBag();
    }, BALL_FLIGHT_MS + BALL_SETTLE_MS);

    saveBag();
    renderCapture();
  };

  const renderCapture = () => {
    const bodies = field.corpses.filter((c) => !c.claimed);
    capturePanel.hidden = !hunts.current;
    if (capturePanel.hidden) return;

    const ball = currentBall();
    const balls = ballCount(ball);
    $('cap-count').textContent = `${bodies.length} ${bodies.length === 1 ? 'corpo' : 'corpos'}`;

    /*
     * Every kind of ball, each with the sprite the base draws for that item
     * rather than one generic picture for all four. The count is what is in
     * the bag; a kind the player is out of stays on the row, dimmed, so they
     * can see what they are missing before a body is lying there.
     */
    const purses = $('cap-purses');
    purses.replaceChildren();
    for (const kind of BALLS) {
      const held = bag.items[kind.item] ?? 0;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'purse ball';
      chip.classList.toggle('empty', held === 0);
      chip.classList.toggle('on', ball?.key === kind.key);
      chip.title =
        held === 0
          ? `${kind.label} — nenhuma na mochila`
          : ball?.key === kind.key
            ? `${kind.label} · ${held} — será usada no próximo lançamento`
            : `${kind.label} · ${held} — clique para usar esta`;

      const entry = itemIndex[kind.item];
      if (entry) chip.append(portrait(entry.cid, 18, 'item'));

      const count = document.createElement('b');
      count.textContent = held.toLocaleString('pt-BR');
      chip.append(count);

      chip.onclick = () => {
        if (held === 0) {
          openShop('Mark');
          return;
        }
        chosenBall = kind.key;
        renderCapture();
      };
      purses.append(chip);
    }

    const gold = document.createElement('span');
    gold.className = 'purse gold';
    gold.textContent = `$ ${player.coins.toLocaleString('pt-BR')}`;
    purses.append(gold);

    capRows.replaceChildren();
    if (!bodies.length) {
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = 'Nenhum corpo por perto. Derrote um selvagem para poder capturar.';
      capRows.append(note);
      return;
    }

    const now = Date.now();
    for (const body of bodies) {
      const el = document.createElement('div');
      el.className = 'corpse';
      el.append(pokemonImage(body.name, 'portrait', 30));

      // What this ball is worth against this body, by the base's own numbers.
      const row = species.find((r) => r.name === body.name && r.variant === 'base');
      const catchValue = row?.catch ?? 0;
      const odds = ball ? catchChanceOf(catchValue, ball.multiplier) : 0;
      const impossible = !isCatchable(catchValue);

      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.innerHTML =
        `${body.name}<span class="lv">Nv ${body.level} · ` +
        (impossible
          ? '<b class="no">não capturável</b>'
          : `<b class="odds">${formatChance(odds)}</b>`) +
        '</span>';

      const act = document.createElement('button');
      act.type = 'button';
      act.textContent = 'Lançar';
      act.disabled = balls === 0 || impossible;
      // Which ball it will be is on the highlighted chip above, not repeated
      // on every body: "Lançar Poké" on four rows reads worse than "Lançar".
      act.title = impossible
        ? `${body.name} tem catchChance = 0 no servidor: nenhuma bola o captura`
        : balls === 0
          ? 'Sem poké bolas — compre com o Mark'
          : `${ball?.label} · ${formatChance(odds)} de captura`;
      act.onclick = () => throwBall(body.id);

      const fuse = document.createElement('div');
      fuse.className = 'fuse';
      const left = document.createElement('i');
      const total = Math.max(1, body.diesAt - body.bornAt);
      left.style.width = `${Math.max(0, Math.min(100, ((body.diesAt - now) / total) * 100))}%`;
      fuse.append(left);

      el.append(nm, act, fuse);
      capRows.append(el);
    }
  };

  $('cap-shop').addEventListener('click', () => openShop('Mark'));

  // ── shop ───────────────────────────────────────────────────────────────────

  /**
   * Mark's counter.
   *
   * The lists are his own, out of `npc/Mark.xml`: ten things he sells and a
   * hundred and fourteen he buys back. Between them they close the loop the
   * rest of the game opens — a hunt drops loot he pays for, and he sells the
   * balls a capture spends.
   *
   * Prices are the base's, unmodified. Selling at the same price he buys at
   * would be a shop that prints money, and the base already avoids that.
   */
  const shopPanel = $('shop');
  const shopRows = $('shop-rows');
  let shopMode: 'buy' | 'sell' = 'buy';
  let shopOpen: ShopDef | null = null;

  const renderShop = () => {
    if (!shopOpen) return;
    $('shop-who').textContent = shopOpen.name;
    $('shop-purse').textContent = `${player.coins.toLocaleString('pt-BR')} ¢`;
    $('shop-tab-buy').classList.toggle('on', shopMode === 'buy');
    $('shop-tab-sell').classList.toggle('on', shopMode === 'sell');

    const rows = shopMode === 'buy' ? shopOpen.buy : shopOpen.sell;
    shopRows.replaceChildren();

    // Selling only lists what the player is actually carrying; a hundred rows
    // of things they do not have is a list nobody reads.
    const visible = shopMode === 'buy' ? rows : rows.filter((r) => (bag.items[r.name] ?? 0) > 0);

    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'note';
      empty.textContent =
        shopMode === 'buy'
          ? 'Nada à venda aqui.'
          : 'Você não tem nada que o Mark compre. Volte de uma hunt com loot.';
      shopRows.append(empty);
      return;
    }

    for (const row of visible) {
      const el = document.createElement('div');
      el.className = 'trade';
      el.append(portrait(row.cid, 32, 'item'));

      const nm = document.createElement('span');
      nm.className = 'nm';
      const held = bag.items[row.name] ?? 0;
      nm.innerHTML = `${row.name}<br><span class="have">na mochila: ${held.toLocaleString('pt-BR')}</span>`;

      const price = document.createElement('span');
      price.className = 'price';
      price.textContent = `${row.price.toLocaleString('pt-BR')} ¢`;

      const act = document.createElement('button');
      act.type = 'button';
      if (shopMode === 'buy') {
        act.textContent = 'Comprar';
        act.disabled = player.coins < row.price;
        act.onclick = () => {
          if (player.coins < row.price) return;
          player.coins -= row.price;
          bag.items[row.name] = (bag.items[row.name] ?? 0) + 1;
          saveBag();
          renderParty();
          renderShop();
          if (!bagPanel.hidden) renderBag();
        };
      } else {
        act.textContent = 'Vender';
        act.disabled = held === 0;
        act.onclick = () => {
          const have = bag.items[row.name] ?? 0;
          if (have === 0) return;
          if (have === 1) delete bag.items[row.name];
          else bag.items[row.name] = have - 1;
          player.coins += row.price;
          saveBag();
          renderParty();
          renderShop();
          if (!bagPanel.hidden) renderBag();
        };
      }

      el.append(nm, price, act);
      shopRows.append(el);
    }
  };

  const openShop = (npcName: string) => {
    const slug = npcName.toLowerCase().trim();
    const def = shops[slug];
    if (!def) {
      openDrawer('Mercado', `<b>${npcName}</b> não tem lista de comércio neste release.`);
      return;
    }
    shopOpen = def;
    shopMode = 'buy';
    shopPanel.hidden = false;
    renderShop();
  };

  $('shop-close').addEventListener('click', () => (shopPanel.hidden = true));
  $('shop-tab-buy').addEventListener('click', () => {
    shopMode = 'buy';
    renderShop();
  });
  $('shop-tab-sell').addEventListener('click', () => {
    shopMode = 'sell';
    renderShop();
  });

  // ── pokedex ────────────────────────────────────────────────────────────────

  const DEX_KEY = 'pokeidle.dex.v1';

  /** Species the trainer has caught, keyed `variant:slug`. */
  const caught = new Set<string>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(DEX_KEY) ?? '[]') as string[];
      } catch {
        return [];
      }
    })(),
  );

  const saveDex = () => {
    try {
      localStorage.setItem(DEX_KEY, JSON.stringify([...caught]));
    } catch {
      /* storage may be unavailable; the dex simply will not persist */
    }
  };

  const recordCatch = (slug: string, variant = 'base') => {
    const key = `${variant}:${slug}`;
    if (caught.has(key)) return false;
    caught.add(key);
    saveDex();
    return true;
  };

  const dexPanel = $('dex');
  const dexGrid = $('dex-grid');
  const dexOpen = $('dex-open');

  // Portraits are only drawn once they scroll into view: building a thousand
  // canvases up front costs seconds and most are never looked at.
  const dexObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const name = el.dataset.name;
        if (name && !el.querySelector('img.poke-art')) {
          el.prepend(pokemonImage(name, 'portrait', 48));
        }
        dexObserver.unobserve(el);
      }
    },
    // Root is the viewport, not the grid: the observer is constructed while
    // the panel is still display:none, and a root with no layout box at
    // construction never reports an intersection afterwards. The grid clips
    // its children anyway, so viewport intersection is the same answer.
    { rootMargin: '200px' },
  );

  const allTypes = [...new Set(species.flatMap((s) => s.types))].filter(Boolean).sort();
  for (const t of allTypes) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    $<HTMLSelectElement>('d-type').append(opt);
  }

  const renderDex = () => {
    const q = $<HTMLInputElement>('d-q').value.trim().toLowerCase();
    const type = $<HTMLSelectElement>('d-type').value;
    const variant = $<HTMLSelectElement>('d-variant').value;

    const rows = species.filter((sp) => {
      if (!sp.look) return false;
      if (variant && sp.variant !== variant) return false;
      if (type && !sp.types.includes(type)) return false;
      if (!q) return true;
      return sp.name.toLowerCase().includes(q) || String(sp.dex ?? '').includes(q);
    });

    const have = rows.filter((sp) => caught.has(`${sp.variant}:${sp.slug}`)).length;
    $('d-caught').textContent = have.toLocaleString('pt-BR');
    $('d-missing').textContent = (rows.length - have).toLocaleString('pt-BR');
    $('d-shiny').textContent = rows.filter((sp) => sp.shiny).length.toLocaleString('pt-BR');
    $('d-total').textContent = rows.length.toLocaleString('pt-BR');

    dexGrid.replaceChildren();
    for (const [i, sp] of rows.entries()) {
      const has = caught.has(`${sp.variant}:${sp.slug}`);
      const card = document.createElement('div');
      card.className = has ? 'dexmon caught' : 'dexmon';
      card.dataset.name = sp.name;
      card.title = `${sp.name} · ${sp.types.join('/')} · nv ${sp.level} · ${sp.hp.toLocaleString('pt-BR')} hp`;

      const no = document.createElement('span');
      no.className = 'no';
      no.textContent = `#${String(i + 1).padStart(3, '0')}`;
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = sp.name;
      const tp = document.createElement('span');
      tp.className = 'tp';
      tp.textContent = sp.types.join(' / ');

      card.append(no, nm, tp);
      if (sp.shiny) {
        const mark = document.createElement('span');
        mark.className = 'mark';
        mark.textContent = '✦';
        mark.title = 'tem forma shiny';
        card.append(mark);
      }

      card.onclick = () => showDexDetail(sp);
      card.style.cursor = 'pointer';
      dexGrid.append(card);
      dexObserver.observe(card);
    }
  };

  /** The move list only matters once a species is picked, so it opens on demand. */
  const showDexDetail = (sp: SpeciesRow) => {
    const host = $('dex-detail');
    host.hidden = false;
    host.replaceChildren();

    const head = document.createElement('div');
    head.className = 'head';
    head.append(pokemonImage(sp.name, 'artwork', 52));
    const info = document.createElement('div');
    info.innerHTML =
      `<div class="nm">${sp.name}</div>` +
      `<div class="st">${sp.types.join(' / ')} · nv ${sp.level} · ` +
      `${sp.hp.toLocaleString('pt-BR')} hp · ${sp.exp.toLocaleString('pt-BR')} exp</div>`;
    head.append(info);
    host.append(head);

    const moves = sp.moves ?? [];
    if (moves.length === 0) {
      const none = document.createElement('div');
      none.className = 'st';
      none.style.color = 'var(--faint)';
      none.textContent = 'Esta espécie não declara golpes na base.';
      host.append(none);
      return;
    }

    for (const [name, power, interval, , type] of moves) {
      const row = document.createElement('div');
      row.className = 'mvrow';
      const nm = document.createElement('span');
      nm.textContent = name;
      const p = document.createElement('span');
      p.className = 'p';
      p.textContent = `${power} poder`;
      const cd = document.createElement('span');
      cd.className = 'cd';
      cd.textContent = `${(interval / 1000).toFixed(0)}s`;
      row.append(nm, p, cd);
      if (type) {
        const tp = document.createElement('span');
        tp.className = 'tchip';
        tp.textContent = type;
        row.append(tp);
      }
      host.append(row);
    }
  };

  dexOpen.addEventListener('click', () => {
    dexPanel.hidden = !dexPanel.hidden;
    if (!dexPanel.hidden) renderDex();
  });
  $('dex-close').addEventListener('click', () => (dexPanel.hidden = true));
  for (const id of ['d-q', 'd-type', 'd-variant']) {
    $(id).addEventListener('input', renderDex);
  }

  // ── bag ────────────────────────────────────────────────────────────────────

  /**
   * Poke balls, from `balls` in data/lib/core/newfunctions.lua.
   *
   * Every field here is the base's: the item the shop sells, the multiplier
   * the catch roll uses, the missile that flies at the corpse and the two
   * effects that play when it lands. The four common balls multiply by 100,
   * which against any ordinary species makes the roll a formality — what is
   * actually scarce is the ball, and that is the mechanic.
   */
  type Ball = {
    key: string;
    item: string;
    label: string;
    multiplier: number;
    missile: number;
    succeed: number;
    fail: number;
    /** Effect where the Pokemon comes back out of the ball. */
    release: number;
  };

  /** `empty poke ball` reads as `Poké Ball` on a chip. */
  const ballLabel = (key: string, item: string): string => {
    const known: Record<string, string> = {
      pokeball: 'Poké Ball',
      great: 'Great Ball',
      super: 'Super Ball',
      ultra: 'Ultra Ball',
      saffari: 'Safari Ball',
      master: 'Master Ball',
    };
    if (known[key]) return known[key]!;
    const clean = item.replace(/^empty /, '').trim() || key;
    return clean.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  /**
   * Every ball the base can actually hand a player.
   *
   * Read from the release rather than written out here, because the table it
   * comes from is the one `catch.lua` rolls against. Twenty-eight entries are
   * declared there and four are real items; the rest name ids that do not
   * exist in items.xml, so no player of this server has ever held one.
   */
  const BALLS: Ball[] = ballRows
    .filter((row) => row.usable && row.item)
    .map((row) => ({
      key: row.key,
      item: row.item,
      label: ballLabel(row.key, row.item),
      multiplier: row.multiplier,
      missile: row.missile,
      succeed: row.succeed,
      fail: row.fail,
      release: row.release,
    }));

  /**
   * The ball a throw will use.
   *
   * The one the player picked in the capture panel, as long as they still have
   * one; otherwise the first they hold. Picking matters because the four are
   * not the same catch — an Ultra Ball on a common Pokemon is a wasted ball,
   * and a Poke Ball on something rare is a wasted body.
   */
  let chosenBall: string | null = null;
  const currentBall = (): Ball | null => {
    const picked = BALLS.find((b) => b.key === chosenBall);
    if (picked && (bag.items[picked.item] ?? 0) > 0) return picked;
    return BALLS.find((b) => (bag.items[b.item] ?? 0) > 0) ?? null;
  };
  const ballCount = (ball: Ball | null) => (ball ? (bag.items[ball.item] ?? 0) : 0);

  const BAG_KEY = 'pokeidle.bag.v1';

  /**
   * Potions, balls and loot. Pokemon are not in here any more: every capture
   * goes to the roster, which the depot edits.
   */
  type BagState = { items: Record<string, number> };

  const bag: BagState = { items: readJson<BagState>(BAG_KEY)?.items ?? {} };

  const saveBag = () => {
    try {
      localStorage.setItem(BAG_KEY, JSON.stringify(bag));
    } catch {
      /* storage may be unavailable */
    }
  };

  const bagPanel = $('bag');
  const bagGrid = $('bag-grid');

  const renderBag = () => {
    const itemRows = Object.entries(bag.items).sort((a, b) => b[1] - a[1]);
    const totalItems = itemRows.reduce((n, [, q]) => n + q, 0);

    $('bag-sum').textContent =
      `${itemRows.length.toLocaleString('pt-BR')} tipos de item · ` +
      `${totalItems.toLocaleString('pt-BR')} unidades · ` +
      `${roster.mons.length.toLocaleString('pt-BR')} pokémon no depot`;

    bagGrid.replaceChildren();

    {
      for (const [name, quantity] of itemRows) {
        const entry = itemIndex[name];
        const slot = document.createElement('div');
        slot.className = entry ? 'slot' : 'slot missing';
        slot.title = entry
          ? `${name} · item ${entry.cid}`
          : `${name} — nenhum item com esse nome existe na base`;

        if (entry) {
          slot.append(portrait(entry.cid, 32, 'item'));
        } else {
          const ghost = document.createElement('span');
          ghost.className = 'ghost';
          ghost.textContent = '?';
          slot.append(ghost);
        }

        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = name;
        const qty = document.createElement('span');
        qty.className = 'qty';
        qty.textContent = quantity > 9999 ? '9999+' : String(quantity);
        slot.append(nm, qty);
        bagGrid.append(slot);
      }
    }

    if (!bagGrid.childElementCount) {
      const empty = document.createElement('div');
      empty.id = 'bag-empty';
      empty.textContent = 'A mochila está vazia. Inicie uma hunt para começar a coletar.';
      bagGrid.append(empty);
    }
  };

  /** Drops and captures from a tick land here, which is what makes them real. */
  const creditRun = (lines: LogLine[]): void => {
    let changed = false;
    let caughtMons = false;
    const zone = hunts.current?.zone;

    for (const line of lines) {
      for (const drop of line.loot) {
        bag.items[drop.id] = (bag.items[drop.id] ?? 0) + drop.count;
        changed = true;
      }
      if (line.caught && zone) {
        const mon = makeMon(zone.species, { level: zone.requiredLevel });
        if (mon) {
          addCaught(roster, mon);
          caughtMons = true;
        }
      }
    }

    if (caughtMons) {
      saveRoster();
      if (!depotPanel.hidden) renderDepot();
    }
    if (!changed) return;
    saveBag();
    if (!bagPanel.hidden) renderBag();
  };

  $('bag-open').addEventListener('click', () => {
    bagPanel.hidden = !bagPanel.hidden;
    if (!bagPanel.hidden) renderBag();
  });
  $('bag-close').addEventListener('click', () => (bagPanel.hidden = true));

  // ── auto-helper ────────────────────────────────────────────────────────────

  /**
   * Potions, revives and balls used without being clicked.
   *
   * The rules are the base's, read out of its own scripts and kept in
   * `helper.ts`; what lives here is the wiring: spending from the bag, writing
   * health into the run that owns it, and drawing the panel.
   */
  const HELPER_KEY = 'pokeidle.helper.v1';
  const helper = cleanSettings(readJson(HELPER_KEY));

  const saveHelper = () => {
    try {
      localStorage.setItem(HELPER_KEY, JSON.stringify(helper));
    } catch {
      /* storage may be unavailable; the session still works */
    }
  };

  /** A potion in progress: the base heals over five ticks, one a second. */
  type Regen = { index: number; perTick: number; ticksLeft: number };
  let regens: Regen[] = [];
  /** `CONDITION_EXHAUST_HEAL`: one potion cannot follow another immediately. */
  let potionReadyAt = 0;
  let autoThrowAt = 0;
  /** Long enough to watch a ball land before the next one flies. */
  const AUTO_THROW_MS = 1500;

  const helperPanel = $('helper');
  const helperNote = (text: string) => {
    $('helper-last').textContent = text;
  };

  /** Take one of something out of the bag, dropping the row when it empties. */
  const spendItem = (name: string): boolean => {
    const held = bag.items[name] ?? 0;
    if (held <= 0) return false;
    if (held === 1) delete bag.items[name];
    else bag.items[name] = held - 1;
    saveBag();
    if (!bagPanel.hidden) renderBag();
    return true;
  };

  const renderHelper = () => {
    $<HTMLInputElement>('h-potion').checked = helper.potion;
    $<HTMLInputElement>('h-revive').checked = helper.revive;
    $<HTMLInputElement>('h-catch').checked = helper.catchNormal;
    $<HTMLInputElement>('h-catch-shiny').checked = helper.catchShiny;
    $<HTMLSelectElement>('h-threshold').value = String(helper.threshold);

    // Item pictures come from the base's own sprites, the same ones the bag
    // and the Mark's shop draw.
    const icon = (id: string, item: string) => {
      const entry = itemIndex[item];
      $(id).replaceChildren(entry ? portrait(entry.cid, 22, 'item') : document.createTextNode(''));
    };
    const inUse = pickPotion(helper, bag.items);
    icon('h-ic-potion', inUse?.item ?? POTIONS[0]!.item);
    icon('h-ic-revive', REVIVE_ITEM);
    icon('h-ic-catch', 'empty poke ball');
    icon('h-ic-shiny', 'empty ultra ball');

    const select = $<HTMLSelectElement>('h-potion-item');
    select.replaceChildren();
    let anyPotion = false;
    for (const potion of POTIONS) {
      const held = bag.items[potion.item] ?? 0;
      if (held > 0) anyPotion = true;
      const option = document.createElement('option');
      option.value = potion.item;
      // The share it heals is `5 / divisor` of maximum health, so the player
      // can tell a Hyper from a Great without leaving the panel.
      const share = Math.round((POTION_TICKS / potion.divisor) * 100);
      option.textContent = `${potion.label} ×${held.toLocaleString('pt-BR')} · ${share}%`;
      option.disabled = held === 0;
      select.append(option);
    }
    select.value = pickPotion(helper, bag.items)?.item ?? helper.potionItem;

    $('h-potion-sub').textContent = anyPotion ? '' : 'sem potions — compre com o Mark';
    const revives = bag.items[REVIVE_ITEM] ?? 0;
    $('h-revive-sub').textContent = revives
      ? `${revives.toLocaleString('pt-BR')} no estoque`
      : 'sem revives — compre com o Mark';
  };

  /**
   * One second of the helper.
   *
   * Driven by the same one-second tick that advances the hunt, which is also
   * the cadence the base's potion heals at (`CONDITION_PARAM_HEALTHTICKS` is
   * 1000). Order matters: what is already healing first, then the fallen, then
   * a fresh potion, then a ball.
   */
  const stepHelper = (now: number): void => {
    if (!hunts.current) {
      regens = [];
      return;
    }

    let moved = false;
    const setHp = (index: number, hp: number) => {
      const mon = party[index];
      if (!mon) return;
      // Into the run, not just the panel: the run owns party health while it
      // lasts and the next tick would undo anything written beside it.
      const got = hunts.heal(index, hp, mon.maxHp, now);
      if (got === null || got === mon.hp) return;
      mon.hp = got;
      moved = true;
    };

    for (const regen of regens) {
      const mon = party[regen.index];
      // A Pokemon that fainted mid-potion loses the rest of it, the way the
      // condition dies with the creature carrying it.
      if (!mon || mon.hp <= 0) {
        regen.ticksLeft = 0;
        continue;
      }
      setHp(regen.index, mon.hp + regen.perTick);
      regen.ticksLeft -= 1;
    }
    regens = regens.filter((r) => r.ticksLeft > 0);

    if (helper.revive) {
      party.forEach((mon, index) => {
        if (mon.hp > 0) return;
        if (!spendItem(REVIVE_ITEM)) return;
        // revive.lua writes the full maximum back, so a revive is a full heal.
        setHp(index, mon.maxHp);
        helperNote(`Revive usado em ${mon.name}.`);
      });
    }

    if (helper.potion && now >= potionReadyAt) {
      const index = party.findIndex((m) => needsPotion(m.hp, m.maxHp, helper.threshold));
      const potion = index === -1 ? null : pickPotion(helper, bag.items);
      const mon = index === -1 ? null : party[index];
      if (mon && potion && spendItem(potion.item)) {
        regens.push({
          index,
          perTick: potionTickHeal(mon.maxHp, potion),
          ticksLeft: POTION_TICKS,
        });
        potionReadyAt = now + POTION_EXHAUST_MS;
        helperNote(`${potion.label} em ${mon.name}.`);
      }
    }

    if ((helper.catchNormal || helper.catchShiny) && now - autoThrowAt >= AUTO_THROW_MS) {
      const body = field.corpses.find((c) => !c.claimed && shouldCatch(helper, c.name));
      if (body && currentBall()) {
        autoThrowAt = now;
        helperNote(`Bola lançada em ${body.name}.`);
        throwBall(body.id);
      }
    }

    if (moved) {
      saveParty();
      renderParty();
    }
    if (!helperPanel.hidden) renderHelper();
  };

  /**
   * Bring a wiped party back and pick the hunt up again.
   *
   * Without this the helper would revive nobody in the one case it exists for:
   * the run stops the moment the last Pokemon falls, and a stopped run has no
   * health to write into.
   */
  const reviveAfterWipe = (zone: ZoneRow | undefined, now: number): boolean => {
    if (!helper.revive || !zone) return false;

    let revived = 0;
    for (const mon of party) {
      if (mon.hp > 0) continue;
      if (!spendItem(REVIVE_ITEM)) break;
      mon.hp = mon.maxHp;
      revived += 1;
    }
    if (!revived) return false;

    saveParty();
    renderParty();
    regens = [];

    field.arm(wild, zone, player);
    armCaster();
    hunts.setPolicy({ ...DEFAULT_POLICY, ball: null });
    hunts.start(zone.id, now, party.map((m) => m.hp));
    seenActiveMs = 0;
    paintRun();
    renderCapture();
    helperNote(`${revived} revive${revived === 1 ? '' : 's'} usados — a hunt continua.`);
    openDrawer(
      'Auto-Revive',
      `Sua equipe caiu e voltou com ${revived} <b>revive${revived === 1 ? '' : 's'}</b>. ` +
        `A hunt em ${zone.displayName} recomeçou.`,
    );
    return true;
  };

  {
    const bind = (id: string, apply: (on: boolean) => void) => {
      $<HTMLInputElement>(id).addEventListener('change', (event) => {
        apply((event.target as HTMLInputElement).checked);
        saveHelper();
        renderHelper();
      });
    };
    bind('h-potion', (on) => (helper.potion = on));
    bind('h-revive', (on) => (helper.revive = on));
    bind('h-catch', (on) => (helper.catchNormal = on));
    bind('h-catch-shiny', (on) => (helper.catchShiny = on));

    $<HTMLSelectElement>('h-potion-item').addEventListener('change', (event) => {
      helper.potionItem = (event.target as HTMLSelectElement).value;
      saveHelper();
      renderHelper();
    });
    $<HTMLSelectElement>('h-threshold').addEventListener('change', (event) => {
      helper.threshold = Number((event.target as HTMLSelectElement).value);
      saveHelper();
      renderHelper();
    });
  }

  $('helper-open').addEventListener('click', () => {
    helperPanel.hidden = !helperPanel.hidden;
    if (!helperPanel.hidden) renderHelper();
  });
  $('helper-close').addEventListener('click', () => (helperPanel.hidden = true));

  // ── diamond shop ───────────────────────────────────────────────────────────

  /**
   * The cash shop, in the one currency of the base's five that is real.
   *
   * Only what has been spent is stored: the balance is earned per trainer
   * level, so keeping a second number would only give it something to drift
   * away from. See premium.ts for where the prices come from.
   */
  const SPENT_KEY = 'pokeidle.diamonds.v1';
  let diamondsSpent = Number(readJson<number>(SPENT_KEY) ?? 0) || 0;
  const diamonds = () => balanceOf(trainerLevel(), diamondsSpent);

  const saveDiamonds = () => {
    try {
      localStorage.setItem(SPENT_KEY, JSON.stringify(diamondsSpent));
    } catch {
      /* storage may be unavailable; the session still works */
    }
  };

  const diamondPanel = $('diamond');
  let diamondTab: 'supply' | 'pokemon' = 'supply';

  /**
   * Pokemon on sale.
   *
   * Drawn from the species this release actually packs, so what is bought can
   * be drawn, walked and fought with. Priced by how hard the base says they
   * are to catch.
   */
  const monOffers = (): Offer[] =>
    species
      .filter((sp) => sp.variant === 'base' && sp.spriteOk && sp.catch > 0)
      .slice()
      // Cheapest first, which is also commonest first: a shelf that opens on
      // three hundred diamonds is a shelf nobody can buy from.
      .sort((a, b) => b.catch - a.catch || a.name.localeCompare(b.name))
      .filter((_, i) => i % 5 === 0)
      .slice(0, 30)
      .map((sp) => ({
        kind: 'pokemon' as const,
        id: `mon-${sp.slug}`,
        label: sp.name,
        slug: sp.slug,
        level: Math.max(1, sp.level),
        price: priceOfSpecies(sp.catch),
      }));

  const offersNow = (): Offer[] => (diamondTab === 'supply' ? SUPPLIES : monOffers());

  const renderDiamond = () => {
    const balance = diamonds();
    const purse = $('dm-balance');
    purse.replaceChildren();
    const coin = itemIndex[DIAMOND_ITEM];
    if (coin) purse.append(portrait(coin.cid, 16, 'item'));
    const amount = document.createElement('b');
    amount.textContent = balance.toLocaleString('pt-BR');
    purse.append(amount);

    const grid = $('dm-grid');
    grid.replaceChildren();

    for (const offer of offersNow()) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'dm-card';
      card.disabled = offer.price > balance;

      if (offer.kind === 'item') {
        const entry = itemIndex[offer.item];
        if (entry) card.append(portrait(entry.cid, 34, 'item'));
        card.title = offer.label;
      } else {
        card.append(pokemonImage(offer.label, 'portrait', 40));
        card.title = `${offer.label} · nível ${offer.level}`;
      }

      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = offer.label;

      const cost = document.createElement('span');
      cost.className = 'cost';
      const gem = document.createElement('img');
      gem.src = '/art/customIcons/diamond16.png';
      gem.alt = '';
      cost.append(gem, document.createTextNode(String(offer.price)));

      card.append(nm, cost);

      if (card.disabled) {
        const away = levelsAway(offer.price, balance);
        const sub = document.createElement('span');
        sub.className = 'sub';
        sub.textContent = `faltam ${offer.price - balance} · ${away} ${away === 1 ? 'nível' : 'níveis'}`;
        card.append(sub);
      } else if (offer.kind === 'pokemon') {
        const sub = document.createElement('span');
        sub.className = 'sub';
        sub.textContent = `nível ${offer.level} · vai para o depot`;
        card.append(sub);
      }

      card.onclick = () => purchase(offer.id);
      grid.append(card);
    }

    $('dm-hint').textContent =
      `Diamantes vêm dos seus níveis: ${DIAMONDS_PER_LEVEL} a cada nível do treinador. ` +
      `Na base eles vêm de pagamento, que este jogo não tem.`;
  };

  const purchase = (id: string) => {
    const result = buy(offersNow(), id, diamonds());
    if (!result.ok) {
      if (result.reason === 'poor') {
        openDrawer(
          'Loja',
          `Faltam <b>${result.short}</b> diamantes. Suba de nível caçando: ` +
            `cada nível do treinador rende ${DIAMONDS_PER_LEVEL}.`,
        );
      }
      return;
    }

    const { offer } = result;
    if (offer.kind === 'item') {
      bag.items[offer.item] = (bag.items[offer.item] ?? 0) + offer.quantity;
      saveBag();
      if (!bagPanel.hidden) renderBag();
      openDrawer('Loja', `Você comprou <b>${offer.label}</b>.`);
    } else {
      const mon = makeMon(offer.slug, { level: offer.level });
      if (!mon) {
        openDrawer('Loja', `<b>${offer.label}</b> não está neste release.`);
        return;
      }
      addCaught(roster, mon);
      saveRoster();
      recordCatch(offer.slug, 'base');
      if (!depotPanel.hidden) renderDepot();
      openDrawer(
        'Loja',
        `<b>${offer.label}</b> é seu · ${rarityOf(ivTotal(mon)).label}. Ele está no depot.`,
      );
    }

    diamondsSpent += result.price;
    saveDiamonds();
    renderDiamond();
    if (!profPanel.hidden) renderProfile();
  };

  $('diamond-open').addEventListener('click', () => {
    diamondPanel.hidden = !diamondPanel.hidden;
    if (!diamondPanel.hidden) renderDiamond();
  });
  $('diamond-close').addEventListener('click', () => (diamondPanel.hidden = true));
  for (const btn of $('dm-tabs').querySelectorAll('button')) {
    btn.addEventListener('click', () => {
      diamondTab = (btn as HTMLElement).dataset.tab as typeof diamondTab;
      for (const b of $('dm-tabs').querySelectorAll('button')) b.classList.remove('on');
      btn.classList.add('on');
      renderDiamond();
    });
  }

  // ── depot ──────────────────────────────────────────────────────────────────

  const DEPOT_KEY = 'pokeidle.depot.v1';

  const depot: BagState = { items: readJson<BagState>(DEPOT_KEY)?.items ?? {} };

  const saveDepot = () => {
    try {
      localStorage.setItem(DEPOT_KEY, JSON.stringify(depot));
    } catch {
      /* storage may be unavailable */
    }
  };

  const depotPanel = $('depot');
  let depotTab: 'item' | 'mon' = 'item';

  /** Move every unit of one item name between the two stores. */
  const moveItem = (name: string, from: BagState, to: BagState) => {
    const quantity = from.items[name];
    if (!quantity) return;
    to.items[name] = (to.items[name] ?? 0) + quantity;
    delete from.items[name];
  };

  const itemRow = (name: string, quantity: number, onClick: () => void): HTMLElement => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';
    const entry = itemIndex[name];
    if (entry) row.append(portrait(entry.cid, 26, 'item'));
    else {
      const ghost = document.createElement('span');
      ghost.className = 'ghost';
      ghost.textContent = '?';
      row.append(ghost);
    }
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = name;
    const qty = document.createElement('span');
    qty.className = 'qty';
    qty.textContent = `x${quantity.toLocaleString('pt-BR')}`;
    row.append(nm, qty);
    row.onclick = onClick;
    return row;
  };

  // ── the Pokemon side of the depot ──────────────────────────────────────────

  /**
   * What the filter bar is currently asking for.
   *
   * Held as the raw strings the inputs carry, so a half-typed number reads as
   * "no opinion" instead of as a zero that hides everything.
   */
  const depotFilter = {
    text: '',
    levelFrom: '',
    levelTo: '',
    ivFrom: '',
    ivTo: '',
    type: '',
    rarities: new Set<Rarity>(),
  };

  let depotSort: 'recent' | 'level' | 'iv' | 'name' = 'recent';

  const typesOfSlug = (slug: string): string[] =>
    species.find((sp) => sp.slug === slug && sp.variant === 'base')?.types ?? [];

  const asNumber = (raw: string): number | undefined => {
    const value = Number(raw);
    return raw.trim() === '' || !Number.isFinite(value) ? undefined : value;
  };

  const activeFilter = (): RosterFilter => ({
    text: depotFilter.text,
    levelFrom: asNumber(depotFilter.levelFrom),
    levelTo: asNumber(depotFilter.levelTo),
    ivFrom: asNumber(depotFilter.ivFrom),
    ivTo: asNumber(depotFilter.ivTo),
    types: depotFilter.type ? new Set([depotFilter.type]) : undefined,
    rarities: depotFilter.rarities.size ? depotFilter.rarities : undefined,
  });

  const sortMons = (mons: PartyMon[]): PartyMon[] => {
    const out = [...mons];
    if (depotSort === 'level') out.sort((a, b) => b.level - a.level || b.caughtAt - a.caughtAt);
    else if (depotSort === 'iv') out.sort((a, b) => ivTotal(b) - ivTotal(a));
    else if (depotSort === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else out.sort((a, b) => b.caughtAt - a.caughtAt);
    return out;
  };

  /**
   * Move one Pokemon between the team and the box.
   *
   * Refused while a hunt is running: the run was started against the team as
   * it stood, owns its health for as long as it lasts, and would go on
   * damaging and levelling a Pokemon that is no longer out.
   */
  const swapMon = (mon: PartyMon, side: 'party' | 'box') => {
    if (hunts.current) {
      openDrawer('Depot', 'Pare a hunt atual antes de mexer na equipe.');
      return;
    }

    const moved = side === 'box' ? toParty(roster, mon.id) : toBox(roster, mon.id);
    if (!moved.ok) {
      const why =
        moved.reason === 'full'
          ? `A equipe já tem ${PARTY_LIMIT} pokémon. Guarde um antes de tirar outro do box.`
          : moved.reason === 'last'
            ? 'Seu último pokémon não pode ficar no box — você caçaria sozinho.'
            : 'Esse pokémon não está mais com você.';
      openDrawer('Depot', why);
      return;
    }

    refreshParty();
    // The line walks at whoever leads it, and one place in it just changed.
    strides.length = 0;
    saveRoster();
    renderDepot();
    renderParty();
    if (!profPanel.hidden) renderProfile();
  };

  const monRow = (mon: PartyMon, side: 'party' | 'box'): HTMLElement => {
    const total = ivTotal(mon);
    const band = rarityOf(total);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row mon';
    row.title =
      side === 'box' ? `Colocar ${mon.name} na equipe` : `Guardar ${mon.name} no box`;
    row.style.setProperty('--rank', band.ink);
    row.append(pokemonImage(mon.name, 'portrait', 30));

    const col = document.createElement('span');
    col.className = 'col';

    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = mon.name;

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `Nv ${mon.level} · IV ${total}/${IV_TOTAL} · `;
    const rank = document.createElement('b');
    rank.textContent = band.label;
    meta.append(rank);

    const gauge = document.createElement('span');
    gauge.className = 'gauge';
    const fill = document.createElement('i');
    fill.style.width = `${Math.round((total / IV_TOTAL) * 100)}%`;
    gauge.append(fill);

    col.append(nm, meta, gauge);

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    // Team on the left, box on the right, so the arrow points where it goes.
    arrow.textContent = side === 'box' ? '◀' : '▶';

    row.append(col, arrow);
    row.onclick = () => swapMon(mon, side);
    return row;
  };

  const emptyNote = (el: HTMLElement, text: string) => {
    const empty = document.createElement('div');
    empty.className = 'depot-empty';
    empty.textContent = text;
    el.append(empty);
  };

  const fillItemColumn = (el: HTMLElement, store: BagState, other: BagState) => {
    el.replaceChildren();
    for (const [name, quantity] of Object.entries(store.items).sort((a, b) => b[1] - a[1])) {
      el.append(
        itemRow(name, quantity, () => {
          moveItem(name, store, other);
          saveBag();
          saveDepot();
          renderDepot();
          if (!bagPanel.hidden) renderBag();
          if (!profPanel.hidden) renderProfile();
        }),
      );
    }
    if (!el.childElementCount) emptyNote(el, 'vazio');
  };

  /** `mons` is what to draw; `owned` is how many there are before filtering. */
  const fillMonColumn = (
    el: HTMLElement,
    mons: PartyMon[],
    side: 'party' | 'box',
    owned = mons.length,
  ) => {
    el.replaceChildren();
    for (const mon of mons) el.append(monRow(mon, side));

    if (!el.childElementCount) {
      emptyNote(
        el,
        side === 'party'
          ? 'Nenhum pokémon na equipe.'
          : owned
            ? 'Nenhum pokémon com esses filtros.'
            : 'Box vazio. Capture pokémon nas hunts com uma pokébola.',
      );
    }
  };

  const renderDepot = () => {
    const mine = partyMons(roster);
    const stored = boxMons(roster);
    const onMon = depotTab === 'mon';

    $('depot-filters').hidden = !onMon;
    $('depot-all').hidden = onMon;

    $('depot-slots').textContent = onMon
      ? `${roster.mons.length.toLocaleString('pt-BR')} pokémon · ${mine.length}/${PARTY_LIMIT} na equipe`
      : `${Object.values(depot.items).reduce((n, q) => n + q, 0).toLocaleString('pt-BR')} guardados`;

    $('depot-left-title').textContent = onMon ? 'Equipe' : 'Mochila';
    $('depot-right-title').textContent = onMon ? 'Box' : 'Depósito';
    // The team is never filtered: hiding someone who is out would leave the
    // player unable to put them away.
    const shown = onMon
      ? sortMons(stored.filter((m) => matches(m, activeFilter(), typesOfSlug)))
      : [];

    $('depot-left-count').textContent = onMon
      ? `(${mine.length}/${PARTY_LIMIT})`
      : `(${Object.keys(bag.items).length})`;
    $('depot-right-count').textContent = !onMon
      ? `(${Object.keys(depot.items).length})`
      : shown.length === stored.length
        ? `(${stored.length})`
        : `(${shown.length} de ${stored.length})`;

    $('depot-hint').textContent = onMon
      ? 'Clique em um pokémon do box para colocá-lo na equipe, ou em um da equipe para guardá-lo.'
      : 'Clique em uma linha para mover entre mochila e depósito.';

    if (onMon) {
      fillMonColumn($('depot-left'), mine, 'party');
      fillMonColumn($('depot-right'), shown, 'box', stored.length);
    } else {
      fillItemColumn($('depot-left'), bag, depot);
      fillItemColumn($('depot-right'), depot, bag);
    }
  };

  // ── filter bar ─────────────────────────────────────────────────────────────

  const bindFilter = (id: string, field: 'text' | 'levelFrom' | 'levelTo' | 'ivFrom' | 'ivTo') => {
    const input = $<HTMLInputElement>(id);
    input.addEventListener('input', () => {
      depotFilter[field] = input.value;
      renderDepot();
    });
  };

  bindFilter('depot-search', 'text');
  bindFilter('depot-lvfrom', 'levelFrom');
  bindFilter('depot-lvto', 'levelTo');
  bindFilter('depot-ivfrom', 'ivFrom');
  bindFilter('depot-ivto', 'ivTo');

  {
    const typeSelect = $<HTMLSelectElement>('depot-type');
    for (const type of [...new Set(species.flatMap((sp) => sp.types))].filter(Boolean).sort()) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      typeSelect.append(option);
    }
    typeSelect.addEventListener('change', () => {
      depotFilter.type = typeSelect.value;
      renderDepot();
    });

    const sortSelect = $<HTMLSelectElement>('depot-sort');
    sortSelect.addEventListener('change', () => {
      depotSort = sortSelect.value as typeof depotSort;
      renderDepot();
    });

    // The bands come from the roster rather than being spelled out again here,
    // so adding one to the game adds its chip.
    const chips = $('depot-rarity');
    for (const band of RARITIES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = band.label;
      chip.style.setProperty('--rank', band.ink);
      chip.addEventListener('click', () => {
        if (depotFilter.rarities.has(band.rarity)) depotFilter.rarities.delete(band.rarity);
        else depotFilter.rarities.add(band.rarity);
        chip.classList.toggle('on', depotFilter.rarities.has(band.rarity));
        renderDepot();
      });
      chips.append(chip);
    }

    $('depot-clear').addEventListener('click', () => {
      depotFilter.text = '';
      depotFilter.levelFrom = '';
      depotFilter.levelTo = '';
      depotFilter.ivFrom = '';
      depotFilter.ivTo = '';
      depotFilter.type = '';
      depotFilter.rarities.clear();
      for (const id of ['depot-search', 'depot-lvfrom', 'depot-lvto', 'depot-ivfrom', 'depot-ivto']) {
        $<HTMLInputElement>(id).value = '';
      }
      typeSelect.value = '';
      for (const chip of chips.querySelectorAll('button')) chip.classList.remove('on');
      renderDepot();
    });
  }

  openDepot = () => {
    depotPanel.hidden = false;
    renderDepot();
  };

  $('depot-close').addEventListener('click', () => (depotPanel.hidden = true));
  $('depot-all').addEventListener('click', () => {
    for (const name of Object.keys(bag.items)) moveItem(name, bag, depot);
    saveBag();
    saveDepot();
    renderDepot();
    if (!bagPanel.hidden) renderBag();
    if (!profPanel.hidden) renderProfile();
  });
  for (const btn of $('depot-tabs').querySelectorAll('button')) {
    btn.addEventListener('click', () => {
      depotTab = (btn as HTMLElement).dataset.tab as typeof depotTab;
      for (const b of $('depot-tabs').querySelectorAll('button')) b.classList.remove('on');
      btn.classList.add('on');
      renderDepot();
    });
  }

  // ── profile ────────────────────────────────────────────────────────────────

  /**
   * Lifetime totals.
   *
   * The time argument is a *delta*, never a run's own total: a run carries its
   * accumulated `activeMs` across sessions, so crediting that total on the
   * first observation would book the whole history again and leave hunt time
   * disagreeing with the kills that produced it.
   */
  const noteProgress = (lines: LogLine[], deltaMs: number) => {
    const before = levelFromExp(stats.experience);

    stats.kills += lines.length;
    stats.experience += lines.reduce((n, l) => n + l.experience, 0);
    stats.huntMs += Math.max(0, deltaMs);
    saveStats();

    const after = levelFromExp(stats.experience);
    if (after > before) {
      const opened = zones.filter(
        (z) => z.requiredLevel > before && z.requiredLevel <= after,
      ).length;
      const gems = (after - before) * DIAMONDS_PER_LEVEL;
      openDrawer(
        'Subiu de nível',
        `<b>${player.name}</b> chegou ao nível ${after}.` +
          (opened ? ` ${opened} ${opened === 1 ? 'hunt liberada' : 'hunts liberadas'}.` : '') +
          ` +${gems} 💎`,
      );
      if (!diamondPanel.hidden) renderDiamond();
      // The map is a list of locks; some of them just opened.
      if (!browser.hidden) renderZones();
    }

    // The trainer's bar lives in the party panel, and it just moved.
    renderParty();
    if (!profPanel.hidden) renderProfile();
  };

  /** Active ms already booked this session, so ticks credit only new time. */
  let seenActiveMs = 0;

  const profPanel = $('prof');

  const renderProfile = () => {
    const avatar = $('pf-avatar');
    avatar.replaceChildren(portrait(playerOutfit, 56));

    const at = trainerProgress();
    const teamLevel = party.reduce((n, m) => n + m.level, 0);
    const dexTotal = species.filter((sp) => sp.variant === 'base' && sp.look).length;
    const open = zones.filter((z) => z.requiredLevel <= at.level).length;

    $('pf-name').textContent = player.name;
    $('pf-since').textContent =
      `nível ${at.level} · desde ${new Date(stats.createdAt).toLocaleDateString('pt-BR')}`;
    $('pf-xp').style.width = `${at.share * 100}%`;
    $('pf-xptext').textContent =
      `${at.into.toLocaleString('pt-BR')} / ${at.need.toLocaleString('pt-BR')} exp para o ` +
      `nível ${at.level + 1} · faltam ${at.left.toLocaleString('pt-BR')}`;
    $('pf-tlevel').textContent = String(at.level);
    $('pf-next').textContent = `${at.left.toLocaleString('pt-BR')} exp`;
    $('pf-hunts').textContent =
      `${open.toLocaleString('pt-BR')} / ${zones.length.toLocaleString('pt-BR')}`;
    $('pf-lvchip').textContent = String(at.level);

    $('pf-dex').textContent = `${caught.size} / ${dexTotal.toLocaleString('pt-BR')}`;
    $('pf-catches').textContent = String(roster.mons.length);
    $('pf-gold').textContent = player.coins.toLocaleString('pt-BR');

    $('pf-level').textContent = teamLevel.toLocaleString('pt-BR');
    $('pf-exp').textContent = stats.experience.toLocaleString('pt-BR');
    $('pf-gold2').textContent = `${player.coins.toLocaleString('pt-BR')} ¢`;
    $('pf-party').textContent = String(party.length);

    $('pf-time').textContent = fmtDuration(stats.huntMs);
    $('pf-kills').textContent = stats.kills.toLocaleString('pt-BR');
    $('pf-catches2').textContent = String(roster.mons.length);
    $('pf-dex2').textContent = `${caught.size} / ${dexTotal.toLocaleString('pt-BR')}`;
    $('pf-items').textContent = Object.values(bag.items)
      .reduce((n, q) => n + q, 0)
      .toLocaleString('pt-BR');
    $('pf-stored').textContent = Object.values(depot.items)
      .reduce((n, q) => n + q, 0)
      .toLocaleString('pt-BR');
  };

  $('prof-open').addEventListener('click', () => {
    profPanel.hidden = !profPanel.hidden;
    if (!profPanel.hidden) renderProfile();
  });
  $('prof-close').addEventListener('click', () => (profPanel.hidden = true));

  // Pick up whatever was running when the tab was last closed.
  const restored = hunts.restore();
  if (restored) {
    creditRun(restored.lines);
    noteProgress(restored.lines, restored.report.creditedMs);
    seenActiveMs = restored.run.activeMs;
    pushLog(restored.lines.slice(-20));
    applyExperience(restored.lines.reduce((n, l) => n + l.experience, 0));
    if (restored.lines.some((l) => l.caught)) {
      recordCatch(restored.zone.species, restored.zone.variant);
    }
    paintRun();
    const r = restored.report;
    if (r.folded > 0) {
      openDrawer(
        'Enquanto você esteve fora',
        `Ausente por <b>${fmtDuration(r.awayMs)}</b>, creditado <b>${fmtDuration(r.creditedMs)}</b> ` +
          `de caça a ${Math.round(DEFAULT_OFFLINE_EFFICIENCY * 100)}%.<br>` +
          `<b>${r.folded.toLocaleString('pt-BR')}</b> encontros resolvidos em ${restored.zone.displayName}.` +
          (r.cappedOut ? `<br><span style="color:var(--faint)">Teto atingido: ${fmtDuration(r.discardedMs)} descartados.</span>` : ''),
      );
    }
  }

  // ── gyms ───────────────────────────────────────────────────────────────────

  const gymsPanel = $('gyms');
  let activeGym = 0;

  const moveRows = (moves: Array<[string, number, number, string]>, host: HTMLElement) => {
    for (const [name, power, interval, type] of moves) {
      const row = document.createElement('div');
      row.className = 'mvrow';
      const nm = document.createElement('span');
      nm.textContent = name;
      const p = document.createElement('span');
      p.className = 'p';
      p.textContent = String(power);
      const cd = document.createElement('span');
      cd.className = 'cd';
      cd.textContent = `${(interval / 1000).toFixed(0)}s`;
      row.append(nm, p, cd);
      if (type) {
        const tp = document.createElement('span');
        tp.className = 'tchip';
        tp.textContent = type;
        row.append(tp);
      }
      host.append(row);
    }
  };

  const renderGymDetail = () => {
    const gym = gymData[activeGym];
    const host = $('gym-detail');
    host.replaceChildren();
    if (!gym) return;

    const head = document.createElement('div');
    head.id = 'gym-head';
    head.innerHTML =
      `<span><span class="title">Ginásio de ${gym.city}</span><br>` +
      `<span class="meta">Líder ${gym.leader} · insígnia ${gym.badge}</span></span>` +
      `<span class="tchip">${gym.type}</span>`;
    host.append(head);

    if (!gym.fromBase) {
      const note = document.createElement('div');
      note.className = 'authored-note';
      note.textContent =
        'Este time não existe na base: foi montado a partir do registro de espécies, ' +
        'escolhendo pokémon do tipo do ginásio com nível próximo ao dele.';
      host.append(note);
    }

    const team = document.createElement('div');
    team.id = 'gym-team';
    for (const mon of gym.team) {
      const card = document.createElement('div');
      card.className = 'gmon';

      const top = document.createElement('div');
      top.className = 'top';
      top.append(pokemonImage(mon.name, 'portrait', 44));
      const info = document.createElement('div');
      info.innerHTML =
        `<div class="nm">${mon.name}</div>` +
        `<div class="st">nv ${mon.level} · ${mon.hp.toLocaleString('pt-BR')} hp · ` +
        `${mon.dps.toFixed(1)} dps</div>` +
        `<div class="st">${mon.types.join(' / ')}</div>`;
      top.append(info);
      card.append(top);

      const mv = document.createElement('div');
      mv.className = 'mv';
      moveRows(mon.moves, mv);
      card.append(mv);

      team.append(card);
    }
    host.append(team);
  };

  const renderGymList = () => {
    const list = $('gym-list');
    list.replaceChildren();
    gymData.forEach((gym, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = i === activeGym ? 'gymrow on' : 'gymrow';
      row.innerHTML =
        `<span class="n">${gym.order}</span>` +
        `<span><span class="city">${gym.city}</span><br>` +
        `<span class="who">${gym.leader}</span></span>` +
        `<span class="tchip">${gym.type}</span>`;
      row.onclick = () => {
        activeGym = i;
        renderGymList();
        renderGymDetail();
      };
      list.append(row);
    });
  };

  $('gym-open').addEventListener('click', () => {
    gymsPanel.hidden = !gymsPanel.hidden;
    if (!gymsPanel.hidden) {
      renderGymList();
      renderGymDetail();
    }
  });
  $('gyms-close').addEventListener('click', () => (gymsPanel.hidden = true));
  // Gyms are the one entry that can be absent: a release with no gym data has
  // nothing to open.
  $('gym-open').hidden = gymData.length === 0;
  /*
   * Dress the dock in the sprite pack's own items.
   *
   * The client's interface icons are drawn at sixteen pixels and lose their
   * edges blown up to twenty-eight. A pokedex, a bag, a badge, a map and a
   * diamond all exist as real items at thirty-two, drawn by the same hand as
   * everything else on screen. A button whose item is missing from this
   * release keeps the png it shipped with.
   */
  for (const button of $('dock').querySelectorAll<HTMLElement>('.dock-btn[data-item]')) {
    const entry = itemIndex[button.dataset.item ?? ''];
    if (!entry) continue;
    const icon = portrait(entry.cid, 34, 'item');
    button.querySelector('img')?.replaceWith(icon);
  }

  $('dock').hidden = false;

  /**
   * Light the dock button whose panel is open.
   *
   * Read off the panels rather than tracked alongside them: every one of these
   * can also be closed by its own X, and a flag kept in parallel would drift
   * out of step the first time someone did that.
   */
  const DOCK_PANELS: Array<[string, string]> = [
    ['hunt-open', 'browser'],
    ['dex-open', 'dex'],
    ['bag-open', 'bag'],
    ['helper-open', 'helper'],
    ['diamond-open', 'diamond'],
    ['prof-open', 'prof'],
    ['gym-open', 'gyms'],
  ];
  const syncDock = () => {
    for (const [button, panel] of DOCK_PANELS) {
      const el = document.getElementById(panel);
      $(button).classList.toggle('on', Boolean(el) && !el!.hidden);
    }
  };
  syncDock();
  // A click anywhere in the dock or on a panel's close button can change which
  // panel is up, so the state is refreshed after the event has been handled.
  document.addEventListener('click', () => queueMicrotask(syncDock), true);

  // ── input ──────────────────────────────────────────────────────────────────

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    stage.classList.add('dragging');
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dpr = stage.width / window.innerWidth;
    camera.x -= ((e.clientX - lastX) * dpr) / SCALE;
    camera.y -= ((e.clientY - lastY) * dpr) / SCALE;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  const endDrag = (e: PointerEvent) => {
    dragging = false;
    stage.classList.remove('dragging');
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', (e) => {
    if (e.key === '0') centreOnPlayer();
    if (e.key === 'Escape') drawer.root.hidden = true;
  });

  // ── terrain baking ─────────────────────────────────────────────────────────

  const baked = new Map<string, BakedChunk>();

  const bake = (chunk: Chunk): BakedChunk => {
    const key = `${chunk.z}/${chunk.cx}_${chunk.cy}`;
    const hit = baked.get(key);
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = CHUNK_PX + BAKE_MARGIN * 2;
    canvas.height = CHUNK_PX + BAKE_MARGIN * 2;
    const cctx = canvas.getContext('2d')!;
    for (const draw of layoutChunk(chunk, set)) drawSprite(cctx, draw, BAKE_MARGIN, BAKE_MARGIN);

    const entry: BakedChunk = {
      canvas,
      originX: chunk.cx * CHUNK_PX - BAKE_MARGIN,
      originY: chunk.cy * CHUNK_PX - BAKE_MARGIN,
    };
    baked.set(key, entry);
    return entry;
  };

  // ── render loop ────────────────────────────────────────────────────────────

  let huntAt = 0;
  let captureAt = 0;

  const frame = () => {
    // The simulation is advanced on wall time, not per frame: `advance` is
    // chunk-invariant, so ticking once a second gives the same result as
    // ticking sixty times and costs a sixtieth of the work.
    const wall = Date.now();
    if (wall - huntAt >= 1000) {
      huntAt = wall;

      /*
       * A hunt only pays for what is being fought.
       *
       * The simulation resolves encounters on its own clock, so wild Pokemon
       * were falling one after another while the party was still crossing the
       * field towards the first of them — which reads exactly like attacking
       * from across the map. While the player is standing in the zone and the
       * Pokemon that is out has not reached anything, the run is held instead:
       * no time passes, nothing dies, and the fight starts when it arrives.
       *
       * Only while the field is armed. A run left going from the Pokemon
       * Center, or picked up after being away, is the idle half of the game and
       * keeps paying the way it always did.
       */
      /*
       * Only while there is something to walk to.
       *
       * A target behind a cliff or across water is skipped rather than walked
       * at, and if every one of them is like that the party has nowhere to go:
       * holding then would stall the hunt for good instead of pausing it, so
       * the run keeps paying the way it did before, and waits for one to
       * respawn somewhere reachable.
       */
      const engaged = field.armed ? field.focus(player, stuckTargets) : null;
      const holding =
        engaged !== null &&
        !stuckTargets.has(engaged.key) &&
        !field.inContact(player, ENGAGE_RANGE, stuckTargets);
      if (holding) hunts.hold(wall);

      const tick = holding ? null : hunts.tick(wall);
      if (tick) {
        // The run owns party health while a hunt is on, so the panel follows
        // it rather than keeping a second copy that could disagree.
        let hurt = false;
        tick.run.partyHp.forEach((hp, i) => {
          const mon = party[i];
          if (mon && mon.hp !== hp) {
            // The one that is out is the one on screen, and the wound it just
            // took is exactly what the run booked against it.
            if (i === 0 && hp < mon.hp) {
              floaters.push(wall, player.x, player.y, mon.hp - hp, 'taken');
            }
            mon.hp = hp;
            hurt = true;
          }
        });
        if (hurt) {
          saveParty();
          renderParty();
        }
        if (tick.lines.length) {
          pushLog(tick.lines);
          applyExperience(tick.lines.reduce((n, l) => n + l.experience, 0));

          creditRun(tick.lines);
          // The field draws what these lines already decided, so it is fed
          // from them rather than from a clock of its own.
          const zoneNow = hunts.current?.zone;
          const sp = zoneNow
            ? species.find((r) => r.slug === zoneNow.species && r.variant === zoneNow.variant)
            : undefined;
          // Where the kills land, so the damage that felled them can be shown
          // over the right Pokemon.
          const before = new Set(field.all.filter((t) => t.diedAt !== null).map((t) => t.key));
          field.credit(
            tick.lines,
            player,
            wall,
            stuckTargets,
            sp?.corpse
              ? { item: sp.corpse, seconds: sp.corpseSeconds ?? 30, level: sp.level }
              : undefined,
          );

          /*
           * What it took to fell each one.
           *
           * The simulation kills on its own clock — at this level a Bellsprout
           * falls every couple of seconds, faster than a Pokemon can walk to
           * the next one — so a number per swing would mostly never appear.
           * The wild Pokemon's own health is the damage it took, and it is
           * shown where it fell.
           */
          if (zoneNow) {
            for (const target of field.all) {
              if (target.diedAt !== wall || before.has(target.key)) continue;
              floaters.push(wall, target.x, target.y, zoneNow.wildHealth, 'dealt');
            }
          }
          renderCapture();
          noteProgress(tick.lines, tick.run.activeMs - seenActiveMs);
          seenActiveMs = tick.run.activeMs;

          // A capture is what fills the pokedex, so the loop closes here.
          const zone = hunts.current?.zone;
          if (zone && tick.lines.some((l) => l.caught)) {
            if (recordCatch(zone.species, zone.variant) && !dexPanel.hidden) renderDex();
          }
        }
        paintRun();
        // Only while the run is still on. `advance` marks a stopped run
        // RETURNING, and a heal into one of those is refused — the helper
        // would spend a revive and get nothing for it. A run that stopped
        // because the party fell is `reviveAfterWipe`'s job instead.
        if (!tick.stopped) stepHelper(wall);
        if (tick.stopped) {
          const zone = hunts.current?.zone;
          hunts.stop(wall);
          field.disarm();
          caster.disarm();
          floaters.clear();
          throws = [];
          paintRun();
          renderCapture();
          if (tick.stopped === 'party-fainted' && !reviveAfterWipe(zone, wall)) {
            openDrawer(
              'Time nocauteado',
              'Nenhum pokémon seu aguenta continuar. Volte ao centro pokémon e ' +
                'fale com a <b>Joy</b> para curar.',
            );
          }
        }
      }
    }

    const w = stage.width;
    const h = stage.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b100f';
    ctx.fillRect(0, 0, w, h);

    const halfW = w / 2 / SCALE;
    const halfH = h / 2 / SCALE;
    const view = {
      left: camera.x - halfW - BAKE_MARGIN,
      right: camera.x + halfW + BAKE_MARGIN,
      top: camera.y - halfH - BAKE_MARGIN,
      bottom: camera.y + halfH + BAKE_MARGIN,
    };

    ctx.setTransform(SCALE, 0, 0, SCALE, w / 2, h / 2);
    ctx.translate(-camera.x, -camera.y);

    const inView = onFloor.filter((c) => {
      const x = c.cx * CHUNK_PX;
      const y = c.cy * CHUNK_PX;
      return x < view.right && x + CHUNK_PX > view.left && y < view.bottom && y + CHUNK_PX > view.top;
    });
    inView.sort((a, b) => a.cy - b.cy || a.cx - b.cx);

    for (const chunk of inView) {
      const entry = bake(chunk);
      ctx.drawImage(entry.canvas, entry.originX, entry.originY);
    }

    // A wild Pokémon the run has just defeated is off the map until its spawn
    // point comes back, so it is filtered out of the draw rather than out of
    // `actors` — the list is rebuilt only on travel, and this changes second
    // by second.
    const wallNow = Date.now();
    stepHunt(wallNow);
    // Moves fire on their own cooldowns, aimed at whatever the run is
    // currently resolving. They report what is happening; they do not decide
    // it — the rewards come from the simulation either way.
    if (caster.armed) {
      const target = field.focus(player, stuckTargets);
      const fired = caster.update(wallNow, player, target);
      if (fired.length) {
        pushCasts(fired);

        // What the move takes off, over the Pokemon it landed on.
        const lead = party.find((m) => m.hp > 0) ?? party[0];
        if (target && lead) {
          for (const cast of fired) {
            const move = lead.moves.find(
              ([name]) => name.toLowerCase().trim() === cast.move.toLowerCase().trim(),
            );
            if (!move) continue;
            floaters.push(wallNow, target.x, target.y, hitDamage(move[1], lead.level), 'dealt');
          }
        }
      }
    }
    // A step that has finished has to stop being drawn as one, so the line is
    // rebuilt while anything in it is still sliding.
    if (strides.some((st) => st && !strideDone(st, wallNow))) {
      actors = buildActors();
    }

    // Wild Pokemon mill about inside their spawn radius while they are alive.
    if (field.armed) {
      // They come after the Pokemon out front, which is what `player` holds.
      // `Monster::getNextStep` follows what it is targeting and wanders only
      // when it has nothing to follow.
      field.roam(wallNow, (x, y) => grid.walkable(x, y), player);
      // The drawn actors follow their spawn point's target, which is the one
      // that moves. Matching on the key rather than on coordinates is what
      // lets a roaming one still be recognised after it has stepped away.
      for (const target of field.all) {
        const actor = wildByKey.get(target.key);
        if (!actor) continue;
        actor.x = target.x;
        actor.y = target.y;

        // Mid-step it slides and runs its walking frames, same as the line.
        if (target.stride && !strideDone(target.stride, wallNow)) {
          const offset = strideOffset(target.stride, wallNow, TILE);
          const groups = set.appearances.creature?.[String(actor.lookType)]?.groups;
          const moving = groups && groups.length > 1 ? 1 : 0;
          actor.ox = offset.x;
          actor.oy = offset.y;
          actor.group = moving;
          actor.phase = walkPhase(target.stride, wallNow, groups?.[moving]?.ph ?? 1);
          actor.direction =
            Math.abs(target.stride.dx) > Math.abs(target.stride.dy)
              ? target.stride.dx > 0
                ? DIRECTION.east
                : DIRECTION.west
              : target.stride.dy > 0
                ? DIRECTION.south
                : DIRECTION.north;
        } else {
          actor.ox = 0;
          actor.oy = 0;
          actor.group = 0;
          actor.phase = undefined;
        }
      }
    }
    field.update(wallNow);
    // The corpse list has a countdown on it, so it is repainted on the same
    // once-a-second beat the run ticks on rather than every frame.
    if (hunts.current && wallNow - captureAt >= 1000) {
      captureAt = wallNow;
      renderCapture();
    }
    downTiles = new Set<string>();
    for (const t of field.all) if (t.diedAt !== null) downTiles.add(`${t.x},${t.y}`);
    const standing = downTiles.size
      ? actors.filter((a) => !(a.labelKind === 'wild' && downTiles.has(`${a.x},${a.y}`)))
      : actors;

    // Actors live above every chunk, so they are collected across the whole
    // view and sorted by world row rather than per chunk.
    const queue: Array<{ draw: Draw; ox: number; oy: number; row: number }> = [];
    for (const chunk of inView) {
      const ox = chunk.cx * CHUNK_PX;
      const oy = chunk.cy * CHUNK_PX;
      for (const draw of layoutCreatures(chunk, set, standing)) {
        queue.push({ draw, ox, oy, row: oy + draw.dy });
      }
    }
    queue.sort((a, b) => a.row - b.row);
    for (const { draw, ox, oy } of queue) drawSprite(ctx, draw, ox, oy);
    paintArtActors(standing, wall);

    paintField();
    paintFloaters(wall);
    paintNames();
    paintLabels();

    requestAnimationFrame(frame);
  };

  renderParty();
  refreshMarket();
  $('party').hidden = false;
  boot.classList.add('done');
  requestAnimationFrame(frame);
}

main().catch((err) => {
  bootMsg.textContent = 'falhou ao carregar';
  bootErr.textContent = String(err?.stack ?? err);
  console.error(err);
});
