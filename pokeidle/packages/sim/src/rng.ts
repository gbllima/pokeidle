/**
 * Deterministic pseudo-random numbers, addressed rather than streamed.
 *
 * A streaming generator would make results depend on how many times it has
 * been called, which in turn depends on when the server happened to tick.
 * Every draw here is a pure function of (seed, sequence, channel), so the
 * value for encounter 5,000 is the same whether the run was simulated in one
 * pass or resumed forty times. That property is what lets an offline
 * reconciliation produce byte-identical results to a live simulation.
 */

/** Channels keep independent draws from correlating with each other. */
export const CHANNEL = {
  loot: 1,
  lootCount: 2,
  catch: 3,
  shiny: 4,
  crit: 5,
} as const;

export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

/**
 * SplitMix64 finalizer over a 64-bit state built from the address.
 * Chosen because it needs no carried state — the whole point here.
 */
export function draw(seed: number, sequence: number, channel: Channel): number {
  let x = BigInt.asUintN(
    64,
    BigInt(seed) * 0x9e3779b97f4a7c15n +
      BigInt(sequence) * 0xbf58476d1ce4e5b9n +
      BigInt(channel) * 0x94d049bb133111ebn,
  );

  x = BigInt.asUintN(64, (x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n);
  x = BigInt.asUintN(64, (x ^ (x >> 27n)) * 0x94d049bb133111ebn);
  x = BigInt.asUintN(64, x ^ (x >> 31n));

  // 53 bits is all a double can hold exactly.
  return Number(x >> 11n) / 2 ** 53;
}

/** Integer in [0, bound). */
export function drawInt(seed: number, sequence: number, channel: Channel, bound: number): number {
  return Math.floor(draw(seed, sequence, channel) * bound);
}

/**
 * Denominator for loot chances in this base.
 *
 * Not the 100,000 of `MAX_LOOTCHANCE`: that constant clamps the XML loader
 * only, and every Pokemon here is defined in Lua, which passes the raw value
 * through. data/lib/systems/pokedex.lua renders a drop rate as
 * `chance / 10000000 * 100`, which fixes the scale at ten million.
 */
export const LOOT_CHANCE_SCALE = 10_000_000;

/**
 * Denominator for catch chances — a different scale entirely.
 * data/actions/scripts/poke/catch.lua rolls `math.random(0, 10000) <= chance`,
 * so a `catchChance` of 400 is 4% before any ball multiplier.
 */
export const CATCH_CHANCE_SCALE = 10_000;

/** Roll a chance expressed against `scale`. */
export function rollChance(
  seed: number,
  sequence: number,
  channel: Channel,
  chance: number,
  scale: number = LOOT_CHANCE_SCALE,
): boolean {
  return drawInt(seed, sequence, channel, scale) < chance;
}
