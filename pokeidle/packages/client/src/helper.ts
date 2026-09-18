/**
 * The Auto-Helper: potions, revives and balls used without being clicked.
 *
 * Every number here is the base's own. `data/actions/scripts/other/potions.lua`
 * heals a Pokemon with a regeneration condition that runs for five seconds and
 * restores `getTotalHealth() / divisor` each second, and puts a five second
 * `CONDITION_EXHAUST_HEAL` on the trainer, so a potion is worth `5 / divisor`
 * of the Pokemon's maximum health and one cannot follow another immediately.
 * `data/actions/scripts/poke/revive.lua` sets `pokeHealth` to the full maximum,
 * so a revive is a full heal.
 *
 * The decisions live here, apart from the game loop, because "should this
 * potion be used" is a rule worth testing on its own, while "draw the panel"
 * is not.
 */

/** One second per regeneration tick, for five ticks. */
export const POTION_TICKS = 5;
export const POTION_TICK_MS = 1000;
/** `CONDITION_EXHAUST_HEAL`, `totaltime = 5`. */
export const POTION_EXHAUST_MS = 5000;

export type Potion = {
  item: string;
  label: string;
  /** `getTotalHealth() / divisor` per tick, straight from potions.lua. */
  divisor: number;
};

/**
 * The five potions, in the order they heal.
 *
 * The base's own naming disagrees with its numbers — its "hyper potion" heals
 * less than its "great potion", and the script's local for 27643 is called
 * `hyperPotion` while items.xml calls that id a great potion. The names are
 * items.xml's and the divisors are the script's, which is the pairing the
 * server actually applies when a player uses one.
 */
export const POTIONS: Potion[] = [
  { item: 'small potion', label: 'Small Potion', divisor: 35 },
  { item: 'hyper potion', label: 'Hyper Potion', divisor: 22 },
  { item: 'great potion', label: 'Great Potion', divisor: 20 },
  { item: 'ultra potion', label: 'Ultra Potion', divisor: 18 },
  { item: 'ultimate potion', label: 'Ultimate Potion', divisor: 10 },
];

export const REVIVE_ITEM = 'revive';

/** Health one tick of a potion restores. */
export function potionTickHeal(maxHp: number, potion: Potion): number {
  return Math.max(1, Math.floor(Math.max(0, maxHp) / potion.divisor));
}

/** Health a whole potion is worth, over its five ticks. */
export function potionHeal(maxHp: number, potion: Potion): number {
  return potionTickHeal(maxHp, potion) * POTION_TICKS;
}

export type HelperSettings = {
  potion: boolean;
  /** Item name the player picked, or empty for "whatever is in the bag". */
  potionItem: string;
  /** Heal at or below this share of maximum health, 0..1. */
  threshold: number;
  revive: boolean;
  catchNormal: boolean;
  catchShiny: boolean;
};

export const DEFAULT_SETTINGS: HelperSettings = {
  potion: false,
  potionItem: '',
  threshold: 0.9,
  revive: false,
  catchNormal: false,
  catchShiny: false,
};

/** Fill in anything a stored settings object is missing or got wrong. */
export function cleanSettings(raw: unknown): HelperSettings {
  const from = (raw ?? {}) as Partial<HelperSettings>;
  const threshold = Number(from.threshold);
  return {
    potion: from.potion === true,
    potionItem: typeof from.potionItem === 'string' ? from.potionItem : '',
    // A threshold of zero would only ever heal the dead, and one above the
    // whole bar would empty the bag into a Pokemon at full health.
    threshold: Number.isFinite(threshold)
      ? Math.min(1, Math.max(0.05, threshold))
      : DEFAULT_SETTINGS.threshold,
    revive: from.revive === true,
    catchNormal: from.catchNormal === true,
    catchShiny: from.catchShiny === true,
  };
}

/** Whether a Pokemon at this health is hurt enough to be worth a potion. */
export function needsPotion(hp: number, maxHp: number, threshold: number): boolean {
  // The fainted are a job for a revive, not a potion: the base's potion is a
  // regeneration condition, and a dead Pokemon has none to carry it.
  if (hp <= 0 || maxHp <= 0) return false;
  if (hp >= maxHp) return false;
  return hp / maxHp <= threshold;
}

/**
 * The potion a heal will use: the one the player picked while they still have
 * it, otherwise the weakest they hold — spending an Ultimate on a scratch is
 * how a bag empties.
 */
export function pickPotion(
  settings: HelperSettings,
  held: Readonly<Record<string, number>>,
): Potion | null {
  const has = (p: Potion) => (held[p.item] ?? 0) > 0;
  const chosen = POTIONS.find((p) => p.item === settings.potionItem);
  if (chosen && has(chosen)) return chosen;
  return POTIONS.find(has) ?? null;
}

/** The base marks its variants in the name, and shiny is one of them. */
export function isShiny(name: string): boolean {
  return /(^|\s)shiny\s/i.test(`${name.trim()} `);
}

/** Whether the helper should spend a ball on this body. */
export function shouldCatch(settings: HelperSettings, name: string): boolean {
  return isShiny(name) ? settings.catchShiny : settings.catchNormal;
}
