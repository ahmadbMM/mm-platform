import { cancelBody } from "@/lib/booking-manage";
import { cancelBooking, manageAnswer, manageGate, manageJson } from "@/lib/booking-manage-server";

// POST /api/booking/cancel {booking, reason, note?}: Cancel on a ticket (the booking app's showCancelReasonModal,
// confirmCancelWithReason and cancelBooking): every live row of the account's booking on that session (waiting and on
// the waitlist) is cancelled through customer_booking_update, each carrying the reason's code (queue_entries.cancel_reason,
// one of the reasons Settings keeps) and Other's words (cancel_note); the add-ons of the rows that held their place go back
// to stock (customer_addon_stock). A paid ride that is over is refused ("over": errSessionClosed) before anything is sent.
// The id and token are the account cookie's, never the body's; only this site's pages may call it. Answers {ok: true,
// cancelled} or {ok: false, error} ("gone" when nothing of the booking is live any more: errCancelWaiting), with `moved`
// and `of` when only some riders were cancelled.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await manageGate(req);
  if (g instanceof Response) return g;
  const b = cancelBody(g.body);
  if (!b) return manageJson({ ok: false, error: "invalid" }, 400);
  return manageAnswer(await cancelBooking(g.acct, b));
}
