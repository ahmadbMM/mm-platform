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
  it("takes reports from this site's own pages only", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await send({ message: "x" }, "https://evil.example")).status).toBe(403);
    expect(log).not.toHaveBeenCalled();
  });
});
