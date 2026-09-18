import type { KeyObject } from 'node:crypto';
import { MessageWriter, frameWithChecksum } from './message.ts';
import { encryptBlock, RSA_BLOCK } from './rsa.ts';
import type { XteaKey } from './xtea.ts';

/**
 * The login request, laid out to match `ProtocolLogin::onRecvFirstMessage`.
 *
 * Two RSA blocks, not one. The first carries the XTEA key both sides will use
 * for the rest of the session plus the credentials; the second sits at the
 * very end and carries the authenticator token — the server finds it by
 * seeking to `length - 128` rather than by reading forward, so anything
 * between the two blocks is skipped and only the trailing position matters.
 */

export const LOGIN_PROTOCOL_ID = 0x01;

/** Signatures the client reports; the login server skips over them. */
export type ClientSignatures = {
  protocolVersion: number;
  dat: number;
  spr: number;
  pic: number;
};

export type LoginRequest = {
  os: number;
  version: number;
  signatures: ClientSignatures;
  xteaKey: XteaKey;
  accountName: string;
  password: string;
  /** Empty unless the account has two-factor enabled. */
  token?: string;
  stayLoggedIn?: boolean;
};

/** Build the credential block: the layout the server reads after RSA. */
function credentialBlock(request: LoginRequest): Buffer {
  const block = new MessageWriter(RSA_BLOCK);
  // A leading zero is what tells the server the block decrypted correctly.
  block.u8(0);
  for (const word of request.xteaKey) block.u32(word);
  block.string(request.accountName);
  block.string(request.password);
  // The fork reads a u16, a fixed five bytes, then another u16 here.
  block.u16(0);
  block.bytes(Buffer.alloc(5));
  block.u16(0);
  return block.padTo(RSA_BLOCK).toBuffer();
}

function tokenBlock(request: LoginRequest): Buffer {
  const block = new MessageWriter(RSA_BLOCK);
  block.u8(0);
  block.string(request.token ?? '');
  block.u8(request.stayLoggedIn ? 1 : 0);
  return block.padTo(RSA_BLOCK).toBuffer();
}

/**
 * Assemble the framed login packet, ready to write to the socket.
 * `serverKey` is the public half of `servidor/key.pem`.
 */
export function buildLoginPacket(serverKey: KeyObject, request: LoginRequest): Buffer {
  const body = new MessageWriter();

  body.u8(LOGIN_PROTOCOL_ID);
  body.u16(request.os);
  body.u16(request.version);
  body.u32(request.signatures.protocolVersion);
  body.u32(request.signatures.dat);
  body.u32(request.signatures.spr);
  body.u32(request.signatures.pic);
  body.u8(0);

  body.bytes(encryptBlock(serverKey, credentialBlock(request)));
  body.bytes(encryptBlock(serverKey, tokenBlock(request)));

  return frameWithChecksum(body.toBuffer());
}

/**
 * Where each part sits in the login body, counted from the protocol id — that
 * is, after the two length bytes and the four checksum bytes.
 */
export const LOGIN_LAYOUT = {
  protocolId: 0,
  os: 1,
  version: 3,
  /** 4 signatures plus the trailing zero the server skips. */
  skipped: 5,
  credentials: 22,
  token: 22 + RSA_BLOCK,
  total: 22 + RSA_BLOCK * 2,
} as const;
