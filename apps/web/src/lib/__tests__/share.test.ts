import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { isRun, pendingShares, shareCandidates } from "../share";
import { fmtClock, ticketSession, type TicketSession } from "../tickets";
import { resetSiteContent } from "../site";
import { resetSessionColumns } from "../rides";
import { GET, POST } from "../../app/api/account/pending-share/route";
import ShareGate, { type PendingShare } from "../../components/account/ShareGate";
import { TxProvider } from "../../i18n/TxProvider";
import de from "../../i18n/tx/de.json";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

// A Run for Her runner agrees that their details go to Sela and Jeddah Yacht Club before anything else
// on the site but a waiver, as the booking app asks (_pendingShare; the owner, 2026-10-06): which rows
// ask, what the pop-up shows, and what the database's answer means (customer_accept_share).
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const row = (id: string, sid: string, date: string, o: Record<string, unknown> = {}) =>
  ({ id, session_id: sid, session_date: date, status: "waiting", customer_id: "c1", queue_num: 1, name: "Sara Ali", run_km: 5, waiver_version: "activity-2026-10-v2", data_share_at: null, ...o });
const runRow = { id: "r1", session_date: "2099-10-17", event_kind: "community", ride_kind: "runher", needs_approval: false, hide_queue: true, open_to_all: false, paid_ride: false, bike_slots: '{"_time":"06:00 - 06:30"}', meet_url: "https://maps.app.goo.gl/run", location: "JYC", title: "Run for Her" };
const jccRow = { id: "j1", session_date: "2099-10-12", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null, title: null, location: null };
const satRow = { ...jccRow, id: "s1", session_date: "2099-10-14", event_kind: "community", ride_kind: "saturday", needs_approval: true, bike_slots: '{"_time":"05:45 - 06:15"}', meet_url: "https://maps.app.goo.gl/x" };
const sess = (...rs: Record<string, unknown>[]) => new Map(rs.map((r) => [String(r.id), ticketSession(r)!] as [string, TicketSession]));

describe("the runs that ask", () => {
  const runs = sess(runRow, { ...runRow, id: "r2", session_date: "2099-10-24" }, { ...runRow, id: "r3", session_date: "2099-10-10" }, jccRow, satRow);

  it("are the account's live rows on Run for Her with no agreement, from today on, one per run, soonest first", () => {
    const rows = [
      row("a", "r2", "2099-10-24", { run_km: 3 }),
      row("b", "r1", "2099-10-17", { status: "waitlist", run_km: null }),
      row("c", "r1", "2099-10-17", { status: "active" }), // the distance comes from the run's row that has one
      row("d", "r3", "2099-10-10", { data_share_at: "" }), // an empty stamp is none
      row("e", "j1", "2099-10-12"), // a circuit night: nothing goes to the race's hosts
      row("f", "s1", "2099-10-14"), // nor on the Saturday ride
    ];
    expect(pendingShares(rows, runs, "2026-10-06", "c1")).toEqual([
      { sessionId: "r3", date: "2099-10-10", km: 5 }, { sessionId: "r1", date: "2099-10-17", km: 5 }, { sessionId: "r2", date: "2099-10-24", km: 3 },
    ]);
    // every session that could still ask is read, to know which are runs
    expect(shareCandidates(rows, "2026-10-06", "c1").sort()).toEqual(["j1", "r1", "r2", "r3", "s1"]);
  });
  it("leave out a run agreed to already, or on this page", () => {
    const rows = [row("a", "r1", "2099-10-17", { data_share_at: "2026-10-06T09:00:00Z" }), row("b", "r2", "2099-10-24"), row("c", "r3", "2099-10-10")];
    expect(pendingShares(rows, runs, "2026-10-06", "c1")).toEqual([{ sessionId: "r3", date: "2099-10-10", km: 5 }, { sessionId: "r2", date: "2099-10-24", km: 5 }]);
    expect(pendingShares(rows, runs, "2026-10-06", "c1", ["r3"])).toEqual([{ sessionId: "r2", date: "2099-10-24", km: 5 }]);
    expect(shareCandidates(rows, "2026-10-06", "c1", ["r3", "r2"])).toEqual([]);
  });
  it("never ask for a run already run, a row that is done, gone or someone else's, or a run the site cannot see", () => {
    const rows = [
      row("a", "r1", "2020-01-01"), // run already: not agreed to after the fact
      row("b", "r2", "2099-10-24", { status: "done" }),
      row("c", "r3", "2099-10-10", { status: "cancelled" }),
      row("d", "r3", "2099-10-10", { status: "removed" }),
      row("e", "r3", "2099-10-10", { status: "noshow" }),
      row("f", "r2", "2099-10-24", { customer_id: "other" }),
      row("g", "hidden", "2099-10-30"),
    ];
    expect(pendingShares(rows, runs, "2026-10-06", "c1")).toEqual([]);
  });
  it("never ask from a read that did not carry the column (a database before the migration)", () => {
    const { data_share_at: _, ...noColumn } = row("a", "r1", "2099-10-17");
    void _;
    expect(pendingShares([noColumn], runs, "2026-10-06", "c1")).toEqual([]);
    expect(shareCandidates([noColumn], "2026-10-06", "c1")).toEqual([]);
  });
  it("know a run by the session's kind, and a distance only when it is 3 or 5 km", () => {
    expect([...runs.values()].filter(isRun).map((s) => s.id).sort()).toEqual(["r1", "r2", "r3"]);
    expect(isRun(undefined)).toBe(false);
    expect(pendingShares([row("a", "r1", "2099-10-17", { run_km: 10 })], runs, "2026-10-06", "c1")[0].km).toBeNull();
    expect(pendingShares([row("a", "r1", "2099-10-17", { run_km: "3" })], runs, "2026-10-06", "c1")[0].km).toBe(3);
  });
});

describe("api/account/pending-share", () => {
  beforeEach(() => { resetSiteContent(); resetSessionColumns(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const get = (q: string, headers: Record<string, string> = HEADERS) => GET(new Request(`https://micromobility.sa/api/account/pending-share?${q}`, { headers }));
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/pending-share", { method: "POST", headers, body: JSON.stringify(body) }));
  // the account's sessions come through list_sessions with its token (Run for Her is for members)
  const db = (rows: unknown[], sessions: unknown[], accept: Response = json(1)) => vi.fn(async (url: string) =>
    url.includes("/rpc/my_bookings") ? json(rows) : url.includes("/rpc/list_sessions?") ? json(sessions) : url.includes("/rpc/customer_accept_share") ? accept : json([]));

  it("answers a signed-out visitor from the cookie alone", async () => {
    const f = vi.fn(async () => json([]));
    vi.stubGlobal("fetch", f);
    expect(await (await get("locale=en", {})).json()).toEqual({ signedIn: false });
    expect(f).not.toHaveBeenCalled();
  });
  it("shows the soonest run: what, when, where, and the distance picked", async () => {
    const rows = [row("q1", "j1", "2099-10-12"), row("q2", "r1", "2099-10-17"), row("q3", "r2", "2099-10-24", { run_km: 3 })];
    vi.stubGlobal("fetch", db(rows, [jccRow, runRow, { ...runRow, id: "r2", session_date: "2099-10-24" }]));
    expect(await (await get("locale=en")).json()).toEqual({ signedIn: true, pending: {
      sessionId: "r1", name: "Run for Her", when: "Saturday · 17 Oct 2099", time: "Gathering 6 AM · Start 6:30 AM", venue: "Jeddah Yacht Club", distance: "5 km",
    } });
    // the next run, once that one is agreed on this page, in the page's language
    expect((await (await get("locale=ar&skip=r1")).json()).pending).toMatchObject({
      sessionId: "r2", name: "نركض لأجلها", time: `التجمع ${fmtClock("06:00", "ar")} · الانطلاق ${fmtClock("06:30", "ar")}`, venue: "نادي جدة لليخوت", distance: "3 كم",
    });
    expect(await (await get("locale=en&skip=r1,r2")).json()).toEqual({ signedIn: true, pending: null });
  });
  it("shows no distance when the booking has none", async () => {
    vi.stubGlobal("fetch", db([row("q1", "r1", "2099-10-17", { run_km: null })], [runRow]));
    expect((await (await get("locale=en")).json()).pending).toMatchObject({ sessionId: "r1", distance: null });
  });
  it("asks nothing when every run is agreed, or only rides wait", async () => {
    vi.stubGlobal("fetch", db([row("q1", "r1", "2099-10-17", { data_share_at: "2026-10-06T09:00:00Z" }), row("q2", "j1", "2099-10-12")], [jccRow, runRow]));
    expect(await (await get("locale=en")).json()).toEqual({ signedIn: true, pending: null });
  });
  it("reads no session at all before the migration (the rows carry no column)", async () => {
    const { data_share_at: _, ...noColumn } = row("q1", "r1", "2099-10-17");
    void _;
    const f = db([noColumn], [runRow]);
    vi.stubGlobal("fetch", f);
    expect(await (await get("locale=en")).json()).toEqual({ signedIn: true, pending: null });
    expect(f.mock.calls.some((c) => String(c[0]).includes("list_sessions") || String(c[0]).includes("/rest/v1/sessions"))).toBe(false);
  });
  it("records the agreement through customer_accept_share with the cookie's id and token", async () => {
    const f = db([], [runRow]);
    vi.stubGlobal("fetch", f);
    const res = await post({ sessionId: "r1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/rpc/customer_accept_share")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session_id: "r1" });
    // the session is read with the account's token
    const read = f.mock.calls.find((c) => String(c[0]).includes("/rpc/list_sessions?")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(read[1].body))).toEqual({ p_id: "c1", p_token: TOKEN });
  });
  it("refuses another site, a missing cookie and a malformed body without touching the database", async () => {
    const f = vi.fn(async () => json(1));
    vi.stubGlobal("fetch", f);
    expect((await post({ sessionId: "r1" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ sessionId: "r1" }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post({ sessionId: "r 1" })).status).toBe(400);
    expect((await post({ sessionId: "" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("asks again when the session is no longer Run for Her", async () => {
    const f = db([], [jccRow, { ...runRow, ride_kind: "event" }]);
    vi.stubGlobal("fetch", f);
    for (const sid of ["j1", "r1"]) {
      const r = await post({ sessionId: sid });
      expect([r.status, await r.json()]).toEqual([409, { ok: false, error: "changed" }]);
    }
    expect(f.mock.calls.some((c) => String(c[0]).includes("customer_accept_share"))).toBe(false);
  });
  it("lets the runner through while the database has no such function, and says when the session ended", async () => {
    vi.stubGlobal("fetch", db([], [runRow], json({ code: "PGRST202", message: "Could not find the function public.customer_accept_share(p_id, p_session_id, p_token) in the schema cache" }, 404)));
    expect(await (await post({ sessionId: "r1" })).json()).toEqual({ ok: true, absent: true });
    vi.stubGlobal("fetch", db([], [runRow], json({ code: "42883", message: "function public.customer_accept_share(text, text, text) does not exist" }, 404)));
    expect(await (await post({ sessionId: "r1" })).json()).toEqual({ ok: true, absent: true });
    vi.stubGlobal("fetch", db([], [runRow], json(0))); // another device got there first
    expect(await (await post({ sessionId: "r1" })).json()).toEqual({ ok: true });
    vi.stubGlobal("fetch", db([], [runRow], json(-1)));
    expect(await (await post({ sessionId: "r1" })).json()).toEqual({ ok: false, error: "signin" });
    vi.stubGlobal("fetch", db([], [runRow], json({ message: "boom" }, 503)));
    expect((await post({ sessionId: "r1" })).status).toBe(502);
  });
});

describe("the pop-up", () => {
  const w: PendingShare = { sessionId: "r1", name: "Run for Her", when: "Saturday · 17 Oct 2099", time: "Gathering 6 AM · Start 6:30 AM", venue: "Jeddah Yacht Club", distance: "5 km" };
  const draw = (locale = "en", dict: Record<string, string> | null = null, p: PendingShare = w) =>
    renderToStaticMarkup(createElement(Tx, { locale, dict }, createElement(ShareGate, { ...p, onDone: () => {} })));
  const EN = [
    "Before the race", "Sharing your details for the race",
    "To take part in the race, we will share these details about you with Sela and Jeddah Yacht Club (JYC):",
    "Full name", "Email address", "Birth date", "Distance chosen", "Emergency contact",
    "Nothing else about you is shared, and only for this race.",
    "I agree to MicroMobility sharing these details with Sela and Jeddah Yacht Club (JYC) so I can take part in the race.",
    "Agree and continue", "Sign out",
  ];

  it("names the run and what is shared, in order, holds the button until the tick, and has no way off but signing out", () => {
    const html = draw();
    for (const s of [...EN, "Run for Her", "Saturday · 17 Oct 2099", "Gathering 6 AM · Start 6:30 AM", "Jeddah Yacht Club"]) expect(html).toContain(s);
    // the kicker, the title, the run, the words, the five details, the note, the tick, the button
    const at = EN.map((s) => html.indexOf(s));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html.indexOf("Jeddah Yacht Club</span>")).toBeLessThan(html.indexOf("To take part"));
    expect(html).toContain("Distance chosen · <bdi>5 km</bdi>");
    expect(html.match(/<li>/g)).toHaveLength(5);
    expect(html).toMatch(/<button type="button" class="wg-btn" disabled="">Agree and continue<\/button>/);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html.match(/<button/g)).toHaveLength(2); // agree, sign out: no close
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u); // drawn icons, never emoji
    expect(draw("en", null, { ...w, distance: null })).toContain("Distance chosen</span>");
  });
  it("speaks the page's language", () => {
    const ar = draw("ar", null, { ...w, name: "نركض لأجلها", distance: "5 كم" });
    for (const s of ["قبل السباق", "مشاركة بياناتك للسباق", "للمشاركة في السباق، سنشارك بياناتك التالية مع صلة ونادي جدة لليخوت (JYC):", "الاسم الكامل", "البريد الإلكتروني", "تاريخ الميلاد", "المسافة المختارة · <bdi>5 كم</bdi>", "جهة اتصال للطوارئ", "لا نشارك أي شيء آخر عنك، وللسباق فقط.", "أوافق على أن تشارك مايكروموبيليتي هذه البيانات مع صلة ونادي جدة لليخوت (JYC) لأتمكن من المشاركة في السباق.", "أوافق وأتابع", "تسجيل الخروج"]) expect(ar).toContain(s);
    const d = de as Record<string, string>;
    const html = draw("de", d);
    for (const s of EN) {
      expect(d[s], s).toBeTruthy();
      expect(html).toContain(d[s].replace(/&/g, "&amp;"));
    }
  });
});
