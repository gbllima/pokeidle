/**
 * The `balls` table from `servidor/data/lib/core/newfunctions.lua`.
 *
 * This is the table `catch.lua` reads on every throw. `getBallKey` matches the
 * item in hand against `emptyId`, `usedOn` or `usedOff`, and the catch is
 *
 * ```lua
 * local chance = monsterType:catchChance() * balls[ballKey].chanceMultiplier
 * local caught = math.random(0, 10000) <= chance
 * ```
 *
 * so `chanceMultiplier` is the whole difference between one ball and another,
 * and the effects and missile are what the throw looks like.
 *
 * A commented-out entry is skipped: the file carries a few (`gengar`,
 * `abobora`, `natalina`) that the server itself does not load.
 */

export type BallDef = {
  key: string;
  /** Item held before the throw. Zero for entries that have none. */
  emptyId: number;
  /** The filled ball, with a Pokemon in it. */
  usedOn: number;
  usedOff: number;
  /** Magic effect at the corpse when the throw fails, and when it works. */
  effectFail: number;
  effectSucceed: number;
  /** Distance effect that flies from the trainer to the body. */
  missile: number;
  /** Effect played where the Pokemon comes back out of the ball. */
  effectRelease: number;
  /** Multiplies the species' own catch chance. */
  chanceMultiplier: number;
};

const FIELDS = [
  'emptyId',
  'usedOn',
  'usedOff',
  'effectFail',
  'effectSucceed',
  'missile',
  'effectRelease',
  'chanceMultiplier',
] as const;

/** Pull `balls = { ... }` out of the Lua source and read every live entry. */
export function parseBalls(source: string): BallDef[] {
  const start = source.search(/^balls\s*=\s*\{/m);
  if (start === -1) return [];

  // Walk to the matching brace rather than trusting the first `}`: entries are
  // themselves tables.
  let depth = 0;
  let end = -1;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];

  const out: BallDef[] = [];
  for (const raw of source.slice(start, end).split('\n')) {
    const line = raw.trim();
    if (line.startsWith('--')) continue;

    const entry = /^(\w+)\s*=\s*\{([^}]*)\}/.exec(line);
    if (!entry) continue;

    const body = entry[2]!;
    const ball: BallDef = {
      key: entry[1]!,
      emptyId: 0,
      usedOn: 0,
      usedOff: 0,
      effectFail: 0,
      effectSucceed: 0,
      missile: 0,
      effectRelease: 0,
      chanceMultiplier: 0,
    };

    for (const field of FIELDS) {
      const found = new RegExp(`\\b${field}\\s*=\\s*(-?[\\d.]+)`).exec(body);
      if (found) ball[field] = Number(found[1]);
    }

    out.push(ball);
  }

  return out;
}
