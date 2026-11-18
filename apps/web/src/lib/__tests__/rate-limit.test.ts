import { afterEach, describe, expect, it, vi } from "vitest";
import { withinLimit } from "../rate-limit";
import { POST as logError } from "../../app/api/log-error/route";

// The page-error reports and the signed-in pop-ups' checks (lib/rate-limit.ts): 30 of each a minute
// per connection, through Cloudflare's limiter. Outside a Worker there is none, and nothing is held.
const req = (ip = "203.0.113.9") => new Request("https://micromobility.sa/api/log-error", { method: "POST", headers: { "cf-connecting-ip": ip } });
afterEach(() => vi.restoreAllMocks());

describe("withinLimit", () => {
  it("counts each kind of request per connection, and holds it once the limiter says so", async () => {
    const limit = vi.fn(async ({ key }: { key: string }) => ({ success: !key.startsWith("log-error") }));
    expect(await withinLimit(req(), "log-error", () => ({ limit }))).toBe(false);
    expect(await withinLimit(req(), "account-check", () => ({ limit }))).toBe(true);
    expect(limit.mock.calls.map((c) => c[0].key)).toEqual(["log-error:203.0.113.9", "account-check:203.0.113.9"]);
  });
  it("counts an IPv6 connection by its /64: a new address in it for each request is the same visitor", async () => {
    const limit = vi.fn(async ({ key }: { key: string }) => ({ success: key !== "" }));
    await withinLimit(req("2001:db8:aa:bb::1"), "claim", () => ({ limit }));
    await withinLimit(req("2001:db8:aa:bb:9f3:2c:7:e1"), "claim", () => ({ limit }));
    expect(limit.mock.calls.map((c) => c[0].key)).toEqual(["claim:2001:db8:aa:bb::/64", "claim:2001:db8:aa:bb::/64"]);
  });
  it("counts an Ask request by its account: a room answering from one Wi-Fi does not share thirty requests a minute", async () => {
    const limit = vi.fn(async ({ key }: { key: string }) => ({ success: key !== "" }));
    await withinLimit(req(), "ask", () => ({ limit }), "c1");
    await withinLimit(req(), "ask", () => ({ limit }), "c2");
    await withinLimit(req(), "ask", () => ({ limit })); // signed out: the connection's own count
    await withinLimit(req("2001:db8:aa:bb::1"), "ask", () => ({ limit }), "c1");
    expect(limit.mock.calls.map((c) => c[0].key)).toEqual(["ask:203.0.113.9:c1", "ask:203.0.113.9:c2", "ask:203.0.113.9", "ask:2001:db8:aa:bb::/64:c1"]);
  });
  it("counts a signed-in account's checks by its account, under a wider ceiling for the whole connection", async () => {
    const limit = vi.fn(async ({ key }: { key: string }) => ({ success: key !== "" }));
    const wide = vi.fn(async ({ key }: { key: string }) => ({ success: key !== "" }));
    await withinLimit(req(), "account-check", () => ({ limit }), "c1", () => ({ limit: wide }));
    await withinLimit(req(), "account-check", () => ({ limit }), "c2", () => ({ limit: wide }));
    expect(limit.mock.calls.map((c) => c[0].key)).toEqual(["account-check:203.0.113.9:c1", "account-check:203.0.113.9:c2"]);
    expect(wide.mock.calls.map((c) => c[0].key)).toEqual(["account-check:203.0.113.9", "account-check:203.0.113.9"]);
    // a script making up a new account id for each request is held by the connection's ceiling
    const full = vi.fn(async () => ({ success: false }));
    expect(await withinLimit(req(), "account-check", () => ({ limit }), "c3", () => ({ limit: full }))).toBe(false);
    // the ceiling is the signed-in checks' only: Ask keeps its per-account count alone
    const unused = vi.fn(async () => ({ success: false }));
    expect(await withinLimit(req(), "ask", () => ({ limit }), "c1", () => ({ limit: unused }))).toBe(true);
    expect(unused).not.toHaveBeenCalled();
    // a ceiling that fails holds nobody
    expect(await withinLimit(req(), "account-check", () => ({ limit }), "c4", () => ({ limit: async () => { throw new Error("down"); } }))).toBe(true);
  });
  it("lets everything through with no limiter, no address, or a limiter that fails", async () => {
    expect(await withinLimit(req(), "log-error")).toBe(true);
    const limit = vi.fn(async () => ({ success: false }));
    expect(await withinLimit(req(""), "log-error", () => ({ limit }))).toBe(true);
    expect(limit).not.toHaveBeenCalled();
    expect(await withinLimit(req(), "log-error", () => ({ limit: async () => { throw new Error("down"); } }))).toBe(true);
  });
});

describe("api/log-error", () => {
  const send = (body: unknown, origin = "https://micromobility.sa") =>
    logError(new Request("https://micromobility.sa/api/log-error", { method: "POST", headers: { origin, "content-type": "text/plain" }, body: JSON.stringify(body) }));
  it("logs the page's path without its query or fragment", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await send({ digest: "d1", message: "boom", path: "/account?handoff=done&code=abc#x" })).status).toBe(204);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ kind: "page-error", digest: "d1", message: "boom", path: "/account" });
  });
  it("answers 400, never a 500, to a body that is not a report", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const body of [null, 42, ["x"]]) expect((await send(body)).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });
  it("takes reports from this site's own pages only", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await send({ message: "x" }, "https://evil.example")).status).toBe(403);
    expect(log).not.toHaveBeenCalled();
  });
});
