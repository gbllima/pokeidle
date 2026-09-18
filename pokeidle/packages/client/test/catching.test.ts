import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLL_VALUES,
  isCatchable,
  catchChanceOf,
  rollCatch,
  formatChance,
} from '../src/catching.ts';

// Real numbers from the packed release and from the base's `balls` table.
const CATERPIE = 1500;
const MEWTWO = 250;
const COMMON_BALL = 100;

test('a species written with no catch chance cannot be caught', () => {
  // 66 of this base's species are `catchChance = 0`; the server answers
  // "impossible to catch this monster" and never rolls.
  assert.equal(isCatchable(0), false);
  assert.equal(catchChanceOf(0, COMMON_BALL), 0);
  assert.equal(rollCatch(0, COMMON_BALL, () => 0), false, 'not even on the luckiest roll');
});

test('a negative or broken chance is treated as uncatchable, not as a bonus', () => {
  assert.equal(isCatchable(-5), false);
  assert.equal(isCatchable(Number.NaN), false);
  assert.equal(catchChanceOf(-5, COMMON_BALL), 0);
});

test('a common ball is a certainty on anything the base rates at 100 or more', () => {
  // 1500 x 100 is 150,000 against a roll that tops out at 10,000.
  assert.equal(catchChanceOf(CATERPIE, COMMON_BALL), 1);
  assert.equal(catchChanceOf(MEWTWO, COMMON_BALL), 1);
  assert.equal(rollCatch(MEWTWO, COMMON_BALL, () => 0.9999), true);
});

test('the rarest species are the only ones a common ball can lose', () => {
  // The seven species at `catchChance = 1` are 1 x 100 = 100, so the roll wins
  // on 0..100 out of 10,001 values.
  assert.equal(catchChanceOf(1, COMMON_BALL), 101 / ROLL_VALUES);
  assert.ok(catchChanceOf(1, COMMON_BALL) < 0.011);
  assert.equal(catchChanceOf(10, COMMON_BALL), 1001 / ROLL_VALUES);
});

test('a weaker ball multiplies the odds down exactly as the table says', () => {
  // The table's `chanceMultiplier` is the whole difference between one ball
  // and another: a x1 ball on Caterpie is 1500 of 10,001, not a certainty.
  assert.equal(catchChanceOf(CATERPIE, 1), 1501 / ROLL_VALUES);
  assert.equal(catchChanceOf(MEWTWO, 1), 251 / ROLL_VALUES);
  assert.ok(catchChanceOf(CATERPIE, 5) > catchChanceOf(CATERPIE, 1));
});

test('a ball with no multiplier catches nothing', () => {
  assert.equal(catchChanceOf(CATERPIE, 0), 0);
});

test('the roll is the one the server makes, boundary included', () => {
  // chance = 1 x 100 = 100, and `math.random(0, 10000) <= 100` wins at exactly
  // 100. Math.floor(random() * 10001) reproduces that draw.
  const at = (value: number) => () => value / ROLL_VALUES;
  assert.equal(rollCatch(1, COMMON_BALL, at(100)), true, '100 <= 100 is a catch');
  assert.equal(rollCatch(1, COMMON_BALL, at(101)), false, '101 is not');
});

test('over many throws the roll lands near the odds it reports', () => {
  // 10% by the table: `catchChance = 10` on a common ball.
  let hits = 0;
  const total = 20_000;
  let seed = 12_345;
  const random = () => {
    // A small deterministic generator, so the run cannot flake.
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  for (let i = 0; i < total; i++) if (rollCatch(10, COMMON_BALL, random)) hits++;

  const observed = hits / total;
  const expected = catchChanceOf(10, COMMON_BALL);
  assert.ok(Math.abs(observed - expected) < 0.01, `${observed} is far from ${expected}`);
});

// ── how it reads ─────────────────────────────────────────────────────────────

test('a certainty and an impossibility read as such', () => {
  assert.equal(formatChance(1), '100%');
  assert.equal(formatChance(2), '100%', 'over the top is still the top');
  assert.equal(formatChance(0), '0%');
});

test('a small chance keeps a decimal rather than rounding to nothing', () => {
  // "0%" on something that can still be caught reads as a bug.
  assert.equal(formatChance(0.004), '0,40%');
  assert.equal(formatChance(0.0101), '1,0%');
  assert.equal(formatChance(0.25), '25%');
});
