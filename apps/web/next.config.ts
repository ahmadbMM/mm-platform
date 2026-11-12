import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// The site's security headers (the proxy sends them too, on the forms' pages of the website).
import { SECURITY_HEADERS } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // The NFC stickers on the fleet hold micromobility.sa/b/42 and must keep working forever; the
    // page itself moved to /bikes/42 (2026-09-27, with the bike catalogue). Permanent, so a phone
    // that has tapped once keeps the new address.
    return [{ source: "/b/:code(\\d{1,6})", destination: "/bikes/:code", permanent: true }];
  },
  async rewrites() {
    // The home-screen icon is src/app/apple-icon.png (scripts/make-icons.mjs), which Next names in
    // every page's head; iPhones and crawlers also ask for it at the old fixed addresses.
    return [
      { source: "/apple-touch-icon.png", destination: "/apple-icon.png" },
      { source: "/apple-touch-icon-precomposed.png", destination: "/apple-icon.png" },
    ];
  },
  async headers() {
    // Every page and API answer but the forms' addresses below, whose own pages (?classic=1) send their own headers
    // (src/forms/headers.ts). The website's pages at those addresses get these from the proxy (proxy.ts): a rule
    // here that tells them apart by the query (`missing`) works under `next start` but not on Cloudflare, where the
    // two pages went out with no security headers at all (2026-11-09).
    return [{ source: "/((?!petromin$|petromin-invite$|dukan$|community/registration$).*)", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(config);
