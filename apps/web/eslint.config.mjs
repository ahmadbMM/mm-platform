import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Build and temp output is never linted: .next (Next), .open-next (the Cloudflare bundle),
// .wrangler (what `wrangler dev` leaves behind), and the two form pages the form builds write.
const config = [
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "next-env.d.ts", "src/forms/*-page.ts"] },
  ...nextVitals,
  ...nextTs,
  // The pages draw photos with <img> on purpose: src/lib/img.ts picks the copy to send from the
  // WebPs made at build time, and there is no image service on the Worker for next/image to call.
  { rules: { "@next/next/no-img-element": "off" } },
];

export default config;
