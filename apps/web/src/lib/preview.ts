// Staff preview: a signed-in staff member sees the real site while the public sees Coming Soon.
// The staff page opens /<locale>/preview#t=<their access token>; that page hands the token to
// /api/preview, which checks it with the database (is_staff) and keeps it in an HttpOnly cookie
// for as long as the token lives (one hour). Every request re-checks it, cached for five minutes.

export const PREVIEW_COOKIE = "mm_preview";
const TTL_MS = 5 * 60_000;
const seen = new Map<string, { ok: boolean; until: number }>();

/** True when the token belongs to a signed-in staff member. */
export async function isStaffToken(token: string | undefined | null, fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<boolean> {
  if (!token || token.length > 4096 || !/^[A-Za-z0-9._-]+$/.test(token)) return false;
  const hit = seen.get(token);
  if (hit && hit.until > now) return hit.ok;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let ok = false, sure = false;
  if (url && key) {
    try {
      const res = await fetchImpl(`${url}/rest/v1/rpc/is_staff`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      ok = res.ok && (await res.json()) === true;
      // an answer, yes or no (a 401 is a no); a timeout or a 5xx is not, and is asked again
      sure = res.ok || res.status === 401 || res.status === 403;
    } catch {
      ok = false;
    }
  }
  if (sure) {
    if (seen.size > 500) seen.clear();
    seen.set(token, { ok, until: now + TTL_MS });
  }
  return ok;
}

/** Seconds until the token expires (its exp claim), capped at an hour. 0 if unreadable. */
export function tokenLifetime(token: string, now: number = Date.now()): number {
  try {
    const part = (token.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part + "===".slice((part.length + 3) % 4))) as { exp?: number };
    const left = Math.floor((payload.exp ?? 0) - now / 1000);
    return Math.max(0, Math.min(left, 3600));
  } catch {
    return 0;
  }
}
