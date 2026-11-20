// How the selling screens ask the site's own routes (app/api/market/listing/*, app/api/market/photo): one answer shape
// whatever happened. A route answers {ok: true, ...} or {ok: false, error, detail?}; no answer at all (the connection
// dropped, the request ran out of time, a page that is not JSON) reads as the same refusal a server error does,
// "generic", so a screen always has words to say and never loses what was typed.
export type W2Refused = { ok: false; error: string; detail: string };
export type W2Answer<T> = ({ ok: true } & T) | W2Refused;

const GENERIC: W2Refused = { ok: false, error: "generic", detail: "" };

async function read<T>(ask: () => Promise<Response>): Promise<W2Answer<T>> {
  try {
    const res = await ask();
    const b = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; detail?: unknown } | null;
    if (b && b.ok === true) return b as { ok: true } & T;
    if (b && typeof b.error === "string") return { ok: false, error: b.error, detail: typeof b.detail === "string" ? b.detail : "" };
    return GENERIC;
  } catch {
    return GENERIC;
  }
}

/** A read of the account's own data. */
export const w2Get = <T,>(path: string): Promise<W2Answer<T>> =>
  read<T>(() => fetch(path, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(20_000) }));

/** A change. `keepalive`: the page is being left, and the request is to outlive it. */
export const w2Post = <T,>(path: string, body: unknown, keepalive = false): Promise<W2Answer<T>> =>
  read<T>(() => fetch(path, {
    method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body),
    ...(keepalive ? { keepalive: true } : { signal: AbortSignal.timeout(25_000) }),
  }));

/** A photo's two copies (a form with files). */
export const w2PostForm = <T,>(path: string, form: FormData): Promise<W2Answer<T>> =>
  read<T>(() => fetch(path, { method: "POST", credentials: "same-origin", body: form, signal: AbortSignal.timeout(90_000) }));
