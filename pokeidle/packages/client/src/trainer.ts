/**
 * Levels, for the trainer and for their Pokemon.
 *
 * ## The curve is the server's
 *
 * `expForLevel` is `Player::getExpForLevel` from servidor/src/player.h, kept
 * to the letter:
 *
 * ```cpp
 * static uint64_t getExpForLevel(int32_t lv) {
 *   lv--;
 *   return ((50ULL * lv * lv * lv) - (150ULL * lv * lv) + (400ULL * lv)) / 3ULL;
 * }
 * ```
 *
 * So level 2 is 100 experience, level 8 is 4,200, and the climb steepens the
 * way it does on the server rather than the way a placeholder guessed.
 *
 * ## Pokemon use it too, and that part is ours
 *
 * The base has no Pokemon levelling at all — a species' `level` in its monster
 * file is a fixed stat, and nothing in servidor/data raises it. Since a hunt
 * is fought by the team and led by the trainer, both earn the same experience
 * from the same kill, so both climb the same curve. If the base ever grows its
 * own Pokemon curve, this is the one place to change.
 */

/** Total experience needed to *reach* `level`. Level 1 is the start: zero. */
export function expForLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level)) - 1;
  return (50 * lv * lv * lv - 150 * lv * lv + 400 * lv) / 3;
}

/** What one whole level costs, from `level` to the next. */
export function expToNext(level: number): number {
  return expForLevel(level + 1) - expForLevel(level);
}

/** The level a lifetime total of experience buys. */
export function levelFromExp(total: number): number {
  let level = 1;
  // Cubic growth, so this is a handful of steps even for a very long save.
  while (expForLevel(level + 1) <= Math.max(0, total)) level++;
  return level;
}

export type Progress = {
  level: number;
  /** Experience earned since reaching `level`. */
  into: number;
  /** Experience one whole level costs at `level`. */
  need: number;
  /** `into / need`, in 0..1, for a bar. */
  share: number;
  /** What is still missing to level up. */
  left: number;
  total: number;
};

/** Where a lifetime total stands: level, and how far into it. */
export function progressAt(total: number): Progress {
  const clean = Math.max(0, Math.floor(total));
  const level = levelFromExp(clean);
  const need = expToNext(level);
  const into = clean - expForLevel(level);
  return {
    level,
    into,
    need,
    share: need > 0 ? Math.min(1, into / need) : 0,
    left: Math.max(0, need - into),
    total: clean,
  };
}

/**
 * Add experience to something that tracks its level and the points into it.
 *
 * A Pokemon's level does not come from a lifetime total — it was caught at the
 * level the species is written at — so it carries "points into this level"
 * instead, and a big enough gain can carry it up more than one.
 */
export function gainInto(
  level: number,
  into: number,
  gained: number,
): { level: number; into: number; levels: number } {
  let lv = Math.max(1, Math.floor(level));
  let points = Math.max(0, into) + Math.max(0, gained);
  let levels = 0;

  for (;;) {
    const need = expToNext(lv);
    if (need <= 0 || points < need) break;
    points -= need;
    lv++;
    levels++;
  }

  return { level: lv, into: points, levels };
}
