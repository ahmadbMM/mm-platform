/**
 * Where a request goes while the site is Coming Soon: null keeps it, a path sends it there.
 * The Coming Soon page itself (/, /en, /ar) stays; every other page under a locale goes back
 * to that locale's Coming Soon, and an address with no locale goes to /.
 */
export function comingSoonTarget(pathname: string): string | null {
  if (pathname === "/") return null;
  const m = pathname.match(/^\/(en|ar)(\/.*)?$/);
  if (m && (!m[2] || m[2] === "/")) return null;
  return m ? `/${m[1]}` : "/";
}
