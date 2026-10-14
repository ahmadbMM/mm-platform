// The rider's ID or Iqama number on the account (the booking app, 2026-10-14, for the Blood Donation
// registration). customers.national_id (migration 20261014190000 in the booking app's repo): 10 digits,
// starting 1 (a Saudi ID) or 2 (an Iqama); null = not given. Read through customer_national_id(p_id,
// p_token), saved through customer_set_national_id(p_id, p_token, p_id_no), which takes Arabic-Indic
// digits and drops spaces as nidClean does; '' clears it, anything else not matching is BAD_INPUT with
// the detail 'national_id'. A database without the functions yet (PGRST202) hides the card.
export const NID_RE = /^[12][0-9]{9}$/;

/** The number as typed, as the database stores it: Arabic-Indic and Persian digits as Latin, no spaces. */
export const nidClean = (raw: string) => raw
  .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
  .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
  .replace(/\s/g, "");

/** A cleaned value the database takes: a 10-digit ID or Iqama number, or "" (clears it). */
export const nidValid = (v: string) => v === "" || NID_RE.test(v);

/** The stored value as the page holds it ("" for none, or anything unexpected). */
export const nidOf = (v: unknown) => (typeof v === "string" && NID_RE.test(v) ? v : "");

/** The database's refusal of a value (BAD_INPUT, detail 'national_id'). */
export const nidRefused = (e: { details?: unknown; message?: unknown } | null | undefined) =>
  !!e && (String(e.details ?? "") === "national_id" || /\bnational_id\b/.test(String(e.message ?? "")));
