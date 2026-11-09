// The preview's Worker (wrangler.jsonc, the default target, deployed by hand only): the front of the site
// (edge/front.js) and the site itself, as OpenNext builds it, in one Worker. Production and staging run the two apart:
// the front (edge.js, wrangler.edge.jsonc) and the site (site.js, wrangler.jsonc), so a kept page never waits for the
// whole site to start. .open-next/worker.js is written by `opennextjs-cloudflare build`, before wrangler bundles this.
import handler from "./.open-next/worker.js";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
import { front } from "./edge/front.js";

export default front(() => handler);
