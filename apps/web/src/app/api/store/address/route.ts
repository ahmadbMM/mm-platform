import { json } from "@/lib/pay/http";
import { withinLimit } from "@/lib/rate-limit";
import { loadSiteContent } from "@/lib/site";
import { addressLookup } from "@/lib/store-api";
import { shortAddress } from "@/lib/store-form";
import { storeSwitches } from "@/lib/store-settings";

// GET /api/store/address?short=RCMA7933&lang=ar: the district, street and numbers of a national short address (F76),
// for checkout to fill in (the customer can change every field after). Only while staff switch the lookup on
// (store.addressLookup.on) and the Worker holds NATIONAL_ADDRESS_KEY: {ok: false, error: "lookup_off"} otherwise.
// A GET from this site's own pages carries no Origin header, so the browser's Sec-Fetch-Site says where it came from;
// metered per visitor as the pay routes are (the service is paid per lookup).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  if (site !== "same-origin" && !(origin && origin === new URL(req.url).origin)) return json({ ok: false, error: "origin" }, 403);
  if (!(await withinLimit(req, "pay"))) return json({ ok: false, error: "busy" }, 429);
  const u = new URL(req.url);
  const short = shortAddress(u.searchParams.get("short") ?? "");
  const r = await addressLookup(short, storeSwitches(await loadSiteContent()).addressLookup, undefined, u.searchParams.get("lang") === "ar" ? "ar" : "en");
  if (!r.ok) return json({ ok: false, error: r.error }, r.status);
  return json({ ok: true, address: r.data });
}
