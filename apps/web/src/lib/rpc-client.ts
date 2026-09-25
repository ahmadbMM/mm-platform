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

/** Names are letters and spaces only; a typed dash becomes a space (the site-wide name rule). */
export const cleanName = (s: string) => s.replace(/[-‐-―]/g, " ").replace(/\s+/g, " ").trim();
