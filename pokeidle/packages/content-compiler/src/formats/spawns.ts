import { readFileSync } from 'node:fs';

/**
 * Reader for map-spawn.xml.
 *
 * Children carry x/y as offsets from their parent spawn centre, but z is
 * absolute. Getting that wrong silently places everything at the origin.
 */

export type SpawnEntry = {
  name: string;
  x: number;
  y: number;
  z: number;
  spawntime: number;
  /** Radius of the parent spawn point. */
  radius: number;
};

export type SpawnFile = {
  monsters: SpawnEntry[];
  npcs: SpawnEntry[];
  /** Distinct monster names, lowercased. */
  species: Set<string>;
  points: number;
  /** Entries whose spawntime was nonsense and had to be replaced. */
  repairedSpawntimes: number;
  /** Entries whose own `z` disagreed with their spawn's `centerz`. */
  floorDisagreements: number;
};

/**
 * Sane bounds for a respawn timer, in seconds.
 *
 * The shipped map-spawn.xml contains values like -1885237504 and 1749162496 —
 * garbage some editor wrote. Left alone they poison every hunt built on the
 * affected zone, and a negative respawn makes the simulation nonsensical.
 */
const MIN_SPAWNTIME = 1;
const MAX_SPAWNTIME = 3600;
const DEFAULT_SPAWNTIME = 60;

const SPAWN_RE = /<spawn\b([^>]*)>([\s\S]*?)<\/spawn>|<spawn\b([^>]*)\/>/g;
const CHILD_RE = /<(monster|npc)\b([^>]*)\/?>/g;

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) out[m[1]!] = m[2]!;
  return out;
}

const num = (v: string | undefined, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function loadSpawns(path: string): SpawnFile {
  const xml = readFileSync(path, 'latin1');

  const monsters: SpawnEntry[] = [];
  const npcs: SpawnEntry[] = [];
  const species = new Set<string>();
  let points = 0;
  let repairedSpawntimes = 0;
  let floorDisagreements = 0;

  let sm: RegExpExecArray | null;
  SPAWN_RE.lastIndex = 0;
  while ((sm = SPAWN_RE.exec(xml)) !== null) {
    const head = attrs(sm[1] ?? sm[3] ?? '');
    const body = sm[2] ?? '';
    points++;

    const cx = num(head.centerx);
    const cy = num(head.centery);
    const cz = num(head.centerz);
    const radius = num(head.radius);

    let cm: RegExpExecArray | null;
    CHILD_RE.lastIndex = 0;
    while ((cm = CHILD_RE.exec(body)) !== null) {
      const kind = cm[1]!;
      const a = attrs(cm[2] ?? '');
      const name = (a.name ?? '').trim();
      if (!name) continue;

      const rawSpawntime = num(a.spawntime, DEFAULT_SPAWNTIME);
      const sane =
        Number.isInteger(rawSpawntime) &&
        rawSpawntime >= MIN_SPAWNTIME &&
        rawSpawntime <= MAX_SPAWNTIME;
      if (!sane) repairedSpawntimes++;

      // The floor comes from the spawn's centerz, never the child's own z.
      // Spawns::loadFromXml builds every position as
      // `Position(centerPos.x + child.x, centerPos.y + child.y, centerPos.z)`,
      // so a child z that disagrees is simply ignored by the server — and
      // trusting it puts creatures on a floor that has no tiles.
      if (a.z !== undefined && num(a.z) !== cz) floorDisagreements++;

      const entry: SpawnEntry = {
        name,
        x: cx + num(a.x),
        y: cy + num(a.y),
        z: cz,
        spawntime: sane ? rawSpawntime : DEFAULT_SPAWNTIME,
        radius,
      };

      if (kind === 'monster') {
        monsters.push(entry);
        species.add(name.toLowerCase());
      } else {
        npcs.push(entry);
      }
    }
  }

  return { monsters, npcs, species, points, repairedSpawntimes, floorDisagreements };
}
