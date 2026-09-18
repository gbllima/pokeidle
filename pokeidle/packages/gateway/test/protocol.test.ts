import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { encrypt, decrypt, randomKey, type XteaKey } from '../src/xtea.ts';
import { MessageReader, MessageWriter, adler32, frame } from '../src/message.ts';
import { publicKeyFromPem, privateKeyFromPem, decryptBlock, RSA_BLOCK } from '../src/rsa.ts';
import { buildLoginPacket, LOGIN_LAYOUT, LOGIN_PROTOCOL_ID } from '../src/login.ts';
import { parseLoginResponse, unwrapReply } from '../src/connect.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_PEM = resolve(HERE, '../../../../servidor/key.pem');

const KEY: XteaKey = [0x11223344, 0x55667788, 0x99aabbcc, 0xddeeff00];

// ── xtea ─────────────────────────────────────────────────────────────────────

test('xtea round-trips a single block', () => {
  const plain = Buffer.from('12345678', 'latin1');
  const cipher = encrypt(Buffer.from(plain), KEY);

  assert.notDeepEqual(cipher, plain, 'ciphertext must differ from plaintext');
  assert.deepEqual(decrypt(Buffer.from(cipher), KEY), plain);
});

test('xtea round-trips many blocks', () => {
  const plain = Buffer.alloc(8 * 64);
  for (let i = 0; i < plain.length; i++) plain[i] = (i * 7) & 0xff;

  const cipher = encrypt(Buffer.from(plain), KEY);
  assert.deepEqual(decrypt(Buffer.from(cipher), KEY), plain);
});

test('xtea refuses input that is not whole blocks', () => {
  assert.throws(() => encrypt(Buffer.alloc(7), KEY), /8-byte blocks/);
  assert.throws(() => decrypt(Buffer.alloc(12), KEY), /8-byte blocks/);
});

test('a different key produces a different ciphertext', () => {
  const plain = Buffer.from('abcdefgh', 'latin1');
  const a = encrypt(Buffer.from(plain), KEY);
  const b = encrypt(Buffer.from(plain), [1, 2, 3, 4]);
  assert.notDeepEqual(a, b);
});

test('a random key is four whole 32-bit words', () => {
  const key = randomKey();
  assert.equal(key.length, 4);
  for (const word of key) {
    assert.ok(Number.isInteger(word) && word >= 0 && word <= 0xffffffff, `bad word ${word}`);
  }
});

// ── message ──────────────────────────────────────────────────────────────────

test('the writer and reader agree on every primitive', () => {
  const w = new MessageWriter(64);
  w.u8(0x2a).u16(0xbeef).u32(0xdeadbeef).string('Alex').bytes(Buffer.from([1, 2, 3]));

  const r = new MessageReader(w.toBuffer());
  assert.equal(r.u8(), 0x2a);
  assert.equal(r.u16(), 0xbeef);
  assert.equal(r.u32(), 0xdeadbeef);
  assert.equal(r.string(), 'Alex');
  assert.deepEqual(r.bytes(3), Buffer.from([1, 2, 3]));
  assert.equal(r.remaining, 0);
});

test('strings carry a u16 length prefix', () => {
  const w = new MessageWriter(32);
  w.string('ab');
  const bytes = w.toBuffer();
  assert.deepEqual(bytes, Buffer.from([2, 0, 0x61, 0x62]));
});

test('the writer refuses to overflow its buffer', () => {
  const w = new MessageWriter(4);
  assert.throws(() => w.u32(1).u8(1), /overflow/);
});

test('the reader refuses to read past the end', () => {
  const r = new MessageReader(Buffer.from([1, 2]));
  assert.throws(() => r.u32(), /underflow/);
});

test('padTo fills with zeros and refuses to shrink', () => {
  const w = new MessageWriter(16);
  w.u8(1).padTo(8);
  assert.deepEqual(w.toBuffer(), Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]));
  assert.throws(() => new MessageWriter(16).u32(1).u32(2).u32(3).padTo(4), /cannot pad down/);
});

test('adler32 matches the reference value for "Wikipedia"', () => {
  assert.equal(adler32(Buffer.from('Wikipedia', 'latin1')), 0x11e60398);
});

test('framing prefixes the body with its length', () => {
  const framed = frame(Buffer.from([9, 9, 9]));
  assert.equal(framed.readUInt16LE(0), 3);
  assert.deepEqual(framed.subarray(2), Buffer.from([9, 9, 9]));
});

// ── login handshake ──────────────────────────────────────────────────────────

const hasKey = existsSync(KEY_PEM);

test('the login packet decrypts back to what went in', { skip: !hasKey && 'servidor/key.pem not found' }, () => {
  const pub = publicKeyFromPem(KEY_PEM);
  const priv = privateKeyFromPem(KEY_PEM);

  const request = {
    os: 2,
    version: 1098,
    signatures: { protocolVersion: 1098, dat: 0x42a3, spr: 0x57bbd603, pic: 0 },
    xteaKey: KEY,
    accountName: 'treinador',
    password: 'senhaforte123',
    token: '',
    stayLoggedIn: true,
  };

  const packet = buildLoginPacket(pub, request);
  const body = packet.subarray(6);

  assert.equal(packet.readUInt16LE(0), 4 + body.length, 'the frame length covers checksum and body');
  assert.equal(packet.readUInt32LE(2), adler32(body), 'the login service refuses a bad checksum');
  assert.equal(body.length, LOGIN_LAYOUT.total);

  const head = new MessageReader(body);
  assert.equal(head.u8(), LOGIN_PROTOCOL_ID);
  assert.equal(head.u16(), request.os);
  assert.equal(head.u16(), request.version);

  // The server decrypts the first block and reads the session key and
  // credentials straight out of it.
  const credentials = decryptBlock(priv, body.subarray(LOGIN_LAYOUT.credentials, LOGIN_LAYOUT.token));
  const cr = new MessageReader(credentials);
  assert.equal(cr.u8(), 0, 'a leading zero is how the server knows RSA succeeded');
  assert.deepEqual([cr.u32(), cr.u32(), cr.u32(), cr.u32()], [...KEY]);
  assert.equal(cr.string(), request.accountName);
  assert.equal(cr.string(), request.password);

  // The token block is found by seeking to the last 128 bytes, not by reading
  // forward, so it has to sit exactly at the end.
  assert.equal(body.length - RSA_BLOCK, LOGIN_LAYOUT.token);
  const tokenBlock = decryptBlock(priv, body.subarray(LOGIN_LAYOUT.token));
  const tr = new MessageReader(tokenBlock);
  assert.equal(tr.u8(), 0);
  assert.equal(tr.string(), '');
  assert.equal(tr.u8(), 1, 'stay-logged-in flag');
});

test('each RSA block is exactly 128 bytes', { skip: !hasKey && 'servidor/key.pem not found' }, () => {
  const pub = publicKeyFromPem(KEY_PEM);
  const packet = buildLoginPacket(pub, {
    os: 2,
    version: 1098,
    signatures: { protocolVersion: 1098, dat: 1, spr: 2, pic: 3 },
    xteaKey: KEY,
    accountName: 'a',
    password: 'b',
  });

  assert.equal(packet.length - 6, 22 + 128 * 2);
});

test('an over-long credential set is refused rather than truncated', { skip: !hasKey && 'servidor/key.pem not found' }, () => {
  const pub = publicKeyFromPem(KEY_PEM);
  assert.throws(
    () =>
      buildLoginPacket(pub, {
        os: 2,
        version: 1098,
        signatures: { protocolVersion: 1098, dat: 1, spr: 2, pic: 3 },
        xteaKey: KEY,
        accountName: 'x'.repeat(80),
        password: 'y'.repeat(80),
      }),
    /overflow|cannot pad down/,
  );
});

// ── character list ───────────────────────────────────────────────────────────

/** Build the reply body this fork writes, straight from protocollogin.cpp. */
function characterListReply(team: string): Buffer {
  const w = new MessageWriter();
  w.u8(0x14).string('1\nBem Vindo Ao PokeContest!');
  w.u8(0x28).string('gateway\ntest1234');
  w.u8(0x64);
  w.u8(1); // one world
  w.u8(0).string('PokeContest').string('127.0.0.1').u16(7172).u8(0);
  w.u8(1); // one character
  w.u8(0); // resolved
  w.string('Tester');
  w.u32(0).u32(7); // vocation, level
  w.u32(128).u32(1).u32(2).u32(3).u32(4).u32(5); // looktype + body/feet/head/legs/addons
  w.string(team);
  w.u8(0).u8(0).u32(0); // trailer: separator, premium flag, premium until
  return w.toBuffer();
}

test('the character list is read with this fork\'s extra fields', () => {
  const team = JSON.stringify([{ name: 'Pikachu', level: 12, boost: 3, looktype: { lookType: 1025 } }]);
  const result = parseLoginResponse(characterListReply(team));

  assert.equal(result.kind, 'characters');
  if (result.kind !== 'characters') return;

  assert.equal(result.motd, '1\nBem Vindo Ao PokeContest!');
  assert.deepEqual(result.worlds, [{ id: 0, name: 'PokeContest', host: '127.0.0.1', port: 7172 }]);
  assert.equal(result.characters.length, 1);

  const [character] = result.characters;
  assert.equal(character.name, 'Tester');
  assert.equal(character.level, 7);
  // Reading lookaddons is what keeps the team string from being mistaken for
  // the next character's status byte.
  assert.deepEqual(character.outfit, { looktype: 128, body: 1, feet: 2, head: 3, legs: 4, addons: 5 });
  assert.deepEqual(character.team, [{ name: 'Pikachu', level: 12, boost: 3, looktype: { lookType: 1025 } }]);
});

test('a malformed team leaves the character listed with an empty party', () => {
  const result = parseLoginResponse(characterListReply("[{'name': broken"));
  assert.equal(result.kind, 'characters');
  if (result.kind !== 'characters') return;
  assert.equal(result.characters[0].name, 'Tester');
  assert.deepEqual(result.characters[0].team, []);
});

test('a login error is reported rather than parsed as a list', () => {
  const w = new MessageWriter();
  w.u8(0x0b).string('Account name or password is not correct.');
  const result = parseLoginResponse(w.toBuffer());
  assert.equal(result.kind, 'error');
  if (result.kind !== 'error') return;
  assert.match(result.message, /not correct/);
});

test('unwrapReply refuses a frame whose checksum does not match', () => {
  const bad = Buffer.alloc(16);
  bad.writeUInt32LE(0xdeadbeef, 0);
  assert.throws(() => unwrapReply(bad, KEY), /checksum/);
});
