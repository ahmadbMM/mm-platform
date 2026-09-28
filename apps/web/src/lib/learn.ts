import { cleanName, nameOk, namePartsOk, normalizePhone } from "./rpc-client";

// The Learn to ride sign-up (components/learn/LearnForm.tsx, at /experiences/learn): what the form
// checks before it sends, and what it sends to learn_apply(). The database checks everything again
// and answers with the same error codes - a learner's with that learner's place in the list
// (`index`, from 0) - so one set of messages covers both. One sign-up carries 1 to 5 learners (the
// owner, 2026-09-28: a family signs up together), each one:
//   - who: "self" (the person signing up, at most once - their name is the contact's, so none is
//     sent), "child" (3 to 17) or "other", another adult (12 to 99, like "self");
//   - a name for a child or another adult - letters, marks, spaces and periods, every part at
//     least two letters, 60 at most (a child's first name is enough) - never the same one twice;
//   - male or female, 80 to 250 cm tall, and how much riding so far (the form does not ask when
//     suits them: staff pick the lesson's time).
// And the person signing up (the contact): first and last name - the same letters rule, 120 at
// most - because staff turn a new person into a booking app account, whose names follow it; a
// Saudi mobile as +9665XXXXXXXX, any other country as +<8 to 15 digits>; an email; how they heard
// of us (one of HEARD, required: the owner, 2026-09-28 - asked here and on the community form, no
// longer at the booking app's sign-up); notes up to 600 characters, and the version of the
// Privacy Notice they confirmed.

export const WHO = ["self", "child", "other"] as const;
export const GENDERS = ["male", "female"] as const;
export const LEVELS = ["never", "tried", "refresh"] as const;
/** How they heard of us: customers.heard_from's codes (the booking app's HEARD_OPTS), which the
 *  database checks too; 'desk' is the booking desk's own and never offered. */
export const HEARD = ["instagram", "tiktok", "snapchat", "x", "facebook", "youtube", "whatsapp", "google", "friend", "invited", "passed_by", "event", "hotel", "school", "work", "community", "other"] as const;
export type Who = (typeof WHO)[number];
export type Gender = (typeof GENDERS)[number];
export type Level = (typeof LEVELS)[number];
export type Heard = (typeof HEARD)[number];

/** The ages a learner may be: from 12 they sign up themselves or as another adult, younger through a parent. */
export const AGES: Record<Who, readonly [number, number]> = { self: [12, 99], child: [3, 17], other: [12, 99] };
export const HEIGHT = [80, 250] as const;
export const NOTES_MAX = 600;
export const MAX_LEARNERS = 5;

/** One learner as the visitor filled in their card: the boxes as typed, the choices as their codes ("" for none). */
export type LearnerFields = {
  who: Who | "";
  name: string;
  age: string;
  gender: Gender | "";
  height: string;
  level: Level | "";
};

/** The form as the visitor filled it in: the learners, then the person signing up. */
export type LearnFields = {
  learners: readonly LearnerFields[];
  name: string;
  phone: string;
  email: string;
  heard: Heard | "";
  notes: string;
  privacy: boolean;
};

/** learn_apply()'s error codes for what was filled in (it also answers "throttled"): a learner's
 *  own, with their place in the list, and the sign-up's. "learners" is the list itself - none, more
 *  than five, "self" twice or the same learner twice (the form names the card for the last two). */
export type LearnerError = "learner_who" | "learner_name" | "learner_age" | "learner_gender" | "learner_height" | "level";
export type LearnProblem = { error: LearnerError; index: number } | { error: "learners"; index?: number } | { error: "name" | "phone" | "email" | "heard_from" | "notes" | "privacy"; index?: undefined };

/** One learner, as learn_apply() reads them. */
export type LearnerPayload = { who: Who; name: string; age: number; gender: Gender; height: number; level: Level };

/** learn_apply()'s argument, p. */
export type LearnPayload = {
  name: string;
  email: string;
  phone: string;
  heard_from: Heard;
  notes: string;
  lang: string;
  privacy_version: string;
  learners: LearnerPayload[];
};

const chars = (s: string) => [...s].length; // as the database counts them: code points
const oneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

/** A whole number typed in any of the digits a phone offers (Arabic-Indic and Persian included),
 *  with nothing else in the box; else null. "1.65" is not a height in centimetres. */
export function wholeNumber(raw: string): number | null {
  const d = raw.trim()
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
  return /^\d{1,3}$/.test(d) ? Number(d) : null;
}

/** An email the database takes (after lower-casing). */
export const emailOk = (e: string) => e.length <= 254 && /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(e);
/** A mobile, as normalizePhone leaves it, that the database takes. */
export const phoneOk = (p: string) => /^\+[1-9]\d{7,14}$/.test(p) && (!p.startsWith("+966") || /^\+9665\d{8}$/.test(p));

/** A learner's name as the database takes it (a child's, another adult's): the site's name rule, 60 at most. */
const learnerNameOk = (n: string) => chars(n) <= 60 && nameOk(n) && namePartsOk(n);

/** One learner checked field by field, in the card's order; `before` are the cards above it, for
 *  "self" twice and the same learner twice. */
function learner(l: LearnerFields, index: number, before: readonly LearnerPayload[]): LearnProblem | LearnerPayload {
  if (!oneOf(WHO, l.who)) return { error: "learner_who", index };
  if (l.who === "self" && before.some((b) => b.who === "self")) return { error: "learners", index };
  const name = l.who === "self" ? "" : cleanName(l.name);
  if (l.who !== "self" && !learnerNameOk(name)) return { error: "learner_name", index };
  if (l.who !== "self" && before.some((b) => b.who === l.who && b.name.toLowerCase() === name.toLowerCase())) return { error: "learners", index };
  const age = wholeNumber(l.age), [young, old] = AGES[l.who];
  if (age === null || age < young || age > old) return { error: "learner_age", index };
  if (!oneOf(GENDERS, l.gender)) return { error: "learner_gender", index };
  const height = wholeNumber(l.height);
  if (height === null || height < HEIGHT[0] || height > HEIGHT[1]) return { error: "learner_height", index };
  if (!oneOf(LEVELS, l.level)) return { error: "level", index };
  return { who: l.who, name, age, gender: l.gender, height, level: l.level };
}

/**
 * The sign-up checked in the form's own order - every learner's card from the first, then the
 * person signing up - so the one message shown is about the first thing to fix; and, when all is
 * well, learn_apply()'s argument. `lang` is the page's language (its two-letter code),
 * `privacyVersion` the Privacy Notice the box confirms.
 */
export function learnPayload(f: LearnFields, lang: string, privacyVersion: string): LearnProblem | { payload: LearnPayload } {
  if (f.learners.length < 1 || f.learners.length > MAX_LEARNERS) return { error: "learners" };
  const learners: LearnerPayload[] = [];
  for (const [i, l] of f.learners.entries()) {
    const r = learner(l, i, learners);
    if ("error" in r) return r;
    learners.push(r);
  }
  const name = cleanName(f.name);
  if (chars(name) > 120 || !/\s/.test(name) || !nameOk(name) || !namePartsOk(name)) return { error: "name" };
  const phone = normalizePhone(f.phone);
  if (!phoneOk(phone)) return { error: "phone" };
  const email = f.email.trim().toLowerCase();
  if (!emailOk(email)) return { error: "email" };
  if (!oneOf(HEARD, f.heard)) return { error: "heard_from" };
  const notes = f.notes.trim();
  if (chars(notes) > NOTES_MAX) return { error: "notes" };
  if (!f.privacy || !/^\d{4}-\d{2}-\d{2}$/.test(privacyVersion)) return { error: "privacy" };
  return { payload: { name, email, phone, heard_from: f.heard, notes, lang: /^[a-z]{2}$/.test(lang) ? lang : "en", privacy_version: privacyVersion, learners } };
}
