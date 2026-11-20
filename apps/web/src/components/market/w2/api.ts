// How the selling screens ask the site's own routes (app/api/market/listing/*, app/api/market/photo): one answer shape
// whatever happened. A route answers {ok: true, ...} or {ok: false, error, detail?}; no answer at all (the connection
// dropped, the request ran out of time, a page that is not JSON) reads as the same refusal a server error does,
// "generic", so a screen always has words to say and never loses what was typed.
// A request is given up after its time with an AbortController and a timer, as the site's other screens do:
// AbortSignal.timeout is missing from the browsers of older phones (Safari before 16), and calling it there would
// fail every request before it was sent.
export type W2Refused = { ok: false; error: string; detail: string };
export type W2Answer<T> = ({ ok: true } & T) | W2Refused;

const GENERIC: W2Refused = { ok: false, error: "generic", detail: "" };

/** `ms`: how long the answer (its body too) is waited for; 0 never gives up (a request that outlives the page). */
async function read<T>(ask: (signal: AbortSignal | undefined) => Promise<Response>, ms: number): Promise<W2Answer<T>> {
  const stop = ms > 0 ? new AbortController() : null;
  const timer = stop ? setTimeout(() => stop.abort(), ms) : null;
  try {
    const res = await ask(stop?.signal);
    const b = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; detail?: unknown } | null;
    if (b && b.ok === true) return b as { ok: true } & T;
    if (b && typeof b.error === "string") return { ok: false, error: b.error, detail: typeof b.detail === "string" ? b.detail : "" };
    return GENERIC;
  } catch {
    return GENERIC;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** A read of the account's own data. */
export const w2Get = <T,>(path: string): Promise<W2Answer<T>> =>
  read<T>((signal) => fetch(path, { cache: "no-store", credentials: "same-origin", signal }), 20_000);

/** A change. `keepalive`: the page is being left, and the request is to outlive it. */
export const w2Post = <T,>(path: string, body: unknown, keepalive = false): Promise<W2Answer<T>> =>
  read<T>((signal) => fetch(path, {
    method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body),
    ...(keepalive ? { keepalive: true } : { signal }),
  }), keepalive ? 0 : 25_000);

/** A photo's two copies (a form with files). */
export const w2PostForm = <T,>(path: string, form: FormData): Promise<W2Answer<T>> =>
  read<T>((signal) => fetch(path, { method: "POST", credentials: "same-origin", body: form, signal }), 90_000);
