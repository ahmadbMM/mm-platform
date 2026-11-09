// The site's own Worker in production and on staging (wrangler.jsonc env "production" and "staging"): the site as
// OpenNext builds it and nothing else. It has no address of its own: the front (edge.js, wrangler.edge.jsonc) asks it
// through a service binding for what the edge's copies cannot answer. .open-next/worker.js is written by
// `opennextjs-cloudflare build`, before wrangler bundles this.
export { default, DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
