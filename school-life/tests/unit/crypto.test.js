import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync, createHash } from 'node:crypto';
import { pbkdf2Js, pbkdf2Hex, sha256, toHex, fromHex, safeEqual } from '../../src/core/crypto.js';

const enc = new TextEncoder();

test('sha256 matches node for many lengths', () => {
  for (const len of [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 200]) {
    const data = new Uint8Array(len).map((_, i) => (i * 31 + 7) & 255);
    assert.equal(toHex(sha256(data)), createHash('sha256').update(data).digest('hex'), 'len ' + len);
  }
});

test('pure-JS PBKDF2 matches node pbkdf2Sync', () => {
  const cases = [
    ['password', '73616c74', 1],
    ['hunter2!', '00112233445566778899aabbccddeeff', 1000],
    ['a'.repeat(100), 'deadbeef', 50], // long key (> 64 bytes) path
    ['schoollife', 'cafebabe0102', 4096],
  ];
  for (const [pw, salt, it] of cases) {
    const expect = pbkdf2Sync(pw, Buffer.from(salt, 'hex'), it, 32, 'sha256').toString('hex');
    assert.equal(pbkdf2Js(enc.encode(pw), fromHex(salt), it), expect, pw + '/' + it);
  }
});

test('pbkdf2Hex (WebCrypto path) matches pure JS', async () => {
  const a = await pbkdf2Hex('mySecret1', 'a1b2c3d4e5f60718', 2000);
  const b = pbkdf2Js(enc.encode('mySecret1'), fromHex('a1b2c3d4e5f60718'), 2000);
  assert.equal(a, b);
});

test('safeEqual', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});
