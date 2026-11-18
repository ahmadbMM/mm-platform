// The Ramadan season in a member's area on /club, as the booking app's Community tab has it (member-hub.js _ssn*, rentals
// a715c478, migration 20261118210900; the user picked: "Ramadan season (about 8 Feb to 8 Mar 2027): a Ramadan challenge from
// the existing template, a season badge, an Eid ride and a Ramadan look for the tab"). hub_season(p_id, p_token), members
// only, answers {ok, today, ramadan: {year, starts_on, ends_on, eid_on} | null}: the Ramadan running now or the next one, as
// staff keep it, until its third Eid day is over. While today (Riyadh) is between its first and last day the area opens
// with a "Ramadan Kareem" card (a drawn crescent and two lanterns) and its members' sessions wear night blue and gold; on
// Eid al-Fitr's first three days the card says "Eid Mubarak". Gregorian dates only. A database without the function, a
// refusal or a member outside the dates: no card, no accent, nothing said. The challenges and their badges (the crescent and
// the lantern, components/account/badge-glyphs.ts) reach members as any staff challenge does. Plain logic, so it can be tested.

const DAY = /^\d{4}-\d\d-\d\d$/;
const ymd = (v: unknown) => { const s = typeof v === "string" ? v.slice(0, 10) : ""; return DAY.test(s) ? s : ""; };
const plus = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export type Ramadan = { from: string; to: string; eid: string };

/** hub_season's answer (rpcServer's shape): Ramadan's first and last day and Eid's, or null (no Ramadan known, a refusal, a
 *  database without the function, dates that do not hold together). */
export function ramadanOf(r: { status: number; data: unknown }): Ramadan | null {
  const d = r.status === 200 && r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  const x = d?.ok === true && d.ramadan && typeof d.ramadan === "object" ? (d.ramadan as Record<string, unknown>) : null;
  if (!x) return null;
  const from = ymd(x.starts_on ?? x.from), to = ymd(x.ends_on ?? x.to), eid = ymd(x.eid_on ?? x.eid);
  return from && to && eid && from <= to && to < eid ? { from, to, eid } : null;
}

/** What the area wears today (Riyadh, "YYYY-MM-DD"): "ramadan" from its first day to its last, "eid" on the three days from
 *  Eid al-Fitr, else "" (the app's _ssnKind). */
export function seasonKind(r: Ramadan | null, today: string): "ramadan" | "eid" | "" {
  if (!r || !DAY.test(today)) return "";
  return today >= r.from && today <= r.to ? "ramadan" : today >= r.eid && today <= plus(r.eid, 2) ? "eid" : "";
}
