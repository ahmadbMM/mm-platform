// A company challenge's join link on the website (the booking app's /?company=CODE, new features build F26, 8e7d29c7):
// micromobility.sa/account/company?company=CODE. The code is kept on this device (localStorage, a week at most, the
// app's COCH_KEY) until the rider is signed in; then Account > Company challenge opens and joins with it at once, and it
// is dropped whatever the answer, and at Log out. Plain logic, tested; components/account/CompanyLink.tsx keeps it.

/** How long a code from a link is kept (the app's 6048e5 ms: a week). */
export const COMPANY_KEEP_MS = 6048e5;

/** A code as the join box takes it: letters and digits, upper case, 12 at most; "" for none. */
export const companyCode = (v: unknown): string => (typeof v === "string" ? v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) : "");

/** What is kept: the code and when (the app's {c, t}). */
export const companyKept = (code: string, now: number = Date.now()): string => JSON.stringify({ c: code, t: now });

/** The code kept from a link, while it is under a week old; "" for none. */
export function companyParked(raw: string | null, now: number = Date.now()): string {
  try {
    const v = JSON.parse(raw || "null") as { c?: unknown; t?: unknown } | null;
    const c = companyCode(v?.c);
    return c && now - (Number(v?.t) || 0) < COMPANY_KEEP_MS ? c : "";
  } catch { return ""; }
}
