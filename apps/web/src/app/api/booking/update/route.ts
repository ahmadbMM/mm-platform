import { ID, editBody } from "@/lib/booking-manage";
import { dropFamily, editBooking, manageAnswer, manageGate, manageJson } from "@/lib/booking-manage-server";

// POST /api/booking/update: Edit on a ticket (the booking app's submitModifyBooking), as the booking app saves it.
//   {session, key, riders: [{name, height, type}], waiver}: the party as the form holds it, rider i saved onto the booking's
//   row i (key: those rows' ids, in order; a booking that changed underneath answers "changed": modifyChangedMsg). A row kept
//   gets its height, size and bike type through customer_booking_update (never a name or a price); the rows past the new
//   count are cancelled (their add-ons back to stock); the riders added are new bookings (customer_create_booking, under
//   the session's waiver, which `waiver` ticks). A rider never picks "Any"; a closed type only where the row holds it.
//   {session, drop}: the Farm House Night's Edit (_fhDrop): one family member off the booking, never the holder alone.
// The id and token are the account cookie's; only this site's pages may call it. Answers {ok: true, ...} or {ok: false,
// error, i?, field?} in lib/booking-manage.ts ManageError's words.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await manageGate(req);
  if (g instanceof Response) return g;
  const o = g.body && typeof g.body === "object" ? (g.body as Record<string, unknown>) : null;
  if (o && "drop" in o) {
    const session = typeof o.session === "string" ? o.session : "", drop = typeof o.drop === "string" ? o.drop : "";
    if (!ID.test(session) || !ID.test(drop)) return manageJson({ ok: false, error: "invalid" }, 400);
    return manageAnswer(await dropFamily(g.acct, { session, drop }));
  }
  const b = editBody(g.body);
  if (!b) return manageJson({ ok: false, error: "invalid" }, 400);
  return manageAnswer(await editBooking(g.acct, b));
}
