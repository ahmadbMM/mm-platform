import { cleanName, nameOk, namePartsOk, normalizePhone } from "./rpc-client";
import { NATIONALITIES } from "@/content/nationalities";

// The Learn to ride sign-up (components/learn/LearnForm.tsx, at /experiences/learn): what the form
// checks before it sends, and what it sends to learn_apply(). The database checks everything again
// and answers with the same error codes - a learner's with that learner's place in the list
// (`index`, from 0) - so one set of messages covers both. One sign-up carries 1 to 5 learners (the
// owner, 2026-09-28: a family signs up together), each one:
//   - who: "self" (the person signing up, at most once - their name, age, gender and height are
//     the contact's own, from their details), "child" or "other", another adult - any age up to 99
//     (the owner, 2026-09-28: no minimum);
//   - a name for a child or another adult - letters, marks, spaces and periods, every part at
//     least two letters, 60 at most (a child's first name is enough) - never the same one twice;
//   - male or female, 80 to 250 cm tall, and how much riding so far (the form does not ask when
//     suits them: staff pick the lesson's time).
// And the person signing up (the contact): first and last name - the same letters rule, 120 at
// most - because staff turn a new person into a booking app account, whose names follow it; what
// the community form asks (the owner, 2026-09-28: for that account): a date of birth (never in the
// future, at most 99 years ago), gender, nationality (the booking app's list), height (80 to 250),
// profession and workplace (the owner, 2026-09-29: the company they work for, labelled Company, 2 to
// 120 characters, checked as profession is), and Instagram and LinkedIn, which may be left empty (the form does not say so);
// a Saudi mobile as +9665XXXXXXXX, any other country as +<8 to 15 digits>; an email; how they
// heard of us (one of HEARD, required: asked here and on the community form, no longer at the
// booking app's sign-up); notes up to 600 characters; ride news, yes or no; and the version of the
// Privacy Notice they confirmed. The bike type the community form asks is not asked: the account's
// preference is 'Any'.

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

/** The ages a learner may be, whoever they are (the owner, 2026-09-28: no minimum, 99 at most). */
export const AGE = [1, 99] as const;
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

/** The form as the visitor filled it in: the learners, then the person signing up. `birth` is
 *  the date of birth as YYYY-MM-DD, "" until the day, month and year are all chosen. */
export type LearnFields = {
  learners: readonly LearnerFields[];
  name: string;
  birth: string;
  gender: Gender | "";
  nationality: string;
  height: string;
  phone: string;
  email: string;
  instagram: string;
  linkedin: string;
  profession: string;
  workplace: string;
  heard: Heard | "";
  notes: string;
  privacy: boolean;
  news: boolean;
};

/** learn_apply()'s error codes for what was filled in (it also answers "throttled"): a learner's
 *  own, with their place in the list, and the sign-up's. "learners" is the list itself - none, more
 *  than five, "self" twice or the same learner twice (the form names the card for the last two). */
export type LearnerError = "learner_who" | "learner_name" | "learner_age" | "learner_gender" | "learner_height" | "level";
export type PersonError = "name" | "birth_date" | "gender" | "nationality" | "height" | "phone" | "email" | "instagram" | "linkedin" | "profession" | "workplace" | "heard_from" | "notes" | "privacy";
export type LearnProblem = { error: LearnerError; index: number } | { error: "learners"; index?: number } | { error: PersonError; index?: undefined };

/** One learner, as learn_apply() reads them. */
export type LearnerPayload = { who: Who; name: string; age: number; gender: Gender; height: number; level: Level };

/** learn_apply()'s argument, p. */
export type LearnPayload = {
  name: string;
  birth_date: string;
  gender: Gender;
  nationality: string;
  height: number;
  email: string;
  phone: string;
  instagram: string;
  linkedin: string;
  profession: string;
  workplace: string;
  heard_from: Heard;
  notes: string;
  ride_news: boolean;
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

/** A pasted Instagram link or @handle becomes the bare handle the booking app stores (the
 *  community form's igNorm). */
export function igNorm(raw: string): string {
  return raw.trim().replace(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\//i, "").replace(/[?#].*$/, "").replace(/^[@/\s]+|[/\s]+$/g, "").slice(0, 100);
}
/** A pasted LinkedIn profile link becomes its bare name (the community form's liNorm). */
export function liNorm(raw: string): string {
  let v = raw.trim().replace(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.|m\.|mobile\.)?linkedin\.com\//i, "").replace(/[?#].*$/, "").replace(/^[@/\s]+|[/\s]+$/g, "");
  if (/^in\//i.test(v)) v = v.slice(3);
  try { v = encodeURIComponent(decodeURIComponent(v)).replace(/%2F/gi, "/"); } catch { /* keep it as typed */ }
  return v.slice(0, 100);
}
const igOk = (v: string) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v);
const liOk = (v: string) => v === "" || /^[A-Za-z0-9._%-]{3,100}$/.test(v);
const NATIONALITY_NAMES = new Set(NATIONALITIES.map((n) => n[1]));
/** Today in Riyadh, as YYYY-MM-DD: the day the database checks a date of birth against. */
export const riyadhToday = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
/** A person's age in whole years on `today` (both YYYY-MM-DD), or null for a date that is not one. */
export function ageOn(birth: string, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth), t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m || !t) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const real = new Date(Date.UTC(y, mo - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d) return null; // 31 February
  let age = +t[1] - y;
  if (+t[2] < mo || (+t[2] === mo && +t[3] < d)) age--;
  return age;
}

/** A learner's name as the database takes it (a child's, another adult's): the site's name rule, 60 at most. */
const learnerNameOk = (n: string) => chars(n) <= 60 && nameOk(n) && namePartsOk(n);

/** One learner checked field by field, in the card's order; `before` are the cards above it, for
 *  "self" twice and the same learner twice. */
function learner(l: LearnerFields, index: number, before: readonly LearnerPayload[], me: { age: number; gender: Gender; height: number } | null): LearnProblem | LearnerPayload {
  if (!oneOf(WHO, l.who)) return { error: "learner_who", index };
  if (l.who === "self" && before.some((b) => b.who === "self")) return { error: "learners", index };
  const name = l.who === "self" ? "" : cleanName(l.name);
  if (l.who !== "self" && !learnerNameOk(name)) return { error: "learner_name", index };
  if (l.who !== "self" && before.some((b) => b.who === l.who && b.name.toLowerCase() === name.toLowerCase())) return { error: "learners", index };
  // "Me" is the person signing up: their own age, gender and height, from their details.
  if (l.who === "self" && me) {
    if (!oneOf(LEVELS, l.level)) return { error: "level", index };
    return { who: "self", name, age: me.age, gender: me.gender, height: me.height, level: l.level };
  }
  const age = wholeNumber(l.age);
  if (age === null || age < AGE[0] || age > AGE[1]) return { error: "learner_age", index };
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
export function learnPayload(f: LearnFields, lang: string, privacyVersion: string, today: string = riyadhToday()): LearnProblem | { payload: LearnPayload } {
  if (f.learners.length < 1 || f.learners.length > MAX_LEARNERS) return { error: "learners" };
  // The person's own age, gender and height, for a "Me" card: checked with their details below, so
  // here only taken when they are already right.
  const myAge = ageOn(f.birth, today), myHeight = wholeNumber(f.height);
  const me = myAge !== null && myAge >= AGE[0] && myAge <= AGE[1] && oneOf(GENDERS, f.gender) && myHeight !== null && myHeight >= HEIGHT[0] && myHeight <= HEIGHT[1]
    ? { age: myAge, gender: f.gender, height: myHeight } : null;
  const learners: LearnerPayload[] = [];
  for (const [i, l] of f.learners.entries()) {
    if (l.who === "self" && !me) {
      // Their card is fine but for what their details below still lack: that is where the message goes.
      if (learners.some((b) => b.who === "self")) return { error: "learners", index: i };
      if (!oneOf(LEVELS, l.level)) return { error: "level", index: i };
      learners.push({ who: "self", name: "", age: 0, gender: "male", height: 0, level: l.level });
      continue;
    }
    const r = learner(l, i, learners, me);
    if ("error" in r) return r;
    learners.push(r);
  }
  const name = cleanName(f.name);
  if (chars(name) > 120 || !/\s/.test(name) || !nameOk(name) || !namePartsOk(name)) return { error: "name" };
  const age = ageOn(f.birth, today);
  if (age === null || f.birth > today || age > AGE[1]) return { error: "birth_date" };
  if (!oneOf(GENDERS, f.gender)) return { error: "gender" };
  if (!NATIONALITY_NAMES.has(f.nationality)) return { error: "nationality" };
  const height = wholeNumber(f.height);
  if (height === null || height < HEIGHT[0] || height > HEIGHT[1]) return { error: "height" };
  if (learners.some((l) => l.who === "self") && age < AGE[0]) return { error: "birth_date" };
  const phone = normalizePhone(f.phone);
  if (!phoneOk(phone)) return { error: "phone" };
  const email = f.email.trim().toLowerCase();
  if (!emailOk(email)) return { error: "email" };
  const instagram = igNorm(f.instagram), linkedin = liNorm(f.linkedin);
  if (!igOk(instagram)) return { error: "instagram" };
  if (!liOk(linkedin)) return { error: "linkedin" };
  const profession = f.profession.trim().replace(/\s+/g, " ");
  if (chars(profession) < 2 || chars(profession) > 80 || !/\p{L}/u.test(profession) || /[<>"`{}]/.test(profession)) return { error: "profession" };
  const workplace = f.workplace.trim().replace(/\s+/g, " ");
  if (chars(workplace) < 2 || chars(workplace) > 120 || !/\p{L}/u.test(workplace) || /[<>"`{}]/.test(workplace)) return { error: "workplace" };
  if (!oneOf(HEARD, f.heard)) return { error: "heard_from" };
  const notes = f.notes.trim();
  if (chars(notes) > NOTES_MAX) return { error: "notes" };
  if (!f.privacy || !/^\d{4}-\d{2}-\d{2}$/.test(privacyVersion)) return { error: "privacy" };
  // "Me" takes the person's own age, gender and height (the database does the same).
  const all = learners.map((l) => (l.who === "self" ? { ...l, age, gender: f.gender as Gender, height } : l));
  return { payload: { name, birth_date: f.birth, gender: f.gender, nationality: f.nationality, height, email, phone, instagram, linkedin, profession, workplace,
    heard_from: f.heard, notes, ride_news: f.news, lang: /^[a-z]{2}$/.test(lang) ? lang : "en", privacy_version: privacyVersion, learners: all } };
}
