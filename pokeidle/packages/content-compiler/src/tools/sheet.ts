#!/usr/bin/env node
/**
 * Contact sheet of creature appearances over an id range.
 *
 * `thing creature <id>` answers "what does one outfit look like"; this answers
 * "is this whole block of outfits the creature the monster files claim". One
 * image beats forty round trips when a range is suspected of being shifted.
 *
 * Usage: node tools/sheet.ts <from> <to> [--out file.png] [--cols n]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { PATHS, SPRITE_SIZE } from '../config.ts';
import { SprFile } from '../formats/spr.ts';
import { loadDat } from '../formats/dat.ts';
import type { ThingType } from '../formats/dat.ts';
import { encodePng } from '../io/png.ts';

/** Copy a 32x32 sprite into the sheet, skipping fully transparent pixels. */
function blit(dst: Buffer, dstW: number, src: Buffer, x: number, y: number): void {
  for (let sy = 0; sy < SPRITE_SIZE; sy++) {
    for (let sx = 0; sx < SPRITE_SIZE; sx++) {
      const s = (sy * SPRITE_SIZE + sx) * 4;
      if (src[s + 3] === 0) continue;
      const d = ((y + sy) * dstW + (x + sx)) * 4;
      src.copy(dst, d, s, s + 4);
    }
  }
}

/**
 * Draw one creature's south-facing idle frame into a cell.
 *
 * South is pattern 0. A creature wider or taller than one tile is drawn from
 * its bottom-right block outwards, the way the client anchors it, then scaled
 * down to fit the cell so a 3x3 outfit and a 1x1 outfit stay comparable.
 */
function drawCreature(thing: ThingType, spr: SprFile, cell: number): Buffer | null {
  const g = thing.frameGroups[0];
  if (!g || g.sprites.length === 0) return null;

  const w = g.width * SPRITE_SIZE;
  const h = g.height * SPRITE_SIZE;
  const buf = Buffer.alloc(w * h * 4);

  const index = (cx: number, cy: number) => {
    // phase 0, pattern 0, layer 0 — the same walk the client does.
    let i = 0;
    i = i * g.patternZ + 0;
    i = i * g.patternY + 0;
    i = i * g.patternX + 0;
    i = i * g.layers + 0;
    i = i * g.height + cy;
    i = i * g.width + cx;
    return i;
  };

  for (let cy = 0; cy < g.height; cy++) {
    for (let cx = 0; cx < g.width; cx++) {
      const sid = g.sprites[index(cx, cy)];
      if (!sid) continue;
      const pixels = spr.getSprite(sid);
      if (!pixels) continue;
      blit(buf, w, pixels, (g.width - 1 - cx) * SPRITE_SIZE, (g.height - 1 - cy) * SPRITE_SIZE);
    }
  }

  if (w === cell && h === cell) return buf;

  // Nearest-neighbour into the cell, preserving aspect and bottom-anchoring.
  const out = Buffer.alloc(cell * cell * 4);
  const scale = Math.min(cell / w, cell / h);
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  const ox = ((cell - dw) / 2) | 0;
  const oy = cell - dh;

  for (let y = 0; y < dh; y++) {
    const sy = Math.min(h - 1, (y / scale) | 0);
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(w - 1, (x / scale) | 0);
      const s = (sy * w + sx) * 4;
      if (buf[s + 3] === 0) continue;
      buf.copy(out, ((oy + y) * cell + (ox + x)) * 4, s, s + 4);
    }
  }
  return out;
}

const args = process.argv.slice(2);
const from = Number(args[0]);
const to = Number(args[1]);
const colsArg = args.indexOf('--cols');
const outArg = args.indexOf('--out');
const cols = colsArg === -1 ? 10 : Number(args[colsArg + 1]);
const outFile = outArg === -1 ? 'out/sheet.png' : args[outArg + 1]!;

if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
  console.error('usage: sheet.ts <from> <to> [--cols n] [--out file.png]');
  process.exit(1);
}

const CELL = 64;
const dat = loadDat(PATHS.dat);
const creatures = dat.things.get('creature')!;
const spr = SprFile.open(PATHS.spr);

const ids: number[] = [];
for (let id = from; id <= to; id++) if (creatures.get(id)) ids.push(id);

const rows = Math.ceil(ids.length / cols);
const sheetW = cols * CELL;
const sheetH = rows * CELL;
const sheet = Buffer.alloc(sheetW * sheetH * 4);

// A dark ground so transparent sprites stay visible against the page.
for (let i = 0; i < sheetW * sheetH; i++) {
  sheet[i * 4] = 18;
  sheet[i * 4 + 1] = 22;
  sheet[i * 4 + 2] = 26;
  sheet[i * 4 + 3] = 255;
}

ids.forEach((id, n) => {
  const thing = creatures.get(id)!;
  const cellBuf = drawCreature(thing, spr, CELL);
  if (!cellBuf) return;
  const cx = (n % cols) * CELL;
  const cy = ((n / cols) | 0) * CELL;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const s = (y * CELL + x) * 4;
      if (cellBuf[s + 3] === 0) continue;
      cellBuf.copy(sheet, ((cy + y) * sheetW + (cx + x)) * 4, s, s + 4);
    }
  }
});

spr.close();

const target = resolve(outFile);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, encodePng(sheetW, sheetH, sheet));

console.log(`ids ${from}..${to}: ${ids.length} present, ${cols} per row`);
console.log(ids.join(' '));
console.log(`-> ${target} (${sheetW}x${sheetH})`);
