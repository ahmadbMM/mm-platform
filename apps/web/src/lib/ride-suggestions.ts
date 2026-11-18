// Suggest a ride in a member's area on /club, as the booking app's Community tab has it (member-hub.js _rsg*, rentals
// 7aa8a97b, 2026-11-18; the user: "Suggest a ride: a member sends staff a route, a breakfast spot or an idea, and sees only
// their own suggestions, each marked Planned or Done. When one happens, an Updates entry tells them."). The database
// (rentals migration 20261118210500): ride_suggestions_mine(p_id, p_token) answers {ok, rows} - the person's own, newest
// first, at most 50, each {id, kind, body, status: sent | planned | done (a closed one reads as sent), reply, at, day} - and
// ride_suggest(p_id, p_token, p_kind, p_body) answers {ok, row} or {ok: false, error}: denied, member (not an active
// member), invalid (a kind it does not know, or a text outside 3 to 500 characters), day (3 in 24 hours), open (10 still
// new). Nobody else's suggestion ever reaches a member. Plain logic, so it can be tested; components/club/SuggestRide.tsx
// draws it and app/api/account/suggestions sends it.

/** The four kinds, in the app's order (RSG_KINDS), with the icon each wears. */
export const RSG_KINDS = ["route", "breakfast", "idea", "other"] as const;
export type RsgKind = (typeof RSG_KINDS)[number];
export const isRsgKind = (k: unknown): k is RsgKind => (RSG_KINDS as readonly unknown[]).includes(k);

export type RsgStatus = "sent" | "planned" | "done";
export type RsgRow = { id: number; kind: RsgKind; body: string; status: RsgStatus; reply: string; day: string };

const S = (v: unknown) => (typeof v === "string" ? v : "");
/** One row as the member sees it: an unknown kind as Something else, an unknown status as Sent; null for no row. */
export function rsgRow(v: unknown): RsgRow | null {
  const r = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  const id = Number(r?.id);
  if (!r || !Number.isInteger(id)) return null;
  return {
    id, kind: isRsgKind(r.kind) ? r.kind : "other", body: S(r.body), status: r.status === "planned" || r.status === "done" ? r.status : "sent",
    reply: S(r.reply).trim(), day: /^\d{4}-\d\d-\d\d$/.test(S(r.day)) ? S(r.day) : S(r.at).slice(0, 10),
  };
}

/** ride_suggestions_mine's answer (rpcServer's shape): the member's own rows, or null for no card (a refusal, a database
 *  without the function, no answer). */
export function rsgRows(r: { status: number; data: unknown }): RsgRow[] | null {
  const d = r.status === 200 && r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (!d || d.ok !== true || !Array.isArray(d.rows)) return null;
  return d.rows.map(rsgRow).filter((x): x is RsgRow => !!x).slice(0, 50);
}

/** The text a member sends: trimmed; null outside 3 to 500 characters. */
export function rsgText(v: unknown): string | null {
  const t = S(v).trim();
  return t.length >= 3 && t.length <= 500 ? t : null;
}

/** The words each refusal is said with (MemberHub.words.ts keys); anything else is the card's "could not do that". */
export const RSG_ERR: Record<string, "rsgDay" | "rsgOpenMax" | "rsgShort" | "rsgMember"> = { day: "rsgDay", open: "rsgOpenMax", invalid: "rsgShort", member: "rsgMember" };

/** What /api/account/suggestions answered a Send: the row the database kept, or why not. */
export type RsgAnswer = { ok: true; row: RsgRow } | { ok: false; error: string };
export function rsgAnswer(body: unknown): RsgAnswer {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const row = b?.ok === true ? rsgRow(b.row) : null;
  if (row) return { ok: true, row };
  return { ok: false, error: typeof b?.error === "string" ? b.error : "generic" };
}
