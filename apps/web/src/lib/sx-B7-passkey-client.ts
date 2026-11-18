import { b64urlToBytes, bytesToB64url } from "./sx-B7-webauthn";

// Passkeys in the browser (N06, B7): the options this site's server sends (JSON, binary fields in base64url) turned
// into what navigator.credentials wants, and the answer turned back into JSON for the server. Browser-safe and pure
// apart from the two feature checks. PublicKeyCredential.parseCreationOptionsFromJSON and toJSON() would do the same,
// but not every browser riders use has them yet.

type Json = Record<string, unknown>;

const buf = (s: unknown): ArrayBuffer => {
  const b = b64urlToBytes(s);
  if (!b) throw new TypeError("not base64url");
  return b.buffer;
};
const b64 = (v: ArrayBuffer | ArrayBufferView | null | undefined): string | null => {
  if (!v) return null;
  const u = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  return bytesToB64url(u);
};

/** The server's creation options for navigator.credentials.create({publicKey}). */
export function toCreateOptions(o: Json): PublicKeyCredentialCreationOptions {
  const user = o.user as Json, rp = o.rp as Json;
  const sel = (o.authenticatorSelection ?? {}) as AuthenticatorSelectionCriteria;
  return {
    challenge: buf(o.challenge),
    rp: { id: String(rp.id), name: String(rp.name) },
    user: { id: buf(user.id), name: String(user.name), displayName: String(user.displayName) },
    pubKeyCredParams: (o.pubKeyCredParams as PublicKeyCredentialParameters[]).map((p) => ({ type: "public-key", alg: Number(p.alg) })),
    timeout: Number(o.timeout) || undefined,
    attestation: "none",
    authenticatorSelection: { residentKey: sel.residentKey, requireResidentKey: sel.requireResidentKey, userVerification: sel.userVerification },
    excludeCredentials: ((o.excludeCredentials ?? []) as Json[]).map((c) => ({ type: "public-key", id: buf(c.id) })),
  };
}

/** The server's request options for navigator.credentials.get({publicKey}). */
export function toGetOptions(o: Json): PublicKeyCredentialRequestOptions {
  return {
    challenge: buf(o.challenge),
    rpId: String(o.rpId),
    timeout: Number(o.timeout) || undefined,
    userVerification: "required",
    allowCredentials: ((o.allowCredentials ?? []) as Json[]).map((c) => ({ type: "public-key", id: buf(c.id) })),
  };
}

type Cred = { id: string; rawId: ArrayBuffer; type: string; response: AuthenticatorResponse };

/** A new passkey (create's answer) as the JSON the server reads (lib/sx-B7-webauthn.ts registrationInput). */
export function registrationJson(c: Cred) {
  const r = c.response as AuthenticatorAttestationResponse;
  let transports: string[] = [];
  try { transports = typeof r.getTransports === "function" ? r.getTransports() : []; } catch { /* older browsers */ }
  return { id: c.id, rawId: b64(c.rawId), type: c.type, response: { clientDataJSON: b64(r.clientDataJSON), attestationObject: b64(r.attestationObject), transports } };
}

/** A sign-in (get's answer) as the JSON the server reads (assertionInput). */
export function assertionJson(c: Cred) {
  const r = c.response as AuthenticatorAssertionResponse;
  return { id: c.id, rawId: b64(c.rawId), type: c.type, response: { clientDataJSON: b64(r.clientDataJSON), authenticatorData: b64(r.authenticatorData), signature: b64(r.signature), userHandle: b64(r.userHandle) } };
}

/** Whether this browser can use passkeys at all. */
export function passkeysSupported(): boolean {
  try { return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && !!navigator.credentials; } catch { return false; }
}

/** Whether this device has its own Face ID / fingerprint / PIN authenticator (the offer after a password sign-in asks
 *  only where it does). */
export async function deviceCanMakePasskeys(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

/** A failed navigator.credentials call: the rider closed the prompt or it timed out (said nothing), this device already
 *  holds a passkey for the account (create's InvalidStateError), or anything else. */
export function ceremonyFailure(e: unknown): "cancel" | "exists" | "other" {
  const name = e && typeof e === "object" ? String((e as { name?: unknown }).name ?? "") : "";
  if (name === "NotAllowedError" || name === "AbortError") return "cancel";
  if (name === "InvalidStateError") return "exists";
  return "other";
}
