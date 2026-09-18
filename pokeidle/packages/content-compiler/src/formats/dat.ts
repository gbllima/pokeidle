import { readFileSync } from 'node:fs';
import { BinaryReader } from '../io/reader.ts';
import { FEATURES } from '../config.ts';

export type ThingCategory = 'item' | 'creature' | 'effect' | 'missile';

export const CATEGORIES: ThingCategory[] = ['item', 'creature', 'effect', 'missile'];

/**
 * Attribute ids as this fork numbers them (cliente/src/client/thingtype.h).
 * `bones` (38) is a fork-specific addition and does not exist upstream.
 */
export const ATTR = {
  ground: 0,
  groundBorder: 1,
  onBottom: 2,
  onTop: 3,
  container: 4,
  stackable: 5,
  forceUse: 6,
  multiUse: 7,
  writable: 8,
  writableOnce: 9,
  fluidContainer: 10,
  splash: 11,
  notWalkable: 12,
  notMoveable: 13,
  blockProjectile: 14,
  notPathable: 15,
  pickupable: 16,
  hangable: 17,
  hookSouth: 18,
  hookEast: 19,
  rotateable: 20,
  light: 21,
  dontHide: 22,
  translucent: 23,
  displacement: 24,
  elevation: 25,
  lyingCorpse: 26,
  animateAlways: 27,
  minimapColor: 28,
  lensHelp: 29,
  fullGround: 30,
  look: 31,
  cloth: 32,
  market: 33,
  usable: 34,
  wrapable: 35,
  unwrapable: 36,
  topEffect: 37,
  bones: 38,
  floorChange: 252,
  noMoveAnimation: 253,
  chargeable: 254,
  last: 255,
} as const;

export type FrameGroup = {
  type: number; // 0 = idle/default, 1 = moving
  width: number;
  height: number;
  realSize: number;
  layers: number;
  patternX: number;
  patternY: number;
  patternZ: number;
  phases: number;
  /** Present only when phases > 1 and enhanced animations are on. */
  animator: Animator | null;
  /** Flat sprite id list, length = w*h*layers*px*py*pz*phases. */
  sprites: number[];
};

export type Animator = {
  async: boolean;
  loopCount: number;
  startPhase: number;
  /** One [minMs, maxMs] pair per phase. */
  durations: Array<[number, number]>;
};

export type ThingType = {
  id: number;
  category: ThingCategory;
  flags: Set<number>;
  groundSpeed?: number;
  light?: { intensity: number; color: number };
  displacement?: { x: number; y: number };
  elevation?: number;
  minimapColor?: number;
  maxTextLength?: number;
  clothSlot?: number;
  lensHelp?: number;
  market?: {
    category: number;
    tradeAs: number;
    showAs: number;
    name: string;
    restrictVocation: number;
    requiredLevel: number;
  };
  bones?: Array<{ x: number; y: number }>;
  frameGroups: FrameGroup[];
  /** Union of every sprite id this appearance references. */
  spriteIds: number[];
};

export type DatFile = {
  signature: number;
  counts: Record<ThingCategory, number>;
  things: Map<ThingCategory, Map<number, ThingType>>;
};

/** First valid client id per category. Items start at 100; the rest at 1. */
function firstId(category: ThingCategory): number {
  return category === 'item' ? 100 : 1;
}

export function loadDat(path: string): DatFile {
  const r = new BinaryReader(readFileSync(path));

  const signature = r.u32();
  const counts: Record<ThingCategory, number> = {
    item: r.u16(),
    creature: r.u16(),
    effect: r.u16(),
    missile: r.u16(),
  };

  const things = new Map<ThingCategory, Map<number, ThingType>>();

  for (const category of CATEGORIES) {
    const byId = new Map<number, ThingType>();
    const last = counts[category];
    for (let id = firstId(category); id <= last; id++) {
      byId.set(id, readThing(r, id, category));
    }
    things.set(category, byId);
  }

  return { signature, counts, things };
}

function readThing(r: BinaryReader, id: number, category: ThingCategory): ThingType {
  const thing: ThingType = {
    id,
    category,
    flags: new Set<number>(),
    frameGroups: [],
    spriteIds: [],
  };

  let done = false;
  for (let i = 0; i < ATTR.last; i++) {
    let attr = r.u8();
    if (attr === ATTR.last) {
      done = true;
      break;
    }

    // 10.10+ inserted "no move animation" at 16 and pushed everything above down.
    if (FEATURES.attributeShift1000) {
      if (attr === 16) attr = ATTR.noMoveAnimation;
      else if (attr > 16) attr -= 1;
    }

    switch (attr) {
      case ATTR.displacement:
        thing.displacement = { x: r.u16(), y: r.u16() };
        break;
      case ATTR.light:
        thing.light = { intensity: r.u16(), color: r.u16() };
        break;
      case ATTR.market:
        thing.market = {
          category: r.u16(),
          tradeAs: r.u16(),
          showAs: r.u16(),
          name: r.string(),
          restrictVocation: r.u16(),
          requiredLevel: r.u16(),
        };
        break;
      case ATTR.elevation:
        thing.elevation = r.u16();
        break;
      case ATTR.ground:
        thing.groundSpeed = r.u16();
        break;
      case ATTR.writable:
      case ATTR.writableOnce:
        thing.maxTextLength = r.u16();
        break;
      case ATTR.minimapColor:
        thing.minimapColor = r.u16();
        break;
      case ATTR.cloth:
        thing.clothSlot = r.u16();
        break;
      case ATTR.lensHelp:
        thing.lensHelp = r.u16();
        break;
      case ATTR.usable:
        r.u16();
        break;
      case ATTR.bones: {
        // North, South, East, West — fork-specific.
        thing.bones = [];
        for (let b = 0; b < 4; b++) thing.bones.push({ x: r.u16(), y: r.u16() });
        break;
      }
      default:
        break; // pure flag, no payload
    }

    thing.flags.add(attr);
  }

  if (!done) {
    throw new Error(`corrupt dat entry: id ${id}, category ${category} — never reached terminator`);
  }

  // Only creatures carry frame groups, and only when idle animations are on.
  const hasFrameGroups = category === 'creature' && FEATURES.idleAnimations;
  const groupCount = hasFrameGroups ? r.u8() : 1;

  for (let g = 0; g < groupCount; g++) {
    const type = hasFrameGroups ? r.u8() : 0;
    const width = r.u8();
    const height = r.u8();
    const realSize = width > 1 || height > 1 ? r.u8() : 32;
    const layers = r.u8();
    const patternX = r.u8();
    const patternY = r.u8();
    const patternZ = r.u8();
    const phases = r.u8();

    let animator: Animator | null = null;
    if (phases > 1 && FEATURES.enhancedAnimations) {
      animator = readAnimator(r, phases);
    }

    const total = width * height * layers * patternX * patternY * patternZ * phases;
    if (total > 4096) {
      throw new Error(`appearance ${category}:${id} declares ${total} sprites (max 4096)`);
    }

    const sprites: number[] = new Array(total);
    for (let s = 0; s < total; s++) {
      sprites[s] = FEATURES.spritesU32 ? r.u32() : r.u16();
    }

    thing.frameGroups.push({
      type,
      width,
      height,
      realSize,
      layers,
      patternX,
      patternY,
      patternZ,
      phases,
      animator,
      sprites,
    });
    for (const s of sprites) if (s !== 0) thing.spriteIds.push(s);
  }

  return thing;
}

function readAnimator(r: BinaryReader, phases: number): Animator {
  const async = r.u8() === 0;
  const loopCount = r.i32();
  const startPhase = r.i8();
  const durations: Array<[number, number]> = [];
  for (let i = 0; i < phases; i++) {
    const min = r.u32();
    const max = r.u32();
    durations.push([min, Math.max(0, max - min)]);
  }
  return { async, loopCount, startPhase, durations };
}
