import { siteSchema } from "@/content/pages/site";
import { serverLocalize } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import { asLocale, resolvePage } from "@/lib/content";
import { payRpc } from "@/lib/pay/server";
import { withinLimit } from "@/lib/rate-limit";
import { loadSiteContent } from "@/lib/site";
import { isBike, loadStore } from "@/lib/store";
import { orderOf } from "@/lib/store-order";
import { afterSettings, bikeLines, bookedSlot, checkupDays, handoverOf, icsText, orderPath, slotCalendarOpen, type IcsEvent } from "@/lib/sx-B4";
import { T } from "@/components/store/sx-B4.text";

// GET /api/store/calendar?no=<n>&k=<key>&what=slot|checkup&lang=en|ar: Add to calendar (N03, builder B4) for a store
// order, as an .ics file the phone's calendar opens: the booked delivery window or pickup handover (alarms a day and an
// hour before), or the free first check-up of a delivered bike about half way through its window (alarms at 09:00 on
// the day and a week before; the free check-up's last day in its words). The order is read with its own key, as its
// page reads it; the calendar entry replaces the reminder email the store does not send (R5). Nothing is stored.
export const dynamic = "force-dynamic";

const no = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store, private" } });

export async function GET(req: Request) {
  if (!(await withinLimit(req, "pay"))) return no(429);
  const q = new URL(req.url).searchParams;
  const n = Number(q.get("no")), key = (q.get("k") ?? "").toLowerCase(), what = q.get("what"), lang = q.get("lang") === "ar" ? "ar" : "en";
  if (!Number.isInteger(n) || n < 1 || n > 999999999 || !/^[0-9a-f]{32}$/.test(key) || (what !== "slot" && what !== "checkup")) return no(400);
  const r = await payRpc<unknown>("store_order_get", { p_no: n, p_track: key });
  const read = r.status === 200 ? orderOf(r.data, key) : null;
  if (!read) return no(404);
  const o = { ...read, handover: handoverOf(r.data) };
  const [content, store] = await Promise.all([loadSiteContent(), loadStore()]);
  const t = serverLocalize(T, lang);
  const site = resolvePage(siteSchema, content, asLocale(lang));
  const origin = new URL(req.url).origin;
  const link = `${origin}${orderPath(o.no, key)}`;
  const id = `MM-${o.no}`;
  const showroom = typeof site.contact.address === "string" ? site.contact.address : "";
  const events: IcsEvent[] = [];
  if (what === "slot") {
    const s = bookedSlot(o);
    if (!s || !slotCalendarOpen(o)) return no(404);
    const pickup = o.fulfil === "pickup";
    events.push({
      uid: `mm-order-${o.no}-slot@micromobility.sa`, title: pickup ? t.calPickup(id) : t.calDelivery(id), day: s.day, from: s.from, to: s.to,
      location: pickup ? showroom : undefined, text: `${t.calOrder(id)}\n${link}`, url: link, alarms: ["-P1D", "-PT1H"],
    });
  } else {
    const bikes = new Set((store?.products ?? []).filter(isBike).map((p) => p.id));
    const set = afterSettings(content);
    const due = set.checkup.on ? checkupDays(o, set.checkup.weeks, bikeLines(o, bikes).length > 0) : null;
    if (!due) return no(404);
    const by = new Intl.DateTimeFormat(intlOf(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${due.by}T12:00:00Z`));
    const book = `${origin}/workshop?checkup=${encodeURIComponent(id)}`;
    events.push({
      uid: `mm-order-${o.no}-checkup@micromobility.sa`, title: t.calCheckup, day: due.remind, location: showroom,
      text: `${t.calCheckupText(by)}\n${book}`, url: book, alarms: ["PT9H", "-P6DT15H"],
    });
  }
  return new Response(icsText(events, Date.now()), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${id}-${what}.ics"`,
      "cache-control": "no-store, private",
      "x-robots-tag": "noindex",
    },
  });
}
