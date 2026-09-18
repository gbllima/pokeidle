/**
 * Every Pokémon the trainer owns, and which six are out.
 *
 * There used to be two disconnected lists: a party built from the starter at
 * boot, and a pile of captures dumped into the bag next to the potions. You
 * could not put a captured Pokémon into your team, and nothing you caught ever
 * became anything. This is one roster instead — the box — with the party as a
 * short ordered list of ids drawn from it.
 *
 * ## Individual values are ours, not the base's
 *
 * `pokemonRank` is the only per-Pokémon quality field the base has, and it is
 * empty on 1,056 of its 1,057 species. There is no IV system in the server or
 * the client, so the six values and the rarity bands below are this game's
 * own. They are written down here rather than scattered so that swapping them
 * for the base's, if one ever appears, is one edit.
 */

/** Six values, each 0..32, so a perfect Pokémon totals 192. */
export const IV_COUNT = 6;
export const IV_MAX = 32;
export const IV_TOTAL = IV_COUNT * IV_MAX;

export type Rarity =
  | 'fraca'
  | 'comum'
  | 'incomum'
  | 'rara'
  | 'epica'
  | 'lendaria'
  | 'mitica'
  | 'ancia'
  | 'divina';

/**
 * Rarity bands, as a share of the maximum total.
 *
 * Deliberately top-heavy: `divina` is the last two percent, so a perfect roll
 * stays something worth keeping rather than something every hunt produces.
 */
const BANDS: Array<{ from: number; rarity: Rarity; label: string; ink: string }> = [
  { from: 0.0, rarity: 'fraca', label: 'Fraca', ink: '#8fa39d' },
  { from: 0.35, rarity: 'comum', label: 'Comum', ink: '#5fdc72' },
  { from: 0.5, rarity: 'incomum', label: 'Incomum', ink: '#5aa9f0' },
  { from: 0.62, rarity: 'rara', label: 'Rara', ink: '#b07af0' },
  { from: 0.72, rarity: 'epica', label: 'Épica', ink: '#f2a13d' },
  { from: 0.82, rarity: 'lendaria', label: 'Lendária', ink: '#f0674a' },
  { from: 0.9, rarity: 'mitica', label: 'Mítica', ink: '#f078c8' },
  { from: 0.96, rarity: 'ancia', label: 'Anciã', ink: '#d8c26a' },
  { from: 0.98, rarity: 'divina', label: 'Divina', ink: '#ffe9a8' },
];

export function rarityOf(ivTotal: number): { rarity: Rarity; label: string; ink: string } {
  const share = Math.min(1, Math.max(0, ivTotal / IV_TOTAL));
  let found = BANDS[0]!;
  for (const band of BANDS) if (share >= band.from) found = band;
  return { rarity: found.rarity, label: found.label, ink: found.ink };
}

export const RARITIES = BANDS.map((b) => ({ rarity: b.rarity, label: b.label, ink: b.ink }));

export type OwnedMon = {
  /** Stable for the life of this Pokémon; two of a species are not the same. */
  id: string;
  slug: string;
  name: string;
  look: number;
  level: number;
  /** 0..1 towards the next level. */
  exp: number;
  hp: number;
  maxHp: number;
  /** Six values, 0..32 each. */
  ivs: number[];
  caughtAt: number;
};

/**
 * Generic in the Pokemon it holds so a caller can keep its own richer type.
 * The game's party members carry their moves and walking speed as well, and
 * these helpers hand those back rather than flattening them to `OwnedMon`.
 */
export type Roster<M extends OwnedMon = OwnedMon> = {
  mons: M[];
  /** Ids of the Pokémon that are out, in order. At most `PARTY_LIMIT`. */
  party: string[];
};

export const PARTY_LIMIT = 6;

export function ivTotal(mon: { ivs: number[] }): number {
  return mon.ivs.reduce((n, v) => n + v, 0);
}

/** Roll a fresh set. `random` is injectable so a test can pin the outcome. */
export function rollIvs(random: () => number = Math.random): number[] {
  return Array.from({ length: IV_COUNT }, () => Math.floor(random() * (IV_MAX + 1)));
}

export function inParty(roster: Roster<any>, id: string): boolean {
  return roster.party.includes(id);
}

export function partyMons<M extends OwnedMon>(roster: Roster<M>): M[] {
  // Ordered by the party list, not by the box: the first one out is the one
  // that leads, and dropping a stale id keeps a corrupt save from crashing.
  return roster.party
    .map((id) => roster.mons.find((m) => m.id === id))
    .filter((m): m is M => m !== undefined);
}

export function boxMons<M extends OwnedMon>(roster: Roster<M>): M[] {
  return roster.mons.filter((m) => !roster.party.includes(m.id));
}

export type MoveResult = { ok: boolean; reason?: 'full' | 'last' | 'missing' };

/** Send one from the box into the team. */
export function toParty(roster: Roster<any>, id: string): MoveResult {
  if (!roster.mons.some((m) => m.id === id)) return { ok: false, reason: 'missing' };
  if (roster.party.includes(id)) return { ok: true };
  if (roster.party.length >= PARTY_LIMIT) return { ok: false, reason: 'full' };
  roster.party.push(id);
  return { ok: true };
}

/**
 * Put one back in the box.
 *
 * The last one cannot leave: a trainer with an empty team has nothing to hunt
 * with, and the hunt loop would have no lead to draw, damage or level.
 */
export function toBox(roster: Roster<any>, id: string): MoveResult {
  const at = roster.party.indexOf(id);
  if (at === -1) return { ok: false, reason: 'missing' };
  if (roster.party.length <= 1) return { ok: false, reason: 'last' };
  roster.party.splice(at, 1);
  return { ok: true };
}

export type SendOutResult = {
  ok: boolean;
  /** Old positions in their new places, for a hunt that tracks health by seat. */
  order?: number[];
  reason?: 'missing' | 'already' | 'fainted';
};

/**
 * Send one of the team out front.
 *
 * Whoever stands first and still has health is the one that fights, so this is
 * how a trainer picks who is out of the ball. The rest keep their order behind
 * them.
 *
 * The permutation comes back with the result because a hunt in progress tracks
 * health by position: the run has to be told to move it the same way, or the
 * Pokemon coming forward inherits the wounds of whoever used to stand there.
 */
export function sendOut(roster: Roster<any>, id: string): SendOutResult {
  const at = roster.party.indexOf(id);
  if (at === -1) return { ok: false, reason: 'missing' };
  if (at === 0) return { ok: false, reason: 'already' };

  const order = [at, ...roster.party.map((_, i) => i).filter((i) => i !== at)];
  roster.party = order.map((i) => roster.party[i]!);
  return { ok: true, order };
}

/** Add a newly caught one. It goes to the box; the player chooses to field it. */
export function addCaught<M extends OwnedMon>(roster: Roster<M>, mon: M): void {
  roster.mons.push(mon);
}

/**
 * Filters the depot offers, applied together.
 *
 * Every field is optional and an absent one means "no opinion", so the same
 * function serves an empty search box and a fully specified one.
 */
export type RosterFilter = {
  text?: string;
  ivFrom?: number;
  ivTo?: number;
  levelFrom?: number;
  levelTo?: number;
  types?: ReadonlySet<string>;
  rarities?: ReadonlySet<Rarity>;
};

export function matches(
  mon: Pick<OwnedMon, 'name' | 'slug' | 'level' | 'ivs'>,
  filter: RosterFilter,
  typesOf: (slug: string) => string[] = () => [],
): boolean {
  if (filter.text) {
    const needle = filter.text.trim().toLowerCase();
    if (needle && !mon.name.toLowerCase().includes(needle)) return false;
  }

  const total = ivTotal(mon);
  if (filter.ivFrom !== undefined && total < filter.ivFrom) return false;
  if (filter.ivTo !== undefined && total > filter.ivTo) return false;
  if (filter.levelFrom !== undefined && mon.level < filter.levelFrom) return false;
  if (filter.levelTo !== undefined && mon.level > filter.levelTo) return false;

  if (filter.rarities?.size && !filter.rarities.has(rarityOf(total).rarity)) return false;

  if (filter.types?.size) {
    const mine = typesOf(mon.slug).map((t) => t.toLowerCase());
    if (!mine.some((t) => filter.types!.has(t))) return false;
  }

  return true;
}
