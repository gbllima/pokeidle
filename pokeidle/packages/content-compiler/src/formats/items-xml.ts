import { readFileSync } from 'node:fs';

/**
 * Reader for data/items/items.xml.
 *
 * Loot tables reference items by name, not id, so the name index is the only
 * way to turn a drop into something with an icon. `items.otb` carries names
 * too, but only for 43 entries — the xml is the real registry.
 */

export type ItemDef = {
  name: string;
  serverId: number;
  /** Set when the entry declares a range rather than a single id. */
  toId?: number;
  article?: string;
  /**
   * Seconds the item lasts before it decays away, from its `duration`
   * attribute. A Pokemon corpse carries one — `fainted chikorita` lasts 30
   * seconds — and that is the window a player has to throw a ball at it.
   */
  duration?: number;
};

export type ItemXml = {
  byName: Map<string, ItemDef>;
  /** The same entries, addressed by server id. */
  bySid: Map<number, ItemDef>;
  entries: number;
};

const ITEM_RE = /<item\s+([^>]*?)\/?>/gi;

function attr(raw: string, key: string): string | undefined {
  return new RegExp(`\\b${key}\\s*=\\s*"([^"]*)"`, 'i').exec(raw)?.[1];
}

export function loadItemsXml(path: string): ItemXml {
  const xml = readFileSync(path, 'latin1');
  const byName = new Map<string, ItemDef>();
  const bySid = new Map<number, ItemDef>();
  let entries = 0;

  let m: RegExpExecArray | null;
  ITEM_RE.lastIndex = 0;
  while ((m = ITEM_RE.exec(xml)) !== null) {
    const raw = m[1] ?? '';
    const name = attr(raw, 'name')?.toLowerCase().trim();
    if (!name) continue;

    const id = Number(attr(raw, 'id') ?? attr(raw, 'fromid'));
    if (!Number.isFinite(id) || id <= 0) continue;

    entries++;
    // First definition wins: later duplicates are usually range aliases.
    if (byName.has(name)) continue;

    // `duration` is a child element, not an attribute of the tag, so it is
    // read out of the slice between this item and the next one.
    const nextItem = xml.indexOf('<item', m.index + 1);
    const body = xml.slice(m.index, nextItem === -1 ? undefined : nextItem);
    const duration = Number(
      /<attribute\s+key\s*=\s*"duration"\s+value\s*=\s*"(\d+)"/i.exec(body)?.[1],
    );

    const toId = Number(attr(raw, 'toid'));
    const def: ItemDef = {
      name,
      serverId: id,
      ...(Number.isFinite(toId) && toId > id ? { toId } : {}),
      ...(attr(raw, 'article') ? { article: attr(raw, 'article') } : {}),
      ...(Number.isFinite(duration) && duration > 0 ? { duration } : {}),
    };
    byName.set(name, def);
    if (!bySid.has(id)) bySid.set(id, def);
  }

  return { byName, bySid, entries };
}
