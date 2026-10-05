// Calls to the portal's own Worker (/api). The session cookie travels by itself; the page never
// sees the token.

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: string; status: number };
export type Result<T> = Ok<T> | Err;

let onSignedOut: () => void = () => {};
/** What to do when the server says the session is over (BAD_TOKEN). */
export function whenSignedOut(fn: () => void): void {
  onSignedOut = fn;
}

let onMustChange: () => void = () => {};
/** What to do when the server says the temporary password must be changed first (MUST_CHANGE). */
export function whenMustChange(fn: () => void): void {
  onMustChange = fn;
}

export async function post<T>(path: string, body: unknown = {}): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, code: "NETWORK", status: 0 };
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { data = null; }
  // vendor_me without a session answers {signedIn: false} (a 200, so no error in the console on
  // every signed-out load): to the page it is a session that has ended, as BAD_TOKEN is.
  if (res.ok && isSignedOut(data)) { onSignedOut(); return { ok: false, code: "BAD_TOKEN", status: res.status }; }
  if (res.ok) return { ok: true, data: data as T };
  const code = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "SERVER";
  if (res.status === 401 && code === "BAD_TOKEN") onSignedOut();
  if (code === "MUST_CHANGE") onMustChange();
  return { ok: false, code, status: res.status };
}

export const rpc = <T>(name: string, args: Record<string, unknown> = {}) => post<T>(`/api/rpc/${name}`, args);

/** The Worker's answer to "who am I" without a session. */
export function isSignedOut(data: unknown): boolean {
  return !!data && typeof data === "object" && !Array.isArray(data) && (data as { signedIn?: unknown }).signedIn === false;
}
