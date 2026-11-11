// A request's body read `max` bytes at most, whatever its Content-Length says: a chunked body has none, and the
// header check alone let one of any size be read and parsed whole (bug hunt 2026-11-11). The reading stops as
// soon as the body passes `max`.

/** The body's bytes, or null when it is longer than `max`. A body that cannot be read counts as empty. */
export async function readCapped(req: Request, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        reader.cancel().catch(() => { /* already gone */ });
        return null;
      }
      parts.push(value);
    }
  } catch { return new Uint8Array(0); }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

/** What jsonCapped answers for a body longer than its `max`. */
export const TOO_BIG: unique symbol = Symbol("too big");

/** The body as JSON, `max` bytes at most: TOO_BIG when it is longer, null when it is empty or not JSON. */
export async function jsonCapped(req: Request, max: number): Promise<unknown> {
  const raw = await readCapped(req, max);
  if (!raw) return TOO_BIG;
  try { return JSON.parse(new TextDecoder().decode(raw)); } catch { return null; }
}
