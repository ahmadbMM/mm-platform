// The fleet lives in the rentals Supabase project and is maintained from its Fleet page.
// Nothing here creates a bike page: the route is dynamic, so a bike has a page from the
// moment staff give it a number, and it shows exactly the fields they filled in.
//
// Read-only, anon key, and only the columns anon is granted. The private ones
// (serial_number, tag_uid, condition, notes, model_year, pedal_type) are blocked by
// column-level grants in Postgres, so a mistake here cannot leak them.
export { filled } from "./filled";
import { faresOf, type Fares } from "./biz";
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



/**
 * The rentals app writes exactly four statuses; the handoff spec names five states. This maps
 * one to the other, and accepts the spec's own words too so either vocabulary resolves.
 *
 * An unrecognised status resolves to "hold", NOT to "available". The default used to be
 * available, which meant a typo, a future status or a bad restore would put a Book button
 * under a bike that might be in the workshop. Wrongly resting a good bike is a visible
 * mistake someone fixes; wrongly renting a broken one is a silent one.
 */
export function bikeState(row: BikeRow): BikeState {
  if (filled(row.retired_date)) return "hold";
  switch ((row.status || "").trim().toLowerCase()) {
    case "available": return "available";
    case "in-use": case "out": return "out";
    case "maintenance": case "retired": case "hold": return "hold";
    case "returned": return "returned";
    case "staged": case "reserved": return "staged";
    default:
      console.warn(`[bike] unrecognised status ${JSON.stringify(row.status)} — resting it`);
      return "hold";
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
      // Eight seconds: a rider is standing at the bike. Past that the page says the fleet could not
      // be reached and offers to try again, rather than hanging on a slow database.
      signal: AbortSignal.timeout(8000),
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
 * The rates are the booking app's own: ride_prices as admins set them in its Settings > Pricing
 * (lib/biz.ts loadFares, the caller passes them in), over its built-in figures when there is no
 * row or nothing could be read.
 */
// Petromin employees ride the same bikes at their own fare (ride_prices employee_price), but that
// is a property of the BOOKING (a form-registered employee's), and a bike page has no booking: a
// rider tapping a tag has not chosen a ride yet. So this page states the standard fare, which is
// what an ordinary rider pays. The employee fare lives where it can be applied correctly - the
// booking price trigger.
/** The booking app's built-in fares, when the caller has none read. */
const APP_FARE_LIST: Fares = faresOf(null);
const TYPE_RATED = new Set(["Road", "Mountain", "Hybrid"]);

/**
 * What a ride on a bike of this type costs, or null when there is no price to state: "Own" is
 * not rented, and a type we do not know (Gravel, until it is listed) has no known rate. The
 * catalogue's model pages quote this by the model's ride_type; the fleet pages through ridePrice.
 */
export function priceForType(type: string, fares: Fares = APP_FARE_LIST): number | null {
  const price = fares.price[type.trim()];
  return typeof price === "number" && price > 0 ? price : null;
}

/**
 * Returns null when there is no price to state: an "Own" bike is not rented, and a bike whose
 * type we do not recognise has no known rate. The rentals app falls back to a default constant
 * here, but it is quoting staff who can see the record; this page is quoting a rider standing at
 * a bike rack, and a number assembled from a default is a guess wearing a price tag.
 */
export function ridePrice(row: BikeRow, fares: Fares = APP_FARE_LIST): number | null {
  const type = String(row.type ?? "").trim();
  if (TYPE_RATED.has(type)) return priceForType(type, fares);   // the app ignores rental_price for these
  if (typeof row.rental_price === "number") return row.rental_price > 0 ? row.rental_price : null;
  return priceForType(type, fares);
}
