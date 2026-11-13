// The Helper path on My Account, as the booking app draws it (new features build F23, 2026-11-13; rentals migration
// 20261114082300; helper-path.js _hpOwn, HP_LADDER): a community member's own step on the path rider, helper, trainee ride
// leader, ride leader (the path title staff gave them) and their helper days (the days of the volunteer shifts they
// attended). customer_helper_path answers about its caller alone, so no other member's step or days is ever read.

/** The four steps, rider first (HP_STEPS): the words' keys in HelperPath.words.ts. */
export const HP_STEPS = ["s0", "s1", "s2", "s3"] as const;
/** The helper-day ladder (HP_LADDER): [days, its words' key, the medal's colour], in the style of the rides-led ladder.
 *  Counted here from the days, not a badge of the badges table. */
export const HP_LADDER: readonly (readonly [number, "b1" | "b5" | "b10" | "b25", string])[] = [[1, "b1", "green"], [5, "b5", "teal"], [10, "b10", "purple"], [25, "b25", "gold"]];

export type HelperPath = { step: number; days: number };

/** What the card shows from customer_helper_path's answer {ok, member, step, days}: the step held in 0..3 and whole helper
 *  days, never below zero (_hpOwn). Null, and nothing drawn, for an account that is not a member, a refused token, a
 *  database without the function or a read that failed (`ok` true and `member` true, as _hpMineLoad asks). */
export function helperPathOf(data: unknown): HelperPath | null {
  const d = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  if (!d || d.ok !== true || d.member !== true) return null;
  return {
    step: Math.max(0, Math.min(HP_STEPS.length - 1, Math.floor(Number(d.step) || 0))),
    days: Math.max(0, Math.floor(Number(d.days) || 0)),
  };
}
