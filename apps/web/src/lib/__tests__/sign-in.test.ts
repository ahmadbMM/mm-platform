import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as signOut, POST as signIn } from "../../app/api/account/route";
import { POST as choose } from "../../app/api/account/password/route";
import { mustChange, pwdAnswer } from "../account-core";

// Signing in on the site (api/account) and choosing one's own password after a temporary one staff
// issued (api/account/password): the session goes into the HttpOnly account cookie, a temporary
// password holds the sign-in in a short cookie of its own until it is replaced (the booking app's
// forced change), and the Learn to ride form gets the session back for its own page, no cookie.
const ORIGIN = "https://micromobility.sa";
const OLD = "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0a1b2c3d4";
const NEW = "f0e1d2c3b4a5968778695a4b3c2d1e0ff0e1d2c3b4a59687";
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const post = (fn: (r: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = {}) =>
  fn(new Request(`${ORIGIN}${path}`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
const cookies = (r: Response) => r.headers.getSetCookie();
const login = [{ id: "c1", name: "Sara Ali", email: "sara@example.com", session_token: OLD }];
/** The database: customer_login answers `login`, customer_pwd_state `must`, customer_set_own_password `set`. */
function db(o: { must?: Response; set?: Response } = {}) {
  const f = vi.fn(async (url: string) => {
    if (url.endsWith("/rpc/customer_login")) return json(login);
    if (url.endsWith("/rpc/customer_pwd_state")) return o.must ?? json(false);
    if (url.endsWith("/rpc/customer_set_own_password")) return o.set ?? json(NEW);
    return json(null, 404);
  });
  vi.stubGlobal("fetch", f);
  return f;
}
const called = (f: ReturnType<typeof db>, fn: string) => f.mock.calls.filter((c) => String(c[0]).endsWith(`/rpc/${fn}`)).map((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)));

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("api/account", () => {
  it("signs in with the account cookie when the password is the rider's own", async () => {
    const f = db();
    const res = await post(signIn, "/api/account", { identifier: "Sara@Example.com", password: "Secret123" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, name: "Sara Ali" });
    expect(cookies(res)).toEqual([`mm_acct=c1~${OLD}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`]);
    expect(called(f, "customer_login")).toEqual([{ p_identifier: "sara@example.com", p_pwd: "Secret123" }]);
    expect(called(f, "customer_pwd_state")).toEqual([{ p_id: "c1", p_token: OLD }]);
  });
  it("holds a sign-in with a temporary password: no account cookie, must_change, the held cookie for the password route only", async () => {
    db({ must: json(true) });
    const res = await post(signIn, "/api/account", { identifier: "sara@example.com", password: "Temp1234" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "must_change" });
    expect(cookies(res)).toEqual([`mm_pwd=c1~${OLD}; Path=/api/account; Max-Age=600; HttpOnly; Secure; SameSite=Lax`]);
  });
  it("hands the Learn to ride form its session for the page, and sets no cookie", async () => {
    db();
    const res = await post(signIn, "/api/account", { identifier: "0551234567", password: "Secret123", page: true });
    expect(await res.json()).toEqual({ ok: true, id: "c1", token: OLD, name: "Sara Ali", email: "sara@example.com" });
    expect(cookies(res)).toEqual([]);
    db({ must: json(true) });
    expect(await (await post(signIn, "/api/account", { identifier: "sara@example.com", password: "Temp1234", page: true })).json()).toEqual({ ok: false, error: "must_change" });
  });
  it("lets a sign-in through when the database has no customer_pwd_state, and refuses one it could not ask", async () => {
    db({ must: json({ code: "PGRST202", message: "Could not find the function" }, 404) });
    expect((await post(signIn, "/api/account", { identifier: "sara@example.com", password: "Secret123" })).status).toBe(200);
    db({ must: json({ message: "down" }, 503) });
    const res = await post(signIn, "/api/account", { identifier: "sara@example.com", password: "Secret123" });
    expect(res.status).toBe(502);
    expect(cookies(res)).toEqual([]);
  });
  it("signs out of both cookies", async () => {
    const res = await signOut(new Request(`${ORIGIN}/api/account`, { method: "DELETE", headers: { origin: ORIGIN } }));
    expect(cookies(res)).toEqual(["mm_acct=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax", "mm_pwd=; Path=/api/account; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]);
  });
});

describe("api/account/password", () => {
  const held = { cookie: `mm_pwd=c1~${OLD}` };
  it("replaces the temporary password with the held sign-in and signs in with the new session", async () => {
    const f = db();
    const res = await post(choose, "/api/account/password", { password: "MyOwn2026" }, held);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(called(f, "customer_set_own_password")).toEqual([{ p_id: "c1", p_token: OLD, p_new_pwd: "MyOwn2026" }]);
    expect(cookies(res)).toEqual([`mm_acct=c1~${NEW}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`, "mm_pwd=; Path=/api/account; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]);
  });
  it("hands the Learn to ride form the new session instead of a cookie", async () => {
    db();
    const res = await post(choose, "/api/account/password", { password: "MyOwn2026", page: true }, held);
    expect(await res.json()).toEqual({ ok: true, id: "c1", token: NEW });
    expect(cookies(res)).toEqual(["mm_pwd=; Path=/api/account; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]);
  });
  it("refuses another site, no held sign-in and a password the rule refuses, without asking the database", async () => {
    const f = db();
    expect((await post(choose, "/api/account/password", { password: "MyOwn2026" }, { ...held, origin: "https://evil.example" })).status).toBe(403);
    expect(await (await post(choose, "/api/account/password", { password: "MyOwn2026" })).json()).toEqual({ ok: false, error: "expired" });
    for (const p of ["short1A", "nouppercase1", "NoDigitsHere"]) expect(await (await post(choose, "/api/account/password", { password: p }, held)).json()).toEqual({ ok: false, error: "weak" });
    expect(f).not.toHaveBeenCalled();
  });
  it("says the database's answer: the same password, a session that ended, nothing left to change", async () => {
    db({ set: json({ code: "22023", message: "SAME_PASSWORD" }, 400) });
    expect(await (await post(choose, "/api/account/password", { password: "Temp1234" }, held)).json()).toEqual({ ok: false, error: "same" });
    db({ set: json({ code: "28000", message: "BAD_TOKEN" }, 403) });
    const gone = await post(choose, "/api/account/password", { password: "MyOwn2026" }, held);
    expect(await gone.json()).toEqual({ ok: false, error: "expired" });
    expect(cookies(gone)).toEqual(["mm_pwd=; Path=/api/account; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]);
    // staff cleared the mark meanwhile: the held session stands
    db({ set: json({ code: "P0001", message: "NO_CHANGE_DUE" }, 400) });
    const done = await post(choose, "/api/account/password", { password: "MyOwn2026" }, held);
    expect(await done.json()).toEqual({ ok: true });
    expect(cookies(done)[0]).toBe(`mm_acct=c1~${OLD}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`);
    db({ set: json({ message: "down" }, 503) });
    expect((await post(choose, "/api/account/password", { password: "MyOwn2026" }, held)).status).toBe(502);
  });
});

describe("the database's answers", () => {
  it("customer_pwd_state: true only when it says so; a missing function never holds anyone; no answer is unknown", () => {
    expect(mustChange({ status: 200, data: true })).toBe(true);
    expect(mustChange({ status: 200, data: false })).toBe(false);
    expect(mustChange({ status: 404, data: null })).toBe(false);
    expect(mustChange({ status: 0, data: null })).toBeNull();
    expect(mustChange({ status: 503, data: null })).toBeNull();
  });
  it("customer_set_own_password: the new token, or why not", () => {
    expect(pwdAnswer({ status: 200, data: NEW, message: "" })).toEqual({ token: NEW });
    expect(pwdAnswer({ status: 200, data: "", message: "" })).toEqual({ error: "generic" });
    expect(pwdAnswer({ status: 400, data: null, message: "WEAK_PASSWORD" })).toEqual({ error: "weak" });
  });
});
