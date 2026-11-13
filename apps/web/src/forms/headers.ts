// The registration forms (forms/community, forms/petromin), the Saturday ride's booking page (forms/saturday) and the
// lockers page (forms/lockers) are single
// self-contained pages the website serves as they are; each build writes its page into this
// folder. These are the headers their own Cloudflare Workers sent: the pages talk to Supabase from
// the browser and Cloudflare Web Analytics (named in the Privacy Notice) injects its beacon, so both
// are allowed and nothing else is. Their fonts are the website's own files (public/fonts/forms; from
// Google Fonts until 2026-10-05), so fonts come from this origin only. The database's host is the one the
// site is built for (NEXT_PUBLIC_SUPABASE_URL, as apps/web/next.config.ts reads it): the forms'
// pages name the same project, and when the database moves (CLONE.md) they are repointed together.
// The site's own pages send HSTS (next.config.ts headers()), which the forms are left out of, so the
// forms send it themselves, with the same value (no includeSubDomains: company email lives on the
// old host); and the old X-Frame-Options beside frame-ancestors, for browsers that only read that.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpffkzmsfyilicwcsszz.supabase.co";
const COMMON = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
  "x-robots-tag": "noindex",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-frame-options": "DENY",
  // Neither form asks for a device feature.
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

const csp = (extraScript: string, extra: string[] = []) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${extraScript} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE} https://cloudflareinsights.com`,
  "img-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  ...extra,
].join("; ");

export const FORM_HEADERS = {
  // The community form posts nothing itself: its script sends the answers.
  community: {
    ...COMMON,
    "content-security-policy": csp("", ["form-action 'none'"]),
  },
  // The Saturday Social Ride's page (forms/saturday, 2026-11-08) loads nothing from elsewhere either: its script talks
  // to the database and its fonts are the site's own. (The Defe booking page was its kind; turned off 2026-11-09.)
  saturday: {
    ...COMMON,
    "content-security-policy": csp("", ["form-action 'none'"]),
  },
  // The lockers page (forms/lockers, 2026-11-09): the Saturday page's kind; its riyal sign is the site's own font file.
  lockers: {
    ...COMMON,
    "content-security-policy": csp("", ["form-action 'none'"]),
  },
  // The Petromin page (forms/petromin: Petromin's, Petrolube's and Dukan's employees and Petromin's invited guests, one
  // page since 2026-11-13) loads no script from elsewhere either (supabase-js went with that build: its calls are plain
  // POSTs to the database), and its script sends the answers: a form submitted the browser's own way (Enter before the
  // script runs) would put the rider's details in the address. Its riyal sign is the site's own font file.
  petromin: {
    ...COMMON,
    "content-security-policy": csp("", ["form-action 'none'"]),
  },
} as const;

export type FormName = keyof typeof FORM_HEADERS;

export function formResponse(form: FormName, body: string | null): Response {
  return new Response(body, { headers: FORM_HEADERS[form] });
}
