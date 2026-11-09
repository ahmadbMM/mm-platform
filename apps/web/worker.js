// The Worker's entry point (wrangler.jsonc "main"): the site as OpenNext builds it, answered from
// Cloudflare's edge for a minute when a page cannot differ between visitors (src/lib/page-cache.ts).
// .open-next/worker.js is written by `opennextjs-cloudflare build`, before wrangler bundles this.
// Loaded on the first request a page copy cannot answer, not when the Worker starts: a copy served at
// the edge (src/lib/page-cache.ts) no longer waits for the site's router (~3 MB) to be read in first.
// The renderer itself (~16 MB) was already loaded that way, by OpenNext.
let site = null;
const handler = { fetch: (request, env, ctx) => (site ??= import("./.open-next/worker.js")).then((m) => m.default.fetch(request, env, ctx)) };
export { DOQueueHandler } from "./.open-next/.build/durable-objects/queue.js";
export { DOShardedTagCache } from "./.open-next/.build/durable-objects/sharded-tag-cache.js";
export { BucketCachePurge } from "./.open-next/.build/durable-objects/bucket-cache-purge.js";
import { plainCanonical, servePage } from "./src/lib/page-cache";
import { apexTarget, movedStatus } from "./src/lib/canonical-host";
import { prefixTitles } from "./src/lib/staging";

// Staging (wrangler.jsonc env "staging", MM_ENV=staging): the same site on staging.micromobility.sa,
// behind Cloudflare Access. Nothing on it is for search engines, and every page title starts with
// "[Staging]" so a tab is never mistaken for the real site: the pages write it themselves
// (src/lib/staging.ts), so it stays once their script runs, and this adds it to any title that has
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

const worker = {
  fetch: async (request, env, ctx) => {
    // www.micromobility.sa moves to micromobility.sa, path and query kept (src/lib/canonical-host.ts),
    // before the edge's page copies are asked: they are kept without the host.
    const apex = apexTarget(request.url);
    if (apex) return Response.redirect(apex, movedStatus(request.method));
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

export default worker;
