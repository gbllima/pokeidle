/**
 * The diamond shop.
 *
 * ## Why diamonds
 *
 * `data/lib/systems/newShop.lua` is the base's cash shop. It prices 250 live
 * rows in five currencies, and exactly one of those currencies is a real item
 * in this base: **2145, "small diamond"**. The other four (23498, 12237,
 * 23496, 23497) name item ids that items.xml does not carry — the same rot the
 * `balls` table has. So the diamond is the one coin that can be drawn, held
 * and spent, and it is what this shop charges.
 *
 * ## What it sells
 *
 * What the game can actually hand over: the four balls that exist, the potions
 * and the revive that `potions.lua` and `revive.lua` give real effects to, and
 * Pokemon straight into the depot box.
 *
 * The prices sit on the ladder the base itself uses for diamonds — its own
 * diamond rows run 3, 5, 10, 20, 30, 40, 60 for consumables, and its (disabled)
 * Pokemon rows run 15 to 300 by how special the Pokemon is. Where the base has
 * no row for something we sell, the price follows that shape rather than a
 * number picked out of the air.
 *
 * ## Where diamonds come from
 *
 * In the base, from a payment gateway — `apipix.lua`, real money. There is
 * none of that here, so they are earned: `DIAMONDS_PER_LEVEL` for every
 * trainer level gained. That is this game's rule, not the base's, and it lives
 * on one line so it is one line to change.
 */

/** Earned per trainer level. The trainer's level is already tracked. */
export const DIAMONDS_PER_LEVEL = 2;

/** The item the base charges in, and the sprite the shop draws for it. */
export const DIAMOND_ITEM = 'small diamond';

/**
 * Diamonds in hand.
 *
 * Derived from the level rather than banked, so there is no second number to
 * drift out of step with it; only what has been spent is remembered.
 */
export function balanceOf(level: number, spent: number): number {
  const earned = Math.max(0, Math.floor(level) - 1) * DIAMONDS_PER_LEVEL;
  return Math.max(0, earned - Math.max(0, Math.floor(spent)));
}

export type Offer =
  | { kind: 'item'; id: string; label: string; item: string; quantity: number; price: number }
  | { kind: 'pokemon'; id: string; label: string; slug: string; level: number; price: number };

/** The ladder the base's own diamond rows sit on. */
export const LADDER = [3, 5, 10, 15, 20, 30, 40, 60, 120, 300] as const;

/**
 * Balls and medicine, in the packs a shop sells them in.
 *
 * The order is the order the base lists them in — the cheapest ball first —
 * and each pack is priced a step up the ladder from the one before, the way
 * its Poke Ball, Great Ball, Super Ball, Ultra Ball prices climb in gold.
 */
export const SUPPLIES: Offer[] = [
  { kind: 'item', id: 'poke25', label: 'Poké Ball ×25', item: 'empty poke ball', quantity: 25, price: 3 },
  { kind: 'item', id: 'great25', label: 'Great Ball ×25', item: 'empty great ball', quantity: 25, price: 5 },
  { kind: 'item', id: 'super25', label: 'Super Ball ×25', item: 'empty super ball', quantity: 25, price: 10 },
  { kind: 'item', id: 'ultra25', label: 'Ultra Ball ×25', item: 'empty ultra ball', quantity: 25, price: 20 },
  { kind: 'item', id: 'small20', label: 'Small Potion ×20', item: 'small potion', quantity: 20, price: 3 },
  { kind: 'item', id: 'great20', label: 'Great Potion ×20', item: 'great potion', quantity: 20, price: 5 },
  { kind: 'item', id: 'hyper20', label: 'Hyper Potion ×20', item: 'hyper potion', quantity: 20, price: 10 },
  { kind: 'item', id: 'ultra20', label: 'Ultra Potion ×20', item: 'ultra potion', quantity: 20, price: 10 },
  { kind: 'item', id: 'ultimate10', label: 'Ultimate Potion ×10', item: 'ultimate potion', quantity: 10, price: 20 },
  { kind: 'item', id: 'revive5', label: 'Revive ×5', item: 'revive', quantity: 5, price: 15 },
];

/**
 * What a Pokemon costs.
 *
 * By how hard it is to catch, which is the only measure of rarity the base
 * has: `catchChance` in the monster script, 1500 for a Caterpie down to 1 for
 * the things nobody catches. The rungs are the base's own Pokemon prices.
 */
export function priceOfSpecies(catchChance: number): number {
  if (catchChance >= 1000) return 15;
  if (catchChance >= 400) return 30;
  if (catchChance >= 150) return 60;
  if (catchChance >= 10) return 120;
  return 300;
}

export type Purchase =
  | { ok: true; offer: Offer; price: number }
  | { ok: false; reason: 'unknown' | 'poor'; short?: number };

/** Decide a purchase. Nothing is granted here; the caller does that. */
export function buy(offers: readonly Offer[], id: string, balance: number): Purchase {
  const offer = offers.find((o) => o.id === id);
  if (!offer) return { ok: false, reason: 'unknown' };
  if (offer.price > balance) return { ok: false, reason: 'poor', short: offer.price - balance };
  return { ok: true, offer, price: offer.price };
}

/** How many levels away the player is from affording something. */
export function levelsAway(price: number, balance: number): number {
  if (price <= balance) return 0;
  return Math.ceil((price - balance) / DIAMONDS_PER_LEVEL);
}
