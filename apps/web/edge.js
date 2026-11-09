// The front of the site in production and on staging (wrangler.edge.jsonc): a small Worker that answers at
// micromobility.sa itself - the www move, the edge's page copies, staging's marks - and asks the site's own Worker
// (site.js) through the SITE service binding for the rest. It starts at once on a cold machine, where the site, 23 MB,
// took over a second before it could send even a kept page (the user, 2026-11-09).
import { front } from "./edge/front.js";

// The binding is given the request alone (servePage hands an in-process site its env and ctx too).
export default front((env) => ({ fetch: (request) => env.SITE.fetch(request) }));
