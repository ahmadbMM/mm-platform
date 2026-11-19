// My Account > Learn to ride, the learner's own ladder (the booking app's Account > Learn to ride, new features build
// F21, 2026-11-13; learn-ladder.js). A learner on a learn-to-ride sign-up climbs four levels - balance, pedal, steer and
// brake, ride the circuit - whose skills the instructor ticks on the staff page, with one line for the learner. The
// account the sign-up landed on reads its own learners only (learn_ladder, rentals 20261114082100). A skill not ticked
// reads "Practising": nothing is marked failed. A complete level gives a certificate (drawn in the browser); the whole
// ladder shows the way to a Saturday ride. Kept apart from the page so it can be tested.

export const LL_LEVELS = 4;
export type LlSkill = { key: string; level: number; name: Record<string, string> };
export type LlLearner = { who: string; name: string | null; feedback: string; ticked: Record<string, string> };
export type LlLadder = { skills: LlSkill[]; learners: LlLearner[] };
export type LlLevel = { n: number; skills: LlSkill[]; on: number; done: boolean; at: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const S = (v: unknown) => (typeof v === "string" ? v : "");

/** learn_ladder's answer ({ok: true, skills, learners}); null for anything else (no row then, as the app shows none). An
 *  account with no lesson answers no learners: the row stays out too. */
export function ladderOf(raw: unknown): LlLadder | null {
  if (!isObj(raw) || raw.ok !== true || !Array.isArray(raw.skills) || !Array.isArray(raw.learners)) return null;
  const skills = raw.skills.filter(isObj).map((s) => ({
    key: S(s.key), level: Number(s.level) || 0,
    name: isObj(s.name) ? Object.fromEntries(Object.entries(s.name).filter(([, v]) => typeof v === "string")) as Record<string, string> : {},
  })).filter((s) => s.key && s.level >= 1 && s.level <= LL_LEVELS);
  const learners = raw.learners.filter(isObj).map((l) => ({
    who: S(l.who) || "self", name: S(l.name).trim() || null, feedback: S(l.feedback).trim(),
    ticked: isObj(l.ticked) ? Object.fromEntries(Object.entries(l.ticked).filter(([, v]) => typeof v === "string" && v)) as Record<string, string> : {},
  }));
  return { skills, learners };
}

/** A skill's name in the page's language, else in English (the staff wrote them; the app's _llSkName). */
export const skillName = (s: LlSkill, locale: string): string => s.name[locale] || s.name.en || s.key;

/** A learner's name: the account's own for the person who signed up, the sign-up's name for anyone else, else
 *  "Learner 2" (`fallback`, with {0}). */
export function learnerName(l: LlLearner, i: number, own: string, fallback: string): string {
  const n = l.who === "self" ? own : l.name;
  return (n || "").trim() || fallback.replace("{0}", String(i + 1));
}

/** A learner's four levels: each level's skills, how many are ticked, whether all are (complete), and the time its last
 *  tick was given (the certificate's day) - the app's _llLevels. A level with no skills is never complete. */
export function levelsOf(d: LlLadder, l: LlLearner): LlLevel[] {
  const out: LlLevel[] = [];
  for (let n = 1; n <= LL_LEVELS; n++) {
    const skills = d.skills.filter((s) => s.level === n), on = skills.filter((s) => l.ticked[s.key]);
    const done = skills.length > 0 && on.length === skills.length;
    out.push({ n, skills, on: on.length, done, at: done ? on.map((s) => String(l.ticked[s.key])).sort().pop() ?? "" : "" });
  }
  return out;
}

/** The certificate's file name (the app's own). */
export const certFile = (n: number) => `micromobility-learn-to-ride-level-${n}.png`;
