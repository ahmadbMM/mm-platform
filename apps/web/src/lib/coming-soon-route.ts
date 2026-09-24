/**
 * Where a request goes while the site is Coming Soon: null keeps it, a path sends it there.
 * The Coming Soon page is / (addresses carry no language) and every other address goes to it.
 * An old /en/... or /ar/... address goes to /en or /ar instead, which stay: next-intl sends
 * them on to / in that language.
 */
export function comingSoonTarget(pathname: string): string | null {
  if (pathname === "/") return null;
  const m = pathname.match(/^\/(en|ar)(\/.*)?$/);
  if (m && (!m[2] || m[2] === "/")) return null;
  return m ? `/${m[1]}` : "/";
}
