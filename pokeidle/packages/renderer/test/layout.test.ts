import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutChunk,
  layoutCreatures,
  patternFor,
  spriteIndex,
  TILE,
  type Appearance,
  type AppearanceSet,
  type Chunk,
  type FrameGroup,
} from '../src/layout.ts';

const group = (over: Partial<FrameGroup> = {}): FrameGroup => ({
  t: 0,
  w: 1,
  h: 1,
  l: 1,
  px: 1,
  py: 1,
  pz: 1,
  ph: 1,
  d: null,
  s: [1],
  ...over,
});

const appearance = (over: Partial<Appearance> = {}): Appearance => ({
  groups: [group()],
  sp: 5,
  ...over,
});

const setOf = (items: Record<string, Appearance>): AppearanceSet => ({
  spriteSize: 32,
  atlasSize: 2048,
  sprites: {},
  appearances: { item: items },
});

const chunkOf = (tiles: Chunk['tiles'], over: Partial<Chunk> = {}): Chunk => ({
  cx: 0,
  cy: 0,
  z: 7,
  size: 64,
  tiles,
  ...over,
});

test('patterns cycle on absolute position, not chunk-local position', () => {
  const g = group({ px: 4, py: 2, pz: 1 });

  assert.deepEqual(patternFor(g, 8, 4, 7), { px: 0, py: 0, pz: 0 });
  assert.deepEqual(patternFor(g, 9, 5, 7), { px: 1, py: 1, pz: 0 });
  assert.deepEqual(patternFor(g, 11, 4, 7), { px: 3, py: 0, pz: 0 });

  // Tile 0 of chunk 1 is absolute 64, which must not restart the pattern
  // at the same variant as absolute 0 unless the maths says so.
  assert.equal(patternFor(g, 64, 0, 7).px, 0);
  assert.equal(patternFor(g, 66, 0, 7).px, 2);
});

test('sprite index walks the group the same way the client does', () => {
  const g = group({ w: 2, h: 2, l: 1, px: 4, py: 1, pz: 1, ph: 3, s: new Array(48).fill(0) });

  assert.equal(spriteIndex(g, { layer: 0, px: 0, py: 0, pz: 0, phase: 0, cx: 0, cy: 0 }), 0);
  assert.equal(spriteIndex(g, { layer: 0, px: 0, py: 0, pz: 0, phase: 0, cx: 1, cy: 0 }), 1);
  assert.equal(spriteIndex(g, { layer: 0, px: 0, py: 0, pz: 0, phase: 0, cx: 0, cy: 1 }), 2);
  assert.equal(spriteIndex(g, { layer: 0, px: 1, py: 0, pz: 0, phase: 0, cx: 0, cy: 0 }), 4);
  assert.equal(spriteIndex(g, { layer: 0, px: 0, py: 0, pz: 0, phase: 1, cx: 0, cy: 0 }), 16);
});

test('ground draws before borders, which draw before loose items', () => {
  const set = setOf({
    '1': appearance({ sp: 0, groups: [group({ s: [11] })] }),
    '2': appearance({ sp: 1, groups: [group({ s: [22] })] }),
    '3': appearance({ sp: 5, groups: [group({ s: [33] })] }),
  });

  // Stored deliberately out of order: the loose item comes first in the file.
  const draws = layoutChunk(chunkOf([{ x: 0, y: 0, g: 1, i: [3, 2] }]), set);

  assert.deepEqual(draws.map((d) => d.spriteId), [11, 22, 33]);
});

test('two things at the same priority keep the order the map stored them in', () => {
  const set = setOf({
    '1': appearance({ sp: 5, groups: [group({ s: [10] })] }),
    '2': appearance({ sp: 5, groups: [group({ s: [20] })] }),
  });

  const draws = layoutChunk(chunkOf([{ x: 0, y: 0, i: [2, 1] }]), set);
  assert.deepEqual(draws.map((d) => d.spriteId), [20, 10]);
});

test('southern tiles draw after northern ones so overhangs overlap correctly', () => {
  const set = setOf({ '1': appearance({ groups: [group({ s: [7] })] }) });

  const draws = layoutChunk(
    chunkOf([
      { x: 0, y: 5, g: 1 },
      { x: 0, y: 1, g: 1 },
      { x: 0, y: 3, g: 1 },
    ]),
    set,
  );

  assert.deepEqual(draws.map((d) => d.dy / TILE), [1, 3, 5]);
});

test('a multi-tile appearance anchors at its bottom-right cell', () => {
  // 2x2 with distinct sprite per cell.
  const set = setOf({
    '1': appearance({ groups: [group({ w: 2, h: 2, s: [1, 2, 3, 4] })] }),
  });

  const draws = layoutChunk(chunkOf([{ x: 10, y: 10, g: 1 }]), set);
  const at = (id: number) => draws.find((d) => d.spriteId === id)!;

  // Cell (0,0) sits on the tile itself; the rest extend north and west.
  assert.deepEqual([at(1).dx, at(1).dy], [10 * TILE, 10 * TILE]);
  assert.deepEqual([at(2).dx, at(2).dy], [9 * TILE, 10 * TILE]);
  assert.deepEqual([at(3).dx, at(3).dy], [10 * TILE, 9 * TILE]);
  assert.deepEqual([at(4).dx, at(4).dy], [9 * TILE, 9 * TILE]);
});

test('displacement shifts a sprite up and left', () => {
  const set = setOf({ '1': appearance({ off: [8, 16], groups: [group({ s: [5] })] }) });
  const [draw] = layoutChunk(chunkOf([{ x: 2, y: 3, g: 1 }]), set);

  assert.equal(draw!.dx, 2 * TILE - 8);
  assert.equal(draw!.dy, 3 * TILE - 16);
});

test('elevation raises the things stacked above it, not the thing itself', () => {
  const set = setOf({
    '1': appearance({ sp: 0, elev: 0, groups: [group({ s: [1] })] }),
    '2': appearance({ sp: 2, elev: 8, groups: [group({ s: [2] })] }),
    '3': appearance({ sp: 5, groups: [group({ s: [3] })] }),
  });

  const draws = layoutChunk(chunkOf([{ x: 0, y: 0, g: 1, i: [2, 3] }]), set);
  const at = (id: number) => draws.find((d) => d.spriteId === id)!;

  assert.equal(at(1).dy, 0, 'ground is unaffected');
  assert.equal(at(2).dy, 0, 'the elevating item sits at its own height');
  assert.equal(at(3).dy, -8, 'the item above it is lifted');
});

test('unknown ids and blank sprites are skipped, not drawn as holes', () => {
  const set = setOf({
    '1': appearance({ groups: [group({ s: [0] })] }), // blank sprite slot
  });

  const draws = layoutChunk(chunkOf([{ x: 0, y: 0, g: 1, i: [999] }]), set);
  assert.equal(draws.length, 0);
});

test('an empty chunk produces an empty draw list rather than throwing', () => {
  assert.deepEqual(layoutChunk(chunkOf([]), setOf({})), []);
});

// ── walking creatures ────────────────────────────────────────────────────────

/** A creature set: one idle frame group and one four-phase walking group. */
const creatureSet = (): AppearanceSet => ({
  spriteSize: 32,
  atlasSize: 2048,
  sprites: {},
  appearances: {
    item: {},
    creature: {
      '55': {
        groups: [
          group({ s: [10] }),
          group({ ph: 4, s: [20, 21, 22, 23] }),
        ],
        sp: 5,
      },
    },
  },
});

test('a creature with no offset is drawn on its tile', () => {
  const draws = layoutCreatures(chunkOf([]), creatureSet(), [
    { x: 3, y: 4, z: 7, lookType: 55 },
  ]);
  assert.equal(draws.length, 1);
  assert.deepEqual([draws[0]!.dx, draws[0]!.dy], [3 * TILE, 4 * TILE]);
});

test('a creature part-way through a step is drawn short of its tile', () => {
  // This is what stops a Pokemon teleporting one square at a time: the tile
  // moves as the step begins, and the sprite is drawn back where it came from
  // until it arrives.
  const draws = layoutCreatures(chunkOf([]), creatureSet(), [
    { x: 3, y: 4, z: 7, lookType: 55, ox: -16, oy: 0 },
  ]);
  assert.deepEqual([draws[0]!.dx, draws[0]!.dy], [3 * TILE - 16, 4 * TILE]);
});

test('the offset applies on both axes for a diagonal step', () => {
  const draws = layoutCreatures(chunkOf([]), creatureSet(), [
    { x: 3, y: 4, z: 7, lookType: 55, ox: -8, oy: -8 },
  ]);
  assert.deepEqual([draws[0]!.dx, draws[0]!.dy], [3 * TILE - 8, 4 * TILE - 8]);
});

test('a walking creature runs its own frame, not the world clock', () => {
  const walking = layoutCreatures(
    chunkOf([]),
    creatureSet(),
    [{ x: 0, y: 0, z: 7, lookType: 55, group: 1, phase: 2 }],
    // The shared phase would pick a different frame; the creature's own wins.
    0,
  );
  assert.equal(walking[0]!.spriteId, 22);
});

test('without a phase of its own a creature follows the shared one', () => {
  const draws = layoutCreatures(
    chunkOf([]),
    creatureSet(),
    [{ x: 0, y: 0, z: 7, lookType: 55, group: 1 }],
    3,
  );
  assert.equal(draws[0]!.spriteId, 23);
});

test('an out-of-range phase wraps rather than drawing nothing', () => {
  const draws = layoutCreatures(
    chunkOf([]),
    creatureSet(),
    [{ x: 0, y: 0, z: 7, lookType: 55, group: 1, phase: 9 }],
  );
  assert.equal(draws[0]!.spriteId, 21, '9 % 4 is 1');
});
