import { intlOf } from "@/i18n/locales";
import { guard, json } from "@/lib/pay/http";
import { payRpc } from "@/lib/pay/server";
import { loadSiteContent } from "@/lib/site";
import { orderOf } from "@/lib/store-order";
import { deliverySlots, slotDays, slotTimes } from "@/lib/store-settings";
import { addDays, afterSettings, bookedSlot, slotChangeOpen } from "@/lib/sx-B4";
import { afterRead, handoverSlots, slotChange } from "@/lib/sx-B4-api";

// POST /api/store/slot: Change time (N30, builder B4) on an order's page.
//   {action: "options", no, key, lang}: the days and windows the order can move to: a Jeddah delivery's from the store's
//     scheduled-delivery settings (F78, the same days and windows the checkout offers, lib/store-settings.ts), a pickup's
//     handover windows with places left on each of the next seven days (B3's store_handover_slots, N13).
//   {action: "change", no, key, day, time}: moves it there (store_after_slot_change checks the cut-off, the count and the
//     choice again, and writes a public event staff see in the order's history).
// The order is read with its own key first: only an order whose Change time shows gets options.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const no = typeof b.no === "number" ? b.no : Number(b.no);
  const key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  if (!Number.isInteger(no) || no < 1 || !/^[0-9a-f]{32}$/.test(key)) return json({ ok: false, error: "invalid" }, 400);
  if (b.action === "change") {
    const r = await slotChange({ no, key, day: String(b.day ?? ""), time: String(b.time ?? "") });
    return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, r.status);
  }
  if (b.action !== "options") return json({ ok: false, error: "invalid" }, 400);
  const [r, extra, content] = await Promise.all([payRpc<unknown>("store_order_get", { p_no: no, p_track: key }), afterRead(no, key), loadSiteContent()]);
  const o = r.status === 200 ? orderOf(r.data, key) : null;
  if (!o) return json({ ok: false, error: "not_found" }, 404);
  if (!extra) return json({ ok: false, error: "off" }, 404);
  if (!slotChangeOpen(o, Date.now(), afterSettings(content).change, extra.changes)) return json({ ok: false, error: "cutoff" }, 409);
  const cur = bookedSlot(o);
  const lang = typeof b.lang === "string" ? b.lang : "en";
  const fmt = new Intl.DateTimeFormat(intlOf(lang), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const label = (d: string) => fmt.format(new Date(`${d}T12:00:00Z`));
  const clock = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16); // the Riyadh clock, as the checkout reads it
  const today = clock.slice(0, 10);
  type Day = { day: string; label: string; times: { time: string; label: string }[] };
  let days: Day[] = [];
  if (o.fulfil === "jeddah") {
    const s = deliverySlots(content);
    if (s) days = slotDays(s, today, clock).map((d) => ({ day: d, label: label(d), times: slotTimes(s, d, clock).map((x) => ({ time: x.id, label: `${x.from}–${x.to}` })) }));
  } else if (o.fulfil === "pickup") {
    const list = await Promise.all(Array.from({ length: 7 }, (_, i) => addDays(today, i)).map(async (d) => ({ d, slots: await handoverSlots(d) })));
    days = list.map(({ d, slots }) => ({
      day: d, label: label(d),
      // today's windows only before they start
      times: (slots ?? []).filter((x) => d > today || x.from > clock.slice(11)).map((x) => ({ time: x.time, label: `${x.from}–${x.to}` })),
    }));
  }
  // the order's own window stays offered, so the pop-up opens on it
  days = days.filter((d) => d.times.length || d.day === cur?.day);
  return json({ ok: true, days });
}
