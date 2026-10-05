import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/account/handoff/route";

// The booking app hands a signed-in rider back with a one-time code (api/account/handoff). A code is
// anyone's to pass on, so it never replaces another account signed in here without asking.
const CODE = "ab".repeat(24);
const OTHER = "zz9y8x7w6v5u4t3s2r1q"; // the token of an account already signed in here
const TOK = "tk1a2b3c4d5e6f7g8h9i"; // the token the code is redeemed for
const call = (q: string, cookie?: string) => GET(new Request(`https://micromobility.sa/api/account/handoff${q}`, { headers: cookie ? { cookie } : {} }));
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const redeem = (rows: unknown, status = 200) => vi.fn(async () => answer(rows, status));
// the database: the code redeemed for c1, and the profile of whoever is signed in here
const db = (profile: () => Response) => vi.fn(async (url: string) =>
  url.endsWith("/rpc/customer_handoff_redeem") ? answer([{ id: "c1", name: "Spec", session_token: TOK }]) : url.endsWith("/rpc/customer_profile") ? profile() : answer([]));
const cookiesOf = (res: Response) => res.headers.getSetCookie();
const choose = (choice: string, cookie: string, origin = "https://micromobility.sa") =>
  POST(new Request("https://micromobility.sa/api/account/handoff", { method: "POST", headers: { origin, cookie, "content-type": "application/x-www-form-urlencoded" }, body: `do=${choice}` }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("api/account/handoff", () => {
  it("trades a good code for the session cookie and lands on the account, which says whom it signed in", async () => {
    const f = redeem([{ id: "c1", name: "Spec", session_token: TOK }]);
    vi.stubGlobal("fetch", f);
    const res = await call(`?code=${CODE}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://micromobility.sa/account?handoff=done");
    const set = cookiesOf(res);
    expect(set[0]).toMatch(/^mm_acct=c1~tk1a2b3c4d5e6f7g8h9i; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/);
    expect(set[1]).toBe("mm_acct_next=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
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

  it("never replaces another account signed in here: the session handed over waits, and the account page asks", async () => {
    const f = db(() => answer([{ name: "Someone Else", email: "else@example.com" }]));
    vi.stubGlobal("fetch", f);
    const res = await call(`?code=${CODE}`, `mm_acct=c2~${OTHER}`);
    expect(res.headers.get("location")).toBe("https://micromobility.sa/account");
    expect(cookiesOf(res)).toEqual([`mm_acct_next=c1~${TOK}; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Lax`]);
    const asked = f.mock.calls.find((c) => String(c[0]).endsWith("/rpc/customer_profile")) as unknown as [string, RequestInit];
    expect(JSON.parse(String(asked[1].body))).toEqual({ p_id: "c2", p_token: OTHER });
    // no answer about the account signed in here is not a reason to replace it either
    vi.stubGlobal("fetch", db(() => answer({ message: "down" }, 503)));
    expect(cookiesOf(await call(`?code=${CODE}`, `mm_acct=c2~${OTHER}`))[0]).toMatch(/^mm_acct_next=c1~tk1a2b3c4d5e6f7g8h9i;/);
  });
  it("signs in at once over the same account, or over a session the database no longer accepts", async () => {
    const f = db(() => answer([{ name: "Spec" }]));
    vi.stubGlobal("fetch", f);
    const same = await call(`?code=${CODE}`, `mm_acct=c1~${OTHER}`);
    expect(cookiesOf(same)[0]).toMatch(/^mm_acct=c1~tk1a2b3c4d5e6f7g8h9i;/);
    expect(f.mock.calls.some((c) => String(c[0]).endsWith("/rpc/customer_profile"))).toBe(false);
    vi.stubGlobal("fetch", db(() => answer([])));
    const dead = await call(`?code=${CODE}`, `mm_acct=c2~${OTHER}`);
    expect(dead.headers.get("location")).toBe("https://micromobility.sa/account?handoff=done");
    expect(cookiesOf(dead)[0]).toMatch(/^mm_acct=c1~tk1a2b3c4d5e6f7g8h9i;/);
  });

  it("switches to the account handed over only when the rider says so, from this site's own page", async () => {
    const both = `mm_acct=c2~${OTHER}; mm_acct_next=c1~${TOK}`;
    const sw = await choose("switch", both);
    expect(sw.status).toBe(303);
    expect(sw.headers.get("location")).toBe("https://micromobility.sa/account?handoff=done");
    expect(cookiesOf(sw)).toEqual([
      expect.stringMatching(/^mm_acct=c1~tk1a2b3c4d5e6f7g8h9i; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/),
      "mm_acct_next=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    ]);
    const stay = await choose("stay", both);
    expect(stay.headers.get("location")).toBe("https://micromobility.sa/account");
    expect(cookiesOf(stay)).toEqual(["mm_acct_next=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]);
    // nothing kept aside: nothing to switch to
    expect(cookiesOf(await choose("switch", `mm_acct=c2~${OTHER}`))).toEqual(["mm_acct_next=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"]);
    // another site's form changes nothing
    const evil = await choose("switch", both, "https://evil.example");
    expect(evil.status).toBe(403);
    expect(cookiesOf(evil)).toEqual([]);
  });
});
