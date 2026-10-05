// The add-ons a ticket lists (lib/tickets.ts addonLines): each item's name and today's price, from
// the inventory, which anyone may read (its id, name and price) - with the public key, as the
// booking app's own customers read it. Only the items the tickets hold are asked for.
import { getJson } from "./rides";
import type { AddonItem } from "./tickets";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const N = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/** The items by id; an empty map when there is nothing to ask, null when the inventory could not
 *  be read (the ticket then shows the lines without amounts, and no total). */
export async function loadAddonItems(ids: string[], fetchImpl: typeof fetch = fetch): Promise<Map<string, AddonItem> | null> {
  const clean = [...new Set(ids)].filter((x) => ID.test(x)).slice(0, 60);
  if (!clean.length) return new Map();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const rows = await getJson(fetchImpl, `${url}/rest/v1/inventory?select=id,name,price&id=in.(${clean.join(",")})`, key);
    if (!Array.isArray(rows)) return null;
    const out = new Map<string, AddonItem>();
    for (const r of rows as Record<string, unknown>[]) {
      if (r && typeof r.id === "string") out.set(r.id, { name: typeof r.name === "string" ? r.name.trim() : "", price: N(r.price) });
    }
    return out;
  } catch {
    return null;
  }
}
