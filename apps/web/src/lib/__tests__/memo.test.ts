import { afterEach, describe, expect, it, vi } from "vitest";
import { edgeStore, memo, memoSettled, resetMemo } from "../memo";

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
    const keep = edgeStore<{ n: number }>("thing");
    expect(await keep.read()).toBeNull();
    await keep.write({ n: 1 });
    expect(await keep.read()).toEqual({ n: 1 });
    const [key, res] = [...put.entries()][0];
    expect(key).toBe("https://micromobility.sa/__site-content/thing/v1");
    expect(res.headers.get("cache-control")).toBe("public, max-age=604800");
    vi.unstubAllGlobals();
    expect(await edgeStore("thing").read()).toBeNull();
  });
});
