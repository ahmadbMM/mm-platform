// My interests in a member's area on /club, as the booking app's Community tab has them (member-hub.js _int*, rentals
// 5fa8217f, 2026-11-18; the user: "My interests: the member picks what they want, such as Road rides, night rides, Petromin
// nights, women's sessions or learning. Coming up and Updates then show those first, and staff can aim an Ask page or an
// update at one interest. It can reuse the sport answer every account already has."). The database keeps the keys
// (rentals migration 20261118210300): member_interests_get(p_id, p_token) answers {ok, saved, keys, suggested, offered} -
// saved false until the first save, suggested the ticks its sport answer gives while never saved, offered the keys this
// account may pick ('women' for a female account only) - and member_interests_set(p_id, p_token, p_keys) answers {ok, keys}
// or {ok: false, error}: denied, member (not an active member), keys (a key it does not know), women (the women's key from
// an account that is not female), limit (a 21st save within an hour). An empty list is a save too. Plain logic, so it can
// be tested; components/club/Interests.tsx draws the card and app/api/account/interests saves it.

/** The twelve interests, in the one order the database (_interest_keys), the app (INT_KEYS) and staff (INT_K) share. */
export const INT_KEYS = ["saturday", "circuit", "road", "petromin", "women", "learn", "runs", "races", "swim", "yoga", "farm", "charity"] as const;
export type IntKey = (typeof INT_KEYS)[number];
export const isIntKey = (k: unknown): k is IntKey => (INT_KEYS as readonly unknown[]).includes(k);
/** A list of keys the database knows, once each, in the list's order. */
export const intKeys = (v: unknown): IntKey[] => { const l = Array.isArray(v) ? v : []; return INT_KEYS.filter((k) => l.includes(k)); };

export type Interests = { saved: boolean; keys: IntKey[]; suggested: IntKey[]; offered: IntKey[] };

/** member_interests_get's answer (rpcServer's shape); null draws no card: a refusal, not a member, a database without the
 *  function, or no answer. */
export function interestsOf(r: { status: number; data: unknown }): Interests | null {
  const d = r.status === 200 && r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (!d || d.ok !== true) return null;
  return { saved: d.saved === true, keys: intKeys(d.keys), suggested: intKeys(d.suggested), offered: intKeys(d.offered) };
}

/** What the chips start from when they open: before a first save the sport answer's ticks the account may pick (nothing is
 *  kept until Save), else what was saved. */
export const intDraft = (x: Interests): IntKey[] => (x.saved ? x.keys.slice() : x.suggested.filter((k) => x.offered.includes(k)));

/** The chips offered: every key the account may pick, and any it holds that it no longer may (so it can be taken off). */
export const intChips = (x: Interests, draft: IntKey[]): IntKey[] => INT_KEYS.filter((k) => x.offered.includes(k) || draft.includes(k));

/** A chip's tap: on or off, the list kept in its order. */
export const intToggle = (draft: IntKey[], k: IntKey): IntKey[] => (draft.includes(k) ? draft.filter((x) => x !== k) : INT_KEYS.filter((x) => x === k || draft.includes(x)));

/** What /api/account/interests answered a Save: the keys kept, or why not. */
export type IntAnswer = { ok: true; keys: IntKey[] } | { ok: false; error: string };
export function intAnswer(body: unknown): IntAnswer {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (b?.ok === true) return { ok: true, keys: intKeys(b.keys) };
  return { ok: false, error: typeof b?.error === "string" ? b.error : "generic" };
}

/** The route's reading of what a page posts: {keys: [...]}, 24 at most, each a key the database knows; null for anything else. */
export function intBody(body: unknown): IntKey[] | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!b || !Array.isArray(b.keys) || b.keys.length > 24 || !b.keys.every(isIntKey)) return null;
  return intKeys(b.keys);
}
