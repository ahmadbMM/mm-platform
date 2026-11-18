import { cookies } from "next/headers";
import { experiencesSchema } from "@/content/pages/experiences";
import { readBookings, rpcServer } from "@/lib/account";
import type { Session } from "@/lib/account-core";
import { asLocale, resolvePage } from "@/lib/content";
import { kindNames, loadSessionsById, sessionName } from "@/lib/rides";
import { dayLabel } from "@/lib/store-checkout";
import { readyDay, workingDay } from "@/lib/store-delivery";
import { addDays, boxCookie, CART_N_COOKIE, reserveHeights, reserveOf, sessionChoices, sxSettings } from "@/lib/sx-b3";
import { handoverOf, HANDOVER_OFF, type Handover } from "@/lib/sx-b3-handover";
import { intlOf } from "@/i18n/locales";
import type { SxCheckout } from "./CheckoutPlus";
import type { StoreState } from "./store-data";

// What checkout's parts of the build of 2026-11-18 (B3) need from the server: the switches, whether learn-to-ride takes
// sign-ups, the account's booked sessions a small order can be handed over at (N15), the handover slots (N13) and the
// height to keep before the cart is read (P10). Every read that fails leaves its part out.

/** Learn-to-ride is on and taking sign-ups (Experiences > Learn to ride): "I'm still learning" (N17) only then. */
export function learnOpen(s: StoreState, locale: string): boolean {
  const l = resolvePage(experiencesSchema, s.content, asLocale(locale)).learn as { on?: unknown; taking?: unknown };
  return l.on === true && l.taking === true;
}

/** The handover slots (store_handover_slots), off when the switch is off or the database has no such function. */
export async function handoverSlots(on: boolean, day: string | null = null): Promise<Handover> {
  if (!on) return HANDOVER_OFF;
  const r = await rpcServer<unknown>("store_handover_slots", { p_day: day });
  return r.status === 200 ? handoverOf(r.data) : HANDOVER_OFF;
}

export async function sxCheckout(s: StoreState, locale: string, acct: Session | null, opts: { lines: number | null; quote?: SxCheckout["quote"] } = { lines: null }): Promise<SxCheckout> {
  const settings = sxSettings(s.content);
  const jar = await cookies();
  // a buy-now or a quote's lines are known here; the cart's only as its count
  const n = opts.lines ?? jar.get(CART_N_COOKIE)?.value;
  const reserve = reserveHeights(reserveOf(typeof n === "number" ? String(n) : n, jar.get(boxCookie("co"))?.value), "co");
  const [handover, sessions] = await Promise.all([handoverSlots(settings.handover), settings.session.on && acct ? bookedSessions(s, locale, acct, settings.session.days) : []]);
  return { settings, learnOpen: settings.learning && learnOpen(s, locale), sessions, handover, quote: opts.quote ?? null, reserve };
}

/** The account's seated bookings from the day an order is ready to `days` on, named as the Experiences page names them. */
async function bookedSessions(s: StoreState, locale: string, acct: Session, days: number): Promise<SxCheckout["sessions"]> {
  const rows = await readBookings(acct);
  if (!rows) return [];
  const from = readyDay(s.settings, s.today) ?? workingDay(s.today, 1);
  const picks = sessionChoices(rows, from, addDays(s.today, days));
  if (!picks.length) return [];
  const L = asLocale(locale), intl = intlOf(locale);
  const found = await loadSessionsById(picks.map((p) => p.session), fetch, acct);
  const names = { ...kindNames(resolvePage(experiencesSchema, s.content, L).dates as Record<string, unknown>) };
  const en = { ...kindNames(resolvePage(experiencesSchema, s.content, "en").dates as Record<string, unknown>) };
  return picks.map((p) => {
    const se = found.find((x) => x.id === p.session);
    const name = se ? sessionName(se, names, en, L !== "en", L === "ar") : "";
    return { entry: p.entry, date: p.date, label: [name, dayLabel(p.date, intl)].filter(Boolean).join(" · ") };
  });
}
