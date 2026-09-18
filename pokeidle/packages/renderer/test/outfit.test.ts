import test from 'node:test';
import assert from 'node:assert/strict';
import { outfitColor, tintOutfit, type OutfitColors } from '../src/outfit.ts';
import { layoutChunk, DIRECTION, CREATURE_PRIORITY, type AppearanceSet, type Chunk, type FrameGroup } from '../src/layout.ts';

// -- palette ------------------------------------------------------------------

test('colour 0 is white and the palette is deterministic', () => {
  assert.deepEqual(outfitColor(0), [255, 255, 255]);
  assert.deepEqual(outfitColor(43), outfitColor(43));
});

test('every nineteenth index is a grey, and the ramp descends', () => {
  const greys: number[] = [];
  for (let i = 0; i < 7; i++) {
    const [r, g, b] = outfitColor(i * 19);
    assert.equal(r, g, `index ${i * 19} should be grey`);
    assert.equal(g, b, `index ${i * 19} should be grey`);
    greys.push(r);
  }

  for (let i = 1; i < greys.length; i++) {
    assert.ok(greys[i]! < greys[i - 1]!, `grey ramp must descend at step ${i}`);
  }
});

test('hue indices are not grey', () => {
  const [r, g, b] = outfitColor(5);
  assert.ok(r !== g || g !== b, 'a hue index must have colour');
});

test('out-of-range indices fall back to 0 rather than throwing', () => {
  assert.deepEqual(outfitColor(133), outfitColor(0));
  assert.deepEqual(outfitColor(9999), outfitColor(0));
  assert.deepEqual(outfitColor(-1), outfitColor(0));
});

test('the whole palette stays inside byte range', () => {
  for (let i = 0; i < 133; i++) {
    for (const channel of outfitColor(i)) {
      assert.ok(Number.isInteger(channel), `index ${i} produced a non-integer`);
      assert.ok(channel >= 0 && channel <= 255, `index ${i} produced ${channel}`);
    }
  }
});

// -- tinting ------------------------------------------------------------------

const PIXELS = 32 * 32;

function solid(r: number, g: number, b: number, a = 255): Buffer {
  const buf = Buffer.alloc(PIXELS * 4);
  for (let p = 0; p < buf.length; p += 4) {
    buf[p] = r;
    buf[p + 1] = g;
    buf[p + 2] = b;
    buf[p + 3] = a;
  }
  return buf;
}

const COLORS: OutfitColors = [0, 0, 0, 0]; // index 0 is white, so a no-op tint

test('a white tint leaves the base untouched', () => {
  const base = solid(120, 60, 30);
  const mask = solid(255, 255, 0); // all head
  const out = tintOutfit(base, mask, COLORS);
  assert.deepEqual(out.subarray(0, 4), base.subarray(0, 4));
});

test('each marker colour picks its own channel', () => {
  const base = solid(200, 200, 200);
  const colors: OutfitColors = [5, 24, 43, 62];

  const markers: Array<[number, number, number]> = [
    [255, 255, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];

  const results = markers.map((m) => {
    const out = tintOutfit(base, solid(m[0], m[1], m[2]), colors);
    return [out[0], out[1], out[2]];
  });

  // Four different colour indices must give four different results.
  const seen = new Set(results.map((r) => r.join(',')));
  assert.equal(seen.size, 4, `expected four distinct tints, got ${[...seen].join(' | ')}`);
});

test('pixels the mask does not mark are left alone', () => {
  const base = solid(90, 140, 210);
  const mask = solid(1, 2, 3); // not a marker colour
  const out = tintOutfit(base, mask, [5, 5, 5, 5]);
  assert.deepEqual(out, base);
});

test('a transparent base pixel is never tinted', () => {
  const base = solid(200, 100, 50, 0);
  const mask = solid(255, 0, 0);
  const out = tintOutfit(base, mask, [40, 40, 40, 40]);
  assert.deepEqual(out, base);
});

test('a transparent mask pixel leaves the base showing through', () => {
  const base = solid(200, 100, 50, 255);
  const mask = solid(255, 0, 0, 0);
  const out = tintOutfit(base, mask, [40, 40, 40, 40]);
  assert.deepEqual(out, base);
});

test('mismatched buffers are rejected', () => {
  assert.throws(() => tintOutfit(solid(1, 1, 1), Buffer.alloc(8), COLORS), /differ in size/);
});

// -- creature placement -------------------------------------------------------

const group = (over: Partial<FrameGroup> = {}): FrameGroup => ({
  t: 0, w: 1, h: 1, l: 1, px: 4, py: 1, pz: 1, ph: 1, d: null,
  s: [10, 20, 30, 40],
  ...over,
});

const setWith = (creature: FrameGroup): AppearanceSet => ({
  spriteSize: 32,
  atlasSize: 2048,
  sprites: {},
  appearances: { item: {}, creature: { '3328': { groups: [creature], sp: 5 } } },
});

const emptyChunk = (): Chunk => ({ cx: 40, cy: 39, z: 7, size: 64, tiles: [] });

test('a creature faces the direction it is given, not its position', () => {
  const set = setWith(group());
  const at = (direction: number) =>
    layoutChunk(emptyChunk(), set, {
      creatures: [{ x: 2608, y: 2521, z: 7, lookType: 3328, direction }],
    })[0]!.spriteId;

  assert.equal(at(DIRECTION.north), 10);
  assert.equal(at(DIRECTION.east), 20);
  assert.equal(at(DIRECTION.south), 30);
  assert.equal(at(DIRECTION.west), 40);
});

test('a creature lands on its own tile in chunk-local pixels', () => {
  const set = setWith(group());
  const [draw] = layoutChunk(emptyChunk(), set, {
    creatures: [{ x: 2608, y: 2521, z: 7, lookType: 3328 }],
  });

  // chunk origin is 40*64 = 2560, 39*64 = 2496
  assert.equal(draw!.dx, (2608 - 2560) * 32);
  assert.equal(draw!.dy, (2521 - 2496) * 32);
  assert.equal(draw!.priority, CREATURE_PRIORITY);
});

test('creatures outside the chunk or on another floor are skipped', () => {
  const set = setWith(group());
  const draws = layoutChunk(emptyChunk(), set, {
    creatures: [
      { x: 2659, y: 2535, z: 7, lookType: 3328 }, // east of this chunk
      { x: 2608, y: 2521, z: 6, lookType: 3328 }, // another floor
      { x: 2608, y: 2521, z: 7, lookType: 9999 }, // unknown appearance
    ],
  });
  assert.equal(draws.length, 0);
});

test('a mask is only emitted when the appearance actually has one', () => {
  const single = layoutChunk(emptyChunk(), setWith(group({ l: 1 })), {
    creatures: [{ x: 2608, y: 2521, z: 7, lookType: 3328, colors: [1, 2, 3, 4] }],
  });
  assert.equal(single[0]!.maskSpriteId, undefined);

  // With two layers the sprite list interleaves base and mask per cell.
  const masked = layoutChunk(
    emptyChunk(),
    setWith(group({ l: 2, s: [10, 11, 20, 21, 30, 31, 40, 41] })),
    { creatures: [{ x: 2608, y: 2521, z: 7, lookType: 3328, colors: [1, 2, 3, 4] }] },
  );
  assert.equal(masked[0]!.spriteId, 30, 'south-facing base');
  assert.equal(masked[0]!.maskSpriteId, 31, 'south-facing mask');
  assert.deepEqual(masked[0]!.colors, [1, 2, 3, 4]);
});

test('creatures draw above tile contents but keep row ordering', () => {
  const set: AppearanceSet = {
    spriteSize: 32,
    atlasSize: 2048,
    sprites: {},
    appearances: {
      item: { '1': { groups: [{ ...group({ px: 1, s: [7] }) }], sp: 0 } },
      creature: { '3328': { groups: [group()], sp: 5 } },
    },
  };

  const chunk: Chunk = { ...emptyChunk(), tiles: [{ x: 48, y: 25, g: 1 }] };
  const draws = layoutChunk(chunk, set, {
    creatures: [{ x: 2608, y: 2521, z: 7, lookType: 3328 }],
  });

  assert.equal(draws.length, 2);
  assert.equal(draws[0]!.spriteId, 7, 'ground first');
  assert.equal(draws[1]!.priority, CREATURE_PRIORITY, 'creature on top of it');
});
