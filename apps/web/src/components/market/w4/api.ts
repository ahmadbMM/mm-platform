// How the shop screens ask the site's own routes (app/api/market/shop/*, /api/market/me, and the photo route for a
// logo): one answer shape whatever happened. A route answers {ok: true, ...} or {ok: false, error, detail?}; no
// answer at all (the connection dropped, the request ran out of time, a page that is not JSON) reads as the same
// refusal a server error does, "generic", so a screen always has words to say and never loses what was typed.
// A request gives up with a controller and a timer of its own, as the site's other screens do: AbortSignal.timeout
// is missing from phones a few years old, and there every request would have failed before it was sent.
export type W4Refused = { ok: false; error: string; detail: string };
export type W4Answer<T> = ({ ok: true } & T) | W4Refused;

const GENERIC: W4Refused = { ok: false, error: "generic", detail: "" };

async function read<T>(path: string, init: RequestInit, ms: number): Promise<W4Answer<T>> {
  const stop = new AbortController();
  // the time covers the whole answer, its body too
  const timer = setTimeout(() => stop.abort(), ms);
  try {
    const res = await fetch(path, { ...init, credentials: "same-origin", signal: stop.signal });
    const b = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; detail?: unknown } | null;
    if (b && b.ok === true) return b as { ok: true } & T;
    if (b && typeof b.error === "string") return { ok: false, error: b.error, detail: typeof b.detail === "string" ? b.detail : "" };
    return GENERIC;
  } catch {
    return GENERIC;
  } finally {
    clearTimeout(timer);
  }
}

/** A read of the account's own data. */
export const w4Get = <T,>(path: string): Promise<W4Answer<T>> => read<T>(path, { cache: "no-store" }, 20_000);

/** A change. */
export const w4Post = <T,>(path: string, body: unknown): Promise<W4Answer<T>> =>
  read<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 25_000);

/** A picture's two copies (a form with files). */
export const w4PostForm = <T,>(path: string, form: FormData): Promise<W4Answer<T>> => read<T>(path, { method: "POST", body: form }, 90_000);
