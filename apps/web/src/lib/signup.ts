import { ACCOUNT_HEIGHT, GENDERS, emailOk, passwordOldRuleMiss, passwordProblem, phoneOk, wholeNumber, type Gender } from "./learn";
import { EM_EMPTY, EM_RELS, emPhone, emReadBoth, type EmContact, type EmError, type EmFields, type EmRel } from "./emergency";

// Create account on micromobility.sa (the user, 2026-11-19: "make sure all customers can do everything they want in the
// booking app to do it on the main website"): the booking app's own sign-up (its doSignup), at /signup
// (components/account/SignupForm.tsx), made by the site's server (app/api/account/signup) so the session lands in the
// account cookie as a sign-in's does. What both check before anything is sent, in the booking app's order, and what the
// database's refusals mean, are here:
//   - the first and last name: letters of any script with their marks, spaces and periods (a typed dash becomes a
//     space), every word two letters or more, both boxes filled and two words at least;
//   - male or female;
//   - an email, and a mobile under its dial code (8 digits or more, 15 at most with the code; a Saudi one a mobile);
//   - a password of 8 characters or more that is not too easy to guess;
//   - the first emergency contact (lib/emergency.ts), and the second when any of its boxes is filled;
//   - the Privacy Notice box ticked (ride news may be left empty);
//   - a height of 100 to 250 cm.
// Then the server asks customer_exists twice, so the message says WHICH of the email and the mobile is taken, makes the
// account with customer_signup under an id it makes in the booking app's uid() form, records the notice and the
// ride-news answer (customer_consents) and saves the contacts (customer_set_emergency, customer_set_emergency2).

/** The sign-up as typed. */
export type SignupFields = {
  first: string;
  last: string;
  gender: Gender | "";
  email: string;
  /** The dial code picked beside the mobile ("+966"). */
  cc: string;
  phone: string;
  password: string;
  height: string;
  em1: EmFields;
  /** The second contact: null (or all three boxes empty) when it was not added. */
  em2: EmFields | null;
  privacy: boolean;
  news: boolean;
};

/** Which box a problem sits under. */
export type SignupField = "first" | "last" | "gender" | "email" | "phone" | "password" | "height" | "privacy";

/** What is wrong, as the booking app says it (each has its own words: components/account/Signup.words.ts). */
export type SignupError =
  | "name_chars" | "name_short" | "enter_name" | "gender"
  | "email_required" | "email_invalid" | "phone_required" | "phone_invalid"
  | "password_short" | "password_common" | "password_old"
  | "privacy" | "height"
  | "email_taken" | "phone_taken" | "rate_limited"
  /** The site's own guards (lib/sign-in-guard.ts): too many tries from this connection, the Turnstile check. */
  | "slow" | "check"
  /** Anything else: the database out of reach or a refusal the form cannot name. */
  | "connection";

export type SignupProblem =
  | { error: SignupError; field?: SignupField }
  /** An emergency contact's problem, and which contact it is about. */
  | { error: EmError; which: 1 | 2 };

/** customer_signup()'s argument, less the id the server makes. */
export type SignupArgs = { p_name: string; p_email: string; p_phone: string; p_pwd: string; p_height: number; p_type_preference: "Any"; p_gender: Gender };
export type SignupReady = { args: SignupArgs; em1: EmContact; em2: EmContact | null; news: boolean };

// The booking app's name rule (_nameCharsOk, _namePartsOk, _nameErr, _joinName).
const NAME_BAD_CHAR = /[^\p{L}\p{M}\s.]/u;
const NAME_BAD_CHARS = /[^\p{L}\p{M}\s.]/gu;
const NAME_DASHES = /[\p{Pd}−]/gu;
/** Invisible characters an Arabic keyboard or a paste brings (direction marks, zero-width, NBSP): an email that keeps
 *  one never matches at sign-in again (the booking app's _cleanIdent). */
const cleanIdent = (v: string) => v.replace(/[​-‏‪-‮⁦-⁩﻿ ]/g, "").trim();
const nameDots = (v: string) => v.replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1");
const nameClean = (v: string) => nameDots(v.replace(NAME_DASHES, " ").replace(NAME_BAD_CHARS, "")).replace(/\s{2,}/g, " ").trim();
const nameCharsOk = (v: string) => !NAME_BAD_CHAR.test(v) && !/(^|[\s.])\./.test(v);
const namePartsOk = (v: string) => nameClean(v).split(/[\s.]+/).filter(Boolean).every((w) => [...w].length >= 2);
/** Both boxes as the one stored name, every word capitalised ("ahmed ALI" -> "Ahmed ALI"; Arabic has no case). */
export const joinName = (first: string, last: string) =>
  cleanIdent(`${first || ""} ${last || ""}`.trim()).replace(/\s+/g, " ").replace(/(^|[\s\-'’.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase());

/** A name box as the rider types (the booking app's _nameInput): a dash becomes a space, anything else outside the rule
 *  goes, and so does a period that would start a word or follow another. `dropped` says whether anything but a dash or
 *  a stray period went, so the form can say why once. */
export function nameTyped(v: string): { value: string; dropped: boolean } {
  const k = v.replace(NAME_DASHES, " ").replace(NAME_BAD_CHARS, "");
  return { value: nameDots(k), dropped: k !== v.replace(NAME_DASHES, " ") };
}

const DIGITS = (s: string) => s.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));

/** The mobile as the database stores it: "+", the dial code and the number (a trunk 0 dropped, a number typed with its
 *  own + or 00 keeping its code), the booking app's _normPhone. */
export const signupPhone = (cc: string, raw: string) => emPhone(cc || "+966", raw);

/**
 * The sign-up checked in the booking app's order (doSignup); the first problem, or what to send. The server checks it
 * again whatever the page said.
 */
export function signupCheck(f: SignupFields): SignupProblem | SignupReady {
  const { first, last } = f;
  if (!nameCharsOk(first)) return { error: "name_chars", field: "first" };
  if (!nameCharsOk(last)) return { error: "name_chars", field: "last" };
  if (!namePartsOk(first)) return { error: "name_short", field: "first" };
  if (!namePartsOk(last)) return { error: "name_short", field: "last" };
  if (!cleanIdent(first)) return { error: "enter_name", field: "first" };
  if (!cleanIdent(last)) return { error: "enter_name", field: "last" };
  const name = joinName(first, last);
  if (name.split(/\s+/).filter(Boolean).length < 2) return { error: "enter_name", field: "first" };
  if ([...name].length > 120) return { error: "enter_name", field: "last" };
  if (!(GENDERS as readonly string[]).includes(f.gender)) return { error: "gender", field: "gender" };
  const email = cleanIdent(f.email).toLowerCase();
  if (!email) return { error: "email_required", field: "email" };
  // The booking app's own test, then the database's (an address it would refuse, or Apple's hidden relay).
  if (!/^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(email) || !emailOk(email) || email.endsWith("@privaterelay.appleid.com")) return { error: "email_invalid", field: "email" };
  const typed = DIGITS(cleanIdent(f.phone)).replace(/\D/g, "");
  if (!typed) return { error: "phone_required", field: "phone" };
  if (typed.length < 8) return { error: "phone_invalid", field: "phone" };
  const phone = signupPhone(f.cc, f.phone);
  if (phone.replace(/\D/g, "").length > 15 || !phoneOk(phone)) return { error: "phone_invalid", field: "phone" };
  const pp = passwordProblem(f.password);
  if (pp) return { error: pp === "short" ? "password_short" : "password_common", field: "password" };
  const em = emReadBoth(f.em1, f.em2, phone);
  if ("error" in em) return { error: em.error, which: em.which };
  if (!f.privacy) return { error: "privacy", field: "privacy" };
  const height = wholeNumber(f.height);
  if (height === null || height < ACCOUNT_HEIGHT[0] || height > ACCOUNT_HEIGHT[1]) return { error: "height", field: "height" };
  return {
    args: { p_name: name, p_email: email, p_phone: phone, p_pwd: f.password, p_height: height, p_type_preference: "Any", p_gender: f.gender as Gender },
    em1: em.first, em2: em.second, news: f.news === true,
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
function emOf(v: unknown): EmFields | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const rel = str(o.rel, 20);
  return { name: str(o.name, 100), cc: str(o.cc, 6) || "+966", phone: str(o.phone, 30), rel: (EM_RELS as readonly string[]).includes(rel) ? (rel as EmRel) : "" };
}

/** A request's body as the sign-up's fields: strings cut to a sane length, anything else empty. */
export function signupFieldsOf(body: unknown): SignupFields {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const g = str(b.gender, 10);
  return {
    first: str(b.first, 80), last: str(b.last, 80), gender: (GENDERS as readonly string[]).includes(g) ? (g as Gender) : "",
    email: str(b.email, 300), cc: str(b.cc, 6) || "+966", phone: str(b.phone, 30), password: str(b.password, 200), height: str(b.height, 10),
    em1: emOf(b.em1) ?? EM_EMPTY, em2: emOf(b.em2), privacy: b.privacy === true, news: b.news === true,
  };
}

type Answer = { status: number; message?: string; code?: string; details?: string };

/** customer_signup()'s refusal as the booking app words it: a name the database's rule refuses, too many sign-ups from
 *  this address, a taken email or mobile (DUPLICATE: the checks before it missed it), a password the database refuses
 *  (the old rule, an upper-case letter and a digit, on a database without 20261111130000, else one too easy to guess),
 *  a mobile it refuses; anything else is a connection problem. */
export function signupRefusal(r: Answer, password: string): { error: SignupError; field?: SignupField } {
  const m = `${r.message ?? ""} ${r.details ?? ""}`;
  if (/name_chars/.test(m)) return { error: "name_chars" };
  if (/name_short/.test(m)) return { error: "name_short" };
  if (/RATE_LIMITED/.test(m)) return { error: "rate_limited" };
  if (r.code === "23505" || /DUPLICATE/i.test(m)) return { error: "email_taken", field: "email" };
  if (/WEAK_PASSWORD/.test(m)) {
    const pp = passwordProblem(password);
    if (pp) return { error: pp === "short" ? "password_short" : "password_common", field: "password" };
    return { error: passwordOldRuleMiss(password) ? "password_old" : "password_common", field: "password" };
  }
  if (r.code === "22023" && /phone/.test(r.details ?? "")) return { error: "phone_invalid", field: "phone" };
  return { error: "connection" };
}

/** A new account's id, in the booking app's uid() form: seven random letters and digits, then the time in base 36. */
export function newCustomerId(now: number = Date.now(), bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(7))): string {
  const a = "0123456789abcdefghijklmnopqrstuvwxyz";
  return Array.from(bytes.slice(0, 7), (b) => a[b % 36]).join("") + now.toString(36);
}

/** Where to go once signed in: a path on this site ("/ask/x?y=1"), never another site ("//x.com", "https://x.com",
 *  "/\\x.com"), the site's API or anything with a control character in it; null for anything else. */
export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.length > 600 || s.includes("\\") || [...s].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return null;
  let u: URL;
  try { u = new URL(s, "https://site.invalid"); } catch { return null; }
  if (u.origin !== "https://site.invalid" || /^\/api(\/|$)/i.test(u.pathname)) return null;
  return u.pathname + u.search + u.hash;
}

/** Where a sign-up or a forgotten password comes back to, from the page a sign-in is on (`pathname`, `search`): where
 *  that page was itself to go (its ?next=), else the page, less ?lang= (the language travels in its cookie) and
 *  ?handoff= (the booking app's hand-back said its piece on that page already). */
export function herePath(pathname: string, search: string): string {
  const q = new URLSearchParams(search);
  const next = safeNext(q.get("next"));
  if (next) return next;
  for (const k of ["next", "lang", "handoff"]) q.delete(k); // a next that leaves the site goes too
  const rest = q.toString();
  return pathname + (rest ? `?${rest}` : "");
}

/** The site's own sign-up and forgotten-password pages. */
export const SIGNUP_PATH = "/signup";
export const FORGOT_PATH = "/forgot-password";
export const SIGNIN_PATH = "/account";

/** A page's address with ?next= (left off when it is where the page goes anyway, My Account) and ?lang=. */
export function withNext(path: string, next: string | null | undefined, lang?: string | null): string {
  const q = new URLSearchParams();
  const n = safeNext(next ?? "");
  if (n && n !== SIGNIN_PATH) q.set("next", n);
  if (lang && /^[a-z]{2}$/.test(lang)) q.set("lang", lang);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** The booking app's Create account or Forgot password hand-over (…?handoff=site&auth=signup|forgot, with ?lang=), as
 *  the site's own page: /signup or /forgot-password, coming back to `here` (the page the link is on) and in the
 *  hand-over's language. Null for any other link. */
export function siteAuthHref(href: string, here: string): string | null {
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.searchParams.get("handoff") !== "site") return null;
  const auth = u.searchParams.get("auth");
  if (auth !== "signup" && auth !== "forgot") return null;
  return withNext(auth === "signup" ? SIGNUP_PATH : FORGOT_PATH, here, u.searchParams.get("lang"));
}

/** The WhatsApp number a forgotten password is sent to (the booking app's FORGOT_PW_WA: the owner, 2026-10-11; the number
 *  corrected 2026-11-02), the link with the message filled in, and the number as it is written out. */
export const FORGOT_WA = "966579543997";
export const forgotWaHref = (text: string) => `https://wa.me/${FORGOT_WA}?text=${encodeURIComponent(text)}`;
export const FORGOT_WA_SHOWN = `+${FORGOT_WA.slice(0, 3)} ${FORGOT_WA.slice(3, 5)} ${FORGOT_WA.slice(5, 8)} ${FORGOT_WA.slice(8)}`;
