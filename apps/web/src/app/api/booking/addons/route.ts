import { ID } from "@/lib/booking-manage";
import { addonChange, manageAnswer, manageGate, manageJson } from "@/lib/booking-manage-server";

// POST /api/booking/addons {booking, item, delta: 1 | -1}: one step of a rider's add-ons on a ticket (the booking app's
// renderAddonPicker and _entryAddonMutate): the row's whole list written through customer_booking_update, then the stock
// moved by one (customer_addon_stock; a waitlisted row holds none). Refused: an item the session no longer sells or the
// inventory no longer has ("off"), out of stock ("out"), a priced item on a booking paid at the desk, by card or online
// ("paid"), 20 of one ("max"), one already handed over on the ride ("handed"), nothing to take off ("none"); none on a free
// ride. The id and token are the account cookie's; only this site's pages may call it. Answers {ok: true, lines}.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await manageGate(req);
  if (g instanceof Response) return g;
  const o = g.body && typeof g.body === "object" ? (g.body as Record<string, unknown>) : {};
  const booking = typeof o.booking === "string" ? o.booking : "", item = typeof o.item === "string" ? o.item : "";
  if (!ID.test(booking) || !ID.test(item) || item === "locker" || (o.delta !== 1 && o.delta !== -1)) return manageJson({ ok: false, error: "invalid" }, 400);
  return manageAnswer(await addonChange(g.acct, { booking, item, delta: o.delta }));
}
