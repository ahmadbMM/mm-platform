// The venue's session cookie. The token never reaches page scripts: the Worker keeps it in an
// HttpOnly cookie and adds it to every database call itself.
//
// Host-only on purpose (no Domain attribute): the portal's address is not decided yet, and a
// cookie scoped to the whole of micromobility.sa would also be sent to the main website.

export const COOKIE = "mm_fnb";
export const MAX_AGE = 30 * 24 * 3600;

export type Session = { id: number; token: string };

export function encodeSession(s: Session): string {
  return `${s.id}~${s.token}`;
}

export function decodeSession(v: string | null | undefined): Session | null {
  if (!v) return null;
  const m = /^(\d{1,18})~([A-Za-z0-9_-]{16,200})$/.exec(v);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? { id, token: m[2] } : null;
}

/** The value of one cookie from a Cookie header. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function setCookie(s: Session): string {
  return `${COOKIE}=${encodeSession(s)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function sessionOf(req: Request): Session | null {
  return decodeSession(readCookie(req.headers.get("cookie"), COOKIE));
}
