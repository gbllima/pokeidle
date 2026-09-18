/**
 * XTEA, as the server applies it.
 *
 * Standard 32-round XTEA over little-endian u32 pairs. Written out rather than
 * pulled from a dependency because the wire format has to match
 * `servidor/src/xtea.cpp` exactly: one wrong rotation and every packet after
 * the handshake is silently garbage rather than an error.
 */

const DELTA = 0x9e3779b9;
export const BLOCK_BYTES = 8;

/** The four u32 words the handshake agrees on. */
export type XteaKey = readonly [number, number, number, number];

export function randomKey(): XteaKey {
  const words: number[] = [];
  for (let i = 0; i < 4; i++) words.push((Math.random() * 0x1_0000_0000) >>> 0);
  return words as unknown as XteaKey;
}

const u32 = (n: number) => n >>> 0;
const mix = (v: number) => u32((u32(v << 4) ^ (v >>> 5)) + v);

/**
 * Encrypt in place. `data.length` must be a multiple of 8 — the caller pads,
 * because only it knows what the padding means to the protocol.
 */
export function encrypt(data: Buffer, key: XteaKey): Buffer {
  if (data.length % BLOCK_BYTES !== 0) {
    throw new Error(`xtea: ${data.length} bytes is not a whole number of 8-byte blocks`);
  }

  for (let offset = 0; offset < data.length; offset += BLOCK_BYTES) {
    let v0 = data.readUInt32LE(offset);
    let v1 = data.readUInt32LE(offset + 4);
    let sum = 0;

    for (let round = 0; round < 32; round++) {
      v0 = u32(v0 + (mix(v1) ^ u32(sum + key[sum & 3]!)));
      sum = u32(sum + DELTA);
      v1 = u32(v1 + (mix(v0) ^ u32(sum + key[(sum >>> 11) & 3]!)));
    }

    data.writeUInt32LE(v0, offset);
    data.writeUInt32LE(v1, offset + 4);
  }

  return data;
}

/** Decrypt in place, mirroring `encrypt`. */
export function decrypt(data: Buffer, key: XteaKey): Buffer {
  if (data.length % BLOCK_BYTES !== 0) {
    throw new Error(`xtea: ${data.length} bytes is not a whole number of 8-byte blocks`);
  }

  for (let offset = 0; offset < data.length; offset += BLOCK_BYTES) {
    let v0 = data.readUInt32LE(offset);
    let v1 = data.readUInt32LE(offset + 4);
    // Decryption unwinds from the final sum, which is delta applied 32 times.
    let sum = u32(DELTA * 32);

    for (let round = 0; round < 32; round++) {
      v1 = u32(v1 - (mix(v0) ^ u32(sum + key[(sum >>> 11) & 3]!)));
      sum = u32(sum - DELTA);
      v0 = u32(v0 - (mix(v1) ^ u32(sum + key[sum & 3]!)));
    }

    data.writeUInt32LE(v0, offset);
    data.writeUInt32LE(v1, offset + 4);
  }

  return data;
}
