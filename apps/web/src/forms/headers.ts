// The two registration forms (forms/community, forms/petromin) are single
// self-contained pages the website serves as they are; each build writes its page into this
// folder. These are the headers their own Cloudflare Workers sent, kept word for word: the pages
// talk to Supabase from the browser and Cloudflare Web Analytics (named in the Privacy Notice)
// injects its beacon, so both are allowed and nothing else is.
const COMMON = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
  "x-robots-tag": "noindex",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

const csp = (extraScript: string, extra: string[] = []) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${extraScript} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "connect-src 'self' https://amyqxovbnlreassrqihr.supabase.co https://cloudflareinsights.com",
  "img-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  ...extra,
].join("; ");

export const FORM_HEADERS = {
  // The community form posts nothing itself and asks for no device features.
  community: {
    ...COMMON,
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "content-security-policy": csp("", ["form-action 'none'"]),
  },
  // The Petromin form loads supabase-js from jsDelivr (pinned, with its integrity hash).
  petromin: {
    ...COMMON,
    "content-security-policy": csp(" https://cdn.jsdelivr.net"),
  },
} as const;

export type FormName = keyof typeof FORM_HEADERS;

export function formResponse(form: FormName, body: string | null): Response {
  return new Response(body, { headers: FORM_HEADERS[form] });
}
