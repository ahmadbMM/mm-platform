import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { guard, json, langOf } from "@/lib/pay/http";
import { loadSiteContent } from "@/lib/site";
import { tabbySession } from "@/lib/store-api";
import { storeSwitches } from "@/lib/store-settings";

// POST /api/pay/tabby {pay, lang}: Tabby's checkout for a store order's payment (F84, lib/pay/tabby.ts), opened from the
// payment page's "Pay in 4 with Tabby". Answers {ok, url} (Tabby's own page) or {ok: false, error}: "tabby_off" until
// staff switch Tabby on (store.tabby.on) and the Worker holds Tabby's keys, "tabby_rejected" when Tabby will not take it.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const pay = typeof g.body.pay === "string" ? g.body.pay : "";
  const content = await loadSiteContent();
  const lang = langOf(g.body.lang) ?? "en";
  const address = resolvePage(siteSchema, content, asLocale(lang === "ar" ? "ar" : "en")).contact.address;
  const r = await tabbySession(pay, storeSwitches(content).tabby, undefined, {
    origin: new URL(req.url).origin, lang, showroom: typeof address === "string" ? address : "",
  });
  if (!r.ok) return json({ ok: false, error: r.error }, r.status);
  return json({ ok: true, url: r.data.url });
}
