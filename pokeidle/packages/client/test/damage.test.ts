import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLOAT_MS,
  FLOAT_RISE,
  MAX_FLOATERS,
  Floaters,
  floaterAt,
  hitDamage,
} from '../src/damage.ts';

// ── what a hit is worth ──────────────────────────────────────────────────────

test('a hit is the move power scaled by level, the way the dps sum is', () => {
  // `movesetDps` is power over interval, times level, so one landed move at
  // that rate is power times level.
  assert.equal(hitDamage(3, 5), 15, "Charmander's melee at level five");
  assert.equal(hitDamage(20, 23), 460, 'Fire Blast at twenty-three');
});

test('a hit always lands for something', () => {
  // A zero would read as a miss, and the simulation has already decided this
  // one connected.
  assert.equal(hitDamage(0, 10), 1);
  assert.equal(hitDamage(3, 0), 3, 'level zero is still a level');
  assert.equal(hitDamage(-5, 10), 1);
});

// ── the numbers in the air ───────────────────────────────────────────────────

const at = (t: number) => new Floaters(() => 0.5);

test('a number goes up and comes off on its own', () => {
  const f = at(0);
  f.push(0, 10, 10, 42, 'dealt');
  assert.equal(f.all.length, 1);

  f.update(FLOAT_MS - 1);
  assert.equal(f.all.length, 1, 'still readable');

  f.update(FLOAT_MS);
  assert.equal(f.all.length, 0);
});

test('nothing is shown for a hit that took nothing', () => {
  const f = at(0);
  f.push(0, 10, 10, 0, 'dealt');
  f.push(0, 10, 10, -3, 'taken');
  f.push(0, 10, 10, Number.NaN, 'dealt');
  assert.equal(f.all.length, 0);
});

test('an amount is shown whole', () => {
  const f = at(0);
  f.push(0, 10, 10, 41.6, 'dealt');
  assert.equal(f.all[0]!.amount, 42);
});

test('consecutive hits fan out instead of stacking on one spot', () => {
  const f = at(0);
  f.push(0, 10, 10, 10, 'dealt');
  f.push(0, 10, 10, 10, 'dealt');
  assert.ok(f.all[0]!.drift > 0);
  assert.ok(f.all[1]!.drift < 0, 'the next one goes the other way');
});

test('a fast fight cannot flood the screen', () => {
  const f = at(0);
  for (let i = 0; i < MAX_FLOATERS + 10; i++) f.push(i, 10, 10, 5, 'dealt');

  assert.equal(f.all.length, MAX_FLOATERS);
  assert.equal(f.all[0]!.at, 10, 'the oldest ten went');
});

test('clearing takes everything down at once', () => {
  const f = at(0);
  f.push(0, 10, 10, 5, 'dealt');
  f.clear();
  assert.equal(f.all.length, 0);
});

// ── how one moves ────────────────────────────────────────────────────────────

test('a number rises the whole way up', () => {
  const f = at(0);
  f.push(1000, 10, 10, 5, 'dealt');
  const one = f.all[0]!;

  assert.equal(floaterAt(one, 1000).dy, 0);
  assert.equal(floaterAt(one, 1000 + FLOAT_MS / 2).dy, -FLOAT_RISE / 2);
  assert.equal(floaterAt(one, 1000 + FLOAT_MS).dy, -FLOAT_RISE);
});

test('it stays solid most of its life and fades at the end', () => {
  // Fading from the first frame makes a number that is never quite readable.
  const f = at(0);
  f.push(0, 10, 10, 5, 'dealt');
  const one = f.all[0]!;

  assert.equal(floaterAt(one, 0).alpha, 1);
  assert.equal(floaterAt(one, FLOAT_MS * 0.5).alpha, 1);
  assert.ok(floaterAt(one, FLOAT_MS * 0.85).alpha < 1);
  assert.equal(floaterAt(one, FLOAT_MS).alpha, 0);
});

test('a number that outlived its time is pinned to the end, not past it', () => {
  const f = at(0);
  f.push(0, 10, 10, 5, 'dealt');
  const one = f.all[0]!;

  const late = floaterAt(one, FLOAT_MS * 4);
  assert.equal(late.dy, -FLOAT_RISE);
  assert.equal(late.alpha, 0);
});
