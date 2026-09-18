import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IV_TOTAL,
  IV_MAX,
  PARTY_LIMIT,
  rarityOf,
  rollIvs,
  ivTotal,
  partyMons,
  boxMons,
  toParty,
  toBox,
  addCaught,
  sendOut,
  matches,
  type OwnedMon,
  type Roster,
} from '../src/roster.ts';

let next = 0;
const mon = (over: Partial<OwnedMon> = {}): OwnedMon => ({
  id: `m${++next}`,
  slug: 'bellsprout',
  name: 'Bellsprout',
  look: 69,
  level: 1,
  exp: 0,
  hp: 100,
  maxHp: 100,
  ivs: [16, 16, 16, 16, 16, 16],
  caughtAt: 0,
  ...over,
});

const rosterOf = (mons: OwnedMon[], party: string[] = []): Roster => ({ mons, party });

// ── rarity ───────────────────────────────────────────────────────────────────

test('rarity runs from weak to divine across the whole range', () => {
  assert.equal(rarityOf(0).rarity, 'fraca');
  assert.equal(rarityOf(IV_TOTAL).rarity, 'divina');
});

test('a perfect roll is divine and a middling one is unremarkable', () => {
  assert.equal(rarityOf(IV_TOTAL).label, 'Divina');
  // Half of maximum is the bottom of `incomum`; the point is that it is
  // nowhere near the bands worth keeping.
  assert.equal(rarityOf(IV_TOTAL / 2).label, 'Incomum');
  for (const middling of [40, 96, 110]) {
    assert.ok(
      !['epica', 'lendaria', 'mitica', 'ancia', 'divina'].includes(rarityOf(middling).rarity),
      `${middling} should not be a prize`,
    );
  }
});

test('the top bands are narrow, so a good one stays worth keeping', () => {
  // Divine is the last two percent. If it were a fifth of the range every
  // hunt would produce one and the label would mean nothing.
  const divine = [];
  for (let total = 0; total <= IV_TOTAL; total++) {
    if (rarityOf(total).rarity === 'divina') divine.push(total);
  }
  assert.ok(divine.length / (IV_TOTAL + 1) < 0.05, `${divine.length} of ${IV_TOTAL} is too wide`);
});

test('rarity never falls back a band as the total climbs', () => {
  const order = ['fraca', 'comum', 'incomum', 'rara', 'epica', 'lendaria', 'mitica', 'ancia', 'divina'];
  let seen = -1;
  for (let total = 0; total <= IV_TOTAL; total++) {
    const at = order.indexOf(rarityOf(total).rarity);
    assert.ok(at >= seen, `total ${total} went backwards to ${rarityOf(total).rarity}`);
    seen = at;
  }
});

test('an out-of-range total is clamped rather than falling off the end', () => {
  assert.equal(rarityOf(-50).rarity, 'fraca');
  assert.equal(rarityOf(9999).rarity, 'divina');
});

// ── values ───────────────────────────────────────────────────────────────────

test('a roll produces six values, each within range', () => {
  const ivs = rollIvs();
  assert.equal(ivs.length, 6);
  for (const v of ivs) assert.ok(v >= 0 && v <= IV_MAX, `${v} is out of range`);
});

test('a maximum roll totals exactly the maximum', () => {
  assert.equal(ivTotal({ ivs: rollIvs(() => 0.9999) }), IV_TOTAL);
  assert.equal(ivTotal({ ivs: rollIvs(() => 0) }), 0);
});

// ── party and box ────────────────────────────────────────────────────────────

test('everything caught is in the box until it is fielded', () => {
  const a = mon();
  const roster = rosterOf([a]);

  assert.deepEqual(boxMons(roster).map((m) => m.id), [a.id]);
  assert.deepEqual(partyMons(roster), []);
});

test('sending one to the party takes it out of the box', () => {
  const a = mon();
  const roster = rosterOf([a]);

  assert.deepEqual(toParty(roster, a.id), { ok: true });
  assert.deepEqual(partyMons(roster).map((m) => m.id), [a.id]);
  assert.deepEqual(boxMons(roster), []);
});

test('the party holds six and refuses a seventh', () => {
  const mons = Array.from({ length: 7 }, () => mon());
  const roster = rosterOf(mons);

  for (let i = 0; i < PARTY_LIMIT; i++) assert.equal(toParty(roster, mons[i]!.id).ok, true);
  assert.deepEqual(toParty(roster, mons[6]!.id), { ok: false, reason: 'full' });
  assert.equal(roster.party.length, PARTY_LIMIT);
});

test('the last one out cannot be boxed', () => {
  // An empty team has nothing to hunt with, and the hunt has no lead to draw,
  // damage or level.
  const a = mon();
  const roster = rosterOf([a], [a.id]);

  assert.deepEqual(toBox(roster, a.id), { ok: false, reason: 'last' });
  assert.equal(roster.party.length, 1);
});

test('one of two can go back to the box', () => {
  const a = mon();
  const b = mon();
  const roster = rosterOf([a, b], [a.id, b.id]);

  assert.equal(toBox(roster, b.id).ok, true);
  assert.deepEqual(partyMons(roster).map((m) => m.id), [a.id]);
  assert.deepEqual(boxMons(roster).map((m) => m.id), [b.id]);
});

test('the party keeps its own order, not the box order', () => {
  const a = mon();
  const b = mon();
  const c = mon();
  const roster = rosterOf([a, b, c], [c.id, a.id]);

  assert.deepEqual(partyMons(roster).map((m) => m.id), [c.id, a.id]);
});

test('a party id with no Pokemon behind it is skipped, not crashed on', () => {
  const a = mon();
  const roster = rosterOf([a], ['gone', a.id]);
  assert.deepEqual(partyMons(roster).map((m) => m.id), [a.id]);
});

test('moving one that is not owned is refused', () => {
  const roster = rosterOf([mon()]);
  assert.deepEqual(toParty(roster, 'nobody'), { ok: false, reason: 'missing' });
  assert.deepEqual(toBox(roster, 'nobody'), { ok: false, reason: 'missing' });
});

test('fielding one already out changes nothing', () => {
  const a = mon();
  const roster = rosterOf([a], [a.id]);
  assert.deepEqual(toParty(roster, a.id), { ok: true });
  assert.equal(roster.party.length, 1);
});

test('a capture lands in the box, never straight into a full team', () => {
  const mons = Array.from({ length: PARTY_LIMIT }, () => mon());
  const roster = rosterOf(mons, mons.map((m) => m.id));

  const fresh = mon({ name: 'Caterpie' });
  addCaught(roster, fresh);

  assert.equal(roster.party.length, PARTY_LIMIT);
  assert.deepEqual(boxMons(roster).map((m) => m.name), ['Caterpie']);
});

// ── filters ──────────────────────────────────────────────────────────────────

const typesOf = (slug: string) => (slug === 'bellsprout' ? ['grass', 'poison'] : ['fire']);

test('an empty filter keeps everything', () => {
  assert.equal(matches(mon(), {}, typesOf), true);
});

test('the search box matches on name, case-insensitively', () => {
  assert.equal(matches(mon(), { text: 'BELL' }, typesOf), true);
  assert.equal(matches(mon(), { text: 'char' }, typesOf), false);
  assert.equal(matches(mon(), { text: '   ' }, typesOf), true, 'blank means no opinion');
});

test('the IV and level ranges are inclusive at both ends', () => {
  const m = mon({ ivs: [10, 10, 10, 10, 10, 10], level: 20 }); // total 60

  assert.equal(matches(m, { ivFrom: 60, ivTo: 60 }, typesOf), true);
  assert.equal(matches(m, { ivFrom: 61 }, typesOf), false);
  assert.equal(matches(m, { ivTo: 59 }, typesOf), false);
  assert.equal(matches(m, { levelFrom: 20, levelTo: 20 }, typesOf), true);
  assert.equal(matches(m, { levelFrom: 21 }, typesOf), false);
});

test('a type filter matches any of the species types', () => {
  assert.equal(matches(mon(), { types: new Set(['poison']) }, typesOf), true);
  assert.equal(matches(mon(), { types: new Set(['water']) }, typesOf), false);
});

test('a rarity filter matches the band the total falls in', () => {
  const perfect = mon({ ivs: [32, 32, 32, 32, 32, 32] });
  assert.equal(matches(perfect, { rarities: new Set(['divina' as const]) }, typesOf), true);
  assert.equal(matches(perfect, { rarities: new Set(['fraca' as const]) }, typesOf), false);
});

test('filters combine rather than override one another', () => {
  const m = mon({ level: 30, ivs: [20, 20, 20, 20, 20, 20] });
  assert.equal(matches(m, { text: 'bell', levelFrom: 10, ivFrom: 100 }, typesOf), true);
  assert.equal(matches(m, { text: 'bell', levelFrom: 40, ivFrom: 100 }, typesOf), false);
});

// ── choosing who is out ──────────────────────────────────────────────────────

test('sending one out puts it in front and keeps the rest in order', () => {
  const a = mon();
  const b = mon();
  const c = mon();
  const roster = rosterOf([a, b, c], [a.id, b.id, c.id]);

  const moved = sendOut(roster, c.id);
  assert.deepEqual(moved, { ok: true, order: [2, 0, 1] });
  assert.deepEqual(partyMons(roster).map((m) => m.id), [c.id, a.id, b.id]);
});

test('the permutation is what a running hunt needs to move health by', () => {
  // Old positions in their new places: whoever was second now leads.
  const a = mon();
  const b = mon();
  const roster = rosterOf([a, b], [a.id, b.id]);
  assert.deepEqual(sendOut(roster, b.id).order, [1, 0]);
});

test('sending out the one already out changes nothing', () => {
  const a = mon();
  const b = mon();
  const roster = rosterOf([a, b], [a.id, b.id]);

  assert.deepEqual(sendOut(roster, a.id), { ok: false, reason: 'already' });
  assert.deepEqual(roster.party, [a.id, b.id]);
});

test('one sitting in the box cannot be sent out from the field', () => {
  const a = mon();
  const boxed = mon();
  const roster = rosterOf([a, boxed], [a.id]);

  assert.deepEqual(sendOut(roster, boxed.id), { ok: false, reason: 'missing' });
  assert.deepEqual(roster.party, [a.id]);
});
