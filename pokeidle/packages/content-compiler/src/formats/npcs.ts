import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/**
 * Reader for the NPC definitions in servidor/data/npc.
 *
 * Only what the renderer needs: the registered name and the outfit. Dialogue,
 * shop tables and scripts stay on the server.
 */

export type NpcDef = {
  name: string;
  slug: string;
  file: string;
  lookType: number;
  head: number;
  body: number;
  legs: number;
  feet: number;
  addons: number;
  /** Set when the npc renders as an item rather than an outfit. */
  lookTypeEx: number;
  /** True when the xml declares a shop module. */
  hasShop: boolean;
  /** What the npc sells to the player, and what it buys back. */
  shop: NpcShop;
  script: string;
};

/**
 * A trade list, straight out of the npc's own `shop_buyable` /
 * `shop_sellable` parameters:
 *
 *   <parameter key="shop_buyable" value="
 *     empty poke ball, 12157, 8;
 *     empty great ball, 12161, 35;
 *   "/>
 *
 * Name, server id, price, semicolon-separated. This is the whole economy of
 * the base written down in one place — Mark sells the balls a capture spends
 * and buys back the loot a hunt drops.
 */
export type ShopEntry = { name: string; serverId: number; price: number };
export type NpcShop = { buy: ShopEntry[]; sell: ShopEntry[] };

export type NpcDuplicate = {
  slug: string;
  chosen: string;
  rejected: string[];
};

export type NpcRegistry = {
  byName: Map<string, NpcDef>;
  all: NpcDef[];
  unreadable: string[];
  /**
   * Names declared by more than one file. Real in this base: Jack.xml,
   * Mark.xml and Mark_backup.xml all register an npc called "Mark", with
   * different outfits. Picking by filename keeps it deterministic instead of
   * depending on directory order.
   */
  duplicates: NpcDuplicate[];
};

/** A file named after the npc it declares beats one that is not. */
function preference(def: NpcDef): number {
  const stem = basename(def.file).replace(/\.xml$/i, '').toLowerCase();
  if (stem === def.slug) return 0;
  if (stem.replace(/_backup$/, '') === def.slug) return 2;
  return 1;
}

function better(a: NpcDef, b: NpcDef): NpcDef {
  const pa = preference(a);
  const pb = preference(b);
  if (pa !== pb) return pa < pb ? a : b;
  const la = basename(a.file).length;
  const lb = basename(b.file).length;
  if (la !== lb) return la < lb ? a : b;
  return basename(a.file).localeCompare(basename(b.file)) <= 0 ? a : b;
}

const slug = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

const attr = (raw: string, key: string): string | undefined =>
  new RegExp(`\\b${key}\\s*=\\s*"([^"]*)"`, 'i').exec(raw)?.[1];

const numAttr = (raw: string, key: string, fallback = 0): number => {
  const v = attr(raw, key);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function loadNpcs(npcDir: string): NpcRegistry {
  const byName = new Map<string, NpcDef>();
  const all: NpcDef[] = [];
  const unreadable: string[] = [];
  const claims = new Map<string, NpcDef[]>();

  for (const entry of readdirSync(npcDir)) {
    if (extname(entry).toLowerCase() !== '.xml') continue;
    const file = join(npcDir, entry);
    const xml = readFileSync(file, 'latin1');

    const npcTag = /<npc\b([^>]*)>/i.exec(xml)?.[1];
    const name = npcTag ? attr(npcTag, 'name') : undefined;
    if (!name) {
      unreadable.push(file);
      continue;
    }

    const lookTag = /<look\b([^>]*)\/?>/i.exec(xml)?.[1] ?? '';

    const def: NpcDef = {
      name,
      slug: slug(name),
      file,
      lookType: numAttr(lookTag, 'type'),
      head: numAttr(lookTag, 'head'),
      body: numAttr(lookTag, 'body'),
      legs: numAttr(lookTag, 'legs'),
      feet: numAttr(lookTag, 'feet'),
      addons: numAttr(lookTag, 'addons'),
      lookTypeEx: numAttr(lookTag, 'typeex'),
      hasShop: /module_shop|shop_buyable|shop_sellable/i.test(xml),
      shop: {
        buy: parseShopList(xml, 'shop_buyable'),
        sell: parseShopList(xml, 'shop_sellable'),
      },
      script: npcTag ? (attr(npcTag, 'script') ?? '') : '',
    };

    all.push(def);
    const claim = claims.get(def.slug);
    if (claim) claim.push(def);
    else claims.set(def.slug, [def]);
  }

  const duplicates: NpcDuplicate[] = [];
  for (const [slug, defs] of claims) {
    const chosen = defs.reduce(better);
    byName.set(slug, chosen);
    if (defs.length > 1) {
      duplicates.push({
        slug,
        chosen: basename(chosen.file),
        rejected: defs.filter((d) => d !== chosen).map((d) => basename(d.file)),
      });
    }
  }

  all.sort((a, b) => a.name.localeCompare(b.name));
  duplicates.sort((a, b) => a.slug.localeCompare(b.slug));
  return { byName, all, unreadable, duplicates };
}

/**
 * Pull one trade list out of an npc's xml.
 *
 * Entries are `name, id, price` and the base is not tidy about it: names carry
 * mixed case and stray spaces, a few lines have no trailing semicolon, and one
 * entry per line is a convention rather than a rule. Anything that does not
 * parse into three fields is dropped rather than guessed at — a wrong price is
 * worse than a missing row.
 */
function parseShopList(xml: string, key: string): ShopEntry[] {
  // Escaped twice on purpose: this is a template literal, where a lone `\s`
  // would collapse to a plain `s` before the RegExp ever saw it.
  const block = new RegExp(`key\\s*=\\s*"${key}"\\s+value\\s*=\\s*"([^"]*)"`, 'i').exec(xml);
  if (!block) return [];

  const out: ShopEntry[] = [];
  const seen = new Set<number>();

  for (const raw of block[1]!.split(';')) {
    const parts = raw.split(',').map((p) => p.trim());
    if (parts.length < 3) continue;

    const name = parts[0]!.replace(/\s+/g, ' ').trim();
    const serverId = Number(parts[1]);
    const price = Number(parts[2]);
    if (!name || !Number.isInteger(serverId) || serverId <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    // The same id listed twice would give the player two prices for one item.
    if (seen.has(serverId)) continue;

    seen.add(serverId);
    out.push({ name: name.toLowerCase(), serverId, price });
  }

  return out;
}
