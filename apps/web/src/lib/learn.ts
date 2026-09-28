import { cleanName, nameOk, namePartsOk, normalizePhone } from "./rpc-client";

// The Learn to ride sign-up (components/learn/LearnForm.tsx, at /experiences/learn): what the form
// checks before it sends, and what it sends to learn_apply(). The database checks everything again
// and answers with the same error codes, so one set of messages covers both. Its rules:
//   - the person signing up (the learner, or a child's parent): first and last name - letters,
//     marks, spaces and periods, every part at least two letters, 120 at most - because staff turn
//     a new person into a booking app account, whose names follow the same rule;
//   - a Saudi mobile as +9665XXXXXXXX, any other country as +<8 to 15 digits>; an email;
//   - the learner: 12 to 99 signing up for themselves, 3 to 17 for a child (a child's first name
//     is enough, 60 at most, the same letters rule); male or female; 80 to 250 cm tall;
//   - how much riding so far (the form does not ask when suits them: staff pick the lesson's time);
//   - notes up to 600 characters, and the version of the Privacy Notice they confirmed.

export const FOR_WHOM = ["self", "child"] as const;
export const GENDERS = ["male", "female"] as const;
export const LEVELS = ["never", "tried", "refresh"] as const;
export type ForWhom = (typeof FOR_WHOM)[number];
export type Gender = (typeof GENDERS)[number];
export type Level = (typeof LEVELS)[number];

/** The ages a learner may be: from 12 they sign up themselves, younger through a parent. */
export const AGES: Record<ForWhom, readonly [number, number]> = { self: [12, 99], child: [3, 17] };
export const HEIGHT = [80, 250] as const;
export const NOTES_MAX = 600;

/** The form as the visitor filled it in: the boxes as typed, the choices as their codes ("" for none). */
export type LearnFields = {
  forWhom: ForWhom | "";
  learnerName: string;
  age: string;
  gender: Gender | "";
  height: string;
  level: Level | "";
  name: string;
  phone: string;
  email: string;
  notes: string;
  privacy: boolean;
};

/** learn_apply()'s error codes for what was filled in (it also answers "throttled"). */
export type LearnError = "for_whom" | "learner_name" | "learner_age" | "learner_gender" | "learner_height" | "level" | "name" | "phone" | "email" | "notes" | "privacy";

/** learn_apply()'s argument, p. */
export type LearnPayload = {
  for_whom: ForWhom;
  name: string;
  email: string;
  phone: string;
  learner_name: string;
  learner_age: number;
  learner_gender: Gender;
  learner_height: number;
  level: Level;
  notes: string;
  lang: string;
  privacy_version: string;
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

/**
 * The sign-up checked in the form's own order, top to bottom, so the one message shown is about
 * the first thing to fix; and, when all is well, learn_apply()'s argument. `lang` is the page's
 * language (its two-letter code), `privacyVersion` the Privacy Notice the box confirms.
 */
export function learnPayload(f: LearnFields, lang: string, privacyVersion: string): { error: LearnError } | { payload: LearnPayload } {
  if (!oneOf(FOR_WHOM, f.forWhom)) return { error: "for_whom" };
  const child = f.forWhom === "child";
  const learner = child ? cleanName(f.learnerName) : "";
  if (child && (chars(learner) > 60 || !nameOk(learner) || !namePartsOk(learner))) return { error: "learner_name" };
  const age = wholeNumber(f.age), [young, old] = AGES[f.forWhom];
  if (age === null || age < young || age > old) return { error: "learner_age" };
  if (!oneOf(GENDERS, f.gender)) return { error: "learner_gender" };
  const height = wholeNumber(f.height);
  if (height === null || height < HEIGHT[0] || height > HEIGHT[1]) return { error: "learner_height" };
  if (!oneOf(LEVELS, f.level)) return { error: "level" };
  const name = cleanName(f.name);
  if (chars(name) > 120 || !/\s/.test(name) || !nameOk(name) || !namePartsOk(name)) return { error: "name" };
  const phone = normalizePhone(f.phone);
  if (!phoneOk(phone)) return { error: "phone" };
  const email = f.email.trim().toLowerCase();
  if (!emailOk(email)) return { error: "email" };
  const notes = f.notes.trim();
  if (chars(notes) > NOTES_MAX) return { error: "notes" };
  if (!f.privacy || !/^\d{4}-\d{2}-\d{2}$/.test(privacyVersion)) return { error: "privacy" };
  return {
    payload: {
      for_whom: f.forWhom, name, email, phone, learner_name: learner, learner_age: age, learner_gender: f.gender, learner_height: height,
      level: f.level, notes, lang: /^[a-z]{2}$/.test(lang) ? lang : "en", privacy_version: privacyVersion,
    },
  };
}
