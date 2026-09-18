import { BinaryReader } from '../io/reader.ts';

/**
 * The OTB container format, shared by items.otb and map.otbm.
 *
 * A node is: START, type byte, property bytes, zero or more child nodes, END.
 * Any property byte equal to one of the three control bytes is prefixed with
 * ESCAPE, so property ranges must be scanned rather than skipped by length.
 */
export const NODE = {
  ESCAPE: 0xfd,
  START: 0xfe,
  END: 0xff,
} as const;

export type NodeVisit = {
  type: number;
  depth: number;
  /** Unescape and wrap this node's property bytes. Cheap to skip. */
  props: () => BinaryReader;
};

/** Return false from `enter` to skip a node's children entirely. */
export type Visitor = {
  enter?: (node: NodeVisit) => boolean | void;
  leave?: (type: number, depth: number) => void;
};

export function unescape(buf: Buffer, start: number, end: number): Buffer {
  // Fast path: most property ranges contain no escape bytes at all.
  let escapes = 0;
  for (let i = start; i < end; i++) if (buf[i] === NODE.ESCAPE) { escapes++; i++; }
  if (escapes === 0) return buf.subarray(start, end);

  const out = Buffer.alloc(end - start - escapes);
  let w = 0;
  for (let i = start; i < end; i++) {
    if (buf[i] === NODE.ESCAPE) i++;
    out[w++] = buf[i]!;
  }
  return out.subarray(0, w);
}

/**
 * Walk the tree rooted at the first node in `buf`.
 * The 4-byte file header (version/flags) is consumed here.
 */
export function walkTree(buf: Buffer, visitor: Visitor): void {
  let pos = 4; // leading u32 header
  if (buf[pos] !== NODE.START) {
    throw new Error(`not an OTB container: expected 0xFE at offset ${pos}, found 0x${buf[pos]?.toString(16)}`);
  }
  walkNode(buf, pos, 0, visitor);
}

function walkNode(buf: Buffer, pos: number, depth: number, visitor: Visitor): number {
  pos++; // START
  const type = buf[pos++]!;

  const propsStart = pos;
  while (pos < buf.length) {
    const b = buf[pos]!;
    if (b === NODE.ESCAPE) {
      pos += 2;
      continue;
    }
    if (b === NODE.START || b === NODE.END) break;
    pos++;
  }
  const propsEnd = pos;

  let descend = true;
  if (visitor.enter) {
    const r = visitor.enter({
      type,
      depth,
      props: () => new BinaryReader(unescape(buf, propsStart, propsEnd)),
    });
    if (r === false) descend = false;
  }

  while (pos < buf.length && buf[pos] === NODE.START) {
    if (descend) {
      pos = walkNode(buf, pos, depth + 1, visitor);
    } else {
      pos = skipNode(buf, pos);
    }
  }

  if (buf[pos] !== NODE.END) {
    throw new Error(`malformed node of type ${type}: expected 0xFF at offset ${pos}`);
  }
  pos++; // END

  visitor.leave?.(type, depth);
  return pos;
}

/** Advance past a node and its whole subtree without allocating anything. */
function skipNode(buf: Buffer, pos: number): number {
  let depth = 0;
  while (pos < buf.length) {
    const b = buf[pos]!;
    if (b === NODE.ESCAPE) {
      pos += 2;
      continue;
    }
    if (b === NODE.START) depth++;
    else if (b === NODE.END) {
      depth--;
      if (depth === 0) return pos + 1;
    }
    pos++;
  }
  throw new Error('unterminated node while skipping subtree');
}
