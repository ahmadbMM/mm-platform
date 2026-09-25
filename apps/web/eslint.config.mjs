import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Build and temp output is never linted: .next (Next), .open-next (the Cloudflare bundle),
// .wrangler (what `wrangler dev` leaves behind), and the two form pages the form builds write.
const config = [
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "next-env.d.ts", "src/forms/*-page.ts"] },
  ...nextVitals,
  ...nextTs,
];

export default config;
