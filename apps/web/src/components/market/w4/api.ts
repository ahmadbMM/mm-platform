// How the shop screens ask the site's own routes (app/api/market/shop/*, /api/market/me, and the photo route for a
// logo): one answer shape whatever happened. A route answers {ok: true, ...} or {ok: false, error, detail?}; no
// answer at all (the connection dropped, the request ran out of time, a page that is not JSON) reads as the same
// refusal a server error does, "generic", so a screen always has words to say and never loses what was typed.
export type W4Refused = { ok: false; error: string; detail: string };
export type W4Answer<T> = ({ ok: true } & T) | W4Refused;

const GENERIC: W4Refused = { ok: false, error: "generic", detail: "" };

async function read<T>(ask: () => Promise<Response>): Promise<W4Answer<T>> {
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
export const w4Get = <T,>(path: string): Promise<W4Answer<T>> =>
  read<T>(() => fetch(path, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(20_000) }));

/** A change. */
export const w4Post = <T,>(path: string, body: unknown): Promise<W4Answer<T>> =>
  read<T>(() => fetch(path, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) }));

/** A picture's two copies (a form with files). */
export const w4PostForm = <T,>(path: string, form: FormData): Promise<W4Answer<T>> =>
  read<T>(() => fetch(path, { method: "POST", credentials: "same-origin", body: form, signal: AbortSignal.timeout(90_000) }));
