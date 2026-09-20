// The fleet lives in the rentals Supabase project and is maintained from its Fleet page.
// Nothing here creates a bike page: the route is dynamic, so a bike has a page from the
// moment staff give it a number, and it shows exactly the fields they filled in.
//
// Read-only, anon key, and only the columns anon is granted. The private ones
// (serial_number, tag_uid, condition, notes, model_year, pedal_type) are blocked by
// column-level grants in Postgres, so a mistake here cannot leak them.
export { filled } from "./filled";
import { filled } from "./filled";

const PUBLIC_COLS = [
  "name", "size", "type", "status", "brand", "model", "groupset", "speeds",
  "colors", "color_names", "frame_type", "bike_number", "in_service_date", "rental_price",
  "retired_date", "photo", "last_serviced_at", "wheel_size", "brake_type", "weight_kg",
].join(",");

export type BikeRow = {
  name: string | null; size: string | null; type: string | null; status: string | null;
  brand: string | null; model: string | null; groupset: string | null; speeds: number | null;
  colors: string[] | null; color_names: string[] | null; frame_type: string | null;
  bike_number: number | null; in_service_date: string | null; retired_date: string | null;
  rental_price: number | null;
  photo: string | null; last_serviced_at: string | null; wheel_size: string | null;
  brake_type: string | null; weight_kg: number | null;
};

/** The five states the page can render. `hold` covers maintenance and retirement alike. */
export type BikeState = "available" | "staged" | "out" | "returned" | "hold";



export function bikeState(row: BikeRow): BikeState {
  if (filled(row.retired_date)) return "hold";
  switch ((row.status || "").toLowerCase()) {
    case "in-use": return "out";
    case "maintenance": case "retired": return "hold";
    case "returned": return "returned";
    case "staged": return "staged";
    default: return "available";
  }
}

/**
 * The three answers a tag can get. "missing" and "unavailable" are deliberately NOT the same:
 * a sticker nobody has linked to a bike is a dead end the rider should be told about, while a
 * database we could not reach is a temporary fault they should retry. Collapsing both into null
 * meant a missing environment variable on the Worker would have told every rider, on every bike,
 * that their sticker was unrecognised — with nothing anywhere pointing at the real cause.
 */
export type BikeLookup =
  | { status: "found"; row: BikeRow }
  | { status: "missing" }
  | { status: "unavailable"; reason: string };

export async function getBikeByNumber(code: string): Promise<BikeLookup> {
  if (!/^\d{1,6}$/.test(code)) return { status: "missing" };   // the sticker is a number, nothing else

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // A deployment fault, not a rider's fault. Loud, because the page cannot say it.
    console.error("[bike] NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing — no bike can resolve");
    return { status: "unavailable", reason: "config" };
  }

  const endpoint =
    `${url}/rest/v1/bikes?select=${PUBLIC_COLS}&bike_number=eq.${Number(code)}&limit=1`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      // A bike's status changes as it goes out and comes back, so the page is never cached.
      cache: "no-store",
    });
  } catch (e) {
    console.error("[bike] fleet unreachable:", e);
    return { status: "unavailable", reason: "network" };
  }
  if (!res.ok) {
    console.error(`[bike] fleet responded ${res.status}`);
    return { status: "unavailable", reason: `http_${res.status}` };
  }

  try {
    const rows = (await res.json()) as BikeRow[];
    const row = rows?.[0];
    return row ? { status: "found", row } : { status: "missing" };
  } catch (e) {
    console.error("[bike] unreadable answer from the fleet:", e);
    return { status: "unavailable", reason: "parse" };
  }
}

/**
 * What a rider is actually charged for this bike.
 *
 * MIRRORS priceForBike() in the rentals app (app.src.html, `RIDE_PRICES` / `priceForBike`).
 * The subtlety worth keeping: for Road, Mountain and Hybrid — which is the whole fleet today —
 * the rentals app IGNORES the bike's own rental_price and charges the type rate. Printing the
 * raw column here would have quoted 95 SAR on a bike whose ride costs 75. rental_price only
 * decides the price for the other types.
 *
 * If the rates change in the rentals app, they change here too — this table is a copy, not a
 * source of truth, and the database has no column that holds the charged price.
 */
const RIDE_PRICES: Record<string, number> = {
  Road: 75, Mountain: 50, Hybrid: 50, Kids: 50, Any: 50, "Road Carbon": 250, Own: 0,
};
const TYPE_RATED = new Set(["Road", "Mountain", "Hybrid"]);

/**
 * Returns null when there is no price to state: an "Own" bike is not rented, and a bike whose
 * type we do not recognise has no known rate. The rentals app falls back to a default constant
 * here, but it is quoting staff who can see the record; this page is quoting a rider standing at
 * a bike rack, and a number assembled from a default is a guess wearing a price tag.
 */
export function ridePrice(row: BikeRow): number | null {
  const type = String(row.type ?? "").trim();
  const byType = RIDE_PRICES[type];

  let price: number | undefined;
  if (TYPE_RATED.has(type)) price = byType;              // the app ignores rental_price for these
  else if (typeof row.rental_price === "number") price = row.rental_price;
  else price = byType;

  return typeof price === "number" && price > 0 ? price : null;
}
