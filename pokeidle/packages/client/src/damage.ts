/**
 * Damage numbers that float off whoever was hit.
 *
 * ## The numbers are the simulation's, not decoration
 *
 * `movesetDps` sums `power * chance / interval` over a Pokemon's moves and
 * scales it by level, so in that model one landed move is worth `power` times
 * the level — that is the per-hit number, derived from the same server data
 * the kill rate comes from rather than invented for the screen.
 *
 * Damage taken is read straight off the run: the hunt owns party health, and
 * the drop between one tick and the next is exactly what the encounter cost.
 *
 * The wild Pokemon's health bar still drains on the run's own clock rather
 * than on these numbers — the simulation pays out whether or not anything is
 * on screen, the same way the walk to the target is a picture of the log and
 * not the log itself.
 */

/** What one landed move takes off, in the simulation's own terms. */
export function hitDamage(power: number, level: number): number {
  return Math.max(1, Math.round(Math.max(0, power) * Math.max(1, Math.floor(level))));
}

export type FloaterKind = 'dealt' | 'taken' | 'heal';

export type Floater = {
  at: number;
  /** World tile it starts over. */
  x: number;
  y: number;
  amount: number;
  kind: FloaterKind;
  /** Nudged sideways so two hits on the same tile do not overlap exactly. */
  drift: number;
};

/** How long a number stays up. Long enough to read, short enough not to pile. */
export const FLOAT_MS = 850;
/** How far it rises over that time, in pixels. */
export const FLOAT_RISE = 22;
/** Beyond this many at once the oldest go, so a fast fight cannot flood. */
export const MAX_FLOATERS = 24;
/** Solid until this far through its life, then fading. */
const FADE_FROM = 0.66;

/**
 * The numbers currently in the air.
 *
 * Kept as a list rather than as DOM nodes because they are drawn in the world,
 * where a tile is a tile: a label anchored to the page would slide off the
 * Pokemon it belongs to the moment the camera moved.
 */
export class Floaters {
  private live: Floater[] = [];
  private seq = 0;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  get all(): readonly Floater[] {
    return this.live;
  }

  push(now: number, x: number, y: number, amount: number, kind: FloaterKind): void {
    if (!Number.isFinite(amount) || amount <= 0) return;

    // Alternate the drift so a stream of hits fans out instead of stacking.
    const side = this.seq++ % 2 === 0 ? 1 : -1;
    this.live.push({
      at: now,
      x,
      y,
      amount: Math.round(amount),
      kind,
      drift: side * (4 + this.random() * 7),
    });

    if (this.live.length > MAX_FLOATERS) this.live.splice(0, this.live.length - MAX_FLOATERS);
  }

  /** Drop whatever has finished rising. */
  update(now: number): void {
    if (!this.live.length) return;
    this.live = this.live.filter((f) => now - f.at < FLOAT_MS);
  }

  clear(): void {
    this.live = [];
  }
}

/**
 * Where a number sits and how solid it is, at this moment.
 *
 * It rises the whole way and only starts fading over the last third, so it is
 * readable for most of its life instead of ghostly from the start.
 */
export function floaterAt(floater: Floater, now: number): { dx: number; dy: number; alpha: number } {
  const age = Math.min(Math.max(0, now - floater.at), FLOAT_MS);
  const share = age / FLOAT_MS;
  return {
    // `|| 0` folds the negative zero a share of zero produces, which is the
    // same number but not the same value to a test or to a comparison.
    dx: floater.drift * share || 0,
    dy: -FLOAT_RISE * share || 0,
    // Counted down from what is left rather than up from what has passed, so
    // the last frame is exactly zero instead of a hair above it.
    alpha: share < FADE_FROM ? 1 : Math.min(1, Math.max(0, (1 - share) / (1 - FADE_FROM))),
  };
}
