import { lockerBody } from "@/lib/booking-manage";
import { lockerAction, manageAnswer, manageGate, manageJson } from "@/lib/booking-manage-server";

// POST /api/booking/locker: a locker on a booking (the booking app's review cabinet and _lkAfterBook, the ticket's locker
// line with Change and Remove; components/booking/LockerPick.tsx).
//   {action: "board", session, day}: what the session offers (customer_locker_offer: the times, the fees, the places left,
//   the times already over) and the evening's cabinet (locker_board: the doors and the numbers taken, never by whom).
//   {action: "reserve", ids, period, codes?}: a locker for each booking row (customer_locker_reserve), the doors picked on
//   the cabinet in the rows' order; a door taken in the last moments is reserved again with none picked, and the database
//   holds a free one for the rider ({swap: true, lockers: [{bookingId, code}]}: lkGotOther).
//   {action: "change", rental, period, code}: another time or door for a rental not yet handed over (customer_locker_change).
//   {action: "cancel", ids}: the booking's locker removed (customer_locker_cancel), its fee off the bill.
// The id and token are the account cookie's; only this site's pages may call it. A refusal answers lk_full, lk_taken,
// lk_ended or lk_not_open (the booking app's _lkRiderSay).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await manageGate(req);
  if (g instanceof Response) return g;
  const b = lockerBody(g.body);
  if (!b) return manageJson({ ok: false, error: "invalid" }, 400);
  return manageAnswer(await lockerAction(g.acct, b) as Parameters<typeof manageAnswer>[0]);
}
