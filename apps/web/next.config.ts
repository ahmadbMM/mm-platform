import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");


// The site's security headers. The pages load nothing from elsewhere but the Google Maps embed,
// the database (the forms and the account page call it from the browser), photos (the site's own,
// staff uploads through /media, and https images staff paste), Cloudflare Web Analytics (named in
// the Privacy Notice), Cloudflare Turnstile (the sign-in check, once its keys are set) and, on the
// live ride map (/live), MapLibre GL from jsDelivr with OpenStreetMap's tiles - MapLibre runs its
// tile work in a Worker it makes from a blob, hence worker-src. Of jsDelivr only MapLibre's two
// pinned files are allowed, never the whole host (it serves any npm package or GitHub file): the
// version is components/live/LiveMap.tsx's, and a test fails when the two differ. Next writes its own
// small inline scripts, hence 'unsafe-inline' for scripts (DEPLOY.md: a nonce cannot be used while
// pages are kept at the edge). No site may frame a page but the staff page, whose Website section
// shows the preview inside an iPhone-sized frame (rentals _webPhonePreview); there is no
// X-Frame-Options, as it cannot name another host and would refuse that frame in some browsers.
// The two registration forms send their own headers (src/forms/headers.ts) and are left out here.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpffkzmsfyilicwcsszz.supabase.co";
const MAPLIBRE = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl";
// Online payments (2026-11-10): Moyasar's payment form, its two pinned files only (src/lib/pay/config.ts names
// the same version; a test checks they agree), which posts the card straight to Moyasar's API, reports its own
// errors to AppSignal, and loads Apple's Apple Pay script on Apple devices. 3-D Secure is a full-page visit to
// the bank, so no frame is needed. payment=(self): Apple Pay on the site's own pages.
const MOYASAR = "https://cdn.jsdelivr.net/npm/moyasar-payment-form@2.3.1/dist/moyasar";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com ${MAPLIBRE}.js ${MOYASAR}.umd.js https://applepay.cdn-apple.com`,
  `style-src 'self' 'unsafe-inline' ${MAPLIBRE}.css ${MOYASAR}.css`,
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} https://cloudflareinsights.com https://tile.openstreetmap.org https://api.moyasar.com https://appsignal-endpoint.net https://applepay.cdn-apple.com`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src https://www.google.com https://challenges.cloudflare.com",
  "frame-ancestors 'self' https://staff.micromobility.sa",
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
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(self), usb=(), geolocation=()" },
];

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
      // Apple Pay on the web: the domain association file Moyasar hands out, at the exact address Apple asks
      // for, with no extension and no redirect (app/api/pay/apple-domain).
      { source: "/.well-known/apple-developer-merchantid-domain-association", destination: "/api/pay/apple-domain" },
    ];
  },
  async headers() {
    // Every page and API answer except the registration forms and the Defe page, which keep their own.
    return [{ source: "/((?!petromin$|community/registration$|defe$).*)", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(config);
