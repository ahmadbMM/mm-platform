import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Build and temp output is never linted: .next (Next), .open-next (the Cloudflare bundle),
// .wrangler (what `wrangler dev` leaves behind).
const config = [
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
];

export default config;
