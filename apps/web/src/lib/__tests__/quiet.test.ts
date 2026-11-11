import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The pop-ups' quiet windows (components/account/quiet.ts): a sign-in through the booking app's hand-over lands on
// /account?handoff=done with no sign-in form, and the first look at a window there forgets the last account's
// (bug hunt 2026-11-11): kept, the new account's waiver, sport question or rating stayed hidden for minutes.
const store = new Map<string, string>();
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const at = (search: string) => vi.stubGlobal("window", { location: { search } });

beforeEach(() => { vi.resetModules(); store.clear(); vi.stubGlobal("sessionStorage", storage); });
afterEach(() => vi.unstubAllGlobals());

describe("the quiet windows", () => {
  it("hold while they are open, on any page", async () => {
    const q = await import("@/components/account/quiet");
    at("");
    store.set(q.WAIVER_QUIET, String(Date.now() + 60_000));
    store.set(q.RATE_QUIET, String(Date.now() - 1));
    expect(q.isQuiet(q.WAIVER_QUIET)).toBe(true);
    expect(q.isQuiet(q.RATE_QUIET)).toBe(false);
    expect(q.isQuiet(q.SPORT_QUIET)).toBe(false);
  });
  it("are all forgotten once after a hand-over, then kept again for the new account", async () => {
    const q = await import("@/components/account/quiet");
    at("?handoff=done");
    for (const k of [q.EM_QUIET, q.SPORT_QUIET, q.WAIVER_QUIET, q.RATE_QUIET]) store.set(k, String(Date.now() + 60_000));
    expect(q.isQuiet(q.SPORT_QUIET)).toBe(false);
    expect(store.size).toBe(0);
    store.set(q.EM_QUIET, String(Date.now() + 60_000)); // the new account's own answer
    expect(q.isQuiet(q.EM_QUIET)).toBe(true);
  });
  it("ask when storage is off", async () => {
    const q = await import("@/components/account/quiet");
    at("");
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("off"); }, setItem: () => {}, removeItem: () => {} });
    expect(q.isQuiet(q.WAIVER_QUIET)).toBe(false);
  });
});
