import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POTIONS,
  POTION_TICKS,
  cleanSettings,
  DEFAULT_SETTINGS,
  needsPotion,
  pickPotion,
  potionHeal,
  potionTickHeal,
  isShiny,
  shouldCatch,
  type HelperSettings,
} from '../src/helper.ts';

const settings = (over: Partial<HelperSettings> = {}): HelperSettings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

// ── potions ──────────────────────────────────────────────────────────────────

test('a potion is worth five ticks of the divisor in potions.lua', () => {
  const small = POTIONS.find((p) => p.item === 'small potion')!;
  // 1000 / 35 = 28 a tick, five ticks.
  assert.equal(potionTickHeal(1000, small), 28);
  assert.equal(potionHeal(1000, small), 28 * POTION_TICKS);
});

test('the ultimate potion is the half-bar the script says it is', () => {
  const ultimate = POTIONS.find((p) => p.item === 'ultimate potion')!;
  assert.equal(potionHeal(1000, ultimate), 500);
});

test('a tick always heals something, even on a tiny Pokemon', () => {
  const ultimate = POTIONS.find((p) => p.item === 'ultimate potion')!;
  assert.equal(potionTickHeal(1, ultimate), 1, 'a potion that heals nothing is a wasted potion');
  assert.equal(potionTickHeal(0, ultimate), 1);
});

test('the list is ordered by what it heals, whatever the names say', () => {
  // The base's own naming is inconsistent — its hyper potion heals less than
  // its great potion — so the order has to come from the numbers.
  const heals = POTIONS.map((p) => potionHeal(10_000, p));
  for (let i = 1; i < heals.length; i++) {
    assert.ok(heals[i]! > heals[i - 1]!, `${POTIONS[i]!.label} is out of order`);
  }
});

// ── when to drink one ────────────────────────────────────────────────────────

test('a hurt Pokemon at or under the threshold is healed', () => {
  assert.equal(needsPotion(90, 100, 0.9), true, 'exactly at the mark counts');
  assert.equal(needsPotion(89, 100, 0.9), true);
  assert.equal(needsPotion(91, 100, 0.9), false);
});

test('one at full health is never worth a potion', () => {
  assert.equal(needsPotion(100, 100, 1), false);
  assert.equal(needsPotion(120, 100, 1), false, 'over full is still full');
});

test('a fainted Pokemon is a job for a revive, not a potion', () => {
  assert.equal(needsPotion(0, 100, 0.9), false);
});

test('a Pokemon with no maximum is left alone rather than crashed on', () => {
  assert.equal(needsPotion(0, 0, 0.9), false);
});

// ── which potion ─────────────────────────────────────────────────────────────

test('the potion the player picked is the one used', () => {
  const held = { 'small potion': 4, 'ultimate potion': 2 };
  assert.equal(pickPotion(settings({ potionItem: 'ultimate potion' }), held)!.item, 'ultimate potion');
});

test('running out of the picked one falls back to the weakest held', () => {
  // Weakest, not first in the bag: an Ultimate spent on a scratch is how a
  // bag empties in one hunt.
  const held = { 'ultra potion': 1, 'small potion': 9 };
  assert.equal(pickPotion(settings({ potionItem: 'ultimate potion' }), held)!.item, 'small potion');
});

test('an empty bag heals nobody', () => {
  assert.equal(pickPotion(settings(), {}), null);
  assert.equal(pickPotion(settings(), { 'small potion': 0 }), null);
});

test('an unknown item name in the settings is ignored, not obeyed', () => {
  assert.equal(pickPotion(settings({ potionItem: 'lemonade' }), { 'great potion': 3 })!.item, 'great potion');
});

// ── settings ─────────────────────────────────────────────────────────────────

test('nothing is switched on until the player switches it on', () => {
  const clean = cleanSettings(null);
  assert.deepEqual(clean, DEFAULT_SETTINGS);
  assert.equal(clean.potion, false);
  assert.equal(clean.catchNormal, false);
});

test('a stored threshold is kept inside a range that means something', () => {
  // Zero would only ever heal the dead; over one would empty the bag into a
  // Pokemon standing at full health.
  assert.equal(cleanSettings({ threshold: 0 }).threshold, 0.05);
  assert.equal(cleanSettings({ threshold: 5 }).threshold, 1);
  assert.equal(cleanSettings({ threshold: 0.5 }).threshold, 0.5);
  assert.equal(cleanSettings({ threshold: 'half' }).threshold, DEFAULT_SETTINGS.threshold);
});

test('a corrupt save does not switch helpers on by accident', () => {
  const clean = cleanSettings({ potion: 'yes', revive: 1, potionItem: 42 });
  assert.equal(clean.potion, false);
  assert.equal(clean.revive, false);
  assert.equal(clean.potionItem, '');
});

// ── catching ─────────────────────────────────────────────────────────────────

test('shiny is read off the name, the way the base marks its variants', () => {
  assert.equal(isShiny('Shiny Pikachu'), true);
  assert.equal(isShiny('shiny gyarados'), true);
  assert.equal(isShiny('Pikachu'), false);
  assert.equal(isShiny('Shinx'), false, 'a name that merely starts with shin is not shiny');
});

test('the two catch switches cover different Pokemon', () => {
  const normalOnly = settings({ catchNormal: true });
  assert.equal(shouldCatch(normalOnly, 'Caterpie'), true);
  assert.equal(shouldCatch(normalOnly, 'Shiny Caterpie'), false);

  const shinyOnly = settings({ catchShiny: true });
  assert.equal(shouldCatch(shinyOnly, 'Caterpie'), false);
  assert.equal(shouldCatch(shinyOnly, 'Shiny Caterpie'), true);
});

test('with both off nothing is thrown at anything', () => {
  assert.equal(shouldCatch(settings(), 'Caterpie'), false);
  assert.equal(shouldCatch(settings(), 'Shiny Caterpie'), false);
});
