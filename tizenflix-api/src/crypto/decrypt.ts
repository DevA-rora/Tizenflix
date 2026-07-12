/**
 * Ported from Vidking VideoPlayer-CfmbsjlB.js (Videasy/WingsDatabase decrypt).
 * Magic header "mvm1" = [109, 118, 109, 49]
 */

const Hl = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
  2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
  1925078388, 2162078206, 2614888103, 3248222580,
];
const _f = [1732584193, 4023233417, 2562383102, 271733878];
const Js = 61;
const Sf = 8;
const ms = 2654435769;
const Ys = [109, 118, 109, 49];

const bf = (l: number) => (l * (l + 1) & 1) === 0;
const If = (l: number) => (l * (l + 1) & 1) === 1;

function ui(l: number): number {
  l >>>= 0;
  l ^= l >>> 16;
  l = Math.imul(l, 2246822507) >>> 0;
  l ^= l >>> 13;
  l = Math.imul(l, 3266489909) >>> 0;
  l ^= l >>> 16;
  return l >>> 0;
}

function ps(l: number, o: number): number {
  l >>>= 0;
  o &= 31;
  if (o === 0) return l >>> 0;
  return ((l << o) | (l >>> (32 - o))) >>> 0;
}

function Af(l: string): number {
  let o = _f[0] >>> 0;
  for (let e = 0; e < l.length; e++) {
    o = ps((o ^ Math.imul(l.charCodeAt(e), Hl[e & 15])) >>> 0, 5);
  }
  return ui(o);
}

function wf(l: string): number[] {
  const o = new Array<number>(256);
  for (let i = 0; i < 256; i++) o[i] = i;
  let e = 0;
  for (let i = 0; i < 256; i++) {
    e = (e + o[i]! + l.charCodeAt(i % l.length)) & 255;
    const r = o[i]!;
    o[i] = o[e]!;
    o[e] = r;
  }
  return o;
}

function vf(l: string): number {
  let o = 2166136261;
  for (let e = 0; e < l.length; e++) {
    o = Math.imul(o ^ l.charCodeAt(e), 16777619) >>> 0;
  }
  return ui(o);
}

function Nf(l: number, o: number, e: number): number {
  return ((l ^ o) >>> 0 | ((l & o & e) >>> 0)) >>> 0;
}

interface PrngState {
  S: number[];
  acc: number;
}

function Rf(l: string, o: number): PrngState {
  if (If(l.length)) {
    return { S: wf(l), acc: Af(l) };
  }
  const e = new Array<number>(Js);
  let i = ui(vf(l) ^ ui((o >>> 0) ^ ms)) >>> 0;
  for (let r = 0; r < Sf; r++) {
    if (bf(r)) {
      const n = i % Js;
      i = ps(i + ms >>> 0, 7 + (r & 7));
      e[n] = (i ^ ui(i)) >>> 0;
      i = ui(i + n) >>> 0;
    } else {
      e[r] = Hl[r & 15]!;
    }
  }
  return { S: e, acc: ui(i ^ 2779096485) >>> 0 };
}

function Cf(state: PrngState, o: number): number {
  const e = state.S;
  let i = state.acc;
  const r = i % Js;
  const n = 0 - +(r in e);
  const u = e[r]! >>> 0;
  const d = Math.imul(ms, o + 1) >>> 0;
  let g = Nf(i, (u ^ d) >>> 0, n);
  g = (ps(g + i >>> 0, r & 31) ^ ps(i, Math.imul(r, 7) & 31)) >>> 0;
  i = ui(g + ms >>> 0);
  e[r] = i >>> 0;
  state.acc = i;
  return i >>> 0;
}

function xf(seed: string, tmdbId: number, length: number): Uint8Array {
  const prng = Rf(seed, tmdbId);
  const r = new Uint8Array(length);
  let n = 0;
  for (let u = 0; u < length; ) {
    const d = Cf(prng, n++);
    r[u++] = d & 255;
    if (u < length) r[u++] = (d >>> 8) & 255;
    if (u < length) r[u++] = (d >>> 16) & 255;
    if (u < length) r[u++] = (d >>> 24) & 255;
  }
  return r;
}

function Df(base64url: string): Uint8Array {
  const o = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const e = Buffer.from(o, "base64");
  return new Uint8Array(e);
}

/** Decrypt encrypted source payload (Pf in player JS). */
export function decryptPayload(
  ciphertext: string,
  seed: string,
  tmdbId: number
): string {
  const i = Df(ciphertext);
  const keystream = xf(seed, tmdbId, i.length);
  for (let n = 0; n < i.length; n++) {
    i[n] ^= keystream[n]!;
  }
  for (let n = 0; n < Ys.length; n++) {
    if (i[n] !== Ys[n]) {
      throw new Error("decrypt failed: bad seed or tampered payload");
    }
  }
  return new TextDecoder("utf-8").decode(i.subarray(Ys.length));
}

/** Parse decrypted JSON safely. */
export function decryptAndParse<T = unknown>(
  ciphertext: string,
  seed: string,
  tmdbId: number
): T {
  const json = decryptPayload(ciphertext, seed, tmdbId);
  return JSON.parse(json) as T;
}

export const MAGIC_HEADER = "mvm1";
