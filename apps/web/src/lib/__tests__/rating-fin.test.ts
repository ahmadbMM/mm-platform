import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { challengeName, finBadge, finProgress, hubMarks, readPulse, type HubPulse } from "../hub";
import { BADGE_SYS } from "../ride-record";
import { T as RECORD } from "../../components/account/RideRecord.text";
import { RATING_FIN_WORDS } from "../../components/account/RatingFin.words";
import { LOCALES } from "../../i18n/locales";
import { POST } from "../../app/api/account/rating-fin/route";

// The post-ride rating's last screen (the booking app's _rgFinFor and _rgFinHtml, 2026-11-13, the Community tab reach
// build's R5): hub_pulse read, what the screen shows, its words, and the route that asks the database.
const ME = { kind: "level", target: 4, n: 3, ends_on: "2026-11-30", sats: 3, levels: [2, 4], chosen: true };
const GOAL = { id: "g1", name: "Cool Season", name_ar: "موسم البرودة", target: 8, n: 2, ends_on: "2027-02-28", badge: { slug: "cool_season_26", icon: "snow", color: "blue" } };
const PULSE = { ok: true, member: true, dot: true, me: ME, goals: [GOAL], fresh: [] as { slug: string; at: string }[] };

describe("hub_pulse", () => {
  it("is read as the database gives it: a refusal is nothing, a non-member says so, a member's month, season and new badges", () => {
    expect(readPulse({ ok: false, error: "denied" })).toBeNull();
    expect(readPulse(null)).toBeNull();
    expect(readPulse({ ok: true, member: false })).toEqual({ member: false });
    expect(readPulse({ ...PULSE, fresh: [{ slug: "challenge_1", at: "x" }, { slug: "Bad slug!", at: "y" }, { slug: "club_goal_1", at: "z" }] })).toEqual({
      member: true,
      me: { kind: "level", target: 4, n: 3, endsOn: "2026-11-30" },
      goals: [{ name: "Cool Season", nameAr: "موسم البرودة", target: 8, n: 2 }],
      fresh: ["challenge_1", "club_goal_1"],
    });
    expect(readPulse({ ok: true, member: true, me: null, goals: null, fresh: null })).toEqual({ member: true, me: null, goals: [], fresh: [] });
  });
});

describe("the last screen's progress", () => {
  const p = readPulse(PULSE) as HubPulse;
  it("is the month's challenge, once it has a session and the ride rated is in its month", () => {
    expect(finProgress(p, "2026-11-14", "en")).toEqual({ k: "me", kind: "level", n: 3, tg: 4 });
    // never above the target
    expect(finProgress(readPulse({ ...PULSE, me: { ...ME, n: 6 } }), "2026-11-14", "en")).toEqual({ k: "me", kind: "level", n: 4, tg: 4 });
  });
  it("else the season challenge with a session in it, by its Arabic name on the Arabic page", () => {
    expect(finProgress(readPulse({ ...PULSE, me: { ...ME, n: 0 } }), "2026-11-14", "en")).toEqual({ k: "goal", name: "Cool Season", n: 2, tg: 8 });
    expect(finProgress(p, "2026-10-31", "ar")).toEqual({ k: "goal", name: "موسم البرودة", n: 2, tg: 8 });
    expect(finProgress(readPulse({ ...PULSE, goals: [{ ...GOAL, name_ar: null }] }), "2026-10-31", "ar")).toEqual({ k: "goal", name: "Cool Season", n: 2, tg: 8 });
  });
  it("else nothing, and nothing for a non-member", () => {
    expect(finProgress(readPulse({ ...PULSE, me: { ...ME, n: 0 }, goals: [{ ...GOAL, n: 0 }] }), "2026-11-14", "en")).toBeNull();
    expect(finProgress(readPulse({ ...PULSE, me: { ...ME, n: 0 }, goals: [] }), "2026-11-14", "en")).toBeNull();
    expect(finProgress(readPulse({ ok: true, member: false }), "2026-11-14", "en")).toBeNull();
    expect(finProgress(null, "2026-11-14", "en")).toBeNull();
  });
});

describe("a badge on the last screen", () => {
  const names = RECORD.en.names as Record<string, readonly string[]>;
  it("is a catalogue badge by its own name and drawing, the account's own row before the catalogue's", () => {
    const mine = [{ slug: "challenge_1", name: "Challenge Met", name_ar: "تحدٍّ مكتمل", icon: "target", color: "orange" }];
    const cat = [{ slug: "challenge_1", name: "Old name", icon: "medal", color: "green" }, { slug: "cool_season_26", name: "Cool Season", icon: "snow", color: "blue" }];
    expect(finBadge("challenge_1", [mine, cat], names, "en", BADGE_SYS)).toEqual({ k: "badge", name: "Challenge Met", icon: "target", color: "orange" });
    expect(finBadge("challenge_1", [mine, cat], names, "ar", BADGE_SYS)).toEqual({ k: "badge", name: "تحدٍّ مكتمل", icon: "target", color: "orange" });
    expect(finBadge("cool_season_26", [mine, cat], names, "fr", BADGE_SYS)).toEqual({ k: "badge", name: "Cool Season", icon: "snow", color: "blue" });
    expect(finBadge("nowhere", [mine, cat], names, "en", BADGE_SYS)).toBeNull();
  });
  it("is one of the app's own badges in its own words and drawing, unless the database says it is not the app's", () => {
    const row = [{ slug: "first_lap", name: "Edited", icon: "medal", color: "red", system: true }];
    expect(finBadge("first_lap", [row], names, "en", BADGE_SYS)).toEqual({ k: "badge", name: names.first_lap[0], icon: BADGE_SYS.first_lap[0], color: BADGE_SYS.first_lap[1] });
    expect(finBadge("first_lap", [[{ ...row[0], system: false }]], names, "en", BADGE_SYS)).toEqual({ k: "badge", name: "Edited", icon: "medal", color: "red" });
  });
});

describe("the challenge", () => {
  it("is named as the Community tab names it", () => {
    const w = RATING_FIN_WORDS.en;
    expect(["first", "second", "back", "level"].map((k) => challengeName(k, 4, w))).toEqual(["Your first session", "Your second session", "Back this month", "4 sessions this month"]);
    expect(challengeName("level", 6, RATING_FIN_WORDS.ar)).toBe("6 جلسات هذا الشهر");
  });
  it("is drawn as dots up to five and a bar above that; a booking not ridden yet is an outlined dot after the done ones", () => {
    expect(hubMarks(3, 4)).toEqual({ dots: ["on", "on", "on", ""] });
    expect(hubMarks(1, 4, true)).toEqual({ dots: ["on", "nx", "", ""] });
    expect(hubMarks(0, 1, true)).toEqual({ dots: ["nx"] });
    expect(hubMarks(4, 4, true)).toEqual({ dots: ["on", "on", "on", "on"] });
    expect(hubMarks(3, 8)).toEqual({ bar: { on: 37.5, nx: 0 } });
    expect(hubMarks(3, 8, true)).toEqual({ bar: { on: 37.5, nx: 12.5 } });
  });
});

describe("the words", () => {
  it("are complete in every language the site speaks, the booking app's own, and never emoji", () => {
    expect(Object.keys(RATING_FIN_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    for (const [loc, w] of Object.entries(RATING_FIN_WORDS)) {
      for (const [k, v] of Object.entries(w)) {
        expect(v.trim(), `${loc} ${k}`).not.toBe("");
        expect(v, `${loc} ${k}`).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(v, `${loc} ${k}`).not.toMatch(/[०-९০-৯٠-٩۰-۹]/); // Latin digits only
      }
      expect(w.level, `${loc} level`).toContain("{0}");
    }
    expect(RATING_FIN_WORDS.en).toEqual({ badge: "New badge!", first: "Your first session", second: "Your second session", back: "Back this month", level: "{0} sessions this month", community: "Community", done: "Done", p5: "Your first five rides", p5Of: "{0} of {1}", book: "Book your next ride" });
    expect(RATING_FIN_WORDS.ar).toEqual({ badge: "وسام جديد!", first: "جلستك الأولى", second: "جلستك الثانية", back: "عُد هذا الشهر", level: "{0} جلسات هذا الشهر", community: "المجتمع", done: "تم", p5: "جولاتك الخمس الأولى", p5Of: "{0} من {1}", book: "احجز جولتك القادمة" });
    expect(RATING_FIN_WORDS.fr.badge).toBe("Nouveau badge !");
    expect(RATING_FIN_WORDS.ur.community).toBe("کمیونٹی");
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
// the ride just rated, done and rated with the full form, on 14 November
const RATED = { id: "e1", session_id: "2026-11-14", session_date: "2026-11-14", status: "done", queue_num: 3, rating_detail: { form: "social", s: { overall: 9 } } };

describe("api/account/rating-fin", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-15T09:00:00Z"));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const URL_ = "https://micromobility.sa/api/account/rating-fin";
  const post = (body: unknown, headers: Record<string, string> = HEADERS) => POST(new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) }));
  // a function by its name, its query left out (list_sessions takes one); a read of a table is never answered
  const fn = (url: string) => String(url.split("/rpc/")[1] ?? "").split("?")[0];
  const db = (answers: Record<string, Response>) => vi.fn(async (url: string) => {
    const a = answers[fn(url)];
    return a ? a.clone() : json({ code: "PGRST202", message: "Could not find the function" }, 404);
  });
  const sent = (fx: ReturnType<typeof db>) => fx.mock.calls.filter((c) => String(c[0]).includes("/rpc/"))
    .map((c) => [fn(String(c[0])), JSON.parse(String((c as unknown as [string, RequestInit])[1].body))]);
  const fin = async (r: Response) => ((await r.json()) as { fin: unknown }).fin;

  it("shows a member the month's challenge the ride moved, read with the account's own session", async () => {
    const fx = db({ my_bookings: json([RATED]), hub_pulse: json(PULSE) });
    vi.stubGlobal("fetch", fx);
    const r = await post({ entryId: "e1", locale: "en" });
    expect(r.status).toBe(200);
    expect(await fin(r)).toEqual({ k: "me", kind: "level", n: 3, tg: 4 });
    // and the kinds of the sessions it rode, for the first five rides' count (lib/first-five.ts), as the account sees them
    expect(sent(fx).sort()).toEqual([["hub_pulse", { p_id: "c1", p_token: TOKEN }], ["list_sessions", { p_id: "c1", p_token: TOKEN }], ["my_bookings", { p_id: "c1", p_token: TOKEN }]]);
  });

  it("shows the newest Community badge not seen, in the page's language, and marks every one brought as seen", async () => {
    const fx = db({
      my_bookings: json([RATED]),
      hub_pulse: json({ ...PULSE, fresh: [{ slug: "club_goal_1", at: "2026-11-01" }, { slug: "challenge_1", at: "2026-11-14" }] }),
      customer_my_badges: json([{ slug: "challenge_1", name: "Challenge Met", name_ar: "تحدٍّ مكتمل", icon: "target", color: "orange", at: "2026-11-14" }]),
      badge_catalog: json([{ slug: "club_goal_1", name: "Club Goal", icon: "people", color: "teal" }]),
      hub_seen: json({ ok: true, n: 2 }),
    });
    vi.stubGlobal("fetch", fx);
    expect(await fin(await post({ entryId: "e1", locale: "ar" }))).toEqual({ k: "badge", name: "تحدٍّ مكتمل", icon: "target", color: "orange" });
    expect(sent(fx).filter((c) => c[0] === "hub_seen")).toEqual([["hub_seen", { p_id: "c1", p_token: TOKEN, p_slugs: ["club_goal_1", "challenge_1"] }]]);
  });

  it("a new badge it cannot find is left for the challenge, and nothing is marked seen", async () => {
    const fx = db({ my_bookings: json([RATED]), hub_pulse: json({ ...PULSE, fresh: [{ slug: "challenge_3", at: "x" }] }), customer_my_badges: json([]), badge_catalog: json([]) });
    vi.stubGlobal("fetch", fx);
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toEqual({ k: "me", kind: "level", n: 3, tg: 4 });
    expect(sent(fx).map((c) => c[0])).not.toContain("hub_seen");
  });

  it("shows nothing while another ride waits to be rated: its own pop-up comes next", async () => {
    const waiting = { id: "e0", session_id: "2026-11-07", session_date: "2026-11-07", status: "done", queue_num: 1 };
    vi.stubGlobal("fetch", db({ my_bookings: json([waiting, RATED]), hub_pulse: json({ ...PULSE, fresh: [{ slug: "challenge_1", at: "x" }] }) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
  });

  it("shows nothing to a rider who is not a member, to a refused token, or from a database without hub_pulse", async () => {
    vi.stubGlobal("fetch", db({ my_bookings: json([RATED]), hub_pulse: json({ ok: true, member: false }) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
    vi.stubGlobal("fetch", db({ my_bookings: json([RATED]), hub_pulse: json({ ok: false, error: "denied" }) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
    vi.stubGlobal("fetch", db({ my_bookings: json([RATED]) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
  });

  it("shows nothing for a ride the account's bookings do not hold, or when they cannot be read", async () => {
    vi.stubGlobal("fetch", db({ my_bookings: json([RATED]), hub_pulse: json(PULSE) }));
    expect(await fin(await post({ entryId: "e9", locale: "en" }))).toBeNull();
    vi.stubGlobal("fetch", db({ my_bookings: json({ message: "upstream" }, 503), hub_pulse: json(PULSE) }));
    expect(await fin(await post({ entryId: "e1", locale: "en" }))).toBeNull();
  });

  it("answers only this site's pages, a signed-in account and a booking's id", async () => {
    const fx = db({});
    vi.stubGlobal("fetch", fx);
    expect((await post({ entryId: "e1" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ entryId: "e1" }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post({ entryId: "../x" })).status).toBe(400);
    expect(fx).not.toHaveBeenCalled();
  });
});
