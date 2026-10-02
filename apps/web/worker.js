// The Worker's entry point (wrangler.jsonc "main"): the site as OpenNext builds it, answered from
// Cloudflare's edge for a minute when a page cannot differ between visitors (src/lib/page-cache.ts).
// .open-next/worker.js is written by `opennextjs-cloudflare build`, before wrangler bundles this.
import handler from "./.open-next/worker.js";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
import { servePage } from "./src/lib/page-cache";

// Staging (wrangler.jsonc env "staging", MM_ENV=staging): the same site on staging.micromobility.sa,
// behind Cloudflare Access. Nothing on it is for search engines, and every page title starts with
// "[Staging]" so a tab is never mistaken for the real site.
const isStaging = (env) => env && env.MM_ENV === "staging";

const worker = {
  fetch: async (request, env, ctx) => {
    if (!isStaging(env)) return servePage(request, env, ctx, handler);
    if (new URL(request.url).pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    const res = await servePage(request, env, ctx, handler);
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
    if (!(out.headers.get("content-type") || "").includes("text/html")) return out;
    return new HTMLRewriter()
      .on("title", { element(el) { el.prepend("[Staging] "); } })
      .transform(out);
  },
};

export default worker;
