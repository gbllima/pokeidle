import {
  advance,
  encounterMs,
  healParty,
  reorderParty,
  settleRun,
  startRun,
  stopRun,
  DEFAULT_POLICY,
  type HuntPolicy,
  type HuntRun,
  type LootDrop,
  type PartySpec,
  type ZoneSpec,
} from '../../sim/src/hunt.ts';
import { resume, suspend, DEFAULT_OFFLINE, type ResumeReport } from '../../sim/src/offline.ts';

/**
 * Client-side hunt controller.
 *
 * Owns a `HuntRun` and drives it from wall time. Every number it produces
 * comes out of the shared simulation package, the same one the server will
 * run once the gateway exists — so moving authority across later is a matter
 * of replacing who calls `advance`, not of rewriting what a hunt means.
 *
 * The run is checkpointed to localStorage on every tick. On load, whatever
 * time passed since that checkpoint goes through the offline path: capped,
 * scaled, and folded into exactly the encounters it bought.
 */

const STORAGE_KEY = 'pokeidle.run.v1';

export type ZoneRow = {
  id: string;
  species: string;
  displayName: string;
  variant: string;
  region: string;
  z: number;
  center: { x: number; y: number; z: number };
  population: number;
  respawnSeconds: number;
  requiredLevel: number;
  types: string[];
  baseExperience: number;
  wildHealth: number;
  /** Absent on releases packed before wild output was derived. */
  wildDps?: number;
  catchChance: number;
};

export type SpeciesLoot = Record<string, Array<[string, number, number]>>;

export type LogLine = {
  index: number;
  species: string;
  experience: number;
  caught: boolean;
  loot: Array<{ id: string; count: number }>;
};

export type TickResult = {
  run: HuntRun;
  lines: LogLine[];
  stopped: boolean;
};

export type RestoreResult = {
  run: HuntRun;
  zone: ZoneRow;
  report: ResumeReport;
  /**
   * One line per encounter the catch-up folded. Restore has to report these
   * for the same reason a tick does: drops and captures are credited from
   * lines, so a restore that stayed silent would swallow everything the
   * player earned while away.
   */
  lines: LogLine[];
};

type Saved = {
  run: HuntRun;
  zoneId: string;
  savedAt: number;
};

export class HuntController {
  readonly zones: ZoneRow[];
  private readonly loot: SpeciesLoot;
  private readonly releaseId: string;

  private run: HuntRun | null = null;
  private zone: ZoneRow | null = null;
  private party: PartySpec = { dps: 1, catchRateBonus: 0, members: [] };
  private policy: HuntPolicy = DEFAULT_POLICY;

  constructor(zones: ZoneRow[], loot: SpeciesLoot, releaseId: string) {
    this.zones = zones;
    this.loot = loot;
    this.releaseId = releaseId;
  }

  setParty(party: PartySpec): void {
    this.party = party;
  }

  setPolicy(policy: HuntPolicy): void {
    this.policy = policy;
  }

  get current(): { run: HuntRun; zone: ZoneRow } | null {
    return this.run && this.zone ? { run: this.run, zone: this.zone } : null;
  }

  /** Seconds of wall time between encounters at the party's current output. */
  encounterSeconds(zone: ZoneRow): number {
    return encounterMs(this.spec(zone), this.party) / 1000;
  }

  search(query: string, minLevel = 0, maxLevel = Infinity): ZoneRow[] {
    const q = query.trim().toLowerCase();
    return this.zones.filter((z) => {
      if (z.requiredLevel < minLevel || z.requiredLevel > maxLevel) return false;
      if (!q) return true;
      return (
        z.displayName.toLowerCase().includes(q) ||
        z.region.toLowerCase().includes(q) ||
        z.types.some((t) => t.toLowerCase().includes(q))
      );
    });
  }

  /** Build the simulation's view of a zone, pulling the real loot table. */
  private spec(zone: ZoneRow): ZoneSpec {
    const rows = this.loot[zone.species] ?? [];
    const loot: LootDrop[] = rows.map(([id, chance, maxCount]) => ({ id, chance, maxCount }));
    return {
      id: zone.id,
      species: zone.species,
      wildHealth: Math.max(1, zone.wildHealth),
      baseExperience: zone.baseExperience,
      catchChance: zone.catchChance,
      wildDps: zone.wildDps ?? 0,
      respawnMs: zone.respawnSeconds * 1000,
      // How many spawn points the zone has decides how fast it can keep
      // handing the party something to fight.
      population: Math.max(1, zone.population),
      loot,
    };
  }

  /**
   * Begin a hunt. `partyHp` carries wounds in from the last one: a party that
   * limped out of a zone limps into the next until it is healed.
   */
  start(zoneId: string, now = Date.now(), partyHp?: number[], balls = 0): HuntRun {
    const zone = this.zones.find((z) => z.id === zoneId);
    if (!zone) throw new Error(`unknown zone ${zoneId}`);

    this.zone = zone;
    this.run = startRun({
      id: `run-${now.toString(36)}`,
      playerId: 'local',
      zone: this.spec(zone),
      contentReleaseId: this.releaseId,
      // A run's seed fixes every roll it will ever make, so it is drawn once
      // and then travels with the run.
      seed: (Math.random() * 0x7fffffff) | 0,
      now,
      party: this.party,
      partyHp,
      balls,
    });
    this.save(now);
    return this.run;
  }

  /**
   * Heal one party member while the hunt is on.
   *
   * The run owns party health for as long as it lasts, so a potion or a revive
   * has to be written into it — the panel follows the run, not the other way
   * around. Returns the health they end up with, or null when nothing is
   * running to heal.
   */
  heal(index: number, hp: number, cap: number, now = Date.now()): number | null {
    if (!this.run) return null;
    const before = this.run;
    this.run = healParty(this.run, index, hp, cap);
    if (this.run !== before) this.save(now);
    return this.run.partyHp[index] ?? null;
  }

  /**
   * Let wall time pass without simulating any of it.
   *
   * A run advances by however long it has been since the last tick, so simply
   * not ticking would bank the wait and pay it all out on the next one. This
   * moves the clock instead: the hunt is paused, and nothing is owed for the
   * time the party spent walking to its next target rather than fighting.
   */
  hold(now = Date.now()): void {
    if (!this.run || this.run.state !== 'RUNNING') return;
    this.run = { ...this.run, lastTickAt: now };
    this.save(now);
  }

  /**
   * Put the party in a new order while the hunt is on.
   *
   * `order` holds the old positions in their new places. The run owns party
   * health, so sending a different Pokemon out has to move the health with it
   * — otherwise the one coming forward would inherit the wounds of whoever
   * used to stand there.
   */
  reorder(order: readonly number[], now = Date.now()): void {
    if (!this.run) return;
    const before = this.run;
    this.run = reorderParty(this.run, order);
    if (this.run !== before) this.save(now);
  }

  stop(now = Date.now()): HuntRun | null {
    if (!this.run) return null;
    this.run = settleRun(stopRun(this.run));
    this.clear();
    const finished = this.run;
    this.run = null;
    this.zone = null;
    void now;
    return finished;
  }

  /**
   * Advance by however much wall time has passed since the last tick.
   * Returns one log line per encounter resolved, in order.
   */
  tick(now = Date.now()): TickResult | null {
    if (!this.run || !this.zone) return null;
    if (this.run.state !== 'RUNNING') return null;

    const delta = Math.max(0, now - this.run.lastTickAt);
    const spec = this.spec(this.zone);

    const result = advance(this.run, delta, spec, this.party, this.policy);
    this.run = { ...result.run, lastTickAt: now };

    // Straight from the run rather than re-resolved: whether a catch happened
    // depends on how many balls were left at that moment, which only `advance`
    // knows. Rebuilding the list here is what reported captures the run never
    // paid for.
    const lines: LogLine[] = result.outcomes.map((outcome) => ({
      index: outcome.index,
      species: this.zone!.displayName,
      experience: outcome.experience,
      caught: outcome.caught,
      loot: outcome.loot,
    }));

    this.save(now);
    return { run: this.run, lines, stopped: Boolean(result.stopped) };
  }

  /**
   * Pick up a checkpointed run and credit the time since it was written.
   * Returns null when there is nothing saved or the release has moved on.
   */
  restore(now = Date.now()): RestoreResult | null {
    const saved = this.read();
    if (!saved) return null;

    const zone = this.zones.find((z) => z.id === saved.zoneId);
    if (!zone) {
      this.clear();
      return null;
    }
    // A run pinned to a different content build cannot be trusted to mean
    // the same thing, so it is dropped rather than silently reinterpreted.
    if (saved.run.contentReleaseId !== this.releaseId) {
      this.clear();
      return null;
    }

    this.zone = zone;
    const spec = this.spec(zone);
    const frozen = suspend({ ...saved.run, lastTickAt: saved.savedAt }, saved.savedAt).run;
    const result = resume(frozen, now, spec, this.party, this.policy, DEFAULT_OFFLINE);

    this.run = { ...result.run, lastTickAt: now };

    // Same reason as in `tick`: catches depend on ball supply as it ran down,
    // so the outcomes come from the catch-up rather than being re-derived.
    const lines: LogLine[] = result.outcomes.map((outcome) => ({
      index: outcome.index,
      species: zone.displayName,
      experience: outcome.experience,
      caught: outcome.caught,
      loot: outcome.loot,
    }));

    this.save(now);
    return { run: this.run, zone, report: result.report, lines };
  }

  // ── persistence ────────────────────────────────────────────────────────────

  private save(now: number): void {
    if (!this.run || !this.zone) return;
    try {
      const payload: Saved = { run: this.run, zoneId: this.zone.id, savedAt: now };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Private windows and blocked storage are survivable: the run simply
      // does not persist across reloads.
    }
  }

  private read(): Saved | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Saved;
      if (!parsed?.run || !parsed.zoneId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to do */
    }
  }
}

/** A move as the release ships it: name, power, interval, chance, type. */
export type MoveRow = [string, number, number, number, string];

/**
 * Damage per second a move set sustains.
 *
 * Each move lands `power` every `interval` milliseconds, `chance` percent of
 * the time. These are the server's own numbers, so the rate is derived rather
 * than invented.
 */
export { DEFAULT_POLICY } from '../../sim/src/hunt.ts';

export function movesetDps(moves: MoveRow[]): number {
  let dps = 0;
  for (const [, power, interval, chance] of moves) {
    if (interval > 0) dps += (power * (chance / 100)) / (interval / 1000);
  }
  return dps;
}

/**
 * Party damage output.
 *
 * Move sets give the shape of a species' offence; level scales it. The level
 * term is still ours to tune — the base has no player-level damage formula to
 * read — but the per-species differences now come from real data instead of a
 * flat curve that made every Pokemon interchangeable.
 */
export function partyDps(members: Array<{ level: number; moves: MoveRow[] }>): number {
  let total = 0;
  for (const member of members) {
    const base = movesetDps(member.moves);
    total += base * Math.max(1, member.level);
  }
  return Math.max(1, total);
}
