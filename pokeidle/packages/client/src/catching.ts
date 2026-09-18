/**
 * Whether a ball catches what it lands on.
 *
 * Straight out of `servidor/data/actions/scripts/poke/catch.lua`:
 *
 * ```lua
 * local chanceBase = monsterType:catchChance()
 * if chanceBase == 0 then ... "impossible to catch this monster" ... end
 * local chance = chanceBase * balls[ballKey].chanceMultiplier
 * local caught = math.random(0, 10000) <= chance
 * ```
 *
 * `catchChance` is the number written in the species' own monster script — a
 * Caterpie is 1500, a Mewtwo 250, and 66 of this base's species are 0. The
 * ball's `chanceMultiplier` is the only thing that separates one ball from
 * another, and the four the game actually has all multiply by 100.
 *
 * That makes the arithmetic blunt: any species at 100 or more is a certainty
 * with a common ball, and what is actually scarce is the ball. This module
 * says so honestly rather than inventing a curve the base does not have.
 */

/** `math.random(0, 10000)` draws one of 10,001 values, all equally likely. */
export const ROLL_VALUES = 10_001;

/** A species with no catch chance cannot be caught by any ball, ever. */
export function isCatchable(catchValue: number): boolean {
  return Number.isFinite(catchValue) && catchValue > 0;
}

/**
 * The odds one throw works, as a share of 1.
 *
 * `math.random(0, 10000) <= chance` wins on every value from 0 up to `chance`,
 * which is `chance + 1` of the 10,001 the roll can produce.
 */
export function catchChanceOf(catchValue: number, multiplier: number): number {
  if (!isCatchable(catchValue) || multiplier <= 0) return 0;
  const chance = Math.floor(catchValue * multiplier);
  return Math.min(1, (chance + 1) / ROLL_VALUES);
}

/** One throw. `random` is injectable so a test can pin the outcome. */
export function rollCatch(
  catchValue: number,
  multiplier: number,
  random: () => number = Math.random,
): boolean {
  if (!isCatchable(catchValue)) return false;
  const chance = catchValue * multiplier;
  return Math.floor(random() * ROLL_VALUES) <= chance;
}

/**
 * The odds as the panel shows them.
 *
 * A rounded "0%" on something that can still be caught reads as a bug, so
 * anything below half a percent keeps a decimal.
 */
export function formatChance(share: number): string {
  if (share <= 0) return '0%';
  if (share >= 1) return '100%';
  const pct = share * 100;
  if (pct < 1) return `${pct.toFixed(2).replace('.', ',')}%`;
  if (pct < 10) return `${pct.toFixed(1).replace('.', ',')}%`;
  return `${Math.round(pct)}%`;
}
