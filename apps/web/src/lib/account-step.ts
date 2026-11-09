// The account step the account forms share (the owner, 2026-10-25: "one shared sign-in and account step"), typed
// for the website. The rules live once, in forms/shared/account.js: the community form and the Defe page inline
// that file, and their builds write it here as ./account-shared.ts (CI rebuilds the forms and refuses a stale copy).
// The Learn to ride form signs in through /api/account (its Turnstile check and the temporary-password step); it
// takes from here what a typed email or mobile becomes and which questions a signed-in account is asked.
import MMAccount from "./account-shared";

/** A signed-in account's questions: `skip` the account answers already (and staff did not flag), `ask` the rest,
 *  `flagged` the ones staff asked to be checked again (customers.fix_fields, customer_community_me's `flags`). */
export type AccountPlan = { skip: string[]; ask: string[]; flagged: string[] };

/** What customer_community_me() answers about an account, as far as the plan reads it. */
export type AccountAnswers = {
  whatsapp_same?: boolean | null; whatsapp?: string | null; birth_date?: string | null; nationality?: string | null;
  instagram?: string | null; linkedin?: string | null; profession?: string | null; workplace?: string | null;
  own_bike?: boolean | null; bike_type?: string | null; heard_from?: string | null; height?: number | null; gender?: string | null;
  flags?: string[] | null;
};

export function accountPlan(me: AccountAnswers | null, keys?: string[]): AccountPlan {
  return MMAccount.plan(me, keys) as AccountPlan;
}

/** What customer_login() takes for what was typed: an email in lower case, or a mobile in E.164 (+966 when it has
 *  no code). */
export function signinIdent(raw: string): string {
  return MMAccount.ident(raw) as string;
}

/** Whether the answer to a question staff flagged is what the account already holds (the owner, 2026-11-09: "don't
 *  allow a flagged account field to type in the same info in the field again"), by the booking app's rule: words with
 *  their spaces tidied, an email in any case, a number by its last nine digits, a handle in any case and without its
 *  @, the rest exactly; an empty answer never. `key` is customers.fix_fields' name; `answer` a string, {same, phone}
 *  for whatsapp, {name, phone, relation} for an emergency contact; `held` customer_community_me's names, the
 *  emergency contacts as {name, phone, relation}. */
export function sameAsHeld(key: string, answer: unknown, held: Record<string, unknown> | null): boolean {
  return MMAccount.same(key, answer, held) as boolean;
}
