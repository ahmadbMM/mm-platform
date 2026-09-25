import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/account/handoff/route";

// The booking app hands a signed-in rider back with a one-time code (api/account/handoff).
const CODE = "ab".repeat(24);
const call = (q: string) => GET(new Request(`https://micromobility.sa/api/account/handoff${q}`));
const redeem = (rows: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(rows), { status, headers: { "content-type": "application/json" } }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("api/account/handoff", () => {
  it("trades a good code for the session cookie and lands on the account", async () => {
    const f = redeem([{ id: "c1", name: "Spec", session_token: "tok" }]);
    vi.stubGlobal("fetch", f);
    const res = await call(`?code=${CODE}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://micromobility.sa/account");
    expect(res.headers.get("set-cookie")).toMatch(/^mm_acct=c1~tok; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/customer_handoff_redeem");
    expect(JSON.parse(String(init.body))).toEqual({ p_code: CODE });
  });
  it("a used, unknown or late code lands on the sign-in, saying so", async () => {
    vi.stubGlobal("fetch", redeem([]));
    const res = await call(`?code=${CODE}`);
    expect(res.headers.get("location")).toBe("https://micromobility.sa/account?handoff=expired");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("a malformed code never reaches the database", async () => {
    const f = redeem([]);
    vi.stubGlobal("fetch", f);
    expect((await call("?code=nope")).headers.get("location")).toBe("https://micromobility.sa/account");
    expect(f).not.toHaveBeenCalled();
  });
});
