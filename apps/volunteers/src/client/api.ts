// Calls to the portal's own Worker (/api). The session cookie travels by itself; the page never
// sees the token.

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: string; status: number; detail?: string };
export type Result<T> = Ok<T> | Err;

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
  if (res.ok) return { ok: true, data: data as T };
  const d = (data && typeof data === "object" ? data : {}) as { error?: unknown; detail?: unknown };
  return { ok: false, code: d.error ? String(d.error) : "SERVER", status: res.status, detail: d.detail ? String(d.detail) : undefined };
}

export const rpc = <T>(name: string, args: Record<string, unknown> = {}) => post<T>(`/api/rpc/${name}`, args);
