import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { BinaryReader } from '../io/reader.ts';
import { FEATURES, SPRITE_SIZE, SPRITE_DATA_SIZE } from '../config.ts';

/** Bytes 'O','T','V','8' read as a little-endian u32. */
const OTV8_SIGNATURE = 0x3856544f;

/**
 * Reader for Tibia.spr.
 *
 * The file is ~892 MB, so it is never read into memory. The address table is
 * loaded up front (one u32 per sprite) and pixel data is pulled per sprite
 * with a positioned read.
 *
 * Decoding follows `SpriteManager::getSpriteImageCasual` in this fork:
 * runs of transparent pixels alternate with runs of coloured pixels, and
 * because GameSpritesAlphaChannel is on at 1098 each coloured pixel is
 * 4 bytes RGBA rather than 3 bytes RGB.
 */
export class SprFile {
  readonly signature: number;
  readonly count: number;
  readonly fileSize: number;
  private readonly fd: number;
  private readonly addresses: Uint32Array;

  private constructor(fd: number, signature: number, count: number, addresses: Uint32Array, fileSize: number) {
    this.fd = fd;
    this.signature = signature;
    this.count = count;
    this.addresses = addresses;
    this.fileSize = fileSize;
  }

  static open(path: string): SprFile {
    const fd = openSync(path, 'r');
    const fileSize = statSync(path).size;

    const head = Buffer.alloc(8);
    readSync(fd, head, 0, 8, 0);
    const r = new BinaryReader(head);
    const signature = r.u32();

    if (signature === OTV8_SIGNATURE) {
      closeSync(fd);
      throw new Error(
        'this .spr is an OTV8 packed/encrypted archive; the compiler only handles the plain format',
      );
    }

    const count = FEATURES.spritesU32 ? r.u32() : r.u16();
    const tableOffset = FEATURES.spritesU32 ? 8 : 6;

    // The address table is 4 bytes per sprite — ~2 MB for this file.
    const table = Buffer.alloc(count * 4);
    readSync(fd, table, 0, table.length, tableOffset);
    const addresses = new Uint32Array(count);
    for (let i = 0; i < count; i++) addresses[i] = table.readUInt32LE(i * 4);

    return new SprFile(fd, signature, count, addresses, fileSize);
  }

  close(): void {
    closeSync(this.fd);
  }

  /** True when the sprite exists and holds pixels (address 0 means "blank"). */
  has(id: number): boolean {
    return id >= 1 && id <= this.count && this.addresses[id - 1] !== 0;
  }

  /**
   * Decode one sprite to a 32x32 RGBA buffer.
   * Returns null for blank sprites, matching the client's empty-texture path.
   */
  getSprite(id: number): Buffer | null {
    if (id < 1 || id > this.count) {
      throw new RangeError(`sprite id ${id} out of range (1..${this.count})`);
    }
    const address = this.addresses[id - 1]!;
    if (address === 0) return null;

    // 3 bytes colour key + u16 size, then at most one full uncompressed sprite.
    const headerSize = 5;
    const maxChunk = Math.min(headerSize + SPRITE_DATA_SIZE + 64, this.fileSize - address);
    const chunk = Buffer.alloc(maxChunk);
    readSync(this.fd, chunk, 0, maxChunk, address);

    const r = new BinaryReader(chunk);
    r.skip(3); // colour key, unused once alpha is real
    const pixelDataSize = r.u16();

    const pixels = Buffer.alloc(SPRITE_DATA_SIZE); // zero-filled = fully transparent
    let writePos = 0;
    let read = 0;

    while (read < pixelDataSize && writePos < SPRITE_DATA_SIZE) {
      const transparent = r.u16();
      const colored = r.u16();

      writePos += transparent * 4;
      if (writePos > SPRITE_DATA_SIZE) break;

      if (FEATURES.spritesAlphaChannel) {
        const n = Math.min(colored * 4, SPRITE_DATA_SIZE - writePos);
        r.bytes(colored * 4).copy(pixels, writePos, 0, n);
        writePos += colored * 4;
        read += 4 + 4 * colored;
      } else {
        for (let i = 0; i < colored && writePos < SPRITE_DATA_SIZE; i++) {
          pixels[writePos + 0] = r.u8();
          pixels[writePos + 1] = r.u8();
          pixels[writePos + 2] = r.u8();
          pixels[writePos + 3] = 0xff;
          writePos += 4;
        }
        read += 4 + 3 * colored;
      }
    }

    return pixels;
  }

  /** Cheap non-blank check used by the inventory pass. */
  countNonEmpty(): number {
    let n = 0;
    for (let i = 0; i < this.count; i++) if (this.addresses[i] !== 0) n++;
    return n;
  }

  get spriteSize(): number {
    return SPRITE_SIZE;
  }
}
