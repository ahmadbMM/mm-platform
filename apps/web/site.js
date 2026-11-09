// The site's own Worker in production and on staging (wrangler.jsonc env "production" and "staging"): the site as
// OpenNext builds it and nothing else. It has no address of its own: the front (edge.js, wrangler.edge.jsonc) asks it
// through a service binding for what the edge's copies cannot answer. .open-next/worker.js is written by
// `opennextjs-cloudflare build`, before wrangler bundles this.
import site from "./.open-next/worker.js";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

// Online payments (2026-11-10): every 5 minutes (wrangler.jsonc env "staging" triggers), ask Moyasar about payments
// still open or let go, and confirm card refunds left pending (src/app/api/pay/reconcile). The request goes straight to
// the site's own handler, never out on the network, and carries the server key. Nothing runs until the payment keys
// are set.
const worker = {
  fetch: (request, env, ctx) => site.fetch(request, env, ctx),
  scheduled: async (event, env, ctx) => {
    if (!env || !env.PAY_SERVER_KEY || !env.MOYASAR_SECRET_KEY) return;
    const host = env.MM_ENV === "staging" ? "https://staging.micromobility.sa" : "https://micromobility.sa";
    const req = new Request(`${host}/api/pay/reconcile`, { method: "POST", headers: { "x-pay-key": env.PAY_SERVER_KEY } });
    ctx.waitUntil(site.fetch(req, env, ctx).then(() => undefined, () => undefined));
  },
};

export default worker;
