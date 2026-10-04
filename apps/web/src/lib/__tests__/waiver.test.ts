import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { acceptAnswer, pendingWaivers, waiverKind, waiverRiders, waiverVersion } from "../waiver";
import { fmtClock, ticketSession } from "../tickets";
import { resetSiteContent } from "../site";
import { resetSessionColumns } from "../rides";
import { WAIVER_VERSIONS, waiverCopy } from "../../content/waivers";
import { GET, POST } from "../../app/api/account/pending-waiver/route";
import WaiverGate, { type PendingWaiver } from "../../components/account/WaiverGate";
import Qr from "../../components/booking/Qr";
import { TxProvider } from "../../i18n/TxProvider";
import { makeL } from "../../i18n/tx";
import de from "../../i18n/tx/de.json";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

// A rider staff added at the desk (or a walk-in) agrees to the ride's waiver before anything else on
// the site, as the booking app asks (_pendingWaiver, acceptWaiverGate; the owner, 2026-10-04): which
// rides ask, which waiver each gets, what the pop-up shows, and what the database's answer means.
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const row = (id: string, sid: string, date: string, o: Record<string, unknown> = {}) =>
  ({ id, session_id: sid, session_date: date, status: "waiting", customer_id: "c1", queue_num: 1, name: "Sara Ali", waiver_version: null, ...o });
const jccRow = { id: "j1", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null, title: null, location: null };
const satRow = { ...jccRow, id: "s1", session_date: "2099-03-04", event_kind: "community", ride_kind: "saturday", needs_approval: true, bike_slots: '{"_time":"05:45 - 06:15"}', meet_url: "https://maps.app.goo.gl/x" };

describe("which waiver a ride is agreed under", () => {
  it("is the ride's where bikes go out, the swim's at the pool, the activity waiver for anything else", () => {
    for (const r of [jccRow, satRow, { ...satRow, ride_kind: "petromin" }, { ...jccRow, ride_kind: "snd96" }]) {
      expect(waiverKind(ticketSession(r)!)).toBe("ride");
      expect(waiverVersion(ticketSession(r)!)).toBe("2026-10-v3");
    }
    expect(waiverVersion(ticketSession({ ...satRow, ride_kind: "swim" })!)).toBe("swim-2026-10-v3");
    for (const k of ["workshop", "event"]) expect(waiverVersion(ticketSession({ ...satRow, ride_kind: k })!)).toBe("activity-2026-10-v2");
  });
  it("carries the booking app's words, every clause in English and Arabic", () => {
    for (const kind of ["ride", "swim", "activity"] as const) {
      const en = waiverCopy(kind, makeL("en", null)), ar = waiverCopy(kind, makeL("ar", null));
      expect(en.body).toContain("I am also responsible for any damage I cause to other people or their property.");
      expect(en.body).toContain("including any injury, fracture, illness, loss, theft or damage");
      expect(ar.body).toContain("وأنا مسؤول عن أي أضرار ألحقها بالآخرين أو بممتلكاتهم.");
      expect(ar.body).toContain("أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف");
    }
    expect(waiverCopy("ride", makeL("en", null)).agree).toBe("I have read the waiver and agree on behalf of every rider on this booking");
    expect(waiverCopy("swim", makeL("en", null)).title).toBe("Swim waiver");
    expect(waiverCopy("activity", makeL("de", de)).title).toBe((de as Record<string, string>)["Activity waiver"]);
    expect(Object.values(WAIVER_VERSIONS)).toEqual(["2026-10-v3", "swim-2026-10-v3", "activity-2026-10-v2"]);
  });
});

describe("the rides that ask", () => {
  it("are the account's live rows with no waiver, from today on, one per ride, soonest first", () => {
    const rows = [
      row("a", "j2", "2099-03-08"),
      row("b", "j1", "2099-03-01", { status: "waitlist" }),
      row("c", "j1", "2099-03-01", { queue_num: 2 }),
      row("d", "j3", "2099-03-02", { waiver_version: "2026-10-v3" }), // agreed in the booking app
      row("e", "j4", "2099-03-02", { waiver_version: "" }), // an empty stamp is none
      row("f", "j5", "2020-01-01"), // ridden already: not signed for after the fact
      row("g", "j6", "2099-03-03", { status: "cancelled" }),
      row("h", "j7", "2099-03-03", { customer_id: "other" }),
    ];
    expect(pendingWaivers(rows, "2026-10-04", "c1")).toEqual([
      { sessionId: "j1", date: "2099-03-01" }, { sessionId: "j4", date: "2099-03-02" }, { sessionId: "j2", date: "2099-03-08" },
    ]);
    expect(pendingWaivers(rows, "2026-10-04", "c1", ["j1", "j4"])).toEqual([{ sessionId: "j2", date: "2099-03-08" }]);
  });
  it("never ask from a read that did not carry the column", () => {
    const { waiver_version: _, ...noColumn } = row("a", "j1", "2099-03-01");
    void _;
    expect(pendingWaivers([noColumn], "2026-10-04", "c1")).toEqual([]);
  });
  it("list the riders on the booking in number order, with no numbers on a ride staff approve", () => {
    const rows = [row("b", "j1", "2099-03-01", { queue_num: 9, name: "Omar Ali" }), row("a", "j1", "2099-03-01", { queue_num: 8 }), row("x", "j1", "2099-03-01", { status: "removed", name: "Gone" }), row("y", "j2", "2099-03-02")];
    expect(waiverRiders(rows, "j1", "c1", false)).toEqual([{ name: "Sara Ali", num: 8 }, { name: "Omar Ali", num: 9 }]);
    expect(waiverRiders(rows, "j1", "c1", true)).toEqual([{ name: "Sara Ali", num: null }, { name: "Omar Ali", num: null }]);
  });
});

describe("the database's answer", () => {
  it("reads the rows stamped, a missing function, a bad token and no answer", () => {
    expect(acceptAnswer({ status: 200, data: 2, message: "" })).toBe("ok");
    expect(acceptAnswer({ status: 200, data: 0, message: "" })).toBe("ok"); // another device got there first
    expect(acceptAnswer({ status: 200, data: -1, message: "" })).toBe("signin");
    expect(acceptAnswer({ status: 404, data: null, message: "Could not find the function public.customer_accept_waiver(p_id, p_session_id, p_token, p_version) in the schema cache", code: "PGRST202" })).toBe("absent");
    expect(acceptAnswer({ status: 400, data: null, message: "WAIVER_REQUIRED", code: "P0001" })).toBe("refused");
    expect(acceptAnswer({ status: 0, data: null, message: "" })).toBe("network");
    expect(acceptAnswer({ status: 503, data: null, message: "" })).toBe("network");
  });
});

describe("api/account/pending-waiver", () => {
  beforeEach(() => { resetSiteContent(); resetSessionColumns(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const get = (q: string, headers: Record<string, string> = HEADERS) => GET(new Request(`https://micromobility.sa/api/account/pending-waiver?${q}`, { headers }));
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/pending-waiver", { method: "POST", headers, body: JSON.stringify(body) }));
  const db = (rows: unknown[], sessions: unknown[], accept: Response = json(2)) => vi.fn(async (url: string) =>
    url.includes("/rpc/my_bookings") ? json(rows) : url.includes("/rest/v1/sessions?") ? json(sessions) : url.includes("/rpc/customer_accept_waiver") ? accept : json([]));

  it("answers a signed-out visitor from the cookie alone", async () => {
    const f = vi.fn(async () => json([]));
    vi.stubGlobal("fetch", f);
    expect(await (await get("locale=en", {})).json()).toEqual({ signedIn: false });
    expect(f).not.toHaveBeenCalled();
  });
  it("shows the soonest ride the site can see: what, when, where, who, and its waiver", async () => {
    const rows = [row("q2", "j1", "2099-03-01", { queue_num: 5, name: "Omar Ali" }), row("q1", "j1", "2099-03-01", { queue_num: 4 }), row("q3", "gone", "2099-02-01"), row("q4", "s1", "2099-03-04")];
    vi.stubGlobal("fetch", db(rows, [jccRow, satRow]));
    const b = await (await get("locale=en")).json();
    expect(b).toEqual({ signedIn: true, pending: {
      sessionId: "j1", version: "2026-10-v3", kind: "ride", copy: waiverCopy("ride", makeL("en", null)),
      name: "Evening Circuit Session", when: "Sunday · 1 Mar 2099", time: "9 PM – 11 PM", venue: "Jeddah Corniche Circuit",
      ridersLabel: "Riders", riders: [{ name: "Sara Ali", num: 4 }, { name: "Omar Ali", num: 5 }],
    } });
    // the next ride, once that one is agreed on this page; a ride staff approve shows no numbers, and gathers
    const s = (await (await get("locale=ar&skip=j1")).json()).pending;
    expect(s).toMatchObject({ sessionId: "s1", kind: "ride", time: `التجمع ${fmtClock("05:45", "ar")} · الانطلاق ${fmtClock("06:15", "ar")}`, venue: "نقطة التجمع", riders: [{ name: "Sara Ali", num: null }] });
    expect(s.copy.title).toBe("إقرار الركوب");
    expect(await (await get("locale=en&skip=j1,s1")).json()).toEqual({ signedIn: true, pending: null });
  });
  it("asks nothing when every ride is agreed", async () => {
    vi.stubGlobal("fetch", db([row("q1", "j1", "2099-03-01", { waiver_version: "2026-10-v3" })], [jccRow]));
    expect(await (await get("locale=en")).json()).toEqual({ signedIn: true, pending: null });
  });
  it("records the agreement through customer_accept_waiver with the cookie's id and token", async () => {
    const f = db([], [jccRow]);
    vi.stubGlobal("fetch", f);
    const res = await post({ sessionId: "j1", version: "2026-10-v3" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/rpc/customer_accept_waiver")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ p_id: "c1", p_token: TOKEN, p_session_id: "j1", p_version: "2026-10-v3" });
  });
  it("refuses another site, a missing cookie and a malformed body without touching the database", async () => {
    const f = vi.fn(async () => json(1));
    vi.stubGlobal("fetch", f);
    expect((await post({ sessionId: "j1", version: "2026-10-v3" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ sessionId: "j1", version: "2026-10-v3" }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post({ sessionId: "j 1", version: "2026-10-v3" })).status).toBe(400);
    expect((await post({ sessionId: "j1", version: "2026-09-v1" })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("asks again when the ride's waiver is not the one the rider read", async () => {
    const f = db([], [jccRow]);
    vi.stubGlobal("fetch", f);
    const res = await post({ sessionId: "j1", version: "swim-2026-10-v3" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "changed" });
    expect(f.mock.calls.some((c) => String(c[0]).includes("customer_accept_waiver"))).toBe(false);
  });
  it("lets the rider through while the database has no such function, and says when the session ended", async () => {
    vi.stubGlobal("fetch", db([], [jccRow], json({ code: "PGRST202", message: "Could not find the function public.customer_accept_waiver" }, 404)));
    expect(await (await post({ sessionId: "j1", version: "2026-10-v3" })).json()).toEqual({ ok: true, absent: true });
    vi.stubGlobal("fetch", db([], [jccRow], json(-1)));
    expect(await (await post({ sessionId: "j1", version: "2026-10-v3" })).json()).toEqual({ ok: false, error: "signin" });
    vi.stubGlobal("fetch", db([], [jccRow], json({ message: "boom" }, 503)));
    expect((await post({ sessionId: "j1", version: "2026-10-v3" })).status).toBe(502);
  });
});

describe("the pop-up", () => {
  const w: PendingWaiver = {
    sessionId: "j1", version: "2026-10-v3", kind: "ride", copy: waiverCopy("ride", makeL("en", null)),
    name: "Evening Circuit Session", when: "Sunday · 1 Mar 2099", time: "9 PM – 11 PM", venue: "Jeddah Corniche Circuit",
    ridersLabel: "Riders", riders: [{ name: "Sara Ali", num: 4 }, { name: "Omar Ali", num: 5 }],
  };
  const draw = (locale = "en", dict: Record<string, string> | null = null, p: PendingWaiver = w) =>
    renderToStaticMarkup(createElement(Tx, { locale, dict }, createElement(WaiverGate, { ...p, onDone: () => {} })));

  it("names the ride and its riders, holds the button until the tick, and has no way off but signing out", () => {
    const html = draw();
    for (const s of ["Waiver needed", "Ride waiver", "Our team booked you on this ride. Read its waiver and agree to it to continue.", "Evening Circuit Session", "Sunday · 1 Mar 2099", "9 PM – 11 PM", "Jeddah Corniche Circuit", "Sara Ali", "#4", "#5", w.copy.body, w.copy.agree, "Sign out"]) expect(html).toContain(s);
    expect(html).toMatch(/<button type="button" class="wg-btn" disabled="">Agree and continue<\/button>/);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html.match(/<button/g)).toHaveLength(2); // agree, sign out: no close
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u); // drawn icons, never emoji
  });
  it("speaks the page's language", () => {
    const ar = draw("ar", null, { ...w, copy: waiverCopy("ride", makeL("ar", null)) });
    for (const s of ["إقرار مطلوب", "سجّلك فريقنا في هذه الرحلة. اقرأ إقرارها ووافق عليه للمتابعة.", "أوافق وأتابع", "تسجيل الخروج"]) expect(ar).toContain(s);
    const d = de as Record<string, string>;
    const html = draw("de", d);
    for (const s of ["Waiver needed", "Agree and continue", "Our team booked you on this ride. Read its waiver and agree to it to continue."]) {
      expect(d[s]).toBeTruthy();
      expect(html).toContain(d[s]);
    }
  });
});

describe("the ticket's code", () => {
  it("has a line running round its white margin, the svg's own, not read out", () => {
    const html = renderToStaticMarkup(createElement(Qr, { payload: "MMC-4-q1abcd", label: "Queue number #4" }));
    // the white tile is still the code's own svg
    expect(html).toMatch(/<svg role="img" aria-label="Queue number #4" width="132" height="132"[^>]*><rect[^>]*fill="#fff"/);
    const live = /<svg class="tk-qr-live" aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none"><rect ([^>]*)><\/rect><\/svg>/.exec(html);
    expect(live).not.toBeNull();
    expect(live![1]).toContain('x="1.5" y="1.5" width="97" height="97"');
    expect(live![1]).toContain('pathLength="100"');
    expect(live![1]).toContain('stroke="#00b467"');
    expect(live![1]).toContain('stroke-width="2.27"'); // 3px of the 132px tile
    expect(live![1]).toContain('fill="none"');
  });
});
