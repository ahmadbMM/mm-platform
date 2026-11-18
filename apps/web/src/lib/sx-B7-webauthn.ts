// Passkeys (N06, builder B7, 2026-11-18; the user: "do all" of the report "Store and Experiences mobile design"): the
// WebAuthn checks this server makes before the database signs anyone in or keeps a new passkey. Written on WebCrypto
// alone (crypto.subtle: the same API in a Cloudflare Worker and in Node), with no library: the site asks for no
// attestation ("none"), so all a library would add is attestation formats and certificate chains it never uses, and
// the checks below are the short list of WebAuthn Level 3, sections 7.1 (registration) and 7.2 (authentication).
//
// Pure: nothing here reads a cookie, the network or the database. Every check that fails answers why, in one word
// (PasskeyFail); nothing here throws to its caller. Accepted keys: ES256 (ECDSA P-256, COSE -7: Apple, Google,
// Samsung, security keys) and RS256 (RSA PKCS#1 v1.5 SHA-256, COSE -257, 2048-4096 bits: Windows Hello). Tested with
// browser-made vectors and with ones made in the test by WebCrypto (src/lib/__tests__/sx-B7.test.ts).

export type Bytes = Uint8Array<ArrayBuffer>;

/** Why a response was refused. */
export type PasskeyFail =
  | "format" // not the shape a browser sends, or bytes that do not parse
  | "type" // clientDataJSON.type is not the ceremony's
  | "challenge" // not the challenge this server handed out
  | "origin" // made on a page that is not this site's
  | "cross_origin" // made inside another site's frame
  | "rp" // made for another relying party (rpIdHash)
  | "presence" // the user-present flag is missing
  | "verification" // no Face ID, fingerprint or device PIN (the user-verified flag)
  | "backup" // backup state without backup eligibility, or eligibility that changed since it was added
  | "alg" // a key type this site does not take
  | "key" // a key WebCrypto refuses
  | "signature" // the signature does not verify
  | "user" // the user handle is missing or is another account's
  | "credential"; // the credential id does not match

export type Verdict<T> = ({ ok: true } & T) | { ok: false; why: PasskeyFail };

/** Where passkeys are made and used: the relying party id and the exact page origins allowed to use it. */
export type RpConfig = { rpId: string; origins: readonly string[] };

export const ALG_ES256 = -7;
export const ALG_RS256 = -257;
export const ALGS = [ALG_ES256, ALG_RS256] as const;

const FLAG_UP = 0x01, FLAG_UV = 0x04, FLAG_BE = 0x08, FLAG_BS = 0x10, FLAG_AT = 0x40, FLAG_ED = 0x80;

class Refused extends Error {
  constructor(readonly why: PasskeyFail) { super(why); }
}
const refuse = (why: PasskeyFail): never => { throw new Refused(why); };

/* ------------------------------------------------------------------ base64url */

/** base64url (no padding) to bytes; null for anything that is not strictly that. */
export function b64urlToBytes(s: unknown): Bytes | null {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  let bin: string;
  try { bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); } catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Bytes to base64url, no padding. */
export function bytesToB64url(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The one spelling of a base64url value (what its bytes encode to), or null: a value with stray low bits decodes to
 *  the same bytes as the proper one, so ids are always compared and stored in this form. */
export const canonicalB64url = (s: unknown): string | null => {
  const b = b64urlToBytes(s);
  return b ? bytesToB64url(b) : null;
};

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const utf8 = (s: string): Bytes => new TextEncoder().encode(s) as Bytes;

export async function sha256(data: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

/* ------------------------------------------------------------------ CBOR (the subset WebAuthn uses) */

export type Cbor = number | string | boolean | null | Bytes | Cbor[] | Map<number | string, Cbor>;

/** One CBOR item at `at`: its value and where it ends. Definite lengths only (CTAP2's canonical CBOR), integer and
 *  text map keys, no tags, no floats, 16 levels at most; anything else is "format". */
export function cborItem(buf: Bytes, at = 0, depth = 0): { value: Cbor; end: number } {
  if (depth > 16 || at >= buf.length) refuse("format");
  const ib = buf[at], major = ib >> 5, ai = ib & 31;
  let p = at + 1;
  const need = (n: number) => { if (p + n > buf.length) refuse("format"); };
  let arg: number;
  if (ai < 24) arg = ai;
  else if (ai === 24) { need(1); arg = buf[p]; p += 1; }
  else if (ai === 25) { need(2); arg = (buf[p] << 8) | buf[p + 1]; p += 2; }
  else if (ai === 26) { need(4); arg = ((buf[p] << 24) >>> 0) + ((buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]); p += 4; }
  else if (ai === 27) {
    need(8);
    const hi = ((buf[p] << 24) >>> 0) + ((buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]);
    const lo = ((buf[p + 4] << 24) >>> 0) + ((buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]);
    if (hi > 0x1fffff) refuse("format"); // past Number.MAX_SAFE_INTEGER
    arg = hi * 2 ** 32 + lo; p += 8;
  } else return refuse("format"); // 28-30 reserved, 31 indefinite length
  if (major === 7) {
    if (ai === 20) return { value: false, end: p };
    if (ai === 21) return { value: true, end: p };
    if (ai === 22) return { value: null, end: p };
    return refuse("format"); // undefined, simple values, floats
  }
  switch (major) {
    case 0: return { value: arg, end: p };
    case 1: return { value: -1 - arg, end: p };
    case 2: need(arg); return { value: buf.slice(p, p + arg), end: p + arg };
    case 3: {
      need(arg);
      let s = "";
      try { s = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(p, p + arg)); } catch { refuse("format"); }
      return { value: s, end: p + arg };
    }
    case 4: {
      if (arg > buf.length - p) refuse("format");
      const out: Cbor[] = [];
      for (let i = 0; i < arg; i++) { const it = cborItem(buf, p, depth + 1); out.push(it.value); p = it.end; }
      return { value: out, end: p };
    }
    case 5: {
      if (arg > (buf.length - p) / 2) refuse("format");
      const m = new Map<number | string, Cbor>();
      for (let i = 0; i < arg; i++) {
        const k = cborItem(buf, p, depth + 1);
        if (typeof k.value !== "number" && typeof k.value !== "string") refuse("format");
        const key = k.value as number | string;
        if (m.has(key)) refuse("format");
        const v = cborItem(buf, k.end, depth + 1);
        m.set(key, v.value); p = v.end;
      }
      return { value: m, end: p };
    }
    default: return refuse("format"); // 6: tags
  }
}

/** A whole buffer that is exactly one CBOR item. */
export function cborWhole(buf: Bytes): Cbor {
  const { value, end } = cborItem(buf);
  if (end !== buf.length) refuse("format");
  return value;
}

/* ------------------------------------------------------------------ clientDataJSON */

export type CeremonyType = "webauthn.create" | "webauthn.get";

/** clientDataJSON checked (7.1 steps 5-10, 7.2 steps 9-14): the ceremony's type, this server's challenge exactly, one
 *  of the allowed origins, and never from inside another site's frame. */
export function checkClientData(raw: Bytes, want: { type: CeremonyType; challenge: string; origins: readonly string[] }): void {
  let c: unknown;
  try { c = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch { refuse("format"); }
  if (!c || typeof c !== "object" || Array.isArray(c)) refuse("format");
  const d = c as Record<string, unknown>;
  if (d.type !== want.type) refuse("type");
  if (typeof d.challenge !== "string" || !want.challenge || d.challenge !== want.challenge) refuse("challenge");
  if (typeof d.origin !== "string" || !want.origins.includes(d.origin)) refuse("origin");
  if (d.crossOrigin !== undefined && typeof d.crossOrigin !== "boolean") refuse("format");
  if (d.crossOrigin === true || d.topOrigin !== undefined) refuse("cross_origin");
}

/** The challenge a clientDataJSON carries, or null: read before the database is asked, to match the browser's
 *  challenge cookie. */
export function clientChallenge(clientDataB64: unknown): string | null {
  const raw = b64urlToBytes(clientDataB64);
  if (!raw || raw.length > 4096) return null;
  try {
    const c = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)) as { challenge?: unknown };
    return typeof c?.challenge === "string" ? c.challenge : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ authenticator data */

export type AuthData = {
  rpIdHash: Bytes; flags: number; signCount: number;
  up: boolean; uv: boolean; be: boolean; bs: boolean;
  /** registration only (the AT flag): the authenticator model, the credential id and its COSE public key, as bytes */
  aaguid?: Bytes; credId?: Bytes; coseKey?: Bytes;
};

/** authenticatorData parsed: rpIdHash, flags, the signature counter and, with the AT flag, the new credential. With
 *  the ED flag an extensions map follows; nothing may follow what the flags announce. */
export function parseAuthData(b: Bytes): AuthData {
  if (b.length < 37) refuse("format");
  const flags = b[32];
  const signCount = ((b[33] << 24) >>> 0) + ((b[34] << 16) | (b[35] << 8) | b[36]);
  const out: AuthData = {
    rpIdHash: b.slice(0, 32), flags, signCount,
    up: !!(flags & FLAG_UP), uv: !!(flags & FLAG_UV), be: !!(flags & FLAG_BE), bs: !!(flags & FLAG_BS),
  };
  let p = 37;
  if (flags & FLAG_AT) {
    if (b.length < p + 18) refuse("format");
    out.aaguid = b.slice(p, p + 16);
    const len = (b[p + 16] << 8) | b[p + 17];
    p += 18;
    if (len < 16 || len > 1023 || p + len > b.length) refuse("format");
    out.credId = b.slice(p, p + len);
    p += len;
    const key = cborItem(b, p);
    if (!(key.value instanceof Map)) refuse("format");
    out.coseKey = b.slice(p, key.end);
    p = key.end;
  }
  if (flags & FLAG_ED) {
    const ext = cborItem(b, p);
    if (!(ext.value instanceof Map)) refuse("format");
    p = ext.end;
  }
  if (p !== b.length) refuse("format");
  return out;
}

/** The authenticator model (AAGUID) as a lower-case UUID, or null when it is all zeros (not said). */
export function aaguidText(a: Uint8Array | undefined): string | null {
  if (!a || a.length !== 16 || a.every((x) => x === 0)) return null;
  const h = [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ------------------------------------------------------------------ COSE public keys */

type KeyPlan = { alg: typeof ALG_ES256 | typeof ALG_RS256; jwk: JsonWebKey };

const asBytes = (v: Cbor | undefined): Bytes | null => (v instanceof Uint8Array ? (v as Bytes) : null);
const stripZeros = (b: Bytes): Bytes => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; return b.slice(i); };

/** A COSE_Key (RFC 9053) this site takes, as a JWK: EC2 P-256 with ES256, or RSA 2048-4096 bits, exponent 65537,
 *  with RS256. Anything else is "alg". */
export function coseKeyPlan(cose: Bytes): KeyPlan {
  const m = cborWhole(cose);
  if (!(m instanceof Map)) return refuse("format");
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2 && alg === ALG_ES256) {
    const x = asBytes(m.get(-2)), y = asBytes(m.get(-3));
    if (m.get(-1) !== 1 || !x || !y || x.length !== 32 || y.length !== 32) refuse("alg");
    return { alg: ALG_ES256, jwk: { kty: "EC", crv: "P-256", x: bytesToB64url(x!), y: bytesToB64url(y!), ext: true } };
  }
  if (kty === 3 && alg === ALG_RS256) {
    const n0 = asBytes(m.get(-1)), e0 = asBytes(m.get(-2));
    if (!n0 || !e0) return refuse("alg");
    const n = stripZeros(n0), e = stripZeros(e0);
    if (n.length < 256 || n.length > 512 || !sameBytes(e, new Uint8Array([1, 0, 1]))) refuse("alg");
    return { alg: ALG_RS256, jwk: { kty: "RSA", n: bytesToB64url(n), e: "AQAB", alg: "RS256", ext: true } };
  }
  return refuse("alg");
}

async function importPlan(plan: KeyPlan): Promise<CryptoKey> {
  try {
    return plan.alg === ALG_ES256
      ? await crypto.subtle.importKey("jwk", plan.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"])
      : await crypto.subtle.importKey("jwk", plan.jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  } catch { return refuse("key"); }
}

/** An ECDSA signature in DER (SEQUENCE of two INTEGERs, as authenticators send it) as the 64 raw bytes WebCrypto
 *  verifies (r then s, 32 bytes each). Lengths are checked against each other and the end; a negative integer, or one
 *  longer than the curve once its leading zeros are gone, is "signature". */
export function derToRaw(sig: Uint8Array, size = 32): Bytes {
  if (sig.length < 8 || sig.length > 2 + 2 * (size + 3) || sig[0] !== 0x30 || sig[1] !== sig.length - 2) refuse("signature");
  let p = 2;
  const int = (): Uint8Array => {
    if (sig[p] !== 0x02) refuse("signature");
    const len = sig[p + 1];
    if (len < 1 || len > size + 1 || p + 2 + len > sig.length) refuse("signature");
    const v = sig.subarray(p + 2, p + 2 + len);
    if (v[0] & 0x80) refuse("signature"); // negative
    p += 2 + len;
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    const t = v.subarray(i);
    if (t.length > size) refuse("signature");
    return t;
  };
  const r = int(), s = int();
  if (p !== sig.length) refuse("signature");
  const out = new Uint8Array(size * 2);
  out.set(r, size - r.length);
  out.set(s, size * 2 - s.length);
  return out;
}

/** Whether `signature` over `data` verifies with the COSE public key (ES256 signatures in DER, RS256 as they are). */
export async function verifySignature(cose: Bytes, signature: Bytes, data: Bytes): Promise<boolean> {
  try {
    const plan = coseKeyPlan(cose);
    const key = await importPlan(plan);
    return plan.alg === ALG_ES256
      ? await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, derToRaw(signature), data)
      : await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, signature, data);
  } catch { return false; }
}

/* ------------------------------------------------------------------ the two ceremonies */

const TRANSPORTS = ["usb", "nfc", "ble", "internal", "hybrid", "smart-card"] as const;

/** What a browser's navigator.credentials.create() sends back, as the page writes it (base64url fields). */
export type RegistrationInput = { id: string; rawId: string; type: string; response: { clientDataJSON: string; attestationObject: string; transports?: unknown } };
/** What navigator.credentials.get() sends back. */
export type AssertionInput = { id: string; rawId: string; type: string; response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string | null } };

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

/** A registration response in the shape a browser sends, or null. Sizes are capped before anything is decoded. */
export function registrationInput(b: unknown): RegistrationInput | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>, r = (o.response ?? {}) as Record<string, unknown>;
  const id = str(o.id, 1400), rawId = str(o.rawId, 1400), cd = str(r.clientDataJSON, 4096), ao = str(r.attestationObject, 12000);
  if (!id || !rawId || !cd || !ao || o.type !== "public-key") return null;
  return { id, rawId, type: "public-key", response: { clientDataJSON: cd, attestationObject: ao, transports: r.transports } };
}

/** An authentication response in the shape a browser sends, or null. */
export function assertionInput(b: unknown): AssertionInput | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>, r = (o.response ?? {}) as Record<string, unknown>;
  const id = str(o.id, 1400), rawId = str(o.rawId, 1400), cd = str(r.clientDataJSON, 4096), ad = str(r.authenticatorData, 4096), sig = str(r.signature, 1400);
  if (!id || !rawId || !cd || !ad || !sig || o.type !== "public-key") return null;
  const uh = r.userHandle === null || r.userHandle === undefined ? null : str(r.userHandle, 200);
  return { id, rawId, type: "public-key", response: { clientDataJSON: cd, authenticatorData: ad, signature: sig, userHandle: uh } };
}

/** The credential id a response names: rawId and id must agree, in base64url's one spelling. */
export function credentialIdOf(input: { id: string; rawId: string }): string | null {
  const raw = canonicalB64url(input.rawId);
  if (!raw || canonicalB64url(input.id) !== raw) return null;
  const n = b64urlToBytes(raw)!.length;
  return n >= 16 && n <= 1023 ? raw : null;
}

export type NewPasskey = {
  credId: string; publicKey: string; alg: number; signCount: number;
  backupEligible: boolean; backedUp: boolean; aaguid: string | null; transports: string[];
};

/** A new passkey checked (WebAuthn L3 7.1): this server's challenge, an allowed origin, this rp's hash, user present
 *  AND verified (Face ID, fingerprint or the device's PIN), backup flags that agree, an accepted key that imports, the
 *  credential id the browser names. Attestation is not judged (the site asks for "none"): every passkey is taken as
 *  unattested, whatever format comes back. */
export async function verifyRegistration(input: RegistrationInput, want: { challenge: string; rp: RpConfig }): Promise<Verdict<NewPasskey>> {
  try {
    const credId = credentialIdOf(input);
    if (!credId) return refuse("credential");
    const cd = b64urlToBytes(input.response.clientDataJSON), ao = b64urlToBytes(input.response.attestationObject);
    if (!cd || !ao) return refuse("format");
    checkClientData(cd, { type: "webauthn.create", challenge: want.challenge, origins: want.rp.origins });
    const att = cborWhole(ao);
    if (!(att instanceof Map)) return refuse("format");
    const fmt = att.get("fmt"), authData = att.get("authData"), stmt = att.get("attStmt");
    if (typeof fmt !== "string" || fmt.length > 32 || !(authData instanceof Uint8Array) || !(stmt instanceof Map)) return refuse("format");
    const a = parseAuthData(authData as Bytes);
    if (!sameBytes(a.rpIdHash, await sha256(utf8(want.rp.rpId)))) refuse("rp");
    if (!a.up) refuse("presence");
    if (!a.uv) refuse("verification");
    if (a.bs && !a.be) refuse("backup");
    if (!a.credId || !a.coseKey) return refuse("format");
    if (bytesToB64url(a.credId) !== credId) refuse("credential");
    const plan = coseKeyPlan(a.coseKey);
    await importPlan(plan);
    const tr = Array.isArray(input.response.transports) ? input.response.transports : [];
    const transports = [...new Set(tr.filter((t): t is string => typeof t === "string" && (TRANSPORTS as readonly string[]).includes(t)))];
    return {
      ok: true, credId, publicKey: bytesToB64url(a.coseKey), alg: plan.alg, signCount: a.signCount,
      backupEligible: a.be, backedUp: a.bs, aaguid: aaguidText(a.aaguid), transports,
    };
  } catch (e) {
    return { ok: false, why: e instanceof Refused ? e.why : "format" };
  }
}

/** The stored passkey an assertion is checked against (the database's passkey_take answer). */
export type StoredPasskey = { credId: string; publicKey: string; userHandle: string; backupEligible: boolean };

/** A sign-in checked (WebAuthn L3 7.2): the stored credential's id and user handle, this server's challenge, an
 *  allowed origin, this rp's hash, user present AND verified, backup eligibility unchanged, and the signature over
 *  authenticatorData + SHA-256(clientDataJSON) with the stored key. The counter is the database's to judge
 *  (passkey_sign_in, under a row lock); the answer hands it on. */
export async function verifyAssertion(input: AssertionInput, want: { challenge: string; rp: RpConfig; stored: StoredPasskey }): Promise<Verdict<{ signCount: number; backedUp: boolean; uv: boolean }>> {
  try {
    const credId = credentialIdOf(input);
    if (!credId || credId !== want.stored.credId) return refuse("credential");
    const uh = input.response.userHandle ? canonicalB64url(input.response.userHandle) : null;
    if (!uh || uh !== want.stored.userHandle) refuse("user");
    const cd = b64urlToBytes(input.response.clientDataJSON), ad = b64urlToBytes(input.response.authenticatorData), sig = b64urlToBytes(input.response.signature);
    const key = b64urlToBytes(want.stored.publicKey);
    if (!cd || !ad || !sig || !key) return refuse("format");
    checkClientData(cd, { type: "webauthn.get", challenge: want.challenge, origins: want.rp.origins });
    const a = parseAuthData(ad);
    if (a.flags & FLAG_AT) refuse("format"); // an assertion carries no new credential
    if (!sameBytes(a.rpIdHash, await sha256(utf8(want.rp.rpId)))) refuse("rp");
    if (!a.up) refuse("presence");
    if (!a.uv) refuse("verification");
    if ((a.bs && !a.be) || a.be !== want.stored.backupEligible) refuse("backup");
    const data = new Uint8Array(ad.length + 32);
    data.set(ad, 0);
    data.set(await sha256(cd), ad.length);
    if (!(await verifySignature(key, sig, data))) refuse("signature");
    return { ok: true, signCount: a.signCount, backedUp: a.bs, uv: a.uv };
  } catch (e) {
    return { ok: false, why: e instanceof Refused ? e.why : "format" };
  }
}
