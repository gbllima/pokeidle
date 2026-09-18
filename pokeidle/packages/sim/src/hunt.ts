import { CATCH_CHANCE_SCALE, CHANNEL, draw, drawInt, rollChance } from './rng.ts';

/**
 * Authoritative hunt simulation.
 *
 * The whole model is built so that the result of a run depends only on how
 * much active time it has accumulated, never on how that time was delivered.
 * Encounters are indexed, rewards are addressed by index, and the only
 * mutable quantity is `activeMs`. A run resumed from a checkpoint, a run
 * reconciled after eight hours offline, and a run simulated continuously all
 * fold the same encounters in the same order.
 */

export type HuntState =
  | 'IDLE'
  | 'TELEPORTING'
  | 'RUNNING'
  | 'SUSPENDED'
  | 'RETURNING'
  | 'SETTLING'
  | 'DONE';

export type LootDrop = {
  id: string;
  /** Out of `LOOT_CHANCE_SCALE` (ten million), as the Pokemon scripts write it. */
  chance: number;
  maxCount: number;
};

/** Everything about a zone the simulation needs, taken from a content release. */
export type ZoneSpec = {
  id: string;
  species: string;
  wildHealth: number;
  baseExperience: number;
  /** Out of `CATCH_CHANCE_SCALE` (ten thousand). A different scale from loot. */
  catchChance: number;
  /** How long one spawn point takes to refill, from the map's spawntime. */
  respawnMs: number;
  /** Spawn points in the zone, from the map. One when the map does not say. */
  population: number;
  /** Damage per second the wild one deals back, from `pokemon.attacks`. */
  wildDps: number;
  loot: LootDrop[];
};

/** The player's side of the fight, resolved server-side before the run starts. */
export type PartySpec = {
  /** Damage per second the party sustains against this zone. */
  dps: number;
  /** Added to the zone's catch chance, same scale. Zero means no balls. */
  catchRateBonus: number;
  /**
   * The party in fighting order, each with the health it starts the run at.
   * The lead takes every hit until it faints and the next one steps up.
   */
  members: Array<{ maxHp: number }>;
};

export type HuntPolicy = {
  /** Stop after this many encounters. */
  maxEncounters: number | null;
  /** Stop after this much active time. */
  maxActiveMs: number | null;
  /** Stop once this many distinct loot units have been gathered. */
  lootCapacity: number | null;
  /** Whether to attempt captures. */
  attemptCatches: boolean;
  /**
   * The ball the player is throwing, or null when they have none selected.
   *
   * Catching in this base is not something that happens on its own: a ball is
   * thrown at the corpse and consumed whether or not it works, and the roll is
   * `random(0, 10000) <= catchChance * ballMultiplier` from
   * `data/actions/scripts/poke/catch.lua`. Without a ball there is no attempt
   * at all — which is the whole reason a hunt does not quietly fill the bag
   * with every Pokemon it kills.
   */
  ball: { multiplier: number } | null;
};

export const DEFAULT_POLICY: HuntPolicy = {
  maxEncounters: null,
  maxActiveMs: null,
  lootCapacity: null,
  attemptCatches: true,
  ball: null,
};

export type HuntRewards = {
  experience: number;
  encounters: number;
  catches: number;
  /** Item id to quantity. */
  loot: Record<string, number>;
};

export type HuntRun = {
  id: string;
  playerId: string;
  zoneId: string;
  /** Pins the content build this run was started against. */
  contentReleaseId: string;
  seed: number;
  state: HuntState;
  /** Server clock when the run entered RUNNING. */
  startedAt: number;
  /** Server clock of the last time the run was advanced. */
  lastTickAt: number;
  /**
   * Active simulated milliseconds. This, not wall time, drives everything.
   * Offline time enters here already capped and scaled.
   */
  activeMs: number;
  /** Encounters already folded into `rewards`. */
  encounterIndex: number;
  /**
   * Balls left to throw. Seeded from the bag when the run starts and spent one
   * per attempt, hit or miss, exactly as `catch.lua` removes one from the
   * stack before rolling.
   */
  ballsLeft: number;
  /** Balls thrown that caught nothing. The bag loses these too. */
  ballsSpent: number;
  /**
   * Current health of each party member, in fighting order.
   *
   * Kept on the run rather than recomputed, because it is state the player
   * carries between hunts: a party that limps out of one zone limps into the
   * next until it is healed.
   */
  partyHp: number[];
  rewards: HuntRewards;
  /** Bumped on every mutation so stale commands can be rejected. */
  revision: number;
  stoppedReason: StopReason | null;
};

export type StopReason =
  | 'encounter-limit'
  | 'time-limit'
  | 'loot-full'
  | 'player-command'
  | 'party-fainted';

export function emptyRewards(): HuntRewards {
  return { experience: 0, encounters: 0, catches: 0, loot: {} };
}

/**
 * Time one encounter takes: killing the wild Pokemon, then waiting for the
 * next to respawn. Integer milliseconds, because a fractional interval would
 * make encounter boundaries depend on floating point accumulation order.
 */
/**
 * Wall time between one encounter and the next.
 *
 * Killing takes as long as the wild Pokémon's health divided by the party's
 * output. What used to be added on top of that was the zone's whole respawn
 * timer, as though the trainer stood over one spawn point waiting for it to
 * refill. They do not: a zone has `population` spawn points and the trainer
 * walks to the next one, which made every hunt about five times slower than
 * the map says it should be and made a 46-point zone no better than a 2-point
 * one.
 *
 * The respawn timer is a throughput limit instead. `population` points each
 * taking `respawnMs` to come back supply one Pokémon every
 * `respawnMs / population` on average, and a party that kills faster than
 * that runs the zone dry and waits on it.
 */
export function encounterMs(zone: ZoneSpec, party: PartySpec): number {
  if (party.dps <= 0) throw new Error('party dps must be positive');
  const killMs = Math.max(1, Math.ceil((zone.wildHealth / party.dps) * 1000));
  const supplyMs = Math.ceil(zone.respawnMs / Math.max(1, zone.population));
  return Math.max(killMs, supplyMs);
}

/**
 * Damage the party's lead takes over one encounter.
 *
 * The wild one hits back for as long as the fight lasts, so the toll is its
 * output times the kill time — the same kill time the cadence is built from,
 * not the cadence itself. A party that has to wait for the zone to respawn is
 * waiting, not bleeding.
 */
export function encounterDamage(zone: ZoneSpec, party: PartySpec): number {
  if (party.dps <= 0) throw new Error('party dps must be positive');
  if (!(zone.wildDps > 0)) return 0;
  const killSeconds = zone.wildHealth / party.dps;
  return Math.max(1, Math.round(zone.wildDps * killSeconds));
}

/** Index of the member currently taking hits, or -1 when all have fainted. */
export function leadIndex(partyHp: readonly number[]): number {
  return partyHp.findIndex((hp) => hp > 0);
}

export type EncounterOutcome = {
  index: number;
  experience: number;
  caught: boolean;
  loot: Array<{ id: string; count: number }>;
};

/**
 * Resolve encounter `index`. Pure: same inputs always give the same outcome,
 * with no dependence on any previous call.
 */
export function resolveEncounter(
  zone: ZoneSpec,
  party: PartySpec,
  policy: HuntPolicy,
  seed: number,
  index: number,
): EncounterOutcome {
  const loot: Array<{ id: string; count: number }> = [];

  for (let i = 0; i < zone.loot.length; i++) {
    const entry = zone.loot[i]!;
    // Offsetting by the entry position keeps two drops in one table from
    // sharing a draw and therefore always appearing together.
    const address = index * 64 + i;
    if (!rollChance(seed, address, CHANNEL.loot, entry.chance)) continue;

    const count =
      entry.maxCount <= 1
        ? 1
        : 1 + drawInt(seed, address, CHANNEL.lootCount, entry.maxCount);
    loot.push({ id: entry.id, count });
  }

  // The roll the base makes: the species' own chance times the ball's
  // multiplier, out of ten thousand. A plain Poke Ball multiplies by 100, so
  // with any ordinary species it is a formality — the scarce thing is the
  // ball, not the luck.
  const caught =
    policy.attemptCatches &&
    policy.ball !== null &&
    rollChance(
      seed,
      index,
      CHANNEL.catch,
      zone.catchChance * policy.ball.multiplier + party.catchRateBonus,
      CATCH_CHANCE_SCALE,
    );

  return { index, experience: zone.baseExperience, caught, loot };
}

function lootUnits(rewards: HuntRewards): number {
  let n = 0;
  for (const count of Object.values(rewards.loot)) n += count;
  return n;
}

export type AdvanceResult = {
  run: HuntRun;
  /** Encounters folded by this call. */
  folded: number;
  stopped: StopReason | null;
  /**
   * The encounters this call folded, in order, with `caught` already decided
   * against ball supply.
   *
   * Handed back rather than left for the caller to re-derive: `resolveEncounter`
   * is pure on its index and knows nothing about how many balls were left, so
   * a caller rebuilding the list itself would report catches the run never
   * credited. That is exactly the bug that filled a bag with forty Bellsprout.
   */
  outcomes: EncounterOutcome[];
};

/**
 * Advance a run by `deltaMs` of active time.
 *
 * Chunk-invariant by construction: `advance(run, a)` then `advance(run, b)`
 * lands on exactly the same state as `advance(run, a + b)`, because the only
 * carried quantity is `activeMs` and encounter outcomes are addressed by
 * index rather than drawn from a stream.
 */
export function advance(
  run: HuntRun,
  deltaMs: number,
  zone: ZoneSpec,
  party: PartySpec,
  policy: HuntPolicy = DEFAULT_POLICY,
): AdvanceResult {
  if (deltaMs < 0) throw new Error('cannot advance a run backwards');
  if (run.state !== 'RUNNING') {
    return { run, folded: 0, stopped: run.stoppedReason, outcomes: [] };
  }

  const step = encounterMs(zone, party);
  let activeMs = run.activeMs + Math.floor(deltaMs);
  let stopped: StopReason | null = null;

  if (policy.maxActiveMs !== null && activeMs >= policy.maxActiveMs) {
    activeMs = policy.maxActiveMs;
    stopped = 'time-limit';
  }

  let target = Math.floor(activeMs / step);
  if (policy.maxEncounters !== null && target >= policy.maxEncounters) {
    target = policy.maxEncounters;
    stopped = stopped ?? 'encounter-limit';
  }

  const rewards: HuntRewards = {
    experience: run.rewards.experience,
    encounters: run.rewards.encounters,
    catches: run.rewards.catches,
    loot: { ...run.rewards.loot },
  };

  let index = run.encounterIndex;
  let folded = 0;
  const outcomes: EncounterOutcome[] = [];

  // Health is copied and then mutated per encounter rather than multiplied
  // out at the end, so folding a hundred encounters at once faints exactly
  // the same members, in the same order, as ticking them one by one.
  const partyHp = [...run.partyHp];
  const damage = encounterDamage(zone, party);
  let ballsLeft = run.ballsLeft;
  let ballsSpent = run.ballsSpent;

  while (index < target) {
    if (policy.lootCapacity !== null && lootUnits(rewards) >= policy.lootCapacity) {
      stopped = 'loot-full';
      break;
    }

    // A party with nothing left standing cannot fight the next one. This is
    // checked before the encounter, not after, so the run never books a
    // reward it had no one alive to earn.
    const lead = leadIndex(partyHp);
    if (partyHp.length > 0 && lead === -1) {
      stopped = 'party-fainted';
      break;
    }

    const outcome = resolveEncounter(zone, party, policy, run.seed, index);
    rewards.experience += outcome.experience;
    rewards.encounters += 1;
    for (const drop of outcome.loot) {
      rewards.loot[drop.id] = (rewards.loot[drop.id] ?? 0) + drop.count;
    }

    // A throw needs a ball. The outcome already knows whether this one would
    // have worked; supply decides whether it is thrown at all. Deciding it
    // here rather than inside `resolveEncounter` keeps that function pure on
    // its index, so folding a thousand encounters at once still lands on the
    // same catches as ticking them one by one.
    let caught = false;
    if (policy.ball !== null && policy.attemptCatches && ballsLeft > 0) {
      ballsLeft -= 1;
      ballsSpent += 1;
      caught = outcome.caught;
    }
    if (caught) rewards.catches += 1;

    // The lead absorbs the whole blow. Overkill stops at zero rather than
    // carrying into the next member: one wild Pokémon cannot fell two.
    if (lead !== -1) partyHp[lead] = Math.max(0, partyHp[lead]! - damage);

    outcomes.push({ ...outcome, caught });
    index += 1;
    folded += 1;
  }

  const next: HuntRun = {
    ...run,
    activeMs,
    encounterIndex: index,
    partyHp,
    ballsLeft,
    ballsSpent,
    rewards,
    revision: run.revision + 1,
    state: stopped ? 'RETURNING' : run.state,
    stoppedReason: stopped ?? run.stoppedReason,
  };

  return { run: next, folded, stopped, outcomes };
}

export function startRun(init: {
  id: string;
  playerId: string;
  zone: ZoneSpec;
  contentReleaseId: string;
  seed: number;
  now: number;
  /** The party as it stands. Omit to start everyone at full health. */
  party?: PartySpec;
  /** Health carried in from a previous hunt, in fighting order. */
  partyHp?: number[];
  /** How many balls the player brought. Zero means no catching. */
  balls?: number;
}): HuntRun {
  return {
    id: init.id,
    playerId: init.playerId,
    zoneId: init.zone.id,
    contentReleaseId: init.contentReleaseId,
    seed: init.seed,
    state: 'RUNNING',
    startedAt: init.now,
    lastTickAt: init.now,
    activeMs: 0,
    encounterIndex: 0,
    partyHp: init.partyHp ?? init.party?.members.map((m) => m.maxHp) ?? [],
    ballsLeft: init.balls ?? 0,
    ballsSpent: 0,
    rewards: emptyRewards(),
    revision: 0,
    stoppedReason: null,
  };
}

/**
 * Set one party member's health, mid-run.
 *
 * A potion or a revive is used while the hunt is on, and the run owns party
 * health for as long as it lasts: healing the panel alone would be undone by
 * the next tick, which folds encounters against the run's own numbers.
 *
 * The cap is the caller's to give, because a run tracks what everyone has and
 * not what they can hold. A run that is over refuses: nobody is fighting, and
 * the health that matters is the one already handed back.
 */
export function healParty(run: HuntRun, index: number, hp: number, cap = Infinity): HuntRun {
  if (run.state !== 'RUNNING') return run;
  if (!Number.isInteger(index) || index < 0 || index >= run.partyHp.length) return run;

  const want = Math.max(0, Math.min(Math.round(hp), Math.round(cap)));
  if (want === run.partyHp[index]) return run;

  const partyHp = [...run.partyHp];
  partyHp[index] = want;
  return { ...run, partyHp, revision: run.revision + 1 };
}

/**
 * Put the party in a new order, mid-run.
 *
 * The lead is whoever stands first and still has health, so sending a
 * different Pokemon out is a reordering — and the health has to travel with
 * it. `order` holds the old positions in their new places: `[2, 0, 1]` means
 * whoever was third now leads.
 *
 * Anything that is not a permutation of the party is refused rather than
 * applied halfway, since a dropped index would quietly delete someone's
 * health.
 */
export function reorderParty(run: HuntRun, order: readonly number[]): HuntRun {
  if (run.state !== 'RUNNING') return run;
  if (order.length !== run.partyHp.length) return run;

  const seen = new Set<number>();
  for (const from of order) {
    if (!Number.isInteger(from) || from < 0 || from >= run.partyHp.length) return run;
    if (seen.has(from)) return run;
    seen.add(from);
  }
  if (order.every((from, to) => from === to)) return run;

  return {
    ...run,
    partyHp: order.map((from) => run.partyHp[from]!),
    revision: run.revision + 1,
  };
}

export function stopRun(run: HuntRun, reason: StopReason = 'player-command'): HuntRun {
  if (run.state === 'DONE' || run.state === 'SETTLING') return run;
  return { ...run, state: 'RETURNING', stoppedReason: reason, revision: run.revision + 1 };
}

/** Terminal transition. Idempotent, so a retried settle cannot double-credit. */
export function settleRun(run: HuntRun): HuntRun {
  if (run.state === 'DONE') return run;
  return { ...run, state: 'DONE', revision: run.revision + 1 };
}

export { draw };
