import { afterEach, describe, expect, it, vi } from "vitest";
import { ipNet, passesCheck, withinTries } from "../sign-in-guard";

// The sign-in's guard (lib/sign-in-guard.ts). Outside a Worker there is no rate limiter, and the
// Turnstile secret is read from the environment.
const req = (ip = "203.0.113.9") => new Request("https://micromobility.sa/api/account", { method: "POST", headers: { "cf-connecting-ip": ip } });
afterEach(() => vi.unstubAllEnvs());

describe("withinTries", () => {
  it("lets every try through where there is no limiter", async () => {
    expect(await withinTries(req())).toBe(true);
  });
});

describe("ipNet", () => {
  it("counts an IPv4 address whole, and an IPv6 address by its /64 however it is written", () => {
    expect(ipNet("203.0.113.9")).toBe("203.0.113.9");
    expect(ipNet("2001:db8:aa:bb:1:2:3:4")).toBe("2001:db8:aa:bb::/64");
    expect(ipNet("2001:0DB8:00aa:00bb:ffff::1")).toBe("2001:db8:aa:bb::/64");
    expect(ipNet("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipNet("2001:db8:aa:bb::")).toBe("2001:db8:aa:bb::/64");
    expect(ipNet("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(ipNet("not:an:address")).toBe("not:an:address");
  });
});

describe("passesCheck", () => {
  it("asks for nothing until the secret is set", async () => {
    expect(await passesCheck(req(), "")).toBe(true);
  });
  it("refuses a try without a token once it is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s3cret");
    expect(await passesCheck(req(), "")).toBe(false);
  });
  it("asks Cloudflare, with the secret, the token and the visitor's address", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s3cret");
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      const b = init.body as FormData;
      expect([b.get("secret"), b.get("response"), b.get("remoteip")]).toEqual(["s3cret", "tok", "203.0.113.9"]);
      return new Response(JSON.stringify({ success: true }));
    });
    expect(await passesCheck(req(), "tok", f as unknown as typeof fetch)).toBe(true);
    const no = vi.fn(async () => new Response(JSON.stringify({ success: false })));
    expect(await passesCheck(req(), "tok", no as unknown as typeof fetch)).toBe(false);
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await passesCheck(req(), "tok", down as unknown as typeof fetch)).toBe(false);
  });
});
