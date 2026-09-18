import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';

/**
 * Reader for the Pokemon definitions in servidor/data/monster.
 *
 * These are Lua scripts, not data files, but the 1,057 of them follow one
 * generated shape closely enough to read by pattern. Anything that does not
 * match is reported rather than guessed at — a species that silently parses
 * to zeros would poison every hunt built on top of it.
 */

export type Move = {
  name: string;
  /** Damage coefficient the server applies; not a Pokemon-canon base power. */
  power: number;
  /** Cooldown in milliseconds. */
  interval: number;
  /** Percent, out of 100. Often absent, which means 100. */
  chance: number;
  /** Element, when the entry declares one. Only `moves` usually does. */
  type: string | null;
};

export type LootEntry = {
  id: string;
  chance: number;
  maxCount: number;
};

export type Variant = 'base' | 'shiny' | 'mega';

export type Species = {
  /** Name the script registers with the server. */
  name: string;
  slug: string;
  /** Top-level region folder, e.g. kanto. Never the shiny/mega subfolder. */
  region: string;
  /** Derived from the folder the file sits in, not from the registered name. */
  variant: Variant;
  file: string;
  lookType: number;
  experience: number;
  health: number;
  /** Wild spawns are tougher; this is the multiplier applied to health. */
  wildHealthMultiplier: number;
  /**
   * Speed while it is still wild, from `pokemon.wild.speed`.
   *
   * An absolute number, not a multiplier like the health beside it, and often
   * higher than `pokemon.speed`: an uncaught Pokemon roams faster than the
   * same one following a trainer. Zero when the block does not set it.
   */
  wildSpeed: number;
  speed: number;
  type1: string;
  type2: string | null;
  corpse: number;
  iconOn: number;
  iconOut: number;
  minimumLevel: number;
  catchChance: number;
  hasShiny: boolean;
  hasMega: boolean;
  rank: string;
  attackBase: number;
  defenseBase: number;
  /**
   * The player-facing move list, from `pokemon.moves`. Carries a per-move
   * type and shorter cooldowns than the wild version.
   */
  moves: Move[];
  /**
   * How the species fights when it is the wild one, from `pokemon.attacks`.
   * Same names, longer intervals, and a `chance` per entry. Using this for a
   * party member would make the player slower than they should be.
   */
  attacks: Move[];
  loot: LootEntry[];
};

export type NameCollision = {
  slug: string;
  registeredName: string;
  /** What the folder says this file is. */
  folderVariant: Variant;
  /** What the registered name claims it is. */
  nameVariant: Variant;
  file: string;
};

export type SpeciesRegistry = {
  /** Base-form species by slug. Shiny and mega live in `variants`. */
  byName: Map<string, Species>;
  /** Every parsed entry, keyed `variant:slug`. */
  variants: Map<string, Species>;
  all: Species[];
  regions: Map<string, number>;
  /** Files that parsed but were missing something essential. */
  incomplete: Array<{ file: string; missing: string[] }>;
  /** Files that could not be attributed to a species at all. */
  unreadable: string[];
  /**
   * Files whose registered name disagrees with the folder they live in.
   * In this base 42 files do this: shiny scripts that register the plain
   * species name overwrite the base form when the server loads them, so
   * they must never be folded into the registry silently.
   */
  collisions: NameCollision[];
};

function variantOfName(name: string): Variant {
  const n = name.toLowerCase();
  if (n.startsWith('shiny ')) return 'shiny';
  if (n.startsWith('mega ')) return 'mega';
  return 'base';
}

export const slugify = (name: string): string =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function walkLua(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkLua(full, out);
    else if (extname(entry) === '.lua') out.push(full);
  }
  return out;
}

const numAfter = (src: string, re: RegExp): number | null => {
  const m = re.exec(src);
  return m ? Number(m[1]) : null;
};

const strAfter = (src: string, re: RegExp): string | null => {
  const m = re.exec(src);
  return m ? m[1]! : null;
};

export function loadSpecies(monsterDir: string): SpeciesRegistry {
  const files = walkLua(monsterDir);
  const byName = new Map<string, Species>();
  const variants = new Map<string, Species>();
  const all: Species[] = [];
  const regions = new Map<string, number>();
  const incomplete: Array<{ file: string; missing: string[] }> = [];
  const unreadable: string[] = [];
  const collisions: NameCollision[] = [];

  for (const file of files) {
    const src = readFileSync(file, 'latin1');

    const name = strAfter(src, /Game\.createMonsterType\(\s*"([^"]+)"\s*\)/);
    if (!name) {
      unreadable.push(file);
      continue;
    }

    // kanto/shiny/shiny pikachu.lua -> region kanto, variant shiny.
    const parts = relative(monsterDir, file).split(sep);
    const region = parts[0] ?? 'unknown';
    const folderVariant: Variant =
      parts[1] === 'shiny' ? 'shiny' : parts[1] === 'mega' ? 'mega' : 'base';
    const lookType = numAfter(src, /outfit\s*=\s*\{[^}]*?lookType\s*=\s*(\d+)/s);
    const health = numAfter(src, /^\s*pokemon\.health\s*=\s*(\d+)/m);
    const experience = numAfter(src, /^\s*pokemon\.experience\s*=\s*(\d+)/m);

    const missing: string[] = [];
    if (lookType === null) missing.push('lookType');
    if (health === null) missing.push('health');
    if (experience === null) missing.push('experience');

    // `pokemon.wild.health = pokemon.health * 1.8` — capture the multiplier.
    const wildMul = numAfter(src, /wild\s*=\s*\{[^}]*?health\s*=\s*pokemon\.health\s*\*\s*([\d.]+)/s);
    // The same block sets an absolute speed rather than a multiplier.
    const wildSpeed = numAfter(src, /wild\s*=\s*\{[^}]*?speed\s*=\s*(\d+)/s);

    const flagsBlock = /pokemon\.flags\s*=\s*\{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';

    const species: Species = {
      name,
      slug: slugify(name),
      region,
      variant: folderVariant,
      file,
      lookType: lookType ?? 0,
      experience: experience ?? 0,
      health: health ?? 0,
      wildHealthMultiplier: wildMul ?? 1,
      wildSpeed: wildSpeed ?? 0,
      speed: numAfter(src, /^\s*pokemon\.speed\s*=\s*(\d+)/m) ?? 0,
      type1: strAfter(src, /^\s*pokemon\.race\s*=\s*"([^"]*)"/m) ?? 'unknown',
      type2: (() => {
        const t = strAfter(src, /^\s*pokemon\.race2\s*=\s*"([^"]*)"/m);
        return !t || t === 'none' ? null : t;
      })(),
      corpse: numAfter(src, /^\s*pokemon\.corpse\s*=\s*(\d+)/m) ?? 0,
      iconOn: numAfter(src, /icon\s*=\s*\{[^}]*?on\s*=\s*(\d+)/s) ?? 0,
      iconOut: numAfter(src, /icon\s*=\s*\{[^}]*?out\s*=\s*(\d+)/s) ?? 0,
      minimumLevel: numAfter(flagsBlock, /minimumLevel\s*=\s*(\d+)/) ?? 1,
      catchChance: numAfter(flagsBlock, /catchChance\s*=\s*(\d+)/) ?? 0,
      hasShiny: (numAfter(flagsBlock, /hasShiny\s*=\s*(\d+)/) ?? 0) > 0,
      hasMega: (numAfter(flagsBlock, /hasMega\s*=\s*(\d+)/) ?? 0) > 0,
      rank: strAfter(flagsBlock, /pokemonRank\s*=\s*"([^"]*)"/) ?? '',
      attackBase: numAfter(flagsBlock, /moveMagicAttackBase\s*=\s*(\d+)/) ?? 0,
      defenseBase: numAfter(flagsBlock, /moveMagicDefenseBase\s*=\s*(\d+)/) ?? 0,
      moves: parseMoveBlock(src, 'moves'),
      attacks: parseMoveBlock(src, 'attacks'),
      loot: parseLoot(src),
    };

    if (missing.length) incomplete.push({ file, missing });

    const nameVariant = variantOfName(name);
    if (nameVariant !== folderVariant) {
      collisions.push({
        slug: species.slug,
        registeredName: name,
        folderVariant,
        nameVariant,
        file,
      });
    }

    variants.set(`${folderVariant}:${species.slug}`, species);
    all.push(species);
    regions.set(region, (regions.get(region) ?? 0) + 1);

    // Only a file that actually sits in a base folder may claim the base slug,
    // so a mis-named shiny cannot displace the species it shadows.
    if (folderVariant === 'base') byName.set(species.slug, species);
  }

  all.sort((a, b) => a.name.localeCompare(b.name));
  return { byName, variants, all, regions, incomplete, unreadable, collisions };
}

function parseLoot(src: string): LootEntry[] {
  const block = /pokemon\.loot\s*=\s*\{([\s\S]*?)\n\}/.exec(src)?.[1];
  if (!block) return [];

  const out: LootEntry[] = [];
  const re = /\{\s*id\s*=\s*(?:"([^"]+)"|(\d+))\s*,\s*chance\s*=\s*(\d+)(?:\s*,\s*maxCount\s*=\s*(\d+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    out.push({
      id: m[1] ?? m[2]!,
      chance: Number(m[3]),
      maxCount: m[4] ? Number(m[4]) : 1,
    });
  }
  return out;
}

/**
 * Read one of the two move blocks every species declares.
 *
 * `pokemon.moves` is the player-facing list and `pokemon.attacks` is how the
 * species behaves as a wild encounter. They share move names but not their
 * numbers: Charizard's Flamethrower is on an 18s cooldown for the player and
 * 25s in the wild. Reading the wrong one silently understates a party's
 * output, so the caller has to say which it wants.
 *
 * `name`, `power` and `interval` are on essentially every entry. `chance` is
 * often absent and means 100. `type` appears mostly in `moves`.
 */
function parseMoveBlock(src: string, block: 'moves' | 'attacks'): Move[] {
  const body = new RegExp(String.raw`pokemon\.${block}\s*=\s*\{([\s\S]*?)\n\}`).exec(src)?.[1];
  if (!body) return [];

  const out: Move[] = [];
  const re = /\{\s*name\s*=\s*"([^"]+)"([^}]*)\}/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(body)) !== null) {
    const rest = m[2] ?? '';
    const num = (key: string): number | null => {
      const hit = new RegExp(String.raw`\b${key}\s*=\s*(-?\d+)`).exec(rest);
      return hit ? Number(hit[1]) : null;
    };

    const power = num('power');
    const interval = num('interval');
    // An entry without a cooldown or a power contributes no damage over time,
    // so it is dropped rather than folded in with invented values.
    if (power === null || interval === null || interval <= 0) continue;

    out.push({
      name: m[1]!,
      power,
      interval,
      chance: num('chance') ?? 100,
      type: /\btype\s*=\s*"([^"]*)"/.exec(rest)?.[1] ?? null,
    });
  }

  return out;
}

/**
 * Sustained damage per second implied by a move set.
 *
 * Each move lands `power` every `interval` milliseconds, `chance` percent of
 * the time. Summing those rates gives a figure grounded in the server's own
 * numbers instead of a curve invented to feel right.
 */
export function movesetDps(moves: Move[]): number {
  let dps = 0;
  for (const move of moves) {
    dps += (move.power * (move.chance / 100)) / (move.interval / 1000);
  }
  return dps;
}
