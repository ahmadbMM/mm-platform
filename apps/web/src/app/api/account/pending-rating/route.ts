import { experiencesSchema } from "@/content/pages/experiences";
import { serverL } from "@/i18n/dicts";
import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { accountBookings } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { formOf, pendingRating } from "@/lib/rating";
import { kindNames, sessionName } from "@/lib/rides";
import { cookieValue } from "@/lib/live";
import { loadSiteContent } from "@/lib/site";
import { fmtDayDate } from "@/lib/tickets";
import { loadTicketSessions } from "@/lib/tickets-data";
import { riyadhClock } from "@/lib/workshop-days";

// GET /api/account/pending-rating?locale=xx: the ride a signed-in rider must rate before anything
// else (the booking app's _pendingRatingId), for the pop-up every page shows (RatingGateLoader,
// the owner 2026-10-03: "open whenever a customer opens the website or signs in"). Signed out it
// answers from the cookie alone, without asking the database; signed in it reads the rider's own
// bookings once (my_bookings) and, when one waits, that ride's session for its kind and its name.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  const locale = new URL(req.url).searchParams.get("locale") || "en";
  const rows = await accountBookings(acct);
  const gate = pendingRating(rows, riyadhClock(new Date()).slice(0, 10));
  if (!gate) return json({ signedIn: true, pending: null });
  const L = asLocale(locale), tx = serverL(locale);
  // the session as the account sees it (its token): a private ride keeps its name and its kind's form
  const [sessions, content] = await Promise.all([loadTicketSessions([gate.sessionId], acct), loadSiteContent()]);
  const s = sessions.get(gate.sessionId);
  const names = { ...kindNames(resolvePage(experiencesSchema, content, L).dates), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  return json({
    signedIn: true,
    pending: {
      entryId: gate.entryId,
      name: s ? sessionName(s, names, enNames, L !== "en") : tx("Ride", "جولة"),
      when: fmtDayDate(gate.date, locale),
      form: formOf(s?.kind),
      noBike: gate.ownBike || (s ? !s.bikes : false),
    },
  });
}
