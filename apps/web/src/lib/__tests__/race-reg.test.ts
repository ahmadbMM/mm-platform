import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { raceRegBody, raceRegView } from "../race-reg";
import { POST } from "../../app/api/account/race-reg/route";

// The DEFE 5KM Run's "Have you registered for the race?" (2026-10-18): the ticket posts the runner's answer,
// which the booking app's customer_set_race_reg saves on the booking with the account's token.

describe("the race question's answer", () => {
  it("reads a booking id and yes or no, nothing else", () => {
    expect(raceRegBody({ entryId: "q_abc-1", answer: "yes" })).toEqual({ entryId: "q_abc-1", answer: "yes" });
    expect(raceRegBody({ entryId: "q1", answer: " NO " })).toEqual({ entryId: "q1", answer: "no" });
    for (const b of [null, "yes", {}, { entryId: "q1" }, { entryId: "q1", answer: "maybe" }, { entryId: "a b", answer: "yes" }, { entryId: "x".repeat(65), answer: "no" }, { entryId: 5, answer: "yes" }])
      expect(raceRegBody(b), JSON.stringify(b)).toBeNull();
  });
  it("shows the note after Yes, the question until then, and the way to Race Arabia after No", () => {
    expect(raceRegView(null, false)).toBe("ask");
    expect(raceRegView("no", false)).toBe("askNo");
    expect(raceRegView("yes", false)).toBe("done");
    expect(raceRegView("yes", true)).toBe("ask"); // Change pressed
  });
});

describe("api/account/race-reg", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
  const post = (body: unknown, headers: Record<string, string> = HEADERS) =>
    POST(new Request("https://micromobility.sa/api/account/race-reg", { method: "POST", headers, body: JSON.stringify(body) }));
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("saves the answer through customer_set_race_reg with the cookie's id and token", async () => {
    const f = vi.fn(async () => json(true));
    vi.stubGlobal("fetch", f);
    const res = await post({ entryId: "q1abcdef", answer: "no" });
    expect([res.status, await res.json()]).toEqual([200, { ok: true }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/customer_set_race_reg");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_entry_id: "q1abcdef", p_answer: "no" });
  });
  it("refuses another site, a missing cookie and a bad answer without touching the database", async () => {
    const f = vi.fn(async () => json(true));
    vi.stubGlobal("fetch", f);
    expect((await post({ entryId: "q1", answer: "yes" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ entryId: "q1", answer: "yes" }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post({ entryId: "q1", answer: "perhaps" })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it("says what the database answered: refused, not there yet, or failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(false)));
    expect(await (await post({ entryId: "q1", answer: "yes" })).json()).toEqual({ ok: false, error: "refused" });
    vi.stubGlobal("fetch", vi.fn(async () => json({ code: "PGRST202", message: "Could not find the function public.customer_set_race_reg" }, 404)));
    expect(await (await post({ entryId: "q1", answer: "yes" })).json()).toEqual({ ok: false, error: "absent" });
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "boom" }, 500)));
    expect((await post({ entryId: "q1", answer: "yes" })).status).toBe(502);
  });
});
