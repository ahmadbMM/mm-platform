import { serverL } from "@/i18n/dicts";
import { waiverCopy, type WaiverKind } from "@/content/waivers";
import { needsBike, waiverKind as bookWaiverKind } from "@/lib/booking";
import { waiverVersionFor } from "@/lib/booking-server";
import { ID } from "@/lib/booking-manage";
import { manageAnswer, manageContext, manageGate, manageJson } from "@/lib/booking-manage-server";

// POST /api/booking/manage {session, locale?, waiver?}: what a ticket's dialogs need to change the booking on the website
// (the user, 2026-11-19: "make sure all customers can do everything they want in the booking app to do it on the main
// website"; components/booking/TicketManage.tsx), read for the signed-in account with the id and token from the account
// cookie only: its live rows on the session (my_bookings), the session as the account may see it (list_sessions), the
// most riders the party may hold (Settings > Business), the bike types with their fares and the closed ones, the add-ons
// the session sells with their stock, the lockers it offers and the account's rentals on the booking, the cancel reasons
// Settings keeps, and the Farm House Night's holder. With `waiver`, the session's waiver in the page's language and the
// version a rider added agrees under. It is a POST so only this site's pages may ask (the same-origin check).
export const dynamic = "force-dynamic";

const KIND: Record<ReturnType<typeof bookWaiverKind>, WaiverKind> = { bike: "ride", swim: "swim", activity: "activity", farm: "farm", blood: "blood" };

export async function POST(req: Request) {
  const g = await manageGate(req);
  if (g instanceof Response) return g;
  const b = g.body && typeof g.body === "object" ? (g.body as Record<string, unknown>) : {};
  const session = typeof b.session === "string" ? b.session : "";
  if (!ID.test(session)) return manageJson({ ok: false, error: "invalid" }, 400);
  const ctx = await manageContext(g.acct, session);
  if (!ctx.ok || b.waiver !== true) return manageAnswer(ctx);
  const s = { kind: ctx.session.kind } as Parameters<typeof needsBike>[0];
  const locale = typeof b.locale === "string" && /^[a-z]{2}$/.test(b.locale) ? b.locale : "en";
  return manageAnswer({ ...ctx, waiver: { ...waiverCopy(KIND[bookWaiverKind(s)], serverL(locale)), version: waiverVersionFor(s) } });
}
