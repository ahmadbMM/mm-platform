// The Experiences list and each session's page, put together on the server (the Experiences build of 2026-11-18; the
// plain logic is lib/sx-B5.ts). Every word the server knows is written here in the page's language: the days, the
// clocks, the place, who may book, the facts staff keep in the Website editor (content/pages/xp.ts), and the Saturday
// ride's sunrise and routes. What a date's status and button are follows staging's booking (app/[locale]/experiences/
// page.tsx toBook): the booking window, members book first, Full no waitlist, Few spots left, the Saturday ride's code
// page and the kinds handed to the booking app.
import type { SiteContent } from "@/lib/site";
import { asLocale, resolvePage, type Locale } from "@/lib/content";
import { xpSchema, XP_KINDS } from "@/content/pages/xp";
import { experiencesSchema } from "@/content/pages/experiences";
import { kindNames, sessionName, type RideSession } from "@/lib/rides";
import { bookingAt, infoBreakfast, rentsBikes } from "@/lib/event-info";
import { bookingLink } from "@/lib/links";
import { BOOTH_DIR, BOOTH_PIN, dayWord, fmtClock, fmtDayNoYear, fmtDayTile, kmText, meetHeld, placeLink, revealWhen, venueOf, venueText } from "@/lib/tickets";
import { fromPrice, needsBike, typeOptions, type Prices } from "@/lib/booking";
import { notOpenYet, opensText, type BookingWindow } from "@/lib/booking-window";
import { mfAt } from "@/lib/members-first";
import { membersFirstWords } from "@/components/experiences/MembersFirst.words";
import { kindThemeWords } from "@/components/experiences/KindTheme.words";
import { T as TICKET } from "@/components/booking/tickets.text";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { fill } from "@/i18n/tx";
import { genderText } from "@/lib/session-gender";
import { BLOOD_NAME, bloodName } from "@/content/blood-words";
import { FARM_NAME, farmWords } from "@/content/farm-words";
import { routeNameOf, routeNames } from "@/lib/route-names";
import { sunriseHhmm } from "@/lib/kind-theme";
import { memo } from "@/lib/memo";
import { communityMember, getAccount, rpcServer } from "@/lib/account";
import { cache } from "react";
import { headers } from "next/headers";
import { pageState } from "@/lib/page-state";
import { loadRides, upcoming } from "@/lib/rides";
import { riyadhClock } from "@/lib/workshop-days";
import { siteSchema } from "@/content/pages/site";
import { navFrom } from "@/components/site/PageShell";
import { localHref } from "@/lib/links";
import { priceMap } from "@/lib/booking";
import { siteBookingWindow } from "@/lib/booking-window";
import {
  XP_EVENT_OF, XP_HERE, dirLink, waNumber, factLines, ksaMs, mapEmbed, paceChips, pinFromUrl, pinOf, pinText, ratingsOf, tempAt, timesOf,
  type XpFact, type XpItem, type XpPlace, type XpStatus,
} from "@/lib/sx-B5";

type KindKey = (typeof XP_KINDS)[number][0];
export type XpFacts = { meet: string; pin: string; gather: number; minutes: number; needs: string; bring: string; included: string; lang: string; pace: string; terms: string };
export type XpGeneral = { privateOn: boolean; calendars: boolean; weatherDays: number; ratingMin: number; testRides: boolean };

/** The facts staff wrote for every kind, and the switches for all sessions, in the page's language. */
export function xpSettings(content: SiteContent | null, locale: Locale): { general: XpGeneral; facts: Record<string, XpFacts> } {
  const c = resolvePage(xpSchema, content, locale) as unknown as Record<string, Record<string, unknown>>;
  const g = c.general ?? {};
  const facts: Record<string, XpFacts> = {};
  for (const [k] of XP_KINDS) {
    const f = c[k as KindKey] ?? {};
    const S = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const N = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    facts[k] = { meet: S(f.meet), pin: S(f.pin), gather: N(f.gather), minutes: N(f.minutes), needs: S(f.needs), bring: S(f.bring), included: S(f.included), lang: S(f.lang), pace: S(f.pace), terms: S(f.terms) };
  }
  return {
    general: {
      privateOn: g.privateOn !== false, calendars: g.calendars !== false, testRides: g.testRides === true,
      weatherDays: typeof g.weatherDays === "number" ? Math.max(0, Math.min(7, g.weatherDays)) : 5,
      ratingMin: typeof g.ratingMin === "number" ? Math.max(5, g.ratingMin) : 20,
    },
    facts,
  };
}

const NO_FACTS: XpFacts = { meet: "", pin: "", gather: 0, minutes: 0, needs: "", bring: "", included: "", lang: "", pace: "", terms: "" };

/** What the page knows about the visitor and the hour, for the rows' status and buttons. */
export type XpCtx = {
  locale: string; content: SiteContent | null;
  /** Riyadh's "YYYY-MM-DDTHH:MM" and the epoch now. */
  now: string; nowMs: number;
  member: boolean;
  /** The Saturday ride is booked at /saturday with a ride code (saturday_link_only). */
  satLink: boolean;
  prices: Prices;
  window: BookingWindow | null;
  /** The booking app's address (no query), for the kinds handed to it. */
  appBase: string;
  /** /experiences on this site, where a date is booked (?ev=&session=). */
  bookBase: string;
  facts: Record<string, XpFacts>;
};

/** Each session as a row and a page say it. */
export function xpItems(sessions: readonly RideSession[], ctx: XpCtx): XpItem[] {
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const L = asLocale(ctx.locale);
  const tx = serverL(ctx.locale);
  const page = resolvePage(experiencesSchema, ctx.content, L);
  const d = page.dates as Record<string, unknown>;
  const enD = L !== "en" ? (resolvePage(experiencesSchema, ctx.content, "en").dates as Record<string, unknown>) : d;
  // the names page.tsx gives: Petromin, the Blood Donation event and the Farm House Night by the server's own words
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين"), blood: bloodName(tx), farm: farmWords(tx).name };
  const enNames = L !== "en" ? { ...kindNames(enD), petromin: "Petromin", blood: BLOOD_NAME, farm: FARM_NAME } : names;
  // a circuit night by its event's one name (the owner, 2026-11-10: "Open Sports Day")
  const jccName = S((page.events as Record<string, unknown>).jccTitle) || names.jcc;
  const tk = serverLocalize(TICKET, ctx.locale);
  const kw = kindThemeWords(ctx.locale);
  const mfW = membersFirstWords(ctx.locale);
  const gw = genderText(tx);
  const today = ctx.now.slice(0, 10);
  const near = { today: tx("Today", "اليوم"), tomorrow: tx("Tomorrow", "غداً") };
  const clock = (hm: string | null) => (hm ? fmtClock(hm, ctx.locale) : null);
  const routes = routeNames(ctx.content, L);
  const venueWords = { meetingPoint: tk.meetingPoint, venueCircuit: tk.venueCircuit, venueJyc: tk.venueJyc, venueGymnation: tk.venueGymnation };

  return sessions.map((s): XpItem => {
    // a test ride (EF23; lib/rides.ts testRide) is a kind of its own here
    const kind = s.testRide ? "testride" : s.kind;
    const f = ctx.facts[kind] ?? NO_FACTS;
    const tm = timesOf(s.times, s.gather, f);
    // the status, as staging's booking says it (page.tsx toBook and BookingFlow's card)
    const win = ctx.window && notOpenYet(s.date, ctx.window, ctx.now, s.kind) ? opensText(s.date, ctx.window, ctx.locale, tx) : null;
    const mfMs = s.fbk ? 0 : mfAt(s, ctx.nowMs);
    const mfWhen = mfMs ? fill(mfW.everyone, revealWhen(s.publicAt, ctx.locale, today, near)) : "";
    const mfHold = !!mfMs && !ctx.member;
    const left = !s.full && !s.approval && s.left != null && s.left > 0 && s.left <= 3 ? s.left : null;
    const status: XpStatus | null = s.fbk ? { k: "fbk" }
      : win ? { k: "opens", text: win }
      : mfHold ? { k: "mf", held: true, label: mfW.status, when: mfWhen }
      : s.full ? { k: "wl" }
      : left ? { k: "left", n: left }
      : s.few ? { k: "few" }
      : mfMs ? { k: "mf", held: false, label: mfW.mark, when: mfWhen }
      : null;
    const ev = XP_EVENT_OF[kind] ?? "community";
    const blocked = !!s.fbk || !!win || mfHold;
    const act: XpItem["act"] = blocked ? { k: "none" }
      : ctx.satLink && s.kind === "saturday" ? { k: "out", href: `/saturday?lang=${ctx.locale}` }
      : !XP_HERE.has(kind) ? { k: "out", href: bookingAt(bookingLink(ctx.appBase, ctx.locale), ev, s.id) }
      : { k: "book", href: `${ctx.bookBase}?ev=${encodeURIComponent(ev)}&session=${encodeURIComponent(s.id)}#book` };
    const bookLike = { free: s.free, seat: s.kind === "event" ? s.price ?? 0 : null, kind: s.kind, community: s.kind !== "jcc" && s.kind !== "snd96", closedTypes: s.closedTypes ?? [] };
    const fp = s.kind === "blood" ? null : fromPrice(bookLike, ctx.prices);
    const price: XpItem["price"] = !fp ? null : fp.kind === "free" ? { k: "free" } : fp.kind === "seat" ? { k: "seat", n: fp.n } : { k: "from", n: fp.n };

    // where it is (EF01): the place the session names, else the kind's meeting point staff wrote; its map and Directions
    const held = meetHeld(s, ctx.nowMs);
    let place: XpPlace | null;
    if (held) {
      place = { name: tk.meetingPoint, dir: null, map: null, held: s.revealAt ? revealWhen(s.revealAt, ctx.locale, today, near) : "" };
    } else {
      const v = venueOf({ approval: !!s.approval, meetUrl: s.meetUrl ?? null, location: s.location ?? null, kind: s.kind });
      const named = !!(s.location || s.meetUrl);
      const name = !named && f.meet ? f.meet : venueText(v, venueWords);
      const pin = pinOf(f.pin) ?? pinFromUrl(s.meetUrl);
      const dir = pin && !(s.meetUrl && !pinFromUrl(s.meetUrl) && v.kind === "meet") ? dirLink(pinText(pin)) : placeLink({ approval: !!s.approval, kind: s.kind, meetUrl: s.meetUrl ?? null, location: s.location ?? null }, BOOTH_DIR);
      const q = pin ? pinText(pin) : v.kind === "circuit" ? BOOTH_PIN : v.kind === "jyc" ? "Jeddah Yacht Club" : v.kind === "text" ? `${v.text}, Jeddah` : v.kind === "gym" ? "Gymnation Tahlia Street, Jeddah" : null;
      place = { name, dir, map: q ? mapEmbed(q, ctx.locale === "ar" ? "ar" : "en") : null, held: null };
    }

    // the facts (EF05, EF06, EF30): who may book it, what it asks, what to bring, what comes with it, the cancellation terms
    const who = [
      s.members ? tx("Community members", "أعضاء المجتمع") : "",
      s.gender === "female" ? gw.female : s.gender === "male" ? gw.male : "",
      needsBike(s) ? tx("Ages 5 and up", "من عمر 5 سنوات") : "",
    ].filter(Boolean);
    const bike = rentsBikes(s.kind);
    const facts: XpFact[] = [
      { k: "who" as const, v: who },
      { k: "needs" as const, v: factLines(f.needs) },
      { k: "bring" as const, v: factLines(f.bring) },
      { k: "included" as const, v: [...(bike ? [tk.helmetLine] : []), ...factLines(f.included)] },
      { k: "collect" as const, v: s.collect ? [fill(tx("Collect bikes from {0}", "استلام الدراجات من {0}"), fmtClock(s.collect, ctx.locale))] : [] },
      { k: "route" as const, v: ((r) => (r ? [r] : []))(routeNameOf(routes, s.routeSlug)) },
      { k: "breakfast" as const, v: ((b) => (b && (!s.bfMembers || ctx.member) ? [b] : []))(infoBreakfast(s, ctx.locale)) },
      { k: "lang" as const, v: f.lang ? [f.lang] : [] },
      { k: "terms" as const, v: f.terms ? [f.terms] : [] },
    ].filter((x) => x.v.length > 0);

    const kmWord = tx("{0} km", "{0} كم");
    const sr = s.kind === "saturday" ? sunriseHhmm(s.date) : null;
    const kids = needsBike(s) && typeOptions({ community: bookLike.community, kind: s.kind, closedTypes: s.closedTypes ?? [] }).includes("Kids");
    return {
      id: s.id, date: s.date, kind, ev,
      name: s.kind === "jcc" ? jccName : kind === "testride" ? s.title || tx("Test ride", "تجربة دراجة") : sessionName(s, names, enNames, L !== "en", L === "ar"),
      near: ((w) => (w === "today" ? near.today : w === "tomorrow" ? near.tomorrow : null))(dayWord(s.date, today)),
      day: fmtDayNoYear(s.date, ctx.locale, today), tile: fmtDayTile(s.date, ctx.locale),
      start: clock(tm.start), gather: clock(tm.gather), end: clock(tm.end), hm: tm.gather ?? tm.start, len: tm.len,
      place, price, status, act,
      featured: !!s.featured, gender: s.gender ?? null, kids, members: s.members,
      sunrise: sr ? fill(kw.sunriseAt, fmtClock(sr, ctx.locale)) : null, temp: null,
      pace: paceChips(f.pace), lang: f.lang || null,
      facts,
      route: s.kind === "saturday"
        ? { beg: fill(kmWord, kmText(s.groupKm?.beg ?? 20)), int: fill(kmWord, kmText(s.groupKm?.int ?? 40)), start: tk.meetingPoint, begPlace: tk.venueJyc, intPlace: kw.intPlace }
        : null,
      desc: s.description ?? null,
    };
  });
}

// ── The weather at the start (EF24) ─────────────────────────────────────────────────────────

/** The Corniche, where nearly every session is (the booking app's sunrise point). */
const WX_AT = { lat: 21.54, lon: 39.17 };
/** MET Norway's forecast (free, commercial use allowed with credit, no key; it asks for a User-Agent that names the site),
 *  read at most once an hour by each Worker; null when it cannot be read. Open-Meteo's free plan is for non-commercial
 *  use only, so it is not used. */
export async function xpForecast(fetchImpl: typeof fetch = fetch): Promise<unknown> {
  return memo<unknown>("xp-forecast", {
    ttl: 3600e3,
    read: async (prev) => {
      try {
        const r = await fetchImpl(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${WX_AT.lat}&lon=${WX_AT.lon}`, {
          headers: { "User-Agent": "micromobility.sa/1.0 (+https://micromobility.sa)", Accept: "application/json" }, signal: AbortSignal.timeout(2500),
        });
        return r.ok ? await r.json() : prev;
      } catch {
        return prev;
      }
    },
  });
}

/** The temperature at each session's start within `days` days (0: none asked). */
export async function withWeather(items: XpItem[], days: number, nowMs: number, fetchImpl: typeof fetch = fetch): Promise<XpItem[]> {
  if (days <= 0) return items;
  const soon = items.filter((s) => s.hm && ksaMs(s.date, s.hm) - nowMs < days * 864e5);
  if (!soon.length) return items;
  const fc = await xpForecast(fetchImpl);
  if (!fc) return items;
  return items.map((s) => (s.hm && soon.includes(s) ? { ...s, temp: tempAt(fc, ksaMs(s.date, s.hm)) } : s));
}

// ── A kind's average rating (EF35) ──────────────────────────────────────────────────────────

/** Each kind's anonymous average (xp_kind_ratings, SX/sql/B5.sql), read with the public key and kept ten minutes; an
 *  empty map for a database without the function, or below the fewest ratings staff set. */
export async function xpRatings(min: number): Promise<Map<string, { avg: number; n: number }>> {
  const data = await memo<unknown>("xp-ratings", {
    ttl: 600e3,
    read: async (prev) => {
      const r = await rpcServer<unknown>("xp_kind_ratings", {});
      return r.status === 200 ? r.data : prev ?? [];
    },
  });
  return ratingsOf(data, min);
}

// ── What the list and the pages know beside the sessions ────────────────────────────────────

/** The order the kind chips name the kinds in: the booking app's (lib/kind-theme.ts KIND_ORDER) and then the others. */
export const XP_ORDER = ["saturday", "jcc", "swim", "petromin", "workshop", "event", "snd96", "yoga", "farm", "defe5k", "runher", "vlap", "arena", "blood", "testride"];
/** Kinds whose dates only some visitors see (a Petromin tag holder, a community member): no public calendar for them. */
const NO_FEED: ReadonlySet<string> = new Set(["petromin", "farm"]);
/** The kinds a public calendar is offered for. */
export const feedKind = (k: string): boolean => /^[a-z0-9]{2,20}$/.test(k) && !NO_FEED.has(k);

/** Each kind's name on its chip (short where the booking app has a short one), the words for the gathering and the
 *  start, each kind's calendar address (webcal, on this site's host), its average rating, and the WhatsApp number. */
export function xpExtras(items: readonly XpItem[], o: {
  content: SiteContent | null; locale: string; host: string; calendars: boolean; ratings: Map<string, { avg: number; n: number }>;
  wa: string | null; gatherWord: string; startWord: string;
}): { order: string[]; x: import("@/components/experiences/XpDetail").XpExtras } {
  const L = asLocale(o.locale);
  const tx = serverL(o.locale);
  const page = resolvePage(experiencesSchema, o.content, L);
  const kw = kindThemeWords(o.locale);
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const names: Record<string, string> = {
    ...kindNames(page.dates as Record<string, unknown>), saturday: kw.kinds.saturday, swim: kw.kinds.swim, petromin: kw.kinds.petromin,
    jcc: S((page.events as Record<string, unknown>).jccTitle) || kindNames(page.dates as Record<string, unknown>).jcc,
    blood: bloodName(tx), farm: farmWords(tx).name, testride: tx("Test rides", "تجربة الدراجات"),
  };
  const kinds = [...new Set(items.map((s) => s.kind))];
  // a kind without a name of its own is named by its first date
  for (const k of kinds) if (!names[k]) names[k] = items.find((s) => s.kind === k)?.name ?? k;
  const lang = o.locale;
  return {
    order: XP_ORDER,
    x: {
      kindName: names, gatherWord: o.gatherWord, startWord: o.startWord, wa: o.wa,
      cal: o.calendars && o.host ? Object.fromEntries(kinds.filter(feedKind).map((k) => [k, `webcal://${o.host}/api/xp/cal/${k}?lang=${encodeURIComponent(lang)}`])) : {},
      rating: Object.fromEntries([...o.ratings].filter(([k]) => kinds.includes(k))),
    },
  };
}

// ── One session's page (EM05-B) ─────────────────────────────────────────────────────────────

/** Everything a session's page needs, read once per request (its metadata and its page share it): the page's state, the
 *  session as a row says it (null when it is past, unknown, or not for this visitor: a Farm House Night to a community
 *  member alone, a Petromin night to a Petromin tag holder alone, a test ride while staff list them), and the extras. */
export const xpSession = cache(async (locale: string, id: string) => {
  const L = asLocale(locale);
  const [{ content, previewing, hidden, closed }, rides, signed] = await Promise.all([pageState("experiences"), loadRides(), getAccount()]);
  const site = resolvePage(siteSchema, content, L);
  const base = { content, site, previewing, hidden, closed };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ...base, item: null, x: null };
  const now = riyadhClock(new Date()), nowMs = Date.now();
  const s = upcoming(rides?.sessions ?? [], now).find((x) => x.id === id);
  const xs = xpSettings(content, L);
  if (!s || (s.testRide && !xs.general.testRides)) return { ...base, item: null, x: null };
  const [member, petromin, satLink] = await Promise.all([
    signed ? communityMember() : Promise.resolve(false),
    signed && s.kind === "petromin" ? rpcServer<boolean>("petromin_member", { p_id: signed.id, p_token: signed.token }).then((r) => r.data === true) : Promise.resolve(false),
    s.kind === "saturday" ? rpcServer<boolean>("saturday_link_only", {}).then((r) => r.data === true) : Promise.resolve(false),
  ]);
  if ((s.kind === "farm" && !member) || (s.kind === "petromin" && !petromin)) return { ...base, item: null, x: null };
  const appBase = navFrom(site as unknown as Record<string, Record<string, unknown>>).booking.replace(/[?#].*$/, "");
  const ctx: XpCtx = {
    locale, content, now, nowMs, member, satLink, prices: priceMap(rides?.prices ?? []), window: siteBookingWindow(content), appBase,
    bookBase: localHref("/experiences", locale), facts: xs.facts,
  };
  const [item] = await withWeather(xpItems([s], ctx), xs.general.weatherDays, nowMs);
  const [ratings, host] = await Promise.all([xpRatings(xs.general.ratingMin), headers().then((h) => h.get("host") ?? "")]);
  const d = resolvePage(experiencesSchema, content, L).dates as Record<string, unknown>;
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const social = (site as unknown as { social?: Record<string, unknown> }).social ?? {};
  const ex = xpExtras([item], { content, locale, host, calendars: xs.general.calendars, ratings, wa: xs.general.privateOn ? waNumber(S(social.whatsapp)) : null, gatherWord: S(d.gather), startWord: S(d.start) });
  return { ...base, item, x: ex.x };
});

/** The share picture of a kind's sessions (EF33): its drawing, its mark and its name, made once (scripts kept in the
 *  build's notes); the site's own for a kind without one. */
const OG_KINDS: ReadonlySet<string> = new Set(["saturday", "jcc", "swim", "workshop", "event", "snd96", "runher", "defe5k", "vlap", "arena", "blood", "yoga", "testride"]);
export const ogImageOf = (kind: string): string | undefined => (OG_KINDS.has(kind) ? `/site/experiences/og/${kind}.png` : undefined);
