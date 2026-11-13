import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { P5, firstFive, firstFiveIds } from "../first-five";
import type { RecordSession } from "../ride-record";
import { resetSiteContent } from "../site";
import { RATING_FIN_WORDS } from "../../components/account/RatingFin.words";
import { LOCALES } from "../../i18n/locales";
import { POST } from "../../app/api/account/rating-fin/route";

// The first five rides (the booking app's new features build F1, the owner 2026-11-13; its _p5N, _p5Fin, _rgFinFor and
// tests/first-five-rides.spec.ts): the path counted from the account's own bookings, and the rating's last screen that
// shows it, to members and non-members alike. Every database call is stubbed.
const TODAY = "2026-11-15";
const DETAIL = { form: "social", s: { overall: 9 } };
/** A ride done, paid and rated with the full form, on the session of that day. */
const ride = (id: string, date: string, o: Record<string, unknown> = {}) =>
  ({ id, session_id: date, session_date: date, status: "done", paid: true, queue_num: 1, type_preference: "Road", rating_detail: DETAIL, ...o });
const RENTAL: RecordSession = { kind: "jcc", freeRide: false };
const SATURDAY: RecordSession = { kind: "saturday", freeRide: true };
const POOL: RecordSession = { kind: "swim", freeRide: true };
const map = (o: Record<string, RecordSession>) => new Map(Object.entries(o));
const DAYS = ["2026-11-14", "2026-11-07", "2026-10-31", "2026-10-24", "2026-10-17", "2026-10-10"];
/** n rides on the circuit, the newest (e1, 14 November) the one just rated. */
const rides = (n: number) => DAYS.slice(0, n).map((d, i) => ride(`e${i + 1}`, d));
const kinds = (n: number, k: RecordSession = RENTAL) => map(Object.fromEntries(DAYS.slice(0, n).map((d) => [d, k])));

describe("the first five rides' count", () => {
  it("is the rides ridden, one a night, the first ride already one of the five", () => {
    expect(P5).toBe(5);
    expect(firstFive(rides(1), "e1", kinds(1), TODAY)).toEqual({ n: 1, tg: 5, book: true });
    expect(firstFive(rides(4), "e1", kinds(4), TODAY)).toEqual({ n: 4, tg: 5, book: true });
    // a party is one night: the friend's row on the same ride adds nothing
    expect(firstFive([...rides(2), ride("e1b", "2026-11-14", { queue_num: 2 })], "e1", kinds(2), TODAY)).toEqual({ n: 2, tg: 5, book: true });
  });
  it("counts a ride as Your rides does: paid, a free community ride, or the rider's own bike", () => {
    const rows = [ride("e1", "2026-11-14", { paid: false }), ride("e2", "2026-11-07", { paid: false, type_preference: "Own" }), ride("e3", "2026-10-31", { paid: false })];
    // the Saturday ride is free; the own bike is never paid for; the rental not paid yet is not ridden
    expect(firstFive(rows, "e1", map({ "2026-11-14": SATURDAY, "2026-11-07": RENTAL, "2026-10-31": RENTAL }), TODAY)).toEqual({ n: 2, tg: 5, book: true });
    // a booking not done (on the bike, cancelled, a no-show) is not a ride ridden
    const more = [...rides(1), ride("e7", "2026-11-07", { status: "cancelled" }), ride("e8", "2026-10-31", { status: "noshow" })];
    expect(firstFive(more, "e1", kinds(3), TODAY)).toEqual({ n: 1, tg: 5, book: true });
  });
  it("never counts a session without a bike, and a session without a bike rated shows no path", () => {
    const pool = map({ ...Object.fromEntries(kinds(2)), "2026-10-31": POOL });
    expect(firstFive(rides(3), "e1", pool, TODAY)).toEqual({ n: 2, tg: 5, book: true });
    // the pool's session itself rated: no path (it is not a ride), however few the rides
    expect(firstFive(rides(3), "e3", pool, TODAY)).toBeNull();
    // a session that did not load: its id names a kind without a bike (yoga), else it is a ride
    const yoga = [ride("y1", "2026-11-12", { session_id: "2026-11-12-yg" }), ...rides(1)];
    expect(firstFive(yoga, "y1", new Map(), TODAY)).toBeNull();
    expect(firstFive(yoga, "e1", new Map(), TODAY)).toEqual({ n: 1, tg: 5, book: true });
  });
  it("has nothing to show with no ride yet, and none from the fifth ride on", () => {
    expect(firstFive([ride("e1", "2026-11-14", { paid: false })], "e1", kinds(1), TODAY)).toBeNull();
    expect(firstFive(rides(5), "e1", kinds(5), TODAY)).toBeNull();
    expect(firstFive(rides(6), "e1", kinds(6), TODAY)).toBeNull();
    // a booking the account's rows do not hold
    expect(firstFive(rides(2), "e9", kinds(2), TODAY)).toBeNull();
  });
  it("offers Book only with nothing booked ahead, as My Account's tickets count ahead", () => {
    const ahead = (o: Record<string, unknown>) => firstFive([...rides(2), { id: "u1", session_id: "2026-11-21", session_date: "2026-11-21", status: "waiting", queue_num: 4, ...o }], "e1", kinds(2), TODAY)?.book;
    expect(ahead({})).toBe(false);
    expect(ahead({ status: "waitlist" })).toBe(false);
    expect(ahead({ session_id: TODAY, session_date: TODAY })).toBe(false); // tonight's
    expect(ahead({ status: "active", session_id: "2026-11-14", session_date: "2026-11-14" })).toBe(false); // still on the bike from last night
    expect(ahead({ status: "cancelled" })).toBe(true);
    expect(ahead({ session_id: "2026-11-13", session_date: "2026-11-13" })).toBe(true); // a night gone by
  });
  it("needs to know the sessions of the finished bookings only, each once", () => {
    expect(firstFiveIds([...rides(2), ride("e1b", "2026-11-14", { queue_num: 2 }), { id: "u1", session_id: "2026-11-21", session_date: "2026-11-21", status: "waiting" }])).toEqual(["2026-11-14", "2026-11-07"]);
    expect(firstFiveIds([])).toEqual([]);
  });
});

describe("the first five rides' words", () => {
  it("are in every language the site speaks, the booking app's own, with the count's two numbers", () => {
    for (const { code } of LOCALES) {
      const w = RATING_FIN_WORDS[code];
      for (const k of ["p5", "p5Of", "book"] as const) {
        expect(w[k].trim(), `${code} ${k}`).not.toBe("");
        expect(w[k], `${code} ${k}`).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(w[k], `${code} ${k}`).not.toMatch(/[०-९০-৯٠-٩۰-۹]/);
      }
      expect(w.p5Of, code).toContain("{0}");
      expect(w.p5Of, code).toContain("{1}");
    }
    // the booking app's p5Title, p5Of and mrBookNext, word for word
    expect([RATING_FIN_WORDS.fr.p5, RATING_FIN_WORDS.fr.p5Of, RATING_FIN_WORDS.fr.book]).toEqual(["Vos cinq premières sorties", "{0} sur {1}", "Réservez votre prochaine sortie"]);
    expect([RATING_FIN_WORDS.ur.p5, RATING_FIN_WORDS.ur.p5Of, RATING_FIN_WORDS.ur.book]).toEqual(["آپ کی پہلی پانچ رائیڈز", "{1} میں سے {0}", "اپنی اگلی رائیڈ بُک کریں"]);
    expect(RATING_FIN_WORDS.bn.p5Of).toBe("{1}টির মধ্যে {0}টি");
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const ME = { p_id: "c1", p_token: TOKEN };
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const MONTH = { kind: "level", target: 4, n: 3, ends_on: "2026-11-30" };
const PULSE = { ok: true, member: true, dot: false, me: MONTH, goals: [], fresh: [] as { slug: string; at: string }[] };
const NOT_MEMBER = { ok: true, member: false };
/** The sessions as list_sessions hands them back: circuit rentals, or a pool morning. */
const circuit = (d: string) => ({ id: d, ride_kind: null, event_kind: null, paid_ride: null, needs_approval: null, bike_slots: "{}" });
const pool = (d: string) => ({ id: d, ride_kind: "swim", event_kind: "community", paid_ride: false, needs_approval: true, bike_slots: "{}" });
const AHEAD = { id: "u1", session_id: "2026-11-21", session_date: "2026-11-21", status: "waiting", queue_num: 4 };

describe("api/account/rating-fin and the first five rides", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(`${TODAY}T09:00:00Z`));
    resetSiteContent();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const post = (body: unknown) => POST(new Request("https://micromobility.sa/api/account/rating-fin", { method: "POST", headers: HEADERS, body: JSON.stringify(body) }));
  const fn = (url: string) => String(url.split("/rpc/")[1] ?? "").split("?")[0];
  // the site's content says Experiences is switched on unless a test says otherwise
  const db = (answers: Record<string, Response>, experiences = true) => vi.fn(async (url: string) => {
    if (url.includes("/site_content?")) return json([{ key: "page.experiences.visible", value: experiences }]);
    const a = answers[fn(url)];
    return a ? a.clone() : json({ code: "PGRST202", message: "Could not find the function" }, 404);
  });
  const sent = (fx: ReturnType<typeof db>) => fx.mock.calls.filter((c) => String(c[0]).includes("/rpc/"))
    .map((c) => [fn(String(c[0])), JSON.parse(String((c as unknown as [string, RequestInit])[1].body))] as [string, unknown]);
  const names = (fx: ReturnType<typeof db>) => sent(fx).map((c) => c[0]);
  const fin = async (r: Response) => ((await r.json()) as { fin: unknown }).fin;
  /** An account with `n` rides on the circuit, the newest (e1) just rated, and these answers besides. */
  const account = (n: number, more: Record<string, Response> = {}, extra: Record<string, unknown>[] = []) =>
    db({ my_bookings: json([...rides(n), ...extra]), list_sessions: json(DAYS.slice(0, n).map(circuit)), ...more });

  it("shows a rider who is not a member the path, with Book and without Community", async () => {
    const fx = account(2, { hub_pulse: json(NOT_MEMBER) });
    vi.stubGlobal("fetch", fx);
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 2, tg: 5, book: true, mem: false });
    // the sessions read with the account's own session, as My Account reads them; nothing is written
    expect(sent(fx).filter((c) => c[0] === "list_sessions")).toEqual([["list_sessions", ME]]);
    expect(names(fx)).not.toContain("hub_seen");
    expect(names(fx)).not.toContain("community_member");
  });

  it("leaves Book out for a rider with a booking ahead", async () => {
    vi.stubGlobal("fetch", account(1, { hub_pulse: json(NOT_MEMBER) }, [AHEAD]));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 1, tg: 5, mem: false });
  });

  it("leaves Book out while staff have Experiences switched off, as My Account leaves its Experiences links out", async () => {
    vi.stubGlobal("fetch", db({ my_bookings: json(rides(2)), list_sessions: json(DAYS.slice(0, 2).map(circuit)), hub_pulse: json(PULSE) }, false));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 2, tg: 5 });
  });

  it("shows a non-member nothing from the fifth ride on, or after a session without a bike, as before", async () => {
    vi.stubGlobal("fetch", account(5, { hub_pulse: json(NOT_MEMBER) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
    vi.stubGlobal("fetch", db({ my_bookings: json(rides(3)), list_sessions: json([pool("2026-11-14"), circuit("2026-11-07"), circuit("2026-10-31")]), hub_pulse: json(NOT_MEMBER) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
  });

  it("shows a member on the path the path in place of the month's challenge, with Community", async () => {
    vi.stubGlobal("fetch", account(3, { hub_pulse: json(PULSE) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 3, tg: 5, book: true });
    vi.stubGlobal("fetch", account(4, { hub_pulse: json(PULSE) }, [AHEAD]));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 4, tg: 5 });
  });

  it("shows a member with five rides the month's challenge exactly as before, Book never with it", async () => {
    vi.stubGlobal("fetch", account(5, { hub_pulse: json(PULSE) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "me", kind: "level", n: 3, tg: 4 });
  });

  it("still puts a badge the server just gave first, with Book for a rider on the path", async () => {
    const fx = account(1, {
      hub_pulse: json({ ...PULSE, fresh: [{ slug: "challenge_1", at: "2026-11-14" }] }),
      customer_my_badges: json([{ slug: "challenge_1", name: "Challenge Met", icon: "target", color: "orange" }]),
      badge_catalog: json([]), hub_seen: json({ ok: true, n: 1 }),
    });
    vi.stubGlobal("fetch", fx);
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "badge", name: "Challenge Met", icon: "target", color: "orange", book: true });
    expect(sent(fx).filter((c) => c[0] === "hub_seen")).toEqual([["hub_seen", { ...ME, p_slugs: ["challenge_1"] }]]);
    // from the fifth ride the badge comes alone
    vi.stubGlobal("fetch", account(5, {
      hub_pulse: json({ ...PULSE, fresh: [{ slug: "challenge_1", at: "2026-11-14" }] }),
      customer_my_badges: json([{ slug: "challenge_1", name: "Challenge Met", icon: "target", color: "orange" }]), badge_catalog: json([]),
    }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "badge", name: "Challenge Met", icon: "target", color: "orange" });
  });

  it("without the pulse, a member on the path keeps Community, anyone else is shown it without", async () => {
    const fx = account(2, { community_member: json(true) });
    vi.stubGlobal("fetch", fx);
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 2, tg: 5, book: true });
    expect(sent(fx).filter((c) => c[0] === "community_member")).toEqual([["community_member", ME]]);
    vi.stubGlobal("fetch", account(2, { community_member: json(false) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 2, tg: 5, book: true, mem: false });
    vi.stubGlobal("fetch", account(2));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "p5", n: 2, tg: 5, book: true, mem: false });
    // off the path: nothing, and nobody is asked
    const off = account(6);
    vi.stubGlobal("fetch", off);
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
    expect(names(off)).not.toContain("community_member");
  });

  it("shows no path when the sessions cannot be read whole, and reads nothing for an account with no ride done", async () => {
    // free Saturdays unread would count as none: a non-member is shown nothing, a member the month's challenge as before
    vi.stubGlobal("fetch", db({ my_bookings: json(rides(3)), hub_pulse: json(NOT_MEMBER) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
    vi.stubGlobal("fetch", db({ my_bookings: json(rides(3)), list_sessions: json(DAYS.slice(0, 2).map(circuit)), hub_pulse: json(NOT_MEMBER) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
    vi.stubGlobal("fetch", db({ my_bookings: json(rides(3)), hub_pulse: json(PULSE) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "me", kind: "level", n: 3, tg: 4 });
    // the ride rated is the account's only row, and not a finished one: nothing to look up, nothing to show
    const fx = db({ my_bookings: json([{ ...ride("e1", "2026-11-14"), status: "active" }]), hub_pulse: json(NOT_MEMBER) });
    vi.stubGlobal("fetch", fx);
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
    expect(fx.mock.calls.map((c) => String(c[0])).some((u) => u.includes("sessions"))).toBe(false);
  });
});
