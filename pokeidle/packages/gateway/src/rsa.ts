import { createPublicKey, createPrivateKey, publicEncrypt, privateDecrypt, constants } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { KeyObject } from 'node:crypto';

/**
 * Raw RSA, the way the protocol uses it.
 *
 * Blocks are exactly 128 bytes and carry no padding scheme — the plaintext is
 * laid out by hand with a leading zero byte and the rest zero-filled. That is
 * why `RSA_NO_PADDING` is the right mode here and why anything but 128 bytes
 * is rejected rather than padded: the server reads fixed offsets out of the
 * decrypted block.
 */

export const RSA_BLOCK = 128;

export function publicKeyFromPem(pemPath: string): KeyObject {
  return createPublicKey(createPrivateKey(readFileSync(pemPath)));
}

export function privateKeyFromPem(pemPath: string): KeyObject {
  return createPrivateKey(readFileSync(pemPath));
}

/** Encrypt one 128-byte block. The caller builds the layout inside it. */
export function encryptBlock(key: KeyObject, block: Buffer): Buffer {
  if (block.length !== RSA_BLOCK) {
    throw new Error(`rsa: block must be exactly ${RSA_BLOCK} bytes, got ${block.length}`);
  }
  return publicEncrypt({ key, padding: constants.RSA_NO_PADDING }, block);
}

/**
 * Decrypt one 128-byte block. Only useful with the server's private key, so
 * this exists for tests and for a gateway that ever needs to read a client's
 * handshake rather than send one.
 */
export function decryptBlock(key: KeyObject, block: Buffer): Buffer {
  if (block.length !== RSA_BLOCK) {
    throw new Error(`rsa: block must be exactly ${RSA_BLOCK} bytes, got ${block.length}`);
  }
  return privateDecrypt({ key, padding: constants.RSA_NO_PADDING }, block);
}
