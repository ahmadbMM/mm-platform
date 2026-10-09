import { experiencesSchema } from "@/content/pages/experiences";
import { sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { claimToken, claimView, stateOfSpot, type ClaimGet, type ClaimSpot } from "@/lib/claim";
import { asLocale, resolvePage } from "@/lib/content";
import { withinLimit } from "@/lib/rate-limit";
import { kindNames, rideKind, sessionName } from "@/lib/rides";
import { loadSiteContent } from "@/lib/site";

// The waitlist claim page's two calls (components/claim/ClaimCard.tsx, lib/claim.ts), with the
// public key - no sign-in: the token in the link is the key, as in the booking app.
//   GET  /api/claim?t=<token>&locale=xx   customer_claim_get: what the card shows (the ride's name
//        and day, the time left), never the rider's name or queue number.
//   POST /api/claim {t, decline}           customer_claim_spot: claim the place, or say "I can't come".
// Until the owner applies the rentals migration 20261009225000 neither function exists: the read then
// answers "gone" (This offer has ended) and a claim "gone" too, never an error page. A read that does
// not come back answers "net" (Try again); the database's CHANGED (two claims at the same moment)
// answers retry, and the card asks again. Only this site's pages may POST; 30 a minute per connection.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

/** A database answer that is not there at all (the function not created yet): read as no offer. */
const missing = (r: { status: number; code?: string }) => r.status === 404 || r.code === "PGRST202" || r.code === "42883";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const t = claimToken(u.searchParams.get("t"));
  const locale = u.searchParams.get("locale") || "en";
  if (!t) return json(claimView({ ok: false }, locale));
  if (!(await withinLimit(req, "claim"))) return json({ error: "busy" }, 429);
  const r = await rpcServer<ClaimGet>("customer_claim_get", { p_token: t });
  const got = r.data && typeof r.data === "object" ? r.data : null;
  const view = claimView(got ?? (missing(r) ? { ok: false } : null), locale);
  if (view.state !== "net" && view.state !== "gone" && got?.session) {
    // the ride by name, as every page of the site names it (lib/rides.ts sessionName)
    const content = await loadSiteContent();
    const L = asLocale(locale);
    const names = kindNames(resolvePage(experiencesSchema, content, L).dates);
    const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
    const kind = rideKind({ ride_kind: got.session.ride_kind, event_kind: got.session.event_kind });
    view.title = sessionName({ kind, title: view.title }, names, enNames, L !== "en") || view.title || "Micromobility";
  }
  return json(view);
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ error: "origin" }, 403);
  if (!(await withinLimit(req, "claim"))) return json({ error: "busy" }, 429);
  type Body = { t?: unknown; decline?: unknown };
  const body: Body | null = await req.json().then((b: unknown) => (b && typeof b === "object" ? (b as Body) : null), () => null);
  const t = claimToken(body?.t);
  if (!t) return json({ state: "gone" });
  const r = await rpcServer<ClaimSpot>("customer_claim_spot", { p_token: t, p_decline: body?.decline === true });
  if (missing(r)) return json({ state: "gone" });
  const state = stateOfSpot(r.data && typeof r.data === "object" ? r.data : null);
  // no answer, or CHANGED (P0001): the card stays on its question and offers Try again
  return json(state ? { state } : { retry: true });
}
