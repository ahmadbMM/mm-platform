// A database call from the visitor's browser, with the public key - the same guarded entry points
// (SECURITY DEFINER functions) the booking app and the partner forms use.
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("config");
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return (await res.json()) as T;
}

/** A Saudi mobile typed any usual way (05…, 5…, 9665…, +9665…) as +9665XXXXXXXX; other +codes kept. */
export function normalizePhone(raw: string): string {
  const d = raw
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "") // direction marks pasted from RTL contacts
    .replace(/[\s\-().]/g, "")
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/^(\+|00)9660(?=5\d{8}$)/, "+966"); // "+966 05…": the trunk 0 goes
  if (/^\+9665\d{8}$/.test(d)) return d;
  if (/^05\d{8}$/.test(d)) return "+966" + d.slice(1);
  if (/^5\d{8}$/.test(d)) return "+966" + d;
  if (/^9665\d{8}$/.test(d)) return "+" + d;
  if (/^00[1-9]\d{7,14}$/.test(d)) return "+" + d.slice(2);
  return d;
}

/** The site-wide name rule (the booking app's, and the database's _name_chars_ok): letters of any
 *  script with their marks (Hindi, Nepali and Bengali vowel signs, Arabic harakat), spaces and
 *  periods ("Md. Rahman"). A typed dash becomes a space; a period that would start the name or a
 *  word, or follow another period, is dropped. */
export const cleanName = (s: string) =>
  s.replace(/[-‐-―]/g, " ").replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1").replace(/\s+/g, " ").trim();
/** A cleaned name the database takes: nothing but letters, marks, spaces and periods, and a letter in it. */
export const nameOk = (s: string) => /^[\p{L}\p{M}\s.]+$/u.test(s) && /\p{L}/u.test(s);
/** Every part of a name at least two characters long, the parts split at spaces and periods: the
 *  database's _name_parts_ok, which an account's name must pass ("Md. Rahman" yes, "Ali K" no).
 *  Characters as the database counts them, a letter's marks included. */
export const namePartsOk = (s: string) => s.split(/[\s.]+/).every((w) => w === "" || [...w].length >= 2);
