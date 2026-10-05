import { afterEach, describe, expect, it, vi } from "vitest";
import { edgeScope, edgeStore, memo, memoSettled, resetMemo } from "../memo";

// lib/memo.ts: one read shared by everyone who asks at once, a minute's copy, the copy served while
// it is refreshed, the last good copy through a failed read, and the edge's copy for a cold start.
const CF = Symbol.for("__cloudflare-context__"); // where OpenNext puts the Worker's context
const G = globalThis as Record<symbol, unknown>;
afterEach(() => { resetMemo(); delete G[CF]; vi.unstubAllGlobals(); });

/** A read that gives these answers in turn (the last one from then on); an Error is thrown. */
const reader = (answers: unknown[]) => {
  let i = 0;
  return vi.fn(async () => { const a = answers[Math.min(i++, answers.length - 1)]; if (a instanceof Error) throw a; return a; });
};
const MIN = 60_000;

describe("memo", () => {
  it("shares one read between everyone who asks at once", async () => {
    let answer!: (v: { n: number }) => void;
    const read = vi.fn(() => new Promise<{ n: number }>((r) => { answer = r; }));
    const calls = [1, 2, 3, 4].map(() => memo("k", { ttl: MIN, now: 0, read }));
    answer({ n: 1 });
    const got = await Promise.all(calls);
    expect(read).toHaveBeenCalledTimes(1);
    for (const g of got) expect(g).toBe(got[0]);
  });

  it("serves the copy for the ttl, then serves it while a refresh runs behind the caller", async () => {
    const read = reader([{ n: 1 }, { n: 2 }]);
    const a = await memo("k", { ttl: MIN, now: 0, read });
    expect(await memo("k", { ttl: MIN, now: MIN - 1, read })).toBe(a);
    expect(read).toHaveBeenCalledTimes(1);
    expect(await memo("k", { ttl: MIN, now: MIN, read })).toBe(a); // the old copy, at once
    expect(read).toHaveBeenCalledTimes(2); // the refresh is on its way...
    expect(read).toHaveBeenLastCalledWith(a); // ...and knows what it replaces
    await memoSettled();
    expect(await memo("k", { ttl: MIN, now: MIN + 1, read })).toEqual({ n: 2 });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("asks the Worker to stay until the refresh has landed when it runs on Cloudflare", async () => {
    const waitUntil = vi.fn();
    G[CF] = { ctx: { waitUntil }, env: {}, cf: {} };
    const read = reader([{ n: 1 }, { n: 2 }]);
    await memo("k", { ttl: 1, now: 0, read });
    await memo("k", { ttl: 1, now: 5, read });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(await memo("k", { ttl: 1, now: 5, read })).toEqual({ n: 2 });
  });

  it("serves the last good copy through a failed read, and tries again only after the ttl", async () => {
    const read = reader([{ n: 1 }, null, new Error("offline"), { n: 4 }]);
    const a = await memo("k", { ttl: MIN, now: 0, read });
    expect(await memo("k", { ttl: MIN, now: MIN, read })).toBe(a); // the refresh answers null...
    await memoSettled();
    expect(await memo("k", { ttl: MIN, now: MIN + 1, read })).toBe(a); // ...the copy stays, and no new read for a minute
    expect(read).toHaveBeenCalledTimes(2);
    expect(await memo("k", { ttl: MIN, now: 2 * MIN, read })).toBe(a); // this refresh throws
    await memoSettled();
    expect(read).toHaveBeenCalledTimes(3);
    expect(await memo("k", { ttl: MIN, now: 3 * MIN, read })).toBe(a);
    await memoSettled();
    expect(await memo("k", { ttl: MIN, now: 3 * MIN + 1, read })).toEqual({ n: 4 });
  });

  it("answers null when nothing has ever been read, and holds that for the ttl too", async () => {
    const read = reader([null, { n: 1 }]);
    expect(await memo("k", { ttl: MIN, now: 0, read })).toBeNull();
    expect(await memo("k", { ttl: MIN, now: MIN / 2, read })).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    expect(await memo("k", { ttl: MIN, now: MIN, read })).toEqual({ n: 1 }); // nothing to serve meanwhile: waits for the read
  });

  it("takes the kept copy when a cold read fails, and keeps every fresh copy", async () => {
    const kept = { read: vi.fn(async () => ({ n: 9 })), write: vi.fn(async () => {}) };
    expect(await memo("k", { ttl: MIN, now: 0, read: reader([null]), keep: kept })).toEqual({ n: 9 });
    expect(kept.write).not.toHaveBeenCalled();
    resetMemo();
    await memo("k", { ttl: MIN, now: 0, read: reader([{ n: 1 }]), keep: kept });
    expect(kept.write).toHaveBeenCalledWith({ n: 1 });
  });

  it("waits for a read that never settles only so long, then takes the edge's copy, for everyone after too", async () => {
    // a read whose request was cut off on Cloudflare (the visitor left, error 1102) never settles
    const read = vi.fn(() => new Promise<{ n: number }>(() => {}));
    const kept = { read: vi.fn(async () => ({ n: 9 })), write: vi.fn(async () => {}) };
    expect(await memo("k", { ttl: MIN, now: 0, wait: 5, read, keep: kept })).toEqual({ n: 9 });
    expect(await memo("k", { ttl: MIN, now: 1, wait: 5, read, keep: kept })).toEqual({ n: 9 }); // at once
    expect(read).toHaveBeenCalledTimes(1); // the read is still the one in flight...
    expect(await memo("k", { ttl: MIN, now: 2, wait: 5, read })).toEqual({ n: 9 });
  });

  it("gives up a read still pending after 15 seconds; the next caller reads afresh", async () => {
    let lateAnswer!: (v: { n: number }) => void;
    const lost = vi.fn(() => new Promise<{ n: number }>((r) => { lateAnswer = r; }));
    expect(await memo("k", { ttl: MIN, now: 0, wait: 5, read: lost })).toBeNull(); // nothing kept anywhere
    expect(await memo("k", { ttl: MIN, now: 15_000, wait: 5, read: lost })).toBeNull(); // still the same read
    expect(lost).toHaveBeenCalledTimes(1);
    let answer!: (v: { n: number }) => void;
    const fresh = vi.fn(() => new Promise<{ n: number }>((r) => { answer = r; }));
    const asking = memo("k", { ttl: MIN, now: 15_001, wait: 1_000, read: fresh });
    expect(fresh).toHaveBeenCalledTimes(1);
    lateAnswer({ n: 1 }); // the lost read lands after all: it must not clear the one in flight
    await new Promise((r) => setTimeout(r, 0));
    answer({ n: 2 });
    expect(await asking).toEqual({ n: 2 });
    expect(await memo("k", { ttl: MIN, now: 15_002, read: fresh })).toEqual({ n: 2 });
  });

  it("forgets copies by key prefix", async () => {
    await memo("a:1", { ttl: MIN, now: 0, read: reader([1]) });
    await memo("b:1", { ttl: MIN, now: 0, read: reader([2]) });
    resetMemo("a:");
    const read = reader([3]);
    expect(await memo("a:1", { ttl: MIN, now: 0, read })).toBe(3);
    expect(await memo("b:1", { ttl: MIN, now: 0, read })).toBe(2);
  });

  it("keeps the copies on globalThis, where every bundle finds them", async () => {
    await memo("k", { ttl: MIN, now: 0, read: reader([1]) });
    expect((G[Symbol.for("mm.cache")] as Map<string, unknown>).has("k")).toBe(true);
  });
});

describe("edgeStore", () => {
  it("keeps a copy in Cloudflare's cache for a week and reads it back; without a cache, nothing", async () => {
    const put = new Map<string, Response>();
    vi.stubGlobal("caches", { default: { match: async (k: string) => put.get(k)?.clone(), put: async (k: string, r: Response) => { put.set(k, r); } } });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://qpffkz.supabase.co");
    const keep = edgeStore<{ n: number }>("thing");
    expect(await keep.read()).toBeNull();
    await keep.write({ n: 1 });
    expect(await keep.read()).toEqual({ n: 1 });
    const [key, res] = [...put.entries()][0];
    expect(key).toBe("https://micromobility.sa/__site-content/qpffkz/thing/v1");
    expect(res.headers.get("cache-control")).toBe("public, max-age=604800");
    // staging (its own database) shares the zone's cache but never this copy
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://jkfhis.supabase.co");
    expect(await edgeStore("thing").read()).toBeNull();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    expect(await edgeStore("thing").read()).toBeNull();
  });
  it("names the database by its project ref", () => {
    expect(edgeScope("https://abcd.supabase.co")).toBe("abcd");
    expect(edgeScope(undefined)).toBe("local");
    expect(edgeScope("not a url")).toBe("local");
  });
});
