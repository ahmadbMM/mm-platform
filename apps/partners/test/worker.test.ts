import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker/index";
import { RPCS, RPC_BODY_LIMIT, type Env } from "../src/worker/app";
import { CSP } from "../src/worker/headers";
import { decodeSession, encodeSession, readCookie } from "../src/worker/session";

const ORIGIN = "https://partners.example.test";
const TOKEN = "a".repeat(48);
const COOKIE = `mm_fnb=7~${TOKEN}`;

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };
let calls: Call[] = [];
let answer: () => Response;

function env(extra: Partial<Env> = {}): Env {
  return {
    SUPABASE_URL: "https://db.example.test",
    SUPABASE_ANON_KEY: "anon-key",
    ASSETS: { fetch: async () => new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } }) },
    ...extra,
  };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const dbJson = (data: unknown, status = 200) => () => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const dbError = (message: string, code = "P0001", status = 400) => dbJson({ code, message, details: null, hint: null }, status);

beforeEach(() => {
  calls = [];
  answer = dbJson(null);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body || "{}")) });
    return answer();
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("session cookie values", () => {
  it("round-trips and refuses junk", () => {
    expect(decodeSession(encodeSession({ id: 7, token: TOKEN }))).toEqual({ id: 7, token: TOKEN });
    expect(decodeSession("7~short")).toBeNull();
    expect(decodeSession("x~" + TOKEN)).toBeNull();
    expect(decodeSession(`7~${TOKEN};evil`)).toBeNull();
    expect(readCookie(`a=1; mm_fnb=7~${TOKEN}; b=2`, "mm_fnb")).toBe(`7~${TOKEN}`);
  });
});

describe("POST /api/login", () => {
  it("sets the cookie on success and keeps the token out of the body", async () => {
    answer = dbJson({ id: 7, token: TOKEN, must_change: true });
    const res = await worker.fetch(post("/api/login", { login: " Cafe@Example.com ", password: "Secret123" }), env());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ must_change: true });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    const c = res.headers.get("set-cookie")!;
    expect(c).toContain(`mm_fnb=7~${TOKEN}`);
    for (const part of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=2592000"]) expect(c).toContain(part);
    expect(c).not.toMatch(/Domain=/i);
    expect(calls[0].url).toBe("https://db.example.test/rest/v1/rpc/fnb_login");
    expect(calls[0].body).toEqual({ p_login: "Cafe@Example.com", p_pwd: "Secret123" });
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.apikey).toBe("anon-key");
    expect(h.Authorization).toBe("Bearer anon-key");
  });

  it("answers BAD_LOGIN (401, no cookie) for a wrong password", async () => {
    answer = dbJson({ error: "BAD_LOGIN" });
    const res = await worker.fetch(post("/api/login", { login: "a@b.c", password: "nope" }), env());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "BAD_LOGIN" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("answers LOCKED with 429", async () => {
    answer = dbError("LOCKED");
    const res = await worker.fetch(post("/api/login", { login: "a@b.c", password: "x" }), env());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "LOCKED" });
  });

  it("refuses empty input without calling the database", async () => {
    const res = await worker.fetch(post("/api/login", { login: "", password: "" }), env());
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("is metered by the rate limiter, keyed by the connection, and fails open without one", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await worker.fetch(post("/api/login", { login: "a@b.c", password: "x" }, { "cf-connecting-ip": "203.0.113.9" }), env({ LOGIN_LIMIT: { limit } }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMIT" });
    expect(limit).toHaveBeenCalledWith({ key: "fnb-sign-in:203.0.113.9" });
    expect(calls).toHaveLength(0);

    const broken = { limit: vi.fn(async () => { throw new Error("down"); }) };
    answer = dbJson({ error: "BAD_LOGIN" });
    const res2 = await worker.fetch(post("/api/login", { login: "a@b.c", password: "x" }, { "cf-connecting-ip": "203.0.113.9" }), env({ LOGIN_LIMIT: broken }));
    expect(res2.status).toBe(401);
  });

  it("answers a database it cannot reach as 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    const res = await worker.fetch(post("/api/login", { login: "a@b.c", password: "x" }), env());
    expect(res.status).toBe(502);
  });
});

describe("POST /api/logout", () => {
  it("clears the cookie", async () => {
    const res = await worker.fetch(post("/api/logout", {}, { Cookie: COOKIE }), env());
    expect(res.status).toBe(200);
    const c = res.headers.get("set-cookie")!;
    expect(c).toMatch(/^mm_fnb=;/);
    expect(c).toContain("Max-Age=0");
    expect(c).toContain("HttpOnly");
  });
});

describe("POST /api/rpc/<name>", () => {
  it("allows only the portal's functions", async () => {
    for (const name of ["fnb_login", "staff_fnb_decide", "customer_login", "fnb_me2", "is_staff"]) {
      const res = await worker.fetch(post(`/api/rpc/${name}`, {}, { Cookie: COOKIE }), env());
      expect(res.status).toBe(404);
    }
    expect(calls).toHaveLength(0);
    expect([...RPCS].sort()).toEqual(["fnb_calendar", "fnb_cancel", "fnb_feedback_save", "fnb_me", "fnb_preview", "fnb_profile_save", "fnb_request", "fnb_set_password"]);
  });

  it("takes p_uid and p_token from the cookie, never from the body", async () => {
    answer = dbJson([]);
    const res = await worker.fetch(post("/api/rpc/fnb_calendar", { p_from: "2026-10-01", p_to: "2026-10-31", p_uid: 1, p_token: "b".repeat(48) }, { Cookie: COOKIE }), env());
    expect(res.status).toBe(200);
    expect(calls[0].url).toBe("https://db.example.test/rest/v1/rpc/fnb_calendar");
    expect(calls[0].body).toEqual({ p_from: "2026-10-01", p_to: "2026-10-31", p_uid: 7, p_token: TOKEN });
  });

  it("answers 401 and clears the cookie without a session", async () => {
    const res = await worker.fetch(post("/api/rpc/fnb_me", {}), env());
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(calls).toHaveLength(0);
  });

  it("maps BAD_TOKEN to 401 and clears the cookie", async () => {
    answer = dbError("BAD_TOKEN", "28000", 403);
    const res = await worker.fetch(post("/api/rpc/fnb_me", {}, { Cookie: COOKIE }), env());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "BAD_TOKEN" });
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("passes known errors through and hides unknown ones", async () => {
    answer = dbError("WEAK_PASSWORD", "22023");
    let res = await worker.fetch(post("/api/rpc/fnb_set_password", { p_new: "weak" }, { Cookie: COOKIE }), env());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "WEAK_PASSWORD" });
    expect(res.headers.get("set-cookie")).toBeNull();

    answer = dbError("relation secret_table does not exist", "42P01", 500);
    res = await worker.fetch(post("/api/rpc/fnb_me", {}, { Cookie: COOKIE }), env());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "SERVER" });
  });

  it("saves feedback with the session from the cookie and words its refusals", async () => {
    const row = { booking_id: 5, venue_id: 3, day: "2026-09-26", rating: 4, turnout: 9, went_well: "Quick", improve: "", created_at: "x", updated_at: "x" };
    answer = dbJson(row);
    const args = { p_booking: 5, p_rating: 4, p_turnout: 9, p_went_well: "Quick", p_improve: "" };
    let res = await worker.fetch(post("/api/rpc/fnb_feedback_save", { ...args, p_uid: 1 }, { Cookie: COOKIE }), env());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(row);
    expect(calls[0].url).toBe("https://db.example.test/rest/v1/rpc/fnb_feedback_save");
    expect(calls[0].body).toEqual({ ...args, p_uid: 7, p_token: TOKEN });

    for (const [message, code] of [["NOT_CONFIRMED", "P0001"], ["TOO_EARLY", "P0001"], ["TOO_LATE", "P0001"], ["BAD_RATING", "22023"]]) {
      answer = dbError(message, code);
      res = await worker.fetch(post("/api/rpc/fnb_feedback_save", args, { Cookie: COOKIE }), env());
      expect(res.status, message).toBe(400);
      expect(await res.json()).toEqual({ error: message });
    }
    answer = dbError("NOT_FOUND", "P0002");
    res = await worker.fetch(post("/api/rpc/fnb_feedback_save", args, { Cookie: COOKIE }), env());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND" });
  });

  it("rewrites the cookie with the new token after a password change", async () => {
    const fresh = "c".repeat(48);
    answer = dbJson(fresh);
    const res = await worker.fetch(post("/api/rpc/fnb_set_password", { p_new: "NewPass123", p_old: "OldPass123" }, { Cookie: COOKIE }), env());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toContain(`mm_fnb=7~${fresh}`);
    expect(calls[0].body).toEqual({ p_new: "NewPass123", p_old: "OldPass123", p_uid: 7, p_token: TOKEN });
  });

  it("answers a void function (204, empty body) as null", async () => {
    answer = () => new Response(null, { status: 204 });
    const res = await worker.fetch(post("/api/rpc/fnb_profile_save", { p_data: { seats: "40" } }, { Cookie: COOKIE }), env());
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe("every POST", () => {
  it("refuses another origin, or none", async () => {
    let res = await worker.fetch(post("/api/login", { login: "a", password: "b" }, { Origin: "https://evil.example" }), env());
    expect(res.status).toBe(403);
    const noOrigin = new Request(`${ORIGIN}/api/rpc/fnb_me`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: COOKIE }, body: "{}" });
    res = await worker.fetch(noOrigin, env());
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("takes JSON only", async () => {
    const res = await worker.fetch(post("/api/rpc/fnb_me", "p_uid=1", { Cookie: COOKIE, "Content-Type": "application/x-www-form-urlencoded" }), env());
    expect(res.status).toBe(415);
  });

  it("refuses bodies that are not a JSON object, and big ones", async () => {
    let res = await worker.fetch(post("/api/rpc/fnb_me", "[1,2]", { Cookie: COOKIE }), env());
    expect(res.status).toBe(400);
    res = await worker.fetch(post("/api/rpc/fnb_me", "{not json", { Cookie: COOKIE }), env());
    expect(res.status).toBe(400);
    res = await worker.fetch(post("/api/rpc/fnb_request", { p_note: "x".repeat(RPC_BODY_LIMIT) }, { Cookie: COOKIE }), env());
    expect(res.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it("refuses other methods on /api", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/api/rpc/fnb_me`), env());
    expect(res.status).toBe(405);
  });
});

describe("headers", () => {
  it("are on pages and API answers alike", async () => {
    const page = await worker.fetch(new Request(`${ORIGIN}/`), env());
    const api = await worker.fetch(post("/api/logout", {}), env());
    for (const res of [page, api]) {
      expect(res.headers.get("content-security-policy")).toBe(CSP);
      expect(res.headers.get("strict-transport-security")).toContain("max-age=");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBeTruthy();
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
    }
    for (const part of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'"]) {
      expect(CSP).toContain(part);
    }
    expect(CSP).not.toContain("unsafe-inline");
    expect(api.headers.get("cache-control")).toBe("no-store");
  });
});
