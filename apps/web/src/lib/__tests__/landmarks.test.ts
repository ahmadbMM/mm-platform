import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as ride-record.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { anniversaryOf, annivLine, LM_KINDS, triedKinds } from "../landmarks";
import { loadOpenKinds } from "../ride-record-data";
import { recordRows, rideMore, rideStats, type RecordSession } from "../ride-record";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import { LOCALES } from "@/i18n/locales";
import { LANDMARK_WORDS, annivTitle, landmarkWords } from "@/components/account/Landmarks.words";
import { Anniversary, TriedKinds } from "@/components/account/Landmarks";
import RideMore from "@/components/account/RideMore";
import { T as RECORD } from "@/components/account/RideRecord.text";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// cookies() is a request's; here it holds the account's cookie a test sets, or none (as blood.test.ts).
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));

// Personal landmarks on My Account > Stats, as the booking app's (new features build F16, 2026-11-13: _lmAnniv, _lmLine,
// _lmKindsHtml, LM_KINDS; its tests/personal-landmarks.spec.ts): the first ride's anniversary card for its week, and the
// kinds tried under By event. Both private, drawn from the rider's own bookings; nothing is sent.

describe("the first ride's anniversary (anniversaryOf, the booking app's _lmAnniv)", () => {
  it("shows for the seven days from the date, every year, never before", () => {
    expect(anniversaryOf("2097-01-04", "2099-01-03")).toBeNull(); // the evening before
    expect(anniversaryOf("2097-01-04", "2099-01-04")).toEqual({ years: 2, first: "2097-01-04" });
    expect(anniversaryOf("2097-01-04", "2099-01-10")).toEqual({ years: 2, first: "2097-01-04" }); // the seventh day
    expect(anniversaryOf("2097-01-04", "2099-01-11")).toBeNull(); // the eighth
    expect(anniversaryOf("2097-01-04", "2099-06-15")).toBeNull();
    expect(anniversaryOf("2097-01-04", "2098-01-06")).toEqual({ years: 1, first: "2097-01-04" });
  });
  it("keeps 28 February for a first ride on 29 February, finds a week over New Year, and needs a year and a date", () => {
    const years = (first: string, today: string) => anniversaryOf(first, today)?.years ?? 0;
    // the booking app's own table (personal-landmarks.spec.ts)
    expect([
      years("2096-02-29", "2097-02-27"), years("2096-02-29", "2097-02-28"), years("2096-02-29", "2097-03-06"), years("2096-02-29", "2097-03-07"),
      years("2096-02-29", "2104-02-29"), years("2096-02-29", "2104-02-28"),
      years("2096-12-28", "2098-01-03"), years("2096-12-28", "2098-01-04"),
      years("2097-01-04", "2097-01-04"), years("", "2099-01-04"), years("2097-01-04", "2096-01-04"),
    ]).toEqual([0, 1, 1, 0, 8, 0, 1, 0, 0, 0, 0]);
    expect(anniversaryOf(null, "2099-01-04")).toBeNull();
    expect(anniversaryOf("2097-1-4", "2099-01-04")).toBeNull();
  });
  it("counts from the first BIKE ride, the date Your rides calls First ride: a pool session before it starts nothing", () => {
    const rows = recordRows([
      { id: "p", session_id: "sw-0", session_date: "2096-11-01", status: "done", paid: true, price: 0, type_preference: "None", queue_num: 3 },
      { id: "a", session_id: "2097-01-04", session_date: "2097-01-04", status: "done", paid: true, price: 75, type_preference: "Road", queue_num: 3 },
      { id: "b", session_id: "2098-02-06", session_date: "2098-02-06", status: "done", paid: true, price: 75, type_preference: "Road", queue_num: 3 },
    ]);
    const ses = new Map<string, RecordSession>([["sw-0", { kind: "swim", freeRide: true }], ["2097-01-04", { kind: "jcc", freeRide: false }], ["2098-02-06", { kind: "jcc", freeRide: false }]]);
    const first = rideStats(rows, ses, "2099-01-05")?.first;
    expect(first).toBe("2097-01-04");
    expect(anniversaryOf(first, "2098-11-03")).toBeNull(); // two years after the pool session
    expect(anniversaryOf(first, "2099-01-05")?.years).toBe(2);
  });
});

describe("the team's line (annivLine, the booking app's _lmLine)", () => {
  const content = (v: unknown) => ({ "msg.templates": v });
  it("is the admins' own in the reader's language, else none and the built-in line", () => {
    const c = content({ lm_anniv: { en: "  Two laps round the sun with us. Thank you.  ", ar: "" } });
    expect(annivLine(c, "en")).toBe("Two laps round the sun with us. Thank you.");
    expect(annivLine(c, "fr")).toBeNull(); // French keeps its own built-in line
    expect(annivLine(c, "ar")).toBeNull(); // an empty one is none
    for (const v of [null, undefined, "x", [], {}, { lm_anniv: "x" }, { lm_anniv: { en: 5 } }, { lm_anniv: { en: "   " } }, { other: { en: "x" } }]) expect(annivLine(content(v), "en"), JSON.stringify(v)).toBeNull();
    expect(annivLine(null, "en")).toBeNull();
    expect(annivLine(content({ lm_anniv: { en: "x" } }), "toString")).toBeNull();
  });
});

describe("the kinds tried (triedKinds, the booking app's _lmKindsHtml)", () => {
  it("lists every kind on offer or done in the app's order, ticked where one was completed", () => {
    // the booking app's spec: the circuit, the Saturday ride, the pool and yoga on offer; Run for Her over but done
    expect(triedKinds(["swim", "jcc", "runher"], ["jcc", "saturday", "swim", "yoga"])).toEqual([
      { kind: "jcc", done: true }, { kind: "saturday", done: false }, { kind: "swim", done: true }, { kind: "yoga", done: false }, { kind: "runher", done: true },
    ]);
    expect(LM_KINDS).toEqual(["jcc", "saturday", "petromin", "swim", "yoga", "workshop", "event", "snd96", "runher", "defe5k", "vlap", "arena", "blood"]);
  });
  it("is no checklist with one kind alone", () => {
    expect(triedKinds(["jcc"], ["jcc"])).toEqual([]);
    expect(triedKinds([], [])).toEqual([]);
    expect(triedKinds([], ["jcc", "jcc"])).toEqual([]);
    expect(triedKinds(["jcc"], ["saturday"])).toHaveLength(2);
  });
});

describe("the landmarks' words", () => {
  it("are there in every language the site speaks, and the booking app's own in the ten it shares", () => {
    expect(Object.keys(LANDMARK_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    for (const { code } of LOCALES) {
      const w = LANDMARK_WORDS[code];
      for (const k of ["line", "sign", "kinds", "done", "notYet"] as const) expect(w[k].trim(), `${code}.${k}`).not.toBe("");
      if (code !== "ar") expect(w.sign, code).toContain("MicroMobility"); // the app's Arabic writes the name in Arabic
      for (const [f, s] of Object.entries(w.anniv)) expect(code === "ar" && (f === "one" || f === "two") ? true : s.includes("{0}"), `${code}.anniv.${f}`).toBe(true); // Arabic's singular and dual say no number
    }
    expect(landmarkWords("en")).toMatchObject({ line: "Thank you for riding with us. Here is to many more rides together.", sign: "The MicroMobility team", kinds: "Tried so far", done: "Done", notYet: "Not yet" });
    expect(landmarkWords("ar")).toMatchObject({ sign: "فريق مايكروموبيليتي", kinds: "ما جرّبته حتى الآن", done: "تمّ", notYet: "ليس بعد" });
    expect(landmarkWords("fr").line).toBe("Merci de rouler avec nous. À de nombreuses sorties encore, ensemble.");
    expect(landmarkWords("bn").kinds).toBe("এখন পর্যন্ত যা করেছেন");
    expect(landmarkWords("xx")).toBe(LANDMARK_WORDS.en);
  });
  it("hold no emoji and write digits in Latin", () => {
    const all = JSON.stringify(LANDMARK_WORDS);
    expect(/\p{Extended_Pictographic}/u.test(all)).toBe(false);
    expect(all).not.toMatch(/[०-९০-৯٠-٩۰-۹]/);
  });
  it("never call the checklist's heading or states a ride (it lists sessions without a bike too)", () => {
    expect(LANDMARK_WORDS.en.kinds + LANDMARK_WORDS.en.done + LANDMARK_WORDS.en.notYet).not.toMatch(/ride|bike|cycl/i);
    expect(LANDMARK_WORDS.ar.kinds + LANDMARK_WORDS.ar.done + LANDMARK_WORDS.ar.notYet).not.toMatch(/جولة|جولات|دراج/);
  });
  it("say the years in each language's own plural form", () => {
    expect(annivTitle("en", 1)).toBe("1 year since your first ride");
    expect(annivTitle("en", 2)).toBe("2 years since your first ride");
    expect(annivTitle("ar", 1)).toBe("عام على أول جولة لك"); // the singular, no number
    expect(annivTitle("ar", 2)).toBe("عامان على أول جولة لك"); // the dual
    expect(annivTitle("ar", 3)).toBe("3 أعوام على أول جولة لك");
    expect(annivTitle("ar", 11)).toBe("11 عاماً على أول جولة لك");
    expect(annivTitle("fr", 2)).toBe("2 ans depuis votre première sortie");
    expect(annivTitle("ur", 1)).toBe("آپ کی پہلی رائیڈ کو 1 سال ہو گیا");
    expect(annivTitle("ru", 1)).toBe("1 год с вашего первого заезда");
    expect(annivTitle("ru", 3)).toBe("3 года с вашего первого заезда");
    expect(annivTitle("ru", 5)).toBe("5 лет с вашего первого заезда");
    expect(annivTitle("de", 1)).toBe("1 Jahr seit deiner ersten Fahrt");
    expect(annivTitle("ja", 4)).toBe("初めてのライドから4年");
    expect(annivTitle("xx", 2)).toBe("2 years since your first ride");
  });
});

describe("the pieces on Stats", () => {
  it("the card: the years, the first ride's date, the team's line and its name", () => {
    const html = renderToStaticMarkup(createElement(Anniversary, { locale: "en", years: 2, first: "2097-01-04", firstLabel: "First ride", line: null }));
    expect(html).toContain('class="myr lm-anniv" id="lm-anniv"');
    expect(html).toContain('<p class="lm-anniv-t">2 years since your first ride</p>');
    expect(html).toContain('<p class="lm-anniv-d">First ride · <bdi>4 Jan 2097</bdi></p>');
    expect(html).toContain('<p class="lm-anniv-l">Thank you for riding with us. Here is to many more rides together.</p>');
    expect(html).toContain('<p class="lm-anniv-s">The MicroMobility team</p>');
    const own = renderToStaticMarkup(createElement(Anniversary, { locale: "en", years: 2, first: "2097-01-04", firstLabel: "First ride", line: "Two laps round the sun with us." }));
    expect(own).toContain(">Two laps round the sun with us.</p>");
    expect(own).toContain(">The MicroMobility team</p>"); // always signed
    const ar = renderToStaticMarkup(createElement(Anniversary, { locale: "ar", years: 1, first: "2097-01-04", firstLabel: "أول جولة", line: null }));
    expect(ar).toContain(">عام على أول جولة لك</p>");
    expect(ar).toContain(">شكراً لمشاركتك الجولات معنا. نتطلع إلى جولات كثيرة قادمة معاً.</p>");
  });
  it("the checklist: a tick or a ring, the kind's own name and its state said to a screen reader", () => {
    const name = (k: string) => ({ jcc: "Open Sports Day", saturday: "Saturday Social Ride", swim: "Triathlon Pool Session", yoga: "Hatha Yoga for Cyclists", runher: "Run for Her" })[k] ?? k;
    const html = renderToStaticMarkup(createElement(TriedKinds, { locale: "en", kinds: triedKinds(["swim", "jcc", "runher"], ["jcc", "saturday", "swim", "yoga"]), name }));
    expect(html).toContain('<p class="myr-h lm-kinds-h"><span>Tried so far</span><bdi>3/5</bdi></p>');
    expect([...html.matchAll(/<li( class="on")?>/g)].map((m) => !!m[1])).toEqual([true, false, true, false, true]);
    expect([...html.matchAll(/<span>([^<]+)<\/span><span class="myr-sr">([^<]+)<\/span>/g)].map((m) => [m[1], m[2]])).toEqual([
      ["Open Sports Day", "Done"], ["Saturday Social Ride", "Not yet"], ["Triathlon Pool Session", "Done"], ["Hatha Yoga for Cyclists", "Not yet"], ["Run for Her", "Done"],
    ]);
    expect(html.match(/<svg/g)).toHaveLength(3);
    expect(html.match(/<i aria-hidden="true"><\/i>/g)).toHaveLength(2);
    expect(renderToStaticMarkup(createElement(TriedKinds, { locale: "en", kinds: [{ kind: "jcc", done: true }], name }))).toBe("");
  });
  it("sits under By event, above Badges earned", () => {
    const rows = recordRows([{ id: "a", session_id: "2099-06-01", session_date: "2099-06-01", status: "done", paid: true, type_preference: "Road", queue_num: 1 }]);
    const ses = new Map<string, RecordSession>([["2099-06-01", { kind: "jcc", freeRide: false }]]);
    const more = rideMore(rows, ses, "2099-06-15", { type: (x) => x, kind: (k) => k });
    const tried = createElement(TriedKinds, { locale: "en", kinds: triedKinds(["jcc"], ["saturday"]), name: (k: string) => k });
    const props = { locale: "en", more, t: RECORD.en, typeName: (x: string) => x, kindName: (k: string) => k, earned: { n: 1, of: 30, href: "/account/badges" } };
    const html = renderToStaticMarkup(createElement(RideMore, { ...props, tried }));
    const at = (s: string) => html.indexOf(s);
    expect(at(">By event<")).toBeGreaterThan(0);
    expect(at("lm-kinds")).toBeGreaterThan(at(">By event<"));
    expect(at("myr-bd")).toBeGreaterThan(at("lm-kinds"));
    expect(renderToStaticMarkup(createElement(RideMore, props))).not.toContain("lm-kinds");
  });
});

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const absent = () => json({ code: "PGRST202", message: "Could not find the function" }, 404);

/** list_sessions as PostgREST answers it: the query's id, date and status filters applied to `rows`. */
function listSessions(rows: Record<string, unknown>[], url: string): Record<string, unknown>[] {
  const q = new URL(url).searchParams;
  const ids = /^in\.\((.*)\)$/.exec(q.get("id") ?? "")?.[1]?.split(","), from = /^gte\.(.*)$/.exec(q.get("session_date") ?? "")?.[1];
  const st = /^in\.\((.*)\)$/.exec(q.get("status") ?? "")?.[1]?.split(",");
  return rows.filter((r) => (!ids || ids.includes(String(r.id))) && (!from || String(r.session_date) >= from) && (!st || st.includes(String(r.status))));
}

beforeEach(() => {
  jar.account = "";
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the kinds still on offer (loadOpenKinds)", () => {
  const S = [
    { id: "2099-06-20", session_date: "2099-06-20", status: "open", ride_kind: null, event_kind: null },
    { id: "sat-9", session_date: "2099-06-27", status: "full", ride_kind: null, event_kind: "community" },
    { id: "sw-9", session_date: "2099-06-21", status: "closed", ride_kind: "swim", event_kind: "community" },
    { id: "yg-1", session_date: "2099-05-01", status: "open", ride_kind: "yoga", event_kind: "community" },
    { id: "pm-9", session_date: "2099-06-22", status: "open", ride_kind: "petromin", event_kind: "community" },
  ];
  it("are the sessions the account is sent, open or full, today or later, through list_sessions with its token; Petromin left out", async () => {
    const f = vi.fn(async (url: string) => json(listSessions(S, url)));
    expect([...(await loadOpenKinds("2099-06-15", { id: "c1", token: "t0k" }, f as unknown as typeof fetch)) ?? []].sort()).toEqual(["jcc", "saturday"]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/rest/v1/rpc/list_sessions?select=id,session_date,status,ride_kind,event_kind&session_date=gte.2099-06-15&status=in.(open,full)");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: "t0k" });
  });
  it("is null when they cannot be read, so the checklist shows nothing", async () => {
    expect(await loadOpenKinds("2099-06-15", null, (async () => json({ message: "down" }, 503)) as unknown as typeof fetch)).toBeNull();
    expect(await loadOpenKinds("2099-06-15", null, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
    expect(await loadOpenKinds("2099-06-15", null, (async () => json({ x: 1 })) as unknown as typeof fetch)).toBeNull();
    expect(await loadOpenKinds("15/06/2099", null, (async () => json([])) as unknown as typeof fetch)).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(await loadOpenKinds("2099-06-15", null, (async () => json([])) as unknown as typeof fetch)).toBeNull();
  });
});

/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}

describe("My Account > Stats", () => {
  // The record: a pool session first (2096-11-01), the first bike ride on 2097-01-04, another in 2098, Run for Her in
  // 2098 (over), a yoga class booked and cancelled. On offer: the circuit, the Saturday ride, a pool session, yoga.
  const sessions = [
    { id: "sw-0", session_date: "2096-11-01", status: "closed", event_kind: "community", ride_kind: "swim" },
    { id: "2097-01-04", session_date: "2097-01-04", status: "closed", event_kind: null, ride_kind: null },
    { id: "2098-02-06", session_date: "2098-02-06", status: "closed", event_kind: null, ride_kind: null },
    { id: "rh-1", session_date: "2098-03-08", status: "closed", event_kind: "community", ride_kind: "runher" },
    { id: "2099-12-20", session_date: "2099-12-20", status: "open", event_kind: null, ride_kind: null },
    { id: "sat-9", session_date: "2099-12-26", status: "full", event_kind: "community", ride_kind: null },
    { id: "sw-9", session_date: "2099-12-21", status: "open", event_kind: "community", ride_kind: "swim" },
    { id: "yg-9", session_date: "2099-12-22", status: "open", event_kind: "community", ride_kind: "yoga" },
  ];
  const bk = (id: string, sid: string, date: string, o: Record<string, unknown> = {}) => ({ id, session_id: sid, session_date: date, session_day: "Sunday", name: "Spec Rider", status: "done", paid: true, price: 75, type_preference: "Road", queue_num: 3, ...o });
  const rows = [bk("p", "sw-0", "2096-11-01", { type_preference: "None", price: 0 }), bk("a", "2097-01-04", "2097-01-04"), bk("b", "2098-02-06", "2098-02-06"), bk("r", "rh-1", "2098-03-08", { type_preference: "None" })];
  const stats = async (when: string, o: { locale?: string; templates?: unknown; list?: (url: string) => Response | null } = {}) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(when));
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    const f = vi.fn(async (url: string) => {
      if (url.includes("/rpc/customer_profile")) return json([{ name: "Spec Rider", email: "rider@example.test", phone: "+966500000000" }]);
      if (url.includes("/rpc/my_bookings")) return json(rows);
      if (url.includes("/rpc/list_sessions")) return o.list?.(url) ?? json(listSessions(sessions, url));
      if (url.includes("/rpc/customer_helper_path")) return absent();
      if (url.includes("/rest/v1/site_content")) return json(o.templates ? [{ key: "msg.templates", value: o.templates }] : []);
      return json([]);
    });
    vi.stubGlobal("fetch", f);
    const page = await AccountPage({ params: Promise.resolve({ locale: o.locale ?? "en", part: ["stats"] }), searchParams: Promise.resolve({}) });
    const card = findAll(page, Anniversary)[0];
    const more = findAll(page, RideMore)[0] as ReactElement<{ tried?: ReactElement | null }> | undefined;
    return { card: card ? renderToStaticMarkup(card) : "", tried: more?.props.tried ? renderToStaticMarkup(more.props.tried) : "", page };
  };
  it("leads with the anniversary card in its week, the first BIKE ride's, with the team's line", async () => {
    const on = await stats("2099-01-04T06:00:00Z");
    expect(on.card).toContain(">2 years since your first ride<");
    expect(on.card).toContain("First ride · <bdi>4 Jan 2097</bdi>");
    expect(on.card).toContain(">Thank you for riding with us. Here is to many more rides together.<");
    const section = findAll(on.page, "section").find((s) => (s.props as { "aria-label"?: string })["aria-label"] === "Stats") as ReactElement<{ children: unknown[] }>;
    expect((section.props.children as unknown[]).find((x) => x)).toBe(findAll(on.page, Anniversary)[0]); // first in the part
    expect((await stats("2099-01-03T20:30:00Z")).card).toBe(""); // 23:30 the evening before, in Riyadh
    expect((await stats("2099-01-03T21:10:00Z")).card).not.toBe(""); // 00:10 on the day, in Riyadh
    expect((await stats("2098-11-03T09:00:00Z")).card).toBe(""); // two years after the pool session, which is not a ride
  });
  it("says the admins' own line where they wrote one in the reader's language", async () => {
    const templates = { lm_anniv: { en: "Two laps round the sun with us. Thank you." } };
    expect((await stats("2099-01-05T09:00:00Z", { templates })).card).toContain(">Two laps round the sun with us. Thank you.<");
    const fr = await stats("2099-01-05T09:00:00Z", { templates, locale: "fr" });
    expect(fr.card).toContain(">Merci de rouler avec nous. À de nombreuses sorties encore, ensemble.<");
    expect(fr.card).toContain(">2 ans depuis votre première sortie<");
  });
  it("lists the kinds tried under By event, and none when what is on offer cannot be read", async () => {
    const { tried } = await stats("2099-06-15T09:00:00Z");
    expect(tried).toContain("<bdi>3/5</bdi>");
    expect([...tried.matchAll(/<span>([^<]+)<\/span><span class="myr-sr">([^<]+)<\/span>/g)].map((m) => `${m[1]}:${m[2]}`)).toEqual([
      "Open Sports Day:Done", "Saturday Social Ride:Not yet", "Triathlon Pool Session:Done", "Hatha Yoga for Cyclists:Not yet", "Run for Her:Done",
    ]);
    // the bookings' sessions read, the sessions on offer not: By event stands, the checklist does not
    const down = await stats("2099-06-15T09:00:00Z", { list: (url) => (url.includes("status=in.(open,full)") ? json({ message: "down" }, 503) : null) });
    expect(down.tried).toBe("");
    expect(renderToStaticMarkup(findAll(down.page, RideMore)[0])).toContain(">Run for Her<");
  });
});
