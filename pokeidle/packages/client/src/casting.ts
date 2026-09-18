/**
 * Moves going off on their own cooldowns.
 *
 * Every move a species knows has a `power`, an `interval` and a `chance`, and
 * the party's damage per second is exactly the sum of `power * chance /
 * interval` across them. The simulation uses that sum and nothing else.
 *
 * This module fires the individual moves on those same intervals, rolling
 * those same chances. It is a view of the number the simulation is already
 * using, not a second combat system: a cast that misses does not reduce the
 * rewards, and a cast that lands does not increase them. Making it authoritative
 * would mean two damage models that agree only until the first offline
 * catch-up folds ten thousand encounters at once.
 *
 * What it buys is that the screen tells the truth about the rhythm. A
 * Charmander whose Ember comes every 5s and whose Fire Blast comes every 30s
 * looks like that, because those are the numbers in the base.
 */

export type MoveSpec = {
  name: string;
  power: number;
  /** Cooldown in milliseconds, from the species script. */
  interval: number;
  /** Percent, 0..100. */
  chance: number;
  element: string;
};

export type Vec = { x: number; y: number };

/** What a move looks like, from `data/scripts/spells`. */
export type MoveVisual = {
  name: string;
  element: string;
  effect?: number;
  missile?: number;
  facing?: Record<string, number>;
  /** Placement relative to the caster, per facing. */
  offsets?: Record<string, Vec>;
  /** Set when the effect steps outward instead of landing once. */
  wave?: { steps: number; intervalMs: number };
  sideEffect?: number;
  range?: number;
  needTarget?: boolean;
};

export type Cast = {
  move: string;
  element: string;
  /** Wall clock the cast went off. */
  at: number;
  effect?: number;
  missile?: number;
  sideEffect?: number;
  from: Vec;
  to: Vec;
  /**
   * Where the effect plays, in tiles.
   *
   * Not always the target. A directional move's script offsets the position
   * off the caster before playing — Flamethrower's plume is three tiles wide
   * and five tall and is pushed clear — and drawing those on the target is
   * what made them look scattered across the field.
   */
  origin: Vec;
  /** Set when the effect walks outward from `origin`, one tile per step. */
  wave?: { steps: number; intervalMs: number; step: Vec };
  /** How long this cast stays on screen, animation and all. */
  duration: number;
};

/** How long a plain cast stays on screen: the effect plays, then it is dropped. */
export const CAST_MS = 900;
/** How long a missile takes to cross to its target. */
export const MISSILE_MS = 260;

type Slot = { move: MoveSpec; nextAt: number };

/**
 * How far a move reaches, when its script does not say.
 *
 * `targetDistance = 1` in every monster file in this base: a Pokemon walks up
 * to its target and hits it from the next tile. A spell script that names its
 * own `range` overrides this — Absorb reaches five tiles, Acid eight — but a
 * move with nothing written down is treated as a move you have to be next to
 * use, which is also where the party walks to anyway.
 */
export const MELEE_RANGE = 1;

/**
 * The furthest anything is thrown, whatever its script says.
 *
 * This one is the game's rule rather than the base's. Some spell scripts reach
 * a long way — Acid and Beat Up are written at eight tiles, Absorb at five —
 * and a Pokemon opening fire from across the clearing reads as though the walk
 * to the target meant nothing.
 *
 * It was three, and measured in a live hunt every cast did land at three tiles
 * or nearer. Three tiles is still most of a screen at this zoom, though, so it
 * is one: the Pokemon walks up and fights from the tile beside its target,
 * which is `targetDistance = 1` in every monster file in this base anyway.
 *
 * A script that reaches less than this still reaches less: the cap only ever
 * shortens.
 */
export const ENGAGE_RANGE = 1;

/**
 * Whether the target is close enough to attack.
 *
 * Distance is measured the way the server measures it: the larger of the two
 * axes, so a diagonal neighbour is one tile away and not one and a half.
 */
export function inReach(
  from: { x: number; y: number },
  to: { x: number; y: number } | null,
  range?: number,
): boolean {
  if (!to) return false;
  const scripted = range === undefined || range <= 0 ? MELEE_RANGE : range;
  const reach = Math.min(scripted, ENGAGE_RANGE);
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) <= reach;
}

export class Caster {
  private slots: Slot[] = [];
  private live: Cast[] = [];
  private readonly visuals: Record<string, MoveVisual>;
  private readonly roll: () => number;
  private readonly playtime: (effectId: number) => number;

  /**
   * `playtime` answers how long one effect takes to play, which only the
   * caller knows — the durations live in the compiled appearance set. Without
   * it a cast is dropped on a fixed timer and an effect whose frames add up to
   * more than that is cut off mid-animation.
   */
  constructor(
    visuals: Record<string, MoveVisual>,
    roll: () => number = Math.random,
    playtime: (effectId: number) => number = () => CAST_MS,
  ) {
    this.visuals = visuals;
    this.roll = roll;
    this.playtime = playtime;
  }

  get casts(): readonly Cast[] {
    return this.live;
  }

  get armed(): boolean {
    return this.slots.length > 0;
  }

  /**
   * Load a move set and stagger the first cast of each.
   *
   * Staggered because every cooldown starting together means the whole set
   * fires on the same frame and then goes quiet — the base's own intervals
   * are already spread out, and starting each one partway in keeps it that
   * way from the first second.
   */
  arm(moves: MoveSpec[], now: number): void {
    this.slots = moves
      .filter((m) => m.interval > 0)
      .map((move, i) => ({
        move,
        nextAt: now + (move.interval * ((i + 1) / (moves.length + 1))),
      }));
    this.live = [];
  }

  disarm(): void {
    this.slots = [];
    this.live = [];
  }

  /**
   * Fire whatever is due, in reach, and drop whatever has finished playing.
   *
   * A move whose chance roll fails still consumes its cooldown, the same way
   * it does in the sum the simulation uses. Being out of reach does not: the
   * server checks the range at the moment of the attack and simply does not
   * attack, so the move goes off as soon as the Pokemon has closed in rather
   * than waiting out another cooldown once it arrives.
   */
  update(now: number, from: { x: number; y: number }, to: { x: number; y: number } | null): Cast[] {
    const fired: Cast[] = [];

    for (const slot of this.slots) {
      if (now < slot.nextAt) continue;

      const visual = this.visuals[slot.move.name.toLowerCase().trim()];
      if (!inReach(from, to, visual?.range)) continue;

      slot.nextAt = now + slot.move.interval;
      if (this.roll() * 100 >= slot.move.chance) continue;

      const aim = to ?? from;
      const cast: Cast = {
        move: visual?.name ?? slot.move.name,
        element: visual?.element || slot.move.element,
        at: now,
        from: { ...from },
        to: { ...aim },
        // Landing on the target is the default; a script with its own
        // placement overrides it below.
        origin: { ...aim },
        duration: CAST_MS,
      };
      if (visual?.effect !== undefined) cast.effect = visual.effect;
      if (visual?.missile !== undefined) cast.missile = visual.missile;
      if (visual?.sideEffect !== undefined) cast.sideEffect = visual.sideEffect;

      // A directional move picks its effect, and its placement, by the side
      // the target is on.
      const side = facingToward(from, aim);
      if (visual?.facing) {
        const id = visual.facing[side];
        if (id !== undefined) cast.effect = id;
      }
      const offset = visual?.offsets?.[side];
      if (offset) {
        cast.origin = { x: from.x + offset.x, y: from.y + offset.y };
        if (visual?.wave) {
          // The offsets of a wave are the unit step it walks, so the first
          // tile is one step out and the rest follow it.
          cast.wave = { ...visual.wave, step: offset };
          cast.origin = { ...from };
        }
      }

      // Long enough for the animation to finish: the missile's flight, the
      // effect's own frames, and for a wave every step of it.
      const play =
        cast.effect !== undefined
          ? Math.max(this.playtime(cast.effect), cast.sideEffect !== undefined
              ? this.playtime(cast.sideEffect)
              : 0)
          : CAST_MS;
      const flight = cast.missile !== undefined ? MISSILE_MS : 0;
      const walk = cast.wave ? (cast.wave.steps - 1) * cast.wave.intervalMs : 0;
      cast.duration = Math.max(CAST_MS, flight + walk + play);

      this.live.push(cast);
      fired.push(cast);
    }

    if (this.live.length) this.live = this.live.filter((c) => now - c.at < c.duration);
    return fired;
  }
}

/** Which side of `from` the point `to` lies on. */
export function facingToward(from: Vec, to: Vec): 'north' | 'east' | 'south' | 'west' {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

/**
 * The tiles a wave is playing on right now, nearest the caster first.
 *
 * Each step lights up `intervalMs` after the one before it and then keeps
 * burning for the rest of the cast, which is how the script's chain of
 * `addEvent` calls reads on screen.
 */
export function waveTiles(cast: Cast, now: number): Vec[] {
  if (!cast.wave) return [];
  const age = now - cast.at;
  const live: Vec[] = [];
  for (let i = 1; i <= cast.wave.steps; i++) {
    if (age < (i - 1) * cast.wave.intervalMs) break;
    live.push({
      x: cast.origin.x + cast.wave.step.x * i,
      y: cast.origin.y + cast.wave.step.y * i,
    });
  }
  return live;
}

/**
 * Where a missile has got to, 0 at the caster and 1 at the target.
 * Past its flight time it sits on the target while the effect plays.
 */
export function missileProgress(cast: Cast, now: number): number {
  const age = now - cast.at;
  return Math.min(1, Math.max(0, age / MISSILE_MS));
}

/**
 * Which animation phase an effect is on.
 *
 * Straight out of `Effect::draw` and `Animator::getPhaseAt`. The client walks
 * the effect's own per-phase durations, subtracting each from the elapsed
 * time until one is longer than what is left; that phase is the current one.
 * When there is no animator it falls back to a flat 75ms a frame, the
 * `EFFECT_TICKS_PER_FRAME` in `effect.h`.
 *
 * Dividing the cast's lifetime evenly across the phases, which is what this
 * used to do, is wrong twice over: an effect whose frames run at 100ms is
 * played at the wrong speed, and one whose total is under the cast length is
 * stretched out instead of finishing and going away.
 *
 * Returns -1 before the effect starts and once it has played out.
 */
export const EFFECT_TICKS_PER_FRAME = 75;

export function effectPhase(
  elapsed: number,
  phases: number,
  durations: number[] | null,
): number {
  if (phases <= 1) return elapsed >= 0 ? 0 : -1;
  if (elapsed < 0) return -1;

  let left = elapsed;
  for (let i = 0; i < phases; i++) {
    const span = durations?.[i] ?? EFFECT_TICKS_PER_FRAME;
    if (left < span) return i;
    left -= span;
  }
  // The animation has finished. The client returns to phase 0 and the effect
  // is removed; here it simply stops being drawn.
  return -1;
}

/** How long one full play of an effect takes, in milliseconds. */
export function effectDuration(phases: number, durations: number[] | null): number {
  if (durations && durations.length) {
    return durations.slice(0, phases).reduce((n, d) => n + d, 0);
  }
  return Math.max(1, phases) * EFFECT_TICKS_PER_FRAME;
}

/**
 * Where one sprite of an effect or missile lands, in world pixels.
 *
 * Lifted out of the draw loop so it can be checked without a canvas, because
 * getting it wrong is not obvious on screen — it just looks like the wrong
 * spell. `ThingType::draw` in the client composes the image at
 *
 *     dest - (size - 1) * 32 - displacement
 *
 * and `getTexture` blits sprite (cx, cy) at `(size - cx - 1, size - cy - 1) * 32`
 * inside it. The two cancel: sprite zero sits on the anchor tile and the rest
 * of a multi-tile appearance extends up and to the left. `Effect::draw` then
 * adds the displacement from `effects.otml` on top.
 *
 * `dest` is the tile's top-left corner. Using its centre put every effect half
 * a tile down and to the right of where the client puts it.
 */
export function effectSpritePos(
  tile: Vec,
  cx: number,
  cy: number,
  meta: { eoff?: [number, number]; off?: [number, number] } = {},
  tileSize = 32,
  pixelOffset: Vec = { x: 0, y: 0 },
): Vec {
  const [offX, offY] = meta.off ?? [0, 0];
  const [eoffX, eoffY] = meta.eoff ?? [0, 0];
  return {
    x: tile.x * tileSize + eoffX - offX + pixelOffset.x - cx * tileSize,
    y: tile.y * tileSize + eoffY - offY + pixelOffset.y - cy * tileSize,
  };
}
