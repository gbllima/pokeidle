/**
 * Pokémon imagery, resolved by name.
 *
 * This mirrors `gamelib/util.lua` in the base client, which resolves every
 * Pokémon image by lowercased name against `pokedex/pokemon/` and
 * `portrait/`, falling back to the base species when a variant has no art of
 * its own. Names, not looktypes, are the identifier that works: the sprite
 * pack holds real Pokémon in only parts of its creature range — Kanto sits
 * where the monster scripts expect it, but the Johto block at 800+ and the
 * Hoenn block at 1500+ land on unrelated creatures — while the artwork folders
 * cover all 789 species.
 *
 * Looktypes still drive the map, where a walking sprite with a facing is the
 * only thing that will do. Trainer outfits are fine there: 1112 and 1113 are
 * the two `name="Trainer"` entries in the server's own outfits.xml.
 */

const ART = '/art';

/**
 * Every name worth trying for one species, most specific first.
 *
 * Variant names in this base read as `<adjective> <species>`: `shiny pikachu`,
 * `alolan dugtrio`, `ancient alakazam`, `big onix`, `mega charizard x`. Most
 * have no art of their own, so each leading word is dropped in turn until the
 * bare species is left — `alolan dugtrio` becomes `dugtrio`, which does exist.
 *
 * A trailing `x`/`y` on a mega is dropped too, since the two share one picture.
 */
export function nameCandidates(name: string): string[] {
  const words = name.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];

  for (let start = 0; start < words.length; start++) {
    const rest = words.slice(start);
    // Peeling `Mega Charizard X` word by word eventually leaves a bare `x`,
    // which is the mega marker rather than a species and would ask the server
    // for `x.png`.
    if (rest.length === 1 && /^[xy]$/.test(rest[0]!)) break;

    const full = rest.join(' ');
    if (full && !out.includes(full)) out.push(full);

    if (rest.length > 1 && /^[xy]$/.test(rest.at(-1)!)) {
      const trimmed = rest.slice(0, -1).join(' ');
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }

  return out;
}

function encode(name: string): string {
  // Filenames carry spaces ("alolan muk.png"); everything else is plain ASCII.
  return encodeURIComponent(name.toLowerCase().trim());
}

/** The small rounded icon the base uses in lists and slots. */
export function portraitUrl(name: string): string {
  return `${ART}/portrait/${encode(name)}.png`;
}

/** The full illustration the base uses on its starter and pokedex screens. */
export function artworkUrl(name: string): string {
  return `${ART}/pokedex/pokemon/${encode(name)}.png`;
}

export function typeIconUrl(type: string): string {
  // The type folder is the one place the base capitalises: `Grass.png`.
  const clean = type.trim();
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  return `${ART}/pokedex/types/${encodeURIComponent(cap)}.png`;
}

export type ArtKind = 'portrait' | 'artwork';

/**
 * Which art files the release actually ships.
 *
 * Told to the module once at boot. Without it the fallback chain discovers
 * every miss by asking the server and being told 404 — hundreds of pointless
 * round trips on a full pokedex scroll — and with it the first URL tried is
 * always one that exists.
 */
let haveArt: { portrait: Set<string>; artwork: Set<string> } | null = null;

export function knownArt(portraits: string[], artworks: string[]): void {
  haveArt = {
    portrait: new Set(portraits.map((n) => n.toLowerCase())),
    artwork: new Set(artworks.map((n) => n.toLowerCase())),
  };
}

/** Whether the release has this exact file; unknown until `knownArt` is told. */
export function exists(kind: ArtKind, name: string): boolean {
  if (!haveArt || (haveArt.portrait.size === 0 && haveArt.artwork.size === 0)) return true;
  return haveArt[kind].has(name.toLowerCase().trim());
}

/**
 * The first picture the release actually ships for this name, or null.
 *
 * `pokemonImage` walks its fallback chain through the DOM's `onerror`, which
 * an `<img>` can do and a canvas cannot. Drawing on the map needs the answer
 * up front, and the shipped manifest is exactly that answer.
 */
export function bestArtUrl(name: string, kind: ArtKind = 'portrait'): string | null {
  const preferred = kind === 'portrait' ? portraitUrl : artworkUrl;
  const other = kind === 'portrait' ? artworkUrl : portraitUrl;
  const otherKind: ArtKind = kind === 'portrait' ? 'artwork' : 'portrait';

  for (const candidate of nameCandidates(name)) {
    if (exists(kind, candidate)) return preferred(candidate);
    if (exists(otherKind, candidate)) return other(candidate);
  }
  return null;
}

/**
 * An `<img>` that degrades instead of showing a broken icon.
 *
 * The browser cannot stat a file the way the Lua client does, so the fallback
 * rides on `onerror`, walking a list rather than making a single second guess.
 * Both folders are tried for every name because they do not hold the same
 * species: Articuno, Accelgor and Beartic have full artwork and no portrait,
 * so a portrait-only lookup showed nothing for them.
 */
export function pokemonImage(name: string, kind: ArtKind, size: number): HTMLImageElement {
  const preferred = kind === 'portrait' ? portraitUrl : artworkUrl;
  const other = kind === 'portrait' ? artworkUrl : portraitUrl;

  const otherKind: ArtKind = kind === 'portrait' ? 'artwork' : 'portrait';
  const chain: string[] = [];
  for (const candidate of nameCandidates(name)) {
    if (exists(kind, candidate)) chain.push(preferred(candidate));
    if (exists(otherKind, candidate)) chain.push(other(candidate));
  }

  const img = document.createElement('img');
  img.width = size;
  img.height = size;
  img.alt = name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = `poke-art poke-${kind}`;

  if (!chain.length) {
    // Nothing in the base draws this one, and asking would only be a 404.
    img.style.visibility = 'hidden';
    return img;
  }

  let next = 1;
  img.addEventListener('error', () => {
    if (next < chain.length) {
      img.src = chain[next++]!;
      return;
    }
    // Nothing in the base draws this one. Better an empty slot than a broken
    // icon, and the name beside it still says what it is.
    img.style.visibility = 'hidden';
  });

  img.src = chain[0]!;
  return img;
}
