import { afterEach, describe, expect, it, vi } from "vitest";
import { handle, normalizeLogin, RPCS, type Env } from "../src/worker/app";
import { parseTicket } from "../src/client/scan";

// The Worker's fetch handler, run directly with a stubbed database. Nothing here reaches a real one.
const env: Env = { SUPABASE_URL: "https://db.test", SUPABASE_ANON_KEY: "anon" };
const ORIGIN = "https://volunteer.micromobility.sa";
const COOKIE = "mm_volunteer=c123~tokentokentokentoken";
const post = (path: string, body: unknown = {}, headers: Record<string, string> = {}) => new Request(`${ORIGIN}${path}`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
  body: JSON.stringify(body),
});
type Call = { name: string; args: Record<string, unknown> };
function db(answer: (c: Call) => { status?: number; body: unknown }): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const name = String(url).split("/rpc/")[1];
    const c = { name, args: JSON.parse(String(init.body)) as Record<string, unknown> };
    calls.push(c);
    const a = answer(c);
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  }));
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("who may post", () => {
  it("refuses another origin, a GET, and anything but JSON", async () => {
    expect((await handle(post("/api/login", {}, { origin: "https://evil.test" }), env)).status).toBe(403);
    expect((await handle(new Request(`${ORIGIN}/api/login`), env)).status).toBe(405);
    const r = await handle(new Request(`${ORIGIN}/api/login`, { method: "POST", headers: { origin: ORIGIN, "content-type": "text/plain" }, body: "x" }), env);
    expect(r.status).toBe(415);
  });
  it("every answer carries the headers, and only this page may ask for the camera", async () => {
    const r = await handle(post("/api/nope"), env);
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
    expect(r.headers.get("permissions-policy")).toContain("camera=(self)");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(r.headers.get("content-security-policy")).not.toContain("unsafe-inline");
  });
});

describe("signing in", () => {
  it("uses the main account's sign-in, and keeps the token out of the page", async () => {
    const calls = db(() => ({ body: [{ id: "c123", name: "Sara", session_token: "tokentokentokentoken" }] }));
    const r = await handle(post("/api/login", { login: " Sara@Example.com ", password: "pw" }), env);
    expect(r.status).toBe(200);
    expect(calls[0]).toEqual({ name: "customer_login", args: { p_identifier: "sara@example.com", p_pwd: "pw" } });
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mm_volunteer=c123~tokentokentokentoken");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
    expect(await r.text()).not.toContain("tokentoken");
  });
  it("a wrong password answers no row", async () => {
    db(() => ({ body: [] }));
    const r = await handle(post("/api/login", { login: "a@b.co", password: "bad" }), env);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "BAD_LOGIN" });
  });
  it("says when the account is locked", async () => {
    db(() => ({ status: 400, body: { message: "LOCKED", code: "P0001" } }));
    const r = await handle(post("/api/login", { login: "a@b.co", password: "x" }), env);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "LOCKED" });
  });
  it("reads a mobile however it is typed, as the booking app does", () => {
    for (const v of ["0512345678", "512345678", "966512345678", "+966512345678", "00966512345678", "+9660512345678", "05 1234 5678", "٠٥١٢٣٤٥٦٧٨"]) {
      expect(normalizeLogin(v), v).toBe("+966512345678");
    }
    expect(normalizeLogin("+201012345678")).toBe("+201012345678");
  });
  it("a one-time code signs in, and a bad one does not", async () => {
    const calls = db(() => ({ body: [{ id: "c123", name: "Sara", session_token: "tokentokentokentoken" }] }));
    const code = "a".repeat(48);
    const r = await handle(post("/api/handoff", { code }), env);
    expect(r.status).toBe(200);
    expect(calls[0]).toEqual({ name: "customer_handoff_redeem", args: { p_code: code } });
    expect(r.headers.get("set-cookie")).toContain("mm_volunteer=c123~");
    expect((await handle(post("/api/handoff", { code: "nope" }), env)).status).toBe(400);
    db(() => ({ body: [] }));
    expect((await handle(post("/api/handoff", { code }), env)).status).toBe(400);
  });
  it("signing out clears the cookie and leaves the account's token alone", async () => {
    const calls = db(() => ({ body: null }));
    const r = await handle(post("/api/logout", {}, { cookie: COOKIE }), env);
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(calls).toHaveLength(0);
  });
});

describe("the database functions", () => {
  it("only the listed functions go through", async () => {
    const calls = db(() => ({ body: [] }));
    for (const name of ["customer_profile", "staff_volunteer_decide", "staff_checkin", "customer_login"]) {
      expect((await handle(post(`/api/rpc/${name}`, {}, { cookie: COOKIE }), env)).status, name).toBe(404);
    }
    expect(calls).toHaveLength(0);
    // the portal's own functions, and the booking app's phone-notification pair on the same session
    expect([...RPCS].filter((n) => !n.startsWith("volunteer_")).sort()).toEqual(["customer_push_subscribe", "customer_push_unsubscribe"]);
    for (const name of ["volunteer_team", "volunteer_team_clock", "volunteer_updates", "volunteer_updates_seen"]) expect(RPCS.has(name), name).toBe(true);
  });
  it("nobody reads the opportunities signed out, and a cookie is not a sign-in until its token opens an account", async () => {
    const calls = db(() => ({ body: [{ id: "s1" }] }));
    expect((await handle(post("/api/rpc/volunteer_opportunities"), env)).status).toBe(401);
    expect(calls).toHaveLength(0);
    // signed in: who they are is checked first, then the list, which takes no arguments
    const r = await handle(post("/api/rpc/volunteer_opportunities", {}, { cookie: COOKIE }), env);
    expect(await r.json()).toEqual([{ id: "s1" }]);
    expect(calls.map((c) => c.args)).toEqual([{ p_id: "c123", p_token: "tokentokentokentoken" }, {}]);
  });
  it("a token that opens no account reads no opportunities, and its cookie goes", async () => {
    const calls = db(() => ({ body: null }));
    const r = await handle(post("/api/rpc/volunteer_opportunities", {}, { cookie: COOKIE }), env);
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(calls).toHaveLength(1);
  });
  it("without a session, who am I is answered and anything else refused", async () => {
    const calls = db(() => ({ body: {} }));
    expect(await (await handle(post("/api/rpc/volunteer_me"), env)).json()).toEqual({ signedIn: false });
    expect((await handle(post("/api/rpc/volunteer_interest", { p_session: "s" }), env)).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("who is asking comes from the cookie, whatever the body says", async () => {
    const calls = db(() => ({ body: { ok: true } }));
    await handle(post("/api/rpc/volunteer_interest", { p_session: "s", p_on: true, p_id: "someone-else", p_token: "stolen" }, { cookie: COOKIE }), env);
    expect(calls[0].args).toEqual({ p_session: "s", p_on: true, p_id: "c123", p_token: "tokentokentokentoken" });
  });
  it("a token that no longer opens the account signs the page out", async () => {
    db(() => ({ body: null }));
    const r = await handle(post("/api/rpc/volunteer_me", {}, { cookie: COOKIE }), env);
    expect(await r.json()).toEqual({ signedIn: false });
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("says the database's reason, and why the desk is needed", async () => {
    db(() => ({ status: 400, body: { message: "VOL_ASK_DESK", code: "P0001", details: "pay" } }));
    const r = await handle(post("/api/rpc/volunteer_checkin", { p_session: "s" }, { cookie: COOKIE }), env);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "VOL_ASK_DESK", detail: "pay" });
  });
  it("anything unexpected is a plain server fault, with no database words", async () => {
    db(() => ({ status: 500, body: { message: "relation x does not exist", code: "42P01" } }));
    const r = await handle(post("/api/rpc/volunteer_find", { p_session: "s" }, { cookie: COOKIE }), env);
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "SERVER" });
  });
  it("a message that is an object's own word is not a code", async () => {
    db(() => ({ status: 400, body: { message: "constructor" } }));
    expect((await handle(post("/api/rpc/volunteer_find", { p_session: "s" }, { cookie: COOKIE }), env)).status).toBe(502);
  });
});

describe("the rework of 2026-11-09", () => {
  it("each of the database's new refusals has its own status, not a server fault", async () => {
    const cases: [string, string, number][] = [
      ["volunteer_interest", "VOL_PROFILE", 409], ["volunteer_interest", "VOL_PENDING", 409], ["volunteer_apply", "VOL_EMERGENCY", 400],
      ["volunteer_team", "VOL_NOT_LEAD", 403], ["volunteer_team_clock", "VOL_CHECKED_OUT", 409], ["volunteer_arrive", "VOL_CHECKED_OUT", 409],
      ["volunteer_team_clock", "NOT_FOUND", 404],
    ];
    for (const [name, code, status] of cases) {
      db(() => ({ status: 400, body: { message: code, code: "P0001" } }));
      const r = await handle(post(`/api/rpc/${name}`, { p_session: "s" }, { cookie: COOKIE }), env);
      expect(r.status, `${name} ${code}`).toBe(status);
      expect(await r.json()).toEqual({ error: code });
    }
  });
  it("the team, the updates and phone notifications are the signed-in account's, from the cookie", async () => {
    const calls = db(() => ({ body: { ok: true } }));
    for (const name of ["volunteer_team", "volunteer_team_clock", "volunteer_updates", "volunteer_updates_seen", "customer_push_subscribe", "customer_push_unsubscribe"]) {
      expect((await handle(post(`/api/rpc/${name}`, {}), env)).status, name).toBe(401);
    }
    expect(calls).toHaveLength(0);
    await handle(post("/api/rpc/volunteer_team_clock", { p_session: "s", p_shift: 7, p_action: "in", p_id: "x" }, { cookie: COOKIE }), env);
    await handle(post("/api/rpc/customer_push_subscribe", { p_endpoint: "https://push.test/1", p_p256dh: "k", p_auth: "a", p_ua: "ua", p_token: "y" }, { cookie: COOKIE }), env);
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ["volunteer_team_clock", { p_session: "s", p_shift: 7, p_action: "in", p_id: "c123", p_token: "tokentokentokentoken" }],
      ["customer_push_subscribe", { p_endpoint: "https://push.test/1", p_p256dh: "k", p_auth: "a", p_ua: "ua", p_id: "c123", p_token: "tokentokentokentoken" }],
    ]);
  });
  it("the page may start its own service worker and read its own manifest, and nothing else's", async () => {
    const csp = (await handle(post("/api/nope"), env)).headers.get("content-security-policy") ?? "";
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("style-src 'self';");
  });
});

describe("a certificate's check (the staff review, 2026-11-06)", () => {
  it("anyone with the code may check it, signed in or not; only the code goes to the database", async () => {
    const calls = db(() => ({ body: { ok: true, serial: "MMV-2026-00001", name: "Sara", hours: 3.5 } }));
    const r = await handle(post("/api/rpc/volunteer_cert_check", { p_code: " abcdef123456 ", p_id: "x", p_token: "y" }), env);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, serial: "MMV-2026-00001" });
    expect(calls).toEqual([{ name: "volunteer_cert_check", args: { p_code: "ABCDEF123456" } }]);
  });
  it("a code of the wrong shape never reaches the database", async () => {
    const calls = db(() => ({ body: { ok: true } }));
    for (const p_code of ["short", "ABCDEF12345!", 42, ""]) {
      expect(await (await handle(post("/api/rpc/volunteer_cert_check", { p_code }), env)).json()).toEqual({ ok: false });
    }
    expect(calls).toHaveLength(0);
  });
  it("is metered like a sign-in", async () => {
    db(() => ({ body: { ok: true } }));
    const limited: Env = { ...env, LOGIN_LIMIT: { limit: async () => ({ success: false }) } };
    const r = await handle(post("/api/rpc/volunteer_cert_check", { p_code: "ABCDEF123456" }, { "cf-connecting-ip": "1.2.3.4" }), limited);
    expect(r.status).toBe(429);
  });
  it("the application, the briefing and a period's certificate need the session, from the cookie", async () => {
    const calls = db(() => ({ body: { ok: true } }));
    for (const name of ["volunteer_apply", "volunteer_brief_ack", "volunteer_cert_issue", "volunteer_profile"]) {
      expect((await handle(post(`/api/rpc/${name}`, {}), env)).status, name).toBe(401);
    }
    expect(calls).toHaveLength(0);
    await handle(post("/api/rpc/volunteer_cert_issue", { p_from: "2026-10-01", p_to: "2026-10-31" }, { cookie: COOKIE }), env);
    expect(calls[0].args).toEqual({ p_from: "2026-10-01", p_to: "2026-10-31", p_id: "c123", p_token: "tokentokentokentoken" });
  });
  it("no hours in the period is said as such", async () => {
    db(() => ({ status: 400, body: { message: "VOL_CERT_EMPTY", code: "P0001" } }));
    const r = await handle(post("/api/rpc/volunteer_cert_issue", { p_from: "2026-10-01", p_to: "2026-10-31" }, { cookie: COOKIE }), env);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "VOL_CERT_EMPTY" });
  });
});

describe("a ticket", () => {
  it("reads the booking app's ticket, with or without its number", () => {
    expect(parseTicket("MMC-12-abc123")).toEqual({ ref: "abc123", num: 12 });
    expect(parseTicket("mmc-AbC123")).toEqual({ ref: "abc123", num: null });
    expect(parseTicket("https://evil.test")).toBeNull();
    expect(parseTicket("MMP-A-001")).toBeNull();
  });
});

describe("the enhancements of 2026-11-11", () => {
  it("the plan, Still coming?, how it was and the motive go through, with the session from the cookie", async () => {
    const calls = db(() => ({ body: { ok: true } }));
    for (const name of ["volunteer_plan", "volunteer_coming", "volunteer_feedback", "volunteer_motive"]) {
      expect(RPCS.has(name), name).toBe(true);
      expect((await handle(post(`/api/rpc/${name}`, {}), env)).status, name).toBe(401);
    }
    expect(calls).toHaveLength(0);
    await handle(post("/api/rpc/volunteer_coming", { p_session: "s", p_yes: false, p_reason: "travel", p_id: "x" }, { cookie: COOKIE }), env);
    expect(calls[0]).toEqual({ name: "volunteer_coming", args: { p_session: "s", p_yes: false, p_reason: "travel", p_id: "c123", p_token: "tokentokentokentoken" } });
  });
  it("an opportunity for women or men only is a refusal of its own, and a function the database lacks says so", async () => {
    db(() => ({ status: 400, body: { message: "VOL_GENDER", code: "P0001" } }));
    const r = await handle(post("/api/rpc/volunteer_interest", { p_session: "s" }, { cookie: COOKIE }), env);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "VOL_GENDER" });
    db(() => ({ status: 404, body: { code: "PGRST202", message: "Could not find the function public.volunteer_coming" } }));
    const old = await handle(post("/api/rpc/volunteer_coming", { p_session: "s" }, { cookie: COOKIE }), env);
    expect(old.status).toBe(501);
    expect(await old.json()).toEqual({ error: "NOT_BUILT" });
  });

  const shift = { id: "2099-11-05-bd", title: null, ride_kind: "blood", event_kind: "community", date: "2099-11-05", time: "17:00 - 23:00", starts_at: "2099-11-05T17:00:00+03:00",
    ends_at: null, location: "JCC", meet_point: "Gate 3", role: "Guide", contact_name: "Ahmad", contact_phone: "+966500000010", status: "accepted", cancelled: false };
  const get = (path: string, headers: Record<string, string> = {}) => new Request(`${ORIGIN}${path}`, { headers });
  it("the calendar file is the volunteer's own shift, from volunteer_me, as text/calendar with two reminders", async () => {
    const calls = db(() => ({ body: { id: "c123", mine: [shift, { ...shift, id: "2099-12-01", status: "interested" }] } }));
    const r = await handle(get("/cal/2099-11-05-bd.ics?name=%D8%AA%D8%A8%D8%B1%D8%B9", { cookie: COOKIE }), env);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(r.headers.get("content-disposition")).toContain("micromobility-volunteer-2099-11-05-bd.ics");
    expect(r.headers.get("cache-control")).toBe("no-store");
    const ics = await r.text();
    expect(ics).toContain("SUMMARY:تبرع");
    expect(ics).toContain("DTSTART:20991105T140000Z");
    expect(ics).toContain("LOCATION:Gate 3");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(calls).toEqual([{ name: "volunteer_me", args: { p_id: "c123", p_token: "tokentokentokentoken" } }]);
    // an offer not yet accepted has no file, and signed out it is the sign-in
    expect((await handle(get("/cal/2099-12-01.ics", { cookie: COOKIE }), env)).status).toBe(404);
    const out = await handle(get("/cal/2099-11-05-bd.ics"), env);
    expect(out.status).toBe(302);
    expect(out.headers.get("location")).toBe(`${ORIGIN}/#o/2099-11-05-bd`);
  });
  it("without a name asked for, the file has the event's English name; a bad address is not a calendar", async () => {
    db(() => ({ body: { id: "c123", mine: [shift] } }));
    expect(await (await handle(get("/cal/2099-11-05-bd.ics", { cookie: COOKIE }), env)).text()).toContain("SUMMARY:MicroMobility Blood Donation");
    const assets: Env = { ...env, ASSETS: { fetch: async () => new Response("nope", { status: 404 }) } };
    expect((await handle(get("/cal/../x.ics", { cookie: COOKIE }), assets)).status).toBe(404);
  });
  it("files named by their content are kept a year; the page and the service worker are checked every time", async () => {
    const assets: Env = { ...env, ASSETS: { fetch: async () => new Response("x", { status: 200, headers: { "cache-control": "public, max-age=0, must-revalidate" } }) } };
    for (const p of ["/app-7ZY4QU7D.js", "/app-c6a0667d42.css", "/chunks/qrcode-STQSHRD3.js"]) {
      expect((await handle(get(p), assets)).headers.get("cache-control"), p).toBe("public, max-age=31536000, immutable");
    }
    for (const p of ["/", "/sw.js"]) expect((await handle(get(p), assets)).headers.get("cache-control"), p).toBe("no-cache");
    expect((await handle(get("/lang/ar.json"), assets)).headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
  });
});
