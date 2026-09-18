import { readFileSync, existsSync } from 'node:fs';

/**
 * Per-thing metadata the dat does not carry.
 *
 * `data/things/1098/effects.otml` (and its item/outfit siblings) is loaded by
 * `ThingTypeManager::loadOtml` and applied on top of what the dat says. For
 * effects it holds the piece that makes them land where they belong:
 *
 *   effects:
 *     806:
 *       effect-displacement: x: 33.0, y: 4.0, opacity: 1.0, top: false
 *
 * `Effect::draw` adds that displacement to the destination before drawing.
 * Flamethrower's four facings are all in this file, offset by up to 43 pixels
 * — draw them without it and the plume sits a tile and a half off its mark.
 *
 * This is a different mechanism from the dat's own `displacement` attribute,
 * which the client reads separately as `getDisplacement()`.
 */

export type ThingMeta = {
  /** Pixels added to the draw position. */
  x: number;
  y: number;
  /** 0..1. The client multiplies the effect's colour by this. */
  opacity: number;
  /** Drawn above the creatures on the tile rather than under them. */
  top: boolean;
};

export type ThingMetaSet = {
  effect: Map<number, ThingMeta>;
  item: Map<number, ThingMeta>;
};

/** `x: 33.0, y: 4.0, opacity: 1.0, top: false` */
function parseInline(value: string): Partial<ThingMeta> {
  const out: Partial<ThingMeta> = {};
  for (const pair of value.split(',')) {
    const [rawKey, rawValue] = pair.split(':');
    if (!rawKey || rawValue === undefined) continue;
    const key = rawKey.trim();
    const text = rawValue.trim();
    if (key === 'x') out.x = Number(text);
    else if (key === 'y') out.y = Number(text);
    else if (key === 'opacity') out.opacity = Number(text);
    else if (key === 'top') out.top = text === 'true';
  }
  return out;
}

/**
 * Read one of the client's thing OTML files.
 *
 * Indentation-structured, two levels deep: a category, then an id, then the
 * attributes. Parsed by tracking the current id rather than building a tree —
 * the file is flat enough that a tree would be ceremony.
 */
export function loadThingOtml(path: string): Map<number, ThingMeta> {
  const out = new Map<number, ThingMeta>();
  if (!existsSync(path)) return out;

  let current: number | null = null;

  for (const raw of readFileSync(path, 'latin1').split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('//')) continue;

    const id = /^\s+(\d+):\s*$/.exec(line);
    if (id) {
      current = Number(id[1]);
      continue;
    }

    const displacement = /^\s+(effect|item)-displacement:\s*(.+)$/.exec(line);
    if (displacement && current !== null) {
      const parsed = parseInline(displacement[2]!);
      out.set(current, {
        x: parsed.x ?? 0,
        y: parsed.y ?? 0,
        opacity: parsed.opacity ?? 1,
        top: parsed.top ?? false,
      });
    }
  }

  return out;
}
