// micromobility.sa is the site's one address. www.micromobility.sa reaches the same Worker
// (wrangler.jsonc routes) and used to answer as a full copy of the site: every page twice, under two
// addresses. A request to it now moves to the same path and query on micromobility.sa, for good.
// worker.js asks first, before the edge's page copies (they are kept without the host, so a copy made
// for one host was answered on the other); the proxy asks too, for a run without that wrapper.
export const SITE_HOST = "micromobility.sa";

/** The same path and query on micromobility.sa, for a request to www.micromobility.sa; else null. */
export function apexTarget(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  return u.hostname === `www.${SITE_HOST}` ? `https://${SITE_HOST}${u.pathname}${u.search}` : null;
}

/** Permanent: 301 for GET and HEAD, as search engines expect; 308 for anything else, which keeps the
 *  method and its body (a 301 turns a POST into a GET). */
export const movedStatus = (method: string): 301 | 308 => (method === "GET" || method === "HEAD" ? 301 : 308);
