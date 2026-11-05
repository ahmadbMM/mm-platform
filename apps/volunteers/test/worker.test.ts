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
    expect([...RPCS].every((n) => n.startsWith("volunteer_"))).toBe(true);
  });
  it("anyone may read the opportunities, with no session", async () => {
    const calls = db(() => ({ body: [{ id: "s1" }] }));
    const r = await handle(post("/api/rpc/volunteer_opportunities"), env);
    expect(await r.json()).toEqual([{ id: "s1" }]);
    expect(calls[0].args).toEqual({});
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

describe("a ticket", () => {
  it("reads the booking app's ticket, with or without its number", () => {
    expect(parseTicket("MMC-12-abc123")).toEqual({ ref: "abc123", num: 12 });
    expect(parseTicket("mmc-AbC123")).toEqual({ ref: "abc123", num: null });
    expect(parseTicket("https://evil.test")).toBeNull();
    expect(parseTicket("MMP-A-001")).toBeNull();
  });
});
