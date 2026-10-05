import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker/index";
import type { Env } from "../src/worker/app";

// Sign out ends the venue's token in the database too (vendor_logout, rentals 20261004100000):
// clearing the cookie alone left a copied cookie working until the next password change. The
// cookie goes whatever the database answers.
const ORIGIN = "https://vendors.example.test";
const TOKEN = "a".repeat(48);
const COOKIE = `mm_vendor=7~${TOKEN}`;

let calls: { url: string; body: Record<string, unknown> }[] = [];
let answer: () => Response;
const env = (): Env => ({ SUPABASE_URL: "https://db.example.test", SUPABASE_ANON_KEY: "anon-key" });
const post = (headers: Record<string, string> = {}, body: unknown = {}) =>
  new Request(`${ORIGIN}/api/logout`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

beforeEach(() => {
  calls = [];
  answer = () => new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body || "{}")) });
    return answer();
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("sign out", () => {
  it("ends the token on the server with the cookie's id and token, never the body's", async () => {
    const res = await worker.fetch(post({ Cookie: COOKIE }, { p_uid: "9", p_token: "b".repeat(48) }), env());
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^mm_vendor=;.*Max-Age=0/);
    expect(calls).toEqual([{ url: "https://db.example.test/rest/v1/rpc/vendor_logout", body: { p_uid: "7", p_token: TOKEN } }]);
  });

  it("still clears the cookie when the database lacks the function or cannot be reached", async () => {
    answer = () => new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function public.vendor_logout" }), { status: 404 });
    const a = await worker.fetch(post({ Cookie: COOKIE }), env());
    expect(a.status).toBe(200);
    expect(a.headers.get("set-cookie")).toMatch(/^mm_vendor=;/);
    answer = () => { throw new TypeError("network"); };
    const b = await worker.fetch(post({ Cookie: COOKIE }), env());
    expect(b.status).toBe(200);
    expect(b.headers.get("set-cookie")).toMatch(/^mm_vendor=;/);
  });

  it("asks the database nothing without a session cookie", async () => {
    const res = await worker.fetch(post(), env());
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
  });
});
