import { DIAL_CODES } from "@/content/dial-codes";
import { COUNTRY_AR } from "@/content/nationalities";
import { localeInfo } from "@/i18n/locales";
import { cleanName, nameOk, namePartsOk } from "./rpc-client";

// The emergency contact on the account (the owner, 2026-10-07: "make the emergency contact obligatory
// only the first one not the second and unskippable for all the customers and force them even add it
// in the sign up page and all forms currently available"): someone to call if the rider needs help at
// a ride or event, as the booking app asks it (_emRead). The first is required - the learn form's
// sign-up and its signed-in step ask it, and the account's check-up (EmergencyGate) asks an account
// that has none - and a second is optional: all three boxes or none. The database's rules
// (customer_set_emergency, customer_set_emergency2), checked here first so the message comes at once:
//   - a name of 2 to 80 characters, letters, marks, spaces and periods (a typed dash becomes a space),
//     every part two letters or more (the site's name rule);
//   - a mobile number, dial code and number, stored as 8 to 15 digits with a + ('^\+?[0-9]{8,15}$');
//   - one of the eight relations;
//   - never the rider's own number ('em_self') nor the other contact's ('em_same'), compared by the
//     last nine digits.
export const EM_RELS = ["spouse", "parent", "sibling", "child", "relative", "friend", "colleague", "other"] as const;
export type EmRel = (typeof EM_RELS)[number];

/** One contact as typed: the dial code (its "+" form), the number, the name and the relation code. */
export type EmFields = { name: string; cc: string; phone: string; rel: EmRel | "" };
export const EM_EMPTY: EmFields = { name: "", cc: "+966", phone: "", rel: "" };
/** One contact as the database takes it. */
export type EmContact = { name: string; phone: string; rel: EmRel };
/** What is wrong with a contact: the database's own codes (BAD_INPUT's detail), and the name rule's two. */
export type EmError = "em_name" | "em_phone" | "em_relation" | "em_self" | "em_same" | "name_chars" | "name_short";
/** Which box a problem sits under. */
export const EM_FIELD: Record<EmError, "name" | "phone" | "rel"> = {
  em_name: "name", name_chars: "name", name_short: "name", em_phone: "phone", em_self: "phone", em_same: "phone", em_relation: "rel",
};

const DIGITS = (s: string) => s
  .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
  .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
const last9 = (v: string) => v.replace(/\D/g, "").slice(-9);

/** The number typed under a dial code, as the database stores it: "+" and digits. A number typed with
 *  its own "+" or "00" keeps its code; a leading 0 (the trunk prefix) goes. */
export function emPhone(cc: string, raw: string): string {
  const s = DIGITS(raw).replace(/[​-‏‪-‮⁦-⁩﻿]/g, "").replace(/[\s\-().]/g, "");
  if (!s) return "";
  const code = cc.replace(/\D/g, "") || "966";
  if (s.startsWith("+")) {
    let x = s.slice(1).replace(/\D/g, "");
    if (x.startsWith(code + "0")) x = code + x.slice(code.length + 1);
    return "+" + x;
  }
  const d = s.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith(code) && d.length - code.length >= 8) return "+" + d;
  return "+" + code + (d.startsWith("0") ? d.slice(1) : d);
}

/** A contact all left empty (the optional second one). */
export const emBlank = (f: EmFields) => !f.name.trim() && !f.phone.trim() && !f.rel;

/**
 * One contact checked in the booking app's order (name, number, relation): the contact to save, or
 * the first problem. `own` is the rider's own number, `other` the other contact's (either may be "").
 */
export function emRead(f: EmFields, own: string, other = ""): { contact: EmContact } | { error: EmError } {
  const name = cleanName(f.name);
  const len = [...name].length;
  if (len < 2 || len > 80) return { error: "em_name" };
  if (!nameOk(name)) return { error: "name_chars" };
  if (!namePartsOk(name)) return { error: "name_short" };
  const phone = emPhone(f.cc, f.phone);
  if (!/^\+?[0-9]{8,15}$/.test(phone)) return { error: "em_phone" };
  if (last9(own).length === 9 && last9(phone) === last9(own)) return { error: "em_self" };
  if (last9(other).length === 9 && last9(phone) === last9(other)) return { error: "em_same" };
  if (!(EM_RELS as readonly string[]).includes(f.rel)) return { error: "em_relation" };
  return { contact: { name, phone, rel: f.rel as EmRel } };
}

/**
 * Both contacts: the first required, the second when any of its boxes is filled (then all three).
 * A problem names which contact it is about (1 or 2).
 */
export function emReadBoth(one: EmFields, two: EmFields | null, own: string):
  { first: EmContact; second: EmContact | null } | { error: EmError; which: 1 | 2 } {
  const a = emRead(one, own);
  if ("error" in a) return { error: a.error, which: 1 };
  if (!two || emBlank(two)) return { first: a.contact, second: null };
  const b = emRead(two, own, a.contact.phone);
  if ("error" in b) return { error: b.error, which: 2 };
  return { first: a.contact, second: b.contact };
}

/** The database's refusal of a contact (BAD_INPUT, its detail em_name ... em_same; em_required: a
 *  blank first contact), as the form's problem; null for anything else. Takes PostgREST's details
 *  or a message that carries them. */
export function emRefusal(e: { details?: unknown; message?: unknown } | null | undefined): EmError | null {
  const d = String(e?.details ?? ""), m = String(e?.message ?? "");
  const code = /^em_[a-z]+$/.test(d) ? d : (/\bem_(name|phone|relation|self|same|required)\b/.exec(m)?.[0] ?? "");
  if (code === "em_required") return "em_name";
  return code === "em_name" || code === "em_phone" || code === "em_relation" || code === "em_self" || code === "em_same" ? code : null;
}

/** A PostgREST answer for a function the database does not have yet (PGRST202): the migration is not
 *  applied, and the rider is let through. */
export const emAbsent = (e: { code?: unknown; message?: unknown; status?: number } | null | undefined) =>
  !!e && (String(e.code ?? "") === "PGRST202" || /could not find the function/i.test(String(e.message ?? "")));

/** customer_emergency's row as the pages hold it: whether the first contact is there, and whether the
 *  database has a second one to offer (a database from before 2026-10-07 answers three columns). */
export function emState(row: unknown): { has: boolean; two: boolean } {
  const r = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
  const s = (k: string) => typeof r?.[k] === "string" && (r[k] as string).trim() !== "";
  return { has: !!r && s("emergency_name") && s("emergency_phone") && s("emergency_relation"), two: !r || "emergency2_name" in r };
}

export type DialOption = { value: string; label: string };
/**
 * The dial codes as a picker lists them: the Gulf's six first (Saudi Arabia at the top), then every
 * other country by its name in the page's language (each labelled "+966 Saudi Arabia": the closed box shows the code first), Saudi Arabia again in its place (the owner's
 * rule, 2026-10-05); never Israel. Each option is a code ("+966"); a code two countries share (+1,
 * +7) is listed under each, and a select with that value shows the first. Labels are the browser's
 * own names for the regions, so it is built in the browser only.
 */
export function dialOptions(locale: string): DialOption[] {
  const intl = localeInfo(locale).intl;
  let names: Intl.DisplayNames | null = null;
  if (locale !== "en") {
    try { names = new Intl.DisplayNames([intl], { type: "region" }); } catch { /* the English names stand */ }
  }
  const label = (iso: string, name: string) => (locale === "en" ? name : (locale === "ar" && COUNTRY_AR[name]) || names?.of(iso) || name);
  const opt = ([code, iso, name]: readonly [string, string, string]) => ({ value: code, label: `${code} ${label(iso, name)}` });
  const gulf = DIAL_CODES.slice(0, 6).map(opt);
  const rest = [...DIAL_CODES.slice(6), DIAL_CODES[0]].map(opt);
  try { rest.sort((a, b) => a.label.localeCompare(b.label, intl)); } catch { /* code order */ }
  return [...gulf, ...rest];
}
