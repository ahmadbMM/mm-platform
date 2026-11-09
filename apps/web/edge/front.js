// The front of the site: everything a request meets before the site itself (Next, as OpenNext builds it) is asked.
// www.micromobility.sa moves to micromobility.sa, a page that cannot differ between visitors is answered from the
// edge's copy (src/lib/page-cache.ts), staging marks every page as staging, and a plain address names itself as
// canonical. `site(env)` is the site: in production and on staging a Worker of its own reached through a service
// binding (edge.js; the user, 2026-11-09: the first visit after a quiet spell took up to 2.5 s, most of it the 23 MB
// site starting on a cold machine even to send a kept copy - this front is small and starts at once), and in the
// preview the site in the same Worker (worker.js).
import { plainCanonical, servePage } from "../src/lib/page-cache";
import { apexTarget, movedStatus } from "../src/lib/canonical-host";
import { prefixTitles } from "../src/lib/staging";

// Staging (MM_ENV=staging): the same site on staging.micromobility.sa, behind Cloudflare Access. Nothing on it is for
// search engines, and every page title starts with "[Staging]" so a tab is never mistaken for the real site: the pages
// write it themselves (src/lib/staging.ts), so it stays once their script runs, and this adds it to any title that has
// not (the registration forms, a plain document) - never twice.
const isStaging = (env) => env && env.MM_ENV === "staging";

// A page asked for at its plain address names that address as its canonical one (src/lib/page-cache.ts,
// plainCanonical); the copy the edge keeps is untouched, so /club?lang=ar still names itself.
function plainAddress(request, res) {
  const canonical = plainCanonical(request);
  if (!canonical || !(res.headers.get("content-type") || "").includes("text/html")) return res;
  return new HTMLRewriter()
    .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", canonical); } })
    .transform(res);
}

export function front(site) {
  return {
    fetch: async (request, env, ctx) => {
      // www.micromobility.sa moves to micromobility.sa, path and query kept (src/lib/canonical-host.ts),
      // before the edge's page copies are asked: they are kept without the host.
      const apex = apexTarget(request.url);
      if (apex) return Response.redirect(apex, movedStatus(request.method));
      const handler = site(env);
      if (!isStaging(env)) return plainAddress(request, await servePage(request, env, ctx, handler));
      if (new URL(request.url).pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      const res = await servePage(request, env, ctx, handler);
      const out = new Response(res.body, res);
      out.headers.set("X-Robots-Tag", "noindex, nofollow");
      if (!(out.headers.get("content-type") || "").includes("text/html")) return out;
      return new HTMLRewriter()
        .on("title", prefixTitles())
        .transform(out);
    },
  };
}
