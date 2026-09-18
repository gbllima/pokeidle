import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * What a move looks like when it goes off.
 *
 * Species scripts give a move a name, a power and an interval; they say
 * nothing about what the player sees. That lives in
 * `data/scripts/spells/<type>/<move>.lua`, one file per move, where the combat
 * object carries the ids the client draws:
 *
 *   COMBAT_PARAM_EFFECT        a magic effect played on the target
 *   COMBAT_PARAM_DISTANCEEFFECT a missile that flies from caster to target
 *   sendMagicEffect(id)        an effect the script plays itself, often one
 *                              per facing for a directional move
 *
 * Both id spaces are the dat's own — `effect` and `missile` — so a move
 * recovered here can be rendered from the same sprite file as everything else.
 */

export type Vec = { x: number; y: number };

export type SpellVisual = {
  /** Lowercased spell name, which is how a species move references it. */
  key: string;
  name: string;
  /** COMBAT_FIREDAMAGE -> 'fire'. Empty when the script does not say. */
  element: string;
  /** Magic effect played on the target, from the dat's effect category. */
  effect?: number;
  /** Missile that flies to the target, from the dat's missile category. */
  missile?: number;
  /**
   * Per-facing effects for a directional move, north/east/south/west. Only
   * the ones the script defines; a move with these has no single `effect`.
   */
  facing?: Record<string, number>;
  /**
   * Where the effect is placed, per facing, relative to the caster.
   *
   * Directional moves in this base do not land on the target: the script
   * offsets the position first. Flamethrower's plume is three tiles wide and
   * five tall and is pushed clear of the caster before it plays. Drawing it on
   * the target instead is what made these look scattered.
   */
  offsets?: Record<string, Vec>;
  /**
   * Set when the effect walks outward from the caster instead of landing once.
   *
   * Fire Blast steps six tiles along its facing, 400ms apart, playing at each.
   * The offsets of a wave are unit vectors — that is how it is told apart from
   * a fixed placement.
   */
  wave?: { steps: number; intervalMs: number };
  /** A second effect the script plays alongside the main one. */
  sideEffect?: number;
  /** Tiles the move reaches, when the script sets one. */
  range?: number;
  needTarget: boolean;
  /** Where this was read from, for tracing a surprising id back. */
  source: string;
};

export type SpellRegistry = {
  byKey: Map<string, SpellVisual>;
  /** Files that define a spell but name no effect of any kind. */
  silent: string[];
  /** Files with no `spell:name(...)`, so nothing can reference them. */
  unnamed: string[];
};

const DIRECTIONS: Record<string, string> = {
  DIRECTION_NORTH: 'north',
  DIRECTION_EAST: 'east',
  DIRECTION_SOUTH: 'south',
  DIRECTION_WEST: 'west',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (extname(path).toLowerCase() === '.lua') out.push(path);
  }
  return out;
}

/** First capture of `pattern`, as a number, or undefined. */
function num(src: string, pattern: RegExp): number | undefined {
  const m = pattern.exec(src);
  if (!m) return undefined;
  const value = Number(m[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function loadSpells(root: string): SpellRegistry {
  const byKey = new Map<string, SpellVisual>();
  const silent: string[] = [];
  const unnamed: string[] = [];

  for (const file of walk(root)) {
    const src = readFileSync(file, 'latin1');

    // The local is not always called `spell` — `tackle.lua` builds a
    // `targetSpell`, and matching only the one name lost 152 files, `Tackle`
    // and `Water Gun` among them. Failing that, the combat object's own
    // spell-name string is just as authoritative.
    const named =
      /\w+:name\(\s*["']([^"']+)["']\s*\)/.exec(src) ??
      /COMBAT_PARAM_STRING_SPELLNAME\s*,\s*["']([^"']+)["']/.exec(src);
    if (!named) {
      unnamed.push(file);
      continue;
    }
    const name = named[1]!.trim();

    const element = (/COMBAT_PARAM_TYPE\s*,\s*COMBAT_([A-Z]+)DAMAGE/.exec(src)?.[1] ?? '')
      .toLowerCase();

    const effect =
      num(src, /COMBAT_PARAM_EFFECT\s*,\s*(\d+)/) ??
      // Some scripts skip the combat object and play the effect by hand.
      num(src, /sendMagicEffect\(\s*(\d+)\s*\)/);
    const missile = num(src, /COMBAT_PARAM_DISTANCEEFFECT\s*,\s*(\d+)/);

    const facing: Record<string, number> = {};
    for (const [constant, side] of Object.entries(DIRECTIONS)) {
      const hit = new RegExp(`\\[${constant}\\]\\s*=\\s*(\\d+)`).exec(src);
      if (hit) facing[side] = Number(hit[1]);
    }

    // `[DIRECTION_SOUTH] = {x = 1, y = 5}` — where the effect is placed.
    const offsets: Record<string, Vec> = {};
    for (const [constant, side] of Object.entries(DIRECTIONS)) {
      const hit = new RegExp(
        `\\[${constant}\\]\\s*=\\s*\\{\\s*x\\s*=\\s*(-?\\d+)\\s*,\\s*y\\s*=\\s*(-?\\d+)`,
      ).exec(src);
      if (hit) offsets[side] = { x: Number(hit[1]), y: Number(hit[2]) };
    }

    // A stepping loop over unit offsets is a wave rolling away from the
    // caster; anything else places the effect once.
    const steps = num(src, /for\s+\w+\s*=\s*1\s*,\s*(\d+)\s+do/);
    const stepMs = num(
      src,
      /addEvent\([\s\S]{0,400}?,\s*\(\s*\w+\s*-\s*1\s*\)\s*\*\s*(\d+)\s*\)/,
    );
    const unitOffsets =
      Object.keys(offsets).length > 0 &&
      Object.values(offsets).every((o) => Math.abs(o.x) + Math.abs(o.y) === 1);

    const sideEffect = num(src, /local\s+sideEffect\s*=\s*(\d+)/);

    const range = num(src, /\w+:range\(\s*(-?\d+)\s*\)/);
    const needTarget = /\w+:needTarget\(\s*true\s*\)/.test(src);

    const visual: SpellVisual = {
      key: name.toLowerCase(),
      name,
      element,
      needTarget,
      source: file,
    };
    if (effect !== undefined) visual.effect = effect;
    if (missile !== undefined) visual.missile = missile;
    if (Object.keys(facing).length) visual.facing = facing;
    if (Object.keys(offsets).length) visual.offsets = offsets;
    if (unitOffsets && steps !== undefined && steps > 1) {
      visual.wave = { steps, intervalMs: stepMs ?? 200 };
    }
    if (sideEffect !== undefined) visual.sideEffect = sideEffect;
    if (range !== undefined && range >= 0) visual.range = range;

    if (visual.effect === undefined && visual.missile === undefined && !visual.facing) {
      silent.push(file);
    }

    // Two files can register the same name; the first one wins so the result
    // does not depend on directory order.
    if (!byKey.has(visual.key)) byKey.set(visual.key, visual);
  }

  return { byKey, silent, unnamed };
}
