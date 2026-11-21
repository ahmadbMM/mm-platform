import { experiencesSchema } from "@/content/pages/experiences";
import { asLocale, resolvePage } from "@/lib/content";
import { ID } from "@/lib/booking-manage";
import { manageAnswer, manageGate, manageJson, moveBooking, moveTargets } from "@/lib/booking-manage-server";
import { loadSiteContent } from "@/lib/site";

// POST /api/booking/move: Reschedule on a ticket (the booking app's showRescheduleModal and rescheduleBooking).
//   {from, list: true, locale}: the sessions the booking may move to (_rsTarget: another open circuit night nobody
//   approves, not over, open to riders by the booking window and members book first, for the account's gender), soonest
//   first, with their day and time in the page's language and whether each has room for every rider.
//   {from, to}: moves every live row of the account's booking there through customer_booking_update, after the app's own
//   checks (a type closed there, no room, a paid booking onto another fare); the add-on stock follows where each rider lands.
//   A move the server refused rider by rider answers {ok: false, error, moved, of}.
// The id and token are the account cookie's; only this site's pages may call it.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await manageGate(req);
  if (g instanceof Response) return g;
  const o = g.body && typeof g.body === "object" ? (g.body as Record<string, unknown>) : {};
  const from = typeof o.from === "string" ? o.from : "";
  if (!ID.test(from)) return manageJson({ ok: false, error: "invalid" }, 400);
  if (o.list === true) {
    const locale = typeof o.locale === "string" && /^[a-z]{2}$/.test(o.locale) ? o.locale : "en";
    const d = resolvePage(experiencesSchema, await loadSiteContent(), asLocale(locale)).dates as Record<string, unknown>;
    const w = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
    return manageAnswer(await moveTargets(g.acct, from, locale, { gather: w("gather"), start: w("start") }));
  }
  const to = typeof o.to === "string" ? o.to : "";
  if (!ID.test(to) || to === from) return manageJson({ ok: false, error: "invalid" }, 400);
  return manageAnswer(await moveBooking(g.acct, { from, to }));
}
