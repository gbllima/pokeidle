import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIAMONDS_PER_LEVEL,
  SUPPLIES,
  balanceOf,
  buy,
  levelsAway,
  priceOfSpecies,
} from '../src/premium.ts';

// ── the purse ────────────────────────────────────────────────────────────────

test('a new trainer has nothing to spend', () => {
  assert.equal(balanceOf(1, 0), 0);
});

test('every level is worth the same, and spending comes off the top', () => {
  assert.equal(balanceOf(11, 0), 10 * DIAMONDS_PER_LEVEL);
  assert.equal(balanceOf(11, 5), 10 * DIAMONDS_PER_LEVEL - 5);
});

test('spending more than was earned still leaves nothing, not a debt', () => {
  // The balance is derived from the level, so a save that has drifted must not
  // turn into a negative number the shop would happily accept.
  assert.equal(balanceOf(3, 9999), 0);
});

test('a broken level or spend reads as the floor rather than crashing', () => {
  assert.equal(balanceOf(0, 0), 0);
  assert.equal(balanceOf(-4, 0), 0);
  assert.equal(balanceOf(5, -20), 4 * DIAMONDS_PER_LEVEL, 'a negative spend is not income');
});

// ── prices ───────────────────────────────────────────────────────────────────

test('a common Pokemon is the cheapest rung and an uncatchable one the dearest', () => {
  // catchChance from the monster scripts: Caterpie 1500, Mewtwo 250, and the
  // seven species written at 1.
  assert.equal(priceOfSpecies(1500), 15);
  assert.equal(priceOfSpecies(250), 60);
  assert.equal(priceOfSpecies(1), 300);
});

test('the price never climbs as a Pokemon gets easier to catch', () => {
  let last = Infinity;
  for (const chance of [0, 1, 10, 150, 250, 400, 500, 1000, 1500]) {
    const price = priceOfSpecies(chance);
    assert.ok(price <= last, `${chance} costs more than something rarer`);
    last = price;
  }
});

test('every supply is priced on the ladder the base uses', () => {
  const rungs = new Set([3, 5, 10, 15, 20, 30, 40, 60, 120, 300]);
  for (const offer of SUPPLIES) {
    assert.ok(rungs.has(offer.price), `${offer.label} at ${offer.price} is off the ladder`);
  }
});

test('the balls climb in price the way they do in gold', () => {
  const price = (id: string) => SUPPLIES.find((o) => o.id === id)!.price;
  assert.ok(price('poke25') < price('great25'));
  assert.ok(price('great25') < price('super25'));
  assert.ok(price('super25') < price('ultra25'));
});

// ── buying ───────────────────────────────────────────────────────────────────

test('an affordable offer goes through at its price', () => {
  const result = buy(SUPPLIES, 'poke25', 10);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.price, 3);
});

test('an offer that costs more than is in hand says how much is missing', () => {
  assert.deepEqual(buy(SUPPLIES, 'ultra25', 6), { ok: false, reason: 'poor', short: 14 });
});

test('exactly enough is enough', () => {
  assert.equal(buy(SUPPLIES, 'ultra25', 20).ok, true);
});

test('an offer nobody is selling is refused rather than granted for free', () => {
  assert.deepEqual(buy(SUPPLIES, 'masterball', 9999), { ok: false, reason: 'unknown' });
});

test('the shop says how far off a price is, in levels', () => {
  // Two diamonds a level, so twenty diamonds short is ten levels of hunting.
  assert.equal(levelsAway(20, 0), 10);
  assert.equal(levelsAway(20, 19), 1);
  assert.equal(levelsAway(20, 20), 0, 'affordable is not away at all');
  assert.equal(levelsAway(3, 99), 0);
});
