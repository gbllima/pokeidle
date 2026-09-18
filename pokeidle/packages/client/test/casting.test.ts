import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Caster,
  ENGAGE_RANGE,
  MELEE_RANGE,
  inReach,
  missileProgress,
  effectPhase,
  CAST_MS,
  MISSILE_MS,
  EFFECT_TICKS_PER_FRAME,
  effectDuration,
  effectSpritePos,
  facingToward,
  waveTiles,
  type MoveSpec,
  type MoveVisual,
} from '../src/casting.ts';

/** Charmander's real move set, as the release ships it. */
const MOVES: MoveSpec[] = [
  { name: 'melee', power: 3, interval: 2000, chance: 100, element: 'normal' },
  { name: 'Ember', power: 10, interval: 5000, chance: 100, element: 'fire' },
  { name: 'Fire Blast', power: 20, interval: 30000, chance: 100, element: 'fire' },
];

const VISUALS: Record<string, MoveVisual> = {
  ember: { name: 'Ember', element: 'fire', effect: 2395, missile: 4 },
  'fire blast': {
    name: 'Fire Blast',
    element: 'fire',
    facing: { north: 28, east: 62, south: 63, west: 64 },
  },
};

const HERE = { x: 10, y: 10 };
/** Where a fight actually happens: the next tile over. */
const THERE = { x: 11, y: 10 };
/** Across the clearing, out of reach of anything that has to be walked to. */
const FAR = { x: 16, y: 10 };

const always = () => 0;
const never = () => 0.999;

test('arming stages the first cast of each move instead of firing them together', () => {
  const caster = new Caster(VISUALS, always);
  caster.arm(MOVES, 0);

  // Nothing is due on the same tick the set is loaded.
  assert.deepEqual(caster.update(0, HERE, THERE), []);
  assert.ok(caster.armed);
});

test('a move fires on its own interval, over and over', () => {
  const single: MoveSpec[] = [
    { name: 'Ember', power: 10, interval: 1000, chance: 100, element: 'fire' },
  ];
  const c = new Caster(VISUALS, always);
  c.arm(single, 0);

  // Staggered start: one move in a set of one begins halfway through.
  assert.equal(c.update(400, HERE, THERE).length, 0);
  assert.equal(c.update(500, HERE, THERE).length, 1);
  assert.equal(c.update(1400, HERE, THERE).length, 0);
  assert.equal(c.update(1500, HERE, THERE).length, 1);
});

test('a failed chance roll still burns the cooldown', () => {
  // Otherwise a 20% move would fire on the first tick after every miss and
  // land far more often than the rate the damage sum is built from.
  const moves: MoveSpec[] = [
    { name: 'Ember', power: 10, interval: 1000, chance: 20, element: 'fire' },
  ];
  const c = new Caster(VISUALS, never);
  c.arm(moves, 0);

  assert.equal(c.update(500, HERE, THERE).length, 0, 'rolled a miss');
  assert.equal(c.update(600, HERE, THERE).length, 0, 'not retried immediately');
  assert.equal(c.update(1500, HERE, THERE).length, 0, 'next window, another miss');
});

test('a cast carries the effect and missile the spell script names', () => {
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'Ember', power: 10, interval: 1000, chance: 100, element: 'fire' }], 0);

  const [cast] = c.update(500, HERE, THERE);
  assert.equal(cast!.move, 'Ember');
  assert.equal(cast!.effect, 2395);
  assert.equal(cast!.missile, 4);
  assert.deepEqual(cast!.from, HERE);
  assert.deepEqual(cast!.to, THERE);
});

test('a directional move picks the effect for the side the target is on', () => {
  const c = new Caster(VISUALS, always);
  const blast: MoveSpec[] = [
    { name: 'Fire Blast', power: 20, interval: 1000, chance: 100, element: 'fire' },
  ];

  c.arm(blast, 0);
  assert.equal(c.update(500, HERE, { x: 11, y: 10 })[0]!.effect, 62, 'east');

  c.arm(blast, 0);
  assert.equal(c.update(500, HERE, { x: 9, y: 10 })[0]!.effect, 64, 'west');

  c.arm(blast, 0);
  assert.equal(c.update(500, HERE, { x: 10, y: 11 })[0]!.effect, 63, 'south');

  c.arm(blast, 0);
  assert.equal(c.update(500, HERE, { x: 10, y: 9 })[0]!.effect, 28, 'north');
});

test('a move with no spell script still fires, just without an animation', () => {
  // `melee` is 656 of the references in the base and has no script at all.
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'melee', power: 3, interval: 1000, chance: 100, element: 'normal' }], 0);

  const [cast] = c.update(500, HERE, THERE);
  assert.equal(cast!.move, 'melee');
  assert.equal(cast!.effect, undefined);
  assert.equal(cast!.missile, undefined);
});

test('with nothing to aim at, nothing is cast', () => {
  // A Pokemon alone in a clearing is not throwing Embers at the grass.
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'Ember', power: 10, interval: 1000, chance: 100, element: 'fire' }], 0);
  assert.deepEqual(c.update(900, HERE, null), []);
});

test('a cast lives as long as its effect actually takes to play', () => {
  // Ember carries a missile and an effect of ten 100ms frames. Dropping it on
  // a flat 900ms cut the animation off with a frame still to go.
  const c = new Caster(VISUALS, always, () => 1000);
  c.arm([{ name: 'Ember', power: 10, interval: 100_000, chance: 100, element: 'fire' }], 0);

  const [shot] = c.update(50_000, HERE, THERE);
  assert.equal(shot!.duration, MISSILE_MS + 1000, 'flight plus the effect itself');

  c.update(50_000 + shot!.duration - 1, HERE, THERE);
  assert.equal(c.casts.length, 1);

  c.update(50_000 + shot!.duration, HERE, THERE);
  assert.equal(c.casts.length, 0);
});

test('a move with no effect at all falls back to the plain cast length', () => {
  const c = new Caster(VISUALS, always, () => 5000);
  c.arm([{ name: 'melee', power: 3, interval: 100_000, chance: 100, element: 'normal' }], 0);
  assert.equal(c.update(50_000, HERE, THERE)[0]!.duration, CAST_MS);
});

test('disarming clears the cooldowns and anything in flight', () => {
  const c = new Caster(VISUALS, always);
  c.arm(MOVES, 0);
  c.update(30_000, HERE, THERE);
  assert.ok(c.casts.length > 0);

  c.disarm();
  assert.equal(c.armed, false);
  assert.equal(c.casts.length, 0);
});

test('a move with no interval is not scheduled rather than firing every frame', () => {
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'Ember', power: 10, interval: 0, chance: 100, element: 'fire' }], 0);
  assert.equal(c.armed, false);
  assert.deepEqual(c.update(10_000, HERE, THERE), []);
});

// ── playback ─────────────────────────────────────────────────────────────────

test('a missile crosses from caster to target and then stays put', () => {
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'Ember', power: 10, interval: 100_000, chance: 100, element: 'fire' }], 0);
  const shot = c.update(50_000, HERE, THERE)[0]!;

  assert.equal(missileProgress(shot, shot.at), 0);
  assert.equal(missileProgress(shot, shot.at + MISSILE_MS / 2), 0.5);
  assert.equal(missileProgress(shot, shot.at + MISSILE_MS), 1);
  assert.equal(missileProgress(shot, shot.at + 99_999), 1);
});

test('an effect walks its own per-phase durations, not an even split', () => {
  // Effect 143 ships five 100ms frames; effect 806 ships twelve 75ms ones.
  // Dividing a fixed cast length across the phases played both at the wrong
  // speed, which is what `Animator::getPhaseAt` in the client does not do.
  const ms100 = [100, 100, 100, 100, 100];

  assert.equal(effectPhase(0, 5, ms100), 0);
  assert.equal(effectPhase(99, 5, ms100), 0);
  assert.equal(effectPhase(100, 5, ms100), 1);
  assert.equal(effectPhase(250, 5, ms100), 2);
  assert.equal(effectPhase(499, 5, ms100), 4);
});

test('an effect that has played out stops being drawn', () => {
  const ms100 = [100, 100, 100];
  assert.equal(effectPhase(299, 3, ms100), 2);
  assert.equal(effectPhase(300, 3, ms100), -1, 'finished, not held on the last frame');
  assert.equal(effectPhase(9999, 3, ms100), -1);
});

test('an effect has not started before its elapsed time reaches zero', () => {
  // Which is how a missile delays the effect it carries: the caller passes
  // the time since the shot landed, and that is negative while it flies.
  assert.equal(effectPhase(-1, 5, [100, 100, 100, 100, 100]), -1);
  assert.equal(effectPhase(0, 5, [100, 100, 100, 100, 100]), 0);
});

test('an effect with no animator falls back to the client tick rate', () => {
  // EFFECT_TICKS_PER_FRAME in effect.h.
  assert.equal(EFFECT_TICKS_PER_FRAME, 75);
  assert.equal(effectPhase(0, 4, null), 0);
  assert.equal(effectPhase(74, 4, null), 0);
  assert.equal(effectPhase(75, 4, null), 1);
  assert.equal(effectPhase(300, 4, null), -1);
});

test('a single-frame effect has nothing to animate', () => {
  assert.equal(effectPhase(0, 1, null), 0);
  assert.equal(effectPhase(5000, 1, null), 0, 'a still frame does not expire');
  assert.equal(effectPhase(-1, 1, null), -1);
});

test('effectDuration adds up what the effect actually ships', () => {
  assert.equal(effectDuration(12, Array(12).fill(75)), 900);
  assert.equal(effectDuration(10, Array(10).fill(100)), 1000);
  assert.equal(effectDuration(4, null), 4 * EFFECT_TICKS_PER_FRAME);
});

// ── placement ────────────────────────────────────────────────────────────────

const PLACED: Record<string, MoveVisual> = {
  flamethrower: {
    name: 'Flamethrower',
    element: 'fire',
    facing: { north: 807, east: 804, south: 806, west: 805 },
    offsets: {
      north: { x: 2, y: -1 },
      east: { x: 5, y: 2 },
      south: { x: 1, y: 5 },
      west: { x: -1, y: 2 },
    },
  },
  'fire blast': {
    name: 'Fire Blast',
    element: 'fire',
    facing: { north: 28, east: 62, south: 63, west: 64 },
    offsets: {
      north: { x: 0, y: -1 },
      east: { x: 1, y: 0 },
      south: { x: 0, y: 1 },
      west: { x: -1, y: 0 },
    },
    wave: { steps: 6, intervalMs: 400 },
    sideEffect: 2395,
  },
};

const fire = (key: string, target: { x: number; y: number }) => {
  const c = new Caster(PLACED, always);
  c.arm([{ name: key, power: 1, interval: 1000, chance: 100, element: 'fire' }], 0);
  return c.update(500, HERE, target)[0]!;
};

test('a plain move plays on the target', () => {
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'Ember', power: 10, interval: 1000, chance: 100, element: 'fire' }], 0);
  assert.deepEqual(c.update(500, HERE, THERE)[0]!.origin, THERE);
});

test('a move with its own placement plays beside the caster, not on the target', () => {
  // Flamethrower's plume is 3x5 tiles; the script pushes it clear of the
  // caster before playing it. Drawing it on the target is what looked wrong.
  const cast = fire('Flamethrower', { x: 11, y: 10 });
  assert.equal(cast.effect, 804, 'east');
  assert.deepEqual(cast.origin, { x: HERE.x + 5, y: HERE.y + 2 });
  assert.notDeepEqual(cast.origin, cast.to);
});

test('placement follows the side the target is on', () => {
  assert.deepEqual(fire('Flamethrower', { x: 10, y: 11 }).origin, { x: 11, y: 15 }, 'south');
  assert.deepEqual(fire('Flamethrower', { x: 10, y: 9 }).origin, { x: 12, y: 9 }, 'north');
  assert.deepEqual(fire('Flamethrower', { x: 9, y: 10 }).origin, { x: 9, y: 12 }, 'west');
});

test('a wave starts on the caster and lasts as long as it takes to walk out', () => {
  const cast = fire('Fire Blast', { x: 11, y: 10 });
  assert.deepEqual(cast.origin, HERE, 'the wave is measured from the caster');
  assert.deepEqual(cast.wave, { steps: 6, intervalMs: 400, step: { x: 1, y: 0 } });
  assert.ok(cast.duration >= 5 * 400, `duration ${cast.duration} cuts the wave short`);
  assert.equal(cast.sideEffect, 2395);
});

test('a wave lights one tile at a time, outward, and keeps them lit', () => {
  const cast = fire('Fire Blast', { x: 11, y: 10 });

  assert.deepEqual(waveTiles(cast, cast.at), [{ x: 11, y: 10 }]);
  assert.deepEqual(waveTiles(cast, cast.at + 400), [
    { x: 11, y: 10 },
    { x: 12, y: 10 },
  ]);
  assert.equal(waveTiles(cast, cast.at + 400 * 5).length, 6);
  assert.equal(waveTiles(cast, cast.at + 400 * 50).length, 6, 'never walks past its steps');
});

test('a move with no wave has no wave tiles', () => {
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'Ember', power: 10, interval: 1000, chance: 100, element: 'fire' }], 0);
  assert.deepEqual(waveTiles(c.update(500, HERE, THERE)[0]!, 9999), []);
});

test('a long wave outlives a plain cast rather than being cut off', () => {
  const c = new Caster(PLACED, always, () => 200);
  c.arm([{ name: 'Fire Blast', power: 20, interval: 100_000, chance: 100, element: 'fire' }], 0);
  c.update(50_000, HERE, { x: 11, y: 10 });

  c.update(50_000 + CAST_MS, HERE, { x: 11, y: 10 });
  assert.equal(c.casts.length, 1, 'still burning after a plain cast would have gone');

  // Five gaps between six steps, then the last one finishes playing.
  c.update(50_000 + 5 * 400 + 200, HERE, { x: 11, y: 10 });
  assert.equal(c.casts.length, 0);
});

test('facingToward names the side without a target of its own', () => {
  assert.equal(facingToward(HERE, { x: 20, y: 10 }), 'east');
  assert.equal(facingToward(HERE, { x: 0, y: 10 }), 'west');
  assert.equal(facingToward(HERE, { x: 10, y: 20 }), 'south');
  assert.equal(facingToward(HERE, { x: 10, y: 0 }), 'north');
});

// ── anchoring ────────────────────────────────────────────────────────────────

test('a one-tile effect sits on its tile, corner to corner', () => {
  // The tile's top-left, not its centre. Using the centre put every effect
  // half a tile down and to the right of where the client draws it.
  assert.deepEqual(effectSpritePos({ x: 10, y: 20 }, 0, 0), { x: 320, y: 640 });
});

test('a multi-tile effect extends up and to the left of its anchor', () => {
  // `ThingType::draw` composes at `dest - (size - 1) * 32` and blits sprite
  // (cx, cy) at `(size - cx - 1) * 32` inside that. The two cancel to
  // `dest - cx * 32`. Getting the direction backwards mirrors the whole plume
  // about its anchor, which is what put Flamethrower on the wrong side.
  const tile = { x: 10, y: 20 };

  assert.deepEqual(effectSpritePos(tile, 0, 0), { x: 320, y: 640 }, 'sprite zero is the anchor');
  assert.deepEqual(effectSpritePos(tile, 2, 4), { x: 320 - 64, y: 640 - 128 });
});

test('the effects.otml displacement is added and the dat one subtracted', () => {
  // `Effect::draw` does `draw(dest + effectDisplacement)`, and `draw` itself
  // subtracts the dat's own displacement.
  const tile = { x: 0, y: 0 };

  assert.deepEqual(effectSpritePos(tile, 0, 0, { eoff: [33, 4] }), { x: 33, y: 4 });
  assert.deepEqual(effectSpritePos(tile, 0, 0, { off: [8, 8] }), { x: -8, y: -8 });
  assert.deepEqual(
    effectSpritePos(tile, 0, 0, { eoff: [33, 4], off: [8, 8] }),
    { x: 25, y: -4 },
    'both apply, in opposite directions',
  );
});

test('a missile carries a pixel offset along its flight line', () => {
  assert.deepEqual(
    effectSpritePos({ x: 5, y: 5 }, 0, 0, {}, 32, { x: 48, y: -16 }),
    { x: 208, y: 144 },
  );
});

test('the anchor matches how the renderer places creatures', () => {
  // layoutCreatures uses `(localX - cx) * TILE - offX`. An effect that did not
  // agree with that would sit at a different height from the creature casting
  // it, which is exactly the kind of drift that is invisible in code review.
  const tile = { x: 7, y: 3 };
  const off: [number, number] = [4, 6];
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 2], [2, 3]] as const) {
    assert.deepEqual(
      effectSpritePos(tile, cx, cy, { off }),
      { x: (tile.x - cx) * 32 - off[0], y: (tile.y - cy) * 32 - off[1] },
    );
  }
});

// ── reach ────────────────────────────────────────────────────────────────────

test('a move with no range in its script has to be next to the target', () => {
  // Every monster file in this base is `targetDistance = 1`, and a script that
  // names no range of its own is a move you walk up to use.
  assert.equal(MELEE_RANGE, 1);
  assert.equal(inReach(HERE, { x: 11, y: 11 }, undefined), true, 'diagonals are one tile');
  assert.equal(inReach(HERE, { x: 12, y: 10 }, undefined), false);
});

test('nothing reaches further than the engage range, whatever its script says', () => {
  // Acid is written at eight tiles and Absorb at five. Everything fights from
  // the tile beside its target instead — this one is the game's rule, not the
  // base's, though it lands on the same `targetDistance = 1` the monster files
  // all carry.
  assert.equal(ENGAGE_RANGE, 1);
  assert.equal(inReach(HERE, { x: 11, y: 10 }, 8), true, 'next to it, so it fires');
  assert.equal(inReach(HERE, { x: 12, y: 10 }, 8), false, 'two tiles is too far, script or no');
  assert.equal(inReach(HERE, { x: 13, y: 10 }, 5), false);
});

test('the cap only ever shortens', () => {
  // A script that asks for less than the cap keeps its own, shorter reach.
  assert.equal(inReach(HERE, { x: 11, y: 10 }, 1), true);
  assert.equal(inReach(HERE, { x: 12, y: 10 }, 1), false);
});

test('distance is the larger axis, the way the server measures it', () => {
  // One east and one south is one away, not one and a half.
  assert.equal(inReach(HERE, { x: 11, y: 11 }, 8), true);
  assert.equal(inReach(HERE, { x: 11, y: 12 }, 8), false);
});

test('nothing is in reach of nowhere', () => {
  assert.equal(inReach(HERE, null, 8), false);
});

test('a Pokemon out of reach does not attack', () => {
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'melee', power: 3, interval: 1000, chance: 100, element: 'normal' }], 0);
  assert.deepEqual(c.update(900, HERE, FAR), [], 'it is still walking over');
});

test('the cooldown is not burned while out of reach, so arriving attacks at once', () => {
  // The server checks range at the moment of the attack and simply does not
  // attack; making the miss cost a cooldown would leave a Pokemon standing in
  // front of a wild one doing nothing for a full interval.
  const c = new Caster(VISUALS, always);
  c.arm([{ name: 'melee', power: 3, interval: 1000, chance: 100, element: 'normal' }], 0);

  assert.equal(c.update(900, HERE, FAR).length, 0);
  assert.equal(c.update(901, HERE, THERE).length, 1, 'in reach, and due');
});

test('a long-ranged move waits for the same tile a melee one does', () => {
  // Absorb is five tiles in its script and still has to walk up: the cap is
  // what stops a Pokemon fighting from across the clearing.
  const c = new Caster({ absorb: { name: 'Absorb', element: 'grass', range: 5 } }, always);
  const moves = [
    { name: 'Absorb', power: 10, interval: 1000, chance: 100, element: 'grass' },
    { name: 'melee', power: 3, interval: 1000, chance: 100, element: 'normal' },
  ];

  c.arm(moves, 0);
  assert.deepEqual(c.update(2000, HERE, { x: 13, y: 10 }), [], 'three tiles out, nothing fires');

  c.arm(moves, 0);
  const beside = c.update(2000, HERE, THERE).map((cast) => cast.move);
  assert.deepEqual(beside.sort(), ['Absorb', 'melee']);
});
