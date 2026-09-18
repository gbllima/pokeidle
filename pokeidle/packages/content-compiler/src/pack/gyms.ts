import type { NpcRegistry } from '../formats/npcs.ts';
import type { Species, SpeciesRegistry } from '../formats/species.ts';
import { movesetDps } from '../formats/species.ts';

/**
 * Gym leaders and their teams.
 *
 * The base already models leader rosters as npcs named `<Leader>'s <Species>`,
 * so a team is read rather than invented wherever one exists. Five of the
 * eight Kanto leaders have no roster at all, and those are filled by a stated
 * rule from the species registry — flagged as authored so nobody mistakes a
 * generated team for the base's own content.
 */

export type GymDef = {
  order: number;
  city: string;
  leader: string;
  type: string;
  badge: string;
};

/** The eight Kanto gyms, in badge order. */
export const KANTO_GYMS: GymDef[] = [
  { order: 1, city: 'Pewter', leader: 'Brock', type: 'rock', badge: 'Pedra' },
  { order: 2, city: 'Cerulean', leader: 'Misty', type: 'water', badge: 'Cascata' },
  { order: 3, city: 'Vermilion', leader: 'Lt. Surge', type: 'electric', badge: 'Trovão' },
  { order: 4, city: 'Celadon', leader: 'Erika', type: 'grass', badge: 'Arco-íris' },
  { order: 5, city: 'Fuchsia', leader: 'Koga', type: 'poison', badge: 'Alma' },
  { order: 6, city: 'Saffron', leader: 'Sabrina', type: 'psychic', badge: 'Pântano' },
  { order: 7, city: 'Cinnabar', leader: 'Blaine', type: 'fire', badge: 'Vulcão' },
  { order: 8, city: 'Viridian', leader: 'Giovanni', type: 'ground', badge: 'Terra' },
];

export type GymMember = {
  slug: string;
  name: string;
  look: number;
  types: string[];
  hp: number;
  level: number;
  dps: number;
  moves: Array<[string, number, number, string]>;
};

export type Gym = GymDef & {
  /** True when the roster came from `<Leader>'s <Species>` npcs. */
  fromBase: boolean;
  leaderLook: number;
  team: GymMember[];
};

export type GymBuild = {
  gyms: Gym[];
  /** Leaders whose roster had to be generated, and how many members. */
  authored: Array<{ leader: string; count: number }>;
  /** Team npcs that named a species the registry does not have. */
  unresolved: string[];
};

const TEAM_SIZE = 5;

function toMember(sp: Species, level: number): GymMember {
  return {
    slug: sp.slug,
    name: sp.name,
    look: sp.lookType,
    types: sp.type2 ? [sp.type1, sp.type2] : [sp.type1],
    hp: sp.health,
    level,
    dps: Math.round(movesetDps(sp.moves) * 100) / 100,
    moves: sp.moves.slice(0, 6).map((mv) => [mv.name, mv.power, mv.interval, mv.type ?? '']),
  };
}

export function buildGyms(
  registry: SpeciesRegistry,
  npcs: NpcRegistry,
  gyms: GymDef[] = KANTO_GYMS,
): GymBuild {
  const authored: GymBuild['authored'] = [];
  const unresolved: string[] = [];

  /**
   * Candidates for filling a bare roster: species of the gym's element,
   * ordered by how close they sit to the level that gym is meant to be.
   *
   * "Strongest of the type" was the obvious rule and it is wrong — it hands
   * the third gym Raikou and Zapdos. Nothing in the data marks a legendary:
   * Raikou reports `minimumLevel` 1 and the same catch chance as Pikachu. The
   * one clean signal is health, where twenty species sit above a million while
   * ordinary ones are in the thousands.
   */
  const candidates = (type: string, targetLevel: number): Species[] =>
    registry.all
      .filter((sp) => sp.variant === 'base' && sp.lookType > 0)
      .filter((sp) => sp.type1 === type || sp.type2 === type)
      .filter((sp) => sp.health <= 1_000_000 && sp.catchChance > 0)
      .sort(
        (a, b) =>
          Math.abs(a.minimumLevel - targetLevel) - Math.abs(b.minimumLevel - targetLevel) ||
          b.health - a.health ||
          a.name.localeCompare(b.name),
      );

  const built: Gym[] = gyms.map((def) => {
    const prefix = `${def.leader.toLowerCase()}'s `;

    // The base's own roster, if it modelled one.
    const owned = npcs.all
      .filter((n) => n.slug.startsWith(prefix))
      .map((n) => n.name.slice(def.leader.length + 2).trim());

    const team: GymMember[] = [];
    for (const speciesName of owned) {
      const sp = registry.byName.get(speciesName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      if (!sp) {
        unresolved.push(`${def.leader}'s ${speciesName}`);
        continue;
      }
      // Level rises with the gym's place in the badge order.
      team.push(toMember(sp, def.order * 12));
    }

    const fromBase = team.length > 0;

    if (team.length < TEAM_SIZE) {
      // Fill by the stated rule, skipping anything already on the roster.
      const have = new Set(team.map((m) => m.slug));
      for (const sp of candidates(def.type, def.order * 12)) {
        if (team.length >= TEAM_SIZE) break;
        if (have.has(sp.slug)) continue;
        team.push(toMember(sp, def.order * 12));
        have.add(sp.slug);
      }
      const generated = team.length - owned.length;
      if (generated > 0) authored.push({ leader: def.leader, count: generated });
    }

    return {
      ...def,
      fromBase,
      leaderLook: npcs.byName.get(def.leader.toLowerCase())?.lookType ?? 0,
      team,
    };
  });

  return { gyms: built, authored, unresolved };
}
