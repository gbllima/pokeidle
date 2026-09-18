import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advance,
  encounterMs,
  healParty,
  reorderParty,
  encounterDamage,
  leadIndex,
  resolveEncounter,
  settleRun,
  startRun,
  stopRun,
  DEFAULT_POLICY,
  type HuntPolicy,
  type HuntRun,
  type PartySpec,
  type ZoneSpec,
} from '../src/hunt.ts';
import { resume, suspend, DEFAULT_OFFLINE } from '../src/offline.ts';

const HOUR = 60 * 60 * 1000;

// Shaped like a real zone from the compiled release: Bellsprout in Saffron.
const ZONE: ZoneSpec = {
  id: 'bellsprout-base-z7-1',
  species: 'bellsprout',
  wildHealth: 638,
  baseExperience: 57,
  // Real numbers from the compiled release: loot out of ten million,
  // catch out of ten thousand.
  catchChance: 400,
  respawnMs: 60_000,
  population: 46,
  // Bellsprout's own `pokemon.attacks` rate, rounded as the compiler ships it.
  wildDps: 4.5,
  loot: [
    { id: 'seed', chance: 8_000_000, maxCount: 13 },
    { id: 'bottle of poison', chance: 8_000_000, maxCount: 13 },
    { id: 'leaves', chance: 3_250_000, maxCount: 1 },
  ],
};

// Durable on purpose: the cadence, limit and offline tests are about the
// clock, and a party that faints halfway would stop the run and measure
// attrition instead of what they are for. The attrition tests below bring
// their own party.
const PARTY: PartySpec = {
  dps: 45,
  catchRateBonus: 250,
  members: [{ maxHp: 100_000_000 }],
};

/** Two members with just enough health to watch them fall. */
const FRAIL: PartySpec = {
  dps: 45,
  catchRateBonus: 250,
  members: [{ maxHp: 300 }, { maxHp: 200 }],
};
const SEED = 0x5eed_1234;

const newRun = (): HuntRun =>
  startRun({
    id: 'run-1',
    playerId: 'player-1',
    zone: ZONE,
    contentReleaseId: '8441039651822d8d',
    seed: SEED,
    now: 1_700_000_000_000,
    party: PARTY,
  });

const rewardsOf = (r: HuntRun) => ({
  experience: r.rewards.experience,
  encounters: r.rewards.encounters,
  catches: r.rewards.catches,
  loot: r.rewards.loot,
});

test('encounter interval is the kill time when the zone can keep up', () => {
  const step = encounterMs(ZONE, PARTY);
  // 638 hp / 45 dps = 14.18s -> ceil to 14181ms. The zone's 46 points refill
  // every 60s between them, one about every 1.3s, so supply is not the limit.
  assert.equal(step, Math.ceil((638 / 45) * 1000));
  assert.equal(Number.isInteger(step), true);
});

test('a party that outruns the zone waits on the zone, not on its own damage', () => {
  // Same zone, absurd output: the fight is instant and the trainer is left
  // waiting for spawn points to refill.
  const fast = encounterMs(ZONE, { dps: 1_000_000, catchRateBonus: 0 });
  assert.equal(fast, Math.ceil(60_000 / 46));
});

test('a one-point zone still pays its whole respawn timer', () => {
  // The old behaviour, now only where it is actually true.
  const lonely = { ...ZONE, population: 1 };
  assert.equal(encounterMs(lonely, { dps: 1_000_000, catchRateBonus: 0 }), 60_000);
});

test('a zone with no population recorded is treated as a single point', () => {
  const unknown = { ...ZONE, population: 0 };
  assert.equal(encounterMs(unknown, { dps: 1_000_000, catchRateBonus: 0 }), 60_000);
});

test('a zero-dps party is rejected rather than dividing by zero', () => {
  assert.throws(() => encounterMs(ZONE, { dps: 0, catchRateBonus: 0 }), /dps must be positive/);
});

test('encounter outcomes depend only on the index, not on call order', () => {
  const a = resolveEncounter(ZONE, PARTY, DEFAULT_POLICY, SEED, 4321);
  const b = resolveEncounter(ZONE, PARTY, DEFAULT_POLICY, SEED, 4321);
  assert.deepEqual(a, b);

  // Resolving other encounters in between must not disturb it.
  for (let i = 0; i < 50; i++) resolveEncounter(ZONE, PARTY, DEFAULT_POLICY, SEED, i);
  assert.deepEqual(resolveEncounter(ZONE, PARTY, DEFAULT_POLICY, SEED, 4321), a);
});

test('different seeds produce different runs', () => {
  const fold = (seed: number) => {
    let run = { ...newRun(), seed };
    run = advance(run, 24 * HOUR, ZONE, PARTY).run;
    return rewardsOf(run);
  };

  const a = fold(SEED);
  const b = fold(SEED + 1);
  assert.equal(a.encounters, b.encounters, 'encounter count is time-driven, not random');
  assert.notDeepEqual(a.loot, b.loot, 'loot must differ between seeds');
});

test('advancing in one pass equals advancing in many slices', () => {
  const total = 8 * HOUR;

  const oneShot = advance(newRun(), total, ZONE, PARTY).run;

  // Deterministic but irregular slices, the way real ticks and reconnects
  // would arrive.
  let sliced = newRun();
  let remaining = total;
  let n = 1;
  while (remaining > 0) {
    const slice = Math.min(remaining, ((n * 7919) % 971) * 1000 + 1);
    sliced = advance(sliced, slice, ZONE, PARTY).run;
    remaining -= slice;
    n++;
  }

  assert.equal(sliced.activeMs, oneShot.activeMs);
  assert.equal(sliced.encounterIndex, oneShot.encounterIndex);
  assert.deepEqual(rewardsOf(sliced), rewardsOf(oneShot));
});

test('one-millisecond slices land on the same state as one pass', () => {
  const total = encounterMs(ZONE, PARTY) * 3 + 17;

  const oneShot = advance(newRun(), total, ZONE, PARTY).run;

  let sliced = newRun();
  for (let i = 0; i < total; i++) sliced = advance(sliced, 1, ZONE, PARTY).run;

  assert.equal(sliced.encounterIndex, oneShot.encounterIndex);
  assert.deepEqual(rewardsOf(sliced), rewardsOf(oneShot));
});

test('a run advanced by zero changes nothing but the revision', () => {
  const before = advance(newRun(), 3 * HOUR, ZONE, PARTY).run;
  const after = advance(before, 0, ZONE, PARTY).run;
  assert.deepEqual(rewardsOf(after), rewardsOf(before));
  assert.equal(after.encounterIndex, before.encounterIndex);
});

test('advancing backwards is refused', () => {
  assert.throws(() => advance(newRun(), -1, ZONE, PARTY), /backwards/);
});

test('closing the game for eight hours matches having stayed online', () => {
  const start = 1_700_000_000_000;
  const away = 8 * HOUR;

  // Played straight through, but only earning the offline rate.
  const online = advance(newRun(), away * DEFAULT_OFFLINE.efficiency, ZONE, PARTY).run;

  // Closed the browser and came back.
  const suspended = suspend({ ...newRun(), lastTickAt: start }, start).run;
  const resumed = resume(suspended, start + away, ZONE, PARTY).run;

  assert.deepEqual(rewardsOf(resumed), rewardsOf(online));
  assert.equal(resumed.encounterIndex, online.encounterIndex);
});

test('offline time past the cap is discarded, not banked', () => {
  const start = 1_700_000_000_000;
  const suspended = suspend({ ...newRun(), lastTickAt: start }, start).run;

  const atCap = resume(suspended, start + DEFAULT_OFFLINE.capMs, ZONE, PARTY);
  const wayPast = resume(suspended, start + 40 * HOUR, ZONE, PARTY);

  assert.deepEqual(rewardsOf(wayPast.run), rewardsOf(atCap.run));
  assert.equal(wayPast.report.cappedOut, true);
  assert.equal(atCap.report.cappedOut, false);
  assert.equal(wayPast.report.discardedMs, 40 * HOUR - DEFAULT_OFFLINE.capMs);
});

test('resuming twice does not pay twice', () => {
  const start = 1_700_000_000_000;
  const suspended = suspend({ ...newRun(), lastTickAt: start }, start).run;

  const first = resume(suspended, start + 4 * HOUR, ZONE, PARTY).run;
  // The run is RUNNING now, so a replayed resume command is inert.
  const second = resume(first, start + 4 * HOUR, ZONE, PARTY).run;

  assert.deepEqual(rewardsOf(second), rewardsOf(first));
});

test('a suspended run earns nothing from a plain advance', () => {
  const suspended = suspend(newRun(), 1_700_000_000_000).run;
  const result = advance(suspended, 12 * HOUR, ZONE, PARTY);
  assert.equal(result.folded, 0);
  assert.equal(result.run.rewards.encounters, 0);
});

test('the encounter limit stops the run exactly on the limit', () => {
  const policy: HuntPolicy = { ...DEFAULT_POLICY, maxEncounters: 10 };
  const result = advance(newRun(), 30 * HOUR, ZONE, PARTY, policy);

  assert.equal(result.run.rewards.encounters, 10);
  assert.equal(result.stopped, 'encounter-limit');
  assert.equal(result.run.state, 'RETURNING');

  // Once returning, further time buys nothing.
  const more = advance(result.run, 5 * HOUR, ZONE, PARTY, policy);
  assert.equal(more.run.rewards.encounters, 10);
});

test('the time limit clamps active time', () => {
  const policy: HuntPolicy = { ...DEFAULT_POLICY, maxActiveMs: 2 * HOUR };
  const result = advance(newRun(), 9 * HOUR, ZONE, PARTY, policy);

  assert.equal(result.run.activeMs, 2 * HOUR);
  assert.equal(result.stopped, 'time-limit');
});

test('a full bag stops the run', () => {
  const policy: HuntPolicy = { ...DEFAULT_POLICY, lootCapacity: 20 };
  const result = advance(newRun(), 60 * HOUR, ZONE, PARTY, policy);

  const units = Object.values(result.run.rewards.loot).reduce((a, b) => a + b, 0);
  assert.ok(units >= 20, `expected the bag to reach capacity, got ${units}`);
  assert.equal(result.stopped, 'loot-full');
});

// A plain Poke Ball, straight from `balls` in data/lib/core/newfunctions.lua.
const POKEBALL: HuntPolicy = { ...DEFAULT_POLICY, ball: { multiplier: 100 } };

const runWithBalls = (balls: number): HuntRun =>
  startRun({
    id: 'run-balls',
    playerId: 'player-1',
    zone: ZONE,
    contentReleaseId: '8441039651822d8d',
    seed: SEED,
    now: 1_700_000_000_000,
    party: PARTY,
    balls,
  });

test('catches only happen when the policy allows them', () => {
  const off: HuntPolicy = { ...POKEBALL, attemptCatches: false };
  const withCatches = advance(runWithBalls(9999), 48 * HOUR, ZONE, PARTY, POKEBALL).run;
  const without = advance(runWithBalls(9999), 48 * HOUR, ZONE, PARTY, off).run;

  assert.ok(withCatches.rewards.catches > 0, 'expected some captures over 48h');
  assert.equal(without.rewards.catches, 0);
  assert.equal(without.rewards.encounters, withCatches.rewards.encounters);
});

// ── balls ────────────────────────────────────────────────────────────────────

test('a hunt with no ball catches nothing, however long it runs', () => {
  // This is the bug that filled a bag with forty-one Bellsprout: catching was
  // free, so every kill was also a capture.
  const run = advance(runWithBalls(0), 48 * HOUR, ZONE, PARTY, POKEBALL).run;

  assert.ok(run.rewards.encounters > 100, 'the hunt still happened');
  assert.equal(run.rewards.catches, 0);
  assert.equal(run.ballsSpent, 0);
});

test('a ball is spent per attempt, and the supply runs out', () => {
  const run = advance(runWithBalls(5), 48 * HOUR, ZONE, PARTY, POKEBALL).run;

  assert.equal(run.ballsSpent, 5, 'every ball was thrown');
  assert.equal(run.ballsLeft, 0);
  assert.ok(run.rewards.catches <= 5, 'no more catches than balls thrown');
  assert.ok(run.rewards.encounters > 5, 'and the hunt carried on without them');
});

test('a miss costs its ball too', () => {
  // `catch.lua` removes the ball before it rolls. A ball only spent on
  // successes would make a failed throw free.
  const stubborn = { ...ZONE, catchChance: 1 };
  const run = advance(runWithBalls(20), 48 * HOUR, stubborn, PARTY, {
    ...DEFAULT_POLICY,
    ball: { multiplier: 1 },
  }).run;

  assert.equal(run.ballsSpent, 20);
  assert.ok(run.rewards.catches < 20, 'a 1-in-10000 chance did not catch twenty');
});

test('a better ball multiplies the species chance, as the base does', () => {
  // chance = catchChance * multiplier, out of ten thousand.
  const rare = { ...ZONE, catchChance: 2 };
  const weak = advance(runWithBalls(400), 48 * HOUR, rare, PARTY, {
    ...DEFAULT_POLICY,
    ball: { multiplier: 1 },
  }).run;
  const master = advance(runWithBalls(400), 48 * HOUR, rare, PARTY, {
    ...DEFAULT_POLICY,
    ball: { multiplier: 1000 },
  }).run;

  assert.ok(
    master.rewards.catches > weak.rewards.catches,
    `master ${master.rewards.catches} should beat plain ${weak.rewards.catches}`,
  );
});

test('ball supply folds the same whether ticked or caught up at once', () => {
  const step = encounterMs(ZONE, PARTY);
  const atOnce = advance(runWithBalls(3), step * 10, ZONE, PARTY, POKEBALL).run;

  let oneByOne = runWithBalls(3);
  for (let i = 0; i < 10; i++) {
    oneByOne = advance(oneByOne, step, ZONE, PARTY, POKEBALL).run;
  }

  assert.equal(atOnce.ballsSpent, oneByOne.ballsSpent);
  assert.equal(atOnce.rewards.catches, oneByOne.rewards.catches);
});

test('advance reports the outcomes it folded so nobody re-derives them', () => {
  const result = advance(runWithBalls(2), encounterMs(ZONE, PARTY) * 6, ZONE, PARTY, POKEBALL);

  assert.equal(result.outcomes.length, result.folded);
  assert.equal(
    result.outcomes.filter((o) => o.caught).length,
    result.run.rewards.catches,
    'the lines and the rewards agree on how many were caught',
  );
});

test('settling is idempotent and stopping is terminal', () => {
  const run = advance(newRun(), HOUR, ZONE, PARTY).run;
  const stopped = stopRun(run);
  assert.equal(stopped.state, 'RETURNING');
  assert.equal(stopped.stoppedReason, 'player-command');

  const settled = settleRun(stopped);
  const again = settleRun(settled);
  assert.equal(settled.state, 'DONE');
  assert.equal(again.revision, settled.revision, 'a replayed settle must not bump revision');
  assert.deepEqual(rewardsOf(again), rewardsOf(settled));
});

test('every mutation bumps the revision so stale commands can be rejected', () => {
  const a = newRun();
  const b = advance(a, HOUR, ZONE, PARTY).run;
  const c = stopRun(b);
  assert.ok(b.revision > a.revision);
  assert.ok(c.revision > b.revision);
});

// ── attrition ────────────────────────────────────────────────────────────────

const frailRun = (): HuntRun =>
  startRun({
    id: 'run-frail',
    playerId: 'player-1',
    zone: ZONE,
    contentReleaseId: '8441039651822d8d',
    seed: SEED,
    now: 1_700_000_000_000,
    party: FRAIL,
  });

test('a run starts with the party at the health it brought', () => {
  assert.deepEqual(frailRun().partyHp, [300, 200]);
});

test('damage taken is the wild output over the kill, not over the cadence', () => {
  // 638 hp / 45 dps = 14.18s of fighting at 4.5 dps = 64 damage.
  assert.equal(encounterDamage(ZONE, FRAIL), Math.round(4.5 * (638 / 45)));
});

test('a zone whose species never attacks costs the party nothing', () => {
  assert.equal(encounterDamage({ ...ZONE, wildDps: 0 }, FRAIL), 0);
});

test('the lead takes the hits and the next steps up when it faints', () => {
  const step = encounterMs(ZONE, FRAIL);
  const damage = encounterDamage(ZONE, FRAIL);
  const perMember = Math.ceil(300 / damage);

  const run = advance(frailRun(), step * perMember, ZONE, FRAIL).run;
  assert.equal(run.partyHp[0], 0, 'the lead is down');
  assert.equal(run.partyHp[1], 200, 'the second has not been touched yet');
  assert.equal(leadIndex(run.partyHp), 1);
});

test('one wild Pokemon cannot fell two party members', () => {
  // A single hit far bigger than the lead's whole health.
  const brutal = { ...ZONE, wildDps: 10_000 };
  const run = advance(frailRun(), encounterMs(brutal, FRAIL), brutal, FRAIL).run;
  assert.equal(run.partyHp[0], 0);
  assert.equal(run.partyHp[1], 200, 'overkill stops at zero rather than carrying over');
});

test('a wiped party stops the run instead of fighting on', () => {
  const brutal = { ...ZONE, wildDps: 10_000 };
  const step = encounterMs(brutal, FRAIL);
  const result = advance(frailRun(), step * 20, brutal, FRAIL);

  assert.equal(result.stopped, 'party-fainted');
  assert.equal(result.run.state, 'RETURNING');
  assert.deepEqual(result.run.partyHp, [0, 0]);
  // Two members, two encounters won, and then nobody left to win a third.
  assert.equal(result.run.rewards.encounters, 2);
});

test('folding many encounters at once wears the party exactly like ticking', () => {
  const step = encounterMs(ZONE, FRAIL);

  const atOnce = advance(frailRun(), step * 7, ZONE, FRAIL).run;

  let oneByOne = frailRun();
  for (let i = 0; i < 7; i++) oneByOne = advance(oneByOne, step, ZONE, FRAIL).run;

  assert.deepEqual(atOnce.partyHp, oneByOne.partyHp);
  assert.equal(atOnce.rewards.encounters, oneByOne.rewards.encounters);
});

test('health carried in from a previous hunt is honoured', () => {
  const limping = startRun({
    id: 'run-2',
    playerId: 'player-1',
    zone: ZONE,
    contentReleaseId: '8441039651822d8d',
    seed: SEED,
    now: 1_700_000_000_000,
    party: FRAIL,
    partyHp: [12, 200],
  });
  assert.deepEqual(limping.partyHp, [12, 200]);

  const after = advance(limping, encounterMs(ZONE, FRAIL), ZONE, FRAIL).run;
  assert.equal(after.partyHp[0], 0, 'twelve health does not survive a 64 damage fight');
});

// ── healing mid-run ──────────────────────────────────────────────────────────

test('a potion used during a hunt lands on the run, not beside it', () => {
  const hurt = healParty(frailRun(), 0, 100, 300);
  assert.equal(hurt.partyHp[0], 100);
  assert.equal(hurt.partyHp[1], 200, 'the rest of the party is untouched');
  assert.ok(hurt.revision > frailRun().revision);

  // The run owns party health while it lasts, so the proof is that the next
  // tick fights on from the healed number: two encounters cost this party
  // 128, which the lead only survives because it was topped back up first.
  const healed = healParty(hurt, 0, 300, 300);
  const after = advance(healed, 2 * encounterMs(ZONE, FRAIL), ZONE, FRAIL).run;

  assert.ok(after.partyHp[0]! > 0, 'the heal should have carried into the fight');
  assert.equal(advance(hurt, 2 * encounterMs(ZONE, FRAIL), ZONE, FRAIL).run.partyHp[0], 0);
});

test('a heal cannot take anyone past what they can hold', () => {
  const run = frailRun();
  assert.equal(healParty(run, 0, 9999, 300).partyHp[0], 300);
  assert.equal(healParty(run, 0, -50, 300).partyHp[0], 0, 'nor below nothing');
});

test('a revive is a full heal, since that is what revive.lua writes', () => {
  const fainted = healParty(frailRun(), 1, 0, 200);
  assert.equal(fainted.partyHp[1], 0);
  assert.equal(healParty(fainted, 1, 200, 200).partyHp[1], 200);
});

test('healing nobody in particular changes nothing', () => {
  const run = frailRun();
  assert.equal(healParty(run, 5, 100, 300), run, 'an index nobody occupies');
  assert.equal(healParty(run, -1, 100, 300), run);
  assert.equal(healParty(run, 0, 300, 300), run, 'already at that health');
});

test('a run that is over refuses to be healed', () => {
  // Nothing is fighting, and the health that matters is the one already
  // handed back to the party panel.
  const stopped = stopRun(frailRun());
  assert.equal(healParty(stopped, 0, 1, 300), stopped);
  assert.equal(healParty(settleRun(stopped), 0, 1, 300).partyHp[0], 300);
});

// ── sending a different Pokemon out ──────────────────────────────────────────

test('reordering the party carries each health with its Pokemon', () => {
  const run = healParty(frailRun(), 1, 120, 200);
  assert.deepEqual(run.partyHp, [300, 120]);

  const swapped = reorderParty(run, [1, 0]);
  assert.deepEqual(swapped.partyHp, [120, 300], 'the one sent out keeps its wounds');
  assert.ok(swapped.revision > run.revision);
});

test('the newly fronted Pokemon is the one that takes the next hits', () => {
  // The lead is whoever stands first with health left, so a reorder is how a
  // trainer sends someone else out.
  const run = reorderParty(frailRun(), [1, 0]);
  const after = advance(run, encounterMs(ZONE, FRAIL), ZONE, FRAIL).run;
  assert.ok(after.partyHp[0]! < 200, 'the new lead should have been hit');
  assert.equal(after.partyHp[1], 300, 'the one put away is untouched');
});

test('an order that is not a permutation is refused outright', () => {
  const run = frailRun();
  assert.equal(reorderParty(run, [0]), run, 'too short');
  assert.equal(reorderParty(run, [0, 0]), run, 'a repeat would delete someone');
  assert.equal(reorderParty(run, [0, 5]), run, 'nobody stands there');
  assert.equal(reorderParty(run, [0, 1]), run, 'already in that order');
});

test('a run that is over cannot be reordered', () => {
  const stopped = stopRun(frailRun());
  assert.equal(reorderParty(stopped, [1, 0]), stopped);
});
