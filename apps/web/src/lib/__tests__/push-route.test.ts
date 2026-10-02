import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/account/push/route";
import { cleanPushRequest } from "../push";

// The Account page's Notifications switch registers this browser for push (api/account/push),
// through the booking app's customer_push_subscribe / customer_push_unsubscribe.
const ORIGIN = "https://micromobility.sa";
const EP = "https://fcm.googleapis.com/fcm/send/abc123";
const P256DH = "B" + "a".repeat(86);
const AUTH = "q".repeat(22);
const SUB = { action: "subscribe", endpoint: EP, keys: { p256dh: P256DH, auth: AUTH } };

const call = (body: unknown, { origin = ORIGIN, cookie = "mm_acct=c1~tok_0123456789abcdef" }: { origin?: string | null; cookie?: string | null } = {}) => {
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Spec/1.0" };
  if (origin) headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  return POST(new Request(`${ORIGIN}/api/account/push`, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
};
const db = (answer: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } }));
const sent = (f: ReturnType<typeof db>, i = 0) => {
  const [url, init] = f.mock.calls[i] as unknown as [string, RequestInit];
  return { url, args: JSON.parse(String(init.body)) as Record<string, unknown> };
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("api/account/push", () => {
  it("registers this browser for the signed-in rider", async () => {
    const f = db(true);
    vi.stubGlobal("fetch", f);
    const res = await call(SUB);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(1);
    const { url, args } = sent(f);
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/customer_push_subscribe");
    expect(args).toEqual({ p_id: "c1", p_token: "tok_0123456789abcdef", p_endpoint: EP, p_p256dh: P256DH, p_auth: AUTH, p_ua: "Spec/1.0" });
  });
  it("removes this browser", async () => {
    const f = db(true);
    vi.stubGlobal("fetch", f);
    const res = await call({ action: "unsubscribe", endpoint: EP });
    expect(res.status).toBe(200);
    const { url, args } = sent(f);
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/customer_push_unsubscribe");
    expect(args).toEqual({ p_id: "c1", p_token: "tok_0123456789abcdef", p_endpoint: EP });
  });
  it("a replaced subscription drops the old endpoint's row too", async () => {
    const f = db(true);
    vi.stubGlobal("fetch", f);
    const OLD = "https://fcm.googleapis.com/fcm/send/old";
    expect((await call({ ...SUB, old: OLD })).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
    expect(sent(f, 1).url).toMatch(/customer_push_unsubscribe$/);
    expect(sent(f, 1).args).toEqual({ p_id: "c1", p_token: "tok_0123456789abcdef", p_endpoint: OLD });
  });
  it("only this site may call it", async () => {
    const f = db(true);
    vi.stubGlobal("fetch", f);
    expect((await call(SUB, { origin: "https://evil.example" })).status).toBe(403);
    expect((await call(SUB, { origin: null })).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });
  it("signed out, nothing reaches the database", async () => {
    const f = db(true);
    vi.stubGlobal("fetch", f);
    const res = await call(SUB, { cookie: null });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "signin" });
    expect(f).not.toHaveBeenCalled();
  });
  it("a malformed body is refused before the database", async () => {
    const f = db(true);
    vi.stubGlobal("fetch", f);
    for (const b of ["nope", {}, { ...SUB, endpoint: "http://insecure.example/x" }, { ...SUB, keys: { p256dh: "short", auth: AUTH } }, { ...SUB, action: "spam" }]) {
      expect((await call(b)).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it("a token the booking app no longer accepts asks to sign in again (unsubscribe) or refuses (subscribe)", async () => {
    vi.stubGlobal("fetch", db(false));
    expect((await call({ action: "unsubscribe", endpoint: EP })).status).toBe(401);
    const res = await call(SUB);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "refused" });
  });
  it("a database failure is reported, not hidden", async () => {
    vi.stubGlobal("fetch", db({ message: "boom" }, 500));
    expect((await call(SUB)).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await call(SUB)).status).toBe(502);
  });
});

describe("cleanPushRequest", () => {
  it("takes what PushSubscription.toJSON() gives", () => {
    expect(cleanPushRequest(SUB)).toEqual({ action: "subscribe", endpoint: EP, p256dh: P256DH, auth: AUTH, old: null });
  });
  it("drops padding and an old endpoint equal to the new one", () => {
    expect(cleanPushRequest({ ...SUB, keys: { p256dh: P256DH + "=", auth: AUTH + "==" }, old: EP })).toEqual({ action: "subscribe", endpoint: EP, p256dh: P256DH, auth: AUTH, old: null });
  });
  it("refuses an over-long endpoint and keys that are not base64url", () => {
    expect(cleanPushRequest({ ...SUB, endpoint: `https://x.example/${"a".repeat(1100)}` })).toBeNull();
    expect(cleanPushRequest({ ...SUB, keys: { p256dh: P256DH.replace("a", "+"), auth: AUTH } })).toBeNull();
    expect(cleanPushRequest(null)).toBeNull();
  });
});
