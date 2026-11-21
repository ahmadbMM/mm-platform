import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import {
  aaguidText, assertionInput, b64urlToBytes, bytesToB64url, canonicalB64url, cborItem, cborWhole, clientChallenge, coseKeyPlan, derToRaw,
  parseAuthData, registrationInput, verifyAssertion, verifyRegistration, verifySignature, type AssertionInput, type Bytes, type RegistrationInput,
  type RpConfig,
} from "../sx-B7-webauthn";
import {
  PK_CHALLENGE_COOKIE, beginOf, creationOptions, passkeyItems, passkeyLabel, passkeyRp, passkeysOn, pkRefusal, requestOptions,
} from "../sx-B7-passkey";
import { passkeyPost, signedOf, takenOf } from "../sx-B7-passkey-server";
import { resetSiteContent } from "../site";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";
import SignIn from "@/components/account/SignIn";
import { PasskeyCard, PasskeyOffer } from "@/components/account/PasskeyParts";

// Passkeys (N06, builder B7, 2026-11-18). The WebAuthn checks against real browser-made responses (published test
// vectors of py_webauthn, BSD-3-Clause, made by Chrome on http://localhost:5000) and against responses this test makes
// itself with WebCrypto (an ES256 and an RS256 authenticator), the switch, the relying party per deployment, and the
// routes over a stand-in database that keeps the SQL's rules (SX/sql/B7.sql; the SQL itself is tested on a local
// Postgres): challenges made by the database, spent once, expired after five minutes.

const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));

const enc = (s: string) => new TextEncoder().encode(s) as Bytes;
const b64 = (s: string) => bytesToB64url(enc(s));

/* ------------------------------------------------------------------ a CBOR writer and an authenticator, for the test */

type W = number | string | boolean | null | Uint8Array | W[] | Map<number | string, W>;
function cbor(v: W): Bytes {
  const parts: number[] = [];
  const head = (major: number, n: number) => {
    if (n < 24) parts.push((major << 5) | n);
    else if (n < 256) parts.push((major << 5) | 24, n);
    else if (n < 65536) parts.push((major << 5) | 25, n >> 8, n & 255);
    else parts.push((major << 5) | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  };
  const walk = (x: W) => {
    if (typeof x === "number") { if (x >= 0) head(0, x); else head(1, -1 - x); }
    else if (typeof x === "string") { const b = enc(x); head(3, b.length); parts.push(...b); }
    else if (typeof x === "boolean") parts.push(x ? 0xf5 : 0xf4);
    else if (x === null) parts.push(0xf6);
    else if (x instanceof Uint8Array) { head(2, x.length); parts.push(...x); }
    else if (Array.isArray(x)) { head(4, x.length); x.forEach(walk); }
    else { head(5, x.size); for (const [k, val] of x) { walk(k); walk(val); } }
  };
  walk(v);
  return new Uint8Array(parts);
}
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o as Bytes; };
const sha = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", b as Bytes));
const UP = 0x01, UV = 0x04, BE = 0x08, BS = 0x10, AT = 0x40, ED = 0x80;

function rawToDer(raw: Uint8Array): Bytes {
  const int = (b: Uint8Array) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; let t = b.slice(i); if (t[0] & 0x80) t = cat(new Uint8Array([0]), t); return cat(new Uint8Array([2, t.length]), t); };
  const body = cat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return cat(new Uint8Array([0x30, body.length]), body);
}

type Authn = { alg: -7 | -257; keys: CryptoKeyPair; credId: Bytes; cose: Bytes; count: number };
async function authenticator(alg: -7 | -257 = -7, bits = 2048): Promise<Authn> {
  const credId = crypto.getRandomValues(new Uint8Array(32)) as Bytes;
  if (alg === -7) {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    const j = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const cose = cbor(new Map<number, W>([[1, 2], [3, -7], [-1, 1], [-2, b64urlToBytes(j.x)!], [-3, b64urlToBytes(j.y)!]]));
    return { alg, keys, credId, cose, count: 0 };
  }
  const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const j = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const cose = cbor(new Map<number, W>([[1, 3], [3, -257], [-1, b64urlToBytes(j.n)!], [-2, b64urlToBytes(j.e)!]]));
  return { alg, keys, credId, cose, count: 0 };
}

const RP: RpConfig = { rpId: "staging.micromobility.sa", origins: ["https://staging.micromobility.sa"] };
const CH = bytesToB64url(crypto.getRandomValues(new Uint8Array(32)));

type Make = { rpId?: string; origin?: string; challenge?: string; type?: string; flags?: number; count?: number; extra?: Record<string, unknown>; aaguid?: Uint8Array; tail?: Uint8Array; userHandle?: string | null };
async function authData(a: Authn, o: Make, attested: boolean): Promise<Bytes> {
  const c = o.count ?? a.count;
  const head = cat(await sha(enc(o.rpId ?? RP.rpId)), new Uint8Array([o.flags ?? 0, (c >>> 24) & 255, (c >> 16) & 255, (c >> 8) & 255, c & 255]));
  const att = attested ? cat(o.aaguid ?? new Uint8Array(16), new Uint8Array([a.credId.length >> 8, a.credId.length & 255]), a.credId, a.cose) : new Uint8Array(0);
  return cat(head, att, o.tail ?? new Uint8Array(0));
}
const clientData = (o: Make, type: string) =>
  enc(JSON.stringify({ type: o.type ?? type, challenge: o.challenge ?? CH, origin: o.origin ?? RP.origins[0], crossOrigin: false, ...o.extra }));

async function register(a: Authn, o: Make = {}): Promise<RegistrationInput> {
  const ad = await authData(a, { flags: UP | UV | AT | BE | BS, ...o }, true);
  const ao = cbor(new Map<string, W>([["fmt", "none"], ["attStmt", new Map()], ["authData", ad]]));
  const id = bytesToB64url(a.credId);
  return { id, rawId: id, type: "public-key", response: { clientDataJSON: bytesToB64url(clientData(o, "webauthn.create")), attestationObject: bytesToB64url(ao), transports: ["internal", "hybrid", "carrier-pigeon"] } };
}

async function sign(a: Authn, data: Bytes): Promise<Bytes> {
  if (a.alg === -7) return rawToDer(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, a.keys.privateKey, data)));
  return new Uint8Array(await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, a.keys.privateKey, data));
}

const HANDLE = bytesToB64url(crypto.getRandomValues(new Uint8Array(32)));
async function assertion(a: Authn, o: Make = {}): Promise<AssertionInput> {
  a.count += 1;
  const ad = await authData(a, { flags: UP | UV | BE | BS, ...o }, false);
  const cd = clientData(o, "webauthn.get");
  const sig = await sign(a, cat(ad, await sha(cd)));
  const id = bytesToB64url(a.credId);
  return { id, rawId: id, type: "public-key", response: { clientDataJSON: bytesToB64url(cd), authenticatorData: bytesToB64url(ad), signature: bytesToB64url(sig), userHandle: o.userHandle === undefined ? HANDLE : o.userHandle } };
}
const stored = (a: Authn, backupEligible = true) => ({ credId: bytesToB64url(a.credId), publicKey: bytesToB64url(a.cose), userHandle: HANDLE, backupEligible });

/* ------------------------------------------------------------------ base64url and CBOR */

describe("base64url", () => {
  it("decodes and encodes without padding, and refuses anything else", () => {
    expect(bytesToB64url(new Uint8Array([251, 255, 0]))).toBe("-_8A");
    expect([...b64urlToBytes("-_8A")!]).toEqual([251, 255, 0]);
    for (const bad of ["a", "ab=", "a+b/", "a b", 12, null]) expect(b64urlToBytes(bad)).toBeNull();
  });
  it("gives one spelling: stray low bits decode to the same bytes, and ids are kept in the proper form", () => {
    expect(canonicalB64url("AB")).toBe("AA");
    expect(canonicalB64url("AA")).toBe("AA");
  });
});

describe("CBOR", () => {
  it("reads maps, arrays, byte and text strings, integers and the simple values", () => {
    const v = cborWhole(cbor(new Map<number | string, W>([[1, 2], [-1, -300], ["s", "نص"], ["b", new Uint8Array([1, 2])], ["a", [true, false, null, 70000]]])));
    expect(v).toBeInstanceOf(Map);
    const m = v as Map<number | string, unknown>;
    expect(m.get(1)).toBe(2); expect(m.get(-1)).toBe(-300); expect(m.get("s")).toBe("نص");
    expect([...(m.get("b") as Uint8Array)]).toEqual([1, 2]); expect(m.get("a")).toEqual([true, false, null, 70000]);
  });
  it("refuses indefinite lengths, tags, floats, duplicate keys, short buffers and anything after the item", () => {
    for (const bad of [[0x9f, 0x01, 0xff], [0xc0, 0x01], [0xf9, 0, 0], [0xa2, 0x01, 0x01, 0x01, 0x02], [0x43, 1, 2], [0x01, 0x02]]) {
      expect(() => cborWhole(new Uint8Array(bad))).toThrow();
    }
    expect(cborItem(new Uint8Array([0x01, 0x02])).end).toBe(1);
  });
  it("refuses nesting deeper than 16", () => {
    expect(() => cborWhole(new Uint8Array([...Array(20).fill(0x81), 0x01]))).toThrow();
  });
});

describe("ECDSA signatures in DER", () => {
  it("become r then s, 32 bytes each, leading zeros and padding handled", () => {
    const raw = derToRaw(b64urlToBytes("MEUCIGisVZOBapCWbnJJvjelIzwpixxIwkjCCb5aCHafQu68AiEA88v-2pJNNApPFwAKFiNuf82-2hBxYW5kGwVweeoxCwo")!);
    expect(raw.length).toBe(64);
    expect(raw[32]).toBe(0xf3); // s had a 0x00 in front of its high bit
    const short = derToRaw(new Uint8Array([0x30, 6, 2, 1, 5, 2, 1, 7]));
    expect(short[31]).toBe(5); expect(short[63]).toBe(7);
  });
  it("refuses a wrong outer length, a negative integer, one too long, and bytes after the second integer", () => {
    expect(() => derToRaw(new Uint8Array([0x30, 7, 2, 1, 5, 2, 1, 7]))).toThrow();
    expect(() => derToRaw(new Uint8Array([0x30, 6, 2, 1, 0x85, 2, 1, 7]))).toThrow();
    expect(() => derToRaw(cat(new Uint8Array([0x30, 40, 2, 34]), new Uint8Array(34).fill(1), new Uint8Array([2, 2, 1, 1])))).toThrow();
    expect(() => derToRaw(new Uint8Array([0x30, 8, 2, 1, 5, 2, 1, 7, 0, 0]))).toThrow();
  });
});

/* ------------------------------------------------------------------ real browser-made responses */

const LOCAL: RpConfig = { rpId: "localhost", origins: ["http://localhost:5000"] };

// py_webauthn tests/test_verify_registration_response.py, test_verifies_none_attestation_response (ES256, UV set)
const REAL_REG: RegistrationInput = {
  id: "9y1xA8Tmg1FEmT-c7_fvWZ_uoTuoih3OvR45_oAK-cwHWhAbXrl2q62iLVTjiyEZ7O7n-CROOY494k7Q3xrs_w",
  rawId: "9y1xA8Tmg1FEmT-c7_fvWZ_uoTuoih3OvR45_oAK-cwHWhAbXrl2q62iLVTjiyEZ7O7n-CROOY494k7Q3xrs_w",
  type: "public-key",
  response: {
    attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVjESZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAFwAAAAAAAAAAAAAAAAAAAAAAQPctcQPE5oNRRJk_nO_371mf7qE7qIodzr0eOf6ACvnMB1oQG165dqutoi1U44shGezu5_gkTjmOPeJO0N8a7P-lAQIDJiABIVggSFbUJF-42Ug3pdM8rDRFu_N5oiVEysPDB6n66r_7dZAiWCDUVnB39FlGypL-qAoIO9xWHtJygo2jfDmHl-_eKFRLDA",
    clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiVHdON240V1R5R0tMYzRaWS1xR3NGcUtuSE00bmdscXN5VjBJQ0psTjJUTzlYaVJ5RnRya2FEd1V2c3FsLWdrTEpYUDZmbkYxTWxyWjUzTW00UjdDdnciLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUwMDAiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
    transports: ["nfc", "usb"],
  },
};
const REAL_REG_CH = "TwN7n4WTyGKLc4ZY-qGsFqKnHM4nglqsyV0ICJlN2TO9XiRyFtrkaDwUvsql-gkLJXP6fnF1MlrZ53Mm4R7Cvw";

// py_webauthn tests/test_verify_authentication_response.py, test_verify_authentication_response_with_RSA_public_key (UV set)
const REAL_RSA: AssertionInput = {
  id: "ZoIKP1JQvKdrYj1bTUPJ2eTUsbLeFkv-X5xJQNr4k6s", rawId: "ZoIKP1JQvKdrYj1bTUPJ2eTUsbLeFkv-X5xJQNr4k6s", type: "public-key",
  response: {
    authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAQ",
    clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiaVBtQWkxUHAxWEw2b0FncTNQV1p0WlBuWmExekZVRG9HYmFRMF9LdlZHMWxGMnMzUnRfM280dVN6Y2N5MHRtY1RJcFRUVDRCVTFULUk0bWFhdm5kalEiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUwMDAiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
    signature: "iOHKX3erU5_OYP_r_9HLZ-CexCE4bQRrxM8WmuoKTDdhAnZSeTP0sjECjvjfeS8MJzN1ArmvV0H0C3yy_FdRFfcpUPZzdZ7bBcmPh1XPdxRwY747OrIzcTLTFQUPdn1U-izCZtP_78VGw9pCpdMsv4CUzZdJbEcRtQuRS03qUjqDaovoJhOqEBmxJn9Wu8tBi_Qx7A33RbYjlfyLm_EDqimzDZhyietyop6XUcpKarKqVH0M6mMrM5zTjp8xf3W7odFCadXEJg-ERZqFM0-9Uup6kJNLbr6C5J4NDYmSm3HCSA6lp2iEiMPKU8Ii7QZ61kybXLxsX4w4Dm3fOLjmDw",
    userHandle: "T1RWa1l6VXdPRFV0WW1NNVlTMDBOVEkxTFRnd056Z3RabVZpWVdZNFpEVm1ZMk5p",
  },
};
const REAL_RSA_CH = "iPmAi1Pp1XL6oAgq3PWZtZPnZa1zFUDoGbaQ0_KvVG1lF2s3Rt_3o4uSzccy0tmcTIpTTT4BU1T-I4maavndjQ";
const REAL_RSA_KEY = "pAEDAzkBACBZAQDfV20epzvQP-HtcdDpX-cGzdOxy73WQEvsU7Dnr9UWJophEfpngouvgnRLXaEUn_d8HGkp_HIx8rrpkx4BVs6X_B6ZjhLlezjIdJbLbVeb92BaEsmNn1HW2N9Xj2QM8cH-yx28_vCjf82ahQ9gyAr552Bn96G22n8jqFRQKdVpO-f-bvpvaP3IQ9F5LCX7CUaxptgbog1SFO6FI6ob5SlVVB00lVXsaYg8cIDZxCkkENkGiFPgwEaZ7995SCbiyCpUJbMqToLMgojPkAhWeyktu7TlK6UBWdJMHc3FPAIs0lH_2_2hKS-mGI1uZAFVAfW1X-mzKL0czUm2P1UlUox7IUMBAAE";

// test_raises_exception_on_uv_required_but_false (ES256, user present only)
const REAL_NO_UV: AssertionInput = {
  id: "4-5MZF69j3n2B6Z99dUN0fNrAQmrjELJIebWVw8aKfw1EQKg28Tx40R_kw-1pcrfSgJFKm3mCtAtBgSRWgDMng", rawId: "4-5MZF69j3n2B6Z99dUN0fNrAQmrjELJIebWVw8aKfw1EQKg28Tx40R_kw-1pcrfSgJFKm3mCtAtBgSRWgDMng", type: "public-key",
  response: {
    authenticatorData: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MBAAAAIQ",
    clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoidW1HZW1YSklQQlhQeGtEOEhqYW51djlCRG9yOFo3TzNhUGR0T2dNQ2RXNFBBZnFEWDQzRUZsaHJzRjBQVzkwZGY1enJnYnQ3WVZNUkFhMjd0Q2RIenciLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUwMDAiLCJjcm9zc09yaWdpbiI6ZmFsc2V9",
    signature: "MEUCIGp5ADnU_SFvT4J_bKvQJ4Pc1GmANhbYq5GioOLjyUrxAiEA6Kk5qAZb8MLY-jyTiJLr_R9Fke02UHkxsRB0dnZt2X8",
    userHandle: null,
  },
};
const REAL_NO_UV_CH = "umGemXJIPBXPxkD8Hjanuv9BDor8Z7O3aPdtOgMCdW4PAfqDX43EFlhrsF0PW90df5zrgbt7YVMRAa27tCdHzw";
const REAL_NO_UV_KEY = "pQECAyYgASFYIOQ5TKpXJR2cV76Wgfge9BkLkEhLxVjhFjM1jKHYOcqpIlggaiNy1blt3OU8Hsmg041HUYP7eajgL7fk3nSuTEjYCwU";

describe("real browser responses", () => {
  it("a new ES256 passkey (none attestation) is taken, with its key, counter and transports", async () => {
    const v = await verifyRegistration(REAL_REG, { challenge: REAL_REG_CH, rp: LOCAL });
    expect(v).toMatchObject({ ok: true, credId: REAL_REG.rawId, alg: -7, signCount: 23, backupEligible: false, backedUp: false, aaguid: null, transports: ["nfc", "usb"] });
    expect(v.ok && v.publicKey).toBe("pQECAyYgASFYIEhW1CRfuNlIN6XTPKw0RbvzeaIlRMrDwwep-uq_-3WQIlgg1FZwd_RZRsqS_qgKCDvcVh7ScoKNo3w5h5fv3ihUSww");
  });
  it("the same passkey is refused for another origin, another rp, another challenge, or as a sign-in", async () => {
    expect(await verifyRegistration(REAL_REG, { challenge: REAL_REG_CH, rp: { rpId: "localhost", origins: ["https://micromobility.sa"] } })).toEqual({ ok: false, why: "origin" });
    expect(await verifyRegistration(REAL_REG, { challenge: REAL_REG_CH, rp: { rpId: "micromobility.sa", origins: LOCAL.origins } })).toEqual({ ok: false, why: "rp" });
    expect(await verifyRegistration(REAL_REG, { challenge: CH, rp: LOCAL })).toEqual({ ok: false, why: "challenge" });
  });
  it("an RS256 sign-in (Windows Hello's kind) with user verification passes, counter 1", async () => {
    const v = await verifyAssertion(REAL_RSA, { challenge: REAL_RSA_CH, rp: LOCAL, stored: { credId: REAL_RSA.rawId, publicKey: REAL_RSA_KEY, userHandle: REAL_RSA.response.userHandle!, backupEligible: false } });
    expect(v).toEqual({ ok: true, signCount: 1, backedUp: false, uv: true });
  });
  it("the same sign-in with a byte of the signature changed, or another account's user handle, is refused", async () => {
    const sig = b64urlToBytes(REAL_RSA.response.signature)!; sig[10] ^= 1;
    const bad = { ...REAL_RSA, response: { ...REAL_RSA.response, signature: bytesToB64url(sig) } };
    const st = { credId: REAL_RSA.rawId, publicKey: REAL_RSA_KEY, userHandle: REAL_RSA.response.userHandle!, backupEligible: false };
    expect(await verifyAssertion(bad, { challenge: REAL_RSA_CH, rp: LOCAL, stored: st })).toEqual({ ok: false, why: "signature" });
    expect(await verifyAssertion(REAL_RSA, { challenge: REAL_RSA_CH, rp: LOCAL, stored: { ...st, userHandle: HANDLE } })).toEqual({ ok: false, why: "user" });
  });
  it("a real sign-in made with user presence only is refused: the site requires Face ID, a fingerprint or the PIN", async () => {
    const st = { credId: REAL_NO_UV.rawId, publicKey: REAL_NO_UV_KEY, userHandle: HANDLE, backupEligible: false };
    // its signature is good...
    const ad = b64urlToBytes(REAL_NO_UV.response.authenticatorData)!, cd = b64urlToBytes(REAL_NO_UV.response.clientDataJSON)!;
    expect(await verifySignature(b64urlToBytes(REAL_NO_UV_KEY)!, b64urlToBytes(REAL_NO_UV.response.signature)!, cat(ad, await sha(cd)))).toBe(true);
    expect(parseAuthData(ad)).toMatchObject({ up: true, uv: false, signCount: 33 });
    // ...but with no user handle (a discoverable sign-in must name one) it is refused, and with one, for verification
    expect(await verifyAssertion(REAL_NO_UV, { challenge: REAL_NO_UV_CH, rp: LOCAL, stored: st })).toEqual({ ok: false, why: "user" });
    const named = { ...REAL_NO_UV, response: { ...REAL_NO_UV.response, userHandle: HANDLE } };
    expect(await verifyAssertion(named, { challenge: REAL_NO_UV_CH, rp: LOCAL, stored: st })).toEqual({ ok: false, why: "verification" });
  });
});

/* ------------------------------------------------------------------ responses made here with WebCrypto */

describe("a passkey made here (ES256)", () => {
  it("registers and signs in; the counter is handed on for the database to judge", async () => {
    const a = await authenticator();
    const r = await verifyRegistration(await register(a), { challenge: CH, rp: RP });
    expect(r).toMatchObject({ ok: true, alg: -7, backupEligible: true, backedUp: true, transports: ["internal", "hybrid"] });
    expect(r.ok && r.publicKey).toBe(bytesToB64url(a.cose));
    expect(await verifyAssertion(await assertion(a), { challenge: CH, rp: RP, stored: stored(a) })).toEqual({ ok: true, signCount: 1, backedUp: true, uv: true });
  });
  it("names the authenticator model when it gives one", async () => {
    const a = await authenticator();
    const g = new Uint8Array([0xfb, 0xfc, 0x30, 0x07, 0x15, 0x4e, 0x4e, 0xcc, 0x8c, 0x0b, 0x6e, 0x02, 0x05, 0x57, 0xd7, 0xbd]);
    const r = await verifyRegistration(await register(a, { aaguid: g }), { challenge: CH, rp: RP });
    expect(r.ok && r.aaguid).toBe("fbfc3007-154e-4ecc-8c0b-6e020557d7bd");
    expect(aaguidText(new Uint8Array(16))).toBeNull();
  });
  it("registration refusals: type, challenge, origin, frame, rp, presence, verification, backup, id, trailing bytes", async () => {
    const a = await authenticator();
    const want = { challenge: CH, rp: RP };
    const why = async (o: Make, change?: (x: RegistrationInput) => RegistrationInput) => {
      const x = await register(a, o);
      const v = await verifyRegistration(change ? change(x) : x, want);
      return v.ok ? "ok" : v.why;
    };
    expect(await why({ type: "webauthn.get" })).toBe("type");
    expect(await why({ challenge: CH.slice(0, -1) + (CH.endsWith("A") ? "B" : "A") })).toBe("challenge");
    expect(await why({ origin: "https://micromobility.sa" })).toBe("origin");
    expect(await why({ origin: "https://staging.micromobility.sa.evil.example" })).toBe("origin");
    expect(await why({ extra: { crossOrigin: true } })).toBe("cross_origin");
    expect(await why({ extra: { topOrigin: "https://evil.example" } })).toBe("cross_origin");
    expect(await why({ rpId: "micromobility.sa" })).toBe("rp");
    expect(await why({ flags: UV | AT })).toBe("presence");
    expect(await why({ flags: UP | AT })).toBe("verification");
    expect(await why({ flags: UP | UV | AT | BS })).toBe("backup");
    expect(await why({ tail: new Uint8Array([0]) })).toBe("format");
    expect(await why({ flags: UP | UV | AT | ED, tail: cbor(new Map([["credProps", true]])) })).toBe("ok");
    expect(await why({}, (x) => ({ ...x, id: bytesToB64url(new Uint8Array(32)) }))).toBe("credential");
    expect(await why({}, (x) => ({ ...x, id: bytesToB64url(new Uint8Array(32)), rawId: bytesToB64url(new Uint8Array(32)) }))).toBe("credential");
  });
  it("key refusals: another curve or algorithm, and a point that is not on the curve", async () => {
    const a = await authenticator();
    const p384 = { ...a, cose: cbor(new Map<number, W>([[1, 2], [3, -35], [-1, 2], [-2, new Uint8Array(48)], [-3, new Uint8Array(48)]])) };
    expect(await verifyRegistration(await register(p384), { challenge: CH, rp: RP })).toEqual({ ok: false, why: "alg" });
    const ed = { ...a, cose: cbor(new Map<number, W>([[1, 1], [3, -8], [-1, 6], [-2, new Uint8Array(32)]])) };
    expect(await verifyRegistration(await register(ed), { challenge: CH, rp: RP })).toEqual({ ok: false, why: "alg" });
    const off = { ...a, cose: cbor(new Map<number, W>([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(32).fill(1)], [-3, new Uint8Array(32).fill(2)]])) };
    expect(await verifyRegistration(await register(off), { challenge: CH, rp: RP })).toEqual({ ok: false, why: "key" });
  });
  it("sign-in refusals: presence, verification, backup changed, a new credential inside, the wrong handle, another passkey's id, a changed counter", async () => {
    const a = await authenticator();
    const want = (s = stored(a)) => ({ challenge: CH, rp: RP, stored: s });
    const why = async (o: Make, s = stored(a)) => { const v = await verifyAssertion(await assertion(a, o), want(s)); return v.ok ? "ok" : v.why; };
    expect(await why({ flags: UV | BE })).toBe("presence");
    expect(await why({ flags: UP | BE })).toBe("verification");
    expect(await why({ flags: UP | UV })).toBe("backup"); // was eligible, now says not
    expect(await why({ flags: UP | UV | BE }, stored(a, false))).toBe("backup");
    expect(await why({ flags: UP | UV | AT | BE })).toBe("format");
    expect(await why({ userHandle: null })).toBe("user");
    expect(await why({ userHandle: bytesToB64url(new Uint8Array(32)) })).toBe("user");
    expect(await why({ type: "webauthn.create" })).toBe("type");
    expect(await why({ origin: "http://staging.micromobility.sa" })).toBe("origin");
    const other = await authenticator();
    expect(await why({}, { ...stored(a), credId: bytesToB64url(other.credId) })).toBe("credential");
    expect(await why({}, { ...stored(a), publicKey: bytesToB64url(other.cose) })).toBe("signature");
    // the counter rewritten after signing
    const x = await assertion(a);
    const ad = b64urlToBytes(x.response.authenticatorData)!; ad[36] ^= 0x10;
    const v = await verifyAssertion({ ...x, response: { ...x.response, authenticatorData: bytesToB64url(ad) } }, want());
    expect(v).toEqual({ ok: false, why: "signature" });
  });
});

describe("a passkey made here (RS256)", () => {
  it("2048 bits registers and signs in; 1024 bits is refused", async () => {
    const a = await authenticator(-257);
    expect(await verifyRegistration(await register(a), { challenge: CH, rp: RP })).toMatchObject({ ok: true, alg: -257 });
    expect(await verifyAssertion(await assertion(a), { challenge: CH, rp: RP, stored: stored(a) })).toMatchObject({ ok: true });
    const small = await authenticator(-257, 1024);
    expect(await verifyRegistration(await register(small), { challenge: CH, rp: RP })).toEqual({ ok: false, why: "alg" });
    expect(() => coseKeyPlan(small.cose)).toThrow();
  });
});

describe("what the browser sends, before anything is decoded", () => {
  it("takes the shapes a browser sends and caps their sizes", async () => {
    const a = await authenticator();
    expect(registrationInput(await register(a))).not.toBeNull();
    expect(assertionInput(await assertion(a))).not.toBeNull();
    expect(registrationInput({ id: "x", rawId: "x", type: "password", response: {} })).toBeNull();
    expect(assertionInput({ ...(await assertion(a)), response: { clientDataJSON: "a".repeat(5000), authenticatorData: "a", signature: "a" } })).toBeNull();
    expect(clientChallenge(b64(JSON.stringify({ challenge: "abc" })))).toBe("abc");
    expect(clientChallenge("%%%")).toBeNull();
  });
});

/* ------------------------------------------------------------------ the switch and the relying party */

describe("the switch", () => {
  it("is on only for an explicit {on: true}", () => {
    expect(passkeysOn({ "account.passkeys": { on: true } })).toBe(true);
    for (const v of [undefined, true, { on: "true" }, { on: 1 }, [true], { on: false }]) expect(passkeysOn({ "account.passkeys": v })).toBe(false);
    expect(passkeysOn(null)).toBe(false);
  });
});

describe("the relying party", () => {
  it("is micromobility.sa on production, staging.micromobility.sa on staging, localhost in development - each for its own host only", () => {
    expect(passkeyRp("https://micromobility.sa/api/account/passkey/signin", "production")).toEqual({ rpId: "micromobility.sa", origins: ["https://micromobility.sa"] });
    expect(passkeyRp("https://staging.micromobility.sa/api/x", "staging")).toEqual({ rpId: "staging.micromobility.sa", origins: ["https://staging.micromobility.sa"] });
    expect(passkeyRp("http://localhost:3347/api/x", "dev")).toEqual({ rpId: "localhost", origins: ["http://localhost:3347"] });
    expect(passkeyRp("https://staging.micromobility.sa/api/x", "production")).toBeNull();
    expect(passkeyRp("https://micromobility.sa/api/x", "staging")).toBeNull();
    expect(passkeyRp("https://www.micromobility.sa/api/x", "production")).toBeNull();
    expect(passkeyRp("http://micromobility.sa/api/x", "production")).toBeNull();
    expect(passkeyRp("https://micromobility-web.workers.dev/api/x", "production")).toBeNull();
    expect(passkeyRp("http://127.0.0.1:3347/api/x", "dev")).toBeNull();
  });
  it("asks the browser for user verification, a resident key, no attestation, ES256 then RS256, and excludes the account's passkeys", () => {
    const rp = { rpId: "micromobility.sa", origins: ["https://micromobility.sa"] };
    const c = creationOptions({ challenge: "c".repeat(43), user: { handle: "h".repeat(43), name: "sara@example.com", display: "Sara" }, exclude: ["e".repeat(22)] }, rp);
    expect(c).toMatchObject({ rp: { id: "micromobility.sa", name: "MicroMobility" }, user: { id: "h".repeat(43), name: "sara@example.com", displayName: "Sara" }, attestation: "none",
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" }, excludeCredentials: [{ type: "public-key", id: "e".repeat(22) }] });
    expect(c.pubKeyCredParams.map((p) => p.alg)).toEqual([-7, -257]);
    expect(requestOptions({ challenge: "c".repeat(43) }, rp)).toMatchObject({ rpId: "micromobility.sa", userVerification: "required", allowCredentials: [] });
  });
  it("reads only a well-made challenge and handle from the database", () => {
    expect(beginOf({ challenge: "c".repeat(43) }, false)).toEqual({ challenge: "c".repeat(43) });
    expect(beginOf({ challenge: "short" }, false)).toBeNull();
    expect(beginOf({ challenge: "c".repeat(43), user: { handle: "bad handle" } }, true)).toBeNull();
  });
});

describe("labels, the list and refusals", () => {
  it("a passkey is called by its password manager, else by the device it was added on", () => {
    expect(passkeyLabel("ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4", "")).toBe("google");
    expect(passkeyLabel(null, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)")).toBe("iphone");
    expect(passkeyLabel(null, "Mozilla/5.0 (Linux; Android 15; SM-S928B)")).toBe("android");
    expect(passkeyLabel(null, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows-pc");
    expect(passkeyLabel(null, "")).toBe("other");
  });
  it("the list carries no key or credential id, and an unknown label reads as other", () => {
    expect(passkeyItems({ items: [{ id: "6f9619ff-8b86-d011-b42d-00c04fc964ff", label: "zzz", created_at: "2026-11-18T10:00:00Z", last_used_at: null, backed_up: true, public_key: "x" }] }))
      .toEqual([{ id: "6f9619ff-8b86-d011-b42d-00c04fc964ff", label: "other", createdAt: "2026-11-18T10:00:00Z", lastUsedAt: null, synced: true }]);
  });
  it("the database's refusals become the page's words; a database without the functions reads as off", () => {
    expect(pkRefusal({ status: 404, code: "PGRST202", message: "Could not find the function" })).toEqual({ error: "off", status: 404 });
    expect(pkRefusal({ status: 400, code: "P0001", message: "PASSKEY_OFF" }).error).toBe("off");
    expect(pkRefusal({ status: 400, code: "P0001", message: "PASSKEY_CHALLENGE" }).error).toBe("expired");
    expect(pkRefusal({ status: 200, data: { ok: false, error: "PASSKEY_RETIRED" } }).error).toBe("unknown");
    expect(pkRefusal({ status: 200, data: { ok: false, error: "PASSKEY_COUNTER" } }).error).toBe("failed");
    expect(pkRefusal({ status: 400, code: "P0001", message: "RATE_LIMITED" }).error).toBe("slow");
    expect(pkRefusal({ status: 0 }).error).toBe("generic");
  });
  it("the database's answers are read strictly", () => {
    expect(takenOf({ ok: true, public_key: "AAAA", user_handle: "BBBB", backup_eligible: true }, "cid")).toEqual({ credId: "cid", publicKey: "AAAA", userHandle: "BBBB", backupEligible: true });
    expect(takenOf({ ok: false, error: "PASSKEY_UNKNOWN" }, "cid")).toBeNull();
    expect(signedOf({ ok: true, id: "c1", name: "Sara", session_token: "a".repeat(48) })).toEqual({ id: "c1", token: "a".repeat(48), name: "Sara" });
    expect(signedOf({ ok: true, id: "c1", session_token: "not a token!" })).toBeNull();
  });
});

/* ------------------------------------------------------------------ the routes, over a stand-in database */

const SITE = "https://staging.micromobility.sa";
const KEY = "k".repeat(40);
const TOKEN = "a".repeat(48);

type Ch = { purpose: string; rp: string; customer?: string; handle?: string; expires: number; taken?: number; cred?: string; done?: number };
type Cred = { customer: string; publicKey: string; handle: string; count: number; be: boolean };
function standIn() {
  const s = {
    now: Date.now(), on: true, must: false,
    challenges: new Map<string, Ch>(), creds: new Map<string, Cred>(), calls: [] as string[],
    customers: new Map([["c1", { name: "Sara Test", email: "sara@example.com", token: TOKEN }]]),
  };
  const err = (message: string) => new Response(JSON.stringify({ code: "P0001", message }), { status: 400 });
  const ok = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
  const items = (c: string) => ({ items: [...s.creds.entries()].filter(([, v]) => v.customer === c).map(([k]) => ({ id: "6f9619ff-8b86-d011-b42d-00c04fc964ff", label: "iphone", created_at: "2026-11-18T10:00:00Z", cred: k })) });
  const fns: Record<string, (a: Record<string, unknown>) => Response> = {
    passkey_begin: (a) => {
      if (a.p_purpose === "register" && s.customers.get(String(a.p_id))?.token !== a.p_token) return err("PASSKEY_SIGNIN");
      const ch = bytesToB64url(crypto.getRandomValues(new Uint8Array(32)));
      const reg = a.p_purpose === "register";
      s.challenges.set(ch, { purpose: String(a.p_purpose), rp: String(a.p_rp_id), customer: reg ? String(a.p_id) : undefined, handle: reg ? HANDLE : undefined, expires: s.now + 300_000 });
      return ok(reg ? { challenge: ch, user: { handle: HANDLE, name: "sara@example.com", display: "Sara Test" }, exclude: [] } : { challenge: ch });
    },
    passkey_take: (a) => {
      const ch = s.challenges.get(String(a.p_challenge));
      if (!ch || ch.purpose !== "signin" || ch.rp !== a.p_rp_id || ch.taken || ch.expires <= s.now) return err("PASSKEY_CHALLENGE");
      ch.taken = s.now; ch.cred = String(a.p_cred_id);
      const c = s.creds.get(String(a.p_cred_id));
      return ok(c ? { ok: true, public_key: c.publicKey, alg: -7, user_handle: c.handle, backup_eligible: c.be } : { ok: false, error: "PASSKEY_UNKNOWN" });
    },
    passkey_sign_in: (a) => {
      const ch = s.challenges.get(String(a.p_challenge));
      if (!ch || ch.cred !== a.p_cred_id || !ch.taken || ch.taken <= s.now - 120_000 || ch.done || a.p_user_verified !== true) return err("PASSKEY_CHALLENGE");
      ch.done = s.now;
      const c = s.creds.get(String(a.p_cred_id))!;
      const n = Number(a.p_sign_count);
      if ((n > 0 || c.count > 0) && n <= c.count) return ok({ ok: false, error: "PASSKEY_COUNTER" });
      c.count = n;
      const who = s.customers.get(c.customer)!;
      return ok({ ok: true, id: c.customer, name: who.name, email: who.email, session_token: who.token });
    },
    passkey_register: (a) => {
      if (s.customers.get(String(a.p_id))?.token !== a.p_token) return err("PASSKEY_SIGNIN");
      const ch = s.challenges.get(String(a.p_challenge));
      if (!ch || ch.purpose !== "register" || ch.customer !== a.p_id || ch.expires <= s.now) return err("PASSKEY_CHALLENGE");
      s.challenges.delete(String(a.p_challenge));
      if (s.creds.has(String(a.p_cred_id))) return ok({ ok: false, error: "PASSKEY_TAKEN" });
      s.creds.set(String(a.p_cred_id), { customer: String(a.p_id), publicKey: String(a.p_public_key), handle: ch.handle!, count: Number(a.p_sign_count), be: a.p_backup_eligible === true });
      return ok({ ok: true, id: "6f9619ff-8b86-d011-b42d-00c04fc964ff", ...items(String(a.p_id)) });
    },
    passkey_list: (a) => (s.customers.get(String(a.p_id))?.token === a.p_token ? ok({ ok: true, ...items(String(a.p_id)) }) : err("PASSKEY_SIGNIN")),
    customer_pwd_state: () => ok(s.must),
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/rest/v1/site_content")) return ok(s.on ? [{ key: "account.passkeys", value: { on: true } }] : [{ key: "account.passkeys", value: { on: false } }]);
    const fn = /\/rpc\/([a-z0-9_]+)/.exec(u)?.[1] ?? "";
    s.calls.push(fn);
    const a = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    if (fn.startsWith("passkey_") && a.p_key !== KEY) return new Response(JSON.stringify({ code: "42501", message: "NOT_AUTHORIZED" }), { status: 401 });
    return fns[fn] ? fns[fn](a) : new Response(JSON.stringify({ code: "PGRST202", message: "no function" }), { status: 404 });
  }));
  return s;
}

/** A browser on the staging site: it keeps the cookies the routes set. */
function browser() {
  const jarB = new Map<string, string>();
  return {
    jar: jarB,
    async post(action: string, body: unknown = {}, origin = SITE) {
      const cookie = [...jarB].map(([k, v]) => `${k}=${v}`).join("; ");
      const res = await passkeyPost(new Request(`${SITE}/api/account/passkey/${action}`, { method: "POST", headers: { origin, cookie, "content-type": "application/json" }, body: JSON.stringify(body) }), action);
      for (const c of res.headers.getSetCookie()) {
        const [pair, ...rest] = c.split(";");
        const [k, v] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
        if (/Max-Age=0/.test(rest.join(";"))) jarB.delete(k); else jarB.set(k, v);
      }
      return { status: res.status, body: (await res.json()) as Record<string, unknown> & { options?: { challenge: string } } };
    },
  };
}

beforeEach(() => {
  resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("PAY_SERVER_KEY", KEY);
  vi.stubEnv("MM_ENV", "staging");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { jar.account = ""; vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Signs `b` in with a new passkey made by `a` for c1, through the routes. */
async function addFor(b: ReturnType<typeof browser>, a: Authn) {
  b.jar.set("mm_acct", `c1~${TOKEN}`);
  const start = await b.post("add-start");
  expect(start.status).toBe(200);
  const done = await b.post("add", await register(a, { challenge: start.body.options!.challenge }));
  b.jar.delete("mm_acct");
  return done;
}

describe("the routes", () => {
  it("refuse everything while the switch is off, without asking the database", async () => {
    const s = standIn(); s.on = false;
    const b = browser(); b.jar.set("mm_acct", `c1~${TOKEN}`);
    for (const action of ["signin-start", "signin", "add-start", "add", "list", "remove"]) {
      expect(await b.post(action)).toEqual({ status: 404, body: { ok: false, error: "off" } });
    }
    expect(s.calls).toEqual([]);
  });
  it("refuse without the server key, under another host, or from another site's page", async () => {
    const s = standIn();
    vi.stubEnv("PAY_SERVER_KEY", "");
    expect((await browser().post("signin-start")).body.error).toBe("off");
    vi.stubEnv("PAY_SERVER_KEY", KEY);
    vi.stubEnv("MM_ENV", "");
    expect((await browser().post("signin-start")).body.error).toBe("off"); // a production Worker does not answer for staging's host
    vi.stubEnv("MM_ENV", "staging");
    expect(await browser().post("signin-start", {}, "https://evil.example")).toEqual({ status: 403, body: { ok: false, error: "origin" } });
    expect(s.calls).toEqual([]);
  });
  it("add a passkey for the signed-in account, then sign in with it: the database's session in the account cookie", async () => {
    const s = standIn(); const a = await authenticator(); const b = browser();
    const added = await addFor(b, a);
    expect(added.status).toBe(200);
    expect(s.creds.get(bytesToB64url(a.credId))).toMatchObject({ customer: "c1", publicKey: bytesToB64url(a.cose), handle: HANDLE });
    const start = await b.post("signin-start");
    expect(start.body.options).toMatchObject({ rpId: "staging.micromobility.sa", userVerification: "required" });
    expect(b.jar.get(PK_CHALLENGE_COOKIE)).toBe(start.body.options!.challenge);
    const done = await b.post("signin", await assertion(a, { challenge: start.body.options!.challenge }));
    expect(done).toEqual({ status: 200, body: { ok: true, name: "Sara Test" } });
    expect(b.jar.get("mm_acct")).toBe(`c1~${TOKEN}`);
    expect(b.jar.has(PK_CHALLENGE_COOKIE)).toBe(false);
  });
  it("a sign-in answer replayed - even with its challenge cookie kept - is refused: the challenge was used", async () => {
    standIn(); const a = await authenticator(); const b = browser();
    await addFor(b, a);
    const start = await b.post("signin-start");
    const ch = start.body.options!.challenge;
    const answer = await assertion(a, { challenge: ch });
    expect((await b.post("signin", answer)).status).toBe(200);
    b.jar.set(PK_CHALLENGE_COOKIE, ch);
    expect(await b.post("signin", answer)).toEqual({ status: 400, body: { ok: false, error: "expired" } });
  });
  it("a challenge older than five minutes is refused", async () => {
    const s = standIn(); const a = await authenticator(); const b = browser();
    await addFor(b, a);
    const start = await b.post("signin-start");
    s.now += 301_000;
    expect((await b.post("signin", await assertion(a, { challenge: start.body.options!.challenge }))).body.error).toBe("expired");
  });
  it("an answer for a challenge this browser was not handed is refused before the database is asked", async () => {
    const s = standIn(); const a = await authenticator(); const b = browser();
    await addFor(b, a);
    await b.post("signin-start");
    const before = s.calls.length;
    expect((await b.post("signin", await assertion(a, { challenge: CH }))).body.error).toBe("expired");
    expect(s.calls.length).toBe(before);
  });
  it("a bad signature is refused and spends the challenge: a good answer to it afterwards is refused too", async () => {
    standIn(); const a = await authenticator(); const b = browser();
    await addFor(b, a);
    const start = await b.post("signin-start");
    const ch = start.body.options!.challenge;
    const bad = await assertion(a, { challenge: ch });
    const sig = b64urlToBytes(bad.response.signature)!; sig[sig.length - 1] ^= 1;
    expect(await b.post("signin", { ...bad, response: { ...bad.response, signature: bytesToB64url(sig) } })).toEqual({ status: 401, body: { ok: false, error: "failed" } });
    b.jar.set(PK_CHALLENGE_COOKIE, ch);
    expect((await b.post("signin", await assertion(a, { challenge: ch }))).body.error).toBe("expired");
  });
  it("a passkey the site does not keep is said so, and a counter that went back is refused", async () => {
    const s = standIn(); const a = await authenticator(); const b = browser();
    const stranger = await authenticator();
    let start = await b.post("signin-start");
    expect((await b.post("signin", await assertion(stranger, { challenge: start.body.options!.challenge }))).body.error).toBe("unknown");
    await addFor(b, a);
    a.count = 5;
    start = await b.post("signin-start");
    expect((await b.post("signin", await assertion(a, { challenge: start.body.options!.challenge }))).status).toBe(200);
    a.count = 2;
    start = await b.post("signin-start");
    expect((await b.post("signin", await assertion(a, { challenge: start.body.options!.challenge }))).body.error).toBe("failed");
    expect(s.creds.get(bytesToB64url(a.credId))!.count).toBe(6);
  });
  it("an account whose password staff set must choose its own first, as with the password: held, not signed in", async () => {
    const s = standIn(); const a = await authenticator(); const b = browser();
    await addFor(b, a);
    s.must = true;
    const start = await b.post("signin-start");
    expect((await b.post("signin", await assertion(a, { challenge: start.body.options!.challenge }))).body.error).toBe("must_change");
    expect(b.jar.has("mm_acct")).toBe(false);
    expect(b.jar.get("mm_pwd")).toBe(`c1~${TOKEN}`);
  });
  it("adding needs the account's session, and a new passkey is checked before the database keeps it", async () => {
    const s = standIn(); const a = await authenticator(); const b = browser();
    expect((await b.post("add-start")).body.error).toBe("signin");
    b.jar.set("mm_acct", `c1~${"b".repeat(48)}`);
    expect((await b.post("add-start")).body.error).toBe("signin");
    b.jar.set("mm_acct", `c1~${TOKEN}`);
    const start = await b.post("add-start");
    expect(start.body.options).toMatchObject({ user: { id: HANDLE, name: "sara@example.com" }, attestation: "none" });
    expect((await b.post("add", await register(a, { challenge: start.body.options!.challenge, flags: UP | AT }))).body.error).toBe("failed");
    expect(s.creds.size).toBe(0);
    expect((await b.post("list")).body).toEqual({ ok: true, items: [] });
  });
});

/* ------------------------------------------------------------------ the pages */

function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}

describe("the account page", () => {
  // staging: since main's account menu (2026-11-19) the passkeys card is on its Password page, /account/password
  const draw = async (on: boolean, signedIn: boolean, part?: string[]) => {
    jar.account = signedIn ? `c1~${TOKEN}` : "";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/rest/v1/site_content")) return new Response(JSON.stringify([{ key: "account.passkeys", value: { on } }]), { status: 200 });
      if (u.endsWith("/rpc/customer_profile")) return new Response(JSON.stringify([{ name: "Sara Test", email: "sara@example.com", phone: "+966500000001" }]), { status: 200 });
      return new Response("[]", { status: 200 });
    }));
    return AccountPage({ params: Promise.resolve({ locale: "en", part }), searchParams: Promise.resolve({}) });
  };
  it("signed out: the sign-in form offers a passkey only while the switch is on", async () => {
    expect(findAll(await draw(true, false), SignIn)[0].props).toMatchObject({ passkeys: true });
    resetSiteContent();
    expect(findAll(await draw(false, false), SignIn)[0].props).toMatchObject({ passkeys: false });
  });
  it("signed in: the passkeys card and the offer only while the switch is on", async () => {
    const on = await draw(true, true, ["password"]);
    expect(findAll(on, PasskeyCard)).toHaveLength(1);
    expect(findAll(on, PasskeyOffer)).toHaveLength(1);
    resetSiteContent();
    const off = await draw(false, true, ["password"]);
    expect(findAll(off, PasskeyCard)).toHaveLength(0);
    expect(findAll(off, PasskeyOffer)).toHaveLength(0);
  });
});
