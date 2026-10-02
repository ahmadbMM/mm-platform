// My Account's details on micromobility.sa, as the booking app's My Account keeps them
// (renderAccount / saveAccount, the owner, 2026-10-03: "everything the booking app's My Account
// has"). The plain rules, kept apart from the routes (app/api/account/*) and the form
// (components/account/ProfileForm.tsx) so both check the same way and can be tested:
//   - names: letters of any script with their marks, spaces and periods, every word at least two
//     letters, first and last required (_nameCharsOk, _namePartsOk, _nameErr3);
//   - an email, a mobile with its country code (_normPhone), a height of 100 to 250 cm, a birth
//     date at least 5 and at most 100 years ago and never in the future (_dobErr);
//   - country and nationality from the app's own list (content/nationalities.ts - Israel is not
//     on it), a city of that country;
//   - gender (male or female, never cleared), profession (2-80), company (2-120), how they heard
//     of us (HEARD, never cleared) - customer_set_about;
//   - Instagram, X, TikTok and LinkedIn handles, reduced from whatever was pasted (SOCIAL_NETS);
//   - the bike type they ride (no "Any": that is staff's to give, 20261002160000).
// The database checks the same again (customer_update_profile, customer_set_about,
// customer_set_socials, the name trigger) and answers with the codes profileError reads.
import { NATIONALITIES } from "@/content/nationalities";
import { HEARD, type Heard } from "./learn";
import { riyadhToday } from "./learn";

export { HEARD, type Heard };

// ── Names ────────────────────────────────────────────────────────────────────────────────────

const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿ ]/g;
/** A box as typed, without the invisible direction marks a pasted name carries (_cleanIdent). */
export const cleanIdent = (v: unknown) => String(v ?? "").replace(INVISIBLE, "").trim();
const NAME_BAD_CHAR = /[^\p{L}\p{M}\s.]/u;
const NAME_BAD_CHARS = /[^\p{L}\p{M}\s.]/gu;
const NAME_DASHES = /[\p{Pd}−]/gu;
const nameDots = (v: string) => v.replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1");

/** What a name box keeps as it is typed: a dash becomes a space, anything else outside the rule
 *  goes, and a period that would start a word or follow another one is dropped (_nameInput). */
export const nameTyped = (v: string) => nameDots(v.replace(NAME_DASHES, " ").replace(NAME_BAD_CHARS, ""));
/** A name box cleaned for saving (_nameClean). */
export const nameClean = (v: unknown) => nameDots(String(v ?? "").replace(NAME_DASHES, " ").replace(NAME_BAD_CHARS, "")).replace(/\s{2,}/g, " ").trim();
/** Every part holds only letters, marks, spaces and periods, and no period starts a word (_nameCharsOk). */
export const nameCharsOk = (...parts: unknown[]) => parts.every((v) => { const s = String(v ?? ""); return !NAME_BAD_CHAR.test(s) && !/(^|[\s.])\./.test(s); });
/** Every word of every part has two letters at least, a period ending a word as a space does (_namePartsOk). */
export const namePartsOk = (...parts: unknown[]) => parts.every((v) => nameClean(v).split(/[\s.]+/).filter(Boolean).every((w) => [...w].length >= 2));
/** Each name word with a capital first letter; Arabic, with no capitals, passes as it is (_titleCaseName). */
export const titleCaseName = (v: string) => cleanIdent(v).replace(/\s+/g, " ").replace(/(^|[\s\-'’.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());

/** The stored name as the three boxes show it: the first word, the last word, and what is between (_splitName3). */
export function splitName3(full: string): { first: string; middle: string; last: string } {
  const w = cleanIdent(full).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!w.length) return { first: "", middle: "", last: "" };
  if (w.length === 1) return { first: w[0], middle: "", last: "" };
  return { first: w[0], middle: w.slice(1, -1).join(" "), last: w[w.length - 1] };
}
/** The three boxes joined into the stored name (_joinName3). */
export const joinName3 = (first: string, middle: string, last: string) => titleCaseName([first, middle, last].map(cleanIdent).filter(Boolean).join(" "));

export type NameError = "name_chars" | "name_short" | "name_missing";
/** What is wrong with a name as the three boxes hold it, or null. */
export function nameError(first: string, middle: string, last: string): NameError | null {
  if (!nameCharsOk(first, middle, last)) return "name_chars";
  if (!namePartsOk(first, middle, last)) return "name_short";
  if (!cleanIdent(first) || !cleanIdent(last) || joinName3(first, middle, last).split(/\s+/).filter(Boolean).length < 2) return "name_missing";
  return null;
}
/** A whole stored name, checked as the save checks it. */
export function fullNameError(name: string): NameError | null {
  const s = cleanIdent(name);
  if (!nameCharsOk(s)) return "name_chars";
  if (!namePartsOk(s)) return "name_short";
  if (s.split(/\s+/).filter(Boolean).length < 2 || [...s].length > 120) return "name_missing";
  return null;
}

// ── Email, mobile ────────────────────────────────────────────────────────────────────────────

/** The booking app's email rule (saveAccount, customer_update_profile). */
export const emailOk = (e: string) => e.length <= 254 && /^[^\s<>"'()@]+@[^\s<>"'()@]+\.[^\s<>"'()@]+$/.test(e);
/** The country codes the account form offers (COUNTRY_CODES). */
export const COUNTRY_CODES = ["+966", "+971", "+974", "+965", "+973", "+968"] as const;

const asciiDigits = (s: string) => s.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
/** A number typed after a country code, stored as +<code><number> (_normPhone): an explicit + or 00
 *  keeps its own code, a trunk 0 goes, a number that already starts with the code keeps it. */
export function normPhone(raw: string, cc: string = "+966"): string {
  const ccd = cc.replace(/\D/g, "");
  let s = asciiDigits(String(raw ?? "")).replace(INVISIBLE, "").trim().replace(/[\s()\-.]/g, "");
  if (!s) return "";
  if (s[0] === "+") { let d = s.slice(1).replace(/\D/g, ""); if (ccd && d.startsWith(`${ccd}0`)) d = ccd + d.slice(ccd.length + 1); return `+${d}`; }
  s = s.replace(/\D/g, "");
  if (!s) return "";
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  if (ccd && s.startsWith(ccd) && s.length >= 11 && s.length - ccd.length >= 8) return `+${s}`;
  if (s[0] === "0") return cc + s.slice(1);
  return cc + s;
}
/** A stored mobile split for the form: its code when it is one the form offers, and the rest. */
export function splitPhone(phone: string): { cc: string; num: string } {
  const p = phone || "";
  const cc = COUNTRY_CODES.find((c) => p.startsWith(c));
  return cc ? { cc, num: p.slice(cc.length) } : { cc: "+966", num: p };
}
/** A stored mobile the database takes (customer_update_profile: +, then 8 to 15 digits). */
export const phoneOk = (p: string) => /^\+?[0-9]{8,15}$/.test(p);

// ── Height, birth date ───────────────────────────────────────────────────────────────────────

export const HEIGHT = [100, 250] as const;
/** A height typed in any digits, or null for one that is not a whole number of centimetres. */
export function heightOf(raw: string): number | null {
  const d = asciiDigits(String(raw ?? "")).trim();
  return /^\d{1,3}$/.test(d) ? Number(d) : null;
}
export const heightOk = (h: number) => Number.isInteger(h) && h >= HEIGHT[0] && h <= HEIGHT[1];

export const DOB_MIN_AGE = 5;
export const DOB_MAX_AGE = 100;
export type DobError = "birth_future" | "birth_young" | "birth_old";
const shiftYears = (today: string, years: number) => `${String(Number(today.slice(0, 4)) - years).padStart(4, "0")}${today.slice(4)}`;
/** The latest and the earliest birth date the account takes, on Riyadh's calendar (_dobMax). */
export const dobRange = (today: string = riyadhToday()) => ({ max: shiftYears(today, DOB_MIN_AGE), min: shiftYears(today, DOB_MAX_AGE) });
/** What is wrong with a birth date (YYYY-MM-DD), or null (_dobErr, and the 100 years the picker offers). */
export function dobError(v: string, today: string = riyadhToday()): DobError | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return "birth_future";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return "birth_future";
  if (v > today) return "birth_future";
  const { max, min } = dobRange(today);
  if (v > max) return "birth_young";
  if (v < min) return "birth_old";
  return null;
}

// ── Places ───────────────────────────────────────────────────────────────────────────────────

const COUNTRY_CODE = new Map(NATIONALITIES.map(([code, name]) => [name, code]));
/** A country or nationality the account takes: one of the app's own list (never Israel). */
export const countryOk = (name: string) => COUNTRY_CODE.has(name);
/** The city list's file for a country (public/cities/<iso2>.json, the booking app's own data). */
export const cityFile = (country: string) => { const c = COUNTRY_CODE.get(country); return c ? `/cities/${c.toLowerCase()}.json` : null; };
/** A city as stored: free of the signs the database refuses, 120 at most. */
export const cityOk = (city: string) => [...city].length <= 120 && !/[<>"`{}]/.test(city) && /\p{L}/u.test(city);

// ── About, socials, bike type ────────────────────────────────────────────────────────────────

export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];
/** Profession (80) and company (120): 2 characters or more, a letter among them, none of the signs
 *  the database refuses. Empty clears the box (_aboutTextOk). */
export const aboutTextOk = (v: string, max: number) => { const n = [...v].length; return !v || (n >= 2 && n <= max && /\p{L}/u.test(v) && !/[<>"`{}]/.test(v)); };
export const aboutText = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

export const SOCIAL_NETS = [
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com/", rule: /^[A-Za-z0-9._]{1,30}$/ },
  { key: "x", label: "X", url: "https://x.com/", rule: /^[A-Za-z0-9_]{1,15}$/ },
  { key: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@", rule: /^[A-Za-z0-9._]{1,30}$/ },
  { key: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/", rule: /^[A-Za-z0-9\-_.%]{3,100}$/ },
] as const;
export type SocialKey = (typeof SOCIAL_NETS)[number]["key"];
export type Socials = Partial<Record<SocialKey, string>>;
/** Whatever was pasted - a profile link, an @handle - as the bare handle (_socNorm). */
export function socNorm(raw: unknown): string {
  let v = String(raw ?? "").trim();
  v = v.replace(/^(?:https?:\/\/)?(?:www\.|m\.|mobile\.)?(?:instagram\.com|x\.com|twitter\.com|tiktok\.com|linkedin\.com)\/(?:in\/)?/i, "");
  v = v.replace(/[?#].*$/, "").replace(/^[@/\s]+|[/\s]+$/g, "");
  return v.slice(0, 100);
}
/** The four boxes as stored: {val} the clean handles (null when all are empty), or {err} the first
 *  network whose handle cannot be right (_socRead). */
export function socRead(boxes: Partial<Record<string, unknown>> | null | undefined): { val: Socials | null } | { err: SocialKey } {
  const out: Socials = {};
  for (const n of SOCIAL_NETS) {
    const h = socNorm(boxes?.[n.key]);
    if (!h) continue;
    if (!n.rule.test(h)) return { err: n.key };
    out[n.key] = h;
  }
  return { val: Object.keys(out).length ? out : null };
}
/** A stored socials object as the boxes show it (anything that is not a known network's string is left out). */
export function socialsOf(v: unknown): Socials {
  const out: Socials = {};
  if (v && typeof v === "object") for (const n of SOCIAL_NETS) { const h = (v as Record<string, unknown>)[n.key]; if (typeof h === "string" && h) out[n.key] = h; }
  return out;
}

/** The bike types a rider may pick on their account: no "Any", which is staff's to give. "Own" is
 *  a bike owner (they bring their own bike). */
export const RIDER_TYPES = ["Road", "Hybrid", "Mountain", "Kids", "Road Carbon", "Own"] as const;
export type RiderType = (typeof RIDER_TYPES)[number];

// ── The save ─────────────────────────────────────────────────────────────────────────────────

/** What the form changed, as it sends it: only the fields the rider touched. */
export type ProfileChanges = Partial<{
  name: string; email: string; phone: string; height: number | null; birth_date: string | null;
  country: string | null; city: string | null; nationality: string | null; type_preference: string;
  socials: Partial<Record<string, unknown>> | null;
  gender: string; profession: string; workplace: string; heard_from: string;
}>;
export type ProfileError =
  | NameError | DobError | "email" | "phone" | "contact" | "height" | "country" | "city" | "nationality" | "type"
  | "gender" | "profession" | "workplace" | "heard" | `social_${SocialKey}`;
export type CleanChanges = {
  core: Partial<{ name: string; email: string; phone: string; height: number | null; birth_date: string | null; country: string | null; city: string | null; nationality: string | null; type_preference: RiderType }>;
  socials?: Socials | null;
  about: Partial<{ gender: Gender; profession: string; workplace: string; heard_from: Heard }>;
};
/** customer_profile's row, as much of it as the save reads. */
export type ProfileRow = { name?: string | null; email?: string | null; phone?: string | null; height?: number | null; type_preference?: string | null;
  birth_date?: string | null; country?: string | null; city?: string | null; nationality?: string | null; socials?: unknown; gender?: string | null; photo?: string | null };
/** customer_about's row. */
export type AboutRow = { profession?: string | null; workplace?: string | null; heard_from?: string | null; sign_in?: string | null };

const has = <K extends string>(o: object, k: K) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * The changed fields checked one by one, in the form's order, against the account as it is now
 * (`cur`): the first problem, or the clean values to write. A field the rider did not change is
 * not sent and not judged, as saveAccount does (an old name saved before the rule stays).
 */
export function cleanChanges(ch: ProfileChanges, cur: ProfileRow, today: string = riyadhToday()): { error: ProfileError } | { ok: CleanChanges } {
  const core: CleanChanges["core"] = {}, about: CleanChanges["about"] = {};
  let socials: Socials | null | undefined;
  if (has(ch, "name")) {
    const name = titleCaseName(nameClean(ch.name));
    const e = fullNameError(String(ch.name ?? "")) ?? fullNameError(name);
    if (e) return { error: e };
    core.name = name;
  }
  if (has(ch, "email")) {
    const email = cleanIdent(ch.email).toLowerCase();
    if (email && !emailOk(email)) return { error: "email" };
    core.email = email;
  }
  if (has(ch, "phone")) {
    const phone = cleanIdent(ch.phone);
    if (phone && !phoneOk(phone)) return { error: "phone" };
    core.phone = phone;
  }
  const email = has(core, "email") ? core.email : cur.email ?? "", phone = has(core, "phone") ? core.phone : cur.phone ?? "";
  if ((has(ch, "email") || has(ch, "phone")) && !email && !phone) return { error: "contact" };
  if (has(ch, "height")) {
    const h = ch.height;
    if (h != null && !heightOk(Number(h))) return { error: "height" };
    core.height = h == null ? null : Number(h);
  }
  if (has(ch, "birth_date")) {
    const b = ch.birth_date || null;
    const e = b ? dobError(b, today) : null;
    if (e) return { error: e };
    core.birth_date = b;
  }
  if (has(ch, "country")) {
    const c = ch.country || null;
    if (c && !countryOk(c) && c !== cur.country) return { error: "country" };
    core.country = c;
    if (!has(ch, "city")) core.city = c === (cur.country ?? null) ? cur.city ?? null : null;
  }
  if (has(ch, "city")) {
    const c = cleanIdent(ch.city) || null;
    if (c && !cityOk(c)) return { error: "city" };
    core.city = c;
  }
  if (has(ch, "nationality")) {
    const n = ch.nationality || null;
    if (n && !countryOk(n) && n !== cur.nationality) return { error: "nationality" };
    core.nationality = n;
  }
  if (has(ch, "type_preference")) {
    if (!(RIDER_TYPES as readonly string[]).includes(String(ch.type_preference))) return { error: "type" };
    core.type_preference = ch.type_preference as RiderType;
  }
  if (has(ch, "socials")) {
    const r = socRead(ch.socials);
    if ("err" in r) return { error: `social_${r.err}` };
    socials = r.val;
  }
  if (has(ch, "gender")) {
    if (!(GENDERS as readonly string[]).includes(String(ch.gender))) return { error: "gender" };
    about.gender = ch.gender as Gender;
  }
  if (has(ch, "profession")) {
    const v = aboutText(ch.profession);
    if (!aboutTextOk(v, 80)) return { error: "profession" };
    about.profession = v;
  }
  if (has(ch, "workplace")) {
    const v = aboutText(ch.workplace);
    if (!aboutTextOk(v, 120)) return { error: "workplace" };
    about.workplace = v;
  }
  if (has(ch, "heard_from")) {
    if (!(HEARD as readonly string[]).includes(String(ch.heard_from))) return { error: "heard" };
    about.heard_from = ch.heard_from as Heard;
  }
  return { ok: { core, about, ...(socials !== undefined ? { socials } : {}) } };
}

/** customer_update_profile writes every column, so it gets the account as it is now with the
 *  changed fields laid over it - a box the rider left alone keeps the value on file, never the
 *  one this page showed (staff may have corrected it since). Null when nothing changed. */
export function profileArgs(cur: ProfileRow, core: CleanChanges["core"]): Record<string, unknown> | null {
  const keys = Object.keys(core) as (keyof CleanChanges["core"])[];
  const changed = keys.some((k) => (core[k] ?? null) !== ((cur as Record<string, unknown>)[k] ?? null));
  if (!changed) return null;
  const v = { ...cur, ...core };
  return {
    p_name: v.name ?? "", p_email: v.email ?? "", p_phone: v.phone ?? "", p_height: v.height ?? null,
    p_type_preference: v.type_preference || "Any", p_birth_date: v.birth_date ?? null,
    p_country: v.country ?? null, p_city: v.city ?? null, p_nationality: v.nationality ?? null,
  };
}

/** customer_set_about writes profession and company as given, so it gets the ones on file for a box
 *  not changed; how they heard and gender only ever change to an answer. Null when nothing changed. */
export function aboutArgs(ab: AboutRow, cur: ProfileRow, about: CleanChanges["about"]): Record<string, unknown> | null {
  const prof = has(about, "profession") ? about.profession ?? "" : ab.profession ?? "";
  const wp = has(about, "workplace") ? about.workplace ?? "" : ab.workplace ?? "";
  const heard = about.heard_from && about.heard_from !== ab.heard_from ? about.heard_from : null;
  const gender = about.gender && about.gender !== cur.gender ? about.gender : null;
  if (prof === (ab.profession ?? "") && wp === (ab.workplace ?? "") && !heard && !gender) return null;
  return { p_profession: prof || null, p_workplace: wp || null, p_heard_from: heard, p_gender: gender };
}

/** Whether the socials to save differ from the ones on file. */
export const socialsChanged = (next: Socials | null, cur: unknown) => JSON.stringify(next ?? null) !== JSON.stringify(Object.keys(socialsOf(cur)).length ? socialsOf(cur) : null);

/** A database refusal as the form's message code (saveAccount's catch). */
export function profileError(message: string, details = ""): "name_chars" | "name_short" | "profession" | "workplace" | "phone_taken" | "email_taken" | "rate" | "signin" | "generic" {
  const m = `${message} ${details}`;
  if (/name_chars/.test(m)) return "name_chars";
  if (/name_short/.test(m)) return "name_short";
  if (/BAD_INPUT/.test(message) && /workplace/.test(details)) return "workplace";
  if (/BAD_INPUT/.test(message) && /profession/.test(details)) return "profession";
  if (/phone_taken/.test(m)) return "phone_taken";
  if (/email_taken/.test(m)) return "email_taken";
  if (/RATE_LIMITED/.test(m)) return "rate";
  if (/BAD_TOKEN|denied/i.test(m)) return "signin";
  return "generic";
}

// ── Passwords ────────────────────────────────────────────────────────────────────────────────

/** The booking app's password rule: 8 characters or more, a capital letter and a digit. */
export const passwordOk = (p: string) => p.length >= 8 && p.length <= 200 && /[A-Z]/.test(p) && /[0-9]/.test(p);
export type PasswordError = "bad" | "weak" | "same" | "locked" | "notdue" | "signin" | "generic";
/** customer_change_password / customer_set_own_password's refusals. */
export function passwordError(message: string): PasswordError {
  if (/LOCKED/.test(message)) return "locked";
  if (/BAD_PASSWORD/.test(message)) return "bad";
  if (/WEAK_PASSWORD/.test(message)) return "weak";
  if (/SAME_PASSWORD/.test(message)) return "same";
  if (/NO_CHANGE_DUE/.test(message)) return "notdue";
  if (/BAD_TOKEN/.test(message)) return "signin";
  return "generic";
}

// ── Correction requests (customer_fix_fields / customer_fix_save) ───────────────────────────

/** The fields staff can ask a rider to correct, and the ones the server asks for itself, in the
 *  booking app's order (FIX_FIELDS). */
export const FIX_FIELDS = ["name", "email", "phone", "birth_date", "gender", "nationality", "country", "city", "height", "photo", "password"] as const;
export type FixField = (typeof FIX_FIELDS)[number];
/** The asked fields the page knows, in order, each once. */
export const fixClean = (a: unknown): FixField[] => { const on = new Set(Array.isArray(a) ? a : []); return FIX_FIELDS.filter((k) => on.has(k)); };
/** One item per box: country and city are one answer. */
export function fixItems(fields: FixField[]): (Exclude<FixField, "country" | "city"> | "residence")[] {
  const out: (Exclude<FixField, "country" | "city"> | "residence")[] = [];
  for (const k of fields) {
    if (k === "country" || k === "city") { if (!out.includes("residence")) out.push("residence"); } else out.push(k);
  }
  return out;
}
export const APPLE_RELAY = "@privaterelay.appleid.com";
export type FixValues = Partial<Record<"name" | "email" | "phone" | "birth_date" | "gender" | "nationality" | "country" | "city" | "height" | "photo" | "password", string>>;
/** The answers checked as _fixSave checks them: the first problem by field, or customer_fix_save's p_values. */
export function cleanFix(fields: FixField[], v: FixValues, photoBase: string, today: string = riyadhToday()): { errors: Partial<Record<string, string>> } | { values: Record<string, string | null> } {
  const errors: Partial<Record<string, string>> = {}, values: Record<string, string | null> = {};
  for (const k of fixItems(fields)) {
    if (k === "name") { const n = String(v.name ?? ""); const e = fullNameError(n) ?? fullNameError(titleCaseName(nameClean(n))); if (e) errors.name = e; else values.name = titleCaseName(nameClean(n)); }
    else if (k === "email") { const e = cleanIdent(v.email).toLowerCase(); if (!emailOk(e)) errors.email = "email"; else if (e.endsWith(APPLE_RELAY)) errors.email = "relay"; else values.email = e; }
    else if (k === "password") { if (!passwordOk(String(v.password ?? ""))) errors.password = "weak"; else values.password = String(v.password); }
    else if (k === "phone") { const p = cleanIdent(v.phone); if (!phoneOk(p) || p.replace(/\D/g, "").length < 8) errors.phone = "phone"; else values.phone = p; }
    else if (k === "birth_date") { const b = String(v.birth_date ?? ""); const e = b ? dobError(b, today) : "birth_missing"; if (e) errors.birth_date = e; else values.birth_date = b; }
    else if (k === "gender") { if (v.gender !== "male" && v.gender !== "female") errors.gender = "pick"; else values.gender = v.gender; }
    else if (k === "nationality") { if (!countryOk(String(v.nationality ?? ""))) errors.nationality = "pick"; else values.nationality = String(v.nationality); }
    else if (k === "residence") {
      const c = String(v.country ?? ""), city = cleanIdent(v.city);
      if (!countryOk(c) || (city && !cityOk(city))) errors.residence = "pick"; else { values.country = c; values.city = city || null; }
    }
    else if (k === "height") { const h = heightOf(String(v.height ?? "")); if (h === null || !heightOk(h)) errors.height = "height"; else values.height = String(h); }
    else if (k === "photo") { const p = String(v.photo ?? ""); if (!photoUrlOk(p, photoBase)) errors.photo = "photo"; else values.photo = p; }
  }
  return Object.keys(errors).length ? { errors } : { values };
}

// ── Photos ───────────────────────────────────────────────────────────────────────────────────

/** The public address a photo uploaded to the `photos` bucket is served at. */
export const photoBase = (supabaseUrl: string) => `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/photos/`;
/** A photo address this site put there: the bucket's own, under p/, with a name the bucket's policy allows. */
export const photoUrlOk = (url: string, base: string) => !!base && url.startsWith(`${base}p/`) && /^p\/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$/.test(url.slice(base.length));
/** The kind of image the bytes are, by their first bytes, or null: only JPEG, PNG and WebP are taken. */
export function imageKind(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}
export const PHOTO_MAX_BYTES = 400_000;
/** Two letters for an account without a photo (renderAccount's initials). */
export const initials = (name: string) => cleanIdent(name).split(/\s+/).filter(Boolean).map((w) => [...w][0] ?? "").join("").slice(0, 2).toLocaleUpperCase();

// ── The season (the booking app's _seasonDashboard) ─────────────────────────────────────────

export const TIERS = [[0, "newcomer"], [3, "regular"], [10, "pro"], [25, "elite"], [50, "legend"]] as const;
export type TierKey = (typeof TIERS)[number][1];
/** The tier a number of completed rides reaches, the next one and how far along the way (_mrTier). */
export function tierOf(rides: number): { key: TierKey; next: { key: TierKey; need: number } | null; pct: number } {
  let i = 0;
  for (let j = 0; j < TIERS.length; j++) if (rides >= TIERS[j][0]) i = j;
  const nx = TIERS[i + 1];
  if (!nx) return { key: TIERS[i][1], next: null, pct: 100 };
  const from = TIERS[i][0], to = nx[0];
  return { key: TIERS[i][1], next: { key: nx[1], need: to - rides }, pct: Math.max(4, Math.min(100, Math.round(((rides - from) / (to - from)) * 100))) };
}
/** Whole days from today to a ride's day (both YYYY-MM-DD), never below zero. */
export const daysUntil = (date: string, today: string) => Math.max(0, Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5));

// ── Purchases (customer_purchases) ───────────────────────────────────────────────────────────

export type Purchase = { id: string; at: string | null; name: string; category: string | null; qty: number; price: number; pay: string | null;
  receipt_id: string | null; session_date: string | null; session_title: string | null; voided: boolean; refunded: boolean };
/** The rows as the list shows them (the card meta rows the desk keeps are not purchases), and the
 *  total of the ones that stand: a voided or refunded sale is shown struck through and not counted. */
export function purchasesOf(data: unknown): { rows: Purchase[]; total: number } {
  const rows: Purchase[] = (Array.isArray(data) ? data : []).filter((r) => r && typeof r === "object" && (r as { category?: unknown }).category !== "__cardmeta__").map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id ?? ""), at: typeof x.at === "string" ? x.at : null, name: String(x.name ?? ""), category: typeof x.category === "string" ? x.category : null,
      qty: Number(x.qty) || 0, price: Number(x.price) || 0, pay: typeof x.pay === "string" ? x.pay : null,
      receipt_id: x.receipt_id == null ? null : String(x.receipt_id), session_date: typeof x.session_date === "string" ? x.session_date : null,
      session_title: typeof x.session_title === "string" ? x.session_title : null,
      voided: x.voided === true, refunded: x.refunded === true || x.pay === "refunded",
    };
  });
  const total = Math.round(rows.filter((r) => !r.voided && !r.refunded).reduce((s, r) => s + r.qty * r.price, 0) * 100) / 100;
  return { rows, total };
}
