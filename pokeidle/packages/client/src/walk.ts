/**
 * Getting around the map on foot.
 *
 * Three things live here: what counts as walkable, how to find a way to a
 * tile, and how a party trails behind the trainer.
 *
 * Walkability comes from the release, not from guesswork. The packer marks a
 * tile blocked when it has no ground or when anything on it carries the dat's
 * `notWalkable` / `notPathable` flags, which is the same question the desktop
 * client asks. Without it a trainer told to walk to a Pokémon on the far side
 * of a lake walks across the water.
 */

export type Point = { x: number; y: number };

export type GridTile = { x: number; y: number; b?: 1 };
export type GridChunk = { cx: number; cy: number; z: number; size: number; tiles: GridTile[] };

/**
 * Which tiles can be stood on, as a flat lookup.
 *
 * A tile the release never packed is blocked rather than open: off the edge of
 * the cutout there is nothing to draw and nothing to stand on, and treating
 * the unknown as walkable is how a walker wanders into the void.
 */
/** One number per tile: `x` in the high half, `y` in the low. */
const key = (x: number, y: number): number => x * 65536 + y;

export class WalkGrid {
  /**
   * Walkable tiles, keyed by a packed coordinate rather than by `"x,y"`.
   *
   * A release that covers a whole region holds hundreds of thousands of tiles,
   * and a string key for each is a string object each: the map went to a
   * couple of seconds of garbage collection between frames while the frame
   * itself still ran in nine milliseconds. A number key is one word.
   *
   * The map is 65,536 tiles across at most, which is what the shift is sized
   * for; the pair still fits inside a double exactly.
   */
  private readonly open = new Set<number>();

  constructor(chunks: GridChunk[], z: number) {
    for (const chunk of chunks) {
      if (chunk.z !== z) continue;
      for (const tile of chunk.tiles) {
        if (tile.b) continue;
        this.open.add(key(chunk.cx * chunk.size + tile.x, chunk.cy * chunk.size + tile.y));
      }
    }
  }

  get size(): number {
    return this.open.size;
  }

  walkable(x: number, y: number): boolean {
    return this.open.has(key(x, y));
  }

  /** The walkable tile nearest to `at`, searched outward. Null if none is close. */
  nearestOpen(at: Point, radius = 6): Point | null {
    if (this.walkable(at.x, at.y)) return at;
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = at.x + dx;
          const y = at.y + dy;
          if (this.walkable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }
}

const NEIGHBOURS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/**
 * A path from `from` to a tile adjacent to `to`, excluding the start.
 *
 * Adjacent, not onto: the target tile has a Pokémon standing on it. Breadth
 * first over eight directions, capped by `maxNodes` so a target walled off
 * behind a mountain costs a bounded search instead of sweeping the cutout.
 * Returns an empty array when already adjacent, and null when there is no way
 * through within the cap.
 */
export function findPath(
  from: Point,
  to: Point,
  grid: WalkGrid,
  maxNodes = 4000,
): Point[] | null {
  const adjacent = (p: Point) => Math.max(Math.abs(p.x - to.x), Math.abs(p.y - to.y)) <= 1;
  if (adjacent(from)) return [];

  // Numbers, not strings: a search visits thousands of nodes several times a
  // second, and every string key is one more object for the collector.
  const cameFrom = new Map<number, number>();
  // A read cursor rather than `shift()`: shifting an array is O(length), which
  // turned a 4,000-node search into tens of millions of operations and dropped
  // the whole page to one frame a second.
  const queue: Point[] = [from];
  let head = 0;
  const seen = new Set<number>([key(from.x, from.y)]);

  while (head < queue.length) {
    const current = queue[head++]!;
    if (head > maxNodes) return null;

    for (const step of NEIGHBOURS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const k = key(next.x, next.y);
      if (seen.has(k)) continue;
      if (!grid.walkable(next.x, next.y)) continue;

      seen.add(k);
      cameFrom.set(k, key(current.x, current.y));

      if (adjacent(next)) {
        // Walk the parents back and hand the path out head first.
        const path: Point[] = [];
        const start = key(from.x, from.y);
        let cursor: number | undefined = k;
        while (cursor !== undefined && cursor !== start) {
          path.push({ x: Math.floor(cursor / 65536), y: cursor % 65536 });
          cursor = cameFrom.get(cursor);
        }
        return path.reverse();
      }

      queue.push(next);
    }
  }

  return null;
}

/**
 * The trail the party walks in.
 *
 * Followers do not path on their own: they step where the trainer already
 * stepped. That is how the games do it, it keeps the line orderly through a
 * one-tile gap, and it makes every follower position walkable by construction
 * — it was walked a moment ago.
 */
export class Trail {
  private readonly tiles: Point[] = [];
  private readonly capacity: number;

  constructor(start: Point, capacity = 24) {
    this.capacity = Math.max(2, capacity);
    this.tiles.push({ ...start });
  }

  /** Record the leader arriving on a tile. Repeats of the head are ignored. */
  push(at: Point): void {
    const head = this.tiles[0]!;
    if (head.x === at.x && head.y === at.y) return;
    this.tiles.unshift({ ...at });
    if (this.tiles.length > this.capacity) this.tiles.length = this.capacity;
  }

  /** Where follower `index` stands: `spacing` tiles back along the trail. */
  follower(index: number, spacing = 1): Point {
    const back = Math.min(this.tiles.length - 1, (index + 1) * spacing);
    return this.tiles[back]!;
  }

  reset(at: Point): void {
    this.tiles.length = 0;
    this.tiles.push({ ...at });
  }
}

/**
 * How long one step takes, from the server's own formula.
 *
 * `Creature::getStepDuration` in servidor/src/creature.cpp:
 *
 *     calculated = floor(speedA * ln(stepSpeed / 2 + speedB) + speedC + 0.5)
 *     duration   = floor(1000 * groundSpeed / calculated)
 *
 * with speedA 857.36, speedB 261.29, speedC -4795.01 and a ground speed of 150
 * where the tile does not say otherwise. Logarithmic, so doubling a Pokemon's
 * speed does not halve its step: 180 walks a tile in 652ms and 220 in 539ms.
 * A diagonal step costs three times as much, which is the same rule the
 * server applies.
 *
 * Written out rather than approximated because a made-up curve would drift
 * from the base at exactly the speeds that are not the common one.
 */
const SPEED_A = 857.36;
const SPEED_B = 261.29;
const SPEED_C = -4795.01;
const GROUND_SPEED = 150;

export function stepDurationMs(speed: number, diagonal = false): number {
  const stepSpeed = Math.max(0, speed);
  const calculated =
    stepSpeed > -SPEED_B
      ? Math.max(1, Math.floor(SPEED_A * Math.log(stepSpeed / 2 + SPEED_B) + SPEED_C + 0.5))
      : 1;
  const duration = Math.floor((1000 * GROUND_SPEED) / calculated);
  return diagonal ? duration * 3 : duration;
}

/**
 * A step in progress, for drawing.
 *
 * `Creature::updateWalk` in the client moves the creature's tile the moment
 * the step begins and then draws it with an offset that starts a whole tile
 * back and decays to zero across the step's duration. Without that the sprite
 * teleports a tile at a time — which is exactly what a Pokemon "jumping
 * squares" looks like.
 */
export type Stride = {
  /** Direction moved, one of -1, 0, 1 on each axis. */
  dx: number;
  dy: number;
  startedAt: number;
  ms: number;
};

/**
 * Pixels to shift a creature that is mid-step.
 *
 * Points back the way it came and shrinks to nothing as it arrives, which is
 * `updateWalkOffset`: `walked - 32` going east, `32 - walked` going west.
 */
export function strideOffset(stride: Stride | null, now: number, tile = 32): Point {
  if (!stride || stride.ms <= 0) return { x: 0, y: 0 };
  const progress = Math.min(1, Math.max(0, (now - stride.startedAt) / stride.ms));
  const left = (1 - progress) * tile;
  // `|| 0` folds negative zero away: it draws the same but compares unequal,
  // which turns a finished step into a surprise in anything that checks it.
  return { x: -stride.dx * left || 0, y: -stride.dy * left || 0 };
}

/** True once the step has finished and the creature is standing still again. */
export function strideDone(stride: Stride | null, now: number): boolean {
  return !stride || now - stride.startedAt >= stride.ms;
}

/**
 * Which frame of the walk cycle to draw.
 *
 * The client spreads the moving group's phases across one step
 * (`updateWalkAnimation`), so the legs keep pace with the ground rather than
 * running at some fixed rate. Phase 0 is the standing frame, so a walking
 * creature cycles through the rest.
 */
export function walkPhase(stride: Stride | null, now: number, phases: number): number {
  if (!stride || phases <= 1) return 0;
  const progress = Math.min(1, Math.max(0, (now - stride.startedAt) / Math.max(1, stride.ms)));
  return 1 + (Math.floor(progress * (phases - 1)) % (phases - 1));
}

/**
 * Walk a path over time.
 *
 * Held apart from the field and the run because it is the one part of a hunt
 * that is pure presentation: how fast a sprite crosses a tile changes nothing
 * about what the simulation pays out.
 */
export class Walker {
  private path: Point[] = [];
  private nextStepAt = 0;
  private at: Point | null = null;
  private msPerTile: number;

  /** `speed` is the creature's own, in the base's units. */
  constructor(speed = 180) {
    this.msPerTile = stepDurationMs(speed);
  }

  /** A party whose lead has changed walks at the new one's pace. */
  setSpeed(speed: number): void {
    this.msPerTile = stepDurationMs(speed);
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  follow(path: Point[], now: number, from?: Point): void {
    this.path = path;
    this.at = from ?? null;
    this.nextStepAt = now + this.cost(path[0]);
  }

  stop(): void {
    this.path = [];
    this.at = null;
  }

  /** A diagonal step costs three times a straight one, as on the server. */
  private cost(next?: Point): number {
    if (!next || !this.at) return this.msPerTile;
    const diagonal = next.x !== this.at.x && next.y !== this.at.y;
    return diagonal ? this.msPerTile * 3 : this.msPerTile;
  }

  /** The tile to move onto now, or null if it is not time yet or there is none. */
  step(now: number): Point | null {
    if (!this.path.length || now < this.nextStepAt) return null;
    const next = this.path.shift() ?? null;
    this.at = next;
    this.nextStepAt = now + this.cost(this.path[0]);
    return next;
  }
}
