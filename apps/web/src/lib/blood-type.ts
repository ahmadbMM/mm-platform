// The rider's blood type on the account (the booking app, 2026-10-14: "create a field for the accounts
// and allow people to add their blood type in my accounts section", asked for the Blood Donation
// event). customers.blood_type (migration 20261014180000 in the booking app's repo): one of the
// eight types, or 'unknown' ("I don't know my blood type"); null = never answered. Read through
// customer_blood_type(p_id, p_token), saved through customer_set_blood_type(p_id, p_token, p_type):
// '' clears it, anything else outside the nine codes is BAD_INPUT with the detail 'blood_type'.
// A database without the functions yet (PGRST202) hides the card.
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number] | "unknown";

/** A value the database takes: one of the nine codes, or "" (clears it). */
export const btValid = (v: string): v is BloodType | "" =>
  v === "" || v === "unknown" || (BLOOD_TYPES as readonly string[]).includes(v);

/** The stored value as the page holds it: a code, or "" for none (anything unexpected reads as none). */
export const btOf = (v: unknown): BloodType | "" => (typeof v === "string" && v !== "" && btValid(v) ? v : "");

/** A type as it is shown: its minus as a true minus sign (U+2212), as the booking app shows it. */
export const btShow = (v: string) => v.replace("-", "−");

/** The database's refusal of a value (BAD_INPUT, detail 'blood_type'). */
export const btRefused = (e: { details?: unknown; message?: unknown } | null | undefined) =>
  !!e && (String(e.details ?? "") === "blood_type" || /\bblood_type\b/.test(String(e.message ?? "")));
