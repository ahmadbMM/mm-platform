import { asLocale } from "@/lib/content";
import { isComingSoon, loadSiteContent, pageOn, siteCanOpen } from "@/lib/site";
import { loadRides, upcoming } from "@/lib/rides";
import { riyadhClock } from "@/lib/workshop-days";
import { localHref } from "@/lib/links";
import { siteBookingWindow } from "@/lib/booking-window";
import { priceMap } from "@/lib/booking";
import { icsFeed, timesOf } from "@/lib/sx-B5";
import { feedKind, xpExtras, xpItems, xpSettings } from "@/lib/sx-B5-server";

// A kind's dates as a calendar a phone subscribes to (EF16; the Experiences build of 2026-11-18): webcal://<host>/api/xp/
// cal/saturday?lang=ar adds every Saturday ride to the rider's calendar and keeps it up to date. Public and the same for
// everyone: each date's name, times, place and page, never a booking, a rider or anything personal. Not for the kinds only
// some visitors see (a Petromin night, the Farm House Night), and not while staff have it off (xp.general.calendars) or
// the page is closed.
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const u = new URL(req.url);
  const locale = asLocale(u.searchParams.get("lang") ?? "en");
  const none = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!feedKind(kind)) return none();
  const content = await loadSiteContent();
  if ((siteCanOpen() ? isComingSoon(content) : true) || !pageOn(content, "experiences")) return none();
  const xs = xpSettings(content, locale);
  if (!xs.general.calendars || (kind === "testride" && !xs.general.testRides)) return none();
  const rides = await loadRides();
  const now = riyadhClock(new Date());
  const sessions = upcoming(rides?.sessions ?? [], now).filter((s) => (s.testRide ? "testride" : s.kind) === kind);
  const host = u.hostname;
  const items = xpItems(sessions, {
    locale, content, now, nowMs: Date.now(), member: false, satLink: false, prices: priceMap(rides?.prices ?? []), window: siteBookingWindow(content),
    appBase: "", bookBase: localHref("/experiences", locale), facts: xs.facts,
  });
  const name = xpExtras(items, { content, locale, calendars: false, ratings: new Map(), wa: null, gatherWord: "", startWord: "" }).x.kindName[kind] ?? kind;
  const ics = icsFeed({
    name: `${name} · MicroMobility`, host,
    items: sessions.map((s, i) => {
      const tm = timesOf(s.times, s.gather, xs.facts[kind] ?? { gather: 0, minutes: 0 });
      return {
        id: s.id, date: s.date, name: items[i].name, gather: tm.gather, start: tm.start, end: tm.end,
        place: items[i].place && !items[i].place?.held ? items[i].place!.name : null,
        url: `${u.protocol}//${u.host}${localHref("/experiences", locale)}/s/${encodeURIComponent(s.id)}${locale === "en" ? "" : `?lang=${locale}`}`,
      };
    }),
  });
  return new Response(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=1800", "content-disposition": `inline; filename="${kind}.ics"` },
  });
}
