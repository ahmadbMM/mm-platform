import { getCloudflareContext } from "@opennextjs/cloudflare";

// Online payments (Moyasar, 2026-11-10): the keys live in the Worker's secrets, never in the repo.
//   MOYASAR_PUBLISHABLE_KEY  pk_test_… / pk_live_…  the browser's form (public, but set per environment)
//   MOYASAR_SECRET_KEY       sk_test_… / sk_live_…  this server only: fetch, list, refund
//   MOYASAR_WEBHOOK_SECRET   the "Secret Token" typed into Moyasar's webhook settings
//   PAY_SERVER_KEY           this server's key to the database's pay_* functions (its sha256 is in pay_server_keys)
//   APPLE_PAY_DOMAIN_FILE    the domain association file Moyasar's dashboard gives (Settings > Apple Pay Domains)
// `wrangler secret put <NAME> --env staging` sets each; nothing works until the four first ones are there,
// and the pages then say payments are not open rather than half-working.

export type PayEnv = {
  MOYASAR_PUBLISHABLE_KEY?: string;
  MOYASAR_SECRET_KEY?: string;
  MOYASAR_WEBHOOK_SECRET?: string;
  PAY_SERVER_KEY?: string;
  APPLE_PAY_DOMAIN_FILE?: string;
};

export function payEnv(): PayEnv {
  let env: PayEnv = {};
  try { env = getCloudflareContext().env as PayEnv; } catch { /* a local run or a test */ }
  const pick = (k: keyof PayEnv) => env[k] || process.env[k] || undefined;
  return {
    MOYASAR_PUBLISHABLE_KEY: pick("MOYASAR_PUBLISHABLE_KEY"),
    MOYASAR_SECRET_KEY: pick("MOYASAR_SECRET_KEY"),
    MOYASAR_WEBHOOK_SECRET: pick("MOYASAR_WEBHOOK_SECRET"),
    PAY_SERVER_KEY: pick("PAY_SERVER_KEY"),
    APPLE_PAY_DOMAIN_FILE: pick("APPLE_PAY_DOMAIN_FILE"),
  };
}

/** Whether payments can be taken at all here: both Moyasar keys of one mode, and the database key. */
export function payReady(e: PayEnv = payEnv()): boolean {
  const pk = e.MOYASAR_PUBLISHABLE_KEY ?? "", sk = e.MOYASAR_SECRET_KEY ?? "";
  const mode = (k: string) => (/^(pk|sk)_test_/.test(k) ? "test" : /^(pk|sk)_live_/.test(k) ? "live" : "");
  return !!mode(pk) && mode(pk) === mode(sk) && (e.PAY_SERVER_KEY ?? "").length >= 32;
}

export const payMode = (e: PayEnv = payEnv()): "test" | "live" => (/^pk_live_/.test(e.MOYASAR_PUBLISHABLE_KEY ?? "") ? "live" : "test");

/** Moyasar's payment form, pinned (moyasar-payment-form on npm, served by jsDelivr; the CSP in next.config.ts
 *  allows exactly these two files). 2.3.1 = 2026-11-05. */
export const MOYASAR_FORM_VERSION = "2.3.1";
export const MOYASAR_FORM_JS = `https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_FORM_VERSION}/dist/moyasar.umd.js`;
export const MOYASAR_FORM_CSS = `https://cdn.jsdelivr.net/npm/moyasar-payment-form@${MOYASAR_FORM_VERSION}/dist/moyasar.css`;
