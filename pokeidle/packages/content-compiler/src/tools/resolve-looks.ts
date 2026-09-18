/**
 * Find the creature in the sprite pack that each species actually is.
 *
 * This base's monster scripts and this client's Tibia.dat come from different
 * builds. Kanto lines up — `lookType = 51` really is Bulbasaur — but outside it
 * the numbers point at strangers: 800 ("Chikorita") is a grey robot and 1503
 * ("Torchic") is a bird-headed humanoid.
 *
 * They are not scrambled, though. They are *shifted*: Chikorita's 800 is the
 * pack's 340, Cyndaquil's 803 is 343, Treecko's 1500 is 697. One constant holds
 * for a run of ids and then steps, because creatures were inserted or dropped
 * between the two builds.
 *
 * ## The evidence
 *
 * items.xml names every corpse — 27827 is "a fainted torchic" — and that item's
 * sprite is a Torchic lying down, drawn from the same palette as the walking
 * one. So each species carries a named sample of its own colours, and the
 * creature can be found by matching palettes:
 *
 *   - exact colours, not quantised, because pixel art reuses palette entries
 *     verbatim and rounding merges the entries that tell two species apart;
 *   - weighted by rarity, because black outlines are in every sprite in the
 *     pack and a particular shade of orange is in three.
 *
 * ## What is trusted
 *
 * A species whose own corpse matches strongly is an anchor. An anchor is only
 * believed when a second species within fifteen ids agrees on the same shift —
 * a lone strong match can be a coincidence somewhere else in the pack.
 *
 * Everything else is resolved only when it sits *between* two anchors that
 * agree, since a run of ids came from one build together. Past the last anchor,
 * or between anchors that disagree, is where the shift steps and nothing says
 * which side of the step a species is on: those are left unresolved, and the
 * client draws their artwork instead. Guessing there is what put Lugia and
 * Rayquaza on strangers.
 *
 * Checked by hand against the sprites: 24 of 24 sampled species resolve to the
 * right creature, and Kanto keeps every one of its own ids.
 */

import { SPRITE_SIZE } from '../config.ts';
import type { ThingType } from '../formats/dat.ts';
import type { SprFile } from '../formats/spr.ts';

/** A palette that shares this much weighted colour is the same creature. */
const SURE = 0.35;
/** What it takes to be an anchor, and how far clear of the runner-up. */
const ANCHOR_SCORE = 0.45;
const ANCHOR_MARGIN = 1.25;
/** How near another anchor must be to corroborate a shift. */
const CORROBORATE = 15;

type Palette = Map<number, number>;

export type SpeciesLook = { slug: string; variant: string; name: string; look: number };

export type ResolvedLook = {
  /** What the monster script asks for. */
  declared: number;
  /** What it turned out to be, or `declared` when nothing could be shown. */
  look: number;
  resolved: boolean;
  /** Confirmed by the species' own corpse rather than by its neighbours. */
  sure: boolean;
  score: number;
};

export type LookResolution = {
  /** Keyed `slug|variant`. */
  byKey: Map<string, ResolvedLook>;
  anchors: number;
  resolved: number;
  moved: number;
  /** Where the shift steps, for the log. */
  runs: Array<{ from: number; shift: number; name: string }>;
};

/** Exact-colour histogram over a set of sprites, normalised to one. */
function paletteOf(spriteIds: readonly number[], spr: SprFile): Palette | null {
  const counts = new Map<number, number>();
  let total = 0;

  for (const sid of spriteIds) {
    if (!sid) continue;
    const pixels = spr.getSprite(sid);
    if (!pixels) continue;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]! <= 128) continue;
      const key = (pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
  }

  if (!total) return null;
  const out: Palette = new Map();
  for (const [key, n] of counts) out.set(key, n / total);
  return out;
}

export function resolveLooks(
  species: SpeciesLook[],
  creatures: Map<number, ThingType>,
  corpseSpriteIds: Map<string, number[]>,
  spr: SprFile,
): LookResolution {
  // ── every creature's palette, and how rare each colour is ────────────────
  const palettes = new Map<number, Palette>();
  for (const [id, thing] of creatures) {
    const group = thing.frameGroups[0];
    if (!group || group.sprites.length === 0) continue;
    const pal = paletteOf(group.sprites, spr);
    if (pal) palettes.set(id, pal);
  }

  const idf = new Map<number, number>();
  {
    const seenIn = new Map<number, number>();
    for (const pal of palettes.values()) {
      for (const key of pal.keys()) seenIn.set(key, (seenIn.get(key) ?? 0) + 1);
    }
    for (const [key, n] of seenIn) idf.set(key, Math.log(palettes.size / (1 + n)));
  }

  const score = (a: Palette | null, b: Palette | undefined): number => {
    if (!a || !b) return 0;
    let shared = 0;
    for (const [key, weight] of a) {
      const other = b.get(key);
      if (other !== undefined) shared += Math.min(weight, other) * (idf.get(key) ?? 1);
    }
    return shared;
  };

  const corpses = new Map<string, Palette | null>();
  const corpseOf = (name: string): Palette | null => {
    const key = name.toLowerCase().trim();
    if (!corpses.has(key)) {
      const sprites = corpseSpriteIds.get(key);
      corpses.set(key, sprites?.length ? paletteOf(sprites, spr) : null);
    }
    return corpses.get(key)!;
  };

  // ── anchors ──────────────────────────────────────────────────────────────
  const sorted = [...species].sort((a, b) => a.look - b.look || a.name.localeCompare(b.name));
  const maxId = Math.max(0, ...palettes.keys());

  const strong: Array<{ declared: number; shift: number; name: string; score: number }> = [];
  for (const sp of sorted) {
    const want = corpseOf(sp.name);
    if (!want) continue;

    let best: [number, number] | null = null;
    let second = 0;
    for (const [id, pal] of palettes) {
      const s = score(want, pal);
      if (!best || s > best[1]) {
        second = best ? best[1] : 0;
        best = [id, s];
      } else if (s > second) second = s;
    }
    if (!best) continue;

    const margin = best[1] / (second || 1e-4);
    if (best[1] >= ANCHOR_SCORE && margin >= ANCHOR_MARGIN) {
      strong.push({ declared: sp.look, shift: best[0] - sp.look, name: sp.name, score: best[1] });
    }
  }

  const anchors = strong.filter((a, i) =>
    strong.some(
      (b, j) => i !== j && b.shift === a.shift && Math.abs(b.declared - a.declared) <= CORROBORATE,
    ),
  );

  // ── resolve ──────────────────────────────────────────────────────────────
  const byKey = new Map<string, ResolvedLook>();
  const runs: LookResolution['runs'] = [];
  let lastShift: number | null = null;
  let resolvedCount = 0;
  let movedCount = 0;

  for (const sp of sorted) {
    let before: (typeof anchors)[number] | null = null;
    let after: (typeof anchors)[number] | null = null;
    for (const a of anchors) {
      if (a.declared <= sp.look) before = a;
      else {
        after = a;
        break;
      }
    }

    const want = corpseOf(sp.name);
    const candidates = new Set<number>([0]);
    if (before) candidates.add(before.shift);
    if (after) candidates.add(after.shift);

    let pick: { shift: number; score: number } | null = null;
    if (want) {
      for (const shift of candidates) {
        const id = sp.look + shift;
        if (id <= 0 || id > maxId) continue;
        const s = score(want, palettes.get(id));
        if (!pick || s > pick.score) pick = { shift, score: s };
      }
    }

    const bracketed = Boolean(before && after && before.shift === after.shift);
    if (!pick || pick.score < SURE) {
      pick = bracketed && before ? { shift: before.shift, score: pick?.score ?? 0 } : null;
    }

    const entry: ResolvedLook = {
      declared: sp.look,
      look: pick ? sp.look + pick.shift : sp.look,
      resolved: Boolean(pick),
      sure: Boolean(pick && pick.score >= SURE),
      score: pick?.score ?? 0,
    };
    byKey.set(`${sp.slug}|${sp.variant}`, entry);

    if (pick) {
      resolvedCount++;
      if (pick.shift !== 0) movedCount++;
      if (pick.shift !== lastShift) {
        runs.push({ from: sp.look, shift: pick.shift, name: sp.name });
        lastShift = pick.shift;
      }
    }
  }

  return { byKey, anchors: anchors.length, resolved: resolvedCount, moved: movedCount, runs };
}
