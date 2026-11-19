import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { resolvePage } from "@/lib/content";
import { askedLang } from "@/lib/lang-url";
import { BOOKING_URL } from "@/lib/links";
import { cookieValue } from "@/lib/live";
import { loadSiteContent } from "@/lib/site";
import { siteSchema } from "@/content/pages/site";

// The check-up's Add details (FixGate.tsx): the booking app, whose check-up asks every detail the account owes, signed in
// there by a one-time code (customer_handoff_create: two minutes, one use; the app's ?signin=, 2026-10-17), in the
// visitor's language. The app is the one staff set (Website > Whole site > Booking app). Signed out, or if the code
// cannot be made, the app still opens and asks for the sign-in itself.
export const dynamic = "force-dynamic";

const away = (to: string) => new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store", "referrer-policy": "no-referrer" } });

export async function GET(req: Request) {
  const lang = askedLang(new URL(req.url).searchParams);
  const site = resolvePage(siteSchema, await loadSiteContent(), "en") as Record<string, Record<string, unknown> | undefined>;
  const raw = typeof site.links?.booking === "string" ? site.links.booking : "";
  const app = new URL(/^https:\/\//.test(raw) ? raw : BOOKING_URL);
  app.search = ""; app.hash = "";
  if (lang) app.searchParams.set("lang", lang);
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!s) return away(app.toString());
  const r = await rpcServer<string>("customer_handoff_create", { p_id: s.id, p_token: s.token });
  if (typeof r.data === "string" && /^[0-9a-f]{48}$/.test(r.data)) app.searchParams.set("signin", r.data);
  return away(app.toString());
}
