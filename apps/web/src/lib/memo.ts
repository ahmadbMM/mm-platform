// One small cache for what the site reads from the database and keeps for a while: the staff
// content and the Journal (lib/site.ts), the bike catalogue (lib/catalog.ts) and the rides
// (lib/rides.ts). Each is read once per Worker instance and served from memory for a minute; once
// the minute is up the copy is served as it is and refreshed behind the visitor, so nobody waits
// for the database after the first read. A failed refresh keeps the last good copy.
//
// The copies live on globalThis, not in this module. Next builds the proxy (src/proxy.ts) and the
// pages into separate bundles, each with its own copy of every module, so a module-level variable
// was two caches: the proxy's read never served the page's. And everyone asking at once shares one
// read: a cold render of Home asked the database for the same rows four times - the proxy, then
// the metadata, the page and the layout together - before the first answer was back. Next's own
// fetch memoisation does not apply to a fetch given an AbortSignal, which every read here is.
//
// Beyond memory, a copy is kept in Cloudflare's cache at the edge (edgeStore) for a week: a Worker
// instance that has only just started, and so has nothing in memory, still has the last good copy
// when the database cannot be reached. Without it, "nothing read" meant Coming Soon on and every
// page off - a database outage would have closed the whole site.
import { getCloudflareContext } from "@opennextjs/cloudflare";

type Slot<T> = { at: number; value: T | null; inflight: Promise<T | null> | null };
type Store = Map<string, Slot<unknown>>;
const STORE: unique symbol = Symbol.for("mm.cache");
const store = (): Store => ((globalThis as { [STORE]?: Store })[STORE] ??= new Map());

/** Somewhere a copy outlives this Worker instance (the edge): read when a cold read fails, written
 *  after every fresh read. */
export type Keep<T> = { read(): Promise<T | null>; write(value: T): Promise<void> };

export type MemoOptions<T> = {
  /** How long a copy is served without a fresh read, in milliseconds. */
  ttl: number;
  /** The read; null when it could not be read. It is given the copy it replaces, so a read of
   *  several things can keep the parts that failed. */
  read: (prev: T | null) => Promise<T | null>;
  keep?: Keep<T>;
  /** The clock, for tests. */
  now?: number;
};

/**
 * The value under `key`: from memory while the copy is fresh; the copy as it is, refreshed behind
 * the caller, once it is not; read - once, shared by everyone asking at once - when there is none.
 * Null only when nothing has ever been read and neither the read nor `keep` has it; that null is
 * held for the ttl too, so an unreachable database is asked again once a minute, not on every page.
 */
export async function memo<T>(key: string, o: MemoOptions<T>): Promise<T | null> {
  const now = o.now ?? Date.now();
  const s = store();
  let slot = s.get(key) as Slot<T> | undefined;
  if (!slot) s.set(key, (slot = { at: -Infinity, value: null, inflight: null }));
  if (now - slot.at < o.ttl) return slot.value;
  const refresh = (slot.inflight ??= run(slot, o, now));
  if (slot.value === null) return refresh;
  background(refresh);
  return slot.value;
}

/** One read into the slot: a fresh copy replaces the old one (and goes to `keep`); a failed read
 *  keeps the old one, or takes `keep`'s when there is none. The slot is dated from when the read
 *  started, so a failure too is tried again only after the ttl. */
async function run<T>(slot: Slot<T>, o: MemoOptions<T>, now: number): Promise<T | null> {
  try {
    const fresh = await o.read(slot.value);
    if (fresh !== null) {
      slot.value = fresh;
      if (o.keep) await o.keep.write(fresh);
    } else if (slot.value === null && o.keep) {
      slot.value = await o.keep.read();
    }
  } catch {
    // a read that throws counts as failed
  } finally {
    slot.at = now;
    slot.inflight = null;
  }
  return slot.value;
}

/** A refresh nobody is waiting for. On Cloudflare the Worker is asked to stay until it has landed
 *  (ctx.waitUntil); elsewhere - tests, `next start` - the promise simply runs on. */
function background(p: Promise<unknown>): void {
  const quiet = p.then(() => undefined, () => undefined);
  try {
    getCloudflareContext().ctx.waitUntil(quiet);
  } catch {
    // not running on Cloudflare
  }
}

/** Tests only: forget every copy whose key starts with `prefix` (all of them, with none). */
export function resetMemo(prefix = ""): void {
  const s = store();
  for (const k of [...s.keys()]) if (k.startsWith(prefix)) s.delete(k);
}

/** Tests only: settles once every refresh in flight has landed. */
export async function memoSettled(): Promise<void> {
  await Promise.all([...store().values()].map((s) => s.inflight?.then(() => undefined, () => undefined)));
}

// The copy at the edge: Cloudflare's cache (caches.default), a week. The key is an address in name
// only; nothing answers there. Local runs and tests have no edge cache and skip this.
const EDGE_TTL = 7 * 24 * 60 * 60;
type EdgeCache = { match(k: string): Promise<Response | undefined>; put(k: string, r: Response): Promise<void> };
const edgeCache = (): EdgeCache | null => {
  try { return ((globalThis as { caches?: { default?: EdgeCache } }).caches?.default) ?? null; } catch { return null; }
};

/** The copy kept at the edge under `kind` ("site", "journal", "catalog", "rides"). */
export function edgeStore<T extends object>(kind: string): Keep<T> {
  const key = `https://micromobility.sa/__site-content/${kind}/v1`;
  return {
    async read() {
      try {
        const hit = await edgeCache()?.match(key);
        const data = hit ? await hit.json() : null;
        return data && typeof data === "object" ? (data as T) : null;
      } catch { return null; }
    },
    async write(value) {
      try {
        await edgeCache()?.put(key, new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${EDGE_TTL}` } }));
      } catch { /* the edge copy is a convenience */ }
    },
  };
}
