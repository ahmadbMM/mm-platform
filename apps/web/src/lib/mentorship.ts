// The Mentorship programme on /club (the booking app's member-hub.js Mentorship block, rentals da0602c2 and migrations
// 20261114050000, 20261118120000): what mentor_feed hands a signed-in Community member, and what the two forms and the
// answers send (app/api/account/mentor). The user, 2026-11-13: "create a mentorship program exclusively for community
// members, we put anonymous profiles of students ... and let community members who have knowledge or can help choose the
// profile they can help and we match them and make them contact with them"; 2026-11-18: "i want mentees to be anonymous,
// only show their university and major". So another member's profile is its number, university and field and nothing
// else; a first name and a WhatsApp number cross only an accepted match (the user's own exception to "members see nobody").
// Plain logic, so it can be tested; components/club/Mentorship.tsx draws it.

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/** What a student may want and a mentor may give (MT_HELPS), and how a mentor knows the path (MT_LINKS). */
export const MT_HELPS = ["questions", "subjects", "cv", "internship", "job", "unilife", "city", "talk"] as const;
export type MtHelp = (typeof MT_HELPS)[number];
export const MT_LINKS = ["uni", "field", "city", "industry", "experience"] as const;
export type MtLink = (typeof MT_LINKS)[number];
/** The offer form leaves "Same city" out: a mentee's city reaches staff only (2026-11-18). */
export const MT_OFFER_LINKS = MT_LINKS.filter((k) => k !== "city");
export const MT_CHECKS = ["yes", "not_yet", "help"] as const;
export type MtCheck = (typeof MT_CHECKS)[number];
const helps = (v: unknown): MtHelp[] => arr(v).map(S).filter((k): k is MtHelp => (MT_HELPS as readonly string[]).includes(k));
const links = (v: unknown): MtLink[] => arr(v).map(S).filter((k): k is MtLink => (MT_LINKS as readonly string[]).includes(k));

export type MtMatch = { id: string; name: string; wa: string; due: boolean; summary: string; links: MtLink[] };
export type MtProposed = { id: string; summary: string; links: MtLink[]; helps: MtHelp[] };
export type MtAsk = {
  num: number | null; status: "pending" | "open" | "matched"; university: string; field: string; city: string; country: string; classYear: number;
  helps: MtHelp[]; goal: string; genderPref: "any" | "female" | "male"; proposed: MtProposed[]; matches: MtMatch[];
};
export type MtMentor = { university: string; field: string; work: string; places: string; helps: MtHelp[]; about: string };
export type MtProfile = { num: number; university: string; field: string; offered: "offered" | "proposed" | "matched" | null };
export type MtOffer = { id: string; num: number; university: string; field: string; status: "offered" | "proposed" | "matched" | "declined" | "ended"; name: string; wa: string; due: boolean };
export type MtFeed = { ask: MtAsk | null; mentor: MtMentor | null; profiles: MtProfile[]; offers: MtOffer[] };

const OFFER_ST = new Set(["offered", "proposed", "matched", "declined", "ended"]);
const wa = (v: unknown) => S(v).replace(/\D/g, "").slice(0, 16);

/** mentor_feed's answer, read; null for a refusal, a database without the programme, or no answer (no card). */
export function mentorFeedOf(r: { status: number; data: unknown }): MtFeed | null {
  const d = r.status === 200 ? obj(r.data) : null;
  if (!d || d.ok !== true) return null;
  const a = obj(d.ask);
  const st = S(a?.status);
  const ask: MtAsk | null = a && (st === "pending" || st === "open" || st === "matched") ? {
    num: N(a.num) > 0 ? Math.round(N(a.num)) : null, status: st, university: S(a.university), field: S(a.field), city: S(a.city), country: S(a.country),
    classYear: Math.round(N(a.class_year)), helps: helps(a.helps), goal: S(a.goal),
    genderPref: a.gender_pref === "female" || a.gender_pref === "male" ? a.gender_pref : "any",
    proposed: arr(a.proposed).map(obj).filter((x): x is Record<string, unknown> => !!x && !!S(x.id))
      .map((x) => ({ id: S(x.id), summary: S(x.summary), links: links(x.links), helps: helps(x.helps) })),
    matches: arr(a.matches).map(obj).filter((x): x is Record<string, unknown> => !!x && !!S(x.id))
      .map((x) => ({ id: S(x.id), name: S(x.name), wa: wa(x.wa), due: x.due === true, summary: S(x.summary), links: links(x.links) })),
  } : null;
  const m = obj(d.mentor);
  const mentor: MtMentor | null = m ? { university: S(m.university), field: S(m.field), work: S(m.work), places: S(m.places), helps: helps(m.helps), about: S(m.about) } : null;
  const profiles = arr(d.profiles).map(obj).filter((x): x is Record<string, unknown> => !!x && N(x.num) > 0)
    .map((x): MtProfile => ({ num: Math.round(N(x.num)), university: S(x.university), field: S(x.field),
      offered: x.offered === "offered" || x.offered === "proposed" || x.offered === "matched" ? x.offered : null }));
  const offers = arr(d.offers).map(obj).filter((x): x is Record<string, unknown> => !!x && !!S(x.id) && OFFER_ST.has(S(x.status)))
    .map((x): MtOffer => ({ id: S(x.id), num: Math.round(N(x.num)), university: S(x.university), field: S(x.field), status: S(x.status) as MtOffer["status"],
      name: S(x.name), wa: wa(x.wa), due: x.due === true }));
  return { ask, mentor, profiles, offers };
}

/** What waits for the member first (the app's _mtDue): a "Still in touch?" check due on a match, on either side. */
export function mtDue(d: MtFeed): { name: string }[] {
  return [...(d.ask?.matches ?? []).filter((x) => x.due), ...d.offers.filter((x) => x.status === "matched" && x.due)];
}

/** The card's alert (the app's _mtCardHtml): an offer to answer, else a check due ({0} the match's first name), else none. */
export function mtAlert(d: MtFeed): { k: "offered" } | { k: "check"; name: string } | null {
  if (d.ask && d.ask.proposed.length) return { k: "offered" };
  const due = mtDue(d);
  return due.length ? { k: "check", name: due[0].name } : null;
}

/** The forms' checks, as the app's _mtCheckForm makes them before anything is sent; each failing field with what it says. */
export type MtAskForm = { university: string; field: string; city: string; country: string; classYear: number; helps: string[]; goal: string; genderPref: string; ok: boolean };
export type MtJoinForm = { university: string; field: string; work: string; places: string; helps: string[]; about: string; ok: boolean };
export type MtOfferForm = { num: number; links: string[]; helps: string[]; note: string };
export type MtFieldErr = Record<string, "mtFill" | "mtPickOne" | "mtTick">;
export function checkAsk(f: MtAskForm): MtFieldErr {
  const e: MtFieldErr = {};
  if (f.university.trim().length < 2) e.uni = "mtFill";
  if (f.field.trim().length < 2) e.field = "mtFill";
  if (!f.city.trim()) e.city = "mtFill";
  if (!f.country) e.country = "mtFill";
  if (!f.helps.length) e.want = "mtPickOne";
  if (!f.ok) e.ok = "mtTick";
  return e;
}
export function checkJoin(f: MtJoinForm): MtFieldErr {
  const e: MtFieldErr = {};
  if (f.university.trim().length < 2) e.muni = "mtFill";
  if (f.field.trim().length < 2) e.mfield = "mtFill";
  if (!f.helps.length) e.mhelps = "mtPickOne";
  if (!f.about.trim()) e.mabout = "mtFill";
  if (!f.ok) e.ok = "mtTick";
  return e;
}
export function checkOffer(f: MtOfferForm): MtFieldErr {
  const e: MtFieldErr = {};
  if (!f.links.length) e.links = "mtPickOne";
  if (!f.helps.length) e.helps = "mtPickOne";
  if (!f.note.trim()) e.note = "mtFill";
  return e;
}

/** The years a request offers (the app's _mtAskOpen): last year to three years on, and the year a waiting request holds. */
export function askYears(thisYear: number, held: number): number[] {
  const ys = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2, thisYear + 3];
  if (held && !ys.includes(held)) { ys.push(held); ys.sort((p, q) => p - q); }
  return ys;
}

/** What /api/account/mentor sends the database for each act, from what the page posted: the function and its arguments
 *  (besides the account's id and token), or null for a request it does not take. Lengths and lists are cut as the
 *  database takes them; the database checks everything again. */
const txt = (v: unknown, max: number) => S(v).trim().slice(0, max);
const list = <T extends string>(v: unknown, all: readonly T[]) => [...new Set(arr(v).map(S).filter((k): k is T => (all as readonly string[]).includes(k)))];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
export function mentorCall(b: Record<string, unknown>): { fn: string; args: Record<string, unknown> } | null {
  switch (b.act) {
    case "ask": {
      const y = Math.round(N(b.classYear));
      const pref = b.genderPref === "female" || b.genderPref === "male" ? b.genderPref : "any";
      const country = /^[A-Z]{2}$/.test(S(b.country)) ? S(b.country) : "";
      return { fn: "mentor_ask", args: { p_university: txt(b.university, 100), p_field: txt(b.field, 100), p_city: txt(b.city, 60), p_country: country,
        p_class_year: y, p_helps: list(b.helps, MT_HELPS), p_goal: txt(b.goal, 200) || null, p_gender_pref: pref, p_ok: b.ok === true } };
    }
    case "join":
      return { fn: "mentor_join", args: { p_university: txt(b.university, 160), p_field: txt(b.field, 120), p_work: txt(b.work, 120) || null,
        p_places: txt(b.places, 160) || null, p_helps: list(b.helps, MT_HELPS), p_about: txt(b.about, 500), p_ok: b.ok === true } };
    case "offer": {
      const num = Math.round(N(b.num));
      return num > 0 ? { fn: "mentor_offer", args: { p_num: num, p_links: list(b.links, MT_OFFER_LINKS), p_helps: list(b.helps, MT_HELPS), p_note: txt(b.note, 500) } } : null;
    }
    case "quit": return { fn: "mentor_quit", args: {} };
    case "answer": return ID.test(S(b.offer)) && typeof b.yes === "boolean" ? { fn: "mentor_answer", args: { p_offer: S(b.offer), p_yes: b.yes } } : null;
    case "leave": return b.offer === null || ID.test(S(b.offer)) ? { fn: "mentor_leave", args: { p_offer: b.offer === null ? null : S(b.offer) } } : null;
    case "check": return ID.test(S(b.offer)) && (MT_CHECKS as readonly string[]).includes(S(b.answer)) ? { fn: "mentor_check", args: { p_offer: S(b.offer), p_answer: S(b.answer) } } : null;
    default: return null;
  }
}

/** A refusal in the member's words (the app's _mtErrMsg). */
export function mtErrKey(e: string): "mtGone" | "mtExists" | "mtLimit" | "err" {
  return e === "gone" || e === "own" ? "mtGone" : e === "exists" ? "mtExists" : e === "limit" ? "mtLimit" : "err";
}
