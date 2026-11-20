// Password hashing for on-device accounts.
// Uses WebCrypto PBKDF2-SHA256 when available (https / localhost) and an identical
// pure-JS implementation otherwise (e.g. testing over plain http on a phone).

const enc = new TextEncoder();

export function toHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export function fromHex(hex) {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function randomHex(nBytes = 16) {
  const a = new Uint8Array(nBytes);
  globalThis.crypto.getRandomValues(a);
  return toHex(a);
}

/** Constant-time string compare (for hex digests). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function pbkdf2Hex(password, saltHex, iterations) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (subtle) {
    try {
      const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits(
        { name: 'PBKDF2', salt: fromHex(saltHex), iterations, hash: 'SHA-256' },
        key,
        256,
      );
      return toHex(new Uint8Array(bits));
    } catch (e) {
      // fall through to the JS implementation
    }
  }
  return pbkdf2Js(enc.encode(password), fromHex(saltHex), iterations);
}

// ---------------------------------------------------------------------------
// Pure JS SHA-256 / HMAC / PBKDF2 (optimised: HMAC pads are pre-hashed once)
// ---------------------------------------------------------------------------
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const IV = new Int32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);
const W = new Int32Array(64);

function compress(state, block, off) {
  for (let i = 0; i < 16; i++) {
    const j = off + i * 4;
    W[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
  }
  for (let i = 16; i < 64; i++) {
    const w15 = W[i - 15];
    const w2 = W[i - 2];
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = state[0], b = state[1], c = state[2], d = state[3];
  let e = state[4], f = state[5], g = state[6], h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0;
    d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0;
  state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0;
  state[4] = (state[4] + e) | 0; state[5] = (state[5] + f) | 0;
  state[6] = (state[6] + g) | 0; state[7] = (state[7] + h) | 0;
}

/** Finish a hash: start from `state` (already absorbed `prefixLen` bytes), absorb msg + padding. */
function finish(state, msg, prefixLen, out) {
  const s = new Int32Array(state);
  const total = prefixLen + msg.length;
  const padLen = ((msg.length + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(padLen);
  buf.set(msg);
  buf[msg.length] = 0x80;
  const bits = total * 8;
  buf[padLen - 4] = (bits >>> 24) & 255;
  buf[padLen - 3] = (bits >>> 16) & 255;
  buf[padLen - 2] = (bits >>> 8) & 255;
  buf[padLen - 1] = bits & 255;
  buf[padLen - 5] = Math.floor(bits / 0x100000000) & 255;
  for (let off = 0; off < padLen; off += 64) compress(s, buf, off);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (s[i] >>> 24) & 255;
    out[i * 4 + 1] = (s[i] >>> 16) & 255;
    out[i * 4 + 2] = (s[i] >>> 8) & 255;
    out[i * 4 + 3] = s[i] & 255;
  }
  return out;
}

export function sha256(bytes) {
  return finish(IV, bytes, 0, new Uint8Array(32));
}

export function pbkdf2Js(passBytes, salt, iterations) {
  let key = passBytes;
  if (key.length > 64) key = sha256(key);
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const k = i < key.length ? key[i] : 0;
    ipad[i] = k ^ 0x36;
    opad[i] = k ^ 0x5c;
  }
  const inner = new Int32Array(IV);
  compress(inner, ipad, 0);
  const outer = new Int32Array(IV);
  compress(outer, opad, 0);

  const first = new Uint8Array(salt.length + 4);
  first.set(salt);
  first[salt.length + 3] = 1; // block index 1 (we only need 32 bytes)

  const tmp = new Uint8Array(32);
  const u = new Uint8Array(32);
  finish(inner, first, 64, tmp);
  finish(outer, tmp, 64, u);
  const t = new Uint8Array(u);
  for (let i = 1; i < iterations; i++) {
    finish(inner, u, 64, tmp);
    finish(outer, tmp, 64, u);
    for (let j = 0; j < 32; j++) t[j] ^= u[j];
  }
  return toHex(t);
}
