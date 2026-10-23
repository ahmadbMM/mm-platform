import { T as TICKET } from "@/components/booking/tickets.text";
import { experiencesSchema } from "@/content/pages/experiences";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { accountBookings } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { kindNames, sessionName, timesText } from "@/lib/rides";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { ENTRY_ID } from "@/lib/rating";
import { pendingRaceRegs, raceRegCandidates } from "@/lib/race-reg";
import { loadSiteContent } from "@/lib/site";
import { fmtClock, fmtDayDate, venueOf, venueText } from "@/lib/tickets";
import { loadTicketSessions } from "@/lib/tickets-data";
import { riyadhClock } from "@/lib/workshop-days";

// GET /api/account/pending-race-reg?locale=xx[&skip=id,id]: the DEFE 5KM Run place a signed-in runner must
// still answer "Have you registered for the race?" for (lib/race-reg.ts pendingRaceRegs; the booking app's
// _pendingRaceReg), for the pop-up every page shows once no waiver or run agreement waits (RaceGateLoader),
// with what it shows: the run's name, day, time and place, and the answer so far (null, or "no"). Signed
// out it answers from the cookie alone; signed in it reads the runner's own bookings (my_bookings), then
// the sessions of the rows still to answer, to know which are the Defe run. `skip` is the places passed
// with Done on this visit. The answer itself goes through POST /api/account/race-reg. A connection asks
// 30 times a minute at most.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
const S = (v: unknown) => (typeof v === "string" ? v : "");

export async function GET(req: Request) {
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ signedIn: false });
  if (!(await withinLimit(req, "account-check"))) return json({ error: "busy" }, 429);
  const q = new URL(req.url).searchParams;
  const locale = q.get("locale") || "en";
  const skip = (q.get("skip") || "").split(",").filter((x) => ENTRY_ID.test(x)).slice(0, 20);
  const rows = await accountBookings(acct);
  const today = riyadhClock(new Date()).slice(0, 10);
  const ids = [...new Set(raceRegCandidates(rows, today, acct.id, skip).map((x) => x.sessionId))];
  if (!ids.length) return json({ signedIn: true, pending: null });
  const sessions = await loadTicketSessions(ids, acct);
  const first = pendingRaceRegs(rows, sessions, today, acct.id, skip)[0];
  const s = first && sessions.get(first.sessionId);
  if (!first || !s) return json({ signedIn: true, pending: null });
  const L = asLocale(locale), tx = serverL(locale);
  const content = await loadSiteContent();
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  const t = serverLocalize(TICKET, locale);
  const clock = (x: string) => fmtClock(x, locale);
  return json({
    signedIn: true,
    pending: {
      entryId: first.entryId,
      answer: first.answer,
      name: sessionName(s, names, enNames, L !== "en"),
      when: fmtDayDate(first.date, locale),
      time: timesText(s.times, s.gathers, clock, { gather: S(d.gather), start: S(d.start) }),
      venue: venueText(venueOf(s), t),
      // the question's words in the page's language, as the ticket has them (tickets.text.ts)
      t: { q: t.defeRegQ, sub: t.defeRegSub, noNote: t.defeRegNoNote, code: t.defeRegCode, link: t.defeRegLink, yes: t.yes, no: t.no, failed: t.rrFailed },
    },
  });
}
