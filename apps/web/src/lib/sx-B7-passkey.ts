import type { RpConfig } from "./sx-B7-webauthn";

// Passkeys on micromobility.sa (N06, builder B7, 2026-11-18; the user: "do all"): the plain rules, kept apart from the
// routes so they can be tested. A passkey is a sign-in key kept in the rider's own password manager (iCloud Keychain,
// Google Password Manager, Windows Hello...) and unlocked with Face ID, a fingerprint or the device's PIN; the site
// keeps only its public key. It is not "Sign in with Apple or Google" (owner rule R6): no account of theirs is used,
// and the sign-in ends with the booking app's own session, issued by the database (passkey_sign_in), as a password
// sign-in does.
//
// ONE switch, site_content 'account.passkeys' = {"on": true}; anything else is off, and then nothing about passkeys
// shows and every route answers "off" (the database refuses too: PASSKEY_OFF).

export const PK_SWITCH_KEY = "account.passkeys";

const txt = (v: unknown): string => (typeof v === "string" ? v : "");

/** Whether staff switched passkeys on: an explicit {"on": true}. */
export function passkeysOn(content: Record<string, unknown> | null | undefined): boolean {
  const v = content?.[PK_SWITCH_KEY];
  return !!v && typeof v === "object" && !Array.isArray(v) && (v as { on?: unknown }).on === true;
}

/** The browser's challenge cookie: the challenge this server handed out for the ceremony under way, five minutes,
 *  sent to the passkey routes only. The database keeps the challenge too and lets it be used once. */
export const PK_CHALLENGE_COOKIE = "mm_pkc";
export const PK_CHALLENGE_PATH = "/api/account/passkey";
export const PK_CHALLENGE_TTL_S = 300;
/** How long the browser's passkey prompt may stay open. */
export const PK_TIMEOUT_MS = 120_000;
/** A challenge as the database makes it: 32 random bytes, base64url. */
export const PK_CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;

export const challengeCookie = (value: string, maxAge = PK_CHALLENGE_TTL_S) =>
  `${PK_CHALLENGE_COOKIE}=${value}; Path=${PK_CHALLENGE_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

/* ------------------------------------------------------------------ the relying party */

export type PkEnv = "production" | "staging" | "dev";

/** Where passkeys live (decided 2026-11-18, B7):
 *  - production: rp id micromobility.sa, so the same passkey can later sign in on experiences.micromobility.sa (the
 *    booking app) too; only the page origin https://micromobility.sa is accepted here.
 *  - staging: rp id staging.micromobility.sa, so a staging passkey never sits beside the real one in a rider's
 *    password manager, is never offered on micromobility.sa, and staging can never ask for a production passkey at all.
 *  - dev (next dev): localhost only (WebAuthn takes http://localhost as a secure page).
 *  Each Worker answers only for its own host: a request that reached it under another one gets no passkeys. */
export const PK_RPS: Record<Exclude<PkEnv, "dev">, RpConfig & { host: string }> = {
  production: { host: "micromobility.sa", rpId: "micromobility.sa", origins: ["https://micromobility.sa"] },
  staging: { host: "staging.micromobility.sa", rpId: "staging.micromobility.sa", origins: ["https://staging.micromobility.sa"] },
};

export function passkeyRp(requestUrl: string, env: PkEnv): RpConfig | null {
  let u: URL;
  try { u = new URL(requestUrl); } catch { return null; }
  if (env === "dev") return u.hostname === "localhost" ? { rpId: "localhost", origins: [u.origin] } : null;
  const rp = PK_RPS[env];
  return u.protocol === "https:" && u.host === rp.host ? { rpId: rp.rpId, origins: rp.origins } : null;
}

/* ------------------------------------------------------------------ what the browser is asked */

/** The database's passkey_begin answer for a sign-in or for adding a passkey. */
export type BeginAnswer = { challenge: string; user?: { handle: string; name: string; display: string }; exclude?: string[] };

/** PublicKeyCredentialRequestOptions (JSON: binary fields base64url): any passkey of this rp on the device (no list,
 *  so the device offers its own), Face ID / fingerprint / PIN required. */
export function requestOptions(b: BeginAnswer, rp: RpConfig) {
  return { challenge: b.challenge, rpId: rp.rpId, timeout: PK_TIMEOUT_MS, userVerification: "required" as const, allowCredentials: [] as { type: "public-key"; id: string }[] };
}

/** PublicKeyCredentialCreationOptions (JSON): a passkey kept on the device or in its password manager (resident),
 *  user verification required, no attestation, ES256 or RS256, never a second one where the account already has one. */
export function creationOptions(b: BeginAnswer, rp: RpConfig) {
  const u = b.user ?? { handle: "", name: "", display: "" };
  return {
    challenge: b.challenge,
    rp: { id: rp.rpId, name: "MicroMobility" },
    user: { id: u.handle, name: u.name || u.display || "MicroMobility", displayName: u.display || u.name || "MicroMobility" },
    pubKeyCredParams: [{ type: "public-key" as const, alg: -7 }, { type: "public-key" as const, alg: -257 }],
    timeout: PK_TIMEOUT_MS,
    attestation: "none" as const,
    authenticatorSelection: { residentKey: "required" as const, requireResidentKey: true, userVerification: "required" as const },
    excludeCredentials: (b.exclude ?? []).map((id) => ({ type: "public-key" as const, id })),
  };
}

/** passkey_begin's answer read, or null. */
export function beginOf(d: unknown, register: boolean): BeginAnswer | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.challenge !== "string" || !PK_CHALLENGE_RE.test(o.challenge)) return null;
  if (!register) return { challenge: o.challenge };
  const u = (o.user ?? {}) as Record<string, unknown>;
  if (typeof u.handle !== "string" || !/^[A-Za-z0-9_-]{22,86}$/.test(u.handle)) return null;
  const exclude = Array.isArray(o.exclude) ? o.exclude.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{22,1364}$/.test(x)) : [];
  return { challenge: o.challenge, user: { handle: u.handle, name: txt(u.name).slice(0, 120), display: txt(u.display).slice(0, 120) }, exclude };
}

/* ------------------------------------------------------------------ what a passkey is called */

/** Password managers by their AAGUID (the model an authenticator names when it makes a passkey; all zeros when it
 *  says none). A code, worded on the page (sx-B7.text.ts) and on the staff screen. */
const PROVIDERS: Record<string, string> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "icloud",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "icloud",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "google",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "chrome-mac",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "windows",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "windows",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "windows",
  "53414d53-554e-4700-0000-000000000000": "samsung",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "bitwarden",
};

/** The device a passkey was added on, from the browser's user agent, as a code. */
export function deviceOf(ua: string): string {
  const s = ua || "";
  if (/iPhone/.test(s)) return "iphone";
  if (/iPad/.test(s)) return "ipad";
  if (/Android/.test(s)) return "android";
  if (/CrOS/.test(s)) return "chromebook";
  if (/Macintosh|Mac OS X/.test(s)) return "mac";
  if (/Windows/.test(s)) return "windows-pc";
  if (/Linux/.test(s)) return "linux";
  return "other";
}

export const PK_LABELS = ["icloud", "google", "chrome-mac", "windows", "samsung", "1password", "bitwarden", "iphone", "ipad", "android", "chromebook", "mac", "windows-pc", "linux", "other"] as const;
export type PkLabel = (typeof PK_LABELS)[number];

/** A new passkey's label: its password manager when the authenticator names one, else the device it was added on. */
export const passkeyLabel = (aaguid: string | null, ua: string): PkLabel => ((aaguid && PROVIDERS[aaguid]) || deviceOf(ua)) as PkLabel;

/* ------------------------------------------------------------------ the account's list */

export type PasskeyItem = { id: string; label: PkLabel; createdAt: string; lastUsedAt: string | null; synced: boolean };

/** passkey_list's items read: what My Account shows (never a key or a credential id). */
export function passkeyItems(d: unknown): PasskeyItem[] | null {
  const items = d && typeof d === "object" ? (d as { items?: unknown }).items : null;
  if (!Array.isArray(items)) return null;
  return items.flatMap((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    if (typeof o.id !== "string" || !/^[0-9a-f-]{36}$/i.test(o.id) || typeof o.created_at !== "string") return [];
    const label = (PK_LABELS as readonly string[]).includes(txt(o.label)) ? (o.label as PkLabel) : "other";
    return [{ id: o.id, label, createdAt: o.created_at, lastUsedAt: typeof o.last_used_at === "string" ? o.last_used_at : null, synced: o.backed_up === true }];
  });
}

/* ------------------------------------------------------------------ refusals */

/** What the page is told. */
export type PkError = "off" | "origin" | "signin" | "slow" | "invalid" | "expired" | "unknown" | "failed" | "taken" | "limit" | "generic";

/** A database answer's refusal (its code, before a colon) as the page's word and the HTTP status. A database without
 *  the functions yet (PGRST202) reads as off: nothing shows, nothing breaks. */
export function pkRefusal(r: { status: number; message?: string; code?: string; data?: unknown }): { error: PkError; status: number } {
  if (r.status === 0 || r.status >= 500) return { error: "generic", status: 502 };
  const answered = r.data && typeof r.data === "object" ? txt((r.data as { error?: unknown }).error) : "";
  const code = answered || (/^[A-Z_]+/.exec(r.message ?? "")?.[0] ?? "");
  if (r.code === "PGRST202" || code === "PASSKEY_OFF") return { error: "off", status: 404 };
  switch (code) {
    case "PASSKEY_INPUT": return { error: "invalid", status: 400 };
    case "PASSKEY_SIGNIN": return { error: "signin", status: 401 };
    case "PASSKEY_CHALLENGE": return { error: "expired", status: 400 };
    case "PASSKEY_UNKNOWN": case "PASSKEY_RETIRED": return { error: "unknown", status: 401 };
    case "PASSKEY_COUNTER": return { error: "failed", status: 401 };
    case "PASSKEY_TAKEN": return { error: "taken", status: 409 };
    case "PASSKEY_LIMIT": return { error: "limit", status: 409 };
    case "PASSKEY_BUSY": case "RATE_LIMITED": return { error: "slow", status: 429 };
    default: return { error: "generic", status: 502 };
  }
}
