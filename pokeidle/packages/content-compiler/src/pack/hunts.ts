import type { SpeciesRegistry, Species } from '../formats/species.ts';
import { slugify } from '../formats/species.ts';
import type { SpawnEntry, SpawnFile } from '../formats/spawns.ts';

/**
 * Hunt definitions derived from the server's own spawn data.
 *
 * The product has one city; everything else the player reaches is a hunt
 * zone. Rather than authoring those by hand, they are clustered out of
 * map-spawn.xml so a zone always corresponds to somewhere the live server
 * actually spawns that species.
 */

export type HuntZone = {
  id: string;
  species: string;
  displayName: string;
  variant: string;
  region: string;
  z: number;
  box: { minX: number; minY: number; maxX: number; maxY: number };
  center: { x: number; y: number; z: number };
  /** Distinct spawn points in the cluster. */
  points: number;
  /** Total monsters those points place. */
  population: number;
  /** Shortest respawn among the cluster's points, in seconds. */
  respawnSeconds: number;
  requiredLevel: number;
  types: string[];
  baseExperience: number;
  wildHealth: number;
  /**
   * Damage per second the wild one puts out, from `pokemon.attacks`.
   *
   * `pokemon.attacks` and not `pokemon.moves`: the first is how the species
   * behaves in the wild and carries a per-move `chance`, the second is the
   * shorter-cooldown list a captured one fights with. Using the player's list
   * here would have wild Pokémon hitting harder than they do in the base.
   */
  wildDps: number;
  catchChance: number;
  lootPreview: string[];
};

export type HuntBuild = {
  zones: HuntZone[];
  /** Spawn names that match no script in data/monster. */
  unresolved: Map<string, number>;
  /** Species with a script but no spawn anywhere on the map. */
  neverSpawned: string[];
};

/**
 * Resolve a spawn name to a species, honouring the shiny/mega prefixes.
 *
 * Necessary because 42 scripts register a name that disagrees with their
 * folder, so a plain slug lookup would hand back the wrong stat block.
 */
export function resolveSpecies(reg: SpeciesRegistry, spawnName: string): Species | undefined {
  const slug = slugify(spawnName);

  if (slug.startsWith('shiny-')) {
    const hit = reg.variants.get(`shiny:${slug.slice(6)}`);
    if (hit) return hit;
  }
  if (slug.startsWith('mega-')) {
    const hit = reg.variants.get(`mega:${slug.slice(5)}`);
    if (hit) return hit;
  }

  return reg.byName.get(slug) ?? reg.variants.get(`shiny:${slug}`) ?? reg.variants.get(`mega:${slug}`);
}

/**
 * Single-link clustering over Chebyshev distance, per species per floor.
 *
 * Spawn points for one species sit in tight pockets, so anything within
 * `threshold` tiles belongs to the same huntable area. Clusters stay small,
 * which is why the quadratic inner loop is not a problem here.
 */
function cluster(entries: SpawnEntry[], threshold: number): SpawnEntry[][] {
  const remaining = [...entries];
  const clusters: SpawnEntry[][] = [];

  while (remaining.length > 0) {
    const group = [remaining.pop()!];
    let grew = true;

    while (grew) {
      grew = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const candidate = remaining[i]!;
        const near = group.some(
          (g) =>
            Math.max(Math.abs(g.x - candidate.x), Math.abs(g.y - candidate.y)) <= threshold,
        );
        if (near) {
          group.push(candidate);
          remaining.splice(i, 1);
          grew = true;
        }
      }
    }

    clusters.push(group);
  }

  return clusters;
}

export type HuntOptions = {
  /** Tiles between spawn points that still count as one zone. */
  threshold?: number;
  /** Drop clusters smaller than this, they are strays not huntable areas. */
  minPoints?: number;
};

/**
 * Sustained output of a species' wild move set.
 *
 * Each attack lands `power` every `interval` ms, `chance` percent of the
 * time. Same shape as the party's own rate, so the two are comparable.
 */
function attackDps(species: { attacks: Array<{ power: number; interval: number; chance: number }> }): number {
  let dps = 0;
  for (const a of species.attacks) {
    if (a.interval > 0) dps += (a.power * (a.chance / 100)) / (a.interval / 1000);
  }
  return dps;
}

export function buildHunts(
  spawns: SpawnFile,
  registry: SpeciesRegistry,
  opts: HuntOptions = {},
): HuntBuild {
  const threshold = opts.threshold ?? 30;
  const minPoints = opts.minPoints ?? 2;

  const byKey = new Map<string, SpawnEntry[]>();
  const unresolved = new Map<string, number>();
  const seenSpecies = new Set<string>();

  for (const entry of spawns.monsters) {
    const species = resolveSpecies(registry, entry.name);
    if (!species) {
      unresolved.set(entry.name, (unresolved.get(entry.name) ?? 0) + 1);
      continue;
    }
    seenSpecies.add(`${species.variant}:${species.slug}`);
    const key = `${species.variant}:${species.slug}:${entry.z}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(entry);
    else byKey.set(key, [entry]);
  }

  const zones: HuntZone[] = [];

  for (const [key, entries] of byKey) {
    const [variant, slug, zStr] = key.split(':');
    const species = registry.variants.get(`${variant}:${slug}`)!;
    const z = Number(zStr);

    const groups = cluster(entries, threshold).filter((g) => g.length >= minPoints);
    groups.sort((a, b) => b.length - a.length);

    groups.forEach((group, index) => {
      const xs = group.map((g) => g.x);
      const ys = group.map((g) => g.y);
      const box = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };

      zones.push({
        id: `${species.slug}-${variant}-z${z}-${index + 1}`,
        species: species.slug,
        displayName: species.name,
        variant,
        region: species.region,
        z,
        box,
        center: {
          x: Math.round((box.minX + box.maxX) / 2),
          y: Math.round((box.minY + box.maxY) / 2),
          z,
        },
        points: group.length,
        population: group.length,
        respawnSeconds: Math.min(...group.map((g) => g.spawntime)),
        requiredLevel: species.minimumLevel,
        types: species.type2 ? [species.type1, species.type2] : [species.type1],
        baseExperience: species.experience,
        wildHealth: Math.round(species.health * species.wildHealthMultiplier),
        wildDps: Math.round(attackDps(species) * 100) / 100,
        catchChance: species.catchChance,
        lootPreview: species.loot.slice(0, 5).map((l) => l.id),
      });
    });
  }

  zones.sort(
    (a, b) => a.requiredLevel - b.requiredLevel || b.population - a.population || a.id.localeCompare(b.id),
  );

  const neverSpawned = registry.all
    .filter((s) => !seenSpecies.has(`${s.variant}:${s.slug}`))
    .map((s) => s.name);

  return { zones, unresolved, neverSpawned };
}
