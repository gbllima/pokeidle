/**
 * The hunt as it looks on the map.
 *
 * The simulation already decides everything that matters — how often an
 * encounter resolves, what it drops, whether it is caught. This module does
 * not re-decide any of it. It takes the run's own clock and the log lines a
 * tick produces and turns them into things to draw: which wild Pokémon is
 * being fought, how far along that fight is, which ones just died, and when
 * they come back.
 *
 * Keeping it downstream is the whole point. A field that rolled its own
 * damage would drift from the rewards the player is actually being paid, and
 * the drift would grow with every offline catch-up.
 */

import type { Stride } from './walk.ts';

export type WildSpawn = {
  name: string;
  x: number;
  y: number;
  z: number;
  look: number;
  species?: string;
  respawn?: number;
  /** How far it may stray from this point, from the spawn block. */
  radius?: number;
  /** `pokemon.wild.speed`, in the base's units. */
  speed?: number;
  /**
   * Whether `look` draws this species in this client's sprite pack. False
   * means the map draws its artwork instead — the looktype in the monster
   * script belongs to a different build.
   */
  spriteOk?: boolean;
};

export type FieldTarget = {
  /** Stable across respawns and across roaming: the spawn point, not a place. */
  key: string;
  name: string;
  look: number;
  /** Where it is now. A wild Pokemon does not stand on its spawn point. */
  x: number;
  y: number;
  /** The spawn point, which is what the leash is measured from. */
  homeX: number;
  homeY: number;
  /**
   * How far it may get from its point before it would be teleported back.
   *
   * Not the spawn block's `radius` — that is only where it is placed.
   * `Monster::getRandomStep` walks wherever it can, and the bound is
   * `deSpawnRadius` from config.lua, which this base sets to 30.
   */
  leash: number;
  /** Milliseconds between steps, from the base's own speed formula. */
  stepMs: number;
  /** Wall clock its next step is due. */
  nextStepAt: number;
  /** Its own roll, so the whole zone does not wander in lockstep. */
  seed: number;
  /**
   * The step it is in the middle of, or null while standing.
   *
   * The tile moves the moment the step starts, the way the client does it;
   * this is what lets the sprite slide there instead of appearing there.
   */
  stride: Stride | null;
  /**
   * Wall clock it died at, or null while it is standing. A felled target is
   * kept in the list rather than removed: it is a spawn point, and the point
   * is still there — only the creature on it is gone until the zone's own
   * respawn time brings it back.
   */
  diedAt: number | null;
  /** Wall clock it returns at. Only meaningful once `diedAt` is set. */
  backAt: number;
};

/**
 * A defeated wild Pokemon lying where it fell.
 *
 * `catch.lua` only works on a corpse, and the corpse item carries its own
 * `duration` — thirty seconds for every Pokemon in this base. That window is
 * the capture mechanic: kill something, and you have half a minute to throw a
 * ball at the body before it decays.
 */
export type Corpse = {
  id: number;
  name: string;
  /** Client id of the `fainted <name>` item to draw. */
  item: number;
  level: number;
  x: number;
  y: number;
  /** Wall clock it fell, so a countdown can show how long is left. */
  bornAt: number;
  diesAt: number;
  /** Set once a ball has been thrown at it; a corpse is only worth one. */
  claimed: boolean;
};

export type FloatText = {
  x: number;
  y: number;
  text: string;
  kind: 'exp' | 'catch' | 'loot';
  bornAt: number;
};

/** How long a floating number climbs before it is dropped. */
export const FLOAT_MS = 1400;

/**
 * How close a wild one wants to be before it stops closing in.
 *
 * `targetDistance` in every species' flags block in this base is 1: they fight
 * from the next tile over.
 */
export const TARGET_DISTANCE = 1;

export type FieldOptions = {
  /** Cap on how many spawn points to animate at once. */
  maxTargets?: number;
  /** Respawn delay when the zone does not give one. */
  fallbackRespawnMs?: number;
  /** How long one step takes at a given speed; the base's own formula. */
  stepDuration?: (speed: number) => number;
  /** `deSpawnRadius` from config.lua. */
  leash?: number;
  /** How far a wild one notices something to chase, in tiles. */
  sight?: number;
};

export class HuntField {
  private targets: FieldTarget[] = [];
  private floats: FloatText[] = [];
  private bodies: Corpse[] = [];
  private nextCorpseId = 1;
  private respawnMs = 45_000;
  private readonly maxTargets: number;
  private readonly fallbackRespawnMs: number;
  private readonly stepDuration: (speed: number) => number;
  private readonly leash: number;
  private readonly sight: number;

  constructor(options: FieldOptions = {}) {
    this.maxTargets = options.maxTargets ?? 14;
    this.fallbackRespawnMs = options.fallbackRespawnMs ?? 45_000;
    // config.lua: deSpawnRadius = 30.
    this.leash = options.leash ?? 30;
    // `Creature::canSee` reaches maxViewportX - 2 tiles, which is 16 here.
    this.sight = options.sight ?? 16;
    // A flat second when the caller does not supply the real curve; the client
    // passes the server's formula.
    this.stepDuration = options.stepDuration ?? (() => 1000);
  }

  /** Zero speed means it does not roam at all, rather than roaming glacially. */
  private stepMs(speed: number): number {
    return speed > 0 ? this.stepDuration(speed) : Infinity;
  }

  get all(): readonly FieldTarget[] {
    return this.targets;
  }

  get texts(): readonly FloatText[] {
    return this.floats;
  }

  /** Corpses still on the ground, oldest first. */
  get corpses(): readonly Corpse[] {
    return this.bodies;
  }

  get armed(): boolean {
    return this.targets.length > 0;
  }

  /**
   * Stand the zone's wild Pokémon up around a point.
   *
   * Only spawns of the hunted species count. A Bellsprout zone that also
   * holds a few Oddish is common on this map, and killing the Oddish would
   * show the player a species the run is not paying them for.
   */
  arm(
    spawns: WildSpawn[],
    zone: { species: string; displayName: string; respawnSeconds: number; z: number },
    near: { x: number; y: number },
  ): void {
    this.respawnMs = Math.max(1000, (zone.respawnSeconds || 0) * 1000) || this.fallbackRespawnMs;

    const mine = spawns.filter(
      (s) => s.z === zone.z && (s.species === zone.species || s.name === zone.displayName),
    );

    const byDistance = mine
      .map((s) => ({ s, d: Math.hypot(s.x - near.x, s.y - near.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.maxTargets);

    this.targets = byDistance.map(({ s }, i) => ({
      key: `${s.x},${s.y},${s.z}`,
      name: s.name,
      look: s.look,
      x: s.x,
      y: s.y,
      homeX: s.x,
      homeY: s.y,
      leash: this.leash,
      stepMs: this.stepMs(s.speed ?? 0),
      // Spread the first steps out, or every Pokemon in the zone moves on the
      // same frame and the field twitches instead of milling about.
      nextStepAt: 0,
      diedAt: null,
      backAt: 0,
      seed: i * 2654435761,
      stride: null,
    }));
    this.floats = [];
    this.bodies = [];
  }

  disarm(): void {
    this.targets = [];
    this.floats = [];
    this.bodies = [];
  }

  /**
   * The one being fought: the closest that is still standing.
   *
   * `skip` holds targets the walker could find no way to — across water or
   * behind a cliff. They are still spawn points and still respawn, they just
   * cannot be reached from where the trainer is, so focus moves past them
   * rather than leaving the trainer facing a lake.
   */
  focus(from: { x: number; y: number }, skip?: ReadonlySet<string>): FieldTarget | null {
    let best: FieldTarget | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (t.diedAt !== null) continue;
      if (skip?.has(t.key)) continue;
      const d = Math.hypot(t.x - from.x, t.y - from.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    // Everything reachable is down; fall back to the whole list so a kill
    // still lands somewhere rather than being silently dropped.
    if (!best && skip?.size) return this.focus(from);
    return best;
  }

  /**
   * Whether the party is standing close enough to be fighting.
   *
   * A hunt only pays out for what is actually being fought: the simulation
   * resolves encounters on its own clock, and without this the wild Pokemon
   * fell one after another while the party was still crossing the field
   * towards the first of them.
   */
  inContact(from: { x: number; y: number }, reach = TARGET_DISTANCE, skip?: ReadonlySet<string>): boolean {
    const target = this.focus(from, skip);
    if (!target) return false;
    return Math.max(Math.abs(target.x - from.x), Math.abs(target.y - from.y)) <= reach;
  }

  /**
   * Book what the simulation already resolved.
   *
   * One line is one wild Pokémon defeated, so one target falls per line. A
   * tick that folded a long offline stretch can carry more lines than there
   * are standing targets; those extra kills happened somewhere the player was
   * not watching, so they are counted in the numbers and not drawn here.
   */
  credit(
    lines: Array<{ experience: number; caught: boolean }>,
    from: { x: number; y: number },
    now: number,
    skip?: ReadonlySet<string>,
    /** The corpse this species leaves, and for how long. */
    body?: { item: number; seconds: number; level: number },
  ): void {
    for (const line of lines) {
      // The same target the trainer is walking to, so the kill lands on the
      // Pokémon the player is watching rather than one behind them.
      const target = this.focus(from, skip);
      if (!target) break;

      target.diedAt = now;
      target.backAt = now + this.respawnMs;

      // The body it leaves. Capped so a long offline catch-up does not carry
      // back a hundred corpses that all decayed while the player was away.
      if (body && this.bodies.length < this.maxTargets) {
        this.bodies.push({
          id: this.nextCorpseId++,
          name: target.name,
          item: body.item,
          level: body.level,
          x: target.x,
          y: target.y,
          bornAt: now,
          diesAt: now + body.seconds * 1000,
          claimed: false,
        });
      }

      this.floats.push({
        x: target.x,
        y: target.y,
        text: `+${line.experience.toLocaleString('pt-BR')}`,
        kind: 'exp',
        bornAt: now,
      });
      if (line.caught) {
        this.floats.push({
          x: target.x,
          y: target.y,
          text: 'capturado!',
          kind: 'catch',
          bornAt: now + 120,
        });
      }
    }
  }

  /**
   * Let the living wander.
   *
   * A wild Pokemon in this base does not stand on its spawn point: the spawn
   * block gives it a `radius` — one tile for almost every point on this map,
   * five for about a thousand of them — and it mills about inside that. Each
   * one steps on its own clock, from `pokemon.wild.speed` through the server's
   * step-duration formula, so a fast species visibly moves more.
   *
   * `walkable` is asked before every step for the same reason the trainer's
   * pathfinder asks it: without it they wander into the lake.
   */
  roam(
    now: number,
    walkable: (x: number, y: number) => boolean,
    /** What they will come after, usually the trainer's lead Pokemon. */
    chase?: { x: number; y: number } | null,
  ): void {
    for (const t of this.targets) {
      if (t.diedAt !== null) continue;
      if (!Number.isFinite(t.stepMs)) continue;

      if (t.nextStepAt === 0) {
        // First step is spread across one interval so the zone does not move
        // as one block.
        t.seed = (t.seed * 1103515245 + 12345) >>> 0;
        t.nextStepAt = now + (t.seed % Math.max(1, Math.round(t.stepMs)));
        continue;
      }
      if (now < t.nextStepAt) continue;

      const step = this.nextStep(t, walkable, chase);
      // The cooldown runs whether or not a step was found, so a boxed-in
      // Pokemon retries on its own beat rather than every frame.
      const diagonal = step ? step.dx !== 0 && step.dy !== 0 : false;
      t.nextStepAt = now + t.stepMs * (diagonal ? 3 : 1);
      if (!step) continue;

      t.x += step.dx;
      t.y += step.dy;
      t.stride = { dx: step.dx, dy: step.dy, startedAt: now, ms: t.stepMs * (diagonal ? 3 : 1) };
    }
  }

  /**
   * Where one wild Pokemon goes next.
   *
   * Two behaviours, the same two `Monster::getNextStep` picks between: walk
   * towards what it is following, or take a random step when it has nothing
   * to follow.
   *
   * The chase is greedy — one tile in the target's direction, sidestepping to
   * one of the two neighbouring directions when that tile is blocked — rather
   * than the server's full pathfinding. A Pokemon that cannot see its way past
   * a tree gives up and wanders instead of solving a maze, which is the
   * behaviour worth having and a great deal cheaper for a dozen of them a
   * frame.
   */
  private nextStep(
    t: FieldTarget,
    walkable: (x: number, y: number) => boolean,
    chase?: { x: number; y: number } | null,
  ): { dx: number; dy: number } | null {
    const canGo = (dx: number, dy: number) => {
      const nx = t.x + dx;
      const ny = t.y + dy;
      // The leash is the only bound on wandering: `getRandomStep` itself does
      // not check the spawn radius, and treating the spawn block's `radius`
      // as a wander limit pinned every Pokemon to a three-by-three box.
      if (Math.max(Math.abs(nx - t.homeX), Math.abs(ny - t.homeY)) > t.leash) return false;
      return walkable(nx, ny);
    };

    if (chase) {
      const dx = chase.x - t.x;
      const dy = chase.y - t.y;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));

      // `targetDistance` is 1 for these species: once adjacent it stops
      // closing and fights from there.
      if (distance <= TARGET_DISTANCE) return null;

      if (distance <= this.sight) {
        const sx = Math.sign(dx);
        const sy = Math.sign(dy);

        // Straight at it, then the two directions either side. When the target
        // is dead level — the same row or the same column — those two are the
        // same move, so the perpendicular pair is added: without them a
        // Pokemon with a tree directly in front of it just stopped.
        const tries: Array<[number, number]> = [
          [sx, sy],
          [sx, 0],
          [0, sy],
        ];
        if (sy === 0) tries.push([0, 1], [0, -1]);
        if (sx === 0) tries.push([1, 0], [-1, 0]);

        for (const [ax, ay] of tries) {
          if ((ax !== 0 || ay !== 0) && canGo(ax, ay)) return { dx: ax, dy: ay };
        }
        return null;
      }
    }

    // `getRandomStep` shuffles the four cardinals and takes the first it can
    // walk to. Four, not eight: the server does not wander diagonally.
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
    ];
    for (let i = dirs.length - 1; i > 0; i--) {
      t.seed = (t.seed * 1103515245 + 12345) >>> 0;
      const j = t.seed % (i + 1);
      [dirs[i], dirs[j]] = [dirs[j]!, dirs[i]!];
    }
    for (const dir of dirs) {
      if (canGo(dir.dx, dir.dy)) return dir;
    }
    return null;
  }

  /** Take a corpse off the ground; returns it if it was still there. */
  claim(id: number, now: number): Corpse | null {
    const corpse = this.bodies.find((c) => c.id === id && !c.claimed && now < c.diesAt);
    if (!corpse) return null;
    corpse.claimed = true;
    return corpse;
  }

  /** Remove a corpse outright, once its throw has finished playing. */
  clear(id: number): void {
    this.bodies = this.bodies.filter((c) => c.id !== id);
  }

  /** Bring back what is due, decay what is spent, drop finished text. */
  update(now: number): void {
    for (const t of this.targets) {
      if (t.diedAt !== null && now >= t.backAt) {
        t.diedAt = null;
        t.backAt = 0;
        // A respawn comes back on its point, not wherever the last one died.
        t.x = t.homeX;
        t.y = t.homeY;
        t.nextStepAt = 0;
        t.stride = null;
      }
    }
    if (this.floats.length) {
      this.floats = this.floats.filter((f) => now - f.bornAt < FLOAT_MS);
    }
    if (this.bodies.length) {
      this.bodies = this.bodies.filter((c) => now < c.diesAt && !c.claimed);
    }
  }
}

/**
 * Where to put the trainer when they arrive in a zone.
 *
 * Not the zone's centre. A zone box is the bounding box of its spawn points,
 * and a bounding box's middle is frequently somewhere nothing spawns — the
 * Bellsprout zone in Kanto centres on open water, which put the trainer in a
 * lake with the nearest Pokémon off the edge of the screen.
 *
 * A spawn point is land by construction: something stands on it. So the
 * landing spot is the zone's own most central spawn point, stepped one tile
 * south so the trainer is beside it rather than inside it.
 */
export function landingSpot(
  spawns: WildSpawn[],
  zone: { species: string; displayName: string; z: number; center: { x: number; y: number } },
): { x: number; y: number } | null {
  let best: WildSpawn | null = null;
  let bestD = Infinity;

  for (const s of spawns) {
    if (s.z !== zone.z) continue;
    if (s.species !== zone.species && s.name !== zone.displayName) continue;
    const d = Math.hypot(s.x - zone.center.x, s.y - zone.center.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }

  return best ? { x: best.x, y: best.y + 1 } : null;
}

/**
 * How far the current fight has progressed, as 0..1.
 *
 * Read off the run's own active clock rather than counted locally: encounters
 * land on a fixed cadence for a given party and zone, so the fraction of the
 * way to the next one is exactly the fraction of the current wild Pokémon's
 * health that is gone.
 */
export function encounterProgress(activeMs: number, encounterMs: number): number {
  if (!(encounterMs > 0)) return 0;
  const into = activeMs % encounterMs;
  return Math.min(1, Math.max(0, into / encounterMs));
}
