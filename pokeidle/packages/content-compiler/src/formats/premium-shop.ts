/**
 * The base's cash shop, from `data/lib/systems/newShop.lua`.
 *
 * `SHOP_DATA.CATEGORY` is a table of rows like
 *
 * ```lua
 * {type = "item", valor = 20, moeda = 2145, item = {id = 6569, qtd = 1, ...}}, -- Candy
 * ```
 *
 * where `valor` is the price, `moeda` is the item id of the currency it is paid
 * in, and the trailing comment is the only name most of these rows have.
 *
 * Five currencies appear. Only one of them is a real item in this base:
 * **2145, "small diamond"** — the others (23498, 12237, 23496, 23497) name ids
 * that items.xml does not carry, the same rot the `balls` table has. So the
 * diamond is the one currency that can actually be drawn and spent, and it is
 * the one the shop in this game is built on.
 *
 * A commented-out row is skipped: the whole POKEMONS category is disabled in
 * this base, so its prices survive here as data while its Pokemon do not.
 */

export type PremiumRow = {
  category: string;
  /** `item`, `outfit`, `pokemon`… whatever the row declares. */
  type: string;
  price: number;
  /** Item id of the currency; 2145 is the small diamond. */
  currency: number;
  /** Server item id, or 0 for rows that sell something else. */
  itemId: number;
  quantity: number;
  /** The trailing comment, which is often the only name a row has. */
  note: string;
};

export const DIAMOND_SID = 2145;

export function parsePremiumShop(source: string): PremiumRow[] {
  const rows: PremiumRow[] = [];
  let category = '';

  for (const raw of source.split('\n')) {
    const heading = /\["([A-Z]+)"\]\s*=\s*\{/.exec(raw);
    if (heading) {
      category = heading[1]!;
      continue;
    }

    const line = raw.trim();
    // Disabled rows stay disabled: the server never loads them either.
    if (line.startsWith('--') || !line.includes('type =')) continue;

    const type = /type\s*=\s*"(\w+)"/.exec(line);
    const price = /valor\s*=\s*([\d.]+)/.exec(line);
    const currency = /moeda\s*=\s*(\d+)/.exec(line);
    if (!type || !price || !currency) continue;

    const itemId = /item\s*=\s*\{\s*id\s*=\s*(\d+)/.exec(line);
    const quantity = /qtd\s*=\s*(\d+)/.exec(line);
    const note = /--\s*(.+?)\s*$/.exec(line);

    rows.push({
      category,
      type: type[1]!,
      price: Number(price[1]),
      currency: Number(currency[1]),
      itemId: itemId ? Number(itemId[1]) : 0,
      quantity: quantity ? Number(quantity[1]) : 1,
      note: note ? note[1]! : '',
    });
  }

  return rows;
}
