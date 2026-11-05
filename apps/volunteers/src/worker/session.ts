// The volunteer's session cookie. A volunteer signs in with their MicroMobility account, and the
// account's token never reaches page scripts: the Worker keeps it in an HttpOnly cookie and adds it
// to every database call itself. Host-only on purpose (no Domain attribute): a cookie scoped to the
// whole of micromobility.sa would also be sent to the main website.

export const COOKIE = "mm_volunteer";
export const MAX_AGE = 30 * 24 * 3600;

export type Session = { id: string; token: string };

export function encodeSession(s: Session): string {
  return `${s.id}~${s.token}`;
}

export function decodeSession(v: string | null | undefined): Session | null {
  if (!v) return null;
  const m = /^([A-Za-z0-9_-]{1,64})~([A-Za-z0-9_-]{16,200})$/.exec(v);
  return m ? { id: m[1], token: m[2] } : null;
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
