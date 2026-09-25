// The Worker's entry point (wrangler.jsonc "main"): the site as OpenNext builds it, answered from
// Cloudflare's edge for a minute when a page cannot differ between visitors (src/lib/page-cache.ts).
// .open-next/worker.js is written by `opennextjs-cloudflare build`, before wrangler bundles this.
import handler from "./.open-next/worker.js";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
import { servePage } from "./src/lib/page-cache";

const worker = {
  fetch: (request, env, ctx) => servePage(request, env, ctx, handler),
};

export default worker;
