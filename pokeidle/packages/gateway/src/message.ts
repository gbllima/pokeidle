/**
 * The wire message the OT protocol carries.
 *
 * Little-endian throughout, strings length-prefixed with a u16. The framing
 * matters as much as the contents: the server reads a two-byte length, then a
 * body that may be XTEA-encrypted, and inside that an adler32 checksum on
 * versions that use one.
 */

export const MAX_BODY = 24590;

export class MessageWriter {
  private buf: Buffer;
  private pos = 0;

  constructor(capacity = MAX_BODY) {
    this.buf = Buffer.alloc(capacity);
  }

  get length(): number {
    return this.pos;
  }

  private room(n: number): void {
    if (this.pos + n > this.buf.length) {
      throw new RangeError(`message overflow: ${this.pos + n} bytes exceeds ${this.buf.length}`);
    }
  }

  u8(v: number): this {
    this.room(1);
    this.buf.writeUInt8(v & 0xff, this.pos);
    this.pos += 1;
    return this;
  }

  u16(v: number): this {
    this.room(2);
    this.buf.writeUInt16LE(v & 0xffff, this.pos);
    this.pos += 2;
    return this;
  }

  u32(v: number): this {
    this.room(4);
    this.buf.writeUInt32LE(v >>> 0, this.pos);
    this.pos += 4;
    return this;
  }

  /** u16 length followed by the raw bytes, the way the client writes them. */
  string(value: string): this {
    const bytes = Buffer.from(value, 'latin1');
    this.u16(bytes.length);
    this.bytes(bytes);
    return this;
  }

  bytes(value: Buffer): this {
    this.room(value.length);
    value.copy(this.buf, this.pos);
    this.pos += value.length;
    return this;
  }

  /** Fill to `size` with zeros. Used to pad an RSA block to its full width. */
  padTo(size: number): this {
    if (this.pos > size) {
      throw new RangeError(`already ${this.pos} bytes, cannot pad down to ${size}`);
    }
    this.buf.fill(0, this.pos, size);
    this.pos = size;
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.buf.subarray(0, this.pos));
  }
}

export class MessageReader {
  private pos = 0;
  private readonly buf: Buffer;

  // Written out rather than as a parameter property: node's strip-only
  // TypeScript refuses those, and this project runs .ts without a build.
  constructor(buf: Buffer) {
    this.buf = buf;
  }

  get remaining(): number {
    return this.buf.length - this.pos;
  }

  private need(n: number): void {
    if (this.pos + n > this.buf.length) {
      throw new RangeError(`message underflow: wanted ${n} at ${this.pos}`);
    }
  }

  u8(): number {
    this.need(1);
    return this.buf.readUInt8(this.pos++);
  }

  u16(): number {
    this.need(2);
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  string(): string {
    const len = this.u16();
    this.need(len);
    const s = this.buf.toString('latin1', this.pos, this.pos + len);
    this.pos += len;
    return s;
  }

  bytes(n: number): Buffer {
    this.need(n);
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return Buffer.from(b);
  }

  skip(n: number): this {
    this.need(n);
    this.pos += n;
    return this;
  }
}

/**
 * Adler-32 over a buffer.
 *
 * The protocol puts this in front of the body so the server can reject a
 * corrupted frame before trying to decrypt it.
 */
export function adler32(data: Buffer): number {
  const MOD = 65521;
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

/** Prefix a body with its u16 length, which is how a frame goes on the wire. */
export function frame(body: Buffer): Buffer {
  const out = Buffer.alloc(2 + body.length);
  out.writeUInt16LE(body.length, 0);
  body.copy(out, 2);
  return out;
}

/**
 * Frame a body behind its length and an adler32 of itself.
 *
 * Not optional for the login service. `ServicePort::make_protocol` refuses to
 * build a protocol whose service declares `use_checksum` when the frame did
 * not carry a matching one, and returns null — which the connection turns into
 * a silent close. No error reaches the client, so a missing checksum looks
 * exactly like a rejected password.
 */
export function frameWithChecksum(body: Buffer): Buffer {
  const out = Buffer.alloc(2 + 4 + body.length);
  out.writeUInt16LE(4 + body.length, 0);
  out.writeUInt32LE(adler32(body), 2);
  body.copy(out, 6);
  return out;
}
