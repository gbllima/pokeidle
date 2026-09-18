import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HuntField,
  encounterProgress,
  landingSpot,
  FLOAT_MS,
  type WildSpawn,
} from '../src/field.ts';

const ZONE = { species: 'bellsprout', displayName: 'Bellsprout', respawnSeconds: 45, z: 7 };
const HERE = { x: 100, y: 100 };

function spawns(): WildSpawn[] {
  return [
    { name: 'Bellsprout', species: 'bellsprout', x: 101, y: 100, z: 7, look: 69 },
    { name: 'Bellsprout', species: 'bellsprout', x: 105, y: 100, z: 7, look: 69 },
    { name: 'Bellsprout', species: 'bellsprout', x: 120, y: 100, z: 7, look: 69 },
    // Same zone, different species: the run does not pay for these.
    { name: 'Oddish', species: 'oddish', x: 102, y: 100, z: 7, look: 43 },
    // Right on top of the player but on another floor.
    { name: 'Bellsprout', species: 'bellsprout', x: 100, y: 100, z: 6, look: 69 },
  ];
}

test('arming keeps only the hunted species on the hunted floor', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);

  assert.equal(field.all.length, 3);
  assert.ok(field.all.every((t) => t.name === 'Bellsprout'));
  assert.ok(field.armed);
});

test('arming orders by distance and caps how many are animated', () => {
  const many: WildSpawn[] = [];
  for (let i = 0; i < 40; i++) {
    many.push({ name: 'Bellsprout', species: 'bellsprout', x: 100 + i, y: 100, z: 7, look: 69 });
  }

  const field = new HuntField({ maxTargets: 5 });
  field.arm(many, ZONE, HERE);

  assert.equal(field.all.length, 5);
  assert.deepEqual(
    field.all.map((t) => t.x),
    [100, 101, 102, 103, 104],
  );
});

test('focus is the nearest one still standing', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);

  assert.equal(field.focus(HERE)?.x, 101);

  field.credit([{ experience: 10, caught: false }], HERE, 1000);
  assert.equal(field.focus(HERE)?.x, 105, 'the fallen one is no longer a target');
});

test('one log line fells exactly one target', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);

  field.credit(
    [
      { experience: 10, caught: false },
      { experience: 12, caught: false },
    ],
    HERE,
    1000,
  );

  assert.equal(field.all.filter((t) => t.diedAt !== null).length, 2);
  assert.equal(field.all.filter((t) => t.diedAt === null).length, 1);
});

test('more kills than targets is not an error', () => {
  // An offline catch-up folds hundreds of encounters at once. They are real
  // rewards, but there is nothing on screen left to kill for them.
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);

  const lines = Array.from({ length: 50 }, () => ({ experience: 9, caught: false }));
  field.credit(lines, HERE, 1000);

  assert.equal(field.focus(HERE), null);
  assert.equal(field.all.length, 3, 'targets are felled, never removed');
});

test('a defeated target comes back on the zone respawn timer', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000);

  const fallen = field.all.find((t) => t.diedAt !== null)!;

  field.update(1000 + 44_000);
  assert.equal(fallen.diedAt, 1000, 'still down a second before the respawn is due');

  field.update(1000 + 45_000);
  assert.equal(fallen.diedAt, null, 'back up once the zone respawn time has passed');
  assert.equal(field.focus(HERE)?.x, fallen.x, 'and targetable again');
});

test('a catch adds its own note on top of the experience', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: true }], HERE, 1000);

  assert.deepEqual(
    field.texts.map((t) => t.kind),
    ['exp', 'catch'],
  );
});

test('floating text is dropped once it has finished climbing', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000);

  field.update(1000 + FLOAT_MS - 1);
  assert.equal(field.texts.length, 1);

  field.update(1000 + FLOAT_MS);
  assert.equal(field.texts.length, 0);
});

test('disarming leaves nothing behind', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: true }], HERE, 1000);

  field.disarm();
  assert.equal(field.armed, false);
  assert.equal(field.texts.length, 0);
  assert.equal(field.focus(HERE), null);
});

test('encounter progress runs 0..1 between encounters', () => {
  assert.equal(encounterProgress(0, 4000), 0);
  assert.equal(encounterProgress(2000, 4000), 0.5);
  assert.equal(encounterProgress(4000, 4000), 0, 'a completed encounter starts the next one');
  assert.equal(encounterProgress(6000, 4000), 0.5);
});

test('encounter progress refuses to divide by a zero cadence', () => {
  assert.equal(encounterProgress(1234, 0), 0);
  assert.equal(encounterProgress(1234, Number.NaN), 0);
});

// ── landing ──────────────────────────────────────────────────────────────────

const ZONE_WITH_CENTRE = { ...ZONE, center: { x: 100, y: 100 } };

test('the trainer lands beside the most central spawn point, not the box centre', () => {
  // The centre of the box is empty water; the nearest Bellsprout is at 101,100.
  const spot = landingSpot(spawns(), ZONE_WITH_CENTRE);
  assert.deepEqual(spot, { x: 101, y: 101 }, 'one tile south of a real spawn');
});

test('landing ignores other species and other floors', () => {
  const only = [
    // Closer to the centre than any Bellsprout, but the wrong species.
    { name: 'Oddish', species: 'oddish', x: 100, y: 100, z: 7, look: 43 },
    // Right on the centre, but a floor down.
    { name: 'Bellsprout', species: 'bellsprout', x: 100, y: 100, z: 6, look: 69 },
    { name: 'Bellsprout', species: 'bellsprout', x: 140, y: 140, z: 7, look: 69 },
  ];
  assert.deepEqual(landingSpot(only, ZONE_WITH_CENTRE), { x: 140, y: 141 });
});

test('a zone with nothing to land on says so instead of guessing', () => {
  assert.equal(landingSpot([], ZONE_WITH_CENTRE), null);
});

test('focus walks past a target the trainer cannot reach', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);

  const stuck = new Set([field.focus(HERE)!.key]);
  assert.equal(field.focus(HERE, stuck)?.x, 105);
});

test('when everything reachable is down a kill still lands somewhere', () => {
  // Otherwise a run that keeps paying out would stop showing anything dying.
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);

  const all = new Set(field.all.map((t) => t.key));
  assert.notEqual(field.focus(HERE, all), null);
});

// ── corpses ──────────────────────────────────────────────────────────────────

const BODY = { item: 24097, seconds: 30, level: 4 };

test('a defeated wild leaves a body to throw a ball at', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000, undefined, BODY);

  assert.equal(field.corpses.length, 1);
  const [body] = field.corpses;
  assert.equal(body.name, 'Bellsprout');
  assert.equal(body.item, 24097);
  assert.equal(body.diesAt, 1000 + 30_000, "the corpse item's own duration");
  assert.equal(body.claimed, false);
});

test('a kill with no corpse data leaves nothing behind', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000);
  assert.equal(field.corpses.length, 0);
});

test('a corpse decays on its own timer', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000, undefined, BODY);

  field.update(1000 + 29_999);
  assert.equal(field.corpses.length, 1);

  field.update(1000 + 30_000);
  assert.equal(field.corpses.length, 0);
});

test('a corpse can only be claimed once', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000, undefined, BODY);
  const id = field.corpses[0]!.id;

  assert.notEqual(field.claim(id, 1500), null);
  assert.equal(field.claim(id, 1600), null, 'one ball per body');
});

test('a decayed corpse cannot be claimed', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000, undefined, BODY);
  const id = field.corpses[0]!.id;

  assert.equal(field.claim(id, 1000 + 30_001), null);
});

test('an offline catch-up does not carry back a hundred corpses', () => {
  // They would all have decayed while the player was away, so bringing them
  // back would hand out captures for kills nobody was present for.
  const field = new HuntField({ maxTargets: 3 });
  field.arm(spawns(), ZONE, HERE);

  const lines = Array.from({ length: 200 }, () => ({ experience: 9, caught: false }));
  field.credit(lines, HERE, 1000, undefined, BODY);

  assert.ok(field.corpses.length <= 3, `${field.corpses.length} corpses is too many`);
});

test('claiming and clearing take a body off the ground', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000, undefined, BODY);
  const id = field.corpses[0]!.id;

  field.claim(id, 1500);
  field.clear(id);
  assert.equal(field.corpses.length, 0);
});

test('disarming clears the corpses too', () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  field.credit([{ experience: 10, caught: false }], HERE, 1000, undefined, BODY);
  field.disarm();
  assert.equal(field.corpses.length, 0);
});

// ── roaming ──────────────────────────────────────────────────────────────────

const ROAMERS: WildSpawn[] = [
  { name: 'Bellsprout', species: 'bellsprout', x: 100, y: 100, z: 7, look: 69, radius: 1, speed: 220 },
];

/** A field whose steps take exactly one second, to keep the arithmetic plain. */
const roamField = (spawns: WildSpawn[], radius = 40) =>
  new HuntField({ stepDuration: () => 1000, maxTargets: radius });

const openGround = () => true;

test('a wild Pokemon keeps wandering, not one step and then still', () => {
  // The spawn block's `radius` is where it is placed, not how far it may go.
  // Treating it as a wander limit pinned every Pokemon to a three-by-three
  // box, and inside a forest that is often one legal tile — one step and then
  // nothing. `Monster::getRandomStep` does not check the spawn radius at all.
  const field = roamField(ROAMERS);
  field.arm(ROAMERS, ZONE, HERE);

  let now = 0;
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    now += 1000;
    field.roam(now, openGround);
    const t = field.all[0]!;
    seen.add(`${t.x},${t.y}`);
  }
  assert.ok(seen.size > 8, `only visited ${seen.size} tiles in 200 steps`);
});

test('it will not wander past its leash', () => {
  // config.lua: deSpawnRadius = 30. Past that the server teleports it home.
  const field = new HuntField({ stepDuration: () => 1000, leash: 4 });
  field.arm(ROAMERS, ZONE, HERE);

  for (let now = 1000; now <= 400_000; now += 1000) {
    field.roam(now, openGround);
    const t = field.all[0]!;
    assert.ok(
      Math.max(Math.abs(t.x - t.homeX), Math.abs(t.y - t.homeY)) <= 4,
      `slipped the leash to ${t.x},${t.y}`,
    );
  }
});

test('wandering is cardinal, the way getRandomStep shuffles it', () => {
  const field = roamField(ROAMERS);
  field.arm(ROAMERS, ZONE, HERE);

  let prev = { x: field.all[0]!.x, y: field.all[0]!.y };
  for (let now = 1000; now <= 60_000; now += 1000) {
    field.roam(now, openGround);
    const t = field.all[0]!;
    if (t.x !== prev.x || t.y !== prev.y) {
      assert.ok(
        (t.x === prev.x) !== (t.y === prev.y),
        `stepped diagonally from ${prev.x},${prev.y} to ${t.x},${t.y}`,
      );
      prev = { x: t.x, y: t.y };
    }
  }
});

// ── chasing ──────────────────────────────────────────────────────────────────

test('a wild Pokemon comes after the party rather than milling about', () => {
  const field = roamField(ROAMERS);
  field.arm(ROAMERS, ZONE, HERE);
  const t = field.all[0]!;

  const prey = { x: t.x + 8, y: t.y };
  let now = 0;
  for (let i = 0; i < 20; i++) {
    now += 1000;
    field.roam(now, openGround, prey);
  }

  assert.ok(
    Math.max(Math.abs(t.x - prey.x), Math.abs(t.y - prey.y)) <= 1,
    `stopped at ${t.x},${t.y}, ${prey.x},${prey.y} away`,
  );
});

test('it stops next to its target instead of standing on it', () => {
  // `targetDistance` is 1 in every species' flags in this base.
  const field = roamField(ROAMERS);
  field.arm(ROAMERS, ZONE, HERE);
  const t = field.all[0]!;
  const prey = { x: t.x + 6, y: t.y };

  for (let now = 1000; now <= 60_000; now += 1000) field.roam(now, openGround, prey);
  assert.notDeepEqual([t.x, t.y], [prey.x, prey.y], 'walked onto its target');
  assert.equal(Math.max(Math.abs(t.x - prey.x), Math.abs(t.y - prey.y)), 1);
});

test('a target out of sight is not chased', () => {
  const field = new HuntField({ stepDuration: () => 1000, sight: 3 });
  field.arm(ROAMERS, ZONE, HERE);
  const t = field.all[0]!;
  const home = { x: t.homeX, y: t.homeY };

  // Far away and behind a wall of nothing: it should wander, not make a line.
  const prey = { x: home.x + 40, y: home.y };
  let closer = 0;
  for (let now = 1000; now <= 20_000; now += 1000) {
    field.roam(now, openGround, prey);
    if (t.x > home.x) closer++;
  }
  assert.ok(closer < 15, 'it beelined for something it cannot see');
});

test('a chase sidesteps a blocked tile instead of stopping dead', () => {
  const field = roamField(ROAMERS);
  field.arm(ROAMERS, ZONE, HERE);
  const t = field.all[0]!;
  const home = { x: t.x, y: t.y };
  const prey = { x: t.x + 5, y: t.y };

  // A wall on the straight line between them. With the target dead level the
  // two "either side" directions collapse into the blocked one, so without a
  // perpendicular fallback it would simply stand there.
  const wall = (x: number, y: number) => x !== home.x + 1 || y !== home.y;

  for (let now = 1000; now <= 20_000; now += 1000) field.roam(now, wall, prey);
  assert.notDeepEqual([t.x, t.y], [home.x, home.y], 'never got around the wall');
});

test('a speed of zero means it does not roam rather than roaming glacially', () => {
  const frozen: WildSpawn[] = [{ ...ROAMERS[0]!, speed: 0, radius: 5 }];
  const field = roamField(frozen);
  field.arm(frozen, ZONE, HERE);

  for (let now = 1000; now <= 600_000; now += 1000) field.roam(now, openGround);
  assert.deepEqual([field.all[0]!.x, field.all[0]!.y], [100, 100]);
});

test('it will not step onto ground it cannot stand on', () => {
  const wide: WildSpawn[] = [{ ...ROAMERS[0]!, radius: 5 }];
  const field = roamField(wide);
  field.arm(wide, ZONE, HERE);

  // A corridor one tile tall: anything off row 100 is water.
  const corridor = (_x: number, y: number) => y === 100;

  for (let now = 1000; now <= 200_000; now += 1000) {
    field.roam(now, corridor);
    assert.equal(field.all[0]!.y, 100, 'walked off the corridor');
  }
});

test('each one keeps its own clock so the zone does not move in lockstep', () => {
  const crowd: WildSpawn[] = Array.from({ length: 8 }, (_, i) => ({
    ...ROAMERS[0]!,
    x: 100 + i * 10,
  }));
  const field = roamField(crowd);
  field.arm(crowd, ZONE, { x: 100, y: 100 });

  // One interval in, they have staggered rather than all stepping together.
  field.roam(1000, openGround);
  field.roam(1500, openGround);
  const moved = field.all.filter((t) => t.x !== t.homeX || t.y !== t.homeY).length;
  assert.ok(moved > 0 && moved < field.all.length, `${moved} of ${field.all.length} moved as one`);
});

test('a respawn comes back on its point, not where the last one wandered to', () => {
  const wide: WildSpawn[] = [{ ...ROAMERS[0]!, radius: 5 }];
  const field = roamField(wide);
  field.arm(wide, ZONE, HERE);

  for (let now = 1000; now <= 30_000; now += 1000) field.roam(now, openGround);
  const strayed = field.all[0]!;
  field.credit([{ experience: 1, caught: false }], HERE, 30_000);

  field.update(30_000 + 45_000);
  assert.deepEqual([strayed.x, strayed.y], [strayed.homeX, strayed.homeY]);
});

test('the dead do not wander', () => {
  const field = roamField(ROAMERS);
  field.arm(ROAMERS, ZONE, HERE);
  field.credit([{ experience: 1, caught: false }], HERE, 1000);

  const fallen = field.all[0]!;
  const where = { x: fallen.x, y: fallen.y };
  for (let now = 2000; now <= 40_000; now += 1000) field.roam(now, openGround);
  assert.deepEqual({ x: fallen.x, y: fallen.y }, where);
});

// ── standing close enough to fight ───────────────────────────────────────────

const armed = () => {
  const field = new HuntField();
  field.arm(spawns(), ZONE, HERE);
  return field;
};

test('a party that has not reached anything is not in contact', () => {
  // The simulation resolves encounters on its own clock, so this is what stops
  // wild Pokemon falling while the party is still walking towards them.
  const field = armed();
  assert.equal(field.inContact({ x: 0, y: 0 }), false);
});

test('contact is the tile beside the target', () => {
  const field = armed();
  const target = field.all[0]!;

  assert.equal(field.inContact({ x: target.x + 1, y: target.y }), true);
  assert.equal(field.inContact({ x: target.x + 1, y: target.y + 1 }), true, 'diagonals count');
  assert.equal(field.inContact({ x: target.x + 2, y: target.y }), false);
});

test('a longer reach makes contact sooner', () => {
  // One target, so the answer is about the reach and not about which of them
  // happens to be nearest.
  const field = new HuntField();
  field.arm([{ name: 'Bellsprout', species: 'bellsprout', x: 101, y: 100, z: 7, look: 69 }], ZONE, HERE);

  assert.equal(field.inContact({ x: 104, y: 100 }, 3), true);
  assert.equal(field.inContact({ x: 105, y: 100 }, 3), false);
  assert.equal(field.inContact({ x: 104, y: 100 }), false, 'and one tile is still one tile');
});

test('with everything down there is nothing to be in contact with', () => {
  const field = armed();
  for (const t of field.all) t.diedAt = 1000;
  assert.equal(field.inContact({ x: field.all[0]!.x, y: field.all[0]!.y }), false);
});
