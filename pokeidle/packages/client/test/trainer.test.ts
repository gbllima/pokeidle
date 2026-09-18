import test from 'node:test';
import assert from 'node:assert/strict';

import { expForLevel, expToNext, levelFromExp, progressAt, gainInto } from '../src/trainer.ts';

test('the curve is the server table, level for level', () => {
  // Straight out of `Player::getExpForLevel`; these are the numbers a player
  // of this base sees on their own character.
  assert.equal(expForLevel(1), 0);
  assert.equal(expForLevel(2), 100);
  assert.equal(expForLevel(3), 200);
  assert.equal(expForLevel(4), 400);
  assert.equal(expForLevel(5), 800);
  assert.equal(expForLevel(6), 1500);
  assert.equal(expForLevel(7), 2600);
  assert.equal(expForLevel(8), 4200);
});

test('every level costs a whole number and more than the one before', () => {
  let last = 0;
  for (let level = 2; level <= 200; level++) {
    const cost = expToNext(level);
    assert.ok(Number.isInteger(cost), `level ${level} costs ${cost}`);
    assert.ok(cost > last, `level ${level} got cheaper`);
    last = cost;
  }
});

test('a level below one is still the start of the curve', () => {
  assert.equal(expForLevel(0), 0);
  assert.equal(expForLevel(-5), 0);
});

// ── reading a total back ─────────────────────────────────────────────────────

test('a total buys exactly the level it reaches, not the next one', () => {
  assert.equal(levelFromExp(0), 1);
  assert.equal(levelFromExp(99), 1);
  assert.equal(levelFromExp(100), 2, 'the cost of a level is enough to have it');
  assert.equal(levelFromExp(4199), 7);
  assert.equal(levelFromExp(4200), 8);
});

test('level and total agree in both directions', () => {
  for (let level = 1; level <= 80; level++) {
    assert.equal(levelFromExp(expForLevel(level)), level, `at level ${level}`);
    assert.equal(levelFromExp(expForLevel(level) - 1), level - 1 || 1, `just under ${level}`);
  }
});

test('a hoarded total still resolves in reasonable time', () => {
  // A long save is a big number, not a hang.
  assert.equal(levelFromExp(1_000_000_000) > 300, true);
});

// ── progress ─────────────────────────────────────────────────────────────────

test('progress says how far into the level the total is', () => {
  const at = progressAt(2600); // exactly level 7
  assert.equal(at.level, 7);
  assert.equal(at.into, 0);
  assert.equal(at.need, 1600); // 4200 - 2600
  assert.equal(at.share, 0);
  assert.equal(at.left, 1600);
});

test('halfway through a level reads as half a bar', () => {
  const at = progressAt(2600 + 800);
  assert.equal(at.level, 7);
  assert.equal(at.share, 0.5);
  assert.equal(at.left, 800);
});

test('a bar never fills past full or falls below empty', () => {
  for (const total of [-500, 0, 1, 99, 100, 12_345]) {
    const at = progressAt(total);
    assert.ok(at.share >= 0 && at.share <= 1, `${total} gave ${at.share}`);
    assert.ok(at.into >= 0 && at.into <= at.need, `${total} sits outside its level`);
  }
});

// ── gaining ──────────────────────────────────────────────────────────────────

test('experience short of a level just moves the bar', () => {
  const after = gainInto(5, 0, 100);
  assert.deepEqual(after, { level: 5, into: 100, levels: 0 });
});

test('experience past the mark levels up and keeps the remainder', () => {
  // Level 5 to 6 costs 700.
  const after = gainInto(5, 0, 750);
  assert.deepEqual(after, { level: 6, into: 50, levels: 1 });
});

test('one big gain can carry several levels at once', () => {
  // An offline catch-up hands over hours of hunting in a single credit.
  const after = gainInto(1, 0, 5000);
  assert.equal(after.level, 8);
  assert.equal(after.levels, 7);
  assert.equal(after.into, 5000 - 4200);
});

test('nothing gained changes nothing', () => {
  assert.deepEqual(gainInto(9, 42, 0), { level: 9, into: 42, levels: 0 });
  assert.deepEqual(gainInto(9, 42, -1000), { level: 9, into: 42, levels: 0 });
});

test('a level and a total agree after gaining the exact cost', () => {
  let level = 1;
  let into = 0;
  let paid = 0;
  for (let i = 0; i < 20; i++) {
    const cost = expToNext(level);
    paid += cost;
    ({ level, into } = gainInto(level, into, cost));
  }
  assert.equal(into, 0);
  assert.equal(level, 21);
  assert.equal(paid, expForLevel(21));
});
