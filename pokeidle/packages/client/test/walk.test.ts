import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WalkGrid,
  findPath,
  Trail,
  Walker,
  stepDurationMs,
  strideOffset,
  strideDone,
  walkPhase,
  type Stride,
  type GridChunk,
} from '../src/walk.ts';

/**
 * Build a grid from an ASCII map, so the shape under test is readable.
 * `.` walkable, `#` blocked, and anything outside the rows is unpacked.
 */
function grid(rows: string[], z = 7): WalkGrid {
  const tiles = [];
  for (const [y, row] of rows.entries()) {
    for (const [x, ch] of [...row].entries()) {
      tiles.push(ch === '#' ? { x, y, b: 1 as const } : { x, y });
    }
  }
  const chunk: GridChunk = { cx: 0, cy: 0, z, size: 64, tiles };
  return new WalkGrid([chunk], z);
}

test('a blocked tile is not walkable and a packed one is', () => {
  const g = grid(['..#', '...']);
  assert.equal(g.walkable(0, 0), true);
  assert.equal(g.walkable(2, 0), false);
  assert.equal(g.size, 5);
});

test('a tile the release never packed is blocked, not open', () => {
  // Off the edge of the cutout there is nothing to draw and nothing to stand
  // on; treating the unknown as walkable walks the trainer into the void.
  const g = grid(['..', '..']);
  assert.equal(g.walkable(9, 9), false);
  assert.equal(g.walkable(-1, 0), false);
});

test('only the requested floor is collected', () => {
  const chunks: GridChunk[] = [
    { cx: 0, cy: 0, z: 7, size: 64, tiles: [{ x: 1, y: 1 }] },
    { cx: 0, cy: 0, z: 6, size: 64, tiles: [{ x: 2, y: 2 }] },
  ];
  const g = new WalkGrid(chunks, 7);
  assert.equal(g.walkable(1, 1), true);
  assert.equal(g.walkable(2, 2), false);
});

test('chunk coordinates are offset by the chunk origin', () => {
  const chunks: GridChunk[] = [{ cx: 2, cy: 3, z: 7, size: 64, tiles: [{ x: 5, y: 6 }] }];
  const g = new WalkGrid(chunks, 7);
  assert.equal(g.walkable(2 * 64 + 5, 3 * 64 + 6), true);
  assert.equal(g.walkable(5, 6), false);
});

test('nearestOpen finds a landing tile beside a blocked one', () => {
  const g = grid(['.#.', '...']);
  assert.deepEqual(g.nearestOpen({ x: 1, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(g.nearestOpen({ x: 0, y: 1 }), { x: 0, y: 1 }, 'already open');
});

test('nearestOpen gives up rather than searching forever', () => {
  const g = grid(['###', '###']);
  assert.equal(g.nearestOpen({ x: 1, y: 1 }, 3), null);
});

// ── paths ────────────────────────────────────────────────────────────────────

test('being next to the target is already there', () => {
  const g = grid(['...', '...']);
  assert.deepEqual(findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, g), []);
});

test('a path stops adjacent to the target, never on it', () => {
  const g = grid(['.....', '.....']);
  const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, g)!;

  assert.ok(path.length > 0);
  const last = path.at(-1)!;
  assert.ok(
    Math.max(Math.abs(last.x - 4), Math.abs(last.y - 0)) === 1,
    `ended at ${last.x},${last.y}, which is not adjacent`,
  );
  assert.ok(!path.some((p) => p.x === 4 && p.y === 0), 'never steps onto the target');
});

test('a path goes around a wall instead of through it', () => {
  const g = grid([
    '..#..',
    '..#..',
    '.....',
  ]);
  const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, g)!;

  assert.ok(path.length > 0);
  assert.ok(!path.some((p) => p.x === 2 && p.y < 2), 'the wall is not crossed');
  for (const p of path) assert.ok(g.walkable(p.x, p.y), `stepped on ${p.x},${p.y}`);
});

test('every step of a path is one tile from the last', () => {
  const g = grid(['.....', '..#..', '.....']);
  const from = { x: 0, y: 0 };
  const path = findPath(from, { x: 4, y: 2 }, g)!;

  let prev = from;
  for (const p of path) {
    const d = Math.max(Math.abs(p.x - prev.x), Math.abs(p.y - prev.y));
    assert.equal(d, 1, `jumped from ${prev.x},${prev.y} to ${p.x},${p.y}`);
    prev = p;
  }
});

test('a target walled off completely has no path', () => {
  const g = grid([
    '.#.',
    '.#.',
    '.#.',
  ]);
  assert.equal(findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, g), null);
});

test('the search is capped rather than sweeping the whole cutout', () => {
  const rows = Array.from({ length: 40 }, () => '.'.repeat(40));
  const g = grid(rows);
  assert.equal(findPath({ x: 0, y: 0 }, { x: 39, y: 39 }, g, 5), null);
  assert.ok(findPath({ x: 0, y: 0 }, { x: 39, y: 39 }, g, 4000));
});

// ── trail ────────────────────────────────────────────────────────────────────

test('followers stand where the leader already stood', () => {
  const trail = new Trail({ x: 0, y: 0 });
  trail.push({ x: 1, y: 0 });
  trail.push({ x: 2, y: 0 });
  trail.push({ x: 3, y: 0 });

  assert.deepEqual(trail.follower(0), { x: 2, y: 0 });
  assert.deepEqual(trail.follower(1), { x: 1, y: 0 });
  assert.deepEqual(trail.follower(2), { x: 0, y: 0 });
});

test('a follower with no trail behind it stacks on the oldest tile', () => {
  const trail = new Trail({ x: 5, y: 5 });
  assert.deepEqual(trail.follower(0), { x: 5, y: 5 });
  assert.deepEqual(trail.follower(9), { x: 5, y: 5 });
});

test('standing still does not fill the trail with the same tile', () => {
  const trail = new Trail({ x: 0, y: 0 });
  for (let i = 0; i < 10; i++) trail.push({ x: 0, y: 0 });
  trail.push({ x: 1, y: 0 });
  assert.deepEqual(trail.follower(0), { x: 0, y: 0 });
});

test('the trail forgets tiles past its capacity', () => {
  const trail = new Trail({ x: 0, y: 0 }, 3);
  for (let x = 1; x <= 10; x++) trail.push({ x, y: 0 });
  // Head is 10; only three tiles are kept, so the furthest back is 8.
  assert.deepEqual(trail.follower(0), { x: 9, y: 0 });
  assert.deepEqual(trail.follower(5), { x: 8, y: 0 });
});

test('resetting the trail drops the whole line onto one tile', () => {
  const trail = new Trail({ x: 0, y: 0 });
  trail.push({ x: 1, y: 0 });
  trail.reset({ x: 50, y: 50 });
  assert.deepEqual(trail.follower(0), { x: 50, y: 50 });
});

// ── walker ───────────────────────────────────────────────────────────────────

test('a walker takes one tile per interval and no more', () => {
  // Speed 220 is what a wild Bellsprout roams at: 539ms a tile.
  const step = stepDurationMs(220);
  const walker = new Walker(220);
  walker.follow([{ x: 1, y: 0 }, { x: 2, y: 0 }], 1000, { x: 0, y: 0 });

  assert.equal(walker.step(1000 + step - 1), null, 'too early');
  assert.deepEqual(walker.step(1000 + step), { x: 1, y: 0 });
  assert.equal(walker.step(1000 + step), null, 'one step per interval');
  assert.deepEqual(walker.step(1000 + step * 2), { x: 2, y: 0 });
  assert.equal(walker.step(9_999_999), null, 'the path is spent');
  assert.equal(walker.walking, false);
});

test('a diagonal step costs three times a straight one', () => {
  // `Creature::getStepDuration(dir)` multiplies by three on the diagonal, and
  // a line that ignored it would cut corners faster than the server allows.
  const step = stepDurationMs(220);
  const walker = new Walker(220);
  walker.follow([{ x: 1, y: 1 }], 0, { x: 0, y: 0 });

  assert.equal(walker.step(step * 2), null, 'a diagonal is not due yet');
  assert.deepEqual(walker.step(step * 3), { x: 1, y: 1 });
});

test('a walker told nothing about where it starts assumes a straight step', () => {
  const step = stepDurationMs(220);
  const walker = new Walker(220);
  walker.follow([{ x: 1, y: 1 }], 0);
  assert.deepEqual(walker.step(step), { x: 1, y: 1 });
});

test('changing the lead changes the pace', () => {
  const walker = new Walker(180);
  walker.setSpeed(400);
  walker.follow([{ x: 1, y: 0 }], 0, { x: 0, y: 0 });
  assert.deepEqual(walker.step(stepDurationMs(400)), { x: 1, y: 0 });
});

// ── step duration ────────────────────────────────────────────────────────────

test('step duration follows the server formula, not a made-up curve', () => {
  // Creature::getStepDuration —
  //   calculated = floor(857.36 * ln(speed/2 + 261.29) - 4795.01 + 0.5)
  //   duration   = floor(1000 * 150 / calculated)
  const expected = (speed: number) =>
    Math.floor(
      (1000 * 150) /
        Math.max(1, Math.floor(857.36 * Math.log(speed / 2 + 261.29) - 4795.01 + 0.5)),
    );

  for (const speed of [100, 180, 220, 400, 1000]) {
    assert.equal(stepDurationMs(speed), expected(speed), `speed ${speed}`);
  }
});

test('speed scales logarithmically, so faster is not proportionally faster', () => {
  // Doubling 180 to 360 does not halve the step; it is a log curve, and a
  // linear stand-in would be wrong everywhere except at one point.
  const slow = stepDurationMs(180);
  const fast = stepDurationMs(360);
  assert.ok(fast < slow);
  assert.ok(fast > slow / 2, `${fast} is faster than a linear curve would give`);
});

test('a diagonal step duration is exactly three straight ones', () => {
  assert.equal(stepDurationMs(220, true), stepDurationMs(220) * 3);
});

test('a walker with no path is not walking', () => {
  const walker = new Walker();
  assert.equal(walker.walking, false);
  assert.equal(walker.step(1000), null);
});

test('stopping abandons the rest of the path', () => {
  const walker = new Walker(220);
  walker.follow([{ x: 1, y: 0 }, { x: 2, y: 0 }], 1000);
  walker.stop();
  assert.equal(walker.walking, false);
  assert.equal(walker.step(2000), null);
});

// ── strides ──────────────────────────────────────────────────────────────────

test('a stride slides the sprite back towards where it came from', () => {
  // `updateWalkOffset`: a whole tile back at the start, nothing on arrival.
  const east: Stride = { dx: 1, dy: 0, startedAt: 1000, ms: 500 };

  assert.deepEqual(strideOffset(east, 1000), { x: -32, y: 0 }, 'starts on the old tile');
  assert.deepEqual(strideOffset(east, 1250), { x: -16, y: 0 }, 'halfway');
  assert.deepEqual(strideOffset(east, 1500), { x: 0, y: 0 }, 'arrived');
});

test('a stride points the other way going west, and up going north', () => {
  assert.deepEqual(strideOffset({ dx: -1, dy: 0, startedAt: 0, ms: 100 }, 0), { x: 32, y: 0 });
  assert.deepEqual(strideOffset({ dx: 0, dy: -1, startedAt: 0, ms: 100 }, 0), { x: 0, y: 32 });
  assert.deepEqual(strideOffset({ dx: 0, dy: 1, startedAt: 0, ms: 100 }, 0), { x: 0, y: -32 });
});

test('a diagonal stride slides on both axes at once', () => {
  assert.deepEqual(strideOffset({ dx: 1, dy: 1, startedAt: 0, ms: 100 }, 50), { x: -16, y: -16 });
});

test('nothing to slide when there is no stride, or it is over', () => {
  assert.deepEqual(strideOffset(null, 1234), { x: 0, y: 0 });
  assert.deepEqual(strideOffset({ dx: 1, dy: 0, startedAt: 0, ms: 100 }, 9999), { x: 0, y: 0 });
});

test('a zero-length stride does not divide by zero', () => {
  assert.deepEqual(strideOffset({ dx: 1, dy: 0, startedAt: 0, ms: 0 }, 0), { x: 0, y: 0 });
});

test('strideDone says when the creature is standing still again', () => {
  const s: Stride = { dx: 1, dy: 0, startedAt: 1000, ms: 500 };
  assert.equal(strideDone(s, 1499), false);
  assert.equal(strideDone(s, 1500), true);
  assert.equal(strideDone(null, 0), true, 'a creature with no step is not walking');
});

test('the walk cycle skips the standing frame and loops the rest', () => {
  // Phase 0 is standing; a walking creature runs 1..phases-1 across its step.
  const s: Stride = { dx: 1, dy: 0, startedAt: 0, ms: 400 };
  const frames = [0, 100, 200, 300, 399].map((t) => walkPhase(s, t, 4));

  assert.ok(frames.every((f) => f >= 1 && f <= 3), `got ${frames.join(',')}`);
  assert.ok(new Set(frames).size > 1, 'the legs never moved');
});

test('a creature with one frame has no walk cycle to run', () => {
  assert.equal(walkPhase({ dx: 1, dy: 0, startedAt: 0, ms: 400 }, 200, 1), 0);
  assert.equal(walkPhase(null, 200, 4), 0);
});
