import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { withinLimit } from "@/lib/rate-limit";
import { loadRides, kindNames, sessionName, type RideSession } from "@/lib/rides";
import { loadSiteContent, type SiteContent } from "@/lib/site";
import { asLocale, resolvePage } from "@/lib/content";
import { experiencesSchema } from "@/content/pages/experiences";
import { bloodName, BLOOD_NAME } from "@/content/blood-words";
import { farmWords, FARM_NAME } from "@/content/farm-words";
import { notOpenYet, opensAt, siteBookingWindow } from "@/lib/booking-window";
import { mfAt } from "@/lib/members-first";
import { remindable, remindAt, remindEv, remindIcs } from "@/lib/open-remind";
import { bookingAt } from "@/lib/event-info";
import { BOOKING_URL, bookingLink } from "@/lib/links";
import { riyadhClock } from "@/lib/workshop-days";
import { SESSION_ID } from "@/lib/waiver";
import { LOCALE_CODES } from "@/i18n/locales";
import { serverL } from "@/i18n/dicts";
import { remindWords } from "@/components/site/Remind.words";

// GET /api/booking-opens?s=<session>&l=<language>: "Add to my calendar" in a date's Remind me pop-up (RemindBell,
// lib/open-remind.ts; the booking app's _ormCal and its /api/ics kind 'o', the customer features round of 2026-11-19, item
// 2), as a calendar file written here from the session's own row: nothing the page sent goes into it but the session's
// id and the language. One event at the moment booking opens for this visitor (the booking window's opening, or members
// book first's public_at for a visitor who is not a member, the account cookie's community_member saying which), 15
// minutes, an alarm then and ten minutes before, UID opens-<session>@micromobility.sa, "Booking opens: <the date's
// name>", its description and URL the booking app at that date (?ev=<event>&session=<id>, in the page's language). A plain
// link, so an iPhone's Safari offers to add it to the calendar and any other browser saves it. A date this visitor could
// not be reminded of (unknown, gone, full, closed as fully booked, members' only to someone who is not one, a Saturday
// ride taken by code alone) or one already open to them, and a connection over its meter, is never a page of English: a
// 303 back to the page the link was on (else Experiences), which says what holds. It reads only what the lists read
// (the sessions ahead, staff's content), so it answers before the reminders' migration (20261119600200) is applied too.
const back = (req: Request) => {
  let to = new URL("/experiences", req.url);
  try {
    const r = new URL(req.headers.get("referer") ?? "");
    if (r.origin === to.origin) to = r;
  } catch { /* no page to go back to */ }
  return new Response(null, { status: 303, headers: { location: to.toString(), "cache-control": "no-store, private" } });
};

/** A date's name in the file's title: a circuit night is "MicroMobility Ride" (the booking app's icsRideTitle), any other
 *  session what the Experiences page calls it (sessionName, the Arabic one on an Arabic page). */
function nameOf(s: RideSession, locale: string, content: SiteContent | null): string {
  if (s.kind === "jcc") return remindWords(locale).ride;
  const L = asLocale(locale), tx = serverL(locale);
  const names = { ...kindNames(resolvePage(experiencesSchema, content, L).dates), petromin: tx("Petromin", "بترومين"), blood: bloodName(tx), farm: farmWords(tx).name };
  const en = L !== "en" ? { ...kindNames(resolvePage(experiencesSchema, content, "en").dates), petromin: "Petromin", blood: BLOOD_NAME, farm: FARM_NAME } : names;
  return sessionName(s, names, en, L !== "en", L === "ar") || names[s.kind] || remindWords(locale).ride;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("s") ?? "";
  const l = u.searchParams.get("l") ?? "";
  const locale = (LOCALE_CODES as readonly string[]).includes(l) ? l : "en";
  if (!SESSION_ID.test(id)) return back(req);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!(await withinLimit(req, "account-check", undefined, acct?.id ?? ""))) return back(req);
  const [rides, content] = await Promise.all([loadRides(), loadSiteContent()]);
  const s = rides?.sessions.find((x) => x.id === id);
  if (!s) return back(req);
  const now = Date.now();
  // who is asking, read only where the date needs it (each a bare boolean that checks the token; a failure reads as no)
  const ask = async (fn: string) => (acct ? (await rpcServer<boolean>(fn, { p_id: acct.id, p_token: acct.token })).data === true : false);
  const mf = mfAt(s, now);
  const member = s.members || mf > 0 || s.kind === "farm" ? await ask("community_member") : false;
  const viewer = {
    member,
    petromin: s.kind === "petromin" && s.members && !member ? await ask("petromin_member") : false,
    vlap: s.kind === "vlap" && s.members && !member ? await ask("vlap_member") : false,
    satLink: s.kind === "saturday" ? (await rpcServer<boolean>("saturday_link_only", {})).data === true : false,
  };
  // the Farm House Night is a member's alone (lib/farm.ts farmForMembers): nobody else is told it exists
  if ((s.kind === "farm" && !member) || !remindable(s, viewer)) return back(req);
  const w = siteBookingWindow(content);
  const win = w && notOpenYet(s.date, w, riyadhClock(new Date(now)), s.kind) ? opensAt(s.date, w) : null;
  const at = remindAt({ opensAt: win, mf: { at: mf, held: !member } }, now);
  if (!at) return back(req);
  const title = remindWords(locale).icsT.replace("{0}", () => nameOf(s, locale, content));
  const url = bookingLink(bookingAt(BOOKING_URL, remindEv(s.kind), s.id), locale);
  return new Response(remindIcs({ id: s.id, at, title, url }, now), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="micromobility-opens-${s.date.replace(/-/g, "")}.ics"`,
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
    },
  });
}
