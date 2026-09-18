import { connect as tcpConnect } from 'node:net';
import type { KeyObject } from 'node:crypto';
import { buildLoginPacket, type LoginRequest } from './login.ts';
import { decrypt, type XteaKey } from './xtea.ts';
import { MessageReader, adler32 } from './message.ts';

/**
 * Talk to the login server.
 *
 * The reply comes back encrypted with the XTEA key the request just proposed,
 * behind a length prefix and an adler32 of everything after it. Decrypting it
 * is the only proof the handshake actually worked: an error message is as good
 * a result as a character list, because the server had to decrypt the RSA
 * block to know the account was wrong.
 */

/** One team member as the character list carries it. */
export type TeamMember = {
  name?: string;
  level?: number;
  boost?: number;
  looktype?: { lookType?: number };
};

export type Character = {
  name: string;
  vocation: number;
  level: number;
  outfit: {
    looktype: number;
    body: number;
    feet: number;
    head: number;
    legs: number;
    addons: number;
  };
  /**
   * The team, already decoded. This fork appends it to every character entry —
   * logout.lua writes json.encode of the player's pokeballs — so the select
   * screen can draw the party without logging into the world first.
   */
  team: TeamMember[];
};

export type World = {
  id: number;
  name: string;
  host: string;
  port: number;
};

export type LoginResult =
  | { kind: 'error'; code: number; message: string }
  | { kind: 'characters'; motd?: string; sessionKey?: string; worlds: World[]; characters: Character[] };

/** Opcodes the login server answers with. */
const OP = {
  errorLegacy: 0x0a,
  error: 0x0b,
  motd: 0x14,
  sessionKey: 0x28,
  characterList: 0x64,
} as const;

/**
 * Decode the team blob.
 *
 * It is player-influenced text that reached the column through Lua string
 * concatenation, so it can be malformed in ways JSON.parse will not forgive.
 * A character whose team fails to decode should still appear in the list with
 * an empty party rather than take the whole login down.
 */
function parseTeam(raw: string): TeamMember[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TeamMember[]) : [];
  } catch {
    return [];
  }
}

export function parseLoginResponse(plain: Buffer): LoginResult {
  const r = new MessageReader(plain);
  let motd: string | undefined;
  let sessionKey: string | undefined;
  const worlds: World[] = [];
  const characters: Character[] = [];

  while (r.remaining > 0) {
    const op = r.u8();

    if (op === OP.error || op === OP.errorLegacy) {
      return { kind: 'error', code: op, message: r.string() };
    }

    if (op === OP.motd) {
      motd = r.string();
      continue;
    }

    if (op === OP.sessionKey) {
      sessionKey = r.string();
      continue;
    }

    if (op === OP.characterList) {
      const worldCount = r.u8();
      for (let i = 0; i < worldCount; i++) {
        worlds.push({ id: r.u8(), name: r.string(), host: r.string(), port: r.u16() });
        r.u8(); // preview flag
      }

      const count = r.u8();
      for (let i = 0; i < count; i++) {
        // 0 means the server resolved this character; 1 means the lookup
        // failed and nothing follows for it, not even a name.
        if (r.u8() !== 0) continue;

        characters.push({
          name: r.string(),
          vocation: r.u32(),
          level: r.u32(),
          outfit: {
            looktype: r.u32(),
            body: r.u32(),
            feet: r.u32(),
            head: r.u32(),
            legs: r.u32(),
            addons: r.u32(),
          },
          team: parseTeam(r.string()),
        });
      }
      break;
    }

    // Anything else is a flag byte this client does not need.
    if (r.remaining > 0) r.u8();
  }

  return { kind: 'characters', motd, sessionKey, worlds, characters };
}

/**
 * Unwrap a reply frame: strip the length, verify the checksum, decrypt, and
 * drop the inner length the server writes ahead of the payload.
 */
export function unwrapReply(frameBody: Buffer, key: XteaKey): Buffer {
  const checksum = frameBody.readUInt32LE(0);
  const rest = frameBody.subarray(4);

  if (adler32(rest) !== checksum) {
    throw new Error('reply checksum does not match; the frame is corrupt');
  }

  const decrypted = decrypt(Buffer.from(rest), key);
  const inner = decrypted.readUInt16LE(0);
  return decrypted.subarray(2, 2 + inner);
}

export type ConnectOptions = {
  host: string;
  port: number;
  serverKey: KeyObject;
  request: LoginRequest;
  timeoutMs?: number;
};

export function login(options: ConnectOptions): Promise<LoginResult> {
  const { host, port, serverKey, request, timeoutMs = 8000 } = options;

  return new Promise((resolve, reject) => {
    const socket = tcpConnect({ host, port });
    let buffer = Buffer.alloc(0);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn();
    };

    socket.setTimeout(timeoutMs, () =>
      finish(() => reject(new Error(`no reply from ${host}:${port} within ${timeoutMs}ms`))),
    );
    socket.on('error', (err) => finish(() => reject(err)));
    socket.on('close', () => {
      if (!settled) finish(() => reject(new Error('server closed the connection without replying')));
    });

    socket.on('connect', () => socket.write(buildLoginPacket(serverKey, request)));

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 2) return;

      const length = buffer.readUInt16LE(0);
      if (buffer.length < 2 + length) return;

      try {
        const plain = unwrapReply(buffer.subarray(2, 2 + length), request.xteaKey);
        finish(() => resolve(parseLoginResponse(plain)));
      } catch (err) {
        finish(() => reject(err));
      }
    });
  });
}
