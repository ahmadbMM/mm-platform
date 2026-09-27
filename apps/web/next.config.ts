import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");


// The site's security headers. The pages load nothing from elsewhere but the Google Maps embed,
// the database (the forms and the account page call it from the browser), photos (the site's own,
// staff uploads through /media, and https images staff paste), Cloudflare Web Analytics (named in
// the Privacy Notice), Cloudflare Turnstile (the sign-in check, once its keys are set) and, on the
// live ride map (/live), MapLibre GL from jsDelivr with OpenStreetMap's tiles - MapLibre runs its
// tile work in a Worker it makes from a blob, hence worker-src. Next writes its own small inline
// scripts, hence 'unsafe-inline' for scripts. No site may frame a page (the staff preview opens in
// its own window). The two registration forms send their own headers (src/forms/headers.ts) and
// are left out here.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyqxovbnlreassrqihr.supabase.co";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} https://cloudflareinsights.com https://tile.openstreetmap.org`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src https://www.google.com https://challenges.cloudflare.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // No includeSubDomains: company email and its webmail live on the old host (DEPLOY.md), and
  // this must not decide how those addresses are reached.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=()" },
];

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // The NFC stickers on the fleet hold micromobility.sa/b/42 and must keep working forever; the
    // page itself moved to /bikes/42 (2026-09-27, with the bike catalogue). Permanent, so a phone
    // that has tapped once keeps the new address.
    return [{ source: "/b/:code(\\d{1,6})", destination: "/bikes/:code", permanent: true }];
  },
  async headers() {
    // Every page and API answer except the two registration forms, which keep their own.
    return [{ source: "/((?!petromin$|community/registration$).*)", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(config);
