/**
 * Little-endian binary reader over a Buffer.
 *
 * Every format in this base (DAT, SPR, OTB, OTBM) is little-endian and
 * position-oriented, so a single cursor reader covers all four.
 */
export class BinaryReader {
  readonly buf: Buffer;
  pos: number;

  constructor(buf: Buffer, pos = 0) {
    this.buf = buf;
    this.pos = pos;
  }

  get length(): number {
    return this.buf.length;
  }

  get eof(): boolean {
    return this.pos >= this.buf.length;
  }

  seek(pos: number): this {
    this.pos = pos;
    return this;
  }

  skip(n: number): this {
    this.pos += n;
    return this;
  }

  private need(n: number, what: string): void {
    if (this.pos + n > this.buf.length) {
      throw new RangeError(
        `truncated file: wanted ${n} byte(s) for ${what} at offset ${this.pos}, only ${this.buf.length - this.pos} left`,
      );
    }
  }

  u8(): number {
    this.need(1, 'u8');
    return this.buf[this.pos++]!;
  }

  i8(): number {
    this.need(1, 'i8');
    return this.buf.readInt8(this.pos++);
  }

  u16(): number {
    this.need(2, 'u16');
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  u32(): number {
    this.need(4, 'u32');
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  i32(): number {
    this.need(4, 'i32');
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  /** u16 length prefix followed by raw bytes (latin1, as the client writes it). */
  string(): string {
    const len = this.u16();
    this.need(len, `string of ${len} byte(s)`);
    const s = this.buf.toString('latin1', this.pos, this.pos + len);
    this.pos += len;
    return s;
  }

  bytes(n: number): Buffer {
    this.need(n, `${n} raw byte(s)`);
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }
}
