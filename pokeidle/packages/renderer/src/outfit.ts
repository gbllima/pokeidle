/**
 * Outfit colourisation.
 *
 * Creature appearances ship two layers: layer 0 is the drawn sprite and
 * layer 1 is a mask painted in four marker colours. Each marker says which
 * of the outfit's four channels tints that pixel. Without this pass every
 * NPC sharing a template lookType renders identical — and in this base most
 * of them share lookType 3328.
 */

export const TILE_PIXELS = 32 * 32;

/** Channel order matches the xml attributes: head, body, legs, feet. */
export type OutfitColors = [number, number, number, number];

export type Rgb = [number, number, number];

const HSI_SI_VALUES = 7;
const HSI_H_STEPS = 19;

/**
 * Resolve one of the 133 outfit colour indices to RGB.
 *
 * The palette is not a table — it is 7 saturation/intensity bands over 19
 * hue steps, with the first column of each band reserved for greys.
 */
export function outfitColor(index: number): Rgb {
  let color = index;
  if (color >= HSI_H_STEPS * HSI_SI_VALUES || color < 0) color = 0;

  let hue = 0;
  let saturation = 0;
  let intensity = 0;

  if (color % HSI_H_STEPS !== 0) {
    hue = ((color % HSI_H_STEPS) * 1.0) / 18.0;
    saturation = 1;
    intensity = 1;

    switch (Math.floor(color / HSI_H_STEPS)) {
      case 0: saturation = 0.25; intensity = 1.0; break;
      case 1: saturation = 0.25; intensity = 0.75; break;
      case 2: saturation = 0.5; intensity = 0.75; break;
      case 3: saturation = 0.667; intensity = 0.75; break;
      case 4: saturation = 1.0; intensity = 1.0; break;
      case 5: saturation = 1.0; intensity = 0.75; break;
      case 6: saturation = 1.0; intensity = 0.5; break;
    }
  } else {
    // Every 19th index is a grey ramp rather than a hue.
    hue = 0;
    saturation = 0;
    intensity = 1 - color / HSI_H_STEPS / HSI_SI_VALUES;
  }

  if (intensity === 0) return [0, 0, 0];

  if (saturation === 0) {
    const grey = Math.trunc(intensity * 255);
    return [grey, grey, grey];
  }

  let red = 0;
  let green = 0;
  let blue = 0;
  const dim = intensity * (1 - saturation);

  if (hue < 1 / 6) {
    red = intensity;
    blue = dim;
    green = blue + (intensity - blue) * 6 * hue;
  } else if (hue < 2 / 6) {
    green = intensity;
    blue = dim;
    red = green - (intensity - blue) * (6 * hue - 1);
  } else if (hue < 3 / 6) {
    green = intensity;
    red = dim;
    blue = red + (intensity - red) * (6 * hue - 2);
  } else if (hue < 4 / 6) {
    blue = intensity;
    red = dim;
    green = blue - (intensity - red) * (6 * hue - 3);
  } else if (hue < 5 / 6) {
    blue = intensity;
    green = dim;
    red = green + (intensity - green) * (6 * hue - 4);
  } else {
    red = intensity;
    green = dim;
    blue = red - (intensity - green) * (6 * hue - 5);
  }

  return [Math.trunc(red * 255), Math.trunc(green * 255), Math.trunc(blue * 255)];
}

/** Marker colours the mask layer uses, in channel order. */
const MARKERS: Array<{ r: number; g: number; b: number }> = [
  { r: 255, g: 255, b: 0 }, // yellow -> head
  { r: 255, g: 0, b: 0 }, // red    -> body
  { r: 0, g: 255, b: 0 }, // green  -> legs
  { r: 0, g: 0, b: 255 }, // blue   -> feet
];

/**
 * Apply the four channel colours to a base sprite using its mask.
 *
 * Returns a new buffer of the same kind as `base`; the inputs are untouched
 * so a cached atlas sprite can be tinted many times with different colours.
 * Works on any Uint8Array, so the same code runs in node and in the browser.
 */
export function tintOutfit<T extends Uint8Array>(base: T, mask: Uint8Array, colors: OutfitColors): T {
  if (base.length !== mask.length) {
    throw new Error(`tintOutfit: base and mask differ in size (${base.length} vs ${mask.length})`);
  }

  const palette = colors.map(outfitColor);
  // slice() keeps the concrete type: Buffer in node, Uint8ClampedArray in the browser.
  const out = base.slice() as T;

  for (let p = 0; p < base.length; p += 4) {
    if (base[p + 3] === 0) continue; // transparent base pixel, nothing to tint
    if (mask[p + 3] === 0) continue; // mask says leave this pixel alone

    const mr = mask[p]!;
    const mg = mask[p + 1]!;
    const mb = mask[p + 2]!;

    for (let c = 0; c < MARKERS.length; c++) {
      const marker = MARKERS[c]!;
      if (mr !== marker.r || mg !== marker.g || mb !== marker.b) continue;

      const [tr, tg, tb] = palette[c]!;
      // Rounded explicitly: a Buffer truncates a fractional assignment while a
      // Uint8ClampedArray rounds it, and that would drift node from browser.
      out[p] = Math.round((base[p]! * tr) / 255);
      out[p + 1] = Math.round((base[p + 1]! * tg) / 255);
      out[p + 2] = Math.round((base[p + 2]! * tb) / 255);
      break;
    }
  }

  return out;
}
